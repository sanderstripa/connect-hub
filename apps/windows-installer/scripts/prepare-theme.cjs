const fs = require('node:fs');
const path = require('node:path');

async function prepareTheme() {
  const { themeTokens } = await import('../../../frontend/src/lib/theme-palettes.ts');
  const t = themeTokens();
  const css = `
    body[data-theme="light"] {
      --bg: ${t.bg};
      --card: ${t.surface};
      --input: ${t.input};
      --success: ${t.success};
      --text: ${t.text};
      --muted: ${t.secondary};
      --border: ${t.border};
      --control-border: ${t.controlBorder};
      --primary: ${t.button};
      --inverse: ${t.foreground};
      --primary-hover: ${t.buttonHover};
      --accent: ${t.accent};
    }
    header, aside { background: var(--card); }
    input, select { border-color: var(--control-border); }
    .primary {
      background: linear-gradient(180deg, #45464a, #252629 35%, #141517);
      font-weight: 500;
    }
    .primary:hover { background: var(--primary-hover); }
    input:focus, select:focus { border-color: var(--accent); }
  `;
  const dest = path.resolve(__dirname, '../assets');
  fs.mkdirSync(dest, { recursive: true });
  fs.writeFileSync(path.join(dest, 'theme.css'), css);
}

prepareTheme().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
