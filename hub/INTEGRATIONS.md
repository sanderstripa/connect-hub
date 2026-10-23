# Integration boundaries

Added/modified 23 October 2026. All integrations are off by default. No
configuration, database, certificate or key is read from an existing service.

## Sudoku

This means the transport [SUDOKU-ASCII/sudoku](https://github.com/SUDOKU-ASCII/sudoku),
not the puzzle. The inspected implementation is
[sanderstripa/sudoku-ui](https://github.com/sanderstripa/sudoku-ui), including its
compatible Core patches and `core-v*` releases. Its native server uses `-c`,
`-keygen`, `Master Public Key` and `Available Private Key`.

The initial adapter supports a single separately owned TCP server, freshly
generated server identity and one client private key, ASCII/entropy table modes,
AEAD, explicit start/stop and persistence of the public profile. A private client
key is displayed once, never returned by the general status API or written to
the profile. Save it before leaving the page. Removal requires stopping the
child and deliberately discarding the old identity. No existing service is
adopted and no server starts automatically after restart.

An administrator must place a reviewed, compatible Core binary in a dedicated
Connect Hub path and create `/etc/connect-hub/integrations.env` (mode 0600):

```
CONNECT_HUB_SUDOKU=1
CONNECT_HUB_SUDOKU_BINARY=/opt/connect-hub/sidecars/sudoku
CONNECT_HUB_SUDOKU_SHA256=<SHA-256 of that reviewed binary>
```

The native installer sets `CONNECT_HUB_INTEGRATIONS_DIR` to
`/etc/connect-hub/integrations`. Restart Connect Hub after changing environment
settings. The Hub screen creates fresh keys and config without hand-editing
protocol JSON. Verify the Core license and release checksum before placing a
binary. No automatic Core download, upgrade or firewall change occurs.

This is a first adapter, not parity with Sudoku UI: per-device issuance,
hot revocation, session/traffic accounting, QR/subscription export, HTTP masking
and UDP are not implemented. Tests use a helper child to prove process ownership
and configuration handling; they do not prove real Sudoku transport compatibility.

## Connect Core alpha

The inspected [CONNECT Core](https://github.com/sanderstripa/connect-core) is
CONNECT IP v2 over QUIC DATAGRAM / TLS 1.3 mTLS with a separate protected
`connect-control` management API. It is not Mist or an Xray transport.

The adapter is read-only and explicitly opt-in:

```
CONNECT_HUB_CORE_ALPHA=1
CONNECT_HUB_CORE_URL=http://127.0.0.1:17891
CONNECT_HUB_CORE_TOKEN_FILE=/etc/connect-hub/core-control-token
```

Only a numeric loopback endpoint is accepted. Proxies and redirects are disabled.
Only `GET /v1/status` is requested; the browser receives a small allowlist of
status/version/session fields, never tokens, device keys or the raw Core state.
No TUN, routes, DNS, enrollment or server creation is exposed by this adapter.
Tests cover opt-in, authentication, sanitization and redirect refusal against a
test API. Real Core runtime interoperability remains to be tested separately.

## Mist alpha

The current default [Mist repository](https://github.com/sanderstripa/mist)
contains a project description and assets; implementation is on separate
hardening branches. A supported panel API and redistribution license have not
been established for this adapter. Mist is shown as unavailable/disabled and no
binary is downloaded or executed. This is a declared integration boundary,
not a claim of working Mist support. Review/pin the relevant implementation and
license before adding a runtime adapter.
