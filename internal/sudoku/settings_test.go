package sudoku

import (
	"encoding/json"
	"testing"

	"github.com/mhsanaei/3x-ui/v3/internal/database/model"
)

func TestNormalClientCreationPreservesKeysOnLaterEdit(t *testing.T) {
	settings := Settings{Clients: []model.Client{{Email: "phone", Enable: true}, {Email: "laptop", Enable: true}}}
	raw, _ := json.Marshal(settings)
	inbound := &model.Inbound{Protocol: model.Protocol("sudoku"), Settings: string(raw), Port: 18443}
	if err := NormalizeSettings(inbound); err != nil {
		t.Fatal(err)
	}
	first, err := DecodeSettings(inbound.Settings)
	if err != nil {
		t.Fatal(err)
	}
	if first.Clients[0].SudokuKey == first.Clients[1].SudokuKey {
		t.Fatal("devices share one key")
	}
	first.Clients[0].TotalGB = 1024
	raw, _ = json.Marshal(first)
	inbound.Settings = string(raw)
	if err = NormalizeSettings(inbound); err != nil {
		t.Fatal(err)
	}
	next, _ := DecodeSettings(inbound.Settings)
	if next.MasterKey != first.MasterKey || next.Clients[0].SudokuKey != first.Clients[0].SudokuKey || next.Clients[1].SudokuKey != first.Clients[1].SudokuKey {
		t.Fatal("ordinary edit rotated an existing identity")
	}
}

func TestStandardProtocolsAreNotModified(t *testing.T) {
	inbound := &model.Inbound{Protocol: model.VLESS, Settings: `{"clients":[]}`}
	before := inbound.Settings
	if err := NormalizeSettings(inbound); err != nil {
		t.Fatal(err)
	}
	if inbound.Settings != before {
		t.Fatal("standard inbound changed")
	}
}

func TestSharedClientEditPreservesEachInboundsOwnKey(t *testing.T) {
	makeInbound := func() *model.Inbound {
		ib := &model.Inbound{Protocol: model.Sudoku, Settings: `{"clients":[{"email":"shared","enable":true}]}`}
		if err := NormalizeSettings(ib); err != nil {
			t.Fatal(err)
		}
		return ib
	}
	first, second := makeInbound(), makeInbound()
	a, _ := DecodeSettings(first.Settings)
	b, _ := DecodeSettings(second.Settings)
	edited := a.Clients[0]
	edited.Comment = "ordinary shared client edit"
	if err := NormalizeClient(&edited, second); err != nil {
		t.Fatal(err)
	}
	if edited.SudokuKey != b.Clients[0].SudokuKey {
		t.Fatal("shared edit replaced the destination inbound key")
	}
}
