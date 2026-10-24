package sub

import (
	"encoding/base64"
	"encoding/json"
	"github.com/mhsanaei/3x-ui/v3/internal/database"
	"github.com/mhsanaei/3x-ui/v3/internal/database/model"
	"github.com/mhsanaei/3x-ui/v3/internal/sudoku"
	"strings"
	"testing"
)

func TestSudokuSubscriptionUsesTheDestinationInboundKey(t *testing.T) {
	initSubDB(t)
	db := database.GetDB()
	ib := &model.Inbound{Protocol: model.Sudoku, Port: 19333, Enable: true, Listen: "203.0.113.7", Tag: "sudoku-sub", Settings: `{"clients":[{"email":"phone","enable":true,"subId":"sudoku-sub-id"}]}`}
	if err := sudoku.NormalizeSettings(ib); err != nil {
		t.Fatal(err)
	}
	settings, _ := sudoku.DecodeSettings(ib.Settings)
	if err := db.Create(ib).Error; err != nil {
		t.Fatal(err)
	}
	// A shared client record may contain a different inbound's secret. The
	// subscription must use this inbound's own credential instead.
	rec := &model.ClientRecord{Email: "phone", SubID: "sudoku-sub-id", Enable: true, SudokuKey: "another-inbound-key"}
	if err := db.Create(rec).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&model.ClientInbound{ClientId: rec.Id, InboundId: ib.Id}).Error; err != nil {
		t.Fatal(err)
	}
	service := &SubService{}
	rows, err := service.getInboundsBySubId(rec.SubID)
	if err != nil || len(rows) != 1 {
		t.Fatalf("subscription allowlist: %v %v", rows, err)
	}
	link := service.GetLink(ib, "phone")
	if !strings.HasPrefix(link, "sudoku://") {
		t.Fatal("missing protocol link")
	}
	raw, err := base64.RawURLEncoding.DecodeString(strings.TrimPrefix(link, "sudoku://"))
	if err != nil {
		t.Fatal(err)
	}
	var compact map[string]any
	if err = json.Unmarshal(raw, &compact); err != nil {
		t.Fatal(err)
	}
	if compact["k"] != settings.Clients[0].SudokuKey || compact["h"] != "203.0.113.7" || compact["p"] != float64(ib.Port) {
		t.Fatal("wrong destination or key in subscription")
	}
}
