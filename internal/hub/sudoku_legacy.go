// Connect Hub migration reader for this fork's earlier private registry only.
package hub

import (
	"fmt"
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
	root := directory()
	if root == "" {
		return nil, nil
	}
	if !filepath.IsAbs(root) {
		return nil, fmt.Errorf("legacy Sudoku directory must be absolute")
	}
	items, err := os.ReadDir(filepath.Join(root, "sudoku-inbounds"))
	if os.IsNotExist(err) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	out := []LegacySudoku{}
	for _, item := range items {
		id := item.Name()
		if !validID(id) {
			continue
		}
		dir, err := legacyDirectory(id)
		if err != nil {
			return nil, err
		}
		m := &Manager{dir: dir}
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
		var meta inboundRecord
		if err = readJSON(filepath.Join(dir, "inbound.json"), &meta); err != nil {
			return nil, err
		}
		var profile SudokuProfile
		if err = readJSON(filepath.Join(dir, "sudoku-profile.json"), &profile); err != nil {
			return nil, err
		}
		if err = profile.Validate(); err != nil {
			return nil, err
		}
		record := LegacySudoku{ID: id, Name: meta.Name, Enabled: meta.Enabled, MasterKey: string(master), Profile: profile}
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
	if _, err := legacyDirectory(id); err != nil {
		return err
	}
	if m := r.managers[id]; m != nil {
		return m.Stop()
	}
	return nil
}

func (r *SudokuRegistry) MarkMigrated(id string) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	dir, err := legacyDirectory(id)
	if err != nil {
		return err
	}
	return saveJSON(filepath.Join(dir, "migrated-to-database.json"), map[string]bool{"migrated": true})
}

func legacyDirectory(id string) (string, error) {
	if !validID(id) || !filepath.IsAbs(directory()) {
		return "", fmt.Errorf("invalid legacy Sudoku directory")
	}
	dir := filepath.Join(directory(), "sudoku-inbounds", id)
	info, err := os.Lstat(dir)
	if err != nil {
		return "", err
	}
	if !info.IsDir() || info.Mode()&os.ModeSymlink != 0 {
		return "", fmt.Errorf("invalid legacy Sudoku directory")
	}
	return dir, nil
}

