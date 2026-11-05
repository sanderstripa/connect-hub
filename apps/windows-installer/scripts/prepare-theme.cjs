const fs=require('node:fs'),path=require('node:path');
(async()=>{
 const {themeTokens,PALETTE_IDS,PALETTE_NAMES,DEFAULT_PALETTE}=await import('../../../frontend/src/lib/theme-palettes.ts');
 const rule=(id,dark)=>{const t=themeTokens(id,dark);return `body[data-palette="${id}"][data-theme="${dark?'dark':'light'}"]{--bg:${t.bg};--card:${t.surface};--input:${t.input};--success:${t.success};--text:${t.text};--muted:${t.secondary};--border:${t.border};--control-border:${t.controlBorder};--primary:${t.button};--inverse:${t.foreground};--primary-hover:${t.buttonHover};--accent:${t.accent}}`;};
 const css=PALETTE_IDS.flatMap(id=>[rule(id,true),rule(id,false)]).join('\n')+'header,aside{background:var(--card)}input,select{border-color:var(--control-border)}.primary{font-weight:500}.primary:hover{background:var(--primary-hover)}input:focus,select:focus{border-color:var(--accent)}';
 const dest=path.resolve(__dirname,'../assets');fs.mkdirSync(dest,{recursive:true});fs.writeFileSync(path.join(dest,'theme.css'),css);fs.writeFileSync(path.join(dest,'palettes.js'),`window.CONNECT_PALETTES=${JSON.stringify({ids:PALETTE_IDS,names:PALETTE_NAMES,default:DEFAULT_PALETTE})};`);
})().catch(error=>{console.error(error);process.exitCode=1;});
