// Read-only UI acceptance checks. Run against an isolated disposable panel.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium } from '../frontend/node_modules/playwright/index.mjs';
let raw='';for await(const chunk of process.stdin)raw+=chunk;
const cfg=JSON.parse(raw),browser=await chromium.launch({headless:true});
const english=JSON.parse(fs.readFileSync(new URL('../internal/web/translation/en-US.json',import.meta.url),'utf8'));
const russian=JSON.parse(fs.readFileSync(new URL('../internal/web/translation/ru-RU.json',import.meta.url),'utf8'));
const errors=[],dangerous=[],report=[];
const widths=[1920,1440,1280,1024,768,390];
function luminance(color){const rgb=color.match(/[\d.]+/g).slice(0,3).map(Number).map(v=>{if(!color.startsWith('color(srgb'))v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;});return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;}
function contrast(a,b){const x=luminance(a),y=luminance(b);return(Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
try {
 const context=await browser.newContext({locale:'en-US',viewport:{width:1440,height:1000}});
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));let logReads=0;
 page.on('request',request=>{if(/\/server\/logs\//.test(request.url()))logReads++;});
 await page.route(/\/panel\/api\/server\/(restartXrayService|stopXrayService|installXray|updatePanel|setUpdateChannel|importDB|updateGeofile|getDb|getMigration)/,route=>{dangerous.push(new URL(route.request().url()).pathname);return route.abort();});
 // The local Windows lab has no real Xray binary/config; mock only this read.
 await page.route('**/panel/api/server/getConfigJson',route=>route.fulfill({json:{success:true,obj:{}}}));
 async function theme(dark){await page.evaluate(value=>localStorage.setItem('dark-mode',String(value)),dark);await page.reload();await page.waitForTimeout(250);}
 async function shot(name){await page.screenshot({path:cfg.output+'/ui-'+name+'.png',fullPage:true});}
 await page.goto(cfg.url);await page.locator('.login-card').waitFor();
 for(const dark of [false,true]){
  await theme(dark);await page.locator('.login-card').waitFor();
  for(const width of widths){
   await page.setViewportSize({width,height:1000});
   const sizes=await page.locator('.login-toolbar button').evaluateAll(buttons=>buttons.map(el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return {w:r.width,h:r.height,radius:s.borderRadius};}));
   assert.equal(sizes.length,2);assert.ok(sizes.every(x=>x.w===40&&x.h===40&&x.radius==='50%'),JSON.stringify(sizes));
   const card=await page.locator('.login-card').boundingBox();assert.ok(card.x>=0&&card.x+card.width<=width);
   assert.equal(await page.locator('.welcome').count(),0);
  }
  await page.waitForTimeout(2500);assert.equal(await page.locator('.welcome').count(),0);
  await shot('login-'+(dark?'dark':'light'));
 }
 await page.setViewportSize({width:1440,height:1000});
 await page.locator('.login-toolbar button').nth(1).click();await page.getByRole('menuitem',{name:/Русский/}).click();await page.locator('label').filter({hasText:russian.username}).waitFor();
 await page.locator('.login-toolbar button').nth(1).click();await page.getByRole('menuitem',{name:/English/}).click();await page.locator('label').filter({hasText:english.username}).waitFor();
 await page.locator('input[autocomplete=username]').fill(cfg.user);
 await page.locator('input[autocomplete=current-password]').fill(cfg.password);
 await page.locator('.ant-input-password-icon').click();assert.equal(await page.locator('input[autocomplete=current-password]').getAttribute('type'),'text');await page.locator('.ant-input-password-icon').click();
 await page.locator('button[type=submit]').click();await page.waitForURL('**/panel/');
 await page.evaluate(()=>localStorage.setItem('sidebar-pinned','true'));await page.reload();
 for(const [language,strings] of [['en-US',english],['ru-RU',russian]]){
  await context.addCookies([{name:'lang',value:language,url:cfg.url}]);
  for(const dark of [false,true]){
   await page.goto(cfg.url+'panel/');await theme(dark);const m=strings.menu,i=strings.pages.index;
   await page.locator('.ov-bar-actions').waitFor();
   assert.equal(await page.locator('.sidebar-command-kbd').count(),0);
   for(const name of [i.restartXray,i.stopXray,i.logs])assert.ok(await page.getByRole('button',{name,exact:true}).isVisible());
   const more=page.getByRole('button',{name:i.more,exact:true});
   await more.click();await page.getByText(i.maintenance,{exact:true}).waitFor({state:'visible'});await page.getByText(i.diagnostics,{exact:true}).waitFor({state:'visible'});
   await page.waitForTimeout(350);const menuBox=await page.locator('.ant-dropdown:visible').boundingBox();assert.ok(menuBox.x>=0&&menuBox.x+menuBox.width<=1440&&menuBox.y>=0&&menuBox.y+menuBox.height<=1000);await shot(language+'-more-'+dark);await page.keyboard.press('Escape');assert.equal(await more.getAttribute('aria-expanded'),'false');
   await more.focus();await page.keyboard.press('Enter');await page.getByText(i.maintenance,{exact:true}).waitFor({state:'visible'});await page.locator('.ov-state').click({position:{x:4,y:4}});await page.waitForFunction(()=>document.querySelector('.ov-bar-actions .ant-dropdown-trigger')?.getAttribute('aria-expanded')==='false');
   for(const label of [i.config,i.backupTitle,i.systemHistoryTitle,i.xrayMetricsTitle]){
    await more.click();await page.locator('.ant-dropdown:visible').getByRole('menuitem',{name:label,exact:false}).click();const modal=page.getByRole('dialog').last();await modal.waitFor();await modal.locator('.ant-modal-close').click();await modal.waitFor({state:'hidden'});
   }
   await page.getByRole('button',{name:i.logs,exact:true}).click();const logs=page.getByRole('dialog');await logs.waitFor();
   await logs.locator('.ant-select').nth(1).click();const selected=page.locator('.ant-select-dropdown:visible .ant-select-item-option-selected');await selected.waitFor();
   await page.waitForTimeout(350);
   const colors=await selected.evaluate(el=>{const s=getComputedStyle(el);return {fg:s.color,bg:s.backgroundColor};});const ratio=contrast(colors.fg,colors.bg);assert.ok(ratio>=4.5,'Log select contrast '+ratio+' '+JSON.stringify(colors));
   await shot(language+'-logs-'+dark);await page.keyboard.press('Escape');
   for(const label of [i.logLevelDebug,i.logLevelInfo,i.logLevelNotice,i.logLevelWarning,i.logLevelError]){await logs.locator('.ant-select').nth(1).click();await page.locator('.ant-select-dropdown:visible').getByText(label,{exact:true}).click();assert.ok((await logs.locator('.ant-select').nth(1).innerText()).includes(label));}
   const download=page.waitForEvent('download');await logs.getByRole('button',{name:strings.download,exact:true}).click();assert.equal((await download).suggestedFilename(),'x-ui.log');
   if(language==='en-US'&&!dark){await logs.getByRole('checkbox',{name:i.autoUpdate,exact:true}).check();const before=logReads;await page.waitForTimeout(5300);assert.ok(logReads>before);await logs.getByRole('checkbox',{name:i.autoUpdate,exact:true}).uncheck();}
   await logs.locator('.ant-modal-close').click();
   await page.locator('.ov-panel-version,.ov-update-tag').click();const update=page.getByRole('dialog');await update.waitFor();assert.equal(await update.getByRole('switch').count(),0);await shot(language+'-update-'+dark);await update.locator('.ant-modal-close').click();
   for(const [route,parent,label] of [['clients',null,m.clients],['nodes',m.infrastructure,m.nodes],['hosts',m.infrastructure,m.hosts],['outbound',m.network,m.outbounds],['routing',m.network,m.routing]]){
    await page.goto(cfg.url+'panel/'+route);const item=page.locator('.sider-nav').getByRole('menuitem',{name:label,exact:false}).last();await item.waitFor({state:'visible'});assert.ok(await item.evaluate(el=>el.classList.contains('ant-menu-item-selected')));
    if(!parent)continue;const title=page.locator('.sider-nav .ant-menu-submenu-title').filter({hasText:parent}).first();const disclosure=parent===m.clients?title.locator('.ant-menu-submenu-arrow'):title;await disclosure.click();await page.waitForTimeout(200);assert.equal(await title.getAttribute('aria-expanded'),'false');await disclosure.click();await page.reload();await item.waitFor({state:'visible'});
   }
   await shot(language+'-navigation-'+dark);
   await page.goto(cfg.url+'panel/groups');await page.waitForURL('**/panel/clients');await page.goto(cfg.url+'panel/nodes');await page.goBack();await page.waitForURL('**/panel/clients');await page.locator('.sider-nav .ant-menu-item-selected').filter({hasText:m.clients}).waitFor();await page.goForward();await page.waitForURL('**/panel/nodes');await page.locator('.sider-nav .ant-menu-item-selected').filter({hasText:m.nodes}).waitFor();
   await page.keyboard.press('Control+k');await page.locator('.command-palette-modal').waitFor({state:'visible'});await page.keyboard.press('Escape');
   await page.goto(cfg.url+'panel/');for(const width of widths){await page.setViewportSize({width,height:1000});await more.waitFor({state:'visible'});const r=await more.boundingBox();assert.ok(r.x>=0&&r.x+r.width<=width);await more.click();await page.getByText(i.maintenance,{exact:true}).waitFor({state:'visible'});await page.keyboard.press('Escape');}
   await page.getByRole('button',{name:m.openMenu,exact:true}).click();const drawer=page.getByRole('dialog');await drawer.waitFor();await shot(language+'-mobile-open-'+dark);await drawer.locator('.ant-menu-submenu-title').filter({hasText:m.infrastructure}).click();await drawer.getByRole('menuitem',{name:m.nodes,exact:false}).waitFor({state:'visible'});await shot(language+'-mobile-menu-'+dark);await drawer.getByRole('button',{name:strings.close,exact:true}).click();
   await page.setViewportSize({width:1440,height:1000});await shot(language+'-dashboard-'+dark);
   report.push({language,dark,loginWidths:widths,toolbarWidths:widths,logSelectContrast:ratio,navigation:true,dialogs:true});
  }
 }
 assert.deepEqual(dangerous,[]);assert.deepEqual(errors,[]);
 fs.writeFileSync(cfg.output+'/ui-refinement-report.json',JSON.stringify({checks:report,dangerousRequests:dangerous,consoleErrors:errors},null,2));
 console.log('PASS: read-only UI acceptance, six widths, RU/EN, both themes, grouped navigation, original dialogs, log contrast, search and no server mutations');
} finally {await browser.close();}
