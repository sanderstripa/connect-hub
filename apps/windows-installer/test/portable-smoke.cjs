const {chromium}=require('playwright');
const {spawn}=require('node:child_process');
const net=require('node:net'),path=require('node:path'),fs=require('node:fs'),assert=require('node:assert/strict');
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
(async()=>{
 assert.equal(process.platform,'win32');
 const executable=path.resolve(process.argv[2]||'../../dist/windows-installer/Connect-Hub-Setup.exe');
 assert.ok(fs.statSync(executable).size>1000000);
 const probe=net.createServer();await new Promise(resolve=>probe.listen(0,'127.0.0.1',resolve));const port=probe.address().port;await new Promise(resolve=>probe.close(resolve));
 const child=spawn(executable,['--remote-debugging-port='+port,'--remote-debugging-address=127.0.0.1'],{env:{...process.env,CONNECT_HUB_UI_TEST:'1'},windowsHide:true,stdio:'ignore'});let browser,closed=false;child.on('exit',()=>{closed=true;});
 try{
  for(let n=0;n<180;n++){
   try{const response=await fetch('http://127.0.0.1:'+port+'/json/version');if(response.ok)break;}catch{}
   if(n===179)throw Error('Portable EXE did not expose its test renderer');await delay(500);
  }
  browser=await chromium.connectOverCDP('http://127.0.0.1:'+port);const context=browser.contexts()[0];let page;
  for(let n=0;n<40;n++){page=context.pages().find(p=>p.url().startsWith('ch-install://app/'));if(page)break;await delay(250);}
  assert.ok(page,'Packaged window missing');await page.locator('#host').waitFor();await page.locator('#ru').click();await page.evaluate(()=>document.fonts.ready);
  assert.equal(await page.evaluate(()=>typeof window.require),'undefined');assert.equal(await page.locator('#connection').isVisible(),true);
  assert.equal(await page.locator('body').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(16, 22, 30)');
  const font=await page.locator('h1:visible').evaluate(el=>getComputedStyle(el).fontFamily);assert.match(font,/Montserrat/);
  const output=path.resolve('../../dist/desktop-evidence');fs.mkdirSync(output,{recursive:true});await page.screenshot({path:path.join(output,'portable-exe-welcome.png')});
  await page.locator('#theme').click();assert.equal(await page.locator('body').getAttribute('data-theme'),'light');
  assert.equal(await page.locator('body').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(242, 246, 249)');
  const primary=await page.locator('#connect').evaluate(el=>({color:getComputedStyle(el).color,weight:getComputedStyle(el).fontWeight}));assert.equal(primary.color,'rgb(255, 255, 255)');assert.equal(primary.weight,'600');
  await page.screenshot({path:path.join(output,'portable-exe-welcome-light.png')});
  const build=await page.evaluate(()=>window.installer.version());assert.equal(build.ok,true);assert.equal(build.value.version,require('../package.json').version);
  if(process.env.CONNECT_HUB_EXPECTED_REVISION){assert.equal(build.value.revision,process.env.CONNECT_HUB_EXPECTED_REVISION);assert.equal(build.value.dirty,false);}
  await page.evaluate(()=>window.installer.close()).catch(error=>{if(!/closed/i.test(error.message))throw error;});for(let n=0;n<60&&!closed;n++)await delay(250);
  console.log('PASS: actual downloadable portable EXE extracts, launches its own isolated Windows window, loads local Montserrat, switches language/theme and closes');
 }finally{
  if(browser)await browser.close().catch(()=>{});
  if(!closed&&child.pid){const cleanup=spawn('taskkill',['/PID',String(child.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});await new Promise(resolve=>cleanup.on('close',resolve));}
 }
})().catch(error=>{console.error(error);process.exitCode=1;});
