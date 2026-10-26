# Midnight & Steel default — alpha.14

Midnight & Steel is now the fallback/default palette for a fresh browser, the login screen, first panel setup and the Windows server installer. Existing explicit palette/mode values remain honored; all four choices remain available in Settings → Appearance. Light/dark mode remains independent.

Light colored primary buttons use white Montserrat labels at weight 600. Their fill/hover colors are derived slightly darker where necessary to keep at least 4.5:1 text contrast. The specified base accent colors used by charts, selectors and other controls are unchanged. Dark palettes retain readable contrasting labels.

Windows `prepare-theme.cjs` generates its CSS directly from the same `themeTokens(DEFAULT_PALETTE, mode)` definitions as the web panel. The executable includes this stylesheet; its initial native window background also matches Midnight Dark. No SSH/install behavior or credential handling is changed.

Checks cover the new fallback, primary/hover contrast in all palettes, actual Windows wizard appearance and SSH-fixture flow, frontend tests/build, and browser checks of the public package. The public eight-variant report additionally checks white/semibold light primary buttons and the fresh-browser Midnight first paint before the main bundle.

Changed areas: shared palette tokens/provider/bootstrap, primary-button CSS, Windows generated theme/build resources/window background, focused tests/browser acceptance, version/README/release notices. No protocol, API, authentication, server state or table geometry changes.
