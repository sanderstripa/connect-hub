// Render the exact repository SVG at the Windows ICO maximum size.
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path');
(async()=>{const root=path.resolve(__dirname,'../../..'),browser=await chromium.launch({headless:true});try{const page=await browser.newPage({viewport:{width:256,height:256},deviceScaleFactor:1});const svg=fs.readFileSync(path.join(root,'frontend/public/icons/connect-hub.svg'),'utf8');await page.setContent('<style>html,body{margin:0;width:256px;height:256px;background:transparent}svg{width:256px;height:256px;display:block}</style>'+svg);await page.screenshot({path:path.join(__dirname,'../assets/icon256.png'),omitBackground:true});}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
