Connect Hub alpha 6 restores the ordinary 3x-ui inbound and client workflow:

- Add Inbound -> Basic -> Protocol -> Sudoku, without a separate protocol tab.
- Sudoku and standard inbounds share the original list/search, inbound form and Clients page. Device keys use the standard QR/link controls.
- Sudoku identities, client keys and traffic are stored in the ordinary SQL database; database-only restore preserves access and revocation.
- Exact registered-key whitelists reject unknown derived keys. Real compatible clients verify TCP and UDP-over-TCP traffic and revoked-device rejection.
- Earlier Connect Hub alpha records migrate before the HTTP listener opens, preserving device keys; failed migration triggers update rollback.
- Readable terminal access summary with separate URL, username/password and certificate status.
- HTTPS setup using the same Let's Encrypt shortlived IP profile as upstream, isolated renewal storage/timer, domain support and explicit fallback warnings when validation is unavailable.
- Restored upstream-derived management menu (`sudo connect-hub`) scoped to Connect Hub.
- Original CLI update confirmation and full certificate menu, selected certificate paths and optional PostgreSQL selection are preserved.
- Docker retains its own TLS/ACME volumes and renewal schedule, original IP-limit jail in its own network namespace, and normal management command.
- Updates retain administrator-added engine assets while taking bundled files from the checksum-verified new release.
- Existing installations retain their data during update.

Установка / Installation (Linux amd64, systemd):

```bash
curl -fsSL https://raw.githubusercontent.com/sanderstripa/connect-hub/main/install.sh | bash
```

Обновление / Update:

```bash
curl -fsSL https://raw.githubusercontent.com/sanderstripa/connect-hub/main/install.sh | bash -s -- --update
```

For a publicly trusted certificate, external TCP port 80 must reach this server and be free. Other services are never stopped for validation. A temporary self-signed certificate is identified explicitly and produces a browser warning until trusted issuance succeeds. Test runners verify local HTTPS using an explicitly trusted test certificate; issuance against the public Let's Encrypt service requires the actual server's network conditions and is not claimed as tested on a real VPS.

Core/Mist retain their agreed experimental status. Existing 3x-ui history, GPL, copyright and corresponding-source notices are retained. The published package targets Linux amd64 with systemd; ARM64 and other init systems have not received the same installation validation.

