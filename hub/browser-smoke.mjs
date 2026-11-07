import { chromium } from '../frontend/node_modules/playwright/index.mjs';
import { checkBrand, checkDensity } from './brand-browser-check.mjs';
let input='';for await(const chunk of process.stdin)input+=chunk;
const cfg=JSON.parse(input),browser=await chromium.launch({headless:true});
try {
 const page=await browser.newPage({locale:'en-US',viewport:{width:1440,height:1000}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 page.on('response',r=>{if(r.status()>=400&&/\.woff2/.test(r.url()))console.log('Font response:',r.status(),r.url());});
 page.on('requestfailed',r=>{if(/\.woff2/.test(r.url()))console.log('Font request:',r.url(),r.failure()?.errorText);});
 await page.goto(cfg.url);
 await page.locator('input[autocomplete="username"]').waitFor();
 await checkBrand(page,cfg.output,'login');
 await page.locator('#login-theme-cycle').click();
 await checkBrand(page,cfg.output,'login');
 await page.locator('#login-theme-cycle').click();
 await page.locator('input[autocomplete="username"]').fill(cfg.user);
 await page.locator('input[autocomplete="current-password"]').fill(cfg.password);
 await page.locator('button[type="submit"]').click();await page.waitForURL('**/panel/');
 await page.goto(cfg.url+'panel/connections');
 if(await page.getByRole('tab',{name:'Sudoku',exact:true}).count())throw Error('Separate Sudoku tab must not exist');
 await page.getByRole('button',{name:'Create inbound',exact:true}).click();
 let modal=page.getByRole('dialog');
 await modal.getByRole('textbox',{name:'Remark',exact:true}).fill('Unified Sudoku');
 await modal.getByRole('spinbutton',{name:'Port',exact:true}).fill(String(cfg.port));
 await modal.locator('#protocol').click();
 const dropdown=page.locator('.ant-select-dropdown:visible').last();await dropdown.hover();await page.mouse.wheel(0,2400);await page.waitForTimeout(200);
 await dropdown.getByText('Sudoku',{exact:true}).click();
 await checkBrand(page,cfg.output,'inbound-form');
 if(await modal.getByRole('textbox',{name:'Remark',exact:true}).inputValue()!=='Unified Sudoku')throw Error('Lost shared remark');
 if(await modal.getByRole('spinbutton',{name:'Port',exact:true}).inputValue()!==String(cfg.port))throw Error('Lost shared port');
 if(await modal.locator('#sudoku-host,#sudoku-port,#sudoku-name').count())throw Error('Separate Sudoku form is still present');
 const creating=page.waitForResponse(r=>r.request().method()==='POST'&&new URL(r.url()).pathname.endsWith('/inbounds/add'));
 await modal.getByRole('button',{name:'Create',exact:true}).click();
 const result=await(await creating).json();if(!result.success)throw Error('Ordinary inbound creation failed: '+JSON.stringify(result));
 await modal.waitFor({state:'hidden'});
 const row=page.locator('#connection-inbounds .inbound-card').filter({hasText:'Unified Sudoku'});await row.waitFor();await row.click();
 await page.getByRole('button',{name:'Create key',exact:true}).click();modal=page.locator('.client-form-modal');
 await modal.getByPlaceholder('Email',{exact:true}).fill('browser-phone');
 // Creating a key inside a selected inbound pre-attaches it without a second manual selection.
 const adding=page.waitForResponse(r=>r.request().method()==='POST'&&new URL(r.url()).pathname.endsWith('/clients/add'));
 await modal.getByRole('button',{name:'Create',exact:true}).click();
 const added=await(await adding).json();if(!added.success)throw Error('Ordinary client creation failed: '+JSON.stringify(added));
 await modal.waitFor({state:'hidden'});
 const phone=page.getByRole('row').filter({has:page.getByText('browser-phone',{exact:true})});await phone.waitFor();
 await phone.getByRole('button',{name:'QR Code',exact:true}).click();
 const qr=page.locator('.connection-detail-surface').filter({hasText:'browser-phone'});await qr.waitFor();
 await checkBrand(page,cfg.output,'client-qr');
 const links=await page.request.get(cfg.url+'panel/api/clients/links/browser-phone');
 const exported=await links.json();if(!exported.success||!JSON.stringify(exported.obj).includes('sudoku://'))throw Error('No native share link');
 await page.screenshot({path:cfg.output+'/native-sudoku-client-qr.png',fullPage:true});
 await page.goto(cfg.url+'panel/connections');await row.waitFor();
 await row.click();await page.locator('#connection-keys').getByRole('button',{name:'Settings',exact:true}).click();modal=page.getByRole('dialog');
 await modal.getByRole('textbox',{name:'Remark',exact:true}).fill('Unified Sudoku edited');
 await modal.getByRole('button',{name:'Save Changes',exact:true}).click();await modal.waitFor({state:'hidden'});
 await page.locator('#connection-inbounds .inbound-card-title').filter({hasText:'Unified Sudoku edited'}).first().waitFor();
 await page.context().addCookies([{name:'lang',value:'ru-RU',url:cfg.url}]);await page.reload();
 await page.locator('#connection-inbounds .inbound-card-title').filter({hasText:'Unified Sudoku edited'}).first().waitFor();
 await page.screenshot({path:cfg.output+'/unified-inbounds-desktop.png',fullPage:true});
 await checkBrand(page,cfg.output,'inbounds');
 await page.locator('.ant-sidebar').hover();
 await page.locator('#theme-cycle').click();
 await checkBrand(page,cfg.output,'inbounds');
 await page.evaluate(()=>localStorage.setItem('sidebar-pinned','true'));
 for(const dark of [false,true]){
  if(await page.evaluate(()=>document.body.classList.contains('dark'))!==dark){await page.locator('.ant-sidebar').hover();await page.locator('#theme-cycle').click();}
  for(const route of ['connections','groups','nodes','hosts','outbound','routing','settings','xray','api-docs']){
   await page.goto(cfg.url+'panel/'+route);await page.locator('.ant-sidebar').waitFor();await page.locator('.ant-sidebar').hover();await page.waitForTimeout(400);
   if(await page.locator('.sider-nav').getByText('Connect. Hub',{exact:true}).count())throw Error('Connect Hub menu must remain hidden');
   await checkDensity(page,cfg.output,route+'-'+(dark?'dark':'light'));
  }
 }
 await page.goto(cfg.url+'panel/connections');await page.locator('#connection-inbounds .inbound-card-title').filter({hasText:'Unified Sudoku edited'}).first().waitFor();
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(500);
 if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1))throw Error('Mobile overflow');
 await page.screenshot({path:cfg.output+'/unified-inbounds-mobile.png',fullPage:true});
 if(errors.length)throw Error(errors.join('\n'));
 console.log('PASS: Connections create inbound/Basic/Protocol/Sudoku, key Create/QR, inbound edit and RU/mobile rendering');
}finally{await browser.close()}
