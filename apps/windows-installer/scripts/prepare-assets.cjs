const fs=require('node:fs'),path=require('node:path');
const {execFileSync}=require('node:child_process');
const base=path.resolve(__dirname,'..'),root=path.resolve(base,'../..');
fs.mkdirSync(path.join(base,'assets'),{recursive:true});
let revision=process.env.CONNECT_HUB_REVISION||'';
if(!revision){try{revision=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();}catch{revision='local-build';}}
let dirty=true;try{dirty=Boolean(execFileSync('git',['status','--porcelain'],{cwd:root,encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim());}catch{}
fs.writeFileSync(path.join(base,'assets/BUILD.json'),JSON.stringify({version:require('../package.json').version,revision,dirty},null,2));
for(const name of ['montserrat.woff2','montserrat-italic.woff2'])fs.copyFileSync(path.join(root,'frontend/src/assets/fonts',name),path.join(base,'assets',name));
for(const [source,name]of [['LICENSE','LICENSE.txt'],['NOTICE','NOTICE.txt'],['frontend/public/fonts/OFL.txt','MONTSERRAT-OFL.txt'],['frontend/public/icons/connect-hub.svg','icon.svg'],['hub/INSTALL-COMMAND.txt','bootstrap.txt']])fs.copyFileSync(path.join(root,source),path.join(base,'assets',name));
const sizes=[16,24,32,64,192,256],images=sizes.map(n=>fs.readFileSync(n===256?path.join(base,'assets/icon256.png'):path.join(root,`frontend/public/icons/connect-hub-${n}.png`)));
const header=Buffer.alloc(6+16*images.length);header.writeUInt16LE(1,2);header.writeUInt16LE(images.length,4);let offset=header.length;
images.forEach((image,i)=>{const pos=6+i*16;header[pos]=sizes[i]===256?0:sizes[i];header[pos+1]=sizes[i]===256?0:sizes[i];header.writeUInt16LE(1,pos+4);header.writeUInt16LE(32,pos+6);header.writeUInt32LE(image.length,pos+8);header.writeUInt32LE(offset,pos+12);offset+=image.length;});
fs.writeFileSync(path.join(base,'assets/icon.ico'),Buffer.concat([header,...images]));
const seen=new Set(),notices=[];
function dependency(name,parent=base){
 let entry;try{entry=require.resolve(name,{paths:[parent]});}catch{return;}
 let directory=path.dirname(entry),metadata;
 while(true){const file=path.join(directory,'package.json');if(fs.existsSync(file)){const value=JSON.parse(fs.readFileSync(file,'utf8'));if(value.name===name){metadata=value;break;}}const next=path.dirname(directory);if(next===directory)return;directory=next;}
 if(seen.has(directory))return;seen.add(directory);
 const files=fs.readdirSync(directory).filter(file=>/^(licen[sc]e|copying)(\.|$)/i.test(file));
 notices.push(name+' '+metadata.version+' — '+JSON.stringify(metadata.license||'See package license')+'\n'+files.map(file=>fs.readFileSync(path.join(directory,file),'utf8')).join('\n'));
 for(const child of Object.keys(metadata.dependencies||{}))dependency(child,directory);
}
dependency('ssh2');dependency('qrcode');
notices.push('Electron 45.0.0\n'+fs.readFileSync(path.join(base,'node_modules/electron/LICENSE'),'utf8'));
fs.writeFileSync(path.join(base,'assets/THIRD-PARTY-NOTICES.txt'),notices.join('\n\n--------------------\n\n'));
console.log('Prepared exact Connect assets, local Montserrat and GPL/OFL notices.');
