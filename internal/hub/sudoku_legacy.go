// Connect Hub migration reader for this fork's earlier private registry only.
package hub

import (
	"os"
	"path/filepath"
)

type LegacySudoku struct {
	ID, Name, MasterKey string
	Enabled             bool
	Profile             SudokuProfile
	Devices             []LegacySudokuDevice
}
type LegacySudokuDevice struct{ ID, Name, Status, Created, Hash, PrivateKey string }

// LegacyRecords reads only CONNECT_HUB_INTEGRATIONS_DIR/sudoku-inbounds. It
// never probes, imports or modifies any other panel's installation.
func (r *SudokuRegistry) LegacyRecords() ([]LegacySudoku, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	items, err := r.list()
	if err != nil {
		return nil, err
	}
	out := []LegacySudoku{}
	for _, item := range items {
		m, err := r.get(item.ID)
		if err != nil {
			return nil, err
		}
		if _, err = os.Stat(filepath.Join(m.directory(), "migrated-to-database.json")); err == nil {
			continue
		} else if !os.IsNotExist(err) {
			return nil, err
		}
		master, err := os.ReadFile(filepath.Join(m.directory(), "master.key"))
		if err != nil {
			return nil, err
		}
		devices, err := loadDevices(m)
		if err != nil {
			return nil, err
		}
		if item.Status.Profile == nil {
			continue
		}
		record := LegacySudoku{ID: item.ID, Name: item.Name, Enabled: item.Enabled, MasterKey: string(master), Profile: *item.Status.Profile}
		for _, d := range devices {
			record.Devices = append(record.Devices, LegacySudokuDevice{ID: d.ID, Name: d.Name, Status: d.Status, Created: d.Created, Hash: d.Hash, PrivateKey: d.PrivateKey})
		}
		out = append(out, record)
	}
	return out, nil
}

// StopLegacy does not change saved enable state and leaves the original key
// files intact as a migration recovery copy.
func (r *SudokuRegistry) StopLegacy(id string) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	m, err := r.get(id)
	if err != nil {
		return err
	}
	return m.Stop()
}

func (r *SudokuRegistry) MarkMigrated(id string) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	m, err := r.get(id)
	if err != nil {
		return err
	}
	return saveJSON(filepath.Join(m.directory(), "migrated-to-database.json"), map[string]bool{"migrated": true})
}
