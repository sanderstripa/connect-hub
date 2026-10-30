package sub

import (
	"encoding/base64"
	"encoding/json"
	"github.com/mhsanaei/3x-ui/v3/internal/database/model"
	"github.com/mhsanaei/3x-ui/v3/internal/sudoku"
	"strings"
)

func (s *SubService) genSudokuLink(ib *model.Inbound, email string) string {
	if ib.Protocol != model.Sudoku {
		return ""
	}
	settings, err := sudoku.DecodeSettings(ib.Settings)
	if err != nil {
		return ""
	}
	// Sudoku device keys are tied to this inbound's server identity. A global
	// client attached elsewhere must never substitute another server's key.
	var secret, clientID string
	for _, client := range settings.Clients {
		if client.Email == email {
			secret = client.SudokuKey
			clientID = client.ID
			break
		}
	}
	if secret == "" {
		return ""
	}
	links := []string{}
	for _, endpoint := range s.advertisedEndpoints(ib) {
		link := sudoku.ExportClient(endpoint.Address, endpoint.Port, settings, secret)["uri"].(string)
		raw, _ := base64.RawURLEncoding.DecodeString(strings.TrimPrefix(link, "sudoku://"))
		compact := map[string]any{}
		_ = json.Unmarshal(raw, &compact)
		compact["i"] = ib.Id
		compact["c"] = clientID
		raw, _ = json.Marshal(compact)
		links = append(links, "sudoku://"+base64.RawURLEncoding.EncodeToString(raw))
	}
	return strings.Join(links, "\n")
}
