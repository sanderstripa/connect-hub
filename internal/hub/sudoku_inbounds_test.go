package hub

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestSudokuInboundDeviceIsolation(t *testing.T) {
	setup(t)
	r := &SudokuRegistry{}
	defer r.StopAll()
	p := profile(t)
	a, e := r.Create("Office", p)
	if e != nil {
		t.Fatal(e)
	}
	if _, e = r.Create("Conflict", p); e == nil {
		t.Fatal("duplicate port accepted")
	}
	p.Port++
	b, e := r.Create("Home", p)
	if e != nil {
		t.Fatal(e)
	}
	first, e := r.AddDevice(a, "Phone")
	if e != nil {
		t.Fatal(e)
	}
	second, e := r.AddDevice(a, "Laptop")
	if e != nil {
		t.Fatal(e)
	}
	x, e := r.Export(a, first.ID)
	if e != nil {
		t.Fatal(e)
	}
	y, e := r.Export(a, second.ID)
	if e != nil {
		t.Fatal(e)
	}
	if x["privateKey"] == y["privateKey"] || !strings.HasPrefix(x["uri"].(string), "sudoku://") {
		t.Fatal("device credentials not distinct/exportable")
	}
	if _, e = r.Export(b, first.ID); e == nil {
		t.Fatal("cross-inbound device export accepted")
	}
	list, e := r.List()
	if e != nil || len(list) != 2 {
		t.Fatalf("list: %v %v", list, e)
	}
	public, _ := json.Marshal(list)
	if strings.Contains(string(public), x["privateKey"].(string)) || strings.Contains(string(public), "test-master") {
		t.Fatal("secret exposed in list")
	}
	if e = r.SetDevice(a, first.ID, "disabled"); e != nil {
		t.Fatal(e)
	}
	if _, e = r.Export(a, first.ID); e == nil {
		t.Fatal("disabled device exported")
	}
	if e = r.SetDevice(a, first.ID, "enabled"); e != nil {
		t.Fatal(e)
	}
	if e = r.SetDevice(a, first.ID, "revoked"); e != nil {
		t.Fatal(e)
	}
	if e = r.SetDevice(a, first.ID, "enabled"); e == nil {
		t.Fatal("revoked key re-enabled")
	}
	// A new registry restores the hierarchy from private persistent storage.
	restored := &SudokuRegistry{}
	list, e = restored.List()
	if e != nil || len(list) != 2 {
		t.Fatalf("restore: %v", e)
	}
	if _, e = restored.Export(a, second.ID); e != nil {
		t.Fatal(e)
	}
	if _, e = r.Export("../", second.ID); e == nil {
		t.Fatal("path traversal accepted")
	}
	if e = r.Remove(a); e != nil {
		t.Fatal(e)
	}
	if _, e = os.Stat(filepath.Join(directory(), "sudoku-inbounds", a)); !os.IsNotExist(e) {
		t.Fatal("inbound not archived")
	}
	archived, e := os.ReadDir(filepath.Join(directory(), "sudoku-archive"))
	if e != nil || len(archived) != 1 {
		t.Fatal("deleted identity not retained")
	}
}
