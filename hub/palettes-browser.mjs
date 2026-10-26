// Read-only visual acceptance against an isolated panel, also used after release.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from '../frontend/node_modules/playwright/index.mjs';
import {PALETTE_IDS,PALETTE_NAMES,themeTokens} from '../frontend/src/lib/theme-palettes.ts';
let input='';for await(const chunk of process.stdin)input+=chunk;const cfg=JSON.parse(input);
const browser=await chromium.launch({headless:true});const report=[],errors=[],writes=[];
const rgb=hex=>{const v=hex.slice(1).match(/../g).map(s=>parseInt(s,16));return `rgb(${v.join(', ')})`;};
try {
 for(const id of PALETTE_IDS)for(const dark of [false,true]){
  const context=await browser.newContext({viewport:{width:1440,height:900},locale:'en-US'});
  await context.addCookies([{name:'lang',value:'en-US',url:cfg.url}]);
  await context.addInitScript(({id,dark})=>{localStorage.setItem('connect-hub-palette',id);localStorage.setItem('dark-mode',String(dark));localStorage.setItem('sidebar-pinned','true');}, {id,dark});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  page.on('request',r=>{if(r.method()!=='GET'&&/\/server\/(restart|stop|update)|\/inbounds\/(add|update|del)|\/clients\/(add|update|del)|\/setting\/update/.test(r.url()))writes.push(r.url());});
  const name=id+'-'+(dark?'dark':'light'),t=themeTokens(id,dark);
  const shot=async(label)=>{await page.waitForTimeout(450);await page.screenshot({path:`${cfg.output}/${name}-${label}.png`,fullPage:true});};
  await page.goto(cfg.url);await page.locator('.login-card').waitFor();assert.equal(await page.locator('body').evaluate(e=>getComputedStyle(e).backgroundColor),rgb(t.bg));await shot('login');
  await page.locator('input[autocomplete=username]').fill(cfg.user);await page.locator('input[autocomplete=current-password]').fill(cfg.password);await page.locator('button[type=submit]').click();await page.waitForURL('**/panel/');await page.locator('.ov-page').waitFor();
  if(id==='classic'&&!dark){
   const csrf=(await (await context.request.get(cfg.url+'csrf-token')).json()).obj,headers={'X-CSRF-Token':csrf};
   const response=await context.request.post(cfg.url+'panel/api/inbounds/add',{headers,data:{remark:'Theme check',enable:false,listen:'127.0.0.1',port:18444,protocol:'vless',settings:'{"clients":[],"decryption":"none"}',streamSettings:'{"network":"tcp","security":"none"}',sniffing:'{}',allocate:'{}'}});const inbound=await response.json();assert.equal(inbound.success,true);
   const created=await context.request.post(cfg.url+'panel/api/clients/add',{headers,data:{client:{id:'3aaa7053-c864-4b10-b088-7a1e560a3411',email:'theme-check',enable:true,group:'retained-theme-group',comment:'Temporary visual fixture',totalGB:5368709120,expiryTime:0,subId:'themecheck',security:'auto'},inboundIds:[inbound.obj.id]}});assert.equal((await created.json()).success,true);
  }
  const chart=page.locator('.sparkline-container').first();await chart.waitFor();if(id!=='classic')assert.equal(await chart.getAttribute('data-chart-stroke'),t.chartPrimary);await shot('dashboard');
  const origin=await page.evaluate(()=>performance.timeOrigin);await chart.locator('canvas').first().evaluate(e=>e.dataset.paletteProbe='same-canvas');await page.locator('.sidebar-theme-cycle:visible').first().click();
  if(id!=='classic')assert.equal(await chart.getAttribute('data-chart-stroke'),themeTokens(id,!dark).chartPrimary);assert.equal(await chart.locator('canvas').first().getAttribute('data-palette-probe'),'same-canvas');assert.equal(await page.evaluate(()=>performance.timeOrigin),origin);await page.locator('.sidebar-theme-cycle:visible').first().click();
  await page.goto(cfg.url+'panel/settings#appearance');await page.getByRole('radio',{name:PALETTE_NAMES[id]}).waitFor();
  const before=await page.evaluate(()=>performance.timeOrigin);const other=id==='graphite-sage'?'midnight-steel':'graphite-sage';
  await page.getByRole('radio',{name:PALETTE_NAMES[other]}).click();assert.equal(await page.evaluate(()=>performance.timeOrigin),before);assert.equal(await page.evaluate(()=>document.documentElement.dataset.mode),dark?'dark':'light');
  await page.getByRole('radio',{name:dark?'Light':'Dark',exact:true}).locator('xpath=ancestor::label').click();assert.equal(await page.evaluate(()=>localStorage.getItem('connect-hub-palette')),other);
  await page.getByRole('radio',{name:dark?'Dark':'Light',exact:true}).locator('xpath=ancestor::label').click();await page.getByRole('radio',{name:PALETTE_NAMES[id]}).click();await shot('appearance');
  await page.reload();await page.getByRole('radio',{name:PALETTE_NAMES[id]}).waitFor();assert.equal(await page.getByRole('radio',{name:PALETTE_NAMES[id]}).isChecked(),true);assert.equal(await page.evaluate(()=>document.documentElement.dataset.mode),dark?'dark':'light');
  await page.goto(cfg.url+'panel/inbounds');await page.getByRole('button',{name:'Add Inbound',exact:true}).waitFor();const row=page.locator('.ant-table-tbody > tr[data-row-key]').first();await row.waitFor();assert.ok((await row.boundingBox()).height<64);await shot('inbounds');await page.getByRole('button',{name:'Add Inbound',exact:true}).click();const dialog=page.getByRole('dialog');await dialog.waitFor();await shot('form');
  await dialog.locator('.ant-select').first().click();const dropdown=page.locator('.ant-select-dropdown:visible');await dropdown.waitFor();const dropdownBg=await dropdown.evaluate(e=>getComputedStyle(e).backgroundColor);assert.equal(dropdownBg,rgb(id==='classic'?t.surface:t.raised));await shot('dropdown');await page.keyboard.press('Escape');await dialog.locator('.ant-modal-close').click();
  await page.goto(cfg.url+'panel/clients');await page.locator('.section-page-title').waitFor();assert.equal(await page.locator('.sider-nav [data-menu-id$="-/groups"]').count(),0);await shot('clients');
  await page.keyboard.press('Control+k');await page.locator('.command-palette-modal').waitFor();await shot('search');await page.keyboard.press('Escape');
  for(const route of ['nodes','hosts','outbound','routing','xray','api-docs']){await page.goto(cfg.url+'panel/'+route);await page.waitForTimeout(180);assert.equal(await page.locator('body').evaluate(e=>getComputedStyle(e).backgroundColor),rgb(t.bg));}
  await page.setViewportSize({width:390,height:900});await page.goto(cfg.url+'panel/settings#appearance');await page.getByRole('radio',{name:PALETTE_NAMES[id]}).waitFor();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await shot('mobile');
  const saved=await (await context.request.get(cfg.url+'panel/api/clients/get/theme-check')).json();assert.equal(saved.obj.client.group,'retained-theme-group');
  const state=await context.storageState();await context.close();const reopened=await browser.newContext({storageState:state});const restored=await reopened.newPage();await restored.goto(cfg.url+'panel/settings#appearance');await restored.getByRole('radio',{name:PALETTE_NAMES[id]}).waitFor();assert.equal(await restored.evaluate(()=>document.documentElement.dataset.palette),id);assert.equal(await restored.evaluate(()=>document.documentElement.dataset.mode),dark?'dark':'light');await reopened.close();
  report.push({palette:id,dark,dropdownBg,stored:true,reopened:true,groupPreserved:true,noReloadOnSelection:true});
 }
 const early=await browser.newContext();await early.addInitScript(()=>{localStorage.setItem('connect-hub-palette','graphite-sage');localStorage.setItem('dark-mode','false');});const shell=await early.newPage();await shell.route('**/*.js',r=>r.request().url().includes('/palette-bootstrap-')?r.continue():r.abort());await shell.goto(cfg.url,{waitUntil:'domcontentloaded'});assert.equal(await shell.evaluate(()=>document.documentElement.dataset.palette),'graphite-sage');assert.equal(await shell.locator('html').evaluate(e=>getComputedStyle(e).backgroundColor),rgb(themeTokens('graphite-sage',false).bg));await early.close();
 assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);fs.writeFileSync(cfg.output+'/palettes-report.json',JSON.stringify({variants:report,firstPaintBeforeBundle:true,errors,writes},null,2));console.log('PASS eight palettes: '+JSON.stringify(report));
} finally {await browser.close();}
