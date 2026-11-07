package controller

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/mhsanaei/3x-ui/v3/internal/util/netsafe"
)

// The AI provider is opt-in. Its API key stays in the server's environment
// instead of being transmitted to or stored by the browser.
type AssistantController struct{}
type assistantMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}
type assistantChatRequest struct {
	Messages []assistantMessage `json:"messages"`
}
type assistantChatReply struct {
	Content string `json:"content"`
	Model   string `json:"model"`
}
type assistantProviderResponse struct {
	Choices []struct {
		Message assistantMessage `json:"message"`
	} `json:"choices"`
}

const assistantSystemPrompt = "You are the optional assistant embedded inside Connect Hub, a VPN/network management panel. Answer clearly in the user's language. You do not have direct access to the live panel, credentials or private data. You cannot execute administrative actions, so never claim that you made configuration changes, restarted servers or inspected live logs. Explain exact steps and safety considerations instead. Never request passwords or secret keys in chat."
const assistantMaxBody = 64 << 10
const assistantMaxMessage = 4000
const assistantMaxMessages = 16

func NewAssistantController(g *gin.RouterGroup) *AssistantController {
	a := &AssistantController{}
	g.GET("/status", a.status)
	g.POST("/chat", a.chat)
	return a
}
func assistantModel() string {
	model := strings.TrimSpace(os.Getenv("CONNECT_HUB_AI_MODEL"))
	if model == "" {
		return "gpt-4.1-mini"
	}
	return model
}
func assistantEndpoint() (string, error) {
	endpoint := strings.TrimSpace(os.Getenv("CONNECT_HUB_AI_URL"))
	if endpoint == "" {
		endpoint = "https://api.openai.com/v1/chat/completions"
	}
	u, err := url.Parse(endpoint)
	if err != nil || u.Scheme != "https" || u.Host == "" || u.User != nil || u.Fragment != "" {
		return "", errors.New("assistant provider URL must be a valid HTTPS endpoint")
	}
	return endpoint, nil
}
func (a *AssistantController) status(c *gin.Context) {
	c.Header("Cache-Control", "no-store")
	_, endpointErr := assistantEndpoint()
	jsonObj(c, gin.H{
		"configured":   strings.TrimSpace(os.Getenv("CONNECT_HUB_AI_API_KEY")) != "" && endpointErr == nil,
		"model":        assistantModel(),
		"provider":     "OpenAI-compatible HTTPS",
		"advisoryOnly": true,
	}, nil)
}
func (r assistantChatRequest) validate() error {
	if len(r.Messages) == 0 || len(r.Messages) > assistantMaxMessages {
		return errors.New("send 1 to 16 messages")
	}
	if r.Messages[len(r.Messages)-1].Role != "user" {
		return errors.New("last message must be from the user")
	}
	for _, msg := range r.Messages {
		if msg.Role != "user" && msg.Role != "assistant" {
			return errors.New("unsupported chat role")
		}
		if len(strings.TrimSpace(msg.Content)) == 0 || len(msg.Content) > assistantMaxMessage {
			return errors.New("each message must have 1-4000 characters")
		}
	}
	return nil
}
func (a *AssistantController) chat(c *gin.Context) {
	c.Header("Cache-Control", "no-store")
	key := strings.TrimSpace(os.Getenv("CONNECT_HUB_AI_API_KEY"))
	if key == "" {
		c.JSON(http.StatusServiceUnavailable, gin.H{"success": false, "msg": "AI provider is not configured on this server"})
		return
	}
	endpoint, err := assistantEndpoint()
	if err != nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"success": false, "msg": err.Error()})
		return
	}
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, assistantMaxBody)
	var req assistantChatRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "msg": "invalid chat request"})
		return
	}
	if err := req.validate(); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "msg": err.Error()})
		return
	}
	messages := make([]assistantMessage, 0, len(req.Messages)+1)
	messages = append(messages, assistantMessage{Role: "system", Content: assistantSystemPrompt})
	messages = append(messages, req.Messages...)
	requestJSON, err := json.Marshal(gin.H{"model": assistantModel(), "messages": messages, "max_tokens": 800, "stream": false})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "msg": "unable to prepare chat"})
		return
	}
	ctx, cancel := context.WithTimeout(c.Request.Context(), 35*time.Second)
	defer cancel()
	outbound, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(requestJSON))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "msg": "invalid provider endpoint"})
		return
	}
	outbound.Header.Set("Authorization", "Bearer "+key)
	outbound.Header.Set("Content-Type", "application/json")
	outbound.Header.Set("Accept", "application/json")
	transport := &http.Transport{
		DialContext:         netsafe.SSRFGuardedDialContext,
		TLSHandshakeTimeout: 10 * time.Second,
		MaxIdleConnsPerHost: 2,
	}
	defer transport.CloseIdleConnections()
	client := &http.Client{
		Transport:     transport,
		Timeout:       35 * time.Second,
		CheckRedirect: func(_ *http.Request, _ []*http.Request) error { return http.ErrUseLastResponse },
	}
	reply, err := client.Do(outbound)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"success": false, "msg": "AI provider unavailable"})
		return
	}
	defer reply.Body.Close()
	if reply.StatusCode != http.StatusOK {
		c.JSON(http.StatusBadGateway, gin.H{"success": false, "msg": fmt.Sprintf("AI provider returned HTTP %d", reply.StatusCode)})
		return
	}
	var result assistantProviderResponse
	err = json.NewDecoder(io.LimitReader(reply.Body, 512<<10)).Decode(&result)
	if err != nil || len(result.Choices) == 0 || strings.TrimSpace(result.Choices[0].Message.Content) == "" {
		c.JSON(http.StatusBadGateway, gin.H{"success": false, "msg": "AI provider returned an invalid reply"})
		return
	}
	jsonObj(c, assistantChatReply{
		Content: result.Choices[0].Message.Content,
		Model:   assistantModel(),
	}, nil)
}

// A narrow custom resolver means the dialer is subject to the existing
// private-address guard; the assistant must not become an internal SSRF proxy.
