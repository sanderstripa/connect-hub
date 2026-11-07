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
