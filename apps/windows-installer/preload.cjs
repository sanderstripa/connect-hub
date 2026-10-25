const {contextBridge,ipcRenderer}=require('electron');
const invoke=(method,...args)=>ipcRenderer.invoke('installer:'+method,...args);
contextBridge.exposeInMainWorld('installer',Object.freeze({
 locale:()=>invoke('locale'),version:()=>invoke('version'),language:value=>invoke('language',value),connect:value=>invoke('connect',value),
 install:value=>invoke('install',value),status:()=>invoke('status'),access:()=>invoke('access'),qr:()=>invoke('qr'),
 open:()=>invoke('open'),copy:field=>invoke('copy',field),minimize:()=>invoke('minimize'),close:()=>invoke('close'),
}));
