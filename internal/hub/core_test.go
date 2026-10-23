package hub

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestCoreAlphaOptInAndSanitization(t *testing.T) {
	token := strings.Repeat("a", 64)
	calls := 0
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls++
		if r.URL.Path != "/v1/status" || r.Method != "GET" || r.Header.Get("Authorization") != "Bearer "+token {
			t.Error("unexpected Core request")
		}
		w.Write([]byte(`{"protocol_version":2,"status":"running","core_version":"test","active_sessions":3,"devices":[{"private_key":"never-export"}]}`))
	}))
	defer srv.Close()
	t.Setenv("CONNECT_HUB_CORE_ALPHA", "")
	t.Setenv("CONNECT_HUB_CORE_URL", srv.URL)
	if ProbeCore().Enabled || calls != 0 {
		t.Fatal("disabled adapter contacted Core")
	}
	f := filepath.Join(t.TempDir(), "token")
	os.WriteFile(f, []byte(token), 0600)
	t.Setenv("CONNECT_HUB_CORE_TOKEN_FILE", f)
	t.Setenv("CONNECT_HUB_CORE_ALPHA", "1")
	s := ProbeCore()
	if s.Status != "running" || s.Sessions != 3 || s.Version != "test" || calls != 1 {
		t.Fatalf("status: %+v", s)
	}
	t.Setenv("CONNECT_HUB_CORE_URL", "http://example.com:80")
	if ProbeCore().Status != "" || calls != 1 {
		t.Fatal("non-loopback Core accepted")
	}
}
func TestCoreAlphaRefusesRedirects(t *testing.T) {
	targetCalls := 0
	target := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { targetCalls++ }))
	defer target.Close()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { http.Redirect(w, r, target.URL, 302) }))
	defer srv.Close()
	f := filepath.Join(t.TempDir(), "token")
	os.WriteFile(f, []byte(strings.Repeat("b", 64)), 0600)
	t.Setenv("CONNECT_HUB_CORE_ALPHA", "1")
	t.Setenv("CONNECT_HUB_CORE_URL", srv.URL)
	t.Setenv("CONNECT_HUB_CORE_TOKEN_FILE", f)
	if ProbeCore().Status != "" || targetCalls != 0 {
		t.Fatal("followed redirect with Core credentials")
	}
}
