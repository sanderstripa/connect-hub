// Visual acceptance for the real bundled panel, using disposable credentials.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {chromium,_electron} from '../frontend/node_modules/playwright/index.mjs';
let input='';for await(const chunk of process.stdin)input+=chunk;const cfg=JSON.parse(input);
let browser,desktop,context;
try{
 if(process.env.CONNECT_HUB_LOCAL_ELECTRON){
  const require=createRequire(new URL('../apps/windows-installer/main.cjs',import.meta.url));
  const viewer=path.join(cfg.output,'soulu-viewer.cjs');
  fs.writeFileSync(viewer,"const {app,BrowserWindow}=require('electron');app.whenReady().then(()=>{global.w=new BrowserWindow({width:1440,height:1000,show:false,webPreferences:{offscreen:true}});global.w.loadURL('about:blank');});");
  desktop=await _electron.launch({executablePath:require('electron'),args:[viewer,'--no-sandbox','--ozone-platform=headless']});
  context=desktop.context();
 }else{browser=await chromium.launch({headless:true});context=await browser.newContext({viewport:{width:1440,height:1000},locale:'en-US'});}
 const page=desktop?await desktop.firstWindow():await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setViewportSize({width:1440,height:1000});await page.goto(cfg.url);await page.screenshot({path:path.join(cfg.output,'soulu-initial.png')});await page.locator('input[autocomplete=username]').waitFor();
 for(const dark of [false,true]){
  await page.evaluate(dark=>{localStorage.setItem('dark-mode',String(dark));localStorage.setItem('connect-hub-palette','midnight-steel');},dark);await page.reload();await page.locator('.login-card').waitFor();
  await check('login',dark);
 }
 await page.locator('input[autocomplete=username]').fill(cfg.user);await page.locator('input[autocomplete=current-password]').fill(cfg.password);await page.locator('button[type=submit]').click();await page.waitForURL('**/panel/');
 for(const dark of [false,true]){
  await page.evaluate(d=>localStorage.setItem('dark-mode',String(d)),dark);
  for(const route of ['','connections','inbounds','clients','settings#appearance']){
   await page.goto(cfg.url+'panel/'+route);await page.locator('.ant-sidebar').waitFor();await check(route.split('#')[0]||'dashboard',dark);
   if(route==='connections'){
    await page.locator('#connection-keys').waitFor();assert.equal(await page.locator('.ant-sidebar').count(),1);assert.ok(await page.locator('#connection-inbounds').boundingBox());

    await page.getByRole('button',{name:'Add Inbound',exact:true}).click();await page.getByRole('dialog').waitFor();await check('inbound-dialog',dark);await page.getByRole('dialog').locator('.ant-modal-close').click();
   }
  }
 }
 async function check(name,dark){
  await page.evaluate(async()=>{await document.fonts.load('400 14px Onest','Настройки Connect Hub');await document.fonts.ready;});await page.waitForTimeout(300);
  assert.equal(await page.evaluate(()=>document.documentElement.dataset.palette),'soulu');
  const style=await page.locator('body').evaluate(el=>({font:getComputedStyle(el).fontFamily,bg:getComputedStyle(el).backgroundColor}));assert.match(style.font,/Onest/);assert.equal(style.bg,dark?'rgb(8, 9, 11)':'rgb(246, 246, 248)');
  const wrong=await page.locator('input,button,h1,h2,.ant-modal-title').evaluateAll(els=>els.filter(el=>el.getBoundingClientRect().width>0&&!getComputedStyle(el).fontFamily.includes('Onest')).length);assert.equal(wrong,0);
  await page.screenshot({path:path.join(cfg.output,'soulu-'+name+'-'+(dark?'dark':'light')+'.png'),fullPage:true});
 }
 assert.deepEqual(errors,[]);console.log('PASS: real panel login, dashboard, inbounds, clients, settings and dialogs in both Soulu themes; old palettes migrated; local Onest loaded');
}finally{if(desktop)await desktop.close();if(browser)await browser.close();}
