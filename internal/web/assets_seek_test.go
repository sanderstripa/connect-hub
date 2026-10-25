package web

import (
	"bytes"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestEmbeddedFontsAndRangeRequests(t *testing.T) {
	entries, err := distFS.ReadDir("dist/assets")
	if err != nil { t.Fatal(err) }
	checked := 0
	for _, entry := range entries {
		if !bytes.HasSuffix([]byte(entry.Name()), []byte(".woff2")) { continue }
		checked++
		expected, err := distFS.ReadFile("dist/assets/" + entry.Name())
		if err != nil { t.Fatal(err) }
		handler := http.FileServer(http.FS(&wrapDistFS{FS: distFS}))
		for _, partial := range []bool{false, true} {
			req := httptest.NewRequest("GET", "/"+entry.Name(), nil)
			if partial { req.Header.Set("Range", "bytes=0-3") }
			response := httptest.NewRecorder()
			handler.ServeHTTP(response, req)
			wantStatus, wantBody := 200, expected
			if partial { wantStatus, wantBody = 206, expected[:4] }
			if response.Code != wantStatus || !bytes.Equal(response.Body.Bytes(), wantBody) {
				t.Fatalf("font %s partial=%v: HTTP %d, length %d", entry.Name(), partial, response.Code, response.Body.Len())
			}
		}
		file, err := (&wrapDistFS{FS: distFS}).Open(entry.Name())
		if err != nil { t.Fatal(err) }
		if _, ok := file.(io.Seeker); !ok { t.Fatal("embedded font lost seeking") }
		file.Close()
	}
	if checked < 2 { t.Fatal("normal and italic bundled Montserrat fonts missing; build frontend first") }
}
