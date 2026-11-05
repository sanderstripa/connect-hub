const fs=require('node:fs'),path=require('node:path');
const ids=new Set(['soulu','warm-sand','forest','rose','lavender','warm-taupe']);
function normalize(value){return {palette:ids.has(value?.palette)?value.palette:'soulu',dark:value?.dark!==false};}
function load(file){try{return normalize(JSON.parse(fs.readFileSync(file,'utf8')));}catch{return normalize(null);}}
function save(file,value){const result=normalize(value);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(result),{mode:0o600});return result;}
module.exports={load,save};
