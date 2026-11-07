package service

import (
	"encoding/json"
	"errors"
	"sort"
	"strings"

	"github.com/mhsanaei/3x-ui/v3/internal/database"
	"github.com/mhsanaei/3x-ui/v3/internal/database/model"
	"github.com/mhsanaei/3x-ui/v3/internal/util/common"

	"gorm.io/gorm"
)

type GroupSummary struct {
	Id           int      `json:"id"`
	Name         string   `json:"name"`
	ClientCount  int      `json:"clientCount"`
	HostGroupIds []string `json:"hostGroupIds"`
	TrafficUsed  int64    `json:"trafficUsed"`
	Up           int64    `json:"up"`
	Down         int64    `json:"down"`
}

func (s *ClientService) ListGroups() ([]GroupSummary, error) {
	db := database.GetDB()
	// email is unique in both clients and client_traffics, so the LEFT JOIN
	// never double-counts a client's traffic.
	var derived []GroupSummary
	if err := db.Table("clients AS c").
		Select("c.group_name AS name, COUNT(*) AS client_count, COALESCE(SUM(ct.up + ct.down), 0) AS traffic_used, COALESCE(SUM(ct.up), 0) AS up, COALESCE(SUM(ct.down), 0) AS down").
		Joins("LEFT JOIN client_traffics ct ON ct.email = c.email").
		Where("c.group_name <> ''").
		Group("c.group_name").
		Scan(&derived).Error; err != nil {
		return nil, err
	}
	var stored []model.ClientGroup
	if err := db.Find(&stored).Error; err != nil {
		return nil, err
	}
	var bindings []model.HostGroupClientGroup
	if err := db.Order("host_group_id ASC").Find(&bindings).Error; err != nil {
		return nil, err
	}
	hostGroups := make(map[int][]string, len(bindings))
	for _, binding := range bindings {
		hostGroups[binding.ClientGroupId] = append(hostGroups[binding.ClientGroupId], binding.HostGroupId)
	}
	type groupAgg struct {
		count int
		up    int64
		down  int64
	}
	baseUp := make(map[string]int64, len(stored))
	baseDown := make(map[string]int64, len(stored))
	merged := make(map[string]groupAgg, len(derived)+len(stored))
	for _, g := range stored {
		merged[g.Name] = groupAgg{}
		baseUp[g.Name] = g.ResetUp
		baseDown[g.Name] = g.ResetDown
	}
	for _, g := range derived {
		merged[g.Name] = groupAgg{count: g.ClientCount, up: g.Up, down: g.Down}
	}
	out := make([]GroupSummary, 0, len(merged))
	for name, agg := range merged {
		up := max(agg.up-baseUp[name], 0)
		down := max(agg.down-baseDown[name], 0)
		out = append(out, GroupSummary{Name: name, ClientCount: agg.count, TrafficUsed: up + down, Up: up, Down: down})
	}
	sort.Slice(out, func(i, j int) bool {
		return strings.ToLower(out[i].Name) < strings.ToLower(out[j].Name)
	})
	return out, nil
}

// adjustGroupBaselinesForRemovedTraffic shifts group baselines down by the clients'
// current counters so ListGroups totals survive a traffic reset or client delete (#5675).
func adjustGroupBaselinesForRemovedTraffic(tx *gorm.DB, emails []string) error {
	return shiftGroupBaselines(tx, emails, -1)
}

// adjustGroupBaselinesForRestoredTraffic shifts group baselines up by counters an
// import restored, so usage from before the import never enters a group total.
func adjustGroupBaselinesForRestoredTraffic(tx *gorm.DB, emails []string) error {
	return shiftGroupBaselines(tx, emails, 1)
}

func shiftGroupBaselines(tx *gorm.DB, emails []string, sign int64) error {
	if len(emails) == 0 {
		return nil
	}
	type groupDelta struct {
		Name string
		Up   int64
		Down int64
	}
	totals := make(map[string]*groupDelta)
	for _, batch := range chunkStrings(emails, sqlInChunk) {
		var part []groupDelta
		if err := tx.Table("clients AS c").
			Select("c.group_name AS name, COALESCE(SUM(ct.up), 0) AS up, COALESCE(SUM(ct.down), 0) AS down").
			Joins("JOIN client_traffics ct ON ct.email = c.email").
			Where("c.group_name <> '' AND c.email IN ?", batch).
			Group("c.group_name").
			Scan(&part).Error; err != nil {
			return err
		}
		for i := range part {
			if agg, ok := totals[part[i].Name]; ok {
				agg.Up += part[i].Up
				agg.Down += part[i].Down
			} else {
				totals[part[i].Name] = &part[i]
			}
		}
	}
	for name, d := range totals {
		if d.Up == 0 && d.Down == 0 {
			continue
		}
		res := tx.Model(&model.ClientGroup{}).Where("name = ?", name).Updates(map[string]any{
			"reset_up":   gorm.Expr("reset_up + ?", sign*d.Up),
			"reset_down": gorm.Expr("reset_down + ?", sign*d.Down),
		})
		if res.Error != nil {
			return res.Error
		}
		if res.RowsAffected == 0 {
			if err := tx.Create(&model.ClientGroup{Name: name, ResetUp: sign * d.Up, ResetDown: sign * d.Down}).Error; err != nil {
				return err
			}
		}
	}
	return nil
}

func (s *ClientService) EmailsByGroup(name string) ([]string, error) {
	name = strings.TrimSpace(name)
	if name == "" {
		return []string{}, nil
	}
	db := database.GetDB()
	var emails []string
	if err := db.Model(&model.ClientRecord{}).
		Where("group_name = ?", name).
		Order("email ASC").
		Pluck("email", &emails).Error; err != nil {
		return nil, err
	}
	if emails == nil {
		emails = []string{}
	}
	return emails, nil
}

func (s *ClientService) ResetGroupTraffic(name string) error {
	name = strings.TrimSpace(name)
	if name == "" {
		return common.NewError("group name is required")
	}
	db := database.GetDB()
	var agg struct {
		Up   int64
		Down int64
	}
	if err := db.Table("clients AS c").
		Select("COALESCE(SUM(ct.up), 0) AS up, COALESCE(SUM(ct.down), 0) AS down").
		Joins("LEFT JOIN client_traffics ct ON ct.email = c.email").
		Where("c.group_name = ?", name).
		Scan(&agg).Error; err != nil {
		return err
	}
	var count int64
	if err := db.Model(&model.ClientGroup{}).Where("name = ?", name).Count(&count).Error; err != nil {
		return err
	}
	if count == 0 {
		return db.Create(&model.ClientGroup{Name: name, ResetUp: agg.Up, ResetDown: agg.Down}).Error
	}
	return db.Model(&model.ClientGroup{}).Where("name = ?", name).
		Updates(map[string]any{"reset_up": agg.Up, "reset_down": agg.Down}).Error
}

func (s *ClientService) CreateGroup(name string) error {
	name = strings.TrimSpace(name)
	if name == "" {
		return common.NewError("group name is required")
	}
	db := database.GetDB()
	var count int64
	if err := db.Model(&model.ClientGroup{}).Where("LOWER(name) = LOWER(?)", name).Count(&count).Error; err != nil {
		return err
	}
	if count > 0 {
		return common.NewError("group already exists")
	}
	return db.Create(&model.ClientGroup{Name: name}).Error
}

func (s *ClientService) RenameGroup(oldName, newName string) (int, error) {
	oldName = strings.TrimSpace(oldName)
	newName = strings.TrimSpace(newName)
	if oldName == "" {
		return 0, common.NewError("old group name is required")
	}
	if newName == "" {
		return 0, common.NewError("new group name is required")
	}
	if oldName == newName {
		return 0, nil
	}
	return s.replaceGroupValue(oldName, newName, nil)
}

// UpdateGroup renames a group and replaces its host rules in one transaction.
// Keeping the name unchanged updates only the host rules.
func (s *ClientService) UpdateGroup(oldName, newName string, hostGroupIDs []string) (int, error) {
	oldName = strings.TrimSpace(oldName)
	newName = strings.TrimSpace(newName)
	if oldName == "" {
		return 0, common.NewError("old group name is required")
	}
	if newName == "" {
		return 0, common.NewError("new group name is required")
	}
	if oldName == newName {
		var count int64
		if err := database.GetDB().Model(&model.ClientRecord{}).
			Where("group_name = ?", oldName).Count(&count).Error; err != nil {
			return 0, err
		}
		if _, err := s.SetGroupHostGroups(oldName, hostGroupIDs); err != nil {
			return 0, err
		}
		return int(count), nil
	}
	return s.replaceGroupValue(oldName, newName, &hostGroupIDs)
}

func (s *ClientService) DeleteGroup(name string) (int, error) {
	name = strings.TrimSpace(name)
	if name == "" {
		return 0, common.NewError("group name is required")
	}
	return s.replaceGroupValue(name, "", nil)
}

// SetGroupHostGroups replaces the host rules attached to one client group.
func (s *ClientService) SetGroupHostGroups(name string, hostGroupIDs []string) ([]string, error) {
	name = strings.TrimSpace(name)
	if name == "" {
		return nil, common.NewError("group name is required")
	}
	hostGroupIDs = normalizeHostGroupIDs(hostGroupIDs)
	db := database.GetDB()
	err := db.Transaction(func(tx *gorm.DB) error {
		if err := validateHostGroupIDs(tx, hostGroupIDs); err != nil {
			return err
		}
		group, err := database.EnsureClientGroup(tx, name)
		if err != nil {
			return err
		}
		return replaceGroupHostGroups(tx, group.Id, hostGroupIDs)
	})
	if err != nil {
		return nil, err
	}
	return hostGroupIDs, nil
}

func validateHostGroupIDs(db *gorm.DB, ids []string) error {
	if len(ids) == 0 {
		return nil
	}
	var found int64
	if err := db.Model(&model.Host{}).
		Where("group_id IN ?", ids).
		Distinct("group_id").Count(&found).Error; err != nil {
		return err
	}
	if int(found) != len(ids) {
		return common.NewError("host group not found")
	}
	return nil
}

func replaceGroupHostGroups(tx *gorm.DB, clientGroupID int, hostGroupIDs []string) error {
	if err := tx.Where("client_group_id = ?", clientGroupID).
		Delete(&model.HostGroupClientGroup{}).Error; err != nil {
		return err
	}
	if len(hostGroupIDs) == 0 {
		return nil
	}
	rows := make([]model.HostGroupClientGroup, 0, len(hostGroupIDs))
	for _, hostGroupID := range hostGroupIDs {
		rows = append(rows, model.HostGroupClientGroup{
			HostGroupId: hostGroupID, ClientGroupId: clientGroupID,
		})
	}
	return tx.Create(&rows).Error
}

func normalizeHostGroupIDs(ids []string) []string {
	out := make([]string, 0, len(ids))
	seen := make(map[string]struct{}, len(ids))
	for _, id := range ids {
		id = strings.TrimSpace(id)
		if id == "" {
			continue
		}
		if _, dup := seen[id]; dup {
			continue
		}
		seen[id] = struct{}{}
		out = append(out, id)
	}
	return out
}

func (s *ClientService) RemoveFromGroup(emails []string) (int, error) {
	return s.AddToGroup(emails, "")
}

func (s *ClientService) AddToGroup(emails []string, group string) (int, error) {
	group = strings.TrimSpace(group)
	if len(emails) == 0 {
		return 0, nil
	}
	db := database.GetDB()

	if group != "" {
		record, err := database.EnsureClientGroup(db, group)
		if err != nil {
			return 0, err
		}
		group = record.Name
	}

	var records []model.ClientRecord
	for _, batch := range chunkStrings(emails, sqlInChunk) {
		var rows []model.ClientRecord
		if err := db.Where("email IN ?", batch).
			Where("group_name IS NULL OR group_name <> ?", group).
			Find(&rows).Error; err != nil {
			return 0, err
		}
		records = append(records, rows...)
	}
	if len(records) == 0 {
		return 0, nil
	}
	affectedEmails := make([]string, 0, len(records))
	for _, r := range records {
		affectedEmails = append(affectedEmails, r.Email)
	}

	tx := db.Begin()
	var affected int64
	for _, batch := range chunkStrings(affectedEmails, sqlInChunk) {
		result := tx.Model(&model.ClientRecord{}).
			Where("email IN ?", batch).
			Where("group_name IS NULL OR group_name <> ?", group).
			UpdateColumn("group_name", group)
		if result.Error != nil {
			tx.Rollback()
			return 0, result.Error
		}
		affected += result.RowsAffected
	}

	var inboundIDs []int
	inboundIDSeen := make(map[int]struct{})
	for _, batch := range chunkStrings(affectedEmails, sqlInChunk) {
		var ids []int
		if err := tx.Table("client_inbounds").
			Joins("JOIN clients ON clients.id = client_inbounds.client_id").
			Where("clients.email IN ?", batch).
			Distinct("client_inbounds.inbound_id").
			Pluck("inbound_id", &ids).Error; err != nil {
			tx.Rollback()
			return 0, err
		}
		for _, id := range ids {
			if _, ok := inboundIDSeen[id]; !ok {
				inboundIDSeen[id] = struct{}{}
				inboundIDs = append(inboundIDs, id)
			}
		}
	}

	emailSet := make(map[string]struct{}, len(affectedEmails))
	for _, e := range affectedEmails {
		emailSet[e] = struct{}{}
	}

	for _, ibID := range inboundIDs {
		var ib model.Inbound
		if err := tx.First(&ib, ibID).Error; err != nil {
			tx.Rollback()
			return 0, err
		}
		var settings map[string]any
		if err := json.Unmarshal([]byte(ib.Settings), &settings); err != nil {
			continue
		}
		clients, ok := settings["clients"].([]any)
		if !ok {
			continue
		}
		modified := false
		for i := range clients {
			cm, ok := clients[i].(map[string]any)
			if !ok {
				continue
			}
			email, _ := cm["email"].(string)
			if _, hit := emailSet[email]; !hit {
				continue
			}
			if group == "" {
				delete(cm, "group")
			} else {
				cm["group"] = group
			}
			clients[i] = cm
			modified = true
		}
		if modified {
			settings["clients"] = clients
			newSettings, err := json.Marshal(settings)
			if err != nil {
				continue
			}
			ib.Settings = string(newSettings)
			if err := tx.Save(&ib).Error; err != nil {
				tx.Rollback()
				return 0, err
			}
		}
	}

	if err := tx.Commit().Error; err != nil {
		return 0, err
	}
	return int(affected), nil
}

// replaceGroupValue moves group metadata, host bindings and client membership
// atomically. A failed host-rule validation never half-renames the group.
func (s *ClientService) replaceGroupValue(oldName, newName string, hostGroupIDs *[]string) (int, error) {
	db := database.GetDB()
	affected := 0
	err := db.Transaction(func(tx *gorm.DB) error {
		var selected []string
		if hostGroupIDs != nil {
			selected = normalizeHostGroupIDs(*hostGroupIDs)
			if err := validateHostGroupIDs(tx, selected); err != nil {
				return err
			}
		}
		var group model.ClientGroup
		getErr := tx.Where("name = ?", oldName).First(&group).Error
		if getErr != nil && !errors.Is(getErr, gorm.ErrRecordNotFound) {
			return getErr
		}
		groupID := 0
		if getErr == nil {
			groupID = group.Id
			if newName == "" {
				if err := tx.Where("client_group_id = ?", group.Id).
					Delete(&model.HostGroupClientGroup{}).Error; err != nil {
					return err
				}
				if err := tx.Delete(&group).Error; err != nil {
					return err
				}
				groupID = 0
			} else if err := tx.Model(&group).Update("name", newName).Error; err != nil {
				return err
			}
		} else if newName != "" {
			record, err := database.EnsureClientGroup(tx, newName)
			if err != nil {
				return err
			}
			groupID = record.Id
		}
		if hostGroupIDs != nil && newName != "" {
			if err := replaceGroupHostGroups(tx, groupID, selected); err != nil {
				return err
			}
		}

		var clients []model.ClientRecord
		if err := tx.Where("group_name = ?", oldName).Find(&clients).Error; err != nil {
			return err
		}
		affected = len(clients)
		if len(clients) == 0 {
			return nil
		}
		emails := make([]string, 0, len(clients))
		for _, c := range clients {
			emails = append(emails, c.Email)
		}
		if err := tx.Model(&model.ClientRecord{}).
			Where("group_name = ?", oldName).
			UpdateColumn("group_name", newName).Error; err != nil {
			return err
		}

		var inboundIDs []int
		seen := make(map[int]bool)
		for _, batch := range chunkStrings(emails, sqlInChunk) {
			var ids []int
			if err := tx.Table("client_inbounds").
				Joins("JOIN clients ON clients.id = client_inbounds.client_id").
				Where("clients.email IN ?", batch).
				Distinct("client_inbounds.inbound_id").
				Pluck("inbound_id", &ids).Error; err != nil {
				return err
			}
			for _, id := range ids {
				if !seen[id] {
					seen[id] = true
					inboundIDs = append(inboundIDs, id)
				}
			}
		}
		for _, ibID := range inboundIDs {
			var inbound model.Inbound
			if err := tx.First(&inbound, ibID).Error; err != nil {
				return err
			}
			var settings map[string]any
			if err := json.Unmarshal([]byte(inbound.Settings), &settings); err != nil {
				continue
			}
			list, ok := settings["clients"].([]any)
			if !ok {
				continue
			}
			modified := false
			for ix := range list {
				item, ok := list[ix].(map[string]any)
				if !ok {
					continue
				}
				if groupName, ok := item["group"].(string); ok && groupName == oldName {
					if newName == "" {
						delete(item, "group")
					} else {
						item["group"] = newName
					}
					list[ix] = item
					modified = true
				}
			}
			if modified {
				settings["clients"] = list
				serialized, err := json.Marshal(settings)
				if err != nil {
					return err
				}
				inbound.Settings = string(serialized)
				if err := tx.Save(&inbound).Error; err != nil {
					return err
				}
			}
		}
		return nil
	})
	if err != nil {
		return 0, err
	}
	return affected, nil
}
