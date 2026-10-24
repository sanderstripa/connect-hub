// Connect Hub: preserve our earlier alpha keys in the ordinary panel database.
package service

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/mhsanaei/3x-ui/v3/internal/database"
	"github.com/mhsanaei/3x-ui/v3/internal/database/model"
	"github.com/mhsanaei/3x-ui/v3/internal/hub"
	"github.com/mhsanaei/3x-ui/v3/internal/sudoku"
)

func (s *InboundService) MigrateLegacySudoku() error {
	records, err := hub.SudokuInbounds.LegacyRecords()
	if err != nil {
		return err
	}
	db := database.GetDB()
	var rows []*model.Inbound
	if err = db.Where("protocol = ?", model.Sudoku).Find(&rows).Error; err != nil {
		return err
	}
	migrated := map[string]bool{}
	for _, ib := range rows {
		settings, err := sudoku.DecodeSettings(ib.Settings)
		if err != nil {
			return err
		}
		migrated[settings.LegacyID] = true
	}
	var owner model.User
	if len(records) > 0 {
		if err = db.Order("id").First(&owner).Error; err != nil {
			return err
		}
	}
	for _, record := range records {
		if migrated[record.ID] {
			if err = hub.SudokuInbounds.MarkMigrated(record.ID); err != nil {
				return err
			}
			continue
		}
		settings := sudoku.Settings{MasterKey: record.MasterKey, PublicKey: record.Profile.PublicKey, AEAD: record.Profile.AEAD, Table: record.Profile.Table, LegacyID: record.ID, LegacyDevices: map[string]string{}}
		for _, device := range record.Devices {
			email := fmt.Sprintf("sudoku-%s-%s", record.ID, device.ID)
			created, _ := time.Parse(time.RFC3339, device.Created)
			settings.Clients = append(settings.Clients, model.Client{ID: device.ID, Email: email, SudokuKey: device.PrivateKey, Enable: device.Status == "enabled", Comment: device.Name, CreatedAt: created.UnixMilli()})
			settings.LegacyDevices[device.ID] = device.Name
			if device.Status == "revoked" {
				settings.RevokedKeyHashes = append(settings.RevokedKeyHashes, device.Hash)
			}
		}
		raw, err := json.Marshal(settings)
		if err != nil {
			return err
		}
		ib := &model.Inbound{UserId: owner.Id, Enable: record.Enabled, Remark: record.Name, Protocol: model.Sudoku, Port: record.Profile.Port, Settings: string(raw), StreamSettings: "{}", Sniffing: "{}", ShareAddrStrategy: "custom", ShareAddr: record.Profile.Host, TrafficReset: "never", TrafficResetDay: 1, SubSortIndex: 1}
		if err = hub.SudokuInbounds.StopLegacy(record.ID); err != nil {
			return err
		}
		if _, _, err = s.AddInbound(ib); err != nil {
			return fmt.Errorf("migrate Connect Hub Sudoku %s: %w", record.ID, err)
		}
		if err = hub.SudokuInbounds.MarkMigrated(record.ID); err != nil {
			return err
		}
		migrated[record.ID] = true
	}
	return nil
}
