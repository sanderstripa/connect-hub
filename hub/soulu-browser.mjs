// Visual acceptance for the real bundled panel, using disposable credentials.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {DEFAULT_PALETTE, themeTokens} from '../frontend/src/lib/theme-palettes.ts';
import {createRequire} from 'node:module';
import {chromium,webkit,devices,_electron} from '../frontend/node_modules/playwright/index.mjs';
let input='';for await(const chunk of process.stdin)input+=chunk;const cfg=JSON.parse(input);
let browser,desktop,context;
try{
 if(process.env.CONNECT_HUB_LOCAL_ELECTRON){
  const require=createRequire(new URL('../apps/windows-installer/main.cjs',import.meta.url));
  const viewer=path.join(cfg.output,'soulu-viewer.cjs');
  fs.writeFileSync(viewer,"const {app,BrowserWindow}=require('electron');app.whenReady().then(()=>{global.w=new BrowserWindow({width:1440,height:1000,show:false,webPreferences:{offscreen:true}});global.w.loadURL('about:blank');});");
  desktop=await _electron.launch({executablePath:require('electron'),args:[viewer,'--no-sandbox','--ozone-platform=headless']});
  context=desktop.context();
 }else{browser=await chromium.launch({headless:true,executablePath:process.env.CONNECT_HUB_CHROMIUM || undefined});context=await browser.newContext({viewport:{width:1440,height:1000},locale:'en-US'});}
 const page=desktop?await desktop.firstWindow():await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setViewportSize({width:1440,height:1000});await page.goto(cfg.url);await page.screenshot({path:path.join(cfg.output,'soulu-initial.png')});await page.locator('input[autocomplete=username]').waitFor();
 await page.evaluate(()=>{
  localStorage.setItem('dark-mode','true');
  localStorage.setItem('connect-hub-palette','midnight-steel');
 });
 await page.reload();
 await page.locator('.login-card').waitFor();
 await check('login');
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
 const otherInbound=preset('shadowsocks',selection({name:'Other inbound',email:'other-phone',host:'203.0.113.10',port:cfg.standardPort,protocols:['shadowsocks']}),cfg.standardPort);otherInbound.listen='127.0.0.1';
 await page.evaluate(async({url,inbound})=>{const token=(await(await fetch(url+'csrf-token')).json()).obj;const msg=await(await fetch(url+'panel/api/inbounds/add',{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':token},body:JSON.stringify(inbound)})).json();if(!msg.success)throw new Error('Second inbound fixture failed');},{url:cfg.url,inbound:otherInbound});


 {
  for(const route of ['','connections','inbounds','clients','settings#general']){
   await page.goto(cfg.url+'panel/'+route);await page.locator('.desktop-navigation').waitFor();await brandCheck();await check(route.split('#')[0]||'dashboard');
   if(route===''){
    assert.equal(await page.getByRole('link',{name:'Overview',exact:true}).count(),1);
    const controls=page.locator('.ov-bar-actions .ant-btn');
    assert.equal(await controls.count(),4);
    for(const control of await controls.all()){
     assert.ok((await control.innerText()).trim());
     const style=await control.evaluate(el=>({background:getComputedStyle(el).backgroundImage,shadow:getComputedStyle(el).boxShadow}));
     assert.deepEqual(style,{background:'none',shadow:'none'});
    }
    const keys = page.locator('.ov-active-keys');
    await keys.getByRole('heading', {name:/Active keys/}).waitFor();
    await keys.locator('.ov-keys-count').waitFor();
    assert.equal(await page.locator('.ov-state-dot').count(),0);
    const [traffic,keyCard] = await page.locator('.ov-mid > .ant-card').evaluateAll(cards=>cards.map(card=>card.getBoundingClientRect().width));
    assert.ok(Math.abs(traffic-keyCard)<2,'Dashboard traffic and keys must share the row equally');

    const monitor=await page.evaluate(async url=>(await(await fetch(url+'panel/hub/api/sudoku/monitor')).json()),cfg.url);
    assert.equal(monitor.success,true);assert.equal(monitor.obj.state,'running');assert.equal(monitor.obj.version,'core-v0.7.1');
    const releasesResponse=page.waitForResponse(r=>r.url().endsWith('/panel/hub/api/sudoku/releases'));
    await page.getByRole('button',{name:'Sudoku updates',exact:true}).click();
    const dialog=page.getByRole('dialog');await dialog.waitFor();
    const releases=await(await releasesResponse).json();
    if(releases.success){
     const installed=releases.obj.find(entry=>entry.version===monitor.obj.version);
     if(installed) await dialog.getByRole('link',{name:installed.name||installed.version,exact:true}).waitFor();
    }else{
     await dialog.locator('.ant-alert-error').waitFor();
     console.log('Sudoku release feed unavailable; verified the actual error state');
    }
    await dialog.locator('a[href="https://github.com/sanderstripa/sudoku-ui/releases"]').waitFor();
    await check('sudoku-releases');await dialog.locator('.ant-modal-close').click();
   }
   if(route==='connections'){
    await navigation();
    await page.locator('#connection-keys').waitFor();
    assert.equal(await page.getByRole('heading',{name:'Connections',exact:true}).count(),0);
    assert.equal(await page.getByRole('button',{name:'All keys',exact:true}).count(),0);assert.equal(await page.getByPlaceholder('Find inbound').count(),0);
    assert.equal(await page.locator('.header-utilities .global-search-trigger').count(),1);assert.equal(await page.locator('.ant-sidebar').count(),0);assert.ok(await page.locator('#connection-inbounds').boundingBox());

    await page.locator('.inbound-card').filter({hasText:'Other inbound'}).click();
    const other = page.locator('#connection-keys .ant-table-row').filter({hasText:'other-phone'});
    await other.locator('.client-open').click();
    const otherInfo = page.locator('.client-info-surface');
    const passwordField = otherInfo.locator('.client-info-field').filter({has: otherInfo.getByText('Password',{exact:true})});
    const copyPassword = passwordField.getByRole('button',{name:/^Copy/});
    await copyPassword.waitFor();
    await context.grantPermissions(['clipboard-read','clipboard-write']);
    await copyPassword.click();
    const password = JSON.parse(otherInbound.settings).clients[0].password;
    await page.waitForFunction(async value=>await navigator.clipboard.readText()===value,password);
    const directLink = otherInfo.locator('.link-row').filter({hasText:'Shadowsocks'}).first();
    await directLink.getByRole('button',{name:'QR Code',exact:true}).click();
    await page.locator('.ant-popover .qr-code svg:visible').waitFor();
    await page.keyboard.press('Escape');
    await page.getByRole('button',{name:'Back to keys',exact:true}).click();
    assert.equal(await page.locator('#connection-keys .ant-table-row').filter({hasText:'iPhoneSudoku'}).isVisible(),false);
    await page.locator('.inbound-card').filter({hasText:'Sweden Sudoku'}).click();
    const row=page.locator('#connection-keys .ant-table-row').filter({hasText:'iPhoneSudoku'});await row.waitFor();
    assert.equal(await page.locator('#connection-keys .ant-table-row').filter({hasText:'other-phone'}).isVisible(),false);
    await row.locator('.client-open').click();await page.locator('.client-info-surface .client-info-section').first().waitFor();assert.equal(await page.getByRole('dialog').count(),0);
    const back = page.getByRole('button',{name:'Back to keys',exact:true});
    const info = page.locator('.client-info-surface');
    for (const heading of ['Overview','Traffic and limits','Connection details','Additional information']) {
     await info.getByRole('heading',{name:heading,exact:true}).waitFor();
    }
    assert.deepEqual(await back.evaluate(el=>({
     background: getComputedStyle(el).backgroundColor,
     shadow: getComputedStyle(el).boxShadow,
     icon: getComputedStyle(el.querySelector('.anticon')).color,
    })), {background:'rgb(37, 38, 41)',shadow:'none',icon:'rgb(213, 250, 77)'});
    await back.click();await row.waitFor();

    const profileResponse=page.waitForResponse(response=>response.url().endsWith('/panel/hub/api/sudoku-profiles'));
    await row.getByRole('button',{name:'QR Code',exact:true}).click();
    const linkPanel=page.locator('.connection-detail-surface').locator('.ant-collapse-header').filter({hasText:'Sudoku'}).last();await linkPanel.waitFor();
    if(await linkPanel.getAttribute('aria-expanded')==='false')await linkPanel.click();
    const response=await profileResponse;
    assert.equal(response.status(),200,'QR-window profile request must be accepted');
    assert.match(response.request().headers()['content-type'],/^application\/json/);
    const body=response.request().postDataJSON();assert.equal(body[0].inboundId,saved.id);assert.equal(body[0].clientId,saved.client.id);assert.ok(!response.request().postData().includes(saved.client.sudokuKey));
    await page.locator('.connection-detail-surface').getByText('YAML · Shadowrocket',{exact:true}).click();
    await page.getByRole('button',{name:'Copy profile URL',exact:true}).waitFor();
    assert.equal(await page.locator('.connection-detail-surface').locator('.ant-alert-warning').count(),0);
    assert.ok(await page.locator('.connection-detail-surface').locator('.qr-code svg').count());
    await check('sudoku-qr');
    const profiles=(await response.json()).obj,profile=profiles[saved.id+':'+saved.client.id];
    assert.ok(profile.path.startsWith('sudoku-import/'));assert.ok(profile.path.endsWith('.yaml'));assert.match(profile.config,/proxy-groups:/);assert.match(profile.config,/MATCH,PROXY/);assert.ok(!profile.path.includes(saved.client.sudokuKey));
    const imported=await fetch(new URL(profile.path,cfg.url));assert.equal(imported.status,200);assert.equal(await imported.text(),profile.config);
    const current=await page.evaluate(async url=>{const msg=await(await fetch(url)).json();return typeof msg.obj.settings==='string'?JSON.parse(msg.obj.settings):msg.obj.settings;},cfg.url+'panel/api/inbounds/get/'+saved.id);
    assert.equal(current.clients[0].sudokuKey,saved.client.sudokuKey,'Opening a QR must preserve the saved key');
    await page.getByRole('button',{name:'Back to keys',exact:true}).click();



    {
      await page.getByRole('button',{name:'Create key',exact:true}).click();
      await page.locator('.connection-detail-surface input[id$="-email"]').fill('Created-in-selected');
      const creating=page.waitForResponse(response=>response.url().endsWith('/panel/api/clients/add'));
      await page.locator('.connection-detail-footer').getByRole('button',{name:'Create',exact:true}).click();
      const result=await creating;assert.equal((await result.json()).success,true);assert.deepEqual(result.request().postDataJSON().inboundIds,[saved.id]);
      await page.locator('#connection-keys .ant-table-row').filter({hasText:'Created-in-selected'}).waitFor();
      await page.locator('.inbound-card').filter({hasText:'Other inbound'}).click();await page.locator('#connection-keys .ant-table-row').filter({hasText:'other-phone'}).waitFor();assert.equal(await page.getByRole('button',{name:'Created-in-selected',exact:true}).isVisible(),false);
      await page.locator('.inbound-card').filter({hasText:'Sweden Sudoku'}).click();await row.waitFor();
    }
    await check('connections-workspace');
    await page.getByRole('button',{name:'Create inbound',exact:true}).click();await page.getByRole('dialog').waitFor();await check('inbound-dialog');await page.getByRole('dialog').locator('.ant-modal-close').click();
   }
  }
 }
 if (process.env.GITHUB_ACTIONS === 'true' || process.env.CONNECT_HUB_TEST_WEBKIT === '1') {
  const webkitBrowser = await webkit.launch();
  try {
   const mobile = await webkitBrowser.newContext({
    ...devices['iPhone 15'],
    locale: 'en-US',
    storageState: await context.storageState(),
   });
   const safari = await mobile.newPage();
   await safari.goto(cfg.url+'panel/');
   await safari.locator('.ov-tile').first().waitFor();
   await mobileScrollCheck(safari);
   await safari.getByRole('link',{name:'Connections',exact:true}).click();
   await safari.getByRole('button',{name:'Create inbound',exact:true}).waitFor();
   await safari.setViewportSize({width: 393, height: 600});
   await safari.locator('.inbound-position').getByRole('button',{name:/^Sweden Sudoku/}).click();
   const key = safari.locator('.client-card').filter({hasText:'iPhoneSudoku'});
   await key.waitFor();
   await mobileScrollCheck(safari);
   const movement = await safari.locator('#connection-keys .filter-bar').evaluate(filter => {
    const work = document.querySelector('.panel-app > .ant-layout');
    const card = work.querySelector('.client-card');
    const header = document.querySelector('.app-header');
    work.scrollTop = 0;
    const before = {filter:filter.getBoundingClientRect().top,card:card.getBoundingClientRect().top,header:header.getBoundingClientRect().top};
    work.scrollTop = before.filter - work.getBoundingClientRect().top + 25;
    const result = {
     scroll:work.scrollTop,
     position:getComputedStyle(filter).position,
     filterDelta:before.filter-filter.getBoundingClientRect().top,
     cardDelta:before.card-card.getBoundingClientRect().top,
     headerDelta:before.header-header.getBoundingClientRect().top,
     separated:filter.getBoundingClientRect().bottom<=card.getBoundingClientRect().top,
    };
    work.scrollTop = 0;
    return result;
   });
   assert.ok(movement.scroll>0 && movement.position==='static' && movement.separated);
   assert.ok(Math.abs(movement.filterDelta-movement.scroll)<1 && Math.abs(movement.cardDelta-movement.scroll)<1);
   assert.equal(movement.headerDelta,0);
   await key.getByRole('button',{name:'Client Information',exact:true}).click();
   const mobileInfo = safari.locator('.client-info-surface');
   await mobileInfo.getByRole('heading',{name:'Connection details',exact:true}).waitFor();
   const copyLayout = await mobileInfo.locator('.client-info-field dd:has(button[aria-label^="Copy"])').first().evaluate(row => {
    const value = row.querySelector('.client-info-value').getBoundingClientRect();
    const button = row.querySelector('button').getBoundingClientRect();
    return button.left>=value.right && button.top<value.bottom;
   });
   assert.ok(copyLayout,'Copy remains beside the technical value on mobile');
   await safari.getByRole('button',{name:'Back to keys',exact:true}).click();
   await safari.screenshot({path:path.join(cfg.output,'mobile-webkit-connections.png')});
  } finally {
   await webkitBrowser.close();
  }
 }
 // The full set of language packs must fit the header, including RTL.
 for(const locale of ['ar-EG','en-US','es-ES','fa-IR','id-ID','ja-JP','pt-BR','ru-RU','sk-SK','tr-TR','uk-UA','vi-VN','zh-CN','zh-TW']){
  await context.addCookies([{name:'lang',value:locale,url:cfg.url}]);
  await page.setViewportSize({width:1280,height:720});
  await page.goto(cfg.url+'panel/connections');
  await page.waitForFunction(lang=>document.documentElement.lang===lang,locale);
  await page.locator('.desktop-navigation').waitFor();
  const bounds=await page.locator('.app-header .header-control').evaluateAll(controls=>controls.map(el=>{
   const {left,right}=el.getBoundingClientRect();return {left,right};
  }));
  assert.equal(bounds.length,6);
  assert.ok(bounds.every(({left,right})=>left>=0&&right<=1281),'Header overflow in '+locale);
 }
 await context.clearCookies({name:'lang'});
 await page.goto(cfg.url+'panel/connections');
 await page.locator('.header-utilities').getByRole('button',{name:'Log Out'}).click();
 await page.locator('input[autocomplete=username]').waitFor();
 await page.goto(cfg.url+'panel/connections');
 await page.locator('input[autocomplete=username]').waitFor();
 async function mobileScrollCheck(currentPage) {
  const geometry = await currentPage.evaluate(() => {
   const panel = document.querySelector('.panel-app');
   const header = panel.querySelector('.app-header');
   const work = panel.querySelector(':scope > .ant-layout');
   // Desktop WebKit emulation has no physical notch. Exercise the same CSS offset with a test inset.
   panel.style.setProperty('--panel-safe-top', '59px');
   try {
    const before = header.getBoundingClientRect();
    const workTop = work.getBoundingClientRect().top;
    work.scrollTop = 100;
    const after = header.getBoundingClientRect();
    return {
     before: before.top, after: after.top, height: after.height, workTop,
     scroll: work.scrollTop, windowScroll: window.scrollY,
     safeAreaOwner: document.elementFromPoint(innerWidth / 2, 20) === panel,
     safeAreaBackground: getComputedStyle(panel, '::before').backgroundColor,
    };
   } finally {
    work.scrollTop = 0;
    panel.style.removeProperty('--panel-safe-top');
   }
  });
  assert.equal(geometry.before, 71);
  assert.equal(geometry.after, geometry.before);
  assert.equal(geometry.height, 126);
  assert.equal(geometry.workTop, 206);
  assert.equal(geometry.windowScroll, 0);
  assert.ok(geometry.scroll > 0);
  assert.equal(geometry.safeAreaOwner, true);
  assert.equal(geometry.safeAreaBackground, 'rgb(220, 222, 228)');
 }
 async function brandCheck(){
  const brand=page.getByRole('link',{name:'Connect.Hub',exact:true});
  assert.equal(await brand.count(),1);await brand.waitFor();
  assert.equal(await page.locator('.ant-sidebar a').filter({hasText:'C.'}).count(),0);
  await page.locator('.panel-app > .ant-layout:visible > .content-shell > .content-area:visible').first().waitFor();
  await page.waitForFunction(()=>{
   const header=document.querySelector('.app-header');
   const shell=[...document.querySelectorAll('.panel-app > .ant-layout > .content-shell')].find(el=>el.getBoundingClientRect().height>0);
   return header&&shell&&(matchMedia('(max-width: 768px)').matches
    ? shell.parentElement.getBoundingClientRect().top >= header.getBoundingClientRect().bottom
    : parseFloat(getComputedStyle(shell).paddingBlockStart)>=header.getBoundingClientRect().height);
  });
  const metrics=await page.evaluate(()=>{
   const header=document.querySelector('.app-header').getBoundingClientRect();
   const shell=[...document.querySelectorAll('.panel-app > .ant-layout > .content-shell')].find(el=>el.getBoundingClientRect().height>0);
   const content=shell.querySelector('.content-area').getBoundingClientRect();
   return {header:{x:header.x,y:header.y,width:header.width,height:header.height},content:{y:content.y},scrollY:window.scrollY,width:window.innerWidth};
  });
  assert.ok(metrics.header.x >= 0 && metrics.header.x+metrics.header.width<=metrics.width+1);
  if (metrics.width > 768) {
   assert.ok(metrics.content.y+metrics.scrollY>=metrics.header.height-1,'Header must not cover initial page content: '+JSON.stringify(metrics));
  }
 }
 async function navigation(){
  const headerNav=page.locator('.desktop-navigation');
  assert.equal(await headerNav.getByRole('link').count(),2);
  const settings=page.locator('.header-utilities').getByRole('link',{name:'Settings',exact:true});
  await settings.click();
  const settingsNav=page.locator('.settings-navigation');
  const network=settingsNav.locator('.settings-network');
  await network.locator('summary').click();
  const networkLinks=['groups','nodes','hosts','clean-ip','dns-tunnel','tunnels','outbound','routing'];
  assert.equal(await network.getByRole('link').count(),networkLinks.length);
  await page.screenshot({path:path.join(cfg.output,'navigation-network-concept-3.png')});
  for(const route of networkLinks){
   const link=network.locator('a[href$="/'+route+'"]');
   await link.click();
   await page.waitForURL('**/panel/'+route);
   await brandCheck();
   await network.locator('a[aria-current="page"][href$="/'+route+'"]').waitFor();
   assert.equal(await settings.getAttribute('aria-current'),'page');
  }
  for(const [name,route] of [
   ['Authentication','settings#security'],['Telegram Bot','settings#telegram'],
   ['Email','settings#email'],['Discord Bot','settings#discord'],['WeChat notifications','settings#wechat'],
   ['Subscription','settings#subscription'],['Logs','logs'],['AI Assistant','assistant'],
   ['API Docs','api-docs'],['Update Panel','settings#about'],['Basics','xray#basic'],['Balancers','xray#balancer'],
   ['DNS','xray#dns'],['Advanced','xray#advanced'],
  ]){
   await settingsNav.getByRole('link',{name,exact:true}).click();
   await page.waitForURL('**/panel/'+route);
   await brandCheck();
   assert.equal(await settings.getAttribute('aria-current'),'page');
  }
  await page.screenshot({path:path.join(cfg.output,'navigation-settings-'+'concept-3'+'.png')});
  await page.keyboard.press('Control+k');const search=page.locator('.command-palette-input');await search.waitFor();await search.fill('Authentication');await search.press('Enter');await page.waitForURL('**/settings#security');
  await page.getByRole('button',{name:/Command Palette/}).click();await page.locator('.command-palette-input').waitFor();
  await page.waitForFunction(()=>{
   const header=document.querySelector('.app-header')?.getBoundingClientRect();
   const search=document.querySelector('.command-palette-modal')?.getBoundingClientRect();
   return header && search && search.top>=header.bottom && search.top<header.bottom+20;
  });
  await page.screenshot({path:path.join(cfg.output,'navigation-search.png')});
  await page.keyboard.press('Escape');await page.locator('.command-palette-input').waitFor({state:'detached'});
  await page.goto(cfg.url+'panel/connections');
  for(const [width,height] of [[1280,720],[1366,768],[1920,1080],[2560,1440],[3840,2160],[1024,800],[768,800],[390,800]]){
   await page.setViewportSize({width,height});await page.locator('.inbound-card').first().waitFor();
   await page.screenshot({path:path.join(cfg.output,'navigation-current.png'),fullPage:true});
   assert.equal(await headerNav.isVisible(),true);
   if(width <= 768) {
    const hamburger=page.getByRole('button',{name:'Navigation',exact:true});
    assert.equal(await hamburger.count(),0);
    assert.equal(await page.locator('.header-utilities .header-control:visible').count(),3);
    const segments=await headerNav.locator('.header-control').evaluateAll(items=>items.map(el=>el.getBoundingClientRect().width));
    assert.equal(segments.length,2);
    assert.ok(Math.max(...segments)-Math.min(...segments)<1);
    const active=await headerNav.locator('[aria-current="page"]').boundingBox();
    const x=active.x+active.width/2,y=active.y+active.height/2;
    await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x,y+60,{steps:5});await page.mouse.up();
    assert.match(page.url(),/connections$/);
    await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x-active.width,y,{steps:8});await page.mouse.up();
    await page.waitForURL(url=>url.pathname.replace(/\/$/,'')===new URL(cfg.url+'panel/').pathname.replace(/\/$/,''));
    if(width===390) {
     await page.locator('.ov-versions').waitFor();
     const touch=await page.context().newCDPSession(page);
     async function swipe(dx,dy) {
      const b=await headerNav.locator('[aria-current="page"]').boundingBox();
      const start={x:b.x+b.width/2,y:b.y+b.height/2};
      await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[start]});
      for(let step=1;step<=8;step++) {
       await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:start.x+dx*step/8,y:start.y+dy*step/8}]});
      }
      await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
     }
     try {
      await touch.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:1});
      await swipe(0,-65);
      assert.match(new URL(page.url()).pathname,/\/panel\/?$/);
      await swipe(105,0);
      await page.waitForURL('**/connections');
     } finally {
      await touch.send('Emulation.setTouchEmulationEnabled',{enabled:false});
      await touch.detach();
     }
    }
    await page.getByRole('link',{name:'Settings',exact:true}).click();
    await page.waitForURL('**/settings');
    await hamburger.click();const drawer=page.getByRole('dialog');await drawer.waitFor();
    await page.locator('.mobile-navigation-drawer .ant-drawer-content-wrapper').evaluate(async el=>{await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));await Promise.all(el.getAnimations({subtree:true}).map(a=>a.finished.catch(()=>{})));});
    await page.waitForFunction(()=>{const r=document.querySelector('[role="dialog"]')?.getBoundingClientRect();return r && r.x>=0;});
    const b=await drawer.boundingBox();assert.ok(b.x>=0&&b.x+b.width<=width+1);
    await page.screenshot({path:path.join(cfg.output,'mobile-menu-'+width+'-'+'concept-3'+'.png')});
    await drawer.getByText('Network',{exact:true}).click();
    const hosts=drawer.getByRole('menuitem',{name:'Hosts',exact:true});
    await Promise.all([page.waitForURL('**/hosts'),hosts.click()]);
    await drawer.waitFor({state:'hidden'});
    await hamburger.click();
    await drawer.waitFor();
    const apiDocs=drawer.getByRole('menuitem',{name:'API Docs',exact:true});
    await apiDocs.waitFor();
    await drawer.evaluate(async el=>{
     await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
     await Promise.all(el.getAnimations({subtree:true}).map(animation=>animation.finished.catch(()=>{})));
    });
    await Promise.all([page.waitForURL('**/api-docs'),apiDocs.click()]);

    await page.getByRole('dialog').waitFor({state:'hidden'});
    await page.getByRole('link',{name:'Settings',exact:true}).click();
    await page.waitForURL('**/settings');
    await hamburger.click();await page.getByRole('dialog').waitFor();await page.keyboard.press('Escape');
    await page.getByRole('dialog').waitFor({state:'hidden'});
    await page.goto(cfg.url+'panel/connections');await page.locator('.inbound-card').first().waitFor();
    const list=page.locator('.inbound-card-list');
    assert.ok(await list.evaluate(el=>getComputedStyle(el).gridAutoFlow==='column'));
    await page.locator('.inbound-position').getByRole('button',{name:/^Other inbound/}).click();
    await page.locator('.client-card').filter({hasText:'other-phone'}).waitFor();
    assert.equal(await page.locator('.client-card').filter({hasText:'iPhoneSudoku'}).count(),0);
    await page.locator('.inbound-position').getByRole('button',{name:/^Sweden Sudoku/}).click();
    await page.locator('.client-card').filter({hasText:'iPhoneSudoku'}).waitFor();
    await page.goto(cfg.url+'panel/');await page.locator('.ov-tile').first().waitFor();
    assert.equal(await page.locator('.mobile-monitoring-title').count(),0);
    const line=page.locator('.ov-traffic-controls label').filter({has:page.locator('[aria-label="Line chart"]')});
    const dots=page.locator('.ov-traffic-controls label').filter({has:page.locator('[aria-label="Dot chart"]')});
    await line.click();assert.equal(await line.locator('input').isChecked(),true);
    await dots.click();assert.equal(await dots.locator('input').isChecked(),true);
    const tiles=await page.locator('.ov-tile').evaluateAll(els=>els.map(el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};}));
    assert.equal(tiles.length,4);assert.ok(tiles.every(r=>r.x>=0&&r.x+r.width<=width+1));
    await mobileScrollCheck(page);
    await page.screenshot({path:path.join(cfg.output,'mobile-monitoring-'+width+'-'+'concept-3'+'.png'),fullPage:true});
    await page.goto(cfg.url+'panel/connections');await page.locator('#connection-keys').waitFor();
   }
   await brandCheck();
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),'Navigation must not cause page-wide overflow at '+width);
   const pane=await page.locator('#connection-keys').boundingBox();assert.ok(pane.x+pane.width<=width+1,'Work pane clipped at '+width);
   await page.screenshot({path:path.join(cfg.output,'navigation-'+width+'-'+'concept-3'+'.png'),fullPage:true});
  }
  await page.setViewportSize({width:1440,height:1000});
  const header=await page.locator('.app-header').elementHandle();
  await page.getByRole('link',{name:'Connect.Hub',exact:true}).click();
  await page.waitForURL(url=>url.pathname.replace(/\/$/,'')===new URL(cfg.url+'panel/').pathname.replace(/\/$/,''));
  await page.locator('.ov-bar').waitFor();
  assert.ok(await header.evaluate(el=>el.isConnected),'Shared header must persist across navigation');
  await page.goto(cfg.url+'panel/connections');
 }
 async function check(name){
  await page.evaluate(()=>document.fonts.ready);
  assert.equal(await page.locator('html').getAttribute('data-palette'),DEFAULT_PALETTE);
  assert.equal(await page.locator('html').getAttribute('data-mode'),'light');
  const bg = await page.locator('html').evaluate(el=>el.style.getPropertyValue('--app-bg').trim());
  assert.equal(bg,themeTokens().bg);
  await page.screenshot({path:path.join(cfg.output,'concept-3-'+name+'.png'),fullPage:true});
 }
 console.log('PASS: desktop horizontal header, mobile navigation gestures and settings drawer, responsive monitoring tiles and graph modes and horizontal inbound selection with scoped clients');
 console.log('PASS: inbound cards, scoped clients, inline details/back, scoped key creation and unchanged original keys');
 console.log('PASS: saved Sudoku client → real web QR modal → JSON/CSRF request → Shadowrocket QR and anonymous profile fetch; original key unchanged');
 assert.deepEqual(errors,[]);console.log('PASS: real panel login, dashboard, inbounds, clients, settings and dialogs with concept 3.0 and saved legacy appearance preferences');
}finally{if(desktop)await desktop.close();if(browser)await browser.close();}
