package service

import (
	"encoding/json"
	"github.com/mhsanaei/3x-ui/v3/internal/database"
	"github.com/mhsanaei/3x-ui/v3/internal/database/model"
	"github.com/mhsanaei/3x-ui/v3/internal/sudoku"
	"testing"
)

func TestSudokuOrdinaryInboundAndClientCRUD(t *testing.T) {
	setupBulkDB(t)
	svc := &InboundService{}
	clients := &ClientService{}
	ib := &model.Inbound{UserId: 1, Enable: false, Remark: "Native Sudoku", Protocol: model.Sudoku, Port: 19331, Settings: `{"clients":[]}`, StreamSettings: "{}", Sniffing: "{}"}
	saved, _, err := svc.AddInbound(ib)
	if err != nil {
		t.Fatal(err)
	}
	if saved.Id <= 0 {
		t.Fatal("not a normal database inbound")
	}
	if _, err = clients.CreateOne(svc, saved.Id, model.Client{Email: "phone@native", Enable: true}); err != nil {
		t.Fatal(err)
	}
	reload := func() sudoku.Settings {
		t.Helper()
		row, err := svc.GetInbound(saved.Id)
		if err != nil {
			t.Fatal(err)
		}
		settings, err := sudoku.DecodeSettings(row.Settings)
		if err != nil {
			t.Fatal(err)
		}
		return settings
	}
	before := reload()
	if len(before.Clients) != 1 || len(before.Clients[0].SudokuKey) != 128 {
		t.Fatal("ordinary add did not create a device key")
	}
	var record model.ClientRecord
	if err = database.GetDB().Where("email = ?", "phone@native").First(&record).Error; err != nil {
		t.Fatal(err)
	}
	edited := before.Clients[0]
	edited.Comment = "Edited via standard clients"
	edited.TotalGB = 1024
	edited.Enable = false
	if _, err = clients.Update(svc, record.Id, edited, 0); err != nil {
		t.Fatal(err)
	}
	after := reload()
	if len(after.Clients) != 1 || after.Clients[0].SudokuKey != before.Clients[0].SudokuKey || after.Clients[0].Enable {
		t.Fatal("ordinary edit changed key or ignored status")
	}
	// The complete private identity lives in the ordinary database settings,
	// not in an extra device registry omitted by database backup.
	encoded, err := json.Marshal(after)
	if err != nil {
		t.Fatal(err)
	}
	restored := &model.Inbound{Protocol: model.Sudoku, Settings: string(encoded)}
	if err = sudoku.NormalizeSettings(restored); err != nil {
		t.Fatal(err)
	}
	roundtrip, _ := sudoku.DecodeSettings(restored.Settings)
	if roundtrip.MasterKey != before.MasterKey || roundtrip.Clients[0].SudokuKey != before.Clients[0].SudokuKey {
		t.Fatal("database round trip lost keys")
	}
	if _, err = clients.Delete(svc, record.Id, false); err != nil {
		t.Fatal(err)
	}
	if len(reload().Clients) != 0 {
		t.Fatal("ordinary client delete left access enabled")
	}
}
