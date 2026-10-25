const {app,BrowserWindow,ipcMain,dialog,protocol,net,shell,clipboard,session}=require('electron');
const path=require('node:path'),fs=require('node:fs'),os=require('node:os');
const {pathToFileURL}=require('node:url');
const {randomBytes}=require('node:crypto');
const QRCode=require('qrcode');
const {InstallerConnection,panelURL}=require('./backend.cjs');
protocol.registerSchemesAsPrivileged([{scheme:'ch-install',privileges:{standard:true,secure:true,supportFetchAPI:true}}]);
const cache=path.join(os.tmpdir(),'connect-hub-installer-'+randomBytes(8).toString('hex'));
fs.mkdirSync(cache,{recursive:true});app.setPath('userData',cache);app.setPath('sessionData',path.join(cache,'session'));app.setAppLogsPath(path.join(cache,'logs'));
app.setAppUserModelId('com.sanderstripa.connecthub.installer');
let window,language='en',lastResult=null,busy=false;
const trusted=new Map();
const connection=new InstallerConnection({trustHost:async({host,port,fingerprint})=>{
 const target=host+':'+port;if(trusted.get(target)===fingerprint)return true;
 const ru=language==='ru';
 const answer=await dialog.showMessageBox(window,{type:'question',title:ru?'Ключ сервера':'Server identity',message:ru?'Подключиться к этому серверу?':'Connect to this server?',detail:target+'\n\n'+fingerprint+'\n\n'+(ru?'Сверьте отпечаток SSH-ключа с данными вашего сервера.':'Compare this SSH key fingerprint with your server details.'),buttons:ru?['Отмена','Подключиться']:['Cancel','Connect'],defaultId:0,cancelId:0,noLink:true});
 if(answer.response!==1)return false;trusted.set(target,fingerprint);return true;
}});
const origin='ch-install://app/ui/index.html';
function register(name,handler){ipcMain.handle('installer:'+name,async(event,...args)=>{
 if(!window||event.sender!==window.webContents||event.senderFrame.url!==origin)throw new Error('Invalid caller');
 try{return {ok:true,value:await handler(...args)};}catch(error){return {ok:false,error:typeof error.code==='string'?error.code:'OPERATION_FAILED'};}
});}
register('locale',()=>app.getLocale().startsWith('ru')?'ru':'en');
register('version',()=>JSON.parse(fs.readFileSync(path.join(__dirname,'assets/BUILD.json'),'utf8')));
register('language',value=>{language=value==='ru'?'ru':'en';});
register('connect',async input=>{lastResult=null;return connection.connect(input);});
register('install',async input=>{const result=await connection.start(input);busy=true;lastResult=null;return result;});
register('status',async()=>{const state=await connection.poll();busy=state.state==='running';if(state.state==='complete')lastResult=state;return state;});
register('access',async()=>{lastResult=await connection.access();return lastResult;});
register('qr',async()=>{if(!lastResult)throw new Error('No result');return QRCode.toDataURL(panelURL(lastResult.url),{width:176,margin:2,errorCorrectionLevel:'M',color:{dark:'#111213',light:'#ffffff'}});});
register('open',async()=>{if(lastResult)await shell.openExternal(panelURL(lastResult.url));});
register('copy',field=>{if(lastResult&&['url','username','password'].includes(field))clipboard.writeText(String(lastResult[field]));});
register('minimize',()=>window.minimize());
register('close',()=>window.close());
app.whenReady().then(async()=>{
 protocol.handle('ch-install',request=>{
  const url=new URL(request.url);let relative;try{relative=decodeURIComponent(url.pathname);}catch{return new Response('',{status:400});}
  if(url.hostname!=='app'||!/^\/(ui|assets)\//.test(relative))return new Response('',{status:403});
  const target=path.resolve(__dirname,'.'+relative);
  if(!target.startsWith(path.resolve(__dirname)+path.sep))return new Response('',{status:403});
  return net.fetch(pathToFileURL(target).href);
 });
 session.defaultSession.setPermissionRequestHandler((_webContents,_permission,callback)=>callback(false));
 window=new BrowserWindow({width:860,height:760,minWidth:720,minHeight:650,frame:false,show:process.env.CONNECT_HUB_UI_TEST!=='1',backgroundColor:'#0b0b0b',title:'Connect. Hub',icon:path.join(__dirname,'assets/icon.ico'),webPreferences:{preload:path.join(__dirname,'preload.cjs'),nodeIntegration:false,contextIsolation:true,sandbox:true,spellcheck:false,backgroundThrottling:false,offscreen:process.env.CONNECT_HUB_UI_TEST==='1'}});
 window.webContents.setWindowOpenHandler(()=>({action:'deny'}));
 window.webContents.on('will-navigate',(event,url)=>{if(url!==origin)event.preventDefault();});
 window.on('close',event=>{
  if(!busy)return;
  event.preventDefault();const ru=language==='ru';
  dialog.showMessageBox(window,{type:'question',message:ru?'Установка продолжится на сервере. Закрыть окно?':'Installation will continue on the server. Close this window?',detail:ru?'Повторно подключитесь к серверу, чтобы увидеть результат.':'Reconnect to the server to see the result.',buttons:ru?['Остаться','Закрыть']:['Stay','Close'],defaultId:0,cancelId:0}).then(answer=>{if(answer.response===1){busy=false;window.close();}});
 });
 window.on('closed',()=>{connection.disconnect();lastResult=null;window=null;});
 await window.loadURL(origin);
});
app.on('window-all-closed',()=>app.quit());
