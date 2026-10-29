# Connect. Hub Windows setup wizard

Portable Windows x64 alternative to the existing Linux command. The panel still
runs on a Linux server; Windows only provides the SSH installation interface.
Use root or a sudo-capable account with password authentication.

The local interface uses bundled Onest and two themes, with RU/EN text.
SSH server fingerprints require confirmation. Passwords are held in memory,
never added to remote commands, logs or Windows configuration files. A detached,
root-owned server job preserves progress across a lost SSH connection. Its access
result is private to root. The QR and browser button use only the panel URL.

Build on Windows with the repository's Node version:

```sh
npm ci --ignore-scripts --omit=optional
node node_modules/electron/install.js
npm run prepare-assets
npm test
npm run build
```

Output: `dist/windows-installer/Connect-Hub-Setup.exe` at the repository root.
Set `TEMP`, `TMP`, `ELECTRON_CACHE` and `ELECTRON_BUILDER_CACHE` to your build
workspace when caches must stay on a specific disk. No signing certificate is
included; official builds currently produce an unsigned executable.

`test/ui-smoke.cjs` exercises the actual Windows renderer and encrypted SSH
against a loopback test server. It also accepts the packaged executable path.
`test/portable-smoke.cjs` launches the actual portable EXE and checks its local
window and embedded build revision. Clipboard/browser side effects are stubbed
in GUI tests. `test/linux-install-smoke.cjs` is restricted to root on a fresh
GitHub-hosted Linux VM and performs a real detached installation, reconnection,
HTTPS login, device traffic and update through the production backend.

GPL-3.0-only. Project authorship and modifications are retained in `NOTICE`.
Packaged assets include GPL/OFL and dependency license texts; Electron's own
license and Chromium notices are distributed with its runtime.

## Desktop connection manager (0.2 alpha)

After installing the panel, choose **Set up VPN connections**. Select one or
several presets, enter a device name and public server address, and create:

- VLESS TCP + Reality + Vision
- VLESS XHTTP + Reality
- Native Sudoku (ChaCha20-Poly1305)
- MTProto FakeTLS for Telegram
- Shadowsocks ChaCha20-IETF-Poly1305

Each preset creates an ordinary panel inbound and client through the existing
CSRF-protected API. The server generates Sudoku device keys. No separate key
registry or direct database edits are used. Creation does not modify firewall,
swap or TCP settings. The first selected port and consecutive following ports
must be allowed by the server/provider firewall (TCP; Shadowsocks also UDP).
The Reality/FakeTLS domain must be reachable and support TLS 1.3.

The result list supports copying a link, showing/saving a QR PNG, and saving all
supported active keys to a text file. These exports contain private access keys.
If some presets fail, successful ones stay saved; retry only the failed choices.
A saved configuration is not an end-to-end reachability guarantee: test it in a
compatible client and inspect panel engine logs if needed.

On subsequent launches, the last SSH endpoint and username are prefilled.
Enter your SSH password again; installed servers open the connection list
immediately. Passwords, session cookies and keys are never persisted locally
unless you explicitly export keys or QR images. If you changed the panel
credentials, enter the current credentials under **Changed the panel login?**.
Panel access details and updates remain available from the connection list.

Existing configurations outside the supported export shapes (including remote
nodes and fallback children) remain visible and direct users to the web panel
for their authoritative export. No unsupported protocol is silently rewritten.

Validation:

```sh
npm test
node test/ui-smoke.cjs
python3 test/panel-api-smoke.py /path/to/connect-hub-linux-amd64.tar.gz
```

The last command installs and starts an isolated panel in a temporary directory
with `--no-service`, checks actual login/CSRF, all five inbound APIs, generated
Sudoku keys, native listening sockets, reconnect and busy-port refusal. It does
not test external networks or client-side handshakes. Windows portable EXE
execution must additionally be tested on Windows with `test/portable-smoke.cjs`.

## Soulu redesign and advanced editor (0.3 alpha)

Both panel and desktop app now use locally bundled Onest 400/500/600, neutral
light/dark surfaces, blue actions and green connection states. Saved legacy
palette choices migrate to Soulu without resetting the selected light/dark mode.

Enable Advanced settings when creating connections, or choose Edit on an
existing connection. The editor provides Basic, Protocol, Transport, Security,
Sniffing and Advanced template sections. It includes XHTTP padding, placements,
headers, XMUX, Sockopt, final masks and QUIC JSON; Reality/TLS, native X25519,
ML-KEM encryption and ML-DSA key generation. TLS certificate paths refer to files
on the server. Changes are applied through the authenticated panel API; original
client keys and unedited fields are retained. Explicit key generation or raw
JSON changes can intentionally replace key material. Raw templates replace their
respective section and must keep existing client credentials to preserve access.

## Remove the server panel

Connect over SSH, open **Panel management**, then **Remove Connect Hub from server**. The native confirmation names the server and defaults to Cancel. Removal deletes the default managed panel installation, its connections, keys, bundled certificates and installer job credentials. Export a database backup in the web panel first if you need recovery. BBR, swap, external databases and unrelated services are retained. Custom paths, foreign units and active setup jobs are refused. Reconnect after removal to install again.
