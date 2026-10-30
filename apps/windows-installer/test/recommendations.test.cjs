const test=require('node:test'),assert=require('node:assert/strict');
const {recommendSwap}=require('../system-recommendations.cjs');
const base={ram:1,availableRam:.6,swapGB:0,freeDisk:15,swapDisk:25,swapSupported:true,ownSwap:false};
test('swap recommendation respects existing swap, free disk, filesystem and manual opt-in',()=>{
 assert.equal(recommendSwap(base).size,2);
 assert.equal(recommendSwap({...base,swapGB:1}).size,1);
 assert.equal(recommendSwap({...base,swapGB:2}).size,0);
 assert.equal(recommendSwap({...base,ram:16,availableRam:12}).size,0);
 assert.equal(recommendSwap({...base,ram:16,availableRam:.2}).size,2);
 assert.equal(recommendSwap({...base,freeDisk:2}).size,0);
 assert.equal(recommendSwap({...base,swapSupported:false}).size,0);
 assert.equal(recommendSwap({...base,ownSwap:true}).size,0);
 assert.equal(recommendSwap({...base,swapGB:NaN}).size,0);
});
