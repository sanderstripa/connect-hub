// Connect. Hub, 2026. GPL-3.0; see assets/NOTICE.txt.
const {Client}=require('ssh2');
const {createHash,randomBytes}=require('node:crypto');
const {domainToASCII}=require('node:url');
const {isIP}=require('node:net');
const fs=require('node:fs'),path=require('node:path');
const JOB_ROOT='/var/lib/connect-hub-installer';
const quote=value=>"'"+String(value).replaceAll("'","'\\''")+"'";
function failure(code){const error=new Error(code);error.code=code;return error;}
function credentials(input){
 let host=String(input.host||'').trim().replace(/^\[([^\]]+)\]$/,'$1');
 if(/[\s/\\@?#]/.test(host)||(!isIP(host)&&host.includes(':')))throw failure('INVALID_HOST');
 if(!isIP(host))host=domainToASCII(host);
 if(!host||host.length>253||/[^a-zA-Z0-9.:%_-]/.test(host)||host.startsWith('-'))throw failure('INVALID_HOST');
 const port=Number(input.port||22),username=String(input.username||'root');
 if(!Number.isInteger(port)||port<1||port>65535||!/^[a-zA-Z_][a-zA-Z0-9_.-]{0,63}$/.test(username))throw failure('INVALID_CONNECTION');
 if(typeof input.password!=='string'||!input.password||input.password.length>4096||/[\r\n\0]/.test(input.password))throw failure('INVALID_PASSWORD');
 const sudoPassword=input.sudoPassword||input.password;
 if(typeof sudoPassword!=='string'||sudoPassword.length>4096||/[\r\n\0]/.test(sudoPassword))throw failure('INVALID_PASSWORD');
 return {host,port,username,password:input.password,sudoPassword};
}
function options(input={}){
 const language=input.language==='en'?'en':'ru',swap=Number(input.swap||0);
 if(![0,1,2,4,8].includes(swap))throw failure('INVALID_OPTIONS');
 let domain='';
 if(input.addressMode==='domain'){
  const raw=String(input.domain||'').trim().toLowerCase();
  if(/[\s/\\@?#:]/.test(raw))throw failure('INVALID_DOMAIN');
  domain=domainToASCII(raw);
  if(!domain||domain.length>253||isIP(domain)||!domain.includes('.')||domain.split('.').some(label=>!/^([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)$/.test(label)))throw failure('INVALID_DOMAIN');
 }
 return {language,domain,swap,bbr:input.bbr===true};
}
function panelURL(raw){
 let value;try{value=new URL(raw);}catch{throw failure('INVALID_RESULT');}
 if(!['https:','http:'].includes(value.protocol)||!value.hostname||value.username||value.password)throw failure('INVALID_RESULT');
 value.search='';value.hash='';return value.href;
}
function resultState(raw){
 let state;try{state=JSON.parse(raw);}catch{throw failure('INVALID_RESULT');}
 if(!['running','complete','failed'].includes(state.state))throw failure('INVALID_RESULT');
 if(state.state==='complete'){
  if(typeof state.username!=='string'||typeof state.password!=='string'||state.username.length>512||state.password.length>4096)throw failure('INVALID_RESULT');
  state.url=panelURL(state.url);state.warnings=Array.isArray(state.warnings)?state.warnings.filter(x=>typeof x==='string').slice(0,8):[];
 }
 return state;
}
class InstallerConnection {
 constructor({trustHost=async()=>false,bootstrap,jobSource}={}){
  this.trustHost=trustHost;
  this.bootstrap=(bootstrap||fs.readFileSync(path.join(__dirname,'assets/bootstrap.txt'),'utf8')).replace(/\r\n?/g,'\n').trim();
  this.jobSource=(jobSource||fs.readFileSync(path.join(__dirname,'remote-job.sh'),'utf8')).replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n');
  this.client=null;this.secret=null;this.connected=false;this.root=false;this.installed=false;this.job=null;
 }
 async connect(input){
  const previousJob=this.lastState==='running'?this.job:null;this.disconnect();this.secret=credentials(input);const client=new Client();this.client=client;
  try{
   await new Promise((resolve,reject)=>{
    let declined=false;
    client.once('ready',()=>{this.connected=true;resolve();});
    client.on('error',error=>{if(!this.connected)reject(failure(declined?'HOST_NOT_TRUSTED':error.level==='client-authentication'?'AUTH_FAILED':'CONNECTION_FAILED'));});
    client.on('close',()=>{this.connected=false;reject(failure(declined?'HOST_NOT_TRUSTED':'CONNECTION_FAILED'));});
    const {sudoPassword,...ssh}=this.secret;
    client.connect({...ssh,readyTimeout:90000,keepaliveInterval:15000,keepaliveCountMax:3,tryKeyboard:true,
     hostVerifier:(key,accept)=>{
      const fingerprint='SHA256:'+createHash('sha256').update(key).digest('base64').replace(/=+$/,'');
      Promise.resolve(this.trustHost({host:ssh.host,port:ssh.port,fingerprint})).then(ok=>{declined=ok!==true;accept(!declined);},()=>{declined=true;accept(false);});
     }});
    client.on('keyboard-interactive',(_name,_instructions,_language,prompts,finish)=>finish(prompts.map(()=>ssh.password)));
   });
   const identity=await this.exec('id -u');this.root=identity.trim()==='0';
   const data=await this.execRoot(`set -e
test "$(uname -s)" = Linux
test "$(uname -m)" = x86_64
printf 'CH_PRIVILEGED=1\\n'
if [ -r /etc/os-release ];then . /etc/os-release;printf 'CH_OS64=%s\\n' "$(printf '%s' "$PRETTY_NAME" | base64 | tr -d '\\n')";fi
printf 'CH_CPU=%s\\n' "$(nproc 2>/dev/null || getconf _NPROCESSORS_ONLN)"
awk '/^MemTotal:/ {printf "CH_RAM=%.2f\\n",$2/1048576}' /proc/meminfo
df -kP / | awk 'NR==2 {printf "CH_DISK=%.0f\\n",$2/1048576}'
if [ -f /etc/connect-hub/.connect-hub-owned ];then echo CH_INSTALLED=1;fi
if [ -f ${JOB_ROOT}/.connect-hub-owned ] && [ ! -L ${JOB_ROOT} ];then
 for candidate in $(ls -dt ${JOB_ROOT}/job.* 2>/dev/null || true);do
  if [ -d "$candidate" ] && [ ! -L "$candidate" ] && grep -q '"state":"running"' "$candidate/state.json" 2>/dev/null;then printf 'CH_JOB=%s\\n' "$(basename "$candidate")";break;fi
 done
fi`);
   const records=Object.fromEntries(data.split('\n').filter(x=>x.startsWith('CH_')).map(x=>[x.slice(0,x.indexOf('=')),x.slice(x.indexOf('=')+1)]));
   if(records.CH_PRIVILEGED!=='1')throw failure('SUDO_FAILED');
   this.installed=records.CH_INSTALLED==='1';this.job=/^job\.[a-f0-9]{32}$/.test(records.CH_JOB||'')?records.CH_JOB:previousJob;
   return {installed:this.installed,job:this.job,host:this.secret.host,os:Buffer.from(records.CH_OS64||'','base64').toString('utf8'),cpus:Number(records.CH_CPU)||0,ram:Number(records.CH_RAM)||0,disk:Number(records.CH_DISK)||0};
  }catch(error){this.disconnect();throw failure(['AUTH_FAILED','HOST_NOT_TRUSTED','INVALID_HOST','INVALID_PASSWORD'].includes(error.code)?error.code:error.code==='REMOTE_COMMAND_FAILED'?'SUDO_FAILED':'CONNECTION_FAILED');}
 }
 exec(command,input=''){
  if(!this.connected||!this.client)return Promise.reject(failure('DISCONNECTED'));
  return new Promise((resolve,reject)=>{
   this.client.exec(command,(error,channel)=>{
    if(error){reject(failure('REMOTE_COMMAND_FAILED'));return;}
    let output='',bytes=0,finished=false;
    const finish=(error,value)=>{if(finished)return;finished=true;clearTimeout(timer);error?reject(error):resolve(value);};
    const timer=setTimeout(()=>{channel.close();finish(failure('REMOTE_TIMEOUT'));},60000);
    channel.on('data',data=>{bytes+=data.length;if(bytes>1024*1024){channel.close();finish(failure('INVALID_RESULT'));}else output+=data.toString('utf8');});
    channel.stderr.on('data',()=>{});
    channel.on('error',()=>finish(failure('REMOTE_COMMAND_FAILED')));
    channel.on('close',code=>finish(code===0?null:failure('REMOTE_COMMAND_FAILED'),output));channel.end(input);
   });
  });
 }
 execRoot(script){const command='bash -c '+quote(script);return this.exec(this.root?command:'sudo -S -p \'\' -- '+command,this.root?'':this.secret.sudoPassword+'\n');}
 async start(input){
  if(this.job)throw failure('JOB_RUNNING');
  const selected=options(input),job='job.'+randomBytes(16).toString('hex');let bootstrap=this.bootstrap;
  if(this.installed){if(!bootstrap.includes('bash "$t"'))throw failure('INVALID_BOOTSTRAP');bootstrap=bootstrap.replace('bash "$t"','bash "$t" --update');}
  const env={CH_LANGUAGE:selected.language,CH_DOMAIN:this.installed?'':selected.domain,CH_HOST:isIP(this.secret.host)?this.secret.host:'',CH_BBR:!this.installed&&selected.bbr?'1':'0',CH_SWAP:this.installed?'0':String(selected.swap),CH_UPDATE:this.installed?'1':'0',CH_BOOTSTRAP_B64:Buffer.from(bootstrap).toString('base64')};
  const source=Object.entries(env).map(([key,value])=>'export '+key+'='+quote(value)).join('\n')+'\n'+this.jobSource;
  await this.execRoot(`set -eu
umask 077
base=${JOB_ROOT}
test ! -L "$base"
if [ -e "$base" ];then test -f "$base/.connect-hub-owned";else mkdir -m 700 "$base";touch "$base/.connect-hub-owned";fi
test "$(stat -c %u "$base")" = 0
chmod 700 "$base"
dir="$base/${job}"
mkdir -m 700 "$dir"
printf '%s' '${Buffer.from(source).toString('base64')}' | base64 -d > "$dir/run.sh"
chmod 700 "$dir/run.sh"
printf '%s' '{"state":"running","stage":"preparing"}' > "$dir/state.json"
nohup bash "$dir/run.sh" "$dir" </dev/null >"$dir/process.log" 2>&1 &
echo CH_STARTED=1`);
  this.job=job;this.lastState='running';return {job,update:this.installed};
 }
 async poll(){
  if(!/^job\.[a-f0-9]{32}$/.test(this.job||''))throw failure('NO_JOB');
  const state=resultState(await this.execRoot(`set -eu;test ! -L ${JOB_ROOT};test -f ${JOB_ROOT}/.connect-hub-owned;test ! -L ${JOB_ROOT}/${this.job};cat ${JOB_ROOT}/${this.job}/state.json`));
  this.lastState=state.state;return state;
 }
 async access(){
  return resultState(await this.execRoot(`python3 - <<'CH_ACCESS'
import json,pathlib
p=pathlib.Path('/etc/connect-hub');assert (p/'.connect-hub-owned').is_file()
v=dict(line.split('=',1)for line in (p/'initial-access.txt').read_text().splitlines() if '=' in line)
print(json.dumps({'state':'complete','url':v['URL'],'username':v['USERNAME'],'password':v['PASSWORD'],'warnings':[],'certificate':v.get('CERTIFICATE','unknown')}))
CH_ACCESS`));
 }
 disconnect(){this.connected=false;if(this.client){this.client.end();this.client=null;}this.secret=null;this.job=null;this.root=false;}
}
module.exports={InstallerConnection,credentials,options,panelURL,resultState,quote};
