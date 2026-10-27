import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {cacheTransforms} from '../src/transform-cache.mjs';
import {commitAttribute,commitInstances} from '../src/buffer-updates.mjs';
import {BurstPool} from '../src/burst-pool.mjs';

function tree(){const root=new T.Group(),parent=new T.Group(),limb=new T.Group(),tip=new T.Object3D(),other=new T.Group();root.add(parent,other);parent.add(limb);limb.add(tip);return{root,parent,limb,tip,other};}
function same(a,b){for(const key of Object.keys(a)){const aa=a[key].matrixWorld.elements,bb=b[key].matrixWorld.elements;aa.forEach((v,i)=>assert.ok(Math.abs(v-bb[i])<1e-10,key+' '+i));}}
test('the cached traversal is reviewed against the installed Three.js r180 contract',()=>assert.equal(T.REVISION,'180','Review transform-cache against Object3D before upgrading Three.js'));

test('ray picking and bounds see cached parent movement, and custom local updaters are excluded',()=>{
 const root=new T.Group(),mesh=new T.Mesh(new T.BoxGeometry(),new T.MeshBasicMaterial()),custom=new T.Object3D();
 custom.updateMatrix=function(){this.matrix.makeTranslation(2,0,0);this.matrixWorldNeedsUpdate=true;};root.add(mesh,custom);const original=custom.updateMatrixWorld;cacheTransforms(root);assert.equal(custom.updateMatrixWorld,original);
 root.updateMatrixWorld();root.position.set(4,2,-3);root.rotation.y=.5;root.scale.setScalar(2);mesh.updateWorldMatrix(true,false);
 const box=new T.Box3().setFromObject(mesh),centre=box.getCenter(new T.Vector3());assert.ok(centre.distanceTo(new T.Vector3(4,2,-3))<1e-10);
 const ray=new T.Raycaster(new T.Vector3(4,2,8),new T.Vector3(0,0,-1));assert.ok(ray.intersectObject(mesh).length>0);root.updateMatrixWorld();assert.ok(ray.intersectObject(mesh).length>0);mesh.geometry.dispose();mesh.material.dispose();
});
test('cached transforms match r180 through movement, turning, scale, hiding, picking, reparenting and force',()=>{
 const a=tree(),b=tree();cacheTransforms(b.root);
 const steps=[x=>{},x=>x.parent.position.set(4,2,-3),x=>x.limb.rotation.set(.3,.7,-.2),x=>x.parent.scale.set(1.4,.7,2),x=>x.parent.visible=false,x=>x.tip.position.set(0,2,1),x=>x.parent.visible=true,x=>x.other.add(x.limb),x=>{x.root.rotation.y=.8;x.tip.updateWorldMatrix(true,false);},x=>{x.limb.position.x=3;x.limb.updateMatrix();},x=>{x.parent.matrixAutoUpdate=false;x.parent.matrix.makeTranslation(8,7,6);x.parent.matrixWorldNeedsUpdate=true;},x=>x.parent.matrixAutoUpdate=true];
 for(const step of steps){step(a);step(b);a.root.updateMatrixWorld();b.root.updateMatrixWorld();same(a,b);a.root.updateMatrixWorld(true);b.root.updateMatrixWorld(true);same(a,b);}
});
test('unchanged cached poses avoid composition and newly added descendants still move',()=>{
 const a=tree();cacheTransforms(a.root);a.root.updateMatrixWorld();let count=0;const original=T.Matrix4.prototype.compose;
 T.Matrix4.prototype.compose=function(...args){count++;return original.apply(this,args);};
 try{a.root.updateMatrixWorld();assert.equal(count,0);const child=new T.Object3D();a.limb.add(child);child.position.y=7;a.root.updateMatrixWorld();assert.equal(child.matrixWorld.elements[13],7);count=0;a.root.updateMatrixWorld();assert.equal(count,0);}finally{T.Matrix4.prototype.compose=original;}
});
test('cameras, manually driven bones, skins and custom traversal retain their update methods',()=>{
 const root=new T.Scene(),bone=new T.Bone(),camera=new T.PerspectiveCamera(),skin=new T.SkinnedMesh(),custom=new T.Group();custom.updateMatrixWorld=function(force){return T.Object3D.prototype.updateMatrixWorld.call(this,force);};bone.matrixAutoUpdate=bone.matrixWorldAutoUpdate=false;root.add(bone,camera,skin,custom);const methods=[bone,camera,skin,custom].map(n=>n.updateMatrixWorld);cacheTransforms(root);[bone,camera,skin,custom].forEach((n,i)=>assert.equal(n.updateMatrixWorld,methods[i]));bone.matrixWorld.makeTranslation(2,3,4);root.updateMatrixWorld(true);assert.equal(bone.matrixWorld.elements[13],3);
});
test('selective uploads preserve pending culled ranges and stop on identical Float32 poses',()=>{
 const a=new T.InstancedBufferAttribute(new Float32Array(64),16);a.array[0]=Math.PI;assert.equal(commitAttribute(a,16),true);a.clearUpdateRanges();const v=a.version;
 a.array[0]=Math.PI;assert.equal(commitAttribute(a,16),false);assert.equal(a.version,v);
 a.array[4]=2;commitAttribute(a,16);assert.deepEqual(a.updateRanges,[{start:4,count:1}]);
 // A later frame changes another slot before this culled buffer has rendered.
 a.array[20]=4;commitAttribute(a,32);assert.deepEqual(a.updateRanges,[{start:4,count:28}]);
 a.array[5]=7;commitAttribute(a,16);assert.deepEqual(a.updateRanges,[{start:4,count:28}]);a.clearUpdateRanges();assert.equal(commitAttribute(a,32),false);
});
test('count shrink, middle-slot replacement, reappearance and storage growth keep correct prefixes',()=>{
 const mesh=new T.InstancedMesh(new T.BoxGeometry(),new T.MeshBasicMaterial(),4),m=new T.Matrix4();for(let i=0;i<4;i++)mesh.setMatrixAt(i,m.makeTranslation(i,0,0));commitInstances(mesh,4);mesh.instanceMatrix.clearUpdateRanges();const v=mesh.instanceMatrix.version;
 commitInstances(mesh,2);assert.equal(mesh.instanceMatrix.version,v);mesh.setMatrixAt(0,m.makeTranslation(9,0,0));commitInstances(mesh,2);assert.equal(mesh.instanceMatrix.updateRanges[0].start,12);
 commitInstances(mesh,0);assert.equal(mesh.visible,false);commitInstances(mesh,4);assert.equal(mesh.visible,true);assert.equal(mesh.instanceMatrix.array[12],9);
 mesh.instanceMatrix.array=new Float32Array(128);mesh.instanceMatrix.array[76]=12;commitAttribute(mesh.instanceMatrix,80);assert.equal(mesh.instanceMatrix.updateRanges[0].count,80);
 mesh.dispose();mesh.geometry.dispose();mesh.material.dispose();
});
