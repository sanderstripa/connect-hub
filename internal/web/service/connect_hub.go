// Connect Hub parallel-install defaults, added 2026-10-23. GPL-3.0.
package service

import (
	"encoding/json"
	"net"
	"strconv"
)

// InitializeParallelTest writes only this panel's freshly created database.
// Subscription serving starts disabled; all internal Xray listeners get their
// own available loopback ports rather than colliding with another panel's core.
func (s *SettingService) InitializeParallelTest() error {
	panelPort, err := s.GetPort()
	if err != nil {
		return err
	}
	var listeners []net.Listener
	defer func() {
		for _, l := range listeners {
			l.Close()
		}
	}()
	ports := []int{}
	for len(ports) < 3 {
		l, e := net.Listen("tcp", "127.0.0.1:0")
		if e != nil {
			return e
		}
		p := l.Addr().(*net.TCPAddr).Port
		if p == panelPort {
			l.Close()
			continue
		}
		listeners = append(listeners, l)
		ports = append(ports, p)
	}
	var cfg map[string]any
	if err = json.Unmarshal([]byte(xrayTemplateConfig), &cfg); err != nil {
		return err
	}
	if inbounds, ok := cfg["inbounds"].([]any); ok {
		for _, item := range inbounds {
			if ib, ok := item.(map[string]any); ok && ib["tag"] == "api" {
				ib["listen"] = "127.0.0.1"
				ib["port"] = ports[0]
			}
		}
	}
	if metrics, ok := cfg["metrics"].(map[string]any); ok {
		metrics["listen"] = "127.0.0.1:" + strconv.Itoa(ports[1])
	}
	b, err := json.Marshal(cfg)
	if err != nil {
		return err
	}
	for key, value := range map[string]string{"subEnable": "false", "subListen": "127.0.0.1", "subPort": strconv.Itoa(ports[2]), "xrayTemplateConfig": string(b)} {
		if err = s.setString(key, value); err != nil {
			return err
		}
	}
	return nil
}
