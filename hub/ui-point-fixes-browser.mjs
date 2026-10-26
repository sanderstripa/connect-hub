// Four scoped UI checks against a disposable panel; no real configurations used.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from '../frontend/node_modules/playwright/index.mjs';
let raw='';for await(const chunk of process.stdin)raw+=chunk;const cfg=JSON.parse(raw);
const browser=await chromium.launch({headless:true}),report=[];
try{
 for(const dark of [false,true]){
  const context=await browser.newContext({locale:'en-US',viewport:{width:1440,height:1000}});
  await context.addInitScript(value=>{localStorage.setItem('dark-mode',String(value));localStorage.setItem('sidebar-pinned','true');},dark);
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/panel/api/inbounds/list/slim',route=>route.fulfill({json:{success:true,obj:[{id:1,protocol:'vless',remark:'UI density fixture',enable:false,port:12345,up:0,down:0,total:0,expiryTime:0,settings:'{"clients":[]}',streamSettings:'{"network":"tcp","security":"none"}',sniffing:'{}',tag:'ui-fixture'}]}}));
  await page.goto(cfg.url);await page.locator('input[autocomplete=username]').fill(cfg.user);await page.locator('input[autocomplete=current-password]').fill(cfg.password);await page.locator('button[type=submit]').click();await page.waitForURL('**/panel/');
  const clients=page.locator('.sider-nav [data-menu-id$="-__clients"]');await clients.click();await page.waitForURL('**/panel/clients');
  const groups=page.locator('.sider-nav').getByRole('menuitem',{name:/Groups/});await groups.waitFor({state:'visible'});await groups.click();await page.waitForURL('**/panel/groups');await clients.click();await page.waitForURL('**/panel/clients');
  const folders=page.locator('.sider-nav .ant-menu-submenu-title:visible');
  for(let n=0;n<await folders.count();n++){const title=folders.nth(n);if(await title.getAttribute('aria-expanded')!=='true')await title.click();}
  await page.waitForTimeout(350);
  const colors=await page.locator('.sider-nav .ant-menu-sub .ant-menu-item').evaluateAll(elements=>elements.filter(e=>e.getBoundingClientRect().height>0).map(e=>({text:getComputedStyle(e).color,bg:getComputedStyle(e.parentElement).backgroundColor})));
  assert.ok(colors.length>5);for(const color of colors){const rgb=color.text.match(/[\d.]+/g).slice(0,3).map(Number);assert.ok(Math.max(...rgb)-Math.min(...rgb)<45,'Menu text must be neutral '+color.text);}
  await page.screenshot({path:cfg.output+'/point-menu-'+dark+'.png',fullPage:true});
  await page.locator('.sidebar-command-trigger').first().click();await page.locator('.command-palette-modal').waitFor();
  const search=await page.locator('.command-palette-search-icon').evaluate(el=>getComputedStyle(el).color);const rgb=search.match(/[\d.]+/g).slice(0,3).map(Number);assert.ok(Math.max(...rgb)-Math.min(...rgb)<45);
  await page.locator('.command-palette-input').focus();assert.equal(await page.locator('.command-palette-input').evaluate(el=>getComputedStyle(el).outlineStyle),'solid');
  await page.screenshot({path:cfg.output+'/point-search-'+dark+'.png',fullPage:true});await page.keyboard.press('Escape');
  await page.goto(cfg.url+'panel/inbounds');const row=page.locator('.ant-table-tbody > tr[data-row-key]').first();await row.waitFor();await page.waitForTimeout(200);
  const height=(await row.boundingBox()).height;assert.ok(height>=42&&height<64,'Compact inbound row '+height);assert.ok(await row.getByRole('switch').isVisible());assert.ok(await page.getByText('UI density fixture',{exact:true}).isVisible());
  await page.screenshot({path:cfg.output+'/point-inbounds-'+dark+'.png',fullPage:true});
  assert.deepEqual(errors,[]);report.push({dark,oneClickClients:true,groupsAccessible:true,menuItems:colors.length,searchColor:search,inboundRowHeight:height,consoleErrors:errors});await context.close();
 }
 fs.writeFileSync(cfg.output+'/ui-point-fixes-report.json',JSON.stringify(report,null,2));console.log('PASS: CH-01 through CH-04 in light and dark themes; '+JSON.stringify(report));
}finally{await browser.close();}
