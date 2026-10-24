package service

import (
	"encoding/json"
	"github.com/mhsanaei/3x-ui/v3/internal/database/model"
	"github.com/mhsanaei/3x-ui/v3/internal/sudoku"
	"os"
	"path/filepath"
	"testing"
)

func TestSudokuMigrationPreservesKeysAndDoesNotResurrectDeletedInbounds(t *testing.T) {
	setupBulkDB(t)
	t.Setenv("CONNECT_HUB_SUDOKU", "1")
	dir := t.TempDir()
	t.Setenv("CONNECT_HUB_INTEGRATIONS_DIR", dir)
	ib := &model.Inbound{Protocol: model.Sudoku, Settings: `{"clients":[{"email":"phone","enable":true}]}`}
	if err := sudoku.NormalizeSettings(ib); err != nil {
		t.Fatal(err)
	}
	settings, _ := sudoku.DecodeSettings(ib.Settings)
	id := "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
	device := "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
	hash, _ := sudoku.UserHash(settings.Clients[0].SudokuKey)
	folder := filepath.Join(dir, "sudoku-inbounds", id)
	if err := os.MkdirAll(folder, 0700); err != nil {
		t.Fatal(err)
	}
	write := func(name string, value any) {
		t.Helper()
		raw, err := json.Marshal(value)
		if err != nil {
			t.Fatal(err)
		}
		if err = os.WriteFile(filepath.Join(folder, name), raw, 0600); err != nil {
			t.Fatal(err)
		}
	}
	write("inbound.json", map[string]any{"name": "Previous alpha", "enabled": false})
	write("sudoku-profile.json", map[string]any{"host": "example.test", "port": 19339, "publicKey": settings.PublicKey, "aead": settings.AEAD, "table": settings.Table})
	if err := os.WriteFile(filepath.Join(folder, "master.key"), []byte(settings.MasterKey), 0600); err != nil {
		t.Fatal(err)
	}
	write("devices.json", []map[string]any{{"id": device, "name": "Phone", "status": "enabled", "created": "2026-10-24T00:00:00Z", "userHash": hash, "privateKey": settings.Clients[0].SudokuKey}})
	svc := &InboundService{}
	// Disabling the runtime must not hide or strand keys during a database
	// migration; no core needs to be started to preserve this stopped inbound.
	t.Setenv("CONNECT_HUB_SUDOKU","0")
	if err := svc.MigrateLegacySudoku(); err != nil {
		t.Fatal(err)
	}
	facade := &SudokuCompat{}
	rows, err := facade.List()
	if err != nil || len(rows) != 1 {
		t.Fatalf("migration list: %v %v", rows, err)
	}
	exported, err := facade.Export(id, device)
	if err != nil {
		t.Fatal(err)
	}
	if exported["privateKey"] != settings.Clients[0].SudokuKey {
		t.Fatal("migration changed a device key")
	}
	if err = svc.MigrateLegacySudoku(); err != nil {
		t.Fatal(err)
	}
	rows, err = facade.List()
	if err != nil || len(rows) != 1 {
		t.Fatal("migration duplicated an inbound")
	}
	if err = facade.Remove(id); err != nil {
		t.Fatal(err)
	}
	if err = svc.MigrateLegacySudoku(); err != nil {
		t.Fatal(err)
	}
	rows, err = facade.List()
	if err != nil || len(rows) != 0 {
		t.Fatal("deleted migrated inbound was resurrected")
	}
	if _, err = os.Stat(filepath.Join(folder, "master.key")); err != nil {
		t.Fatal("migration destroyed recovery key files")
	}
}

