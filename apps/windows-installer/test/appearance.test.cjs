const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {load,save}=require('../appearance.cjs');
test('appearance survives fresh reads and stores only validated color preferences',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'connect-colors-')),file=path.join(dir,'appearance.json');
 try{
  assert.deepEqual(load(file),{palette:'soulu',dark:true});
  for(const palette of ['soulu','warm-sand','forest','rose','lavender','warm-taupe'])for(const dark of [true,false]){
   save(file,{palette,dark,password:'never-save'});
   assert.deepEqual(load(file),{palette,dark});
   assert.ok(!fs.readFileSync(file,'utf8').includes('password'));
  }
  save(file,{palette:'unknown',dark:false});assert.deepEqual(load(file),{palette:'soulu',dark:false});
  fs.writeFileSync(file,'broken');assert.deepEqual(load(file),{palette:'soulu',dark:true});
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
