# Connect Hub

Independent server panel based on [3x-ui](https://github.com/MHSanaei/3x-ui),
preserving its Git history and GPL-3.0 license. First implementation:
**0.1.0-alpha.1**. This is an early review build, not a production-ready release.

The existing Xray panel architecture is retained: inbound/outbound management,
clients, subscriptions, routing, statistics, API, database backups, multi-node
features and the upstream protocol engines. Connect Hub adds its own identity,
separate storage, an advertising-free active UI and explicit integration
boundaries. No settings, users, keys or certificates are imported from 3x-ui.

## Build and run

Linux amd64/arm64, Go 1.27.3 with CGO/C compiler, Node 26.12.1/npm 11+, Python
3.12+, and Git are required. Dependencies are locked in go.sum, package-lock.json
and hub/dependencies.json. Build natively for the target architecture:

```bash
cd frontend
npm ci --ignore-scripts
npm run build
cd ..
python3 hub/package.py
```

CI produces `connect-hub-linux-amd64.tar.gz`, SHA256SUMS and a smoke-test report
as build artifacts. No release is published automatically. Build revisions,
upstream revision and sidecar digests are recorded inside BUILD.json. Inputs
are pinned; byte-identical archive reproducibility has not yet been established.

On a **clean disposable Linux server**, place the package, SHA256SUMS and this
checkout in the current directory, then install without editing the checksum:

```bash
sha256sum -c SHA256SUMS
sudo bash hub/install.sh --package connect-hub-linux-amd64.tar.gz --sha256 "$(awk '$2=="connect-hub-linux-amd64.tar.gz" {print $1}' SHA256SUMS)"
```

The installer creates only Connect Hub-owned directories and service:
`/opt/connect-hub`, `/etc/connect-hub`, `/var/log/connect-hub`,
`connect-hub.service`. It refuses existing target directories on a fresh install.
The panel initially listens on **127.0.0.1:2053** with random credentials and a
random URL path, stored in `/etc/connect-hub/initial-access.txt` (mode 0600).
Use SSH forwarding or configure your own TLS reverse proxy before remote access.
It does not open firewall ports, request certificates, alter DNS/routes, restart
other services or inspect any existing x-ui/sudoku configuration.

For an update use the same verified-package command with `--update`. Stop/start
is limited to `connect-hub.service`; data is copied into a retained backup before
the new release is activated. A failed service health check restores the prior
binary/data and retains failed data for inspection. There is no automatic backup
deletion. The operator must stop a manually launched `--no-service` instance
before updating it. Panel web self-update is disabled to prevent accidental
replacement by upstream. Do not use inherited x-ui maintenance scripts.

## Container

```bash
docker compose build --build-arg CONNECT_HUB_REVISION="$(git rev-parse HEAD)"
docker compose up -d
docker compose exec connect-hub cat /etc/connect-hub/initial-access.txt
```

This uses fresh, independent named volumes and a loopback-only published panel
port. Add only the inbound TCP/UDP port mappings you deliberately configure.
No host network, host data mounts or privileged access is requested. Container
build/runtime validation is separate from native-package validation; consult CI
and the validation report before relying on either path.

## Additional engines

See [integration configuration and limits](hub/INTEGRATIONS.md).

- **Sudoku:** first optional owned-process adapter, fresh key generation, public
  profile persistence and start/stop. Real transport compatibility remains an
  acceptance gate; full client management/traffic/subscription parity is pending.
- **Connect Core:** optional read-only alpha status integration with a protected
  loopback CONNECT IP v2 control plane. No TUN or route changes.
- **Mist:** explicitly unavailable/disabled pending a verified runtime API and
  license. It is not presented as a working protocol.

## Tests and upstream updates

```bash
cd frontend
npm run typecheck
npm run lint
npm test -- --project unit --project components
npm run build
cd ..
go test -shuffle=on -count=1 ./...
go test -race ./internal/hub ./internal/config ./internal/web/controller
python3 hub/package.py
python3 hub/smoke.py
```

The smoke test uses disposable local data and loopback traffic; it tests fresh
installation, login/CSRF, status/backup APIs, real packaged Xray forwarding,
inbound CRUD, disabled integrations, data-preserving updates and retained backup.
It does not access a real VPS. Native systemd and container installation require
their own validation. [Upstream maintenance](hub/UPSTREAM.md) explains the
review/merge workflow. Never reset Connect Hub to upstream or run upstream's
installer to update Connect Hub.

## License and origin

3x-ui by MHSanaei and contributors; Connect Hub modifications by Sander Stripa
and contributors, added 23 October 2026. See [NOTICE](NOTICE), [GPL-3.0](LICENSE)
and the complete Git history for authorship and changes. This software comes
without warranty. Modified source and build instructions are available in this
repository; preserve these notices and provide corresponding source with GPL
binary distributions. Third-party engines retain their own licenses.
