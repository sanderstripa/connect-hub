package hub

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"net"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"testing"
	"time"
)

// The test executable acts as a core helper, so ownership, startup failures,
// one-time secrets, persistence and termination are exercised across processes.
func TestMain(m *testing.M) {
	if os.Getenv("HUB_TEST_CORE") == "1" {
		if len(os.Args) > 1 && os.Args[1] == "-keygen" {
			println("Master Public Key: public-test-key")
			println("Available Private Key: client-secret")
			os.Exit(0)
		}
		b, err := os.ReadFile(os.Args[2])
		if err != nil {
			os.Exit(2)
		}
		var cfg struct {
			Port int `json:"local_port"`
		}
		if json.Unmarshal(b, &cfg) != nil {
			os.Exit(3)
		}
		l, err := net.Listen("tcp", "127.0.0.1:"+strconv.Itoa(cfg.Port))
		if err != nil {
			os.Exit(4)
		}
		defer l.Close()
		for {
			c, err := l.Accept()
			if err != nil {
				os.Exit(0)
			}
			c.Write([]byte("owned-core"))
			c.Close()
		}
	}
	os.Exit(m.Run())
}
func setup(t *testing.T) *Manager {
	t.Helper()
	p, err := os.Executable()
	if err != nil {
		t.Fatal(err)
	}
	b, err := os.ReadFile(p)
	if err != nil {
		t.Fatal(err)
	}
	h := sha256.Sum256(b)
	t.Setenv("CONNECT_HUB_SUDOKU", "1")
	t.Setenv("CONNECT_HUB_INTEGRATIONS_DIR", t.TempDir())
	t.Setenv("CONNECT_HUB_SUDOKU_BINARY", p)
	t.Setenv("CONNECT_HUB_SUDOKU_SHA256", hex.EncodeToString(h[:]))
	t.Setenv("HUB_TEST_CORE", "1")
	m := &Manager{}
	t.Cleanup(func() { m.Stop() })
	return m
}
func profile(t *testing.T) SudokuProfile {
	t.Helper()
	l, e := net.Listen("tcp", "127.0.0.1:0")
	if e != nil {
		t.Fatal(e)
	}
	port := l.Addr().(*net.TCPAddr).Port
	l.Close()
	return SudokuProfile{Host: "example.test", Port: port, AEAD: "chacha20-poly1305", Table: "prefer_ascii"}
}
func TestSudokuLifecycleAndSecretIsolation(t *testing.T) {
	m := setup(t)
	p := profile(t)
	secret, e := m.Create(p)
	if e != nil || secret != "client-secret" {
		t.Fatalf("create: %q %v", secret, e)
	}
	b, e := os.ReadFile(filepath.Join(directory(), "sudoku-profile.json"))
	if e != nil || strings.Contains(string(b), secret) {
		t.Fatal("secret leaked to profile", e)
	}
	if _, e = m.Create(p); e == nil {
		t.Fatal("overwrote existing identity")
	}
	if e = m.Start(); e != nil {
		t.Fatal(e)
	}
	deadline := time.Now().Add(5 * time.Second)
	connected := false
	for time.Now().Before(deadline) {
		c, e := net.DialTimeout("tcp", "127.0.0.1:"+strconv.Itoa(p.Port), time.Millisecond*100)
		if e == nil {
			c.Close()
			connected = true
			break
		}
		time.Sleep(time.Millisecond * 20)
	}
	if !connected || !m.State().Running {
		t.Fatal("child did not listen")
	}
	if e = m.Remove(); e == nil {
		t.Fatal("removed a running profile")
	}
	if e = m.Stop(); e != nil || m.State().Running {
		t.Fatal("stop", e)
	}
	if e = m.Remove(); e != nil || m.State().Configured {
		t.Fatal("remove", e)
	}
}
func TestSudokuDisabledAndTamperedBinary(t *testing.T) {
	m := setup(t)
	t.Setenv("CONNECT_HUB_SUDOKU", "")
	if _, e := m.Create(profile(t)); e == nil {
		t.Fatal("disabled integration executed")
	}
	t.Setenv("CONNECT_HUB_SUDOKU", "1")
	t.Setenv("CONNECT_HUB_SUDOKU_SHA256", strings.Repeat("0", 64))
	if _, e := m.Create(profile(t)); e == nil {
		t.Fatal("tampered binary accepted")
	}
}
func TestSudokuPortConflictDoesNotStart(t *testing.T) {
	m := setup(t)
	p := profile(t)
	if _, e := m.Create(p); e != nil {
		t.Fatal(e)
	}
	l, e := net.Listen("tcp", ":"+strconv.Itoa(p.Port))
	if e != nil {
		t.Fatal(e)
	}
	defer l.Close()
	if e = m.Start(); e == nil || m.State().Running {
		t.Fatal("started on occupied port")
	}
}
