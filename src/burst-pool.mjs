import * as T from 'three';
import {commitInstances} from './buffer-updates.mjs';

// The original opaque, lit icosahedra, colours and trajectories in one draw.
// Grow instead of dropping particles; share the world's geometry and own only
// instance buffers/material. Expired slots reuse their records on the next burst.
export class BurstPool{
 constructor(scene,geometry){
  this.scene=scene;this.geometry=geometry;this.records=[];this.count=0;this.capacity=0;this.mesh=null;
  this.material=null;
  this.transform=new T.Object3D();this.color=new T.Color();
 }
 reserve(n,sourceMaterial){
  if(!this.capacity){this.material=sourceMaterial.clone();this.material.onBeforeCompile=sourceMaterial.onBeforeCompile;this.material.customProgramCacheKey=sourceMaterial.customProgramCacheKey;this.material.color.set('white');}
  if(n<=this.capacity)return;
  const next=Math.max(32,this.capacity*2,n),mesh=new T.InstancedMesh(this.geometry,this.material,next);
  mesh.name='burst-particles';mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);mesh.setColorAt(0,this.color.set('white'));mesh.instanceColor.setUsage(T.DynamicDrawUsage);
  mesh.frustumCulled=false;mesh.castShadow=false;mesh.receiveShadow=false;mesh.raycast=()=>{};mesh.count=0;mesh.visible=false;
  if(this.mesh){this.mesh.removeFromParent();this.mesh.dispose();}this.mesh=mesh;this.capacity=next;this.scene.add(mesh);
 }
 emit(x,y,z,vx,vy,vz,life,size,color,sourceMaterial,initialScale=1){
  this.reserve(this.count+1,sourceMaterial);
  const p=this.records[this.count]??(this.records[this.count]={});
  Object.assign(p,{x,y,z,vx,vy,vz,life,size,scale:initialScale,color});this.count++;
 }
 update(dt){
  if(!this.count){if(this.mesh){this.mesh.count=0;this.mesh.visible=false;}return;}
  // Stable compaction preserves the spawn/draw order of overlapping opaque pieces.
  let n=0;
  for(let i=0,end=this.count;i<end;i++){
   const p=this.records[i];p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;p.vy-=dt*4;p.scale=Math.min(1,p.life)*p.size;
   if(p.life<=0)continue;
   if(n!==i){const spare=this.records[n];this.records[n]=p;this.records[i]=spare;}
   this.transform.position.set(p.x,p.y,p.z);this.transform.scale.setScalar(p.scale);this.transform.updateMatrix();this.mesh.setMatrixAt(n,this.transform.matrix);this.mesh.setColorAt(n,this.color.copy(p.color));n++;
  }
  this.count=n;commitInstances(this.mesh,n,true);
 }
 dispose(){this.mesh?.removeFromParent();this.mesh?.dispose();this.material?.dispose();this.mesh=null;this.count=this.capacity=0;this.records=[];}
}
