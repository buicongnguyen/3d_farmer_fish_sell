import {Object3D} from 'three';

// r180: keep the engine's traversal/force rules; only suppress unchanged local
// compositions. Live instances opt in. Templates and Three's prototypes stay intact.
const records=new WeakMap(),native=Object3D.prototype.updateMatrixWorld;
function added(event){cacheTransforms(event.child);}
function cachedUpdate(force){
 const r=records.get(this),p=this.position,q=this.quaternion,s=this.scale;
 if(!this.matrixAutoUpdate||this.matrixWorldAutoUpdate===false||this.pivot){r.valid=false;return native.call(this,force);}
 const changed=!r.valid||p.x!==r.x||p.y!==r.y||p.z!==r.z||q.x!==r.qx||q.y!==r.qy||q.z!==r.qz||q.w!==r.qw||s.x!==r.sx||s.y!==r.sy||s.z!==r.sz;
 if(r.parent!==this.parent){this.matrixWorldNeedsUpdate=true;r.parent=this.parent;}
 if(changed){r.x=p.x;r.y=p.y;r.z=p.z;r.qx=q.x;r.qy=q.y;r.qz=q.z;r.qw=q.w;r.sx=s.x;r.sy=s.y;r.sz=s.z;r.valid=true;this.updateMatrix();}
 // Match r180's world/force propagation without a second function call or
 // toggling public flags on every node. Explicit updateWorldMatrix stays native.
 if(this.matrixWorldNeedsUpdate||force){
  if(this.parent===null)this.matrixWorld.copy(this.matrix);
  else this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix);
  this.matrixWorldNeedsUpdate=false;force=true;
 }
 for(let i=0,n=this.children.length;i<n;i++)this.children[i].updateMatrixWorld(force);
}
export function cacheTransforms(root){
 if(!root)return root;
 // Cameras, bones, skinning and custom updaters keep their original semantics.
 if(!records.has(root)&&!root.isCamera&&!root.isBone&&!root.isSkinnedMesh&&!root.isLight&&root.updateMatrixWorld===native&&root.updateMatrix===Object3D.prototype.updateMatrix){
  records.set(root,{valid:false,parent:root.parent});root.updateMatrixWorld=cachedUpdate;
  root.addEventListener('childadded',added);
 }
 for(const child of root.children)cacheTransforms(child);
 return root;
}
