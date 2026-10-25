# Connect. Hub Windows setup wizard

Portable Windows x64 alternative to the existing Linux command. The panel still
runs on a Linux server; Windows only provides the SSH installation interface.
Use root or a sudo-capable account with password authentication.

The local interface uses bundled Montserrat and two themes, with RU/EN text.
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
