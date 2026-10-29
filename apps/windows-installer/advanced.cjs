const {isIP}=require('node:net');
const fields=require('./advanced-fields.cjs');
const fail=()=>{throw Object.assign(new Error('INVALID_ADVANCED'),{code:'INVALID_ADVANCED'});};
function record(value){if(!value||typeof value!=='object'||Array.isArray(value))fail();for(const [key,v]of Object.entries(value)){if(['__proto__','constructor','prototype'].includes(key))fail();if(v&&typeof v==='object'){if(Array.isArray(v)){for(const x of v)if(x&&typeof x==='object')record(x);}else record(v);}}return value;}
function decode(value){return record(typeof value==='string'?JSON.parse(value||'{}'):structuredClone(value||{}));}
function draft(inbound){const v=structuredClone(inbound);for(const k of ['settings','streamSettings','sniffing'])v[k]=decode(v[k]);const r=v.streamSettings?.realitySettings;if(r&&!r.target&&r.dest)r.target=r.dest;return v;}
function set(v,path,value){const keys=path.split('.');for(let i=0;i<keys.length-1;i++){if(v[keys[i]]==null)v[keys[i]]=/^\d+$/.test(keys[i+1])?[]:{};v=v[keys[i]];}v[keys.at(-1)]=value;}
function applyAdvanced(inbound,input={}){
 if(JSON.stringify(input).length>128*1024)fail();const out=draft(inbound);
 const changes=record(input.changes||{});
 for(const [path,value]of Object.entries(changes)){
  const f=fields.find(f=>f[1]===path);if(!f)fail();const type=f[2];
  if(['number','gb','date'].includes(type)&&(!Number.isSafeInteger(value)||value<0&&path!=='subSortIndex'))fail();
  if(type==='check'&&typeof value!=='boolean')fail();
  if(type==='select'&&!f[5].includes(value))fail();
  if(['text','secret'].includes(type)&&(typeof value!=='string'||value.length>16384||/[\0\r\n]/.test(value)))fail();
  if(type==='list'&&(!Array.isArray(value)||value.length>256||value.some(x=>typeof x!=='string'||x.length>1024)))fail();
  if(type==='json')record(value);
  set(out,path,value);
 }
 for(const [key,value]of Object.entries(input.raw||{})){if(!['settings','streamSettings','sniffing'].includes(key))fail();out[key]=decode(value);}
 if(!Number.isInteger(out.port)||out.port<1||out.port>65535||out.nodeId)fail();
 if(out.listen&&!isIP(out.listen))fail();
 if(typeof out.remark!=='string'||out.remark.length>160)fail();
 if(changes['streamSettings.realitySettings.serverNames']){const r=out.streamSettings.realitySettings;r.settings||={};r.settings.serverName=r.serverNames[0]||'';}
 if(out.protocol==='vless'){
  const s=out.streamSettings;
  if(s.security==='reality'){
   const r=s.realitySettings||{};
   if(!r.privateKey||(!out.id&&!r.settings?.publicKey)||!/^.+:\d+$/.test(r.target||'')||!r.serverNames?.length||r.shortIds?.some(x=>!/^(?:[a-f\d]{2}){0,8}$/i.test(x)))fail();
   if(!['tcp','raw','xhttp','grpc'].includes(s.network))fail();
  }
  // XTLS Vision applies to TCP/Reality or TCP/TLS only.
  if(!['tcp','raw'].includes(s.network)||s.security==='none')for(const c of out.settings.clients||[])c.flow='';
  if(out.settings.decryption&&out.settings.decryption!=='none'){
   if(!out.settings.encryption||out.settings.encryption==='none'||out.settings.fallbacks?.length)fail();
   delete out.settings.fallbacks;
  }
 }
 for(const k of ['settings','streamSettings','sniffing'])out[k]=JSON.stringify(out[k]);return out;
}
module.exports={applyAdvanced,draft};
