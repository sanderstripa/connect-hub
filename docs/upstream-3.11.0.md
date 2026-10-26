# 3x-ui v3.11.0 integration — Connect Hub alpha.12

The upstream tag and its complete ancestry are merged, rather than copying files or resetting Connect Hub. `hub/upstream.json` records the exact revision.

Included: WireGuard config validation and trusted-proxy security fixes; random first-user credentials; host bindings, SNI pools and CIDR expansion; TLS share-link improvements; Telegram screens/search/topic notifications; subscription caching, indexed lookups and pooled Xray gRPC; quota reset recovery, node-sync/TUIC fixes; optional AmneziaWG kernel mode and keepalive ranges; monitoring and Docker fixes.

Connect Hub retains its checksum-pinned Xray v26.10.21, managed Sudoku in the shared protocol picker, Sudoku client keys, separate installation/service/data paths, installer/update overrides, branding, Montserrat and two themes. Flat Clients navigation and group data preservation remain. Upstream's route manifest is adapted to these requirements; sponsorship routes are excluded. The newly introduced Slovak locale includes Connect Hub-specific labels.

Merge resolutions combine upstream client host-rule/keepalive fields with Sudoku keys, and keep upstream TUIC reconciliation without sending Sudoku operations to Xray's user API.

Validation uses temporary local databases and disposable GitHub Linux runners. Local model/runtime/service, controller/middleware/database, subscription, Sudoku, AmneziaWG and TUIC tests pass; typecheck/lint and production build pass. Browser acceptance covers both themes, three widths, client CRUD/toggle and stored group preservation. The release workflow additionally gates publication on the full frontend suite, Linux backend tests, installation/rollback, native Sudoku traffic, shared form browser checks and ordinary web update transitions.

No owner's VPS or running service is used. Kernel AmneziaWG remains opt-in; no module is automatically installed by this panel update. Tests do not establish performance or kernel compatibility on every VPS. Windows installer is unsigned. The public release and checksum/build-revision verification are the publication evidence; a merged PR alone is not a released update.

Public CI explicitly disables only the optional live Connect Core check because its separate source repository is private. Its disabled-by-default status remains checked; real Sudoku traffic tests still run. The default manual test setting retains the Core check for environments with access.
