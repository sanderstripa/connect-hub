package controller

import (
	"encoding/base64"
	"encoding/json"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	yaml "github.com/goccy/go-yaml"
	"github.com/mhsanaei/3x-ui/v3/internal/database"
	"github.com/mhsanaei/3x-ui/v3/internal/database/dbtest"
	"github.com/mhsanaei/3x-ui/v3/internal/database/model"
	"github.com/mhsanaei/3x-ui/v3/internal/sudoku"
)

func TestSudokuProfileImportIsCredentialScopedAndRevocable(t *testing.T) {
	dbtest.InitDB(t, filepath.Join(t.TempDir(), "x-ui.db"))
	ib := model.Inbound{Protocol: model.Sudoku, Port: 18443, Enable: true, Tag: "profile-test", Settings: `{"clients":[{"email":"phone","enable":true}]}`}
	if err := sudoku.NormalizeSettings(&ib); err != nil {
		t.Fatal(err)
	}
	if err := database.GetDB().Create(&ib).Error; err != nil {
		t.Fatal(err)
	}
	s, _ := sudoku.DecodeSettings(ib.Settings)
	p := sudokuProfileRequest{InboundID: ib.Id, ClientID: s.Clients[0].ID, Host: "2001:db8::7", Port: ib.Port, Name: "Alex iPhone"}
	raw, _ := json.Marshal(p)
	payload := base64.RawURLEncoding.EncodeToString(raw)
	signature := sudokuProfileSignature(payload, s.Clients[0].SudokuKey)
	router := gin.New()
	router.GET("/sudoku-import/:payload/:signature", serveSudokuProfile)
	fetch := func(payload, sig string) *httptest.ResponseRecorder {
		w := httptest.NewRecorder()
		router.ServeHTTP(w, httptest.NewRequest("GET", "/sudoku-import/"+payload+"/"+sig, nil))
		return w
	}
	response := fetch(payload, signature+".yaml")
	legacy := fetch(payload, signature)
	if legacy.Code != 200 || legacy.Body.String() != response.Body.String() {
		t.Fatal("existing profile URLs must remain valid")
	}
	if response.Code != 200 || response.Header().Get("Cache-Control") != "no-store" {
		t.Fatalf("status %d", response.Code)
	}
	var profile struct {
		Proxies   []map[string]any `yaml:"proxies"`
		MixedPort int              `yaml:"mixed-port"`
		Mode      string           `yaml:"mode"`
		Groups    []struct {
			Name    string   `yaml:"name"`
			Proxies []string `yaml:"proxies"`
		} `yaml:"proxy-groups"`
		Rules []string `yaml:"rules"`
	}
	if err := yaml.Unmarshal(response.Body.Bytes(), &profile); err != nil {
		t.Fatal(err)
	}
	if profile.MixedPort != 7890 || profile.Mode != "rule" || len(profile.Groups) != 1 || profile.Groups[0].Name != "PROXY" || len(profile.Groups[0].Proxies) != 1 || profile.Groups[0].Proxies[0] != p.Name || len(profile.Rules) != 1 || profile.Rules[0] != "MATCH,PROXY" {
		t.Fatal("YAML subscription is incomplete or its selected node is inconsistent")
	}
	proxy := profile.Proxies[0]
	if proxy["key"] != s.Clients[0].SudokuKey || proxy["server"] != p.Host || proxy["type"] != "sudoku" || proxy["enable-pure-downlink"] != false {
		t.Fatal("profile fields do not match the native server")
	}
	if strings.Contains(response.Body.String(), s.MasterKey) || strings.Contains(payload, s.Clients[0].SudokuKey) {
		t.Fatal("server identity or plaintext device key leaked into URL")
	}
	if fetch(payload, strings.Repeat("x", 43)).Code != 404 {
		t.Fatal("forged token accepted")
	}
	p.Host = "different.example"
	raw, _ = json.Marshal(p)
	if fetch(base64.RawURLEncoding.EncodeToString(raw), signature).Code != 404 {
		t.Fatal("modified endpoint accepted")
	}
	s.Clients[0].Enable = false
	raw, _ = json.Marshal(s)
	database.GetDB().Model(&ib).Update("settings", string(raw))
	if fetch(payload, signature).Code != 404 {
		t.Fatal("disabled key still exports a profile")
	}
	s.Clients[0].Enable = true
	hash, _ := sudoku.UserHash(s.Clients[0].SudokuKey)
	s.RevokedKeyHashes = []string{hash}
	raw, _ = json.Marshal(s)
	database.GetDB().Model(&ib).Update("settings", string(raw))
	if fetch(payload, signature).Code != 404 {
		t.Fatal("revoked key still exports a profile")
	}
}
