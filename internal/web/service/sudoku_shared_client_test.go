package service

import (
	"github.com/mhsanaei/3x-ui/v3/internal/database/model"
	"github.com/mhsanaei/3x-ui/v3/internal/sudoku"
	"testing"
)

func TestSudokuDoesNotOverwriteSharedMtprotoSecret(t *testing.T) {
	setupBulkDB(t)
	svc := &InboundService{}
	telegram := mkInbound(t, 19341, model.MTProto, `{"fakeTlsDomain":"example.com","clients":[]}`)
	ib := &model.Inbound{UserId: 1, Enable: false, Protocol: model.Sudoku, Port: 19342, Settings: `{"clients":[]}`}
	if _, _, err := svc.AddInbound(ib); err != nil {
		t.Fatal(err)
	}
	secret := model.GenerateFakeTLSSecret("example.com")
	payload := &ClientCreatePayload{Client: model.Client{Email: "shared-protocols", Secret: secret, Enable: true}, InboundIds: []int{telegram.Id, ib.Id}}
	clients := &ClientService{}
	if _, err := clients.Create(svc, payload); err != nil {
		t.Fatal(err)
	}
	tg, err := svc.GetInbound(telegram.Id)
	if err != nil {
		t.Fatal(err)
	}
	tgClients, err := svc.GetClients(tg)
	if err != nil {
		t.Fatal(err)
	}
	native, err := svc.GetInbound(ib.Id)
	if err != nil {
		t.Fatal(err)
	}
	settings, err := sudoku.DecodeSettings(native.Settings)
	if err != nil {
		t.Fatal(err)
	}
	if len(tgClients) != 1 || tgClients[0].Secret != secret || len(settings.Clients) != 1 || len(settings.Clients[0].SudokuKey) != 128 {
		t.Fatal("protocol-specific credentials were overwritten")
	}
	record, err := clients.GetRecordByEmail(nil, payload.Client.Email)
	if err != nil {
		t.Fatal(err)
	}
	if record.Secret != secret || record.SudokuKey == "" {
		t.Fatal("shared record lost a protocol credential")
	}
	updated := *record.ToClient()
	updated.Comment = "ordinary edit"
	if _, err = clients.Update(svc, record.Id, updated, 0); err != nil {
		t.Fatal(err)
	}
	native, _ = svc.GetInbound(ib.Id)
	after, _ := sudoku.DecodeSettings(native.Settings)
	if after.Clients[0].SudokuKey != settings.Clients[0].SudokuKey {
		t.Fatal("shared edit rotated a device key")
	}
	tg, _ = svc.GetInbound(telegram.Id)
	tgClients, _ = svc.GetClients(tg)
	if tgClients[0].Secret != secret {
		t.Fatal("shared edit changed MTProto")
	}
}
