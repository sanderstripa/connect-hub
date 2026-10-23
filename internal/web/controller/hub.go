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
	api.GET("/sudoku/inbounds", func(c *gin.Context) { v, e := hub.SudokuInbounds.List(); jsonObj(c, v, e) })
	api.POST("/sudoku/inbounds", func(c *gin.Context) {
		c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 16384)
		var p struct {
			hub.SudokuProfile
			Name string `json:"name"`
		}
		if e := c.ShouldBindJSON(&p); e != nil {
			jsonMsg(c, "Invalid inbound", e)
			return
		}
		id, e := hub.SudokuInbounds.Create(p.Name, p.SudokuProfile)
		jsonObj(c, gin.H{"id": id}, e)
	})
	api.POST("/sudoku/inbounds/:id/:action", func(c *gin.Context) {
		id, action := c.Param("id"), c.Param("action")
		switch action {
		case "start":
			jsonMsg(c, "Inbound started", hub.SudokuInbounds.SetRunning(id, true))
		case "stop":
			jsonMsg(c, "Inbound stopped", hub.SudokuInbounds.SetRunning(id, false))
		case "remove":
			jsonMsg(c, "Inbound archived", hub.SudokuInbounds.Remove(id))
		case "devices":
			c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 4096)
			var p struct {
				Name string `json:"name"`
			}
			if e := c.ShouldBindJSON(&p); e != nil {
				jsonMsg(c, "Invalid device", e)
				return
			}
			v, e := hub.SudokuInbounds.AddDevice(id, p.Name)
			jsonObj(c, v, e)
		default:
			c.Status(http.StatusNotFound)
		}
	})
	api.POST("/sudoku/inbounds/:id/devices/:device/:action", func(c *gin.Context) {
		c.Header("Cache-Control", "no-store")
		if c.Param("action") == "export" {
			v, e := hub.SudokuInbounds.Export(c.Param("id"), c.Param("device"))
			jsonObj(c, v, e)
			return
		}
		jsonMsg(c, "Device updated", hub.SudokuInbounds.SetDevice(c.Param("id"), c.Param("device"), c.Param("action")))
	})
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
