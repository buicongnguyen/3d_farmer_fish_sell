// Typed arrays are written by existing renderers. Compare their live prefix with
// the previous CPU commit, then union dirty components with not-yet-rendered work.
// r180 consumes/clears updateRanges only after the buffer actually reaches WebGL.
const histories=new WeakMap();
export function commitAttribute(attribute,components){
 if(!attribute||components<=0)return false;
 const array=attribute.array,n=Math.min(components,array.length);
 let h=histories.get(attribute);
 if(!h||h.array!==array){h={array,previous:new array.constructor(array.length),known:0};histories.set(attribute,h);}
 let first=n,last=-1;
 for(let i=0;i<n;i++)if(i>=h.known||array[i]!==h.previous[i]){if(first===n)first=i;last=i;h.previous[i]=array[i];}
 h.known=Math.max(h.known,n);
 if(last<first)return false;
 for(const r of attribute.updateRanges){first=Math.min(first,r.start);last=Math.max(last,r.start+r.count-1);}
 attribute.clearUpdateRanges();attribute.addUpdateRange(first,last-first+1);attribute.needsUpdate=true;
 return true;
}
export function commitInstances(mesh,count,colors=false){
 mesh.count=count;mesh.visible=count>0;
 commitAttribute(mesh.instanceMatrix,count*16);
 if(colors)commitAttribute(mesh.instanceColor,count*3);
}
