# Integration configuration and limits

Modified 24 October 2026. No existing service configuration, database, certificate or key is imported.

## Sudoku

This is the [SUDOKU-ASCII/sudoku](https://github.com/SUDOKU-ASCII/sudoku) transport, not the puzzle. The package includes the checksum-pinned compatible core-v0.7.0 from sanderstripa/sudoku-ui. Original source, compatibility patch and license accompany the package; see [third-party/SUDOKU-SOURCE.md](third-party/SUDOKU-SOURCE.md).

The Sudoku page manages independent TCP inbounds, each with its own master identity, free port, isolated files/control socket and owned child process. Add named devices to an inbound to derive distinct private keys with the compatible Core keygen interface. Authenticated device export provides the private key, a compact sudoku:// URI, QR and downloadable native client JSON. General status/list APIs never return private keys. Exports require CSRF and are marked no-store.

Devices can be disabled, re-enabled or permanently revoked. The compatible Core receives the policy on that inbound's Unix socket. If hot policy application is unavailable, only that inbound's child restarts to load the saved policy; this can briefly reconnect its other devices. Other inbounds/services are not restarted. Revoked entries remain as deny-policy tombstones and cannot be re-enabled.

Enabled inbounds restart with the panel. Their master keys and device credentials are stored in dedicated owner-only directories/files under CONNECT_HUB_INTEGRATIONS_DIR/sudoku-inbounds, normally /etc/connect-hub/integrations/sudoku-inbounds. Backups contain these secrets. Deleting a stopped inbound moves it into a private retained sudoku-archive; no automatic removal occurs.

The bundled binary makes Sudoku available immediately, but no listener starts until the administrator creates/starts an inbound. CONNECT_HUB_SUDOKU=0 explicitly disables Sudoku. An administrator can instead set CONNECT_HUB_SUDOKU=1, an absolute CONNECT_HUB_SUDOKU_BINARY and CONNECT_HUB_SUDOKU_SHA256 to use a reviewed compatible binary. Dedicated integration paths are mandatory. Inherited Sudoku statistics/policy/socket environment is overridden with each child's own paths.

Current scope: TCP, chacha20-poly1305 / aes-128-gcm and ASCII/entropy table modes. Sudoku UDP, HTTP masking, subscriptions and unified Xray traffic/session accounting are not implemented. A real acceptance test exercises multiple inbounds/devices, wrong-inbound rejection, disable/enable/revoke and persistence with actual compatible Core clients and servers. It does not establish compatibility with every third-party client or Core revision. Allow the chosen inbound ports deliberately in your own firewall; Docker requires explicit port publication.

## Connect Core alpha

CONNECT Core is a separate protected CONNECT IP v2 control plane. This adapter is read-only and opt-in:

```
CONNECT_HUB_CORE_ALPHA=1
CONNECT_HUB_CORE_URL=http://127.0.0.1:17891
CONNECT_HUB_CORE_TOKEN_FILE=/etc/connect-hub/core-control-token
```

Place these in /etc/connect-hub/integrations.env (0600), make the token file readable only by the connect-hub service account, and restart Connect Hub. Only numeric loopback endpoints are accepted; proxies/redirects are disabled. Only GET /v1/status is requested. The browser receives an allowlist of status/version/session fields, never raw state, tokens or device keys. No VPN/TUN startup, routes, DNS, device enrollment or server creation is exposed. The real pinned connect-control process is tested without starting TUN/routes.

## Mist

Mist remains unavailable and disabled. Its implementation branches have not established a verified panel management contract and redistribution license for this adapter. No Mist binary is downloaded or executed. This is an explicit experimental boundary accepted for the present release, not a working transport claim.
