const {Server}=require('ssh2');
const {generateKeyPairSync,randomBytes}=require('node:crypto');
async function fixture(){
 const key=generateKeyPairSync('rsa',{modulusLength:2048,privateKeyEncoding:{type:'pkcs1',format:'pem'},publicKeyEncoding:{type:'pkcs1',format:'pem'}}).privateKey;
 const password='test-only-'+randomBytes(18).toString('hex'),commands=[],sources=[],clients=new Set();let authenticated=0,installed=false;const inbounds=[];
 const result={state:'complete',url:'https://203.0.113.8:10443/random-path/',username:'fixture-admin',password:'fixture-panel-'+randomBytes(12).toString('hex'),certificate:'trusted',warnings:[]};
 const server=new Server({hostKeys:[key]},client=>{
  clients.add(client);client.on('close',()=>clients.delete(client));client.on('error',()=>{});
  client.on('authentication',ctx=>{if(ctx.method==='password'&&ctx.username==='lab'&&ctx.password===password){authenticated++;ctx.accept();}else ctx.reject(['password']);});
  client.on('ready',()=>client.on('session',accept=>{accept().on('exec',(accept,_reject,info)=>{
   const channel=accept();commands.push(info.command);let output;
   if(info.command.includes('class Panel:')){
    let body='';channel.on('data',chunk=>body+=chunk);channel.on('end',()=>{
     try{
      const req=JSON.parse(body);let value;
      if(req.action==='list')value=inbounds;
      else if(req.action==='keys')value={privateKey:'fixture-private',publicKey:'fixture-public'};
      else if(req.action==='create'){
       const ib={...req.inbound,id:inbounds.length+1},settings=JSON.parse(ib.settings);
       if(inbounds.some(row=>row.port===ib.port)){channel.write(JSON.stringify({ok:false,error:'PORT_IN_USE'}));channel.exit(0);channel.end();return;}
       if(ib.protocol==='sudoku')settings.clients[0].sudokuKey='fixture-sudoku-key';
       ib.settings=JSON.stringify(settings);inbounds.push(ib);value=ib;
      }else throw new Error();
      channel.write(JSON.stringify({ok:true,value}));channel.exit(0);channel.end();
     }catch{channel.exit(1);channel.end();}
    });return;
   }

   if(info.command==='id -u')output='0\n';
   else if(info.command.includes('CH_PRIVILEGED'))output='CH_PRIVILEGED=1\nCH_OS64='+Buffer.from('Debian GNU/Linux 13').toString('base64')+'\nCH_CPU=1\nCH_RAM=1\nCH_DISK=10\n'+(installed?'CH_INSTALLED=1\n':'');
   else if(info.command.includes('CH_ACCESS'))output=JSON.stringify(result);
   else if(info.command.includes('nohup bash')){installed=true;const encoded=info.command.match(/'([A-Za-z0-9+/=]{100,})'/);if(encoded)sources.push(Buffer.from(encoded[1],'base64').toString());output='CH_STARTED=1\n';}
   else if(info.command.includes('/state.json'))output=JSON.stringify(result);
   else{channel.stderr.write('Unexpected test command');channel.exit(1);channel.end();return;}
   channel.resume();setImmediate(()=>{channel.write(output);channel.exit(0);channel.end();});
  });}));
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 return {host:'127.0.0.1',port:server.address().port,username:'lab',password,result,commands,sources,get authenticated(){return authenticated;},close:()=>new Promise(resolve=>{for(const client of clients)client.end();server.close(resolve);})};
}
module.exports={fixture};
