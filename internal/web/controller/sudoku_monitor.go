// Connect Hub monitoring, 2026-10-31. GPL-3.0.
package controller

import (
	"encoding/json"
	"fmt"
	"github.com/gin-gonic/gin"
	"github.com/mhsanaei/3x-ui/v3/internal/config"
	"github.com/mhsanaei/3x-ui/v3/internal/hub"
	"github.com/mhsanaei/3x-ui/v3/internal/web/service"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"
)

func sudokuMonitor(c *gin.Context) {
	state := hub.Sudoku.State()
	inbounds, err := (&service.SudokuCompat{}).List()
	if err != nil && state.Enabled {
		jsonObj(c, nil, err)
		return
	}
	running, configured := state.Running, state.Configured
	failed := state.Error != ""
	for _, inbound := range inbounds {
		running = running || inbound.Status.Running
		configured = configured || inbound.Status.Configured
		failed = failed || inbound.Status.Error != ""
	}
	status := "stop"
	if running {
		status = "running"
	} else if failed {
		status = "error"
	}
	version := ""
	var build struct {
		Dependencies struct {
			Sudoku map[string]struct {
				URL string `json:"url"`
			} `json:"sudoku"`
		} `json:"dependencies"`
	}
	if data, e := os.ReadFile(filepath.Join(filepath.Dir(config.GetBinFolderPath()), "BUILD.json")); e == nil && json.Unmarshal(data, &build) == nil {
		for _, dep := range build.Dependencies.Sudoku {
			if _, tail, ok := strings.Cut(dep.URL, "/download/"); ok {
				version, _, _ = strings.Cut(tail, "/")
				break
			}
		}
	}
	jsonObj(c, gin.H{"state": status, "configured": configured, "version": version}, nil)
}

func sudokuReleases(c *gin.Context) {
	req, err := http.NewRequestWithContext(c.Request.Context(), http.MethodGet, "https://api.github.com/repos/sanderstripa/sudoku-ui/releases?per_page=100", nil)
	if err != nil {
		jsonObj(c, nil, err)
		return
	}
	req.Header.Set("Accept", "application/vnd.github+json")
	resp, err := (&http.Client{Timeout: 15 * time.Second}).Do(req)
	if err != nil {
		jsonObj(c, nil, err)
		return
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		jsonObj(c, nil, fmt.Errorf("Sudoku releases: HTTP %d", resp.StatusCode))
		return
	}
	var releases []struct {
		Tag        string `json:"tag_name"`
		Name       string `json:"name"`
		URL        string `json:"html_url"`
		Published  string `json:"published_at"`
		Draft      bool   `json:"draft"`
		Prerelease bool   `json:"prerelease"`
	}
	if err = json.NewDecoder(io.LimitReader(resp.Body, 4<<20)).Decode(&releases); err != nil {
		jsonObj(c, nil, err)
		return
	}
	result := []gin.H{}
	for _, r := range releases {
		if !r.Draft && strings.HasPrefix(r.Tag, "core-v") && strings.HasPrefix(r.URL, "https://github.com/sanderstripa/sudoku-ui/releases/") {
			result = append(result, gin.H{"version": r.Tag, "name": r.Name, "url": r.URL, "published": r.Published, "prerelease": r.Prerelease})
		}
	}
	jsonObj(c, result, nil)
}
