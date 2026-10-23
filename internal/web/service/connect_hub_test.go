package service

import (
	"encoding/json"
	"net"
	"strconv"
	"testing"
)

func TestParallelInitializationSeparatesInternalListeners(t *testing.T) {
	setupSettingTestDB(t)
	var occupied []net.Listener
	for _, p := range []int{2096, 11111, 62789} {
		l, e := net.Listen("tcp", "127.0.0.1:"+strconv.Itoa(p))
		if e == nil {
			occupied = append(occupied, l)
		}
	}
	defer func() {
		for _, l := range occupied {
			l.Close()
		}
	}()
	s := &SettingService{}
	if e := s.InitializeParallelTest(); e != nil {
		t.Fatal(e)
	}
	if enabled, e := s.GetSubEnable(); e != nil || enabled {
		t.Fatal("subscription listener enabled by default", e)
	}
	b, e := s.GetXrayConfigTemplate()
	if e != nil {
		t.Fatal(e)
	}
	var cfg struct {
		Inbounds []struct {
			Tag  string `json:"tag"`
			Port int    `json:"port"`
		}
		Metrics struct {
			Listen string `json:"listen"`
		}
	}
	if e = json.Unmarshal([]byte(b), &cfg); e != nil {
		t.Fatal(e)
	}
	ports := map[int]bool{}
	for _, ib := range cfg.Inbounds {
		if ib.Tag == "api" {
			ports[ib.Port] = true
		}
	}
	_, mp, e := net.SplitHostPort(cfg.Metrics.Listen)
	if e != nil {
		t.Fatal(e)
	}
	metric, e := strconv.Atoi(mp)
	if e != nil {
		t.Fatal(e)
	}
	ports[metric] = true
	sub, e := s.GetSubPort()
	if e != nil {
		t.Fatal(e)
	}
	ports[sub] = true
	if len(ports) != 3 {
		t.Fatal("internal listener collision")
	}
	for p := range ports {
		if p == 2096 || p == 11111 || p == 62789 || p == 2053 {
			t.Fatalf("reused common existing port %d", p)
		}
	}
}
