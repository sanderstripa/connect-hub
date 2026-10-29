# Connect Hub requirements

Latest user changes, 25 October 2026:
- Unify dimensions and spacing throughout the entire panel, not only Inbounds/Clients.
- Group API documentation under Settings; shorten the Settings menu label in RU/EN.
- Hide the Connect. Hub sidebar entry for now, preserving its route and functionality.
- Provide an alternative downloadable Windows EXE for guided SSH installation.
  Retain the Linux command. Show final URL/login/password; QR contains the URL only.
- Keep SSH/sudo passwords in session memory; never put them in commands or files.
  Validate real installation in isolated hosted infrastructure and the actual packaged EXE.

Current user authorization, 25 October 2026, supersedes earlier visual/installer restrictions:
- Montserrat everywhere in the product, including code/log/QR dialogs and subscription pages.
- Exactly two themes, light and dark, with the supplied CONNECT screenshots as visual references.
- Connect. Hub wordmark, a new monochrome icon, English repository presentation and About text.
- Own bilingual installer: initial hardware summary, opt-in supported BBR and sized swap,
  IP/domain address choice, DNS/certificate checks, automatic renewal and return to IP on failure.
- BBR and swap changes are authorized only when explicitly selected in the installer.
  Preserve existing swap, other panels and services. Never tune the real host/VPS during development.
- The one-copy bootstrap must work on Ubuntu/Debian without a preinstalled curl, handling root/sudo.
- Preserve all existing panel capabilities, native Sudoku, keys/data and safe updates.

User requirements restated explicitly on 2026-10-24:

- Connect Hub is the complete 3x-ui fork, not a separate Sudoku panel or redesign.
- Preserve upstream installation flow, every feature/capability, existing icons,
  controls, rendering and layout. Do not invent alternative workflows or extra
  protocol-specific top-level tabs.
- Allowed product changes: Connect Hub name/branding; removal of advertising,
  sponsorship and optional upstream promotional attribution; Sudoku integrated
  into the existing Basic -> Protocol selector and shared inbound list.
- Keep legally mandatory copyright, modification, corresponding-source and GPL
  notices. Preserve upstream ancestry and review/test upstream merges.
- Preserve the explicitly requested clean parallel installation. Never import
  personal running installations or alter unrelated services/VPS/firewall/DNS.
- Core/Mist are accepted experimental integrations, disabled by default; do not
  invent production capabilities for them.
- Match the ordinary 3x-ui one-command installation experience, certificate setup,
  and readable terminal access summary. Explain real certificate issuance failures.
- All project work, generated files, build/cache/temp paths belong on E: only.
- Continue authorized work through progress updates and user clarifications.
  Only the user's explicit instruction "остановись" requests stopping.
- Report verified results. Do not call partial parity or merely passing internal
  tests a completed product. Validate the actual published installation path.

Latest user specification, 26 October 2026: four palettes (Classic Monochrome, Graphite & Sage, Obsidian & Champagne, Midnight & Steel), each with light/dark mode. Keep Classic as the migration default and retain saved mode, geometry, data and backend behavior. Palette choice is local to the browser.

Latest user instruction: Midnight & Steel is the default everywhere, including first launch and the Windows panel installer. Light colored primary buttons have white semibold labels with readable contrast.

Current specification, 29 October 2026: replace previous palettes and Montserrat with Soulu design: Onest 400/500/600, neutral white/graphite surfaces, #0671FF actions, #087F5B/#57D6A3 connection state. Migrate saved palettes to Soulu while retaining light/dark mode and all data. Extend the Windows app with structured advanced connection creation/editing for Basic, Protocol, Transport, Security, Sniffing and raw advanced settings. Preserve keys and fields on edits. User authorizes updating and releasing both panel and installer.

Latest user request: add server panel removal to the Windows app, with explicit confirmation and preservation of unrelated services and opt-in host tuning.
