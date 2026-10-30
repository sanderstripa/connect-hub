const test=require('node:test'),assert=require('node:assert/strict');
const {selection,preset,exportRows}=require('../connections.cjs');
const {InstallerConnection}=require('../backend.cjs');
const input={name:'Телефон & <test>',host:'2001:db8::1',protocols:['vless','xhttp','sudoku','mtproto','shadowsocks'],port:443,sni:'www.cloudflare.com'};
const keys={privateKey:'test-private',publicKey:'test-public'};
test('reject invalid hosts, ports, duplicate and unsupported protocols',()=>{
 for(const patch of [{host:'x;reboot'},{port:65534},{protocols:[]},{protocols:['vless','vless']},{protocols:['mist']},{name:''},{sni:'127.0.0.1'}])assert.throws(()=>selection({...input,...patch}));
});
test('five presets export canonical client links without server private keys',()=>{
 const selected=selection(input);
 const inbounds=selected.protocols.map((kind,i)=>{const ib=preset(kind,selected,443+i,keys);ib.id=i+1;const s=JSON.parse(ib.settings);if(kind==='sudoku')s.clients[0].sudokuKey='test-device-key';ib.settings=JSON.stringify(s);return ib;});
 const rows=exportRows(inbounds,'example.com');assert.equal(rows.length,5);assert.ok(rows.every(r=>r.url&&!r.url.includes('test-private')));
 const vless=new URL(rows[0].url);assert.equal(vless.hostname,'[2001:db8::1]');assert.equal(vless.searchParams.get('pbk'),keys.publicKey);assert.equal(vless.searchParams.get('flow'),'xtls-rprx-vision');
 const xhttp=new URL(rows[1].url);assert.equal(xhttp.searchParams.get('type'),'xhttp');assert.equal(xhttp.searchParams.get('path'),JSON.parse(inbounds[1].streamSettings).xhttpSettings.path);assert.equal(xhttp.searchParams.has('flow'),false);
 const sudoku=JSON.parse(Buffer.from(rows[2].url.slice(9),'base64url'));assert.equal(sudoku.k,'test-device-key');assert.equal(sudoku.h,input.host);assert.equal(sudoku.a,'ascii');
 const mt=new URL(rows[3].url);assert.equal(mt.protocol,'tg:');assert.equal(mt.hash,'');assert.equal(mt.searchParams.get('secret'),JSON.parse(inbounds[3].settings).clients[0].secret);assert.equal(JSON.parse(inbounds[3].settings).fakeTlsDomain,input.sni);
 assert.match(Buffer.from(rows[4].url.slice(5).split('@')[0],'base64url').toString(),/^chacha20-ietf-poly1305:/);
});
test('disabled, expired, remote and unsupported configurations cannot export misleading keys',()=>{
 const ib=preset('vless',selection(input),443,keys);ib.id=1;
 assert.equal(exportRows([{...ib,enable:false}],'host')[0].url,'');assert.equal(exportRows([{...ib,nodeId:7}],'host')[0].url,'');
 const settings=JSON.parse(ib.settings);settings.clients[0].expiryTime=1;
 assert.equal(exportRows([{...ib,settings:JSON.stringify(settings)}],'host')[0].reason,'DISABLED');
 assert.equal(exportRows([{...ib,protocol:'wireguard'}],'host')[0].reason,'UNSUPPORTED_EXPORT');
});
test('partial creation preserves successes and rereads canonical Sudoku secrets',async()=>{
 const client=new InstallerConnection({bootstrap:'test',jobSource:'test'});client.secret={host:input.host};const stored=[];
 client.panelRequest=async req=>{
  if(req.action==='keys')return keys;if(req.action==='list')return stored;
  if(req.inbound.port===444)throw Object.assign(new Error(),{code:'PORT_IN_USE'});
  const ib={...req.inbound,id:stored.length+1},s=JSON.parse(ib.settings);if(ib.protocol==='sudoku')s.clients[0].sudokuKey='server-generated';ib.settings=JSON.stringify(s);stored.push(ib);return ib;
 };
 const result=await client.createConnections({...input,protocols:['vless','xhttp','sudoku']});
 assert.deepEqual(result.outcomes.map(o=>o.ok),[true,false,true]);assert.equal(result.outcomes[1].error,'PORT_IN_USE');assert.equal(result.rows.length,2);
 assert.equal(JSON.parse(Buffer.from(result.rows[1].url.slice(9),'base64url')).k,'server-generated');assert.deepEqual(await client.connections(),result.rows);
});
test('bridge sends credentials and bodies over stdin, never shell arguments',async()=>{
 const client=new InstallerConnection({bootstrap:'test',jobSource:'test'});client.connected=true;client.root=false;client.secret={sudoPassword:'sudo-private'};client.panelAuth={username:'admin',password:'panel-private'};
 client.exec=async(command,input)=>{for(const secret of ['sudo-private','panel-private','body-private'])assert.ok(!command.includes(secret));assert.ok(input.startsWith('sudo-private\n'));assert.equal(JSON.parse(input.slice(input.indexOf('\n')+1)).auth.password,'panel-private');return JSON.stringify({ok:true,value:[]});};
 await client.panelRequest({action:'create',inbound:{settings:'body-private'}});client.disconnect();assert.equal(client.panelAuth,null);
});
test('recommended XHTTP uses generated ML-KEM native, Safari, booking, padding and three sniffing overrides',async()=>{
 const client=new InstallerConnection({bootstrap:'test',jobSource:'test'});client.secret={host:'203.0.113.1'};
 let saved;
 client.panelRequest=async req=>{
  if(req.action==='keys')return keys;
  if(req.action==='generate')return {auths:[{decryption:'mlkem768x25519plus.native.server',encryption:'mlkem768x25519plus.native.client'}]};
  if(req.action==='create'){saved=req.inbound;return {};}
  if(req.action==='list')return saved?[{...saved,id:1}]:[];
 };
 const result=await client.createConnections({...input,protocols:['xhttp'],email:'Alex-iPhone',xhttpProfile:'recommended'});
 assert.equal(result.outcomes[0].ok,true);const s=JSON.parse(saved.settings),stream=JSON.parse(saved.streamSettings),sniff=JSON.parse(saved.sniffing);
 assert.equal(s.clients[0].email,'Alex-iPhone');assert.ok(s.decryption.includes('.native.'));assert.equal(stream.xhttpSettings.mode,'stream-one');assert.equal(stream.xhttpSettings.xPaddingObfsMode,true);assert.equal(stream.realitySettings.settings.fingerprint,'safari');assert.equal(stream.realitySettings.target,'booking.com:443');assert.deepEqual(sniff.destOverride,['http','tls','quic']);assert.equal(sniff.enabled,true);assert.ok(!('fallbacks' in s));
 const url=new URL(result.rows[0].url);assert.equal(url.searchParams.get('sni'),'booking.com');assert.equal(url.searchParams.get('encryption'),s.encryption);
});
