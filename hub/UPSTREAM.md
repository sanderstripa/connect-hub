# Upstream maintenance

Connect Hub preserves the complete 3x-ui Git ancestry. `hub/upstream.json` records
the exact reviewed baseline. The Go module path stays upstream-compatible to
avoid unnecessary import churn. Original notices and GPL-3.0 remain intact.

The implementation branch contains the upstream snapshot plus a commit moving its
automation to `.github/upstream-workflows/*.disabled`. This prevents inherited
release/deployment/Claude jobs from publishing unexpected upstream artifacts.
Connect Hub has its own CI with read-only repository permissions and build
artifacts; it does not publish releases or merge PRs automatically.

Run `bash hub/check-upstream.sh` for a read-only upstream log/diff. Create a
review branch from Connect Hub, then merge the reviewed upstream revision with
`git merge --no-commit <revision>`. Resolve conflicts explicitly, especially in
configuration identity, storage, update URLs, branding, license notices,
installers, integrations and workflows. Never use reset/force-push or a scripted
global overwrite to absorb upstream changes.

Run baseline and fork tests, frontend typecheck/lint/build, race tests for the
integration boundary, native packaging and isolated installation/API/Xray/update
smoke tests. Review schema migrations against a disposable copy of test data.
Update `hub/upstream.json` and NOTICE only after accepting the merge. Use a PR;
release a tested Connect Hub package independently. Source at the exact build
revision must remain available with distributed GPL binaries.

Updates retain full backups without automatic retention deletion. The web
self-updater is intentionally blocked until an authenticated release-update
flow has been implemented and validated; it can never download upstream 3x-ui.
