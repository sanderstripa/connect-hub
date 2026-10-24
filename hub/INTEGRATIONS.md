# Integration configuration and limits

Modified 24 October 2026. No existing service configuration, database, certificate or key is imported.

## Sudoku

This is the [SUDOKU-ASCII/sudoku](https://github.com/SUDOKU-ASCII/sudoku) transport. The package builds pinned original source plus disclosed compatibility and listen-address patches; see [third-party/SUDOKU-SOURCE.md](third-party/SUDOKU-SOURCE.md).

Sudoku is an ordinary protocol in **Inbounds → Add Inbound → Basic → Protocol**. Inbounds use positive database IDs. The standard Clients page creates device keys and offers the existing link/QR controls. The standard client CRUD, subscriptions and traffic accounting apply. Server identity and per-device `sudokuKey` values are stored in the inbound settings in the normal SQL database and included in its backup. `sudokuKey` is separate from MTProto's `secret`, so a shared client does not overwrite the existing protocol's credentials.

Each runtime uses an exact whitelist of registered client-key hashes. Unknown keys are refused, including a new key derived by a client from an old split key. Disabled clients and clients filtered by normal quota/expiry accounting do not retain access. The previous alpha API remains a compatibility adapter over ordinary database/service operations; it does not maintain a second registry. Existing Connect Hub alpha registries migrate once, preserving keys and their private recovery files. Deleted migrated inbounds are not recreated on restart.

Only disposable runtime configs, counters and private control sockets live under CONNECT_HUB_INTEGRATIONS_DIR/native-sudoku. A change to the client set or server configuration currently restarts that inbound's own child. Other inbounds and external services are unaffected. CONNECT_HUB_SUDOKU=0 disables the integration. A reviewed compatible binary may be selected with CONNECT_HUB_SUDOKU_BINARY and CONNECT_HUB_SUDOKU_SHA256; it must implement the disclosed listen-address and access-control contract.

The normal form exposes the original core's encryption and ASCII/entropy table modes. The protocol listens on TCP; the upstream compatible client also contains UDP-over-TCP support, which is distinct from a UDP listener. Compatibility is tested with the pinned original compatible client, not asserted for every third-party application. Allow configured ports deliberately; Docker needs explicit inbound port mappings.

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
