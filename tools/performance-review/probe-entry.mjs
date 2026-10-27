import * as T from 'three';
import {World} from './src/world.mjs';
const probe=window.__perf={world:null,rows:[],counting:false,pass:'view',counts:{},restore:[]};
const init=World.prototype.init;
World.prototype.init=async function(...args){probe.world=this;return init.apply(this,args);};
const update=World.prototype.update;World.prototype.update=function(dt){return update.call(this,probe.manual?dt:0);};
probe.reset=()=>probe.counts={draws:0,shadowDraws:0,triangles:0,shadowTriangles:0,composes:0,multiplies:0,uploads:0,uploadBytes:0,allocations:0,allocationBytes:0};
probe.instrument=()=>{
 if(probe.restore.length)return;
 const wrap=(o,k,fn)=>{const f=o[k];o[k]=fn(f);probe.restore.push(()=>o[k]=f);};
 for(const [name,key] of [['compose','composes'],['multiplyMatrices','multiplies']])wrap(T.Matrix4.prototype,name,f=>function(...a){if(probe.counting)probe.counts[key]++;return f.apply(this,a);});
 const w=probe.world,gl=w.renderer.getContext();
 wrap(w.renderer.shadowMap,'render',f=>function(...a){probe.pass='shadow';try{return f.apply(this,a);}finally{probe.pass='view';}});
 for(const name of ['drawElements','drawArrays','drawElementsInstanced','drawArraysInstanced'])wrap(gl,name,f=>function(...a){if(probe.counting){const n=name.includes('Arrays')?a[2]:a[1],copies=name.endsWith('Instanced')?(name.includes('Arrays')?a[3]:a[4]):1,c=probe.counts;c.draws++;if(probe.pass==='shadow')c.shadowDraws++;if(a[0]===gl.TRIANGLES){c.triangles+=n/3*copies;if(probe.pass==='shadow')c.shadowTriangles+=n/3*copies;}}return f.apply(this,a);});
 wrap(gl,'bufferSubData',f=>function(target,offset,data,srcOffset=0,length=0){if(probe.counting){const bytes=data.BYTES_PER_ELEMENT??1,n=length||data.length-srcOffset;probe.counts.uploads++;probe.counts.uploadBytes+=data instanceof DataView?data.byteLength:n*bytes;}return f.apply(this,arguments);});
 wrap(gl,'bufferData',f=>function(target,data){if(probe.counting){probe.counts.allocations++;probe.counts.allocationBytes+=typeof data==='number'?data:data.byteLength;}return f.apply(this,arguments);});
};
probe.uninstrument=()=>{for(const f of probe.restore.reverse())f();probe.restore=[];};
probe.step=(dt=0)=>{probe.reset();probe.counting=true;const start=performance.now();try{probe.world.update(dt);}finally{probe.counting=false;}return{...probe.counts,workMs:performance.now()-start};};
probe.memory=()=>{
 const geometries=new Set(),arrays=new Set(),materials=new Set();let nodes=0,visible=0,instances=0,bytes=0;
 function add(a){if(a?.array&&!arrays.has(a.array.buffer)){arrays.add(a.array.buffer);bytes+=a.array.buffer.byteLength;}}
 probe.world.scene.traverse(o=>{nodes++;if(o.visible)visible++;if(o.geometry&&!geometries.has(o.geometry)){geometries.add(o.geometry);Object.values(o.geometry.attributes).forEach(add);add(o.geometry.index);}if(o.isInstancedMesh){instances+=o.count;add(o.instanceMatrix);add(o.instanceColor);}for(const m of o.material?(Array.isArray(o.material)?o.material:[o.material]):[])materials.add(m);});
 return{nodes,visibleLocalFlag:visible,geometries:geometries.size,materials:materials.size,instances,sceneBufferBytes:bytes,renderer:{...probe.world.renderer.info.memory},programs:probe.world.renderer.info.programs.length};
};
probe.stop=()=>{window.__stopRaf=true;};
probe.ready=async()=>{const w=probe.world;probe.manual=true;w.paused=false;w.state.time=10;w.t=0;w.state.settings.sound=false;w.follow.copy(w.player.position);w.update(0);await Promise.all([w.pondLoad,new Promise(r=>setTimeout(r,1500))]);for(let i=0;i<180;i++)w.update(1/60);w.t=10;for(let i=0;i<10;i++)w.update(0);};
await import('./src/main.mjs');
