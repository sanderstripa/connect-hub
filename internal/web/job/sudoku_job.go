// Connect Hub Sudoku reconcile and ordinary traffic accounting. GPL-3.0.
package job

import (
	"github.com/mhsanaei/3x-ui/v3/internal/logger"
	"github.com/mhsanaei/3x-ui/v3/internal/sudoku"
	"github.com/mhsanaei/3x-ui/v3/internal/web/service"
	"github.com/mhsanaei/3x-ui/v3/internal/xray"
)

type SudokuJob struct{ inboundService service.InboundService }

func NewSudokuJob() *SudokuJob { return new(SudokuJob) }
func (j *SudokuJob) Run() {
	desired, err := j.inboundService.DesiredSudokuInstances()
	if err != nil {
		logger.Warning("Sudoku: desired inbounds:", err)
		return
	}
	manager := sudoku.GetManager()
	if err = manager.Reconcile(desired); err != nil {
		logger.Warning("Sudoku: reconcile:", err)
	}
	deltas, online := manager.CollectTraffic()
	clients := []*xray.ClientTraffic{}
	byTag := map[string]*xray.Traffic{}
	for _, d := range deltas {
		clients = append(clients, &xray.ClientTraffic{Email: d.Email, Up: d.Up, Down: d.Down})
		if byTag[d.Tag] == nil {
			byTag[d.Tag] = &xray.Traffic{IsInbound: true, Tag: d.Tag}
		}
		byTag[d.Tag].Up += d.Up
		byTag[d.Tag].Down += d.Down
	}
	traffic := []*xray.Traffic{}
	for _, t := range byTag {
		traffic = append(traffic, t)
	}
	if len(traffic) > 0 || len(clients) > 0 {
		if _, _, err = j.inboundService.AddTraffic(traffic, clients); err != nil {
			logger.Warning("Sudoku: traffic:", err)
		}
	}
	tags := []string{}
	for _, inst := range desired {
		tags = append(tags, inst.Tag)
	}
	j.inboundService.RefreshLocalOnlineClients(online, tags)
}
