const test=require('node:test'),assert=require('node:assert/strict');
const {applyAdvanced,draft}=require('../advanced.cjs');const {preset,selection,exportRows}=require('../connections.cjs');
const base=()=>preset('xhttp',selection({name:'Phone',host:'example.com',protocols:['xhttp'],port:443}),443,{privateKey:'private',publicKey:'public'});
test('advanced edits preserve every client secret and unknown field',()=>{
 const ib=base();const original=JSON.parse(ib.settings);original.clients[0].custom='preserve';ib.settings=JSON.stringify(original);
 const s=JSON.parse(ib.streamSettings);s.xhttpSettings.futureSetting={retained:true};ib.streamSettings=JSON.stringify(s);
 const edited=applyAdvanced(ib,{changes:{'streamSettings.xhttpSettings.mode':'stream-one','streamSettings.xhttpSettings.xPaddingBytes':'200-800','streamSettings.xhttpSettings.xPaddingObfsMode':true,'streamSettings.realitySettings.settings.fingerprint':'safari','sniffing.enabled':true,'sniffing.destOverride':['http','tls','quic']}});
 assert.deepEqual(JSON.parse(edited.settings).clients,original.clients);assert.deepEqual(JSON.parse(edited.streamSettings).xhttpSettings.futureSetting,{retained:true});assert.equal(JSON.parse(edited.sniffing).enabled,true);
 const url=new URL(exportRows([{...edited,id:1}],'example.com')[0].url);assert.equal(url.searchParams.get('fp'),'safari');assert.equal(url.searchParams.get('mode'),'stream-one');assert.equal(JSON.parse(url.searchParams.get('extra')).xPaddingBytes,'200-800');
});
test('ML-KEM and ML-DSA client parameters reach links without private secrets',()=>{
 const ib=applyAdvanced(base(),{changes:{'settings.decryption':'mlkem-server-secret','settings.encryption':'mlkem-client','streamSettings.realitySettings.mldsa65Seed':'mldsa-private','streamSettings.realitySettings.settings.mldsa65Verify':'mldsa-public'}});
 assert.equal(JSON.parse(ib.settings).fallbacks,undefined);
 const link=exportRows([{...ib,id:1}],'example.com')[0].url;const u=new URL(link);assert.equal(u.searchParams.get('encryption'),'mlkem-client');assert.equal(u.searchParams.get('pqv'),'mldsa-public');assert.ok(!link.includes('mlkem-server-secret'));assert.ok(!link.includes('mldsa-private'));
});
test('reject injected fields, invalid JSON shapes, remote node edits and invalid Reality',()=>{
 for(const patch of [{changes:{'__proto__.pwned':true}},{changes:{port:0}},{changes:{'streamSettings.realitySettings.shortIds':['invalid']}},{raw:{settings:JSON.parse('{"__proto__":{"polluted":true}}')}},{changes:{'settings.decryption':'server-only'}}])assert.throws(()=>applyAdvanced(base(),patch));
 assert.throws(()=>applyAdvanced({...base(),nodeId:42},{}));assert.equal({}.polluted,undefined);
});
test('raw template retains native Sudoku key material during unrelated edits',()=>{
 const ib=preset('sudoku',selection({name:'Phone',host:'example.com',protocols:['sudoku'],port:443}),443);const s=JSON.parse(ib.settings);s.masterKey='master';s.clients[0].sudokuKey='device';ib.settings=JSON.stringify(s);
 const next=applyAdvanced(ib,{changes:{remark:'Renamed',port:8443}});assert.deepEqual(JSON.parse(next.settings),s);assert.equal(draft(next).settings.clients[0].sudokuKey,'device');
});
