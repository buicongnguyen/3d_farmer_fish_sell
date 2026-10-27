// r180 ranges use components, not bytes. The renderer clears them after upload.
const pending=new WeakMap();

export function markRange(attribute,start,count){
 if(count<=0)return;
 let lo=start,hi=start+count,state=pending.get(attribute);
 const ranges=attribute.updateRanges,last=state?.version;
 // An external writer may have requested a full upload. Never narrow that away.
 if(last===undefined?attribute.version>0:attribute.version!==last){lo=0;hi=attribute.array.length;}
 for(const r of ranges){lo=Math.min(lo,r.start);hi=Math.max(hi,r.start+r.count);}
 if(!state){state={version:0,range:{start:0,count:0}};pending.set(attribute,state);}
 state.range.start=lo;state.range.count=hi-lo;
 // r180 consumes this list synchronously; recycle its sole range after consumption.
 ranges.length=1;ranges[0]=state.range;
 attribute.needsUpdate=true;
 state.version=attribute.version;
}

export function markPrefix(attribute,count){markRange(attribute,0,count*attribute.itemSize);}

export function write4(attribute,offset,a,b,c,d){
 a=Math.fround(a);b=Math.fround(b);c=Math.fround(c);d=Math.fround(d);
 const v=attribute.array;
 if(v[offset]===a&&v[offset+1]===b&&v[offset+2]===c&&v[offset+3]===d)return false;
 v[offset]=a;v[offset+1]=b;v[offset+2]=c;v[offset+3]=d;
 markRange(attribute,offset,4);
 return true;
}

export function write3(attribute,offset,a,b,c){
 a=Math.fround(a);b=Math.fround(b);c=Math.fround(c);
 const v=attribute.array;
 if(v[offset]===a&&v[offset+1]===b&&v[offset+2]===c)return false;
 v[offset]=a;v[offset+1]=b;v[offset+2]=c;
 markRange(attribute,offset,3);
 return true;
}

export function writeMatrix(mesh,index,values){
 const attribute=mesh.instanceMatrix,a=attribute.array,o=index*16;
 let dirty=false;
 for(let i=0;i<16;i++)if(a[o+i]!==Math.fround(values[i])){dirty=true;break;}
 if(!dirty)return false;
 for(let i=0;i<16;i++)a[o+i]=values[i];
 markRange(attribute,o,16);
 return true;
}
