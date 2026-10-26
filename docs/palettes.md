# Connect Hub palette system — alpha.13

## Architecture

The existing ThemeProvider remains the only state owner. Palette and light/dark mode are independent; localStorage keys are `connect-hub-palette` and the existing `dark-mode`. Invalid/missing palette falls back to Classic. No server preference API is introduced. Switching palette does not submit the Settings form.

`theme-palettes.ts` is the single source for the exact supplied base HEX colors, derived readable secondary/control colors, independent semantic states, CSS variables and Ant Design tokens. Vite generates the initial CSS from that same source. A content-addressed synchronous same-origin script sets root attributes before the main bundle, working with existing CSP and random panel paths. No unsafe-inline script policy is added.

Classic keeps its prior colors and chart strokes. New palettes retain the approved geometry and font. Their primary button text is chosen for contrast, independent of the decorative accent. Small selected labels use readable primary text; destructive controls and tooltips have separate foreground rules. New palette secondary text targets 4.5:1 on page/card/raised surfaces, control edges 3:1, primary/hover button text 4.5:1. Disabled components retain normal disabled presentation.

Canvas charts consume the same provider and redraw existing plots on palette/mode changes. Histories, refresh periods, series values and calculations are untouched. Secondary/third series, grids and overlays remain distinguishable. Old literal colors in retained Classic/editor code are superseded only for the new palette selectors where needed.

## Available variants

- Classic Monochrome — light and dark (migration default).
- Graphite & Sage — light and dark.
- Obsidian & Champagne — light and dark.
- Midnight & Steel — light and dark.

## Verification and screenshots

Unit/component tests cover complete tokens, contrast, migration fallback, independent controls, local persistence and existing Classic behavior. The full frontend suite, typecheck, lint and production build gate release.

`hub/palettes-browser.mjs` checks all eight variants against an actual native panel: Dashboard, Inbounds, Clients, Appearance, inbound form, dropdown, search, login and 390 px layout; remaining infrastructure/network/Xray/API pages are also swept. It checks palette and mode persistence after reload and reopening, the same chart canvas across mode changes, no theme-triggered server writes, unchanged compact inbound rows, and preserved group bindings in disposable fixture records. The early HTML paint is checked with the main JS bundle intentionally blocked while the same-origin bootstrap is allowed.

After publication, the workflow downloads and checksum-verifies the public archive, launches that exact executable in temporary state, runs the eight-variant browser checks and attaches `palette-screenshots.zip` (including offline `index.html`) and `palettes-report.json` to the release. The public run/report is the final evidence, not just a local build or PR.

All test databases/records are isolated. No user's VPS, installed database, Xray configuration, protocol, network setting, permission or authentication logic is changed. Core and Mist are outside this task. Palette persistence is browser-local, not synced between devices.

## Changed files

- `AGENTS.md`
- `NOTICE`
- `README.en.md`
- `README.md`
- `README.ru.md`
- `apps/windows-installer/package-lock.json`
- `apps/windows-installer/package.json`
- `frontend/src/components/viz/Sparkline.tsx`
- `frontend/src/hooks/useTheme.tsx`
- `frontend/src/layouts/AppSidebar.tsx`
- `frontend/src/lib/theme-palettes.ts`
- `frontend/src/pages/settings/AppearanceTab.tsx`
- `frontend/src/pages/settings/SettingsPage.tsx`
- `frontend/src/styles/connect-brand.css`
- `frontend/src/styles/palettes.css`
- `frontend/src/test/appearance.test.tsx`
- `frontend/src/test/palettes.test.ts`
- `frontend/vite.config.js`
- `hub/RELEASE.md`
- `hub/palettes-browser.mjs`
- `hub/palettes-gallery.mjs`
- `hub/palettes-smoke.py`
- `internal/config/version`
- `internal/web/translation/ar-EG.json`
- `internal/web/translation/en-US.json`
- `internal/web/translation/es-ES.json`
- `internal/web/translation/fa-IR.json`
- `internal/web/translation/id-ID.json`
- `internal/web/translation/ja-JP.json`
- `internal/web/translation/pt-BR.json`
- `internal/web/translation/ru-RU.json`
- `internal/web/translation/sk-SK.json`
- `internal/web/translation/tr-TR.json`
- `internal/web/translation/uk-UA.json`
- `internal/web/translation/vi-VN.json`
- `internal/web/translation/zh-CN.json`
- `internal/web/translation/zh-TW.json`
- `docs/palettes.md`
