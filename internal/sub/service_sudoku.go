package sub

import (
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
	var secret string
	for _, client := range settings.Clients {
		if client.Email == email {
			secret = client.SudokuKey
			break
		}
	}
	if secret == "" {
		return ""
	}
	links := []string{}
	for _, endpoint := range s.advertisedEndpoints(ib) {
		links = append(links, sudoku.ExportClient(endpoint.Address, endpoint.Port, settings, secret)["uri"].(string))
	}
	return strings.Join(links, "\n")
}
