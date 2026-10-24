// Compatibility for earlier Connect Hub alpha URLs. All writes use the
// ordinary inbound/client services and database; no second registry is created.
package service

import (
	"encoding/json"
	"errors"
	"strconv"
	"strings"
	"time"
	"gorm.io/gorm"

	"github.com/google/uuid"
	"github.com/mhsanaei/3x-ui/v3/internal/database"
	"github.com/mhsanaei/3x-ui/v3/internal/database/model"
	"github.com/mhsanaei/3x-ui/v3/internal/hub"
	"github.com/mhsanaei/3x-ui/v3/internal/sudoku"
)

type SudokuCompat struct{}

func compatID(ib *model.Inbound, s sudoku.Settings) string {
	if s.LegacyID != "" {
		return s.LegacyID
	}
	return strconv.Itoa(ib.Id)
}
func (*SudokuCompat) get(id string) (*model.Inbound, sudoku.Settings, error) {
	var rows []*model.Inbound
	if err := database.GetDB().Where("protocol = ?", model.Sudoku).Find(&rows).Error; err != nil {
		return nil, sudoku.Settings{}, err
	}
	for _, ib := range rows {
		s, err := sudoku.DecodeSettings(ib.Settings)
		if err != nil {
			return nil, s, err
		}
		if compatID(ib, s) == id {
			return ib, s, nil
		}
	}
	return nil, sudoku.Settings{}, errors.New("inbound not found")
}
func (c *SudokuCompat) List() ([]hub.SudokuInbound, error) {
	var rows []*model.Inbound
	out := []hub.SudokuInbound{}
	if err := database.GetDB().Where("protocol = ?", model.Sudoku).Order("id").Find(&rows).Error; err != nil {
		return nil, err
	}
	for _, ib := range rows {
		s, err := sudoku.DecodeSettings(ib.Settings)
		if err != nil {
			return nil, err
		}
		devices := []hub.SudokuDevice{}
		for _, client := range s.Clients {
			devices = append(devices, compatDevice(s, client))
		}
		profile := &hub.SudokuProfile{Host: ib.ShareAddr, Port: ib.Port, PublicKey: s.PublicKey, AEAD: s.AEAD, Table: s.Table}
		out = append(out, hub.SudokuInbound{ID: compatID(ib, s), Name: ib.Remark, Enabled: ib.Enable, Devices: devices, Status: hub.Status{Enabled: true, Configured: true, Running: sudoku.GetManager().Running(ib.Id), Profile: profile}})
	}
	return out, nil
}
func compatDevice(s sudoku.Settings, client model.Client) hub.SudokuDevice {
	h, _ := sudoku.UserHash(client.SudokuKey)
	status := "disabled"
	if client.Enable {
		status = "enabled"
	}
	for _, r := range s.RevokedKeyHashes {
		if r == h {
			status = "revoked"
		}
	}
	name := client.Comment
	if name == "" {
		name = client.Email
	}
	if n := s.LegacyDevices[client.ID]; n != "" {
		name = n
	}
	return hub.SudokuDevice{ID: client.ID, Name: name, Status: status, Created: time.UnixMilli(client.CreatedAt).UTC().Format(time.RFC3339), Hash: h}
}
func (c *SudokuCompat) Create(name string, p hub.SudokuProfile) (string, error) {
	var owner model.User
	if err := database.GetDB().Order("id").First(&owner).Error; err != nil {
		return "", err
	}
	id := strings.ReplaceAll(uuid.NewString(), "-", "")
	settings := sudoku.Settings{AEAD: p.AEAD, Table: p.Table, LegacyID: id}
	raw, _ := json.Marshal(settings)
	ib := &model.Inbound{UserId: owner.Id, Enable: false, Remark: name, Protocol: model.Sudoku, Port: p.Port, Settings: string(raw), StreamSettings: "{}", Sniffing: "{}", ShareAddrStrategy: "custom", ShareAddr: p.Host, TrafficReset: "never", TrafficResetDay: 1, SubSortIndex: 1}
	_, _, err := (&InboundService{}).AddInbound(ib)
	return id, err
}
func (c *SudokuCompat) SetRunning(id string, on bool) error {
	ib, _, err := c.get(id)
	if err != nil {
		return err
	}
	_, err = (&InboundService{}).SetInboundEnable(ib.Id,on)
	return err
}
func (c *SudokuCompat) AddDevice(id, name string) (hub.SudokuDevice, error) {
	ib, s, err := c.get(id)
	if err != nil {
		return hub.SudokuDevice{}, err
	}
	if strings.TrimSpace(name) == "" {
		return hub.SudokuDevice{}, errors.New("enter a device name")
	}
	for _, client := range s.Clients {
		if compatDevice(s, client).Name == name {
			return hub.SudokuDevice{}, errors.New("device name already exists")
		}
	}
	keyID := strings.ReplaceAll(uuid.NewString(), "-", "")
	email := "sudoku-" + id + "-" + keyID
	_, err = (&ClientService{}).CreateOne(&InboundService{}, ib.Id, model.Client{ID: keyID, Email: email, Comment: name, Enable: true})
	if err != nil {
		return hub.SudokuDevice{}, err
	}
	_, s, err = c.get(id)
	if err != nil {
		return hub.SudokuDevice{}, err
	}
	for _, client := range s.Clients {
		if client.Email == email {
			return compatDevice(s, client), nil
		}
	}
	return hub.SudokuDevice{}, errors.New("new client was not saved")
}
func (c *SudokuCompat) Export(id, device string) (map[string]any, error) {
	ib, s, err := c.get(id)
	if err != nil {
		return nil, err
	}
	for _, client := range s.Clients {
		if client.ID == device {
			if compatDevice(s, client).Status != "enabled" {
				return nil, errors.New("device is disabled or revoked")
			}
			return sudoku.ExportClient(ib.ShareAddr, ib.Port, s, client.SudokuKey), nil
		}
	}
	return nil, errors.New("device not found")
}
func (c *SudokuCompat) SetDevice(id, device, status string) error {
	if status != "enabled" && status != "disabled" && status != "revoked" {
		return errors.New("invalid device status")
	}
	ib, s, err := c.get(id)
	if err != nil {
		return err
	}
	for i := range s.Clients {
		client := &s.Clients[i]
		if client.ID != device {
			continue
		}
		if compatDevice(s, *client).Status == "revoked" {
			return errors.New("revocation is permanent")
		}
		client.Enable = status == "enabled"
		if _,err=(&ClientService{}).UpdateByEmail(&InboundService{},client.Email,*client,0,ib.Id);err!=nil{return err}
		if status == "revoked" {
			h, _ := sudoku.UserHash(client.SudokuKey)
			err=runSerializedTx(func(tx *gorm.DB)error{
				var current model.Inbound;if e:=tx.First(&current,ib.Id).Error;e!=nil{return e}
				latest,e:=sudoku.DecodeSettings(current.Settings);if e!=nil{return e}
				latest.RevokedKeyHashes=append(latest.RevokedKeyHashes,h)
				for i:=range latest.Clients{if latest.Clients[i].ID==device{latest.Clients[i].Enable=false}}
				raw,e:=json.Marshal(latest);if e!=nil{return e};before:=current.Settings;current.Settings=string(raw)
				return commitInboundClientSettings(tx,&current,before)
			})
			if err!=nil{return err}
			(&InboundService{}).applyLocalSudoku(ib.Id)
		}
		return nil
	}
	return errors.New("device not found")
}
func (c *SudokuCompat) Remove(id string) error {
	ib, _, err := c.get(id)
	if err != nil {
		return err
	}
	if ib.Enable {
		return errors.New("stop inbound before deleting")
	}
	_, err = (&InboundService{}).DelInbound(ib.Id)
	return err
}
