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
 // Seed once, then reopen the saved client from the real Clients table. Do not
 // call the export endpoint directly: this exercises QrPanel's actual HTTP serializer.
 const require=createRequire(new URL('../apps/windows-installer/main.cjs',import.meta.url));
 const {selection,preset}=require('./connections.cjs');
 const selected=selection({name:'Sweden Sudoku',email:'iPhoneSudoku',host:'203.0.113.10',port:cfg.port,protocols:['sudoku']});
 const inbound=preset('sudoku',selected,cfg.port);inbound.listen='127.0.0.1';
 const saved=await page.evaluate(async({url,inbound})=>{
  const token=(await(await fetch(url+'csrf-token')).json()).obj;
  const response=await fetch(url+'panel/api/inbounds/add',{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':token},body:JSON.stringify(inbound)});
  const message=await response.json();if(!message.success)throw new Error('Sudoku fixture creation failed');
  const list=(await(await fetch(url+'panel/api/inbounds/list')).json()).obj;
  const row=list.find(row=>row.protocol==='sudoku'&&row.port===inbound.port);
  const settings=typeof row.settings==='string'?JSON.parse(row.settings):row.settings;
  return {id:row.id,client:settings.clients[0]};
 },{url:cfg.url,inbound});
 const otherInbound=preset('sudoku',selection({name:'Other inbound',email:'other-phone',host:'203.0.113.10',port:cfg.standardPort,protocols:['sudoku']}),cfg.standardPort);otherInbound.listen='127.0.0.1';
 await page.evaluate(async({url,inbound})=>{const token=(await(await fetch(url+'csrf-token')).json()).obj;const msg=await(await fetch(url+'panel/api/inbounds/add',{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':token},body:JSON.stringify(inbound)})).json();if(!msg.success)throw new Error('Second inbound fixture failed');},{url:cfg.url,inbound:otherInbound});


 for(const dark of [false,true]){
  await page.evaluate(d=>localStorage.setItem('dark-mode',String(d)),dark);
  for(const route of ['','connections','inbounds','clients','settings#appearance']){
   await page.goto(cfg.url+'panel/'+route);await page.locator('.ant-sidebar').waitFor();await check(route.split('#')[0]||'dashboard',dark);
   if(route==='connections'){
    await navigation(dark);
    await page.locator('#connection-keys').waitFor();assert.equal(await page.locator('.ant-sidebar').count(),1);assert.ok(await page.locator('#connection-inbounds').boundingBox());

    await page.locator('.inbound-card').filter({hasText:'Other inbound'}).click();
    await page.locator('#connection-keys .ant-table-row').filter({hasText:'other-phone'}).waitFor();
    assert.equal(await page.locator('#connection-keys .ant-table-row').filter({hasText:'iPhoneSudoku'}).isVisible(),false);
    await page.getByRole('button',{name:'All keys',exact:true}).click();
    await page.locator('#connection-keys .ant-table-row').filter({hasText:'iPhoneSudoku'}).waitFor();await page.locator('#connection-keys .ant-table-row').filter({hasText:'other-phone'}).waitFor();
    await page.locator('.inbound-card').filter({hasText:'Sweden Sudoku'}).click();
    const row=page.locator('#connection-keys .ant-table-row').filter({hasText:'iPhoneSudoku'});await row.waitFor();
    assert.equal(await page.locator('#connection-keys .ant-table-row').filter({hasText:'other-phone'}).isVisible(),false);
    await row.locator('.client-open').click();await page.locator('.connection-detail-surface .info-table').first().waitFor();assert.equal(await page.getByRole('dialog').count(),0);
    await page.getByRole('button',{name:'Back to keys',exact:true}).click();await row.waitFor();

    const profileResponse=page.waitForResponse(response=>response.url().endsWith('/panel/hub/api/sudoku-profiles'));
    await row.getByRole('button',{name:'QR Code',exact:true}).click();
    const linkPanel=page.locator('.connection-detail-surface').locator('.ant-collapse-header').filter({hasText:'Sudoku'}).last();await linkPanel.waitFor();
    if(await linkPanel.getAttribute('aria-expanded')==='false')await linkPanel.click();
    const response=await profileResponse;
    assert.equal(response.status(),200,'QR-window profile request must be accepted');
    assert.match(response.request().headers()['content-type'],/^application\/json/);
    const body=response.request().postDataJSON();assert.equal(body[0].inboundId,saved.id);assert.equal(body[0].clientId,saved.client.id);assert.ok(!response.request().postData().includes(saved.client.sudokuKey));
    await page.locator('.connection-detail-surface').getByText('Shadowrocket · Clash',{exact:true}).click();
    await page.getByRole('button',{name:'Copy profile URL',exact:true}).waitFor();
    assert.equal(await page.locator('.connection-detail-surface').locator('.ant-alert-warning').count(),0);
    assert.ok(await page.locator('.connection-detail-surface').locator('.qr-code svg').count());
    await check('sudoku-qr',dark);
    const profiles=(await response.json()).obj,profile=profiles[saved.id+':'+saved.client.id];
    assert.ok(profile.path.startsWith('sudoku-import/'));assert.ok(!profile.path.includes(saved.client.sudokuKey));
    const imported=await fetch(new URL(profile.path,cfg.url));assert.equal(imported.status,200);assert.equal(await imported.text(),profile.config);
    const current=await page.evaluate(async url=>{const msg=await(await fetch(url)).json();return typeof msg.obj.settings==='string'?JSON.parse(msg.obj.settings):msg.obj.settings;},cfg.url+'panel/api/inbounds/get/'+saved.id);
    assert.equal(current.clients[0].sudokuKey,saved.client.sudokuKey,'Opening a QR must preserve the saved key');
    await page.getByRole('button',{name:'Back to keys',exact:true}).click();



    if(!dark){
      await page.getByRole('button',{name:'Create key',exact:true}).click();
      await page.locator('.connection-detail-surface input[id$="-email"]').fill('Created-in-selected');
      const creating=page.waitForResponse(response=>response.url().endsWith('/panel/api/clients/add'));
      await page.locator('.connection-detail-footer').getByRole('button',{name:'Create',exact:true}).click();
      const result=await creating;assert.equal((await result.json()).success,true);assert.deepEqual(result.request().postDataJSON().inboundIds,[saved.id]);
      await page.locator('#connection-keys .ant-table-row').filter({hasText:'Created-in-selected'}).waitFor();
      await page.locator('.inbound-card').filter({hasText:'Other inbound'}).click();await page.locator('#connection-keys .ant-table-row').filter({hasText:'other-phone'}).waitFor();assert.equal(await page.getByRole('button',{name:'Created-in-selected',exact:true}).isVisible(),false);
      await page.locator('.inbound-card').filter({hasText:'Sweden Sudoku'}).click();await row.waitFor();
    }
    await check('connections-workspace',dark);
    await page.getByRole('button',{name:'Create inbound',exact:true}).click();await page.getByRole('dialog').waitFor();await check('inbound-dialog',dark);await page.getByRole('dialog').locator('.ant-modal-close').click();
   }
  }
 }
 async function navigation(dark){
  const rail=page.locator('.ant-sidebar');
  assert.equal(Math.round((await rail.boundingBox()).width),56);
  await rail.hover();await page.waitForTimeout(250);assert.equal(Math.round((await rail.boundingBox()).width),56);
  assert.equal(await page.locator('.rail-brand').textContent(),'C.');
  const groups=[
   ['Infrastructure',['/nodes','/hosts']],
   ['Network',['/outbound','/routing']],
   ['Settings',['/settings#appearance','/settings#general','/settings#security','/settings#telegram','/settings#email','/settings#discord','/settings#subscription','/api-docs']],
   ['Xray Configs',['/xray#basic','/xray#balancer','/xray#dns','/xray#advanced']],
  ];
  for(const [name,routes] of groups){
   for(let i=0;i<routes.length;i++){
    const trigger=rail.getByRole('button',{name,exact:true});await trigger.hover();assert.equal(await trigger.getAttribute('aria-expanded'),'false');
    await trigger.click();const menu=page.locator('.rail-submenu:visible');await menu.waitFor();
    const bounds=await menu.boundingBox(),vp=page.viewportSize();assert.ok(bounds.x>=0&&bounds.y>=0&&bounds.x+bounds.width<=vp.width+1&&bounds.y+bounds.height<=vp.height+1);
    await menu.getByRole('menuitem').nth(i).click();try{await page.waitForURL(cfg.url+'panel'+routes[i]);}catch(error){throw new Error('Expected '+routes[i]+' but got '+page.url(),{cause:error});}await page.locator('.rail-submenu:visible').waitFor({state:'hidden'});
   }
  }
  await page.goto(cfg.url+'panel/connections');
  const trigger=rail.getByRole('button',{name:'Settings',exact:true});
  await trigger.click();await page.keyboard.press('Escape');assert.equal(await trigger.getAttribute('aria-expanded'),'false');
  await trigger.click();await trigger.click();assert.equal(await trigger.getAttribute('aria-expanded'),'false');
  await trigger.click();await page.locator('.connections-intro').click();assert.equal(await trigger.getAttribute('aria-expanded'),'false');
  await page.getByRole('button',{name:'Theme',exact:true}).click();await page.waitForFunction(d=>document.body.classList.contains('dark')===!d,dark);
  assert.equal(await page.evaluate(()=>localStorage.getItem('dark-mode')),String(!dark));await page.getByRole('button',{name:'Theme',exact:true}).click();
  await page.keyboard.press('Control+k');const search=page.locator('.command-palette-input');await search.waitFor();await search.fill('appearance');await search.press('Enter');await page.waitForURL('**/settings#appearance');
  await page.getByRole('button',{name:/Command Palette/}).click();await page.locator('.command-palette-input').waitFor();await page.keyboard.press('Escape');await page.locator('.command-palette-input').waitFor({state:'detached'});
  await page.goto(cfg.url+'panel/connections');
  for(const width of [1024,768,390]){
   await page.setViewportSize({width,height:800});await page.locator('.inbound-card').first().waitFor();
   await page.screenshot({path:path.join(cfg.output,'navigation-current.png'),fullPage:true});
   const rb=await rail.boundingBox(),ib=await page.locator('#connection-inbounds').boundingBox();assert.equal(Math.round(rb.width),56);assert.ok(ib.x>=rb.x+rb.width,JSON.stringify({width,rb,ib}));
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),'Navigation must not cause page-wide overflow at '+width);
   const pane=await page.locator('#connection-keys').boundingBox();assert.ok(pane.x+pane.width<=width+1,'Work pane clipped at '+width);
   await trigger.click();const menu=page.locator('.rail-submenu:visible');await menu.waitFor();const b=await menu.boundingBox();assert.ok(b.x>=0&&b.x+b.width<=width+1&&b.y>=0&&b.y+b.height<=801);await page.keyboard.press('Escape');
   await page.screenshot({path:path.join(cfg.output,'navigation-'+width+'-'+(dark?'dark':'light')+'.png'),fullPage:true});
  }
  await page.setViewportSize({width:1440,height:1000});
 }
 async function check(name,dark){
  await page.evaluate(async()=>{await document.fonts.load('400 14px Onest','Настройки Connect Hub');await document.fonts.ready;});await page.waitForTimeout(300);
  assert.equal(await page.evaluate(()=>document.documentElement.dataset.palette),'soulu');
  const style=await page.locator('body').evaluate(el=>({font:getComputedStyle(el).fontFamily,bg:getComputedStyle(el).backgroundColor}));assert.match(style.font,/Onest/);assert.equal(style.bg,dark?'rgb(8, 9, 11)':'rgb(246, 246, 248)');
  const wrong=await page.locator('input,button,h1,h2,.ant-modal-title').evaluateAll(els=>els.filter(el=>el.getBoundingClientRect().width>0&&!getComputedStyle(el).fontFamily.includes('Onest')).length);assert.equal(wrong,0);
  await page.screenshot({path:path.join(cfg.output,'soulu-'+name+'-'+(dark?'dark':'light')+'.png'),fullPage:true});
 }
 console.log('PASS: fixed 56px rail, every submenu route, click/Escape/outside close, live theme, Ctrl+K search and 390/768/1024px without navigation overflow');
 console.log('PASS: inbound cards, scoped clients, All keys, inline details/back, scoped key creation and unchanged original keys');
 console.log('PASS: saved Sudoku client → real web QR modal → JSON/CSRF request → Shadowrocket QR and anonymous profile fetch; original key unchanged');
 assert.deepEqual(errors,[]);console.log('PASS: real panel login, dashboard, inbounds, clients, settings and dialogs in both Soulu themes; old palettes migrated; local Onest loaded');
}finally{if(desktop)await desktop.close();if(browser)await browser.close();}
