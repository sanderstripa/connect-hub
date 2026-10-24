// Connect Hub Sudoku protocol settings. GPL-3.0; upstream notices in NOTICE.
package sudoku

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/google/uuid"

	"github.com/mhsanaei/3x-ui/v3/internal/database/model"
	"github.com/mhsanaei/3x-ui/v3/internal/sudokukey"
)

// Settings is stored in the ordinary inbound settings column, so the normal
// database backup/restore includes the server identity and every device key.
type Settings struct {
	MasterKey        string            `json:"masterKey"`
	PublicKey        string            `json:"publicKey"`
	AEAD             string            `json:"aead"`
	Table            string            `json:"table"`
	Clients          []model.Client    `json:"clients"`
	LegacyID         string            `json:"legacyId,omitempty"`
	LegacyDevices    map[string]string `json:"legacyDevices,omitempty"`
	RevokedKeyHashes []string          `json:"revokedKeyHashes,omitempty"`
}

func DecodeSettings(raw string) (Settings, error) {
	var settings Settings
	if strings.TrimSpace(raw) == "" {
		return settings, nil
	}
	if err := json.Unmarshal([]byte(raw), &settings); err != nil {
		return settings, fmt.Errorf("invalid Sudoku settings: %w", err)
	}
	return settings, nil
}

func UserHash(secret string) (string, error) {
	raw, err := hex.DecodeString(strings.TrimSpace(secret))
	if err != nil {
		return "", err
	}
	if len(raw) != 32 && len(raw) != 64 {
		return "", fmt.Errorf("invalid Sudoku key length")
	}
	sum := sha256.Sum256(raw)
	return hex.EncodeToString(sum[:8]), nil
}

// NormalizeSettings uses the original protocol's key algorithm. Re-saving or
// changing quotas does not rotate keys. A copied client from another server is
// given a key for its destination server, like other native protocol normalizers.
func NormalizeSettings(inbound *model.Inbound) error {
	if string(inbound.Protocol) != "sudoku" {
		return nil
	}
	s, err := DecodeSettings(inbound.Settings)
	if err != nil {
		return err
	}
	if s.AEAD == "" {
		s.AEAD = "chacha20-poly1305"
	}
	if s.Table == "" {
		s.Table = "prefer_ascii"
	}
	if s.AEAD != "chacha20-poly1305" && s.AEAD != "aes-128-gcm" && s.AEAD != "none" {
		return fmt.Errorf("unsupported Sudoku encryption")
	}
	if s.Table != "prefer_ascii" && s.Table != "prefer_entropy" && s.Table != "up_ascii_down_entropy" && s.Table != "up_entropy_down_ascii" {
		return fmt.Errorf("unsupported Sudoku table mode")
	}
	if s.MasterKey == "" {
		pair, keyErr := sudokukey.GenerateMasterKey()
		if keyErr != nil {
			return keyErr
		}
		s.MasterKey = sudokukey.EncodeScalar(pair.Private)
		s.PublicKey = sudokukey.EncodePoint(pair.Public)
	}
	master, err := sudokukey.ParsePrivateScalar(s.MasterKey)
	if err != nil {
		return fmt.Errorf("invalid Sudoku server identity: %w", err)
	}
	public, err := sudokukey.RecoverPublicKey(s.MasterKey)
	if err != nil {
		return err
	}
	if s.PublicKey != "" && s.PublicKey != sudokukey.EncodePoint(public) {
		return fmt.Errorf("Sudoku server keys do not match")
	}
	s.PublicKey = sudokukey.EncodePoint(public)
	s.MasterKey = sudokukey.EncodeScalar(master)
	seen := map[string]bool{}
	revoked := map[string]bool{}
	for _, hash := range s.RevokedKeyHashes {
		revoked[hash] = true
	}
	for index := range s.Clients {
		client := &s.Clients[index]
		if client.ID == "" {
			client.ID = uuid.NewString()
		}
		client.SudokuKey = strings.TrimSpace(client.SudokuKey)
		if client.SudokuKey != "" {
			clientPublic, keyErr := sudokukey.RecoverPublicKey(client.SudokuKey)
			if keyErr != nil {
				return fmt.Errorf("invalid Sudoku client key: %w", keyErr)
			}
			if sudokukey.EncodePoint(clientPublic) != s.PublicKey {
				client.SudokuKey = ""
			}
		}
		if client.SudokuKey == "" {
			client.SudokuKey, err = sudokukey.SplitPrivateKey(master)
			if err != nil {
				return err
			}
		}
		hash, keyErr := UserHash(client.SudokuKey)
		if keyErr != nil {
			return keyErr
		}
		if seen[hash] {
			return fmt.Errorf("duplicate Sudoku client key")
		}
		if revoked[hash] && client.Enable {
			return fmt.Errorf("this Sudoku key is permanently revoked; create a new client")
		}
		seen[hash] = true
	}
	encoded, err := json.Marshal(s)
	if err != nil {
		return err
	}
	inbound.Settings = string(encoded)
	return nil
}

// NormalizeClient supplies the same native client defaults for the ordinary
// add/edit/bulk API paths, using the destination inbound's server identity.
func NormalizeClient(client *model.Client, inbound *model.Inbound) error {
	settings, err := DecodeSettings(inbound.Settings)
	if err != nil {
		return err
	}
	if client.SudokuKey == "" {
		for _, existing := range settings.Clients {
			if strings.EqualFold(existing.Email, client.Email) {
				client.SudokuKey = existing.SudokuKey
				break
			}
		}
	}
	if client.SudokuKey != "" {
		public, keyErr := sudokukey.RecoverPublicKey(client.SudokuKey)
		if keyErr == nil && sudokukey.EncodePoint(public) != settings.PublicKey {
			for _, existing := range settings.Clients {
				if strings.EqualFold(existing.Email, client.Email) {
					client.SudokuKey = existing.SudokuKey
					break
				}
			}
		}
	}
	settings.Clients = []model.Client{*client}
	raw, err := json.Marshal(settings)
	if err != nil {
		return err
	}
	copy := *inbound
	copy.Settings = string(raw)
	if err = NormalizeSettings(&copy); err != nil {
		return err
	}
	normalized, err := DecodeSettings(copy.Settings)
	if err != nil {
		return err
	}
	*client = normalized.Clients[0]
	return nil
}
