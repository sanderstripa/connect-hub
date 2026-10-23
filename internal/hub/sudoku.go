// Connect Hub integration, added 2026-10-23. GPL-3.0; see LICENSE and NOTICE.
package hub

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"
)

// Manager owns only its own child. It never calls systemctl or changes networking.
type Manager struct {
	mu        sync.Mutex
	cmd       *exec.Cmd
	done      chan struct{}
	lastError string
}

var Sudoku = &Manager{}

type SudokuProfile struct {
	Host      string `json:"host"`
	Port      int    `json:"port"`
	PublicKey string `json:"publicKey"`
	AEAD      string `json:"aead"`
	Table     string `json:"table"`
}
type Status struct {
	Enabled    bool           `json:"enabled"`
	Configured bool           `json:"configured"`
	Running    bool           `json:"running"`
	Error      string         `json:"error,omitempty"`
	Profile    *SudokuProfile `json:"profile,omitempty"`
}

func directory() string { return os.Getenv("CONNECT_HUB_INTEGRATIONS_DIR") }
func allowed() error {
	if os.Getenv("CONNECT_HUB_SUDOKU") != "1" {
		return errors.New("Sudoku is disabled; enable CONNECT_HUB_SUDOKU=1 explicitly")
	}
	if !filepath.IsAbs(directory()) {
		return errors.New("CONNECT_HUB_INTEGRATIONS_DIR must be an absolute, dedicated directory")
	}
	return nil
}
func binary() (string, error) {
	if err := allowed(); err != nil {
		return "", err
	}
	p := os.Getenv("CONNECT_HUB_SUDOKU_BINARY")
	expected := strings.ToLower(os.Getenv("CONNECT_HUB_SUDOKU_SHA256"))
	if !filepath.IsAbs(p) || len(expected) != 64 {
		return "", errors.New("set an absolute Sudoku binary path and its SHA-256")
	}
	if _, err := hex.DecodeString(expected); err != nil {
		return "", errors.New("invalid binary SHA-256")
	}
	f, err := os.Open(p)
	if err != nil {
		return "", err
	}
	defer f.Close()
	st, err := f.Stat()
	if err != nil {
		return "", err
	}
	if !st.Mode().IsRegular() {
		return "", errors.New("binary is not a regular file")
	}
	h := sha256.New()
	if _, err = io.Copy(h, f); err != nil {
		return "", err
	}
	if hex.EncodeToString(h.Sum(nil)) != expected {
		return "", errors.New("Sudoku binary checksum mismatch")
	}
	return p, nil
}
func (p SudokuProfile) Validate() error {
	if p.Port < 1024 || p.Port > 65535 {
		return errors.New("Sudoku port must be 1024..65535")
	}
	if p.Host == "" || strings.ContainsAny(p.Host, "/\\ \t\r\n@?#") {
		return errors.New("enter a server IP address or DNS name")
	}
	if p.AEAD != "chacha20-poly1305" && p.AEAD != "aes-128-gcm" {
		return errors.New("unsupported AEAD")
	}
	if p.Table != "prefer_ascii" && p.Table != "prefer_entropy" {
		return errors.New("unsupported table mode")
	}
	if p.PublicKey == "" || len(p.PublicKey) > 4096 {
		return errors.New("invalid public key")
	}
	return nil
}
func (m *Manager) State() Status {
	m.mu.Lock()
	defer m.mu.Unlock()
	s := Status{Enabled: allowed() == nil, Running: m.cmd != nil, Error: m.lastError}
	if allowed() != nil {
		return s
	}
	b, err := os.ReadFile(filepath.Join(directory(), "sudoku-profile.json"))
	if err == nil {
		var p SudokuProfile
		if json.Unmarshal(b, &p) == nil && p.Validate() == nil {
			s.Configured = true
			s.Profile = &p
		}
	}
	return s
}

// limitedBuffer prevents a broken helper from exhausting panel memory.
type limitedBuffer struct{ bytes.Buffer }

func (b *limitedBuffer) Write(p []byte) (int, error) {
	n := len(p)
	if b.Len()+n > 65536 {
		return 0, errors.New("keygen output too large")
	}
	return b.Buffer.Write(p)
}

// Create generates a NEW identity. No existing system configuration is read.
// The private key is returned once; only the public server key is persisted.
func (m *Manager) Create(p SudokuProfile) (string, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.cmd != nil {
		return "", errors.New("stop Sudoku before creating a profile")
	}
	path, err := binary()
	if err != nil {
		return "", err
	}
	if _, err = os.Stat(filepath.Join(directory(), "sudoku-profile.json")); !os.IsNotExist(err) {
		return "", errors.New("a profile already exists; remove it explicitly first")
	}
	p.PublicKey = "pending"
	if err = p.Validate(); err != nil {
		return "", err
	}
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	cmd := exec.CommandContext(ctx, path, "-keygen")
	var out limitedBuffer
	cmd.Stdout = &out
	cmd.Stderr = &out
	if err = cmd.Run(); err != nil {
		return "", fmt.Errorf("Sudoku keygen failed: %w", err)
	}
	fields := map[string]string{}
	for _, line := range strings.Split(out.String(), "\n") {
		for _, label := range []string{"Master Public Key:", "Available Private Key:"} {
			if v, ok := strings.CutPrefix(strings.TrimSpace(line), label); ok {
				fields[label] = strings.TrimSpace(v)
			}
		}
	}
	p.PublicKey = fields["Master Public Key:"]
	secret := fields["Available Private Key:"]
	if err = p.Validate(); err != nil || secret == "" {
		return "", errors.New("incompatible Sudoku Core keygen output")
	}
	if err = os.MkdirAll(directory(), 0700); err != nil {
		return "", err
	}
	b, _ := json.MarshalIndent(p, "", "  ")
	f, err := os.OpenFile(filepath.Join(directory(), "sudoku-profile.json"), os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0600)
	if err != nil {
		return "", err
	}
	_, err = f.Write(b)
	closeErr := f.Close()
	if err != nil {
		return "", err
	}
	if closeErr != nil {
		return "", closeErr
	}
	m.lastError = ""
	return secret, nil
}
func (m *Manager) Start() error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.cmd != nil {
		return errors.New("Sudoku is already running")
	}
	path, err := binary()
	if err != nil {
		return err
	}
	b, err := os.ReadFile(filepath.Join(directory(), "sudoku-profile.json"))
	if err != nil {
		return err
	}
	var p SudokuProfile
	if err = json.Unmarshal(b, &p); err != nil {
		return err
	}
	if err = p.Validate(); err != nil {
		return err
	}
	// Early collision check; the core still owns the authoritative bind result.
	l, err := net.Listen("tcp", net.JoinHostPort("", strconv.Itoa(p.Port)))
	if err != nil {
		return err
	}
	l.Close()
	cfg := map[string]any{"mode": "server", "transport": "tcp", "local_port": p.Port, "key": p.PublicKey, "aead": p.AEAD, "ascii": p.Table, "padding_min": 0, "padding_max": 0, "enable_pure_downlink": false, "multiplex": "off", "suspicious_action": "fallback", "fallback_address": "127.0.0.1:1", "httpmask": map[string]any{"disable": true, "mode": "auto", "tls": false, "host": "", "path_root": ""}, "reverse": map[string]string{"listen": ""}, "custom_tables": []string{}}
	b, _ = json.MarshalIndent(cfg, "", "  ")
	configPath := filepath.Join(directory(), "sudoku-server.json")
	if err = os.WriteFile(configPath, b, 0600); err != nil {
		return err
	}
	cmd := exec.Command(path, "-c", configPath)
	cmd.Dir = directory()
	// No shell, inherited terminal, secrets in logs, or ownership of external services.
	cmd.Stdout = io.Discard
	cmd.Stderr = io.Discard
	if err = cmd.Start(); err != nil {
		return err
	}
	m.cmd = cmd
	m.done = make(chan struct{})
	done := m.done
	m.lastError = ""
	go func() {
		err := cmd.Wait()
		m.mu.Lock()
		if m.cmd == cmd {
			m.cmd = nil
			if err != nil {
				m.lastError = "Sudoku exited unexpectedly; verify compatible Core and profile"
			}
		}
		close(done)
		m.mu.Unlock()
	}()
	return nil
}
func (m *Manager) Stop() error {
	m.mu.Lock()
	cmd, done := m.cmd, m.done
	if cmd == nil {
		m.mu.Unlock()
		return nil
	}
	err := cmd.Process.Kill()
	m.mu.Unlock()
	if err != nil && !errors.Is(err, os.ErrProcessDone) {
		return err
	}
	select {
	case <-done:
	case <-time.After(5 * time.Second):
		return errors.New("Sudoku stop timed out")
	}
	m.mu.Lock()
	m.lastError = ""
	m.mu.Unlock()
	return nil
}
func (m *Manager) Remove() error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if err := allowed(); err != nil {
		return err
	}
	if m.cmd != nil {
		return errors.New("stop Sudoku before removing its profile")
	}
	err := os.Remove(filepath.Join(directory(), "sudoku-profile.json"))
	if errors.Is(err, os.ErrNotExist) {
		return nil
	}
	return err
}
