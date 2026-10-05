import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { OpenFields } from '../src/fields.mjs';

globalThis.self ??= globalThis;
const bytes=fs.readFileSync(new URL('../public/assets/models/scenery.glb',import.meta.url));
const {scene}=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
const triangles=g=>(g.index?.count??g.attributes.position.count)/3;
const sameBox=(a,b)=>{for(const end of ['min','max'])for(const axis of ['x','y','z'])assert.ok(Math.abs(a[end][axis]-b[end][axis])<1e-5,`${end}.${axis}: ${a[end][axis]} != ${b[end][axis]}`);};

test('driving tree LOD keeps shipped tree bounds, instance clearing and materials, and restores full geometry on foot',()=>{
 const treeMeshes={},originals=[];
 for(const [kind,count] of [['tree_round',26],['tree_blossom',8],['tree_pine',8]]){
  const node=scene.getObjectByName(kind).clone(true);node.position.set(0,0,0);node.updateMatrixWorld(true);const parts=[];
  node.traverse(m=>{if(m.isMesh){const g=m.geometry.index?m.geometry.toNonIndexed():m.geometry.clone();g.applyMatrix4(m.matrixWorld);parts.push(g);}});
  const geometry=mergeGeometries(parts),mesh=new T.InstancedMesh(geometry,new T.MeshBasicMaterial(),count);parts.forEach(g=>g.dispose());
  for(let i=0;i<count;i++)mesh.setMatrixAt(i,new T.Matrix4().makeScale(i===0?0:1,i===0?0:1,i===0?0:1).setPosition(i*3,0,i%3));
  mesh.computeBoundingBox();mesh.computeBoundingSphere();treeMeshes[kind]={meshes:[mesh],index:new Map([[kind,0]])};
  originals.push({mesh,geometry,material:mesh.material,box:mesh.boundingBox.clone(),matrices:mesh.instanceMatrix.array.slice()});
 }
 const host={world:{treeMeshes}},change=low=>OpenFields.prototype.drivingTrees.call(host,low);
 change(false);assert.equal(host.driveTrees,undefined,'walking does not allocate extra tree geometry');
 change(true);let full=0,simple=0;
 for(const o of originals){
  const m=o.mesh;full+=triangles(o.geometry)*m.count;simple+=triangles(m.geometry)*m.count;
  sameBox(m.geometry.boundingBox,o.geometry.boundingBox);sameBox(m.boundingBox,o.box);
  assert.ok(Number.isFinite(m.boundingSphere.radius));assert.deepEqual(m.instanceMatrix.array,o.matrices);assert.equal(m.material,o.material);
  assert.ok(m.geometry.attributes.normal&&m.geometry.attributes.color,'the reduced model retains shaded vertex colours');
 }
 assert.ok(simple<full*.15,`${full} full triangles become ${simple} in each visible/shadow pass`);
 const lows=originals.map(o=>o.mesh.geometry);change(false);
 for(const o of originals){assert.equal(o.mesh.geometry,o.geometry);sameBox(o.mesh.boundingBox,o.box);}
 change(true);originals.forEach((o,i)=>assert.equal(o.mesh.geometry,lows[i],'repeat mounts reuse the same geometry'));
 assert.equal(host.driveTrees.length,3);for(const t of host.driveTrees)t.simple.dispose();
 for(const o of originals){o.mesh.dispose();o.geometry.dispose();o.material.dispose();}
});
