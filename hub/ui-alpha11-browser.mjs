// Visual checks against a disposable, loopback-only panel.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from '../frontend/node_modules/playwright/index.mjs';
let raw='';for await(const chunk of process.stdin)raw+=chunk;const cfg=JSON.parse(raw);
const browser=await chromium.launch({headless:true}),report=[];
try {
 for(const dark of [false,true]) {
  const context=await browser.newContext({viewport:{width:1440,height:900}});
  await context.addCookies([{name:'lang',value:dark?'ru-RU':'en-US',url:cfg.url}]);
  await context.addInitScript(value=>{localStorage.setItem('dark-mode',String(value));localStorage.setItem('sidebar-pinned','true');},dark);
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/panel/api/inbounds/list/slim',route=>route.fulfill({json:{success:true,obj:[{id:1,protocol:'vless',remark:'UI density fixture',enable:false,port:12345,up:0,down:0,total:0,expiryTime:0,settings:'{"clients":[]}',streamSettings:'{"network":"tcp","security":"none"}',sniffing:'{}',tag:'ui-fixture'}]}}));
  await page.goto(cfg.url);await page.locator('input[autocomplete=username]').fill(cfg.user);await page.locator('input[autocomplete=current-password]').fill(cfg.password);await page.locator('button[type=submit]').click();await page.waitForURL('**/panel/');
  const api=cfg.url+'panel/api/clients/';
  const client={id:'3aaa7053-c864-4b10-b088-7a1e560a3411',email:'alpha11-ui-client',enable:true,group:'retained-group',comment:'UI check',totalGB:10737418240,expiryTime:0,subId:'alpha11ui',security:'auto'};
  const csrf=(await (await context.request.get(cfg.url+'csrf-token')).json()).obj;
  async function post(path,data){const response=await context.request.post(api+path,{data,headers:{'X-CSRF-Token':typeof csrf==='string'?csrf:csrf.token}});const result=await response.json();assert.equal(result.success,true,JSON.stringify(result));return result;}
  const inboundResponse=await context.request.post(cfg.url+'panel/api/inbounds/add',{data:{remark:'Local UI lab',enable:false,listen:'127.0.0.1',port:18444,protocol:'vless',settings:'{"clients":[],"decryption":"none"}',streamSettings:'{"network":"tcp","security":"none"}',sniffing:'{}',allocate:'{}'},headers:{'X-CSRF-Token':csrf}});const inboundResult=await inboundResponse.json();assert.equal(inboundResult.success,true,JSON.stringify(inboundResult));
  await post('add',{client,inboundIds:[inboundResult.obj.id]});
  await page.goto(cfg.url+'panel/clients');await page.getByText(client.email,{exact:true}).waitFor();
  const toggleResponse=page.waitForResponse(r=>r.url().includes('/clients/update/'+client.email)&&r.request().method()==='POST');await page.locator('.ant-table-tbody').getByRole('switch').first().click();assert.equal((await (await toggleResponse).json()).success,true);
  await post('update/'+client.email,{...client,comment:'Edited UI check',enable:false});
  const saved=await (await context.request.get(api+'get/'+client.email)).json();assert.equal(saved.obj.client.group,'retained-group');assert.equal(saved.obj.client.enable,false);
  await post('update/'+client.email,{...client,comment:'Edited UI check',enable:true});
  for(const width of [1920,1440,390]) {
   await page.setViewportSize({width,height:width===1920?1080:900});
   for(const route of ['clients','inbounds']) {
    await page.goto(cfg.url+'panel/'+route);await page.locator('.section-page-title').waitFor();await page.waitForTimeout(250);
    const cards=await page.locator('.summary-card .ant-card-body').evaluateAll(es=>es.map(e=>e.getBoundingClientRect().height));
    assert.ok(cards.length>0);assert.ok(cards.every(h=>h<(width<500?360:100)),'Compact summaries '+cards);
    if(route==='inbounds'&&width>500){const row=page.locator('.ant-table-tbody > tr[data-row-key]').first();await row.waitFor();const h=(await row.boundingBox()).height;assert.ok(h>=42&&h<64,'Density retained '+h);}
    await page.screenshot({path:`${cfg.output}/alpha11-${route}-${dark}-${width}.png`,fullPage:true});report.push({dark,width,route,summaryHeights:cards});
   }
   if(width>500){
    const item=page.locator('.sider-nav [data-menu-id$="-/clients"]');assert.equal(await item.locator('xpath=ancestor::*[contains(@class,"ant-menu-submenu")]').count(),0);
    assert.equal(await page.locator('.sider-nav').getByRole('menuitem',{name:/Groups|Client List/}).count(),0);
    await page.locator('.sidebar-command-trigger').first().click();await page.locator('.command-palette-modal').waitFor();
    assert.equal(await page.locator('.command-palette-item-title').filter({hasText:/^Groups$/}).count(),0);
    const heights=await page.locator('.command-palette-item').evaluateAll(es=>es.map(e=>e.getBoundingClientRect().height));assert.ok(heights.every(h=>h<62),'Compact search rows');
    const clientName=await item.innerText();await page.locator('.command-palette-input').fill(clientName.trim());await page.locator('.command-palette-item-title').filter({hasText:/^(Clients|Клиенты)$/}).waitFor();await page.waitForTimeout(350);await page.screenshot({path:`${cfg.output}/alpha11-search-${dark}-${width}.png`,fullPage:true});await page.keyboard.press('Enter');await page.waitForURL('**/panel/clients');
   } else {
    await page.keyboard.press('Control+k');const palette=page.locator('.command-palette-modal');await palette.waitFor();await page.waitForTimeout(250);const bounds=await palette.boundingBox();assert.ok(bounds.x>=0&&bounds.x+bounds.width<=width);await page.keyboard.press('Escape');
   }
  }
  await post('del/'+client.email);const deletedInbound=await context.request.post(cfg.url+'panel/api/inbounds/del/'+inboundResult.obj.id,{headers:{'X-CSRF-Token':csrf}});assert.equal((await deletedInbound.json()).success,true);await page.goto(cfg.url+'panel/groups');await page.waitForURL('**/panel/clients');await page.getByText(client.email,{exact:true}).waitFor({state:'hidden'});assert.deepEqual(errors,[]);await context.close();
 }
 fs.writeFileSync(cfg.output+'/alpha11-visual-report.json',JSON.stringify(report,null,2));console.log('PASS: '+JSON.stringify(report));
} finally {await browser.close();}
