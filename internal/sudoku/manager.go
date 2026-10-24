// Connect Hub Sudoku sidecar manager. GPL-3.0.
package sudoku

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/mhsanaei/3x-ui/v3/internal/database/model"
	"github.com/mhsanaei/3x-ui/v3/internal/hub"
)

type Instance struct {
	ID          int
	Tag, Listen string
	Port        int
	Settings    Settings
}
type Traffic struct {
	Tag, Email string
	Up, Down   int64
}
type child struct {
	cmd         *exec.Cmd
	done        chan struct{}
	fingerprint string
	instance    Instance
	dir         string
	counters    map[string][2]int64
}
type Manager struct {
	mu       sync.Mutex
	children map[int]*child
	pending  []Traffic
}

var manager = &Manager{children: map[int]*child{}}

func GetManager() *Manager { return manager }

func (m *Manager) Running(id int) bool {
	m.mu.Lock()
	defer m.mu.Unlock()
	c := m.children[id]
	if c == nil {
		return false
	}
	select {
	case <-c.done:
		return false
	default:
		return true
	}
}

func InstanceFromInbound(ib *model.Inbound) (Instance, bool) {
	if ib == nil || ib.Protocol != model.Protocol("sudoku") || !ib.Enable {
		return Instance{}, false
	}
	settings, err := DecodeSettings(ib.Settings)
	if err != nil || settings.PublicKey == "" {
		return Instance{}, false
	}
	return Instance{ID: ib.Id, Tag: ib.Tag, Listen: strings.Trim(ib.Listen, "[]"), Port: ib.Port, Settings: settings}, true
}

// ServerConfig never writes the master or device private keys to the runtime
// config. Exact handshake hashes form a whitelist, including when it is empty.
func ServerConfig(inst Instance) (map[string]any, error) {
	users := []map[string]any{}
	for _, c := range inst.Settings.Clients {
		hash, err := UserHash(c.SudokuKey)
		if err != nil {
			return nil, err
		}
		blocked := !c.Enable || (c.ExpiryTime > 0 && c.ExpiryTime <= time.Now().UnixMilli())
		users = append(users, map[string]any{"alias": c.Email, "key": hash, "blocked": blocked})
	}
	if len(users) == 0 {
		users = append(users, map[string]any{"key": "0000000000000000", "blocked": true})
	}
	return map[string]any{"mode": "server", "transport": "tcp", "listen_address": inst.Listen, "local_port": inst.Port, "key": inst.Settings.PublicKey, "aead": inst.Settings.AEAD, "ascii": inst.Settings.Table, "users": users, "padding_min": 0, "padding_max": 0, "enable_pure_downlink": false, "multiplex": "off", "suspicious_action": "fallback", "fallback_address": "127.0.0.1:1", "httpmask": map[string]any{"disable": true, "mode": "auto", "tls": false, "host": "", "path_root": ""}, "reverse": map[string]string{"listen": ""}, "custom_tables": []string{}}, nil
}

func (m *Manager) Ensure(inst Instance) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.ensure(inst)
}
func (m *Manager) ensure(inst Instance) error {
	cfg, err := ServerConfig(inst)
	if err != nil {
		return err
	}
	raw, err := json.Marshal(cfg)
	if err != nil {
		return err
	}
	hash := sha256.Sum256(raw)
	fingerprint := hex.EncodeToString(hash[:])
	if old := m.children[inst.ID]; old != nil {
		select {
		case <-old.done:
		default:
			if old.fingerprint == fingerprint {
				return nil
			}
		}
		m.stop(inst.ID)
	}
	binary, err := hub.SudokuBinary()
	if err != nil {
		return err
	}
	dir := filepath.Join(os.Getenv("CONNECT_HUB_INTEGRATIONS_DIR"), "native-sudoku", strconv.Itoa(inst.ID))
	if err = os.MkdirAll(dir, 0700); err != nil {
		return err
	}
	path := filepath.Join(dir, "server.json")
	if err = os.WriteFile(path, raw, 0600); err != nil {
		return err
	}
	// No persisted old deny policy may override a restored database's clients.
	policy := map[string]string{}
	for _, c := range inst.Settings.Clients {
		h, _ := UserHash(c.SudokuKey)
		policy[h] = "enabled"
		if !c.Enable {
			policy[h] = "disabled"
		}
	}
	for _, h := range inst.Settings.RevokedKeyHashes {
		policy[h] = "revoked"
	}
	policyJSON, _ := json.Marshal(map[string]any{"users": policy})
	if err = os.WriteFile(filepath.Join(dir, "sudoku-policy.json"), policyJSON, 0600); err != nil {
		return err
	}
	// The core persists cumulative counters across restarts. Start from their
	// previous values so reconciliation does not count old traffic twice.
	baseline := map[string]struct{ RX, TX int64 }{}
	if stats, readErr := os.ReadFile(filepath.Join(dir, "sudoku-stats.json")); readErr == nil {
		if err = json.Unmarshal(stats, &baseline); err != nil {
			return fmt.Errorf("invalid Sudoku counters: %w", err)
		}
	}
	cmd := exec.Command(binary, "-c", path)
	cmd.Dir = dir
	cmd.Env = hub.SudokuEnvironment(dir)
	cmd.Stdout = io.Discard
	cmd.Stderr = io.Discard
	if err = cmd.Start(); err != nil {
		return err
	}
	c := &child{cmd: cmd, done: make(chan struct{}), fingerprint: fingerprint, instance: inst, dir: dir, counters: map[string][2]int64{}}
	for hash, value := range baseline {
		c.counters[hash] = [2]int64{value.RX, value.TX}
	}
	if m.children == nil {
		m.children = map[int]*child{}
	}
	m.children[inst.ID] = c
	go func() { _ = cmd.Wait(); close(c.done) }()
	select {
	case <-c.done:
		delete(m.children, inst.ID)
		return fmt.Errorf("Sudoku inbound %d failed to start", inst.ID)
	case <-time.After(100 * time.Millisecond):
		return nil
	}
}
func (m *Manager) Remove(id int) { m.mu.Lock(); defer m.mu.Unlock(); m.stop(id) }
func (m *Manager) stop(id int) {
	c := m.children[id]
	if c == nil {
		return
	}
	deltas, _ := collect(c)
	m.pending = append(m.pending, deltas...)
	_ = c.cmd.Process.Kill()
	<-c.done
	delete(m.children, id)
}
func (m *Manager) StopAll() {
	m.mu.Lock()
	defer m.mu.Unlock()
	for id := range m.children {
		m.stop(id)
	}
}
func (m *Manager) Reconcile(desired []Instance) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	keep := map[int]bool{}
	for _, inst := range desired {
		keep[inst.ID] = true
	}
	for id := range m.children {
		if !keep[id] {
			m.stop(id)
		}
	}
	var first error
	for _, inst := range desired {
		if err := m.ensure(inst); err != nil && first == nil {
			first = err
		}
	}
	return first
}

func collect(c *child) ([]Traffic, []string) {
	transport := &http.Transport{Proxy: nil, DialContext: func(ctx context.Context, _, _ string) (net.Conn, error) {
		return (&net.Dialer{}).DialContext(ctx, "unix", filepath.Join(c.dir, "sudoku.sock"))
	}}
	defer transport.CloseIdleConnections()
	client := &http.Client{Transport: transport, Timeout: 2 * time.Second, CheckRedirect: func(*http.Request, []*http.Request) error { return fmt.Errorf("redirect refused") }}
	response, err := client.Get("http://unix/v1/state")
	if err != nil {
		return nil, nil
	}
	defer response.Body.Close()
	var state struct {
		Version int `json:"api_version"`
		Users   []struct {
			Hash     string `json:"user_hash"`
			RX, TX   int64
			Sessions []json.RawMessage
		} `json:"users"`
	}
	if response.StatusCode != 200 || json.NewDecoder(io.LimitReader(response.Body, 4<<20)).Decode(&state) != nil || state.Version != 1 {
		return nil, nil
	}
	byHash := map[string]string{}
	for _, client := range c.instance.Settings.Clients {
		h, _ := UserHash(client.SudokuKey)
		byHash[h] = client.Email
	}
	deltas := []Traffic{}
	online := []string{}
	for _, user := range state.Users {
		email, ok := byHash[user.Hash]
		if !ok {
			continue
		}
		previous := c.counters[user.Hash]
		up, down := user.RX-previous[0], user.TX-previous[1]
		if up < 0 {
			up = user.RX
		}
		if down < 0 {
			down = user.TX
		}
		c.counters[user.Hash] = [2]int64{user.RX, user.TX}
		if up > 0 || down > 0 {
			deltas = append(deltas, Traffic{Tag: c.instance.Tag, Email: email, Up: up, Down: down})
		}
		if len(user.Sessions) > 0 {
			online = append(online, email)
		}
	}
	return deltas, online
}
func (m *Manager) CollectTraffic() ([]Traffic, []string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	deltas := m.pending
	m.pending = nil
	online := []string{}
	for _, c := range m.children {
		d, o := collect(c)
		deltas = append(deltas, d...)
		online = append(online, o...)
	}
	return deltas, online
}
