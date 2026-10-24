package sudoku

import (
	"encoding/base64"
	"encoding/json"
	"net"
	"strconv"
	"strings"
)

// ExportClient emits the original core's client configuration and compact URI.
func ExportClient(host string, port int, settings Settings, secret string) map[string]any {
	host = strings.Trim(host, "[]")
	compact := map[string]any{"h": host, "p": port, "k": secret, "a": strings.TrimPrefix(settings.Table, "prefer_"), "e": settings.AEAD, "m": 1080, "x": true, "hd": true, "hm": "auto", "hx": "off", "hy": ""}
	raw, _ := json.Marshal(compact)
	config := map[string]any{"mode": "client", "transport": "tcp", "local_port": 1080, "server_address": net.JoinHostPort(host, strconv.Itoa(port)), "key": secret, "aead": settings.AEAD, "ascii": settings.Table, "multiplex": "off", "enable_pure_downlink": false, "padding_min": 0, "padding_max": 0, "httpmask": map[string]any{"disable": true, "mode": "auto", "tls": false, "host": "", "path_root": ""}, "rule_urls": []string{"global"}}
	return map[string]any{"privateKey": secret, "uri": "sudoku://" + base64.RawURLEncoding.EncodeToString(raw), "config": config}
}
