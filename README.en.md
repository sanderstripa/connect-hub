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

The bootstrap downloads a fixed tested release, verifies its pinned SHA-256 and invokes its installer. No archive, IP or checksum substitution is needed. Requires bash, curl, Python 3, OpenSSL, tar, sha256sum and systemd. Missing prerequisites are installed through the OS package manager. The bootstrap does not currently offer ARM64.

The installer prints a random URL, username and password. Retrieve them again with:

```bash
sudo cat /etc/connect-hub/initial-access.txt
```

Open **URL** in your browser: the installer detects the server IPv4 address and
chooses a free port. Normal native installation needs no SSH tunnel. If a server
or provider firewall blocks it, allow only the printed new TCP port. Initial
access uses HTTPS. Setup requests a trusted Let's Encrypt IP/domain certificate
and configures automatic renewal. External TCP port 80 must be reachable and
free. If validation is unavailable, other services are left running and an
explicitly identified temporary certificate is used; the browser will warn
until trusted issuance succeeds. **LOCAL_URL** is an
additional address for checks performed on the server itself.

## Parallel installation and updates

Only `/opt/connect-hub`, `/etc/connect-hub`, `/var/log/connect-hub`, the `connect-hub` account and service are created. Existing names/paths are refused. No foreign database, keys or certificates are imported; no firewall, DNS, routes or other services are changed. Internal Xray ports are independently allocated and subscription defaults are preserved with a separate free port. The service runs as root, as in upstream 3x-ui.

Stop only this panel: `sudo systemctl stop connect-hub`.

Update a managed installation:

```bash
curl -fsSL https://raw.githubusercontent.com/sanderstripa/connect-hub/main/install.sh | bash -s -- --update
```

Updates retain a complete data backup and restore the previous binary/data after a failed launch. Backups are never automatically deleted. Reinstalling an already installed revision is unnecessary. Web updates install only a checksum-verified Connect Hub release and cannot replace the fork with upstream binaries.

## Sudoku inbounds and devices

A pinned compatible Sudoku Core is included. In the normal **Inbounds** page,
click **Add Inbound → Basic → Protocol → Sudoku**. All protocols use the same
inbound list and the original client controls:

1. Choose Sudoku and a free port. The remark, listen address and limits are ordinary 3x-ui fields; no additional mandatory server-address field is introduced.
2. Open the standard **Clients** page, create a client and attach it to this inbound. Create a separate client for each device.
3. Open the client's standard **QR Code** button to copy its `sudoku://` link or scan its QR in a compatible application.

Keys are generated automatically and preserved on edits. The ordinary client operations, subscription links, traffic counters and panel database backups include Sudoku. Earlier Connect Hub alpha inbounds migrate into that database without changing device keys; unrelated installations are never imported. A client-set change may reconnect devices on that inbound only. Its port must be reachable; Docker needs an explicit port mapping.

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

Management menu: `sudo connect-hub`. The upstream-derived management menu is restored with Connect Hub paths and service names. Certificate retry: `sudo bash /opt/connect-hub/current/hub/cert.sh`, then `sudo systemctl restart connect-hub`. Existing HTTP installations receive HTTPS during this update when no certificate is configured.
