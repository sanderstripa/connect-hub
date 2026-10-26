![Connect. Hub](docs/brand/wordmark.svg)

# Connect. Hub

**[English](README.md) · [Русский](README.ru.md)**

Independent server panel based on [3x-ui](https://github.com/MHSanaei/3x-ui), with its own identity, clean storage and no active advertising blocks. Complete upstream Git ancestry, authorship and GPL-3.0 are retained. **0.1 alpha** is a test release.

## The complete 3x-ui-based panel

The original inbound/outbound and client management, standard protocols,
subscriptions, routing/DNS, statistics, Xray settings, API, backups and node
management are retained. Changes are Connect Hub branding, no advertising or
sponsor blocks, isolated installation and the additional Sudoku protocol.
Sudoku is not required to use the panel's standard features.

## Windows installer

[Download Connect-Hub-Setup.exe](https://github.com/sanderstripa/connect-hub/releases/download/v0.1.0-alpha.14/Connect-Hub-Setup.exe) — a portable Windows 10/11 x64 wizard, offered alongside the Linux command below.

1. Enter your server IP/hostname, SSH port, username and password. Confirm the server key fingerprint. Use `root` or an account with `sudo` access.
2. Choose the panel address, optional BBR and additional swap. The wizard uses the same verified server installer and detects an existing Connect Hub installation for updating.
3. Copy the resulting panel URL, login and password, or open the URL/scan its QR code. **The QR contains only the address, without a login or password.**

SSH/sudo passwords are kept in memory for the session and are not written to files on Windows or the server. Installation continues on the server if SSH disconnects; reconnect to check progress. HTTPS certificate failures and unsupported optional tuning are shown explicitly. Other panels and their data are kept separate.

## Install with one command

On a **Linux amd64 / x86_64 systemd server**, run:

```bash
sh -c 'set -e; t=$(mktemp); trap '\''rm -f "$t"'\'' EXIT; u=https://raw.githubusercontent.com/sanderstripa/connect-hub/main/install.sh; if command -v curl >/dev/null 2>&1 && [ -s /etc/ssl/certs/ca-certificates.crt ]; then curl -fsSL "$u" -o "$t"; elif command -v wget >/dev/null 2>&1 && [ -s /etc/ssl/certs/ca-certificates.crt ]; then wget -qO "$t" "$u"; else s=; [ "$(id -u)" -eq 0 ] || s=sudo; $s apt-get update; $s apt-get install -y curl ca-certificates; curl -fsSL "$u" -o "$t"; fi; bash "$t"'
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

## A setup flow for your server

The copy/paste command uses an available `curl` or `wget`. When neither exists, it installs curl and CA certificates with apt, using root or sudo. The main installer detects Ubuntu/Debian and installs missing dependencies.

1. **Connect. Hub → language**: Russian or English, followed immediately by the real OS, CPU, RAM and disk summary.
2. **BBR**: inspect kernel support and current settings before offering an opt-in change. No replacement kernel or reboot. BBR affects system-wide TCP defaults; it is not a universal VPN or UDP accelerator.
3. **Swap**: show existing swap and offer an additional owned file with a selected size for small-memory servers. Keep the current setup by default. Existing swap stays intact; free-space and filesystem checks precede allocation, including Btrfs-specific handling.
4. **Panel address**: detected IP or a domain with HTTPS. Check DNS and the local validation port before issuance. Let’s Encrypt performs the final external reachability check. Failed domain setup offers retry or a return to IP, and automatic certificate renewal is configured.

Exactly two visual themes, **light and dark**, follow the CONNECT visual style. **Montserrat** is served locally, including Cyrillic and italics, throughout settings, tables, dialogs, links, logs and configuration editors. No Google Fonts request is needed in the browser.

Host tuning is applied only after explicit installer choices. Updating an existing panel does not repeat BBR/swap changes, and retains its database and device keys.

## Parallel installation and updates

The panel uses its own `/opt/connect-hub`, `/etc/connect-hub`, `/var/log/connect-hub`, account and service. Existing names/paths are refused. Optional swap uses `/var/lib/connect-hub-swap`; optional BBR writes its own `/etc/sysctl.d/90-connect-hub-bbr.conf` and affects system-wide TCP. Both require explicit installer choices. No foreign database, keys or certificates are imported; no firewall, DNS, routes or other services are changed. Internal Xray ports are independently allocated and subscription defaults are preserved with a separate free port. The service runs as root, as in upstream 3x-ui.

Stop only this panel: `sudo systemctl stop connect-hub`.

Update a managed installation:

```bash
curl -fsSL https://raw.githubusercontent.com/sanderstripa/connect-hub/main/install.sh | bash -s -- --update
```

Updates retain a complete data backup and restore the previous binary/data after a failed launch. Backups are never automatically deleted. Reinstalling an already installed revision is unnecessary. Web updates install only a checksum-verified Connect Hub release and cannot replace the fork with upstream binaries.

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

Based on 3x-ui by MHSanaei and contributors. Connect Hub modifications by Sander Stripa and contributors, 2026. Original Sudoku authorship/license notices and corresponding source are retained. No endorsement or warranty is implied. Validation uses isolated environments, never the user's live VPS or existing installations.

Management menu: `sudo connect-hub`. The upstream-derived management menu is restored with Connect Hub paths and service names. Certificate retry: `sudo bash /opt/connect-hub/current/hub/cert.sh`, then `sudo systemctl restart connect-hub`. Existing HTTP installations receive HTTPS during this update when no certificate is configured.

### Appearance

Settings → Appearance offers Classic Monochrome, Graphite & Sage, Obsidian & Champagne and Midnight & Steel, each in light/dark mode. The sidebar mode switch remains independent. Choices are stored in your browser; new browsers use Midnight & Steel; saved palette and mode choices are retained. [Theme implementation and checks](docs/palettes.md).
