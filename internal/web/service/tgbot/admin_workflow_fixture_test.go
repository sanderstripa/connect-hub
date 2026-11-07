package tgbot

import (
    "encoding/json"
    "strings"
    "testing"

    "github.com/mhsanaei/3x-ui/v3/internal/database"
    "github.com/mhsanaei/3x-ui/v3/internal/database/model"
    "github.com/mhsanaei/3x-ui/v3/internal/xray"
)

const (
    adminTgID = int64(31337)
    adminCardEmail = "admin-card@example.com"
)

// seedAdminClient reproduces the panel's three related tables instead of
// bypassing the client-subscription and workflow authorization paths.
func seedAdminClient(t *testing.T, email string) {
    t.Helper()
    client := model.Client{Email: email, Enable: true, SubID: "sub-" + email}
    settings, err := json.Marshal(map[string]any{"clients": []model.Client{client}, "decryption": "none"})
    if err != nil {
        t.Fatal(err)
    }
    inbound := &model.Inbound{
        UserId: 1, Tag: "in-" + email, Remark: "in-" + email, Port: 8443,
        Protocol: model.VLESS, Enable: true, Settings: string(settings),
    }
    if err := database.GetDB().Create(inbound).Error; err != nil {
        t.Fatalf("seed inbound: %v", err)
    }
    if err := database.GetDB().Create(&xray.ClientTraffic{InboundId: inbound.Id, Email: email, Enable: true}).Error; err != nil {
        t.Fatalf("seed traffic: %v", err)
    }
    record := client.ToRecord()
    if err := database.GetDB().Create(record).Error; err != nil {
        t.Fatalf("seed client: %v", err)
    }
    if err := database.GetDB().Create(&model.ClientInbound{ClientId: record.Id, InboundId: inbound.Id}).Error; err != nil {
        t.Fatalf("seed client membership: %v", err)
    }
}

func cardCallback(t *testing.T, sc *screen, action string) string {
    t.Helper()
    for _, row := range sc.rows {
        for _, button := range row {
            if strings.HasPrefix(button.CallbackData, action+" ") {
                return button.CallbackData
            }
        }
    }
    t.Fatalf("client card has no %q action: %+v", action, sc.rows)
    return ""
}
