Connect Hub 0.9.2 — More connection and subscription controls

- Manage multiple WireGuard devices per client and export per-device configs, QR codes and subscription URLs.
- Import AmneziaWG outbounds from supported VPN profiles and subscriptions. Configure a separate XHTTP download endpoint.
- Append external links in bulk, view per-client live traffic from remote nodes, and warn about missing Dialer Proxy outbounds.
- Switch QR formats on the subscription page and optionally return an explanatory config when HWID access is rejected.
- Configure public IP refresh and IPv4/IPv6 overrides. Choose a custom or random web base path from the server menu.
- Enable MCP from Settings → Security → API Token. The MCP endpoint is off by default and retains the panel’s admin-token requirements.

Update from v0.9.1 with the existing in-place updater.

Connect Hub 0.9.1 — Key creation compatibility and navigation

- Create device keys from the Windows app with an optional device name and automatically choose a free port when no port is specified. Show failed operations next to the create button.
- Use the browser's secure random bytes to generate key UUIDs when its native UUID API is unavailable.
- Move Groups under Network and Logs and AI Assistant under Settings.
- Add a dedicated Appearance entry under Settings for color mode, palettes, accent colors, and the glass effect. Appearance preferences are stored in the browser.

Upgrade from v0.9.0 using the existing in-place update flow.

Connect Hub 0.9.0 — Upstream integrations and compatibility

In-place upgrade from 0.8.9. The existing Windows installer, native Sudoku, WatTunnel, Clean IP, DNS tunnels, REALITY Watch, Xray configuration, subscriptions, clients, access keys and deployment methods remain supported.

Changes:
- Integrated newer 3x-ui functionality alongside Connect Hub-specific capabilities.
- Added Chain Proxy / Chain Selector and VK TURN bindings; retained pre-existing client/node data contracts.
- Maintained both batched and legacy per-metric dashboard history APIs.
- Preserved the existing AmneziaWG forwarded-port storage format and restored per-peer forwarding compatibility.
- Preserved translations in 14 locales while adding missing source keys.
- Reconciled Telegram menus, client usage, subscription export, and HTML escaping.
- Added regression coverage for existing features and changes.

Upgrade: Back up the database, configuration files, private keys and certificates. Update the existing installation in place, without uninstalling or deleting data. Rollback requires restoring v0.8.9 together with its matching pre-upgrade database backup; later schemas may not be readable by an older binary.

Previous release details preserved below.

Connect Hub 0.8.9 — 11 Integrated Upstream Feature Families

All enhancements are additive to v0.8.8. Existing panel data, Windows desktop client, bundled native Sudoku, WatTunnel, DNS tunnels, Clean IP, REALITY Watch, logs, connections, credentials, subscriptions, themes, and deployment methods are preserved.

1. Telegram administration: client plan templates, create/renew/extend workflows with explicit confirmation, client configuration sharing (one link, QR, exports) and setup guides.
2. WeCom and external webhook notifications: configuration and test actions under Settings, with server-side delivery.
3. Client lifetime history: traffic usage windows, per-node statistics, change events and client card history viewer.
4. Group host rules: manage client groups and bind their Hosts rule groups; supported by subscriptions and Clash outputs.
5. ISP-side REALITY Finder: scan target candidates on a client device, collect short-lived reports securely and offer eligible candidates in the REALITY configuration.
6. Remote node administration: explicitly triggered Xray and panel restart actions with server-side authorization.
7. Selectable network traffic source: legacy, automatic/default-route and manual interface modes, with persisted settings and status.
8. Adaptive client interface: scroll body fits available viewport, persistent column visibility and mobile-friendly filters.
9. Subscription enhancements: configurable inbound traffic placeholders, host order and additional client User-Agent formats, including Rabbit-Hole.
10. AmneziaWG and TUIC enhancements: optional peer IPv4 echo policy, SNI and peer synchronization and transport refinements.
11. Integrated AI assistant: opt-in, advice-only chat with an OpenAI-compatible HTTPS API; configurable on the server without exposing API secrets in the browser.

AI setup (optional): set CONNECT_HUB_AI_API_KEY in the panel server's service environment. Optionally configure CONNECT_HUB_AI_MODEL (default gpt-4.1-mini) and CONNECT_HUB_AI_URL (default https://api.openai.com/v1/chat/completions). Messages are sent to that external provider only when submitted, so do not include passwords, secrets or private identifiers.

Upgrade notes: back up the database, configuration and certificates before updating a production deployment. Reuse the existing installation to retain profiles, nodes, tunnels and access keys. Apply the installer and server updates using the documented in-place upgrade procedures. Rollback: restore the previous v0.8.8 binary and the matching pre-upgrade database backup. Some newly added tables and settings are not understood by older releases.
