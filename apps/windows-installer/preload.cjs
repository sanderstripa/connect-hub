const {contextBridge,ipcRenderer}=require('electron');
const invoke=(method,...args)=>ipcRenderer.invoke('installer:'+method,...args);
contextBridge.exposeInMainWorld('installer',Object.freeze({
 editorSchema:()=>invoke('editorSchema'),connectionDetails:id=>invoke('connectionDetails',id),generateKeys:kind=>invoke('generateKeys',kind),updateConnection:value=>invoke('updateConnection',value),rememberedServer:()=>invoke('rememberedServer'),connections:()=>invoke('connections'),createConnections:value=>invoke('createConnections',value),panelAuth:value=>invoke('panelAuth',value),connectionQR:id=>invoke('connectionQR',id),copyConnection:id=>invoke('copyConnection',id),saveConnectionQR:id=>invoke('saveConnectionQR',id),saveConnections:()=>invoke('saveConnections'),
 locale:()=>invoke('locale'),version:()=>invoke('version'),language:value=>invoke('language',value),connect:value=>invoke('connect',value),
 install:value=>invoke('install',value),status:()=>invoke('status'),access:()=>invoke('access'),qr:()=>invoke('qr'),
 open:()=>invoke('open'),copy:field=>invoke('copy',field),minimize:()=>invoke('minimize'),close:()=>invoke('close'),
}));
