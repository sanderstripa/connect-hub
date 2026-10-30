const test=require('node:test'),assert=require('node:assert/strict');
const {InstallerConnection,credentials,options,panelURL,resultState}=require('../backend.cjs');
const {fixture}=require('./ssh-fixture.cjs');
test('reject injected host/user/domain and authentication in a panel URL',()=>{
 for(const host of ['example.com;whoami','https://example.com','bad host'])assert.throws(()=>credentials({host,password:'x'}));
 assert.throws(()=>credentials({host:'127.0.0.1',username:'root;whoami',password:'x'}));
 assert.throws(()=>options({addressMode:'domain',domain:'example.com/evil'}));
 assert.throws(()=>options({swap:999}));assert.throws(()=>panelURL('https://user:password@example.com/'));
 assert.equal(panelURL('https://example.com/path/?password=secret#login'),'https://example.com/path/');
 assert.throws(()=>resultState('{"state":"complete","url":"file:///secret","username":"u","password":"p"}'));
});
test('actual encrypted SSH, explicit host identity, root preflight and address-only result',async()=>{
 const server=await fixture();let identity;
 const client=new InstallerConnection({trustHost:async value=>{identity=value;return true;},jobSource:require('node:fs').readFileSync(require('node:path').join(__dirname,'../remote-job.sh'),'utf8').replace(/\n/g,'\r\n')});
 try{
  const status=await client.connect(server);assert.match(identity.fingerprint,/^SHA256:[A-Za-z0-9+/]{43}$/);assert.equal(status.os,'Debian GNU/Linux 13');assert.equal(status.installed,false);
  await client.start({language:'ru',addressMode:'ip',bbr:false,swap:0});
  const result=await client.poll();assert.equal(result.url,server.result.url);assert.equal(result.password,server.result.password);
  assert.equal(server.sources.length,1);assert.ok(!server.sources[0].includes(server.password));
  assert.ok(!server.sources[0].includes('\r'),'Windows line endings must not reach the Linux job');
  assert.ok(server.sources[0].includes("CH_BBR='0'"));assert.ok(server.sources[0].includes("CH_SWAP='0'"));
  assert.equal(server.authenticated,1);
 }finally{client.disconnect();await server.close();}
});
test('rejecting a host key prevents authentication and commands',async()=>{
 const server=await fixture(),client=new InstallerConnection({trustHost:async()=>false});
 try{await assert.rejects(client.connect(server),{code:'HOST_NOT_TRUSTED'});assert.equal(server.authenticated,0);assert.equal(server.commands.length,0);}finally{client.disconnect();await server.close();}
});
test('incorrect SSH password fails without issuing remote commands',async()=>{
 const server=await fixture(),client=new InstallerConnection({trustHost:async()=>true});
 try{await assert.rejects(client.connect({...server,password:'incorrect'}),{code:'AUTH_FAILED'});assert.equal(server.commands.length,0);}finally{client.disconnect();await server.close();}
});

test('removal uses encrypted SSH, clears panel state and permits a fresh install',async()=>{
 const server=await fixture(),client=new InstallerConnection({trustHost:async()=>true});
 try{
  await client.connect(server);await client.start({});
  await assert.rejects(client.uninstall(),{code:'JOB_RUNNING'});
  await client.poll();client.panelAuth={username:'u',password:'p'};
  assert.deepEqual(await client.uninstall(),{removed:true});
  assert.equal(client.installed,false);assert.equal(client.job,null);assert.equal(client.panelAuth,null);
  const command=server.commands.find(x=>x.includes('CH_UNINSTALLED=1'));
  assert.ok(command);assert.ok(!command.includes(server.password));
  assert.equal((await client.connect(server)).installed,false);
 }finally{client.disconnect();await server.close();}
});
test('SSH hardware probe is a valid read-only shell program and supports arbitrary whole GB choices',async()=>{
 const {spawnSync}=require('node:child_process');
 const server=await fixture(),client=new InstallerConnection({trustHost:async()=>true});
 try{
  const status=await client.connect(server);assert.equal(status.swapRecommendation.size,2);
  assert.equal(options({swap:3}).swap,3);assert.equal(options({swap:10}).swap,10);assert.throws(()=>options({swap:1.5}));
  if(process.platform!=='win32'){
   const command=server.commands.find(c=>c.includes('CH_PRIVILEGED'));
   const result=spawnSync('bash',['-c',command],{encoding:'utf8'});
   assert.equal(result.status,0,result.stderr);assert.match(result.stdout,/CH_FREE_DISK=/);assert.match(result.stdout,/CH_SWAP_GB=/);
  }
 }finally{client.disconnect();await server.close();}
});
