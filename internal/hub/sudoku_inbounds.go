// Connect Hub Sudoku inbound/device management, 2026-10-24. GPL-3.0.
package hub

import (
	"bytes"
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"
)

type SudokuInbound struct {
	ID      string         `json:"id"`
	Name    string         `json:"name"`
	Enabled bool           `json:"enabled"`
	Status  Status         `json:"status"`
	Devices []SudokuDevice `json:"devices"`
}
type SudokuDevice struct {
	ID      string `json:"id"`
	Name    string `json:"name"`
	Status  string `json:"status"`
	Created string `json:"created"`
	Hash    string `json:"userHash"`
	Key     string `json:"-"`
}
type savedDevice struct {
	SudokuDevice
	PrivateKey string `json:"privateKey"`
}
type inboundRecord struct {
	Name    string `json:"name"`
	Enabled bool   `json:"enabled"`
}
type SudokuRegistry struct {
	mu       sync.Mutex
	managers map[string]*Manager
}

var SudokuInbounds = &SudokuRegistry{managers: map[string]*Manager{}}

func newID() string {
	var b [16]byte
	if _, err := rand.Read(b[:]); err != nil {
		panic(err)
	}
	return hex.EncodeToString(b[:])
}
func validID(id string) bool {
	b, e := hex.DecodeString(id)
	return e == nil && len(b) == 16 && strings.ToLower(id) == id
}
func named(name string) bool {
	return strings.TrimSpace(name) != "" && len(name) <= 120 && !strings.ContainsAny(name, "\r\n\x00")
}
func saveJSON(path string, v any) error {
	b, e := json.MarshalIndent(v, "", "  ")
	if e != nil {
		return e
	}
	tmp := path + ".new"
	if e = os.WriteFile(tmp, b, 0600); e != nil {
		return e
	}
	return os.Rename(tmp, path)
}
func readJSON(path string, v any) error {
	b, e := os.ReadFile(path)
	if e != nil {
		return e
	}
	return json.Unmarshal(b, v)
}
func (r *SudokuRegistry) get(id string) (*Manager, error) {
	if e := allowed(); e != nil {
		return nil, e
	}
	if !validID(id) {
		return nil, errors.New("invalid inbound ID")
	}
	dir := filepath.Join(directory(), "sudoku-inbounds", id)
	if st, e := os.Lstat(dir); e != nil || !st.IsDir() || st.Mode()&os.ModeSymlink != 0 {
		return nil, errors.New("inbound not found")
	}
	if r.managers == nil {
		r.managers = map[string]*Manager{}
	}
	m := r.managers[id]
	if m == nil {
		m = &Manager{dir: dir}
		r.managers[id] = m
	}
	return m, nil
}
func (r *SudokuRegistry) List() ([]SudokuInbound, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	return r.list()
}
func (r *SudokuRegistry) list() ([]SudokuInbound, error) {
	out := []SudokuInbound{}
	if e := allowed(); e != nil {
		return out, e
	}
	entries, e := os.ReadDir(filepath.Join(directory(), "sudoku-inbounds"))
	if os.IsNotExist(e) {
		return out, nil
	}
	if e != nil {
		return nil, e
	}
	for _, entry := range entries {
		if !validID(entry.Name()) {
			continue
		}
		m, e := r.get(entry.Name())
		if e != nil {
			return nil, e
		}
		var meta inboundRecord
		if e = readJSON(filepath.Join(m.directory(), "inbound.json"), &meta); e != nil {
			return nil, e
		}
		devices, e := loadDevices(m)
		if e != nil {
			return nil, e
		}
		views := []SudokuDevice{}
		for _, d := range devices {
			views = append(views, d.SudokuDevice)
		}
		out = append(out, SudokuInbound{ID: entry.Name(), Name: meta.Name, Enabled: meta.Enabled, Status: m.State(), Devices: views})
	}
	return out, nil
}
func loadDevices(m *Manager) ([]savedDevice, error) {
	d := []savedDevice{}
	e := readJSON(filepath.Join(m.directory(), "devices.json"), &d)
	if os.IsNotExist(e) {
		return d, nil
	}
	return d, e
}
func (r *SudokuRegistry) Create(name string, p SudokuProfile) (string, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if !named(name) {
		return "", errors.New("enter an inbound name")
	}
	items, e := r.list()
	if e != nil {
		return "", e
	}
	for _, v := range items {
		if v.Status.Profile != nil && v.Status.Profile.Port == p.Port {
			return "", errors.New("another Sudoku inbound uses this port")
		}
	}
	id := newID()
	dir := filepath.Join(directory(), "sudoku-inbounds", "pending-"+id)
	if e = os.MkdirAll(dir, 0700); e != nil {
		return "", e
	}
	m := &Manager{dir: dir}
	if _, e = m.Create(p); e != nil {
		return "", e
	}
	if _, e = os.Stat(filepath.Join(dir, "master.key")); e != nil {
		return "", errors.New("compatible Core must provide a master private key")
	}
	if e = saveJSON(filepath.Join(dir, "inbound.json"), inboundRecord{Name: strings.TrimSpace(name)}); e != nil {
		return "", e
	}
	final := filepath.Join(directory(), "sudoku-inbounds", id)
	if e = os.Rename(dir, final); e != nil {
		return "", e
	}
	m.dir = final
	if r.managers == nil {
		r.managers = map[string]*Manager{}
	}
	r.managers[id] = m
	return id, nil
}
func (r *SudokuRegistry) SetRunning(id string, on bool) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	m, e := r.get(id)
	if e != nil {
		return e
	}
	var meta inboundRecord
	if e = readJSON(filepath.Join(m.directory(), "inbound.json"), &meta); e != nil {
		return e
	}
	if on {
		e = m.Start()
	} else {
		e = m.Stop()
	}
	if e != nil {
		return e
	}
	meta.Enabled = on
	return saveJSON(filepath.Join(m.directory(), "inbound.json"), meta)
}
func (r *SudokuRegistry) AddDevice(id, name string) (SudokuDevice, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	m, e := r.get(id)
	if e != nil {
		return SudokuDevice{}, e
	}
	if !named(name) {
		return SudokuDevice{}, errors.New("enter a device name")
	}
	devices, e := loadDevices(m)
	if e != nil {
		return SudokuDevice{}, e
	}
	for _, d := range devices {
		if d.Name == name {
			return SudokuDevice{}, errors.New("device name already exists")
		}
	}
	master, e := os.ReadFile(filepath.Join(m.directory(), "master.key"))
	if e != nil {
		return SudokuDevice{}, e
	}
	path, e := binary()
	if e != nil {
		return SudokuDevice{}, e
	}
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	cmd := exec.CommandContext(ctx, path, "-keygen", "-more", string(master))
	cmd.Dir = m.directory()
	cmd.Env = environmentAt(m.directory())
	var output limitedBuffer
	cmd.Stdout = &output
	cmd.Stderr = &output
	if e = cmd.Run(); e != nil {
		return SudokuDevice{}, errors.New("device key generation failed")
	}
	key := ""
	for _, line := range strings.Split(output.String(), "\n") {
		if _, v, ok := strings.Cut(line, "Split Private Key:"); ok {
			key = strings.TrimSpace(v)
		}
	}
	if key == "" {
		return SudokuDevice{}, errors.New("Core did not return a device key")
	}
	raw, e := hex.DecodeString(key)
	if e != nil {
		return SudokuDevice{}, errors.New("Core returned an invalid device key")
	}
	hash := sha256.Sum256(raw)
	d := SudokuDevice{ID: newID(), Name: strings.TrimSpace(name), Status: "enabled", Created: time.Now().UTC().Format(time.RFC3339), Hash: hex.EncodeToString(hash[:8])}
	for _, existing := range devices {
		if existing.Hash == d.Hash {
			return SudokuDevice{}, errors.New("Core generated a duplicate device key")
		}
	}
	devices = append(devices, savedDevice{SudokuDevice: d, PrivateKey: key})
	return d, saveJSON(filepath.Join(m.directory(), "devices.json"), devices)
}
func (r *SudokuRegistry) Export(id, device string) (map[string]any, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	m, e := r.get(id)
	if e != nil {
		return nil, e
	}
	ds, e := loadDevices(m)
	if e != nil {
		return nil, e
	}
	for _, d := range ds {
		if d.ID != device {
			continue
		}
		if d.Status != "enabled" {
			return nil, errors.New("device is disabled or revoked")
		}
		p := m.State().Profile
		if p == nil {
			return nil, errors.New("inbound profile missing")
		}
		table := strings.TrimPrefix(p.Table, "prefer_")
		compact := map[string]any{"h": p.Host, "p": p.Port, "k": d.PrivateKey, "a": table, "e": p.AEAD, "m": 1080, "x": true, "hd": true, "hm": "auto", "hx": "off", "hy": ""}
		b, _ := json.Marshal(compact)
		config := map[string]any{"mode": "client", "transport": "tcp", "local_port": 1080, "server_address": net.JoinHostPort(p.Host, strconv.Itoa(p.Port)), "key": d.PrivateKey, "aead": p.AEAD, "ascii": p.Table, "multiplex": "off", "enable_pure_downlink": false, "padding_min": 0, "padding_max": 0, "httpmask": map[string]any{"disable": true, "mode": "auto", "tls": false, "host": "", "path_root": ""}, "rule_urls": []string{"global"}}
		return map[string]any{"privateKey": d.PrivateKey, "uri": "sudoku://" + base64.RawURLEncoding.EncodeToString(b), "config": config}, nil
	}
	return nil, errors.New("device not found")
}
func (r *SudokuRegistry) SetDevice(id, device, status string) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	if status != "enabled" && status != "disabled" && status != "revoked" {
		return errors.New("invalid device status")
	}
	m, e := r.get(id)
	if e != nil {
		return e
	}
	ds, e := loadDevices(m)
	if e != nil {
		return e
	}
	found := false
	policy := map[string]string{}
	for i := range ds {
		if ds[i].ID == device {
			if ds[i].Status == "revoked" {
				return errors.New("revocation is permanent")
			}
			ds[i].Status = status
			found = true
		}
		policy[ds[i].Hash] = ds[i].Status
	}
	if !found {
		return errors.New("device not found")
	}
	if e = saveJSON(filepath.Join(m.directory(), "sudoku-policy.json"), map[string]any{"users": policy}); e != nil {
		return e
	}
	if e = saveJSON(filepath.Join(m.directory(), "devices.json"), ds); e != nil {
		return e
	}
	if m.State().Running {
		if m.applyPolicy(policy) == nil {
			return nil
		}
		if e = m.Stop(); e != nil {
			return e
		}
		return m.Start()
	}
	return nil
}

// The compatible Core's API is confined to this inbound's own Unix socket.
// If unavailable, restarting only this child loads the persisted deny policy.
func (m *Manager) applyPolicy(users map[string]string) error {
	b, _ := json.Marshal(map[string]any{"users": users})
	transport := &http.Transport{Proxy: nil, DialContext: func(ctx context.Context, _, _ string) (net.Conn, error) {
		return (&net.Dialer{}).DialContext(ctx, "unix", filepath.Join(m.directory(), "sudoku.sock"))
	}}
	defer transport.CloseIdleConnections()
	client := &http.Client{Transport: transport, Timeout: 2 * time.Second, CheckRedirect: func(*http.Request, []*http.Request) error { return errors.New("redirect refused") }}
	req, e := http.NewRequest(http.MethodPut, "http://unix/v1/policy", bytes.NewReader(b))
	if e != nil {
		return e
	}
	req.Header.Set("Content-Type", "application/json")
	res, e := client.Do(req)
	if e != nil {
		return e
	}
	defer res.Body.Close()
	var reply struct {
		Version int `json:"api_version"`
	}
	if res.StatusCode != 200 {
		return errors.New("Core policy update failed")
	}
	if e = json.NewDecoder(res.Body).Decode(&reply); e != nil {
		return e
	}
	if reply.Version != 1 {
		return errors.New("unsupported Core policy API")
	}
	return nil
}
func (r *SudokuRegistry) Remove(id string) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	m, e := r.get(id)
	if e != nil {
		return e
	}
	if m.State().Running {
		return errors.New("stop inbound before deleting")
	}
	parent := filepath.Join(directory(), "sudoku-inbounds")
	archive := filepath.Join(directory(), "sudoku-archive")
	if e = os.MkdirAll(archive, 0700); e != nil {
		return e
	}
	if e = os.Rename(filepath.Join(parent, id), filepath.Join(archive, id+"-"+newID())); e != nil {
		return e
	}
	delete(r.managers, id)
	return nil
}
func (r *SudokuRegistry) StopAll() {
	r.mu.Lock()
	defer r.mu.Unlock()
	for _, m := range r.managers {
		_ = m.Stop()
	}
}
func (r *SudokuRegistry) StartSaved() {
	items, e := r.List()
	if e != nil {
		return
	}
	for _, v := range items {
		if v.Enabled {
			_ = r.SetRunning(v.ID, true)
		}
	}
}
