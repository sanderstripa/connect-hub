const path=require('node:path'),fs=require('node:fs'),assert=require('node:assert/strict');
const {_electron}=require('playwright');
const {fixture}=require('./ssh-fixture.cjs');
(async()=>{
 const base=path.resolve(__dirname,'..'),output=path.resolve(base,'../../dist/desktop-evidence');fs.mkdirSync(output,{recursive:true});
 const server=await fixture();let app;
 try{
  app=await _electron.launch({executablePath:process.argv[2]?path.resolve(process.argv[2]):require('electron'),args:process.argv[2]?[]:[base],env:{...process.env,CONNECT_HUB_UI_TEST:'1'}});
  await app.evaluate(({dialog,clipboard,shell,app})=>{global.wizardTest={copies:[],opened:[],qr:[]};dialog.showMessageBox=async()=>({response:1});clipboard.writeText=text=>global.wizardTest.copies.push(text);shell.openExternal=async url=>{global.wizardTest.opened.push(url);};const require=process.getBuiltinModule('module').createRequire(app.getAppPath()+'/main.cjs');const QR=require('qrcode');const original=QR.toDataURL;QR.toDataURL=(value,...rest)=>{global.wizardTest.qr.push(value);return original(value,...rest);};});
  const page=await app.firstWindow();await page.locator('#host').waitFor();await page.locator('#ru').click();await page.evaluate(()=>document.fonts.ready);
  assert.equal(await page.evaluate(()=>typeof window.require),'undefined');
  await page.screenshot({path:path.join(output,'windows-welcome-dark.png')});await page.locator('#theme').click();await page.screenshot({path:path.join(output,'windows-welcome-light.png')});
  await page.locator('#host').fill(server.host);await page.locator('#port').fill(String(server.port));await page.locator('#username').fill(server.username);await page.locator('#ssh-password').fill(server.password);await page.locator('#connect').click();
  await page.locator('#configuration').waitFor({state:'visible'});assert.match(await page.locator('#hardware').innerText(),/Debian GNU\/Linux 13/);assert.equal(await page.locator('#ssh-password').inputValue(),'');
  await page.screenshot({path:path.join(output,'windows-options-light.png')});await page.locator('#install').click();await page.locator('#result').waitFor({state:'visible'});await page.locator('#qr').waitFor();
  await page.waitForFunction(()=>document.getElementById('qr').complete&&document.getElementById('qr').naturalWidth>0);
  assert.equal(await page.locator('#result-password').getAttribute('type'),'password');assert.equal(await page.locator('#result-url').inputValue(),server.result.url);
  const before=await app.evaluate(()=>global.wizardTest);assert.deepEqual(before.copies,[]);assert.deepEqual(before.qr,[server.result.url]);assert.ok(!before.qr[0].includes(server.result.password));
  await page.locator('[data-copy="url"]').click();await page.locator('#open-panel').click();
  const after=await app.evaluate(()=>global.wizardTest);assert.deepEqual(after.copies,[server.result.url]);assert.deepEqual(after.opened,[server.result.url]);
  await page.screenshot({path:path.join(output,'windows-result-light.png')});await page.locator('#theme').click();await page.screenshot({path:path.join(output,'windows-result-dark.png')});
  assert.ok(!server.sources[0].includes(server.password));
  console.log('PASS: actual Windows window, RU/EN, two local Montserrat themes, encrypted SSH, setup options, masked credentials, address-only QR and explicit clipboard/browser actions');
 }finally{if(app)await app.close();await server.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
