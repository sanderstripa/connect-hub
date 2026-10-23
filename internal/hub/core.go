// Optional read-only CONNECT IP v2 alpha adapter. GPL-3.0, 2026-10-23.
package hub

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"
)

type CoreStatus struct {
	Enabled  bool   `json:"enabled"`
	Stage    string `json:"stage"`
	Reason   string `json:"reason"`
	Status   string `json:"status,omitempty"`
	Version  string `json:"version,omitempty"`
	Sessions int    `json:"sessions,omitempty"`
}

// Explicit allowlist: no client URL inputs, DNS, proxies, redirects, keys,
// enrollment exports or state-changing Core requests cross this boundary.
func ProbeCore() CoreStatus {
	s := CoreStatus{Stage: "alpha / read-only", Reason: "Disabled; opt in with CONNECT_HUB_CORE_ALPHA=1"}
	if os.Getenv("CONNECT_HUB_CORE_ALPHA") != "1" {
		return s
	}
	s.Enabled = true
	fail := func(err error) CoreStatus { s.Reason = err.Error(); return s }
	u, err := url.Parse(os.Getenv("CONNECT_HUB_CORE_URL"))
	if err != nil {
		return fail(errors.New("invalid Core URL"))
	}
	ip := net.ParseIP(u.Hostname())
	if u.Scheme != "http" || ip == nil || !ip.IsLoopback() || u.Port() == "" || u.User != nil || (u.Path != "" && u.Path != "/") || u.RawQuery != "" || u.Fragment != "" {
		return fail(errors.New("Core URL must be an HTTP numeric loopback address with an explicit port"))
	}
	file := os.Getenv("CONNECT_HUB_CORE_TOKEN_FILE")
	if !filepath.IsAbs(file) {
		return fail(errors.New("Core token file must be an absolute path"))
	}
	b, err := os.ReadFile(file)
	if err != nil {
		return fail(errors.New("Core token file is unavailable"))
	}
	token := strings.TrimSpace(string(b))
	if len(token) != 64 || strings.ContainsAny(token, "\r\n") {
		return fail(errors.New("invalid Core API token"))
	}
	req, _ := http.NewRequest(http.MethodGet, strings.TrimRight(u.String(), "/")+"/v1/status", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	client := &http.Client{Timeout: 2 * time.Second, Transport: &http.Transport{Proxy: nil}, CheckRedirect: func(*http.Request, []*http.Request) error { return errors.New("Core redirects are disabled") }}
	resp, err := client.Do(req)
	if err != nil {
		return fail(errors.New("Core status is unavailable"))
	}
	defer resp.Body.Close()
	client.CloseIdleConnections()
	if resp.StatusCode != 200 {
		return fail(fmt.Errorf("Core status returned HTTP %d", resp.StatusCode))
	}
	var raw struct {
		APIVersion int    `json:"api_version"`
		Protocol   int    `json:"protocol_version"`
		Status     string `json:"status"`
		Version    string `json:"core_version"`
		Sessions   int    `json:"active_sessions"`
	}
	if err = json.NewDecoder(io.LimitReader(resp.Body, 1<<20)).Decode(&raw); err != nil {
		return fail(errors.New("invalid Core status response"))
	}
	if raw.Protocol != 2 {
		return fail(errors.New("unsupported CONNECT protocol version"))
	}
	s.Reason = "Read-only status; Connect Hub does not start TUN, modify routes, enroll or export device keys"
	s.Status = raw.Status
	s.Version = raw.Version
	s.Sessions = raw.Sessions
	return s
}
