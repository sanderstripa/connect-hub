// Connect Hub native Sudoku integration. GPL-3.0.
package service

import (
	"context"
	"github.com/mhsanaei/3x-ui/v3/internal/database"
	"github.com/mhsanaei/3x-ui/v3/internal/database/model"
	"github.com/mhsanaei/3x-ui/v3/internal/logger"
	"github.com/mhsanaei/3x-ui/v3/internal/sudoku"
)

func (s *InboundService) DesiredSudokuInstances() ([]sudoku.Instance, error) {
	db := database.GetDB()
	var inbounds []*model.Inbound
	if err := db.Where("protocol = ? AND enable = ? AND node_id IS NULL", model.Sudoku, true).Find(&inbounds).Error; err != nil {
		return nil, err
	}
	desired := make([]sudoku.Instance, 0, len(inbounds))
	for _, ib := range inbounds {
		built, err := s.buildInboundForLocalRuntime(db, ib)
		if err != nil {
			return nil, err
		}
		if inst, ok := sudoku.InstanceFromInbound(built); ok {
			desired = append(desired, inst)
		}
	}
	return desired, nil
}

func (s *InboundService) applyLocalSudoku(id int) {
	ib, err := s.GetInbound(id)
	if err != nil || ib == nil || ib.Protocol != model.Sudoku || ib.NodeID != nil {
		return
	}
	payload := ib
	if ib.Enable {
		payload, err = s.buildInboundForLocalRuntime(database.GetDB(), ib)
		if err != nil {
			logger.Warning("Sudoku: apply clients:", err)
			return
		}
	}
	rt, err := s.runtimeFor(ib)
	if err == nil {
		err = rt.UpdateInbound(context.Background(), ib, payload)
	}
	if err != nil {
		logger.Warning("Sudoku: apply inbound:", err)
	}
}
