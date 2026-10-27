// Opt in on live r180 objects, never on shared templates or engine prototypes.
import {Object3D} from 'three';
const original=Object3D.prototype.updateMatrixWorld;
const installed=new WeakSet(),controls=new WeakMap();

export function cacheTree(root){
 root.traverse(node=>{
  if(installed.has(node)||node.isCamera||node.isLight||node.isBone||node.isSkinnedMesh||node.updateMatrixWorld!==original)return;
  installed.add(node);
  const state={enabled:true,valid:false,pose:new Float64Array(10),parent:null};
  controls.set(node,state);
  node.updateMatrixWorld=function(force){
   // Forced, manual, pivot and custom traversal paths keep normal engine behavior.
   if(force||!state.enabled||!this.matrixAutoUpdate||!this.matrixWorldAutoUpdate||this.pivot){
    state.valid=false;
    return original.call(this,force);
   }
   const p=this.position,q=this.quaternion,s=this.scale,a=state.pose;
   const same=state.valid&&a[0]===p.x&&a[1]===p.y&&a[2]===p.z&&a[3]===q.x&&a[4]===q.y&&a[5]===q.z&&a[6]===q.w&&a[7]===s.x&&a[8]===s.y&&a[9]===s.z;
   if(state.parent!==this.parent)this.matrixWorldNeedsUpdate=true;
   state.parent=this.parent;
   if(!same){
    a[0]=p.x;a[1]=p.y;a[2]=p.z;a[3]=q.x;a[4]=q.y;a[5]=q.z;a[6]=q.w;a[7]=s.x;a[8]=s.y;a[9]=s.z;
    state.valid=true;
   }else this.matrixAutoUpdate=false;
   try{return original.call(this,force);}
   finally{if(same)this.matrixAutoUpdate=true;}
  };
 });
}

// Focused equivalence checks may disable caching; no window/debug API is installed.
export function setCacheEnabled(root,enabled){
 root.traverse(node=>{
  const state=controls.get(node);
  if(state){state.enabled=enabled;state.valid=false;}
 });
}
