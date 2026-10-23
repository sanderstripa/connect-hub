// Connect Hub modifications, 2026-10-23. GPL-3.0.
package controller

import (
	"github.com/gin-gonic/gin"
	"github.com/mhsanaei/3x-ui/v3/internal/hub"
	"net/http"
)

// Registered only behind the existing session login and CSRF middleware.
func registerHubRoutes(g *gin.RouterGroup) {
	api := g.Group("/hub/api")
	api.GET("/status", func(c *gin.Context) {
		jsonObj(c, gin.H{"sudoku": hub.Sudoku.State(), "mist": gin.H{"enabled": false, "stage": "alpha / unavailable", "reason": "No verified server adapter or redistribution license; no runtime is started"}, "connectCore": hub.ProbeCore()}, nil)
	})
	api.POST("/sudoku/create", func(c *gin.Context) {
		c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 16384)
		var p hub.SudokuProfile
		if err := c.ShouldBindJSON(&p); err != nil {
			jsonMsg(c, "Invalid Sudoku profile", err)
			return
		}
		secret, err := hub.Sudoku.Create(p)
		c.Header("Cache-Control", "no-store")
		jsonObj(c, gin.H{"privateKey": secret}, err)
	})
	api.POST("/sudoku/start", func(c *gin.Context) { jsonMsg(c, "Sudoku started", hub.Sudoku.Start()) })
	api.POST("/sudoku/stop", func(c *gin.Context) { jsonMsg(c, "Sudoku stopped", hub.Sudoku.Stop()) })
	api.POST("/sudoku/remove", func(c *gin.Context) { jsonMsg(c, "Sudoku profile removed", hub.Sudoku.Remove()) })
}
