package sudoku

import (
	"encoding/json"
	"github.com/mhsanaei/3x-ui/v3/internal/database/model"
	"strings"
	"testing"
)

func TestRuntimeWhitelistContainsOnlyRegisteredClientHashes(t *testing.T) {
	ib := &model.Inbound{Protocol: model.Sudoku, Enable: true, Settings: `{"clients":[{"email":"phone","enable":true},{"email":"off","enable":false}]}`}
	if err := NormalizeSettings(ib); err != nil {
		t.Fatal(err)
	}
	inst, ok := InstanceFromInbound(ib)
	if !ok {
		t.Fatal("invalid instance")
	}
	inst.Listen = "127.0.0.1"
	cfg, err := ServerConfig(inst)
	if err != nil {
		t.Fatal(err)
	}
	raw, _ := json.Marshal(cfg)
	if cfg["listen_address"] != "127.0.0.1" {
		t.Fatal("ignored standard listen field")
	}
	if strings.Contains(string(raw), inst.Settings.MasterKey) {
		t.Fatal("master key leaked into child config")
	}
	users := cfg["users"].([]map[string]any)
	if len(users) != 2 {
		t.Fatal("incomplete whitelist")
	}
	for i, client := range inst.Settings.Clients {
		hash, _ := UserHash(client.SudokuKey)
		if users[i]["key"] != hash {
			t.Fatal("not an exact registered hash")
		}
		if strings.Contains(string(raw), client.SudokuKey) {
			t.Fatal("client private key leaked into server config")
		}
	}
	if users[1]["blocked"] != true {
		t.Fatal("disabled client is allowed")
	}
	inst.Settings.Clients = nil
	cfg, err = ServerConfig(inst)
	if err != nil {
		t.Fatal(err)
	}
	empty := cfg["users"].([]map[string]any)
	if len(empty) != 1 || empty[0]["blocked"] != true {
		t.Fatal("empty inbound accepts unregistered keys")
	}
}
