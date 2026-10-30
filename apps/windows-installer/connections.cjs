// Connect Hub desktop connection presets and exports. GPL-3.0-only.
const {randomUUID,randomBytes}=require('node:crypto');
const {isIP}=require('node:net');
const {domainToASCII}=require('node:url');
const PRESETS=['vless','xhttp','sudoku','mtproto','shadowsocks'];
function fail(code){throw Object.assign(new Error(code),{code});}
function hostName(value){
 const host=String(value||'').trim().replace(/^\[|\]$/g,'');
 if(isIP(host))return host;
 const ascii=domainToASCII(host);
 if(!ascii||ascii.length>253||ascii.split('.').some(x=>!/^([a-z\d](?:[a-z\d-]{0,61}[a-z\d])?)$/i.test(x)))fail('INVALID_HOST');
 return ascii;
}
function selection(input){
 if(!input||!Array.isArray(input.protocols)||!input.protocols.length||input.protocols.length>5||new Set(input.protocols).size!==input.protocols.length||input.protocols.some(p=>!PRESETS.includes(p)))fail('INVALID_OPTIONS');
 const name=String(input.name||'').trim();if(!name||name.length>80||/[\x00-\x1f\x7f]/.test(name))fail('INVALID_OPTIONS');
 const email=String(input.email||'').trim();if(email.length>80||/[\s\x00-\x1f\x7f]/.test(email))fail('INVALID_OPTIONS');
 const xhttpProfile=input.xhttpProfile||'basic';if(!['basic','recommended','manual'].includes(xhttpProfile))fail('INVALID_OPTIONS');
 const host=hostName(input.host),port=Number(input.port||443),sni=hostName(input.sni||'www.cloudflare.com');
 if(!Number.isInteger(port)||port<1||port+input.protocols.length-1>65535||isIP(sni))fail('INVALID_OPTIONS');
 return {protocols:input.protocols,name,email,xhttpProfile,host,port,sni};
}
function preset(kind,selected,port,keys){
 const client={id:randomUUID(),email:selected.email?(selected.protocols.length>1?selected.email+'-'+kind:selected.email):'device-'+randomBytes(5).toString('hex'),comment:selected.name,enable:true,limitIp:0,totalGB:0,expiryTime:0,subId:randomBytes(8).toString('hex')};
 const ib={enable:true,remark:selected.name+' · '+kind.toUpperCase(),protocol:kind==='xhttp'?'vless':kind,port,listen:'',settings:'{}',streamSettings:'{}',sniffing:'{"enabled":false}',shareAddrStrategy:'custom',shareAddr:selected.host,trafficReset:'never',trafficResetDay:1};
 let settings={clients:[client]};
 if(kind==='vless'||kind==='xhttp'){
  if(!keys?.privateKey||!keys?.publicKey)fail('PANEL_REQUEST_FAILED');
  client.flow=kind==='vless'?'xtls-rprx-vision':'';
  settings.decryption='none';settings.fallbacks=[];
  ib.streamSettings=JSON.stringify({network:kind==='vless'?'tcp':'xhttp',security:'reality',realitySettings:{show:false,target:selected.sni+':443',xver:0,serverNames:[selected.sni],privateKey:keys.privateKey,shortIds:[randomBytes(8).toString('hex')],settings:{publicKey:keys.publicKey,fingerprint:'chrome',serverName:selected.sni,spiderX:'/',mldsa65Verify:''}},...(kind==='xhttp'?{xhttpSettings:{path:'/'+randomBytes(12).toString('hex'),mode:'auto'}}:{tcpSettings:{acceptProxyProtocol:false,header:{type:'none'}}})});
 }else if(kind==='sudoku')Object.assign(settings,{aead:'chacha20-poly1305',table:'prefer_ascii'});
 else if(kind==='mtproto'){
  client.secret='ee'+randomBytes(16).toString('hex')+Buffer.from(selected.sni).toString('hex');
  Object.assign(settings,{fakeTlsDomain:selected.sni,routeThroughXray:false});
 }else if(kind==='shadowsocks'){
  client.password=randomBytes(24).toString('base64url');
  Object.assign(settings,{method:'chacha20-ietf-poly1305',network:'tcp,udp',password:client.password});
 }
 ib.settings=JSON.stringify(settings);return ib;
}
const parse=value=>typeof value==='string'?JSON.parse(value||'{}'):value||{};
function exportRows(inbounds,defaultHost){
 const rows=[];
 for(const ib of inbounds){
  let settings,stream;try{settings=parse(ib.settings);stream=parse(ib.streamSettings);}catch{continue;}
  const address=ib.shareAddrStrategy==='custom'?ib.shareAddr:defaultHost;
  const host=isIP(address)===6?'['+address+']':address;
  const clients=settings.clients||[];
  if(!clients.length)rows.push({id:String(ib.id),name:ib.remark,protocol:ib.protocol,port:ib.port,enabled:!!ib.enable,url:'',reason:'NO_CLIENTS'});
  for(const client of clients){
   const name=client.comment||client.email||ib.remark;
   let url='',reason='UNSUPPORTED_EXPORT';
   // Remote-node and fallback links need the panel's endpoint resolution.
   if(!ib.nodeId&&!ib.fallbackParent&&address){
    if(ib.protocol==='sudoku'&&client.sudokuKey){url='sudoku://'+Buffer.from(JSON.stringify({h:address,p:ib.port,k:client.sudokuKey,a:(settings.table||'prefer_ascii').replace(/^prefer_/,''),e:settings.aead||'chacha20-poly1305',i:ib.id,c:client.id,m:1080,x:true,hd:true,hm:'auto',hx:'off',hy:'',n:name})).toString('base64url');}
    if(ib.protocol==='mtproto'&&client.secret)url='tg://proxy?'+new URLSearchParams({server:address,port:String(ib.port),secret:client.secret});
    if(ib.protocol==='shadowsocks'&&settings.method==='chacha20-ietf-poly1305'&&client.password&&(!stream.network||['tcp','raw'].includes(stream.network))&&(!stream.security||stream.security==='none'))url='ss://'+Buffer.from(settings.method+':'+client.password).toString('base64url')+'@'+host+':'+ib.port+'#'+encodeURIComponent(name);
    if(ib.protocol==='vless'&&['tcp','raw','xhttp','ws','grpc','httpupgrade'].includes(stream.network)&&['reality','tls','none',undefined].includes(stream.security)){
     const r=stream.realitySettings||{},tls=stream.tlsSettings||{};
     if(!(settings.fallbacks||[]).length){
      const params=new URLSearchParams({type:stream.network,security:stream.security||'none',encryption:settings.encryption||'none'});
      if(stream.security==='reality'){
       params.set('pbk',r.settings?.publicKey||'');params.set('fp',r.settings?.fingerprint||'chrome');params.set('sni',r.settings?.serverName||r.serverNames?.[0]||'');params.set('sid',r.shortIds?.[0]||'');params.set('spx',r.settings?.spiderX||'/');
       if(r.settings?.mldsa65Verify)params.set('pqv',r.settings.mldsa65Verify);
      }
      if(stream.security==='tls'){
       if(tls.serverName)params.set('sni',tls.serverName);
       if(tls.alpn?.length)params.set('alpn',tls.alpn.join(','));
       if(tls.settings?.fingerprint)params.set('fp',tls.settings.fingerprint);
       if(tls.settings?.pinnedPeerCertSha256?.length)params.set('pcs',tls.settings.pinnedPeerCertSha256.join(','));
       if(tls.settings?.echConfigList)params.set('ech',tls.settings.echConfigList);
       if(tls.settings?.verifyPeerCertByName)params.set('vcn',tls.settings.verifyPeerCertByName);
      }
      if(stream.finalmask){const fm=structuredClone(stream.finalmask);for(const layer of ['tcp','udp'])if(Array.isArray(fm[layer]))fm[layer]=fm[layer].filter(m=>m.type!=='filter');if(Object.keys(fm).length)params.set('fm',JSON.stringify(fm));}
      if(client.flow&&['tcp','raw'].includes(stream.network)&&stream.security!=='none'&&!ib.disableFlow)params.set('flow',client.flow);
      if(stream.network==='xhttp'){
       const x=stream.xhttpSettings||{};params.set('path',x.path||'/');params.set('mode',x.mode||'auto');if(x.host)params.set('host',x.host);
       const extra={};
       for(const key of ['mode','xPaddingBytes','uplinkHTTPMethod','sessionIDPlacement','sessionIDKey','sessionIDTable','sessionIDLength','seqPlacement','seqKey','uplinkDataPlacement','uplinkDataKey','scMaxEachPostBytes'])if(x[key]&&x[key]!=='1000000')extra[key]=x[key];
       if(x.xPaddingBytes)params.set('x_padding_bytes',x.xPaddingBytes);
       if(x.xPaddingObfsMode){extra.xPaddingObfsMode=true;for(const key of ['xPaddingKey','xPaddingHeader','xPaddingPlacement','xPaddingMethod'])if(x[key])extra[key]=x[key];}
       if(x.headers&&Object.keys(x.headers).length)extra.headers=x.headers;
       if(extra.sessionIDPlacement)extra.sessionPlacement=extra.sessionIDPlacement;
       if(extra.sessionIDKey)extra.sessionKey=extra.sessionIDKey;
       for(const key of ['xmux','noSSEHeader','scMinPostsIntervalMs'])if(x[key])extra[key]=x[key];
       if(Object.keys(extra).length)params.set('extra',JSON.stringify(extra));
      }
      if(['ws','httpupgrade'].includes(stream.network)){const n=stream[stream.network+'Settings']||{};params.set('path',n.path||'/');if(n.host)params.set('host',n.host);}
      if(stream.network==='grpc'){const g=stream.grpcSettings||{};params.set('serviceName',g.serviceName||'');if(g.authority)params.set('authority',g.authority);if(g.multiMode)params.set('mode','multi');}
      if(stream.security!=='reality'||r.settings?.publicKey)url='vless://'+client.id+'@'+host+':'+ib.port+'?'+params+'#'+encodeURIComponent(name);
     }
    }
   }
   const stats=(ib.clientStats||[]).find(s=>s.email===client.email);
   const enabled=!!ib.enable&&client.enable!==false&&(!ib.expiryTime||ib.expiryTime>Date.now())&&(!client.expiryTime||client.expiryTime>Date.now())&&(!stats||stats.enable!==false)&&(!ib.total||Number(ib.up||0)+Number(ib.down||0)<ib.total)&&(!client.totalGB||!stats||Number(stats.up||0)+Number(stats.down||0)<client.totalGB);
   rows.push({id:ib.id+':'+(client.id||client.email),name:ib.remark+' / '+name,protocol:ib.protocol==='vless'&&stream.network==='xhttp'?'xhttp':ib.protocol,port:ib.port,enabled,profileRequest:ib.protocol==='sudoku'&&client.id&&enabled&&url?{inboundId:ib.id,clientId:client.id,host:address,port:ib.port,name}:undefined,url:enabled?url:'',reason:enabled?(url?'':reason):'DISABLED'});
  }
 }
 return rows;
}
module.exports={selection,preset,exportRows,hostName};
