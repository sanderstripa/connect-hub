package panel

import (
	"io"
	"net/http"
	"strings"
	"testing"
)

type releaseTestTransport func(*http.Request) (*http.Response, error)

func (f releaseTestTransport) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }

func TestNextConnectHubPrereleaseDiscovery(t *testing.T) {
	// The same installed panel must see a later publication without changing
	// its binary or falling back to a compiled-in alpha tag.
	for _, tag := range []string{"v0.1.0-alpha.4", "v0.1.0-alpha.5", "v2.0.0-beta.9"} {
		t.Run(tag, func(t *testing.T) {
			client := &http.Client{Transport: releaseTestTransport(func(r *http.Request) (*http.Response, error) {
				if r.URL.Host != "api.github.com" || r.URL.Path != "/repos/sanderstripa/connect-hub/releases" {
					t.Fatalf("unexpected release source: %s", r.URL)
				}
				body := `[{"tag_name":"v99.0.0","draft":true},{"tag_name":"v98.0.0","assets":[]},{"tag_name":"`+tag+`","assets":[{"name":"SHA256SUMS"},{"name":"connect-hub-linux-amd64.tar.gz"},{"name":"connect-hub-linux-arm64.tar.gz"}]}]`
				return &http.Response{StatusCode: http.StatusOK, Body: io.NopCloser(strings.NewReader(body)), Header: make(http.Header)}, nil
			})}
			release, err := fetchInstallablePrerelease(client)
			if err != nil || release.TagName != tag {
				t.Fatalf("got release=%v err=%v, want %s", release, err, tag)
			}
		})
	}
}

func TestIncompleteConnectHubReleaseCannotEnableUpdate(t *testing.T) {
	client := &http.Client{Transport: releaseTestTransport(func(r *http.Request) (*http.Response, error) {
		return &http.Response{StatusCode: http.StatusOK, Body: io.NopCloser(strings.NewReader(`[{"tag_name":"v1.0.0","assets":[{"name":"SHA256SUMS"}]}]`)), Header: make(http.Header)}, nil
	})}
	if release, err := fetchInstallablePrerelease(client); err == nil {
		t.Fatalf("incomplete release was accepted: %v", release)
	}
}
