// Actual SSH transport + actual detached root installation, on a disposable VM.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {spawn,spawnSync}=require('node:child_process');
const {generateKeyPairSync,randomBytes,createHash}=require('node:crypto');
const {Server}=require('ssh2');
const {InstallerConnection,quote}=require('../backend.cjs');
const root=path.resolve(__dirname,'../../..');
assert.equal(process.platform,'linux');assert.equal(process.getuid(),0);
assert.equal(process.env.GITHUB_ACTIONS,'true');assert.equal(process.env.RUNNER_ENVIRONMENT,'github-hosted');
assert.ok(!fs.existsSync('/opt/connect-hub'));assert.ok(!fs.existsSync('/var/lib/connect-hub-installer'));
const archive=path.join(root,'dist/connect-hub-linux-amd64.tar.gz'),digest=createHash('sha256').update(fs.readFileSync(archive)).digest('hex');
const bootstrap='export CONNECT_HUB_TLS_MODE=selfsigned CONNECT_HUB_LISTEN=127.0.0.1\nt='+quote(path.join(root,'hub/install.sh'))+'\nbash "$t" --package '+quote(archive)+' --sha256 '+quote(digest);
const key=generateKeyPairSync('rsa',{modulusLength:2048,privateKeyEncoding:{type:'pkcs1',format:'pem'},publicKeyEncoding:{type:'pkcs1',format:'pem'}}).privateKey;
const password=randomBytes(24).toString('hex'),clients=new Set();
const before=spawnSync('sysctl',['-n','net.ipv4.tcp_congestion_control'],{encoding:'utf8'}).stdout;
const swapNames=()=>fs.readFileSync('/proc/swaps','utf8').trim().split('\n').slice(1).map(x=>x.split(/\s+/)[0]).sort();
const previousSwap=swapNames();
const server=new Server({hostKeys:[key]},client=>{
 clients.add(client);client.on('error',()=>{});client.on('close',()=>clients.delete(client));
 client.on('authentication',ctx=>ctx.method==='password'&&ctx.username==='root'&&ctx.password===password?ctx.accept():ctx.reject(['password']));
 client.on('ready',()=>client.on('session',accept=>accept().on('exec',(accept,_reject,info)=>{
  const channel=accept(),process=spawn('/bin/bash',['-c',info.command],{stdio:['pipe','pipe','pipe']});
  channel.pipe(process.stdin);process.stdin.on('error',()=>{});process.stdout.pipe(channel,{end:false});process.stderr.pipe(channel.stderr,{end:false});
  process.on('close',code=>{channel.exit(code??1);channel.end();});
 })));
});
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const connection=new InstallerConnection({bootstrap,trustHost:async identity=>{assert.match(identity.fingerprint,/^SHA256:/);return true;}});
async function finished(){for(let n=0;n<300;n++){const state=await connection.poll();if(state.state==='failed'){const log=fs.readFileSync('/var/lib/connect-hub-installer/'+connection.job+'/install.log','utf8');throw Error('Desktop installation failed: '+log.slice(-2000));}if(state.state==='complete')return state;await delay(1000);}throw Error('Desktop installation timed out');}
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const login={host:'127.0.0.1',port:server.address().port,username:'root',password};
 try{
  const info=await connection.connect(login);assert.equal(info.installed,false);assert.ok(info.os&&info.cpus>0);
  await connection.start({language:'ru',bbr:false,swap:0,addressMode:'ip'});
  const firstJob=connection.job;
  // A closed SSH connection must not kill or lose the detached root job.
  await delay(500);connection.disconnect();const resumed=await connection.connect(login);
  assert.ok(resumed.job||resumed.installed);if(!connection.job)connection.job=firstJob;
  const result=await finished();assert.ok(result.url.startsWith('https://'));
  assert.equal(fs.statSync('/var/lib/connect-hub-installer/'+firstJob+'/state.json').mode&0o777,0o600);
  const log=fs.readFileSync('/var/lib/connect-hub-installer/'+firstJob+'/install.log','utf8');assert.ok(!log.includes(password));assert.ok(!log.includes(result.password));
  console.log('PASS: real encrypted SSH installs native panel; root-only result, password-free log and disconnect/reconnect survival');
  const proof=spawn('python3',[path.join(__dirname,'linux-proof.py')],{stdio:['pipe','pipe','inherit']});
  proof.stdin.write(JSON.stringify(result)+'\n');
  let buffer='',updateTask,updateError;
  proof.stdout.on('data',chunk=>{buffer+=chunk;let index;while((index=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,index);buffer=buffer.slice(index+1);if(line==='DESKTOP_UPDATE_READY'){
   updateTask=(async()=>{connection.disconnect();const existing=await connection.connect(login);assert.equal(existing.installed,true);await connection.start({language:'en',bbr:true,swap:8,addressMode:'ip'});const updated=await finished();assert.equal(updated.url,result.url);assert.equal(updated.username,result.username);assert.equal(updated.password,result.password);assert.equal(spawnSync('sysctl',['-n','net.ipv4.tcp_congestion_control'],{encoding:'utf8'}).stdout,before);assert.deepEqual(swapNames(),previousSwap);proof.stdin.end('UPDATE_DONE\n');console.log('PASS: desktop update preserves access and ignores first-install BBR/swap choices');})().catch(error=>{updateError=error;proof.kill();});
  }else if(line.startsWith('PASS:'))console.log(line);}});
  const exit=await new Promise(resolve=>proof.on('close',resolve));if(updateTask)await updateTask;if(updateError)throw updateError;assert.equal(exit,0);
 }finally{
  connection.disconnect();for(const client of clients)client.end();await new Promise(resolve=>server.close(resolve));
  if(fs.existsSync('/etc/connect-hub/.connect-hub-owned'))spawnSync('systemctl',['stop','connect-hub']);
 }
})().catch(error=>{console.error(error);process.exitCode=1;});
