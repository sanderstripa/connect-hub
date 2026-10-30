const {app,BrowserWindow,ipcMain,dialog,protocol,net,shell,clipboard,session}=require('electron');
const path=require('node:path'),fs=require('node:fs'),os=require('node:os');
const {pathToFileURL}=require('node:url');
const {randomBytes}=require('node:crypto');
const QRCode=require('qrcode');
const {InstallerConnection,panelURL,credentials}=require('./backend.cjs');
protocol.registerSchemesAsPrivileged([{scheme:'ch-install',privileges:{standard:true,secure:true,supportFetchAPI:true}}]);
const cache=path.join(os.tmpdir(),'connect-hub-installer-'+randomBytes(8).toString('hex'));
fs.mkdirSync(cache,{recursive:true});app.setPath('userData',cache);app.setPath('sessionData',path.join(cache,'session'));app.setAppLogsPath(path.join(cache,'logs'));
app.setAppUserModelId('com.sanderstripa.connecthub.installer');
let window,language='en',lastResult=null,busy=false,removing=false;
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
const rememberedPath=path.join(app.getPath('appData'),'Connect Hub Setup','server.json');
register('rememberedServer',async()=>{
 try{const value=JSON.parse(await fs.promises.readFile(rememberedPath,'utf8'));const checked=credentials({...value,password:'validation'});return {host:checked.host,port:checked.port,username:checked.username};}catch{return null;}
});
register('connect',async input=>{
 if(connectionBusy)throw Object.assign(new Error(),{code:'BUSY'});
 connectionRows=[];lastResult=null;
 const result=await connection.connect(input);
 const value={host:connection.secret.host,port:connection.secret.port,username:connection.secret.username};
 try{await fs.promises.mkdir(path.dirname(rememberedPath),{recursive:true});await fs.promises.writeFile(rememberedPath,JSON.stringify(value),{mode:0o600});}catch{}
 return result;
});
register('install',async input=>{if(connectionBusy||busy)throw Object.assign(new Error(),{code:'BUSY'});const result=await connection.start(input);busy=true;lastResult=null;return result;});
register('status',async()=>{const state=await connection.poll();busy=state.state==='running';if(state.state==='complete')lastResult=state;return state;});
register('access',async()=>{lastResult=await connection.access();return lastResult;});
register('qr',async()=>{if(!lastResult)throw new Error('No result');return QRCode.toDataURL(panelURL(lastResult.url),{width:176,margin:2,errorCorrectionLevel:'L',color:{dark:'#111213',light:'#ffffff'}});});
register('open',async()=>{if(lastResult)await shell.openExternal(panelURL(lastResult.url));});
register('copy',field=>{if(lastResult&&['url','username','password'].includes(field))clipboard.writeText(String(lastResult[field]));});
let connectionRows=[],connectionBusy=false;
async function withConnections(action){
 if(connectionBusy)throw Object.assign(new Error(),{code:'BUSY'});
 connectionBusy=true;
 try{return await action();}finally{connectionBusy=false;}
}
register('uninstall',()=>withConnections(async()=>{
 if(busy)throw Object.assign(new Error(),{code:'BUSY'});
 if(!connection.connected)throw Object.assign(new Error(),{code:'DISCONNECTED'});
 const ru=language==='ru';
 const answer=await dialog.showMessageBox(window,{type:'warning',title:ru?'Удалить Connect Hub':'Remove Connect Hub',message:(ru?'Удалить Connect Hub с сервера ':'Remove Connect Hub from ')+connection.secret.host+'?',detail:ru?'Будут удалены панель, все её подключения, ключи, данные и сертификаты в каталогах Connect Hub. VPN перестанет работать. Сначала сохраните резервную копию базы через панель, если хотите восстановить настройки. BBR, подкачка, внешние базы данных и другие службы сохранятся.':'The panel, all its connections, keys, data and certificates in Connect Hub directories will be deleted. VPN will stop working. Save a database backup in the panel first if you want to restore settings. BBR, swap, external databases and other services are retained.',buttons:ru?['Отмена','Удалить с сервера']:['Cancel','Remove from server'],defaultId:0,cancelId:0,noLink:true});
 if(answer.response!==1)return {removed:false};
 removing=true;try{const result=await connection.uninstall();lastResult=null;connectionRows=[];return result;}finally{removing=false;}
}));
register('connections',()=>withConnections(async()=>{connectionRows=await connection.connections();return connectionRows;}));
register('createConnections',input=>withConnections(async()=>{const result=await connection.createConnections(input);connectionRows=result.rows;return result;}));
register('panelAuth',input=>{
 if(!input||typeof input.username!=='string'||typeof input.password!=='string'||input.username.length>512||input.password.length>4096)throw new Error('Invalid credentials');
 connection.panelAuth={username:input.username,password:input.password};
});
function connectionRow(id,variant='standard'){if(!['standard','shadowrocket'].includes(variant))throw new Error('Unknown format');const row=connectionRows.find(row=>row.id===id&&row.enabled&&row.url);if(!row)throw new Error('Unknown connection');const url=variant==='shadowrocket'?row.shadowrocketUrl:row.url;if(!url)throw new Error('Unavailable format');return {...row,url};}
register('editorSchema',()=>require('./advanced-fields.cjs'));
register('connectionDetails',id=>withConnections(()=>connection.connectionDetails(id)));
register('generateKeys',kind=>withConnections(()=>connection.panelRequest({action:'generate',kind})));
register('updateConnection',input=>withConnections(async()=>{connectionRows=await connection.updateConnection(input);return connectionRows;}));
register('connectionQR',(id,variant)=>QRCode.toDataURL(connectionRow(id,variant).url,{width:320,margin:2,errorCorrectionLevel:'L'}));
register('copyConnection',(id,variant)=>clipboard.writeText(connectionRow(id,variant).url));
register('saveConnectionQR',async(id,variant)=>{
 const row=connectionRow(id,variant);
 const file=await dialog.showSaveDialog(window,{defaultPath:'Connect-Hub-'+row.protocol+'-'+row.port+(variant==='shadowrocket'?'-Shadowrocket':'')+'.png',filters:[{name:'PNG',extensions:['png']}]});
 if(!file.canceled&&file.filePath)await fs.promises.writeFile(file.filePath,await QRCode.toBuffer(row.url,{width:768,margin:2,errorCorrectionLevel:'L'}));
});
register('saveConnections',async()=>{
 const rows=connectionRows.filter(row=>row.enabled&&row.url);
 if(!rows.length)throw new Error('No connections');
 const file=await dialog.showSaveDialog(window,{defaultPath:'Connect-Hub-keys.txt',filters:[{name:'Text',extensions:['txt']}]});
 if(!file.canceled&&file.filePath)await fs.promises.writeFile(file.filePath,rows.map(row=>row.name+'\n'+row.url+(row.shadowrocketUrl?'\nYAML · Shadowrocket\n'+row.shadowrocketUrl:'')).join('\n\n')+'\n',{mode:0o600});
});
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
 window=new BrowserWindow({width:1100,height:860,minWidth:900,minHeight:700,frame:false,show:process.env.CONNECT_HUB_UI_TEST!=='1',backgroundColor:'#08090b',title:'Connect. Hub',icon:path.join(__dirname,'assets/icon.ico'),webPreferences:{preload:path.join(__dirname,'preload.cjs'),nodeIntegration:false,contextIsolation:true,sandbox:true,spellcheck:false,backgroundThrottling:false,offscreen:process.env.CONNECT_HUB_UI_TEST==='1'}});
 window.webContents.setWindowOpenHandler(()=>({action:'deny'}));
 window.webContents.on('will-navigate',(event,url)=>{if(url!==origin)event.preventDefault();});
 window.on('close',event=>{
  if(removing){event.preventDefault();return;}
  if(!busy)return;
  event.preventDefault();const ru=language==='ru';
  dialog.showMessageBox(window,{type:'question',message:ru?'Установка продолжится на сервере. Закрыть окно?':'Installation will continue on the server. Close this window?',detail:ru?'Повторно подключитесь к серверу, чтобы увидеть результат.':'Reconnect to the server to see the result.',buttons:ru?['Остаться','Закрыть']:['Stay','Close'],defaultId:0,cancelId:0}).then(answer=>{if(answer.response===1){busy=false;window.close();}});
 });
 window.on('closed',()=>{connection.disconnect();lastResult=null;window=null;});
 await window.loadURL(origin);
});
app.on('window-all-closed',()=>app.quit());
