# Connect Hub

**[Русский](README.md) · [English](README.en.md)**

Independent server panel based on [3x-ui](https://github.com/MHSanaei/3x-ui), with its own identity, clean storage and no active advertising blocks. Complete upstream Git ancestry, authorship and GPL-3.0 are retained. **0.1 alpha** is a test release.

## The complete 3x-ui-based panel

The original inbound/outbound and client management, standard protocols,
subscriptions, routing/DNS, statistics, Xray settings, API, backups and node
management are retained. Changes are Connect Hub branding, no advertising or
sponsor blocks, isolated installation and the additional Sudoku protocol.
Sudoku is not required to use the panel's standard features.

## Install with one command

On a **Linux amd64 / x86_64 systemd server**, run:

```bash
curl -fsSL https://raw.githubusercontent.com/sanderstripa/connect-hub/main/install.sh | bash
```

The bootstrap downloads a fixed tested release, verifies its pinned SHA-256 and invokes its installer. No archive, IP or checksum substitution is needed. Requires bash, curl, Python 3, OpenSSL, tar, sha256sum and systemd. Missing prerequisites are reported before installation. The bootstrap does not currently offer ARM64.

The installer prints a random URL, username and password. Retrieve them again with:

```bash
sudo cat /etc/connect-hub/initial-access.txt
```

The panel initially listens on **127.0.0.1 at a free port**. Forward that port over SSH to use a browser on another computer, then open the complete URL including its random path. Configure external access/TLS separately after testing.

## Parallel installation and updates

Only `/opt/connect-hub`, `/etc/connect-hub`, `/var/log/connect-hub`, the `connect-hub` account and service are created. Existing names/paths are refused. No foreign database, keys or certificates are imported; no firewall, DNS, routes or other services are changed. Internal Xray ports are independently allocated and subscriptions initially disabled. The service runs under a dedicated unprivileged account.

Stop only this panel: `sudo systemctl stop connect-hub`.

Update a managed installation:

```bash
curl -fsSL https://raw.githubusercontent.com/sanderstripa/connect-hub/main/install.sh | bash -s -- --update
```

Updates retain a complete data backup and restore the previous binary/data after a failed launch. Backups are never automatically deleted. Reinstalling an already installed revision is unnecessary. Upstream x-ui maintenance scripts and web self-update cannot overwrite the fork.

## Sudoku inbounds and devices

A pinned compatible Sudoku Core is included. In the normal **Inbounds** page,
select the **Sudoku** tab. All standard protocols remain on the adjacent tab:

1. Create an inbound with a name, client-facing server address and free TCP port.
2. Add devices, such as Phone and Laptop.
3. Open **Key / QR / configuration** for each device. Copy its `sudoku://` URI, scan the QR with a compatible client or download native client JSON.
4. Start the inbound and deliberately allow its TCP port in your firewall. Docker also requires an explicit inbound port mapping.

Each device receives a distinct key. Disable/re-enable a device or permanently revoke its key. Keys cannot authenticate to another inbound. Enabled inbounds and device credentials persist across panel restarts; removed inbounds are retained in a private archive. Sudoku UDP, subscriptions and unified Xray traffic accounting are not implemented. Treat credentials and backups as secrets.

Connect Core alpha remains an opt-in, read-only status adapter for an existing protected control plane: it cannot start VPN/TUN, modify routes or issue Core devices. Mist remains unavailable until its integration contract and redistribution license are verified. Neither experimental transport is claimed as implemented.

## Build from source

Native Linux amd64/arm64 builds require Go 1.27.3, CGO/C compiler, Node 26.12.1/npm 11+, Python 3 and Git. Only amd64 receives full release validation. Dependency/source digests are pinned in `hub/dependencies.json`; frontend and Go dependencies use their lockfiles.

```bash
cd frontend
npm ci --ignore-scripts
npm run build
cd ..
python3 hub/package.py
```

Artifacts include BUILD.json with exact build/upstream revisions, third-party licenses and the corresponding compatible Sudoku source/patch. Byte-identical archive reproducibility has not been established. Build/package/install checks run in [Actions](https://github.com/sanderstripa/connect-hub/actions); inspect the run linked to each release for precise coverage.

## Documentation

- [Russian parallel installation and Docker](hub/TESTING-RU.md)
- [Integration configuration and limits](hub/INTEGRATIONS.md)
- [Reviewed upstream updates](hub/UPSTREAM.md)
- [Releases](https://github.com/sanderstripa/connect-hub/releases)
- [GPL-3.0](LICENSE) and [authorship/modifications](NOTICE)

Based on 3x-ui by MHSanaei and contributors. Connect Hub modifications by Sander Stripa and contributors, 2026. Original Sudoku authorship/license notices and corresponding source are retained. No endorsement or warranty is implied. Validation uses isolated environments, never the user's live VPS or existing installations.
