// A conservative, capacity-based suggestion, never automatic host tuning. GPL-3.0.
function recommendSwap(info){
 const {ram,availableRam,swapGB,freeDisk,swapDisk,swapSupported,ownSwap}=info;
 if(![ram,swapGB,freeDisk,swapDisk].every(Number.isFinite)||ram<=0||!swapSupported)return {size:0,reason:'swapUnknown'};
 if(ownSwap)return {size:0,reason:'swapOwned'};
 const pressured=Number.isFinite(availableRam)&&availableRam<Math.min(0.5,ram*0.1);
 const target=ram<4?2:ram<8?1:pressured?2:0;
 const desired=Math.max(0,Math.ceil(target-swapGB));
 if(!desired)return {size:0,reason:swapGB>=target&&swapGB>0?'swapEnough':'swapNotNeeded'};
 const capacity=Math.max(0,Math.floor(freeDisk-Math.max(2,swapDisk*.1)-1));
 if(!capacity)return {size:0,reason:'swapNoSpace'};
 return {size:Math.min(desired,capacity,32),reason:capacity<desired?'swapLimited':'swapSuggested'};
}
module.exports={recommendSwap};
