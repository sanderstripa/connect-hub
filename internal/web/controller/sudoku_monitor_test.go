package controller

import (
	"encoding/json"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/mhsanaei/3x-ui/v3/internal/database/dbtest"
)

func TestSudokuMonitorDisabledAndBuildMetadata(t *testing.T) {
	root := t.TempDir()
	dbtest.InitDB(t, filepath.Join(root, "test.db"))
	t.Setenv("XUI_BIN_FOLDER", filepath.Join(root, "bin"))
	t.Setenv("CONNECT_HUB_SUDOKU", "0")
	if err := os.WriteFile(filepath.Join(root, "BUILD.json"), []byte(`{"dependencies":{"sudoku":{"amd64":{"url":"https://github.com/sanderstripa/sudoku-ui/releases/download/core-v0.7.0/sudoku-core-linux-amd64.tar.gz"}}}}`), 0600); err != nil {
		t.Fatal(err)
	}
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	sudokuMonitor(c)
	var result struct {
		Success bool `json:"success"`
		Obj     struct {
			State      string `json:"state"`
			Version    string `json:"version"`
			Configured bool   `json:"configured"`
		} `json:"obj"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &result); err != nil {
		t.Fatal(err)
	}
	if !result.Success || result.Obj.State != "stop" || result.Obj.Version != "core-v0.7.0" || result.Obj.Configured {
		t.Fatalf("unexpected monitor: %s", w.Body.String())
	}
}
