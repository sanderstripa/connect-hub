Connect Hub alpha 3 corrects the ordinary 3x-ui user path:

- Add Inbound -> Basic -> Protocol -> Sudoku, without a separate protocol tab.
- Sudoku and standard inbounds share the same list/search; device keys open from the inbound row.
- Readable terminal access summary with separate URL, username/password and certificate status.
- HTTPS setup using the same Let's Encrypt shortlived IP profile as upstream, isolated renewal storage/timer, domain support and explicit fallback warnings when validation is unavailable.
- Restored upstream-derived management menu (`sudo connect-hub`) scoped to Connect Hub.
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

Core/Mist retain their agreed experimental status. Sudoku TCP device keys/QR/config and revocation are supported; Sudoku UDP, subscriptions and unified traffic accounting remain outside this alpha. Existing 3x-ui history, GPL, copyright and corresponding-source notices are retained.
