package service

import (
	"fmt"
	"testing"

	"github.com/mhsanaei/3x-ui/v3/internal/database/model"
)

type scopedLinkProvider struct{ fakeSubLinkProvider }

func (scopedLinkProvider) LinksForClient(host string, inbound *model.Inbound, email string) []string {
	return []string{fmt.Sprintf("%s/%d/%s", host, inbound.Id, email)}
}

func TestInboundClientLinksRequireMembership(t *testing.T) {
	setupBulkDB(t)
	RegisterSubLinkProvider(scopedLinkProvider{})
	t.Cleanup(func() { RegisterSubLinkProvider(nil) })
	svc := &InboundService{}
	first := mkInbound(t, 19441, model.VLESS, `{"clients":[],"decryption":"none"}`)
	second := mkInbound(t, 19442, model.VLESS, `{"clients":[],"decryption":"none"}`)
	payload := &ClientCreatePayload{Client: model.Client{Email: "scoped-key", Enable: true}, InboundIds: []int{first.Id}}
	if _, err := (&ClientService{}).Create(svc, payload); err != nil {
		t.Fatal(err)
	}
	links, err := svc.GetInboundClientLinks("panel.example", first.Id, payload.Client.Email)
	if err != nil || len(links) != 1 || links[0] != fmt.Sprintf("panel.example/%d/scoped-key", first.Id) {
		t.Fatalf("wrong scoped links: %v, %v", links, err)
	}
	if _, err := svc.GetInboundClientLinks("panel.example", second.Id, payload.Client.Email); err == nil {
		t.Fatal("unattached inbound exported a key")
	}
	if _, err := svc.GetInboundClientLinks("panel.example", first.Id, "missing"); err == nil {
		t.Fatal("missing client exported a key")
	}
}
