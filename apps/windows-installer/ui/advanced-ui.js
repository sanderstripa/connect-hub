// Local-only structured editor. No key is stored outside the active renderer.
class AdvancedEditor {
 constructor(container,api,language){this.container=container;this.api=api;this.language=language;this.inputs=new Map();this.dirty=new Set();this.rawDirty=new Set();this.data={};this.ready=this.build();}
 text(ru,en){return this.language()==='ru'?ru:en;}
 get(path){return path.split('.').reduce((v,k)=>v?.[k],this.data);}
 async build(){
  this.fields=await this.api('editorSchema');
  const nav=document.createElement('div');nav.className='editor-tabs';nav.setAttribute('role','tablist');
  const groups=[['basic','Основное','Basic'],['protocol','Протокол','Protocol'],['transport','Поток','Transport'],['security','Безопасность','Security'],['sniffing','Сниффинг','Sniffing'],['raw','Расширенный шаблон','Advanced template']];
  this.tabs=[];
  for(const [group,ru,en]of groups){
   const button=document.createElement('button');button.type='button';button.dataset.ru=ru;button.dataset.en=en;button.setAttribute('role','tab');button.id='editor-tab-'+group;
   const panel=document.createElement('div');panel.className='editor-panel';panel.dataset.group=group;panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby',button.id);
   button.addEventListener('click',()=>this.select(group));this.tabs.push({button,panel});nav.append(button);this.container.append(panel);
   for(const f of this.fields.filter(f=>f[0]===group)){
    const [,path,type,labelRU,labelEN,options]=f,label=document.createElement('label');label.className='editor-field';label.dataset.path=path;
    const span=document.createElement('span');span.dataset.ru=labelRU;span.dataset.en=labelEN;label.append(span);
    let input;
    if(type==='select'){input=document.createElement('select');if(!options.includes('')){const option=document.createElement('option');option.value='';option.dataset.ru='По умолчанию';option.dataset.en='Preset / unchanged';option.textContent=this.text(option.dataset.ru,option.dataset.en);input.append(option);}for(const value of options){const option=document.createElement('option');option.value=value;option.textContent=value||'Default';input.append(option);}}
    else if(type==='json'){input=document.createElement('textarea');input.rows=3;input.placeholder='{}';}
    else{input=document.createElement('input');input.type=type==='check'?'checkbox':type==='secret'?'password':['number','gb'].includes(type)?'number':type==='date'?'datetime-local':'text';if(['number','gb'].includes(type)){input.min=path==='subSortIndex'?'-999999':'0';if(type==='gb')input.step='0.01';}}
    input.id='advanced-'+path.replaceAll('.','-');input.dataset.path=path;input.autocomplete='off';input.spellcheck=false;if(type!=='select'&&type!=='check'){input.dataset.preset='true';input.placeholder=this.text('По умолчанию','Preset / unchanged');}input.addEventListener('input',()=>{this.dirty.add(path);this.visibility();});input.addEventListener('change',()=>{this.dirty.add(path);this.visibility();});label.append(input);panel.append(label);this.inputs.set(path,{input,type,label});
   }
   if(group==='protocol'){
    const actions=document.createElement('div');actions.className='editor-actions';this.encMode=document.createElement('select');this.encMode.setAttribute('aria-label','VLESS encryption mode');this.encMode.hidden=true;actions.append(this.encMode);
    const gen=this.button('Сгенерировать ML-KEM / X25519','Generate ML-KEM / X25519',()=>this.generate('vless'));actions.append(gen);panel.append(actions);
    this.encMode.addEventListener('change',()=>{const pair=this.auths?.[Number(this.encMode.value)];if(pair){this.assign('settings.decryption',pair.decryption);this.assign('settings.encryption',pair.encryption);}});
   }
   if(group==='security'){const actions=document.createElement('div');actions.className='editor-actions';actions.append(this.button('Новая пара Reality','New Reality key pair',()=>this.generate('reality')),this.button('Новый ML-DSA Seed','New ML-DSA seed',()=>this.generate('mldsa')));panel.append(actions);}
   if(group==='raw'){
    const note=document.createElement('p');note.dataset.ru='JSON-поля сохраняют редкие параметры. Изменённый JSON заменяет соответствующий раздел; ключи clients сохраняйте без изменений, если не хотите сменить доступ.';note.dataset.en='JSON preserves uncommon settings. An edited JSON block replaces that section; keep clients unchanged to preserve device credentials.';panel.append(note);
    this.rawInputs={};
    for(const key of ['settings','streamSettings','sniffing']){const label=document.createElement('label');label.textContent=key;const input=document.createElement('textarea');input.rows=12;input.spellcheck=false;input.autocomplete='off';input.addEventListener('input',()=>this.rawDirty.add(key));label.append(input);panel.append(label);this.rawInputs[key]=input;}
   }
  }
  this.container.prepend(nav);this.message=document.createElement('p');this.message.className='editor-message';this.message.setAttribute('role','status');this.container.append(this.message);this.localize();this.reset(null);this.select('basic');
 }
 button(ru,en,action){const b=document.createElement('button');b.type='button';b.dataset.ru=ru;b.dataset.en=en;b.addEventListener('click',async()=>{b.disabled=true;try{await action();}catch(e){this.message.textContent=this.text('Не удалось получить ключи. Проверьте подключение и версию Xray.','Key generation failed. Check the connection and Xray version.');}finally{b.disabled=false;}});return b;}
 localize(){this.container.querySelectorAll('[data-preset]').forEach(el=>el.placeholder=this.text('По умолчанию','Preset / unchanged'));this.container.querySelectorAll('[data-ru]').forEach(el=>el.textContent=this.text(el.dataset.ru,el.dataset.en));}
 select(group){for(const tab of this.tabs){const on=tab.panel.dataset.group===group;tab.panel.hidden=!on;tab.button.setAttribute('aria-selected',String(on));tab.button.tabIndex=on?0:-1;}this.visibility();}
 reset(data){this.data=data||{};this.existing=!!data;this.dirty.clear();this.rawDirty.clear();if(this.message)this.message.textContent='';
  for(const [path,{input,type}]of this.inputs){const v=this.get(path);if(type==='check')input.checked=v===true;else if(type==='json')input.value=v?JSON.stringify(v,null,2):'';else if(type==='list')input.value=Array.isArray(v)?v.join(', '):'';else if(type==='gb')input.value=v?String(v/1073741824):'';else if(type==='date')input.value=v?new Date(v-new Date(v).getTimezoneOffset()*60000).toISOString().slice(0,16):'';else input.value=v??'';}
  for(const key of ['settings','streamSettings','sniffing'])this.rawInputs[key].value=JSON.stringify(this.data[key]||{},null,2);
  if(this.encMode)this.encMode.hidden=true;this.select('basic');this.visibility();
 }
 assign(path,value){const field=this.inputs.get(path);if(!field)return;field.input.value=Array.isArray(value)?value.join(', '):value;this.dirty.add(path);}
 visibility(){
  const current=path=>this.inputs.get(path)?.input.value||this.get(path);
  const net=current('streamSettings.network'),security=current('streamSettings.security');
  const vless=!this.data.protocol||this.data.protocol==='vless';
  for(const [path,{label}]of this.inputs){let visible=true;
   if(path.startsWith('settings.'))visible=vless;
   if(path.startsWith('streamSettings.')){
    visible=vless;
    if(path.includes('.xhttpSettings.'))visible&&=!net||net==='xhttp';
    if(path.includes('.wsSettings.'))visible&&=net==='ws';
    if(path.includes('.grpcSettings.'))visible&&=net==='grpc';
    if(path.includes('.httpupgradeSettings.'))visible&&=net==='httpupgrade';
    if(path.includes('.realitySettings.'))visible&&=!security||security==='reality';
    if(path.includes('.tlsSettings.'))visible&&=security==='tls';
   }
   label.hidden=!visible;
  }
 }
 async generate(kind){
  const value=await this.api('generateKeys',kind);
  if(kind==='reality'){this.assign('streamSettings.realitySettings.privateKey',value.privateKey);this.assign('streamSettings.realitySettings.settings.publicKey',value.publicKey);}
  if(kind==='mldsa'){this.assign('streamSettings.realitySettings.mldsa65Seed',value.seed);this.assign('streamSettings.realitySettings.settings.mldsa65Verify',value.verify);}
  if(kind==='vless'){this.auths=value.auths;if(!Array.isArray(this.auths)||!this.auths.length)throw Error();this.encMode.replaceChildren();this.auths.forEach((pair,i)=>{const o=document.createElement('option');o.value=String(i);o.textContent=pair.label;this.encMode.append(o);});this.encMode.hidden=false;this.assign('settings.decryption',this.auths[0].decryption);this.assign('settings.encryption',this.auths[0].encryption);}
  this.message.textContent=this.text('Ключи получены. Они применятся после сохранения.','Keys generated. Save to apply them.');
 }
 read(){const changes={},raw={};for(const path of this.dirty){const {input,type}=this.inputs.get(path);let value=input.value;
  if(type==='check')value=input.checked;
  if(type==='number')value=Number(value||0);
  if(type==='gb')value=Math.round(Number(value||0)*1073741824);
  if(type==='date')value=value?new Date(value).getTime():0;
  if(type==='list')value=value.split(',').map(x=>x.trim()).filter(Boolean);
  if(type==='json')value=value.trim()?JSON.parse(value):{};
  changes[path]=value;
 }for(const key of this.rawDirty)raw[key]=JSON.parse(this.rawInputs[key].value);return {changes,raw};}
}
window.AdvancedEditor=AdvancedEditor;
