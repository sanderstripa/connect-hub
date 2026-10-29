const fs=require('node:fs'),path=require('node:path');
(async()=>{
 const {themeTokens,DEFAULT_PALETTE}=await import('../../../frontend/src/lib/theme-palettes.ts');
 const rule=(dark)=>{const t=themeTokens(DEFAULT_PALETTE,dark);return `${dark?'body':'body[data-theme=light]'}{--bg:${t.bg};--card:${t.surface};--input:${t.input};--success:${t.success};--text:${t.text};--muted:${t.secondary};--border:${t.border};--control-border:${t.controlBorder};--primary:${t.button};--inverse:${t.foreground};--primary-hover:${t.buttonHover};--accent:${t.accent}}`;};
 const css=rule(true)+rule(false)+'header,aside{background:var(--card)}input,select{border-color:var(--control-border)}.primary{font-weight:500}.primary:hover{background:var(--primary-hover)}input:focus,select:focus{border-color:var(--accent)}';
 const dest=path.resolve(__dirname,'../assets');fs.mkdirSync(dest,{recursive:true});fs.writeFileSync(path.join(dest,'theme.css'),css);
})().catch(error=>{console.error(error);process.exitCode=1;});
