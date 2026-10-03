import * as T from 'three';
import { FIELD_TILE, FIELD_RADIUS, fieldPlan } from './field-layout.mjs';
import { toon, noise2, smoothstep } from './toon.mjs';
import { POND } from './content.mjs';
// cute_game's ground: soft region colours blended by noise, a gentle dapple and a sandy halo around the pond.
const HOME=new T.Color('#93e06a'),MEADOW=new T.Color('#a6e070'),FOREST=new T.Color('#5cbf57'),SAND=new T.Color('#ecd9a0'),scratch=new T.Color();
export function groundColor(x,z,out){const region=noise2(x*.022+11,z*.022-4);out.copy(HOME);out.lerp(MEADOW,smoothstep(1-region,.55,.8));out.lerp(FOREST,smoothstep(region,.62,.85)*.75);
 out.offsetHSL(0,0,(noise2(x*.15,z*.15)*.7+noise2(x*.6,z*.6)*.3-.5)*.09);
 const dx=Math.max(0,Math.abs(x-POND.x)-POND.w/2),dz=Math.max(0,Math.abs(z-POND.z)-POND.d/2),d=Math.hypot(dx,dz);if(d<2.6)out.lerp(SAND,(1-smoothstep(d,.6,2.6))*.85);return out;}

export class OpenFields {
  constructor(world) {
    this.world=world;this.group=new T.Group();world.outside.add(this.group);
    this.tiles=new Map();this.key='';this.created=0;this.retired=0;
    this.pending=0; // tiles still waiting for a kit (round 8, builder A; 0 in step 0: nothing waits)
    this.groundMaterial=toon({color:'#ffffff',vertexColors:true});
    this.grassMaterial=toon({color:'#4fb83a',side:T.DoubleSide});
    // Three little crossed blades share one geometry across every tuft.
    const blades=[];
    for(let i=0;i<3;i++){const a=i*Math.PI/3,dx=Math.cos(a)*.2,dz=Math.sin(a)*.2;blades.push(-dx,0,-dz, dx,0,dz, dx*.4,.48+i*.05,dz*.4);}
    this.grassGeometry=new T.BufferGeometry();this.grassGeometry.setAttribute('position',new T.Float32BufferAttribute(blades,3));this.grassGeometry.computeVertexNormals();
  }

  batch(geometry,material,points,cx,cz,shadow=false) {
    const mesh=new T.InstancedMesh(geometry,material,points.length),dummy=new T.Object3D();
    points.forEach((p,i)=>{dummy.position.set(p.x-cx*FIELD_TILE,0,p.z-cz*FIELD_TILE);dummy.rotation.set(0,p.angle,0);dummy.scale.setScalar(p.scale);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);});
    mesh.castShadow=shadow;mesh.receiveShadow=true;mesh.computeBoundingSphere();return mesh;
  }

  create(cx,cz) {
    const root=new T.Group();root.position.set(cx*FIELD_TILE,0,cz*FIELD_TILE);
    const geometry=new T.PlaneGeometry(FIELD_TILE,FIELD_TILE,40,40);geometry.rotateX(-Math.PI/2);geometry.translate(FIELD_TILE/2,.004,FIELD_TILE/2);
    const positions=geometry.getAttribute('position'),colors=[];
    for(let i=0;i<positions.count;i++){
      const x=root.position.x+positions.getX(i),z=root.position.z+positions.getZ(i);
      groundColor(x,z,scratch);colors.push(scratch.r,scratch.g,scratch.b);
    }
    geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));
    const ground=new T.Mesh(geometry,this.groundMaterial);ground.receiveShadow=true;root.add(ground);
    const plan=fieldPlan(cx,cz),blocks=plan.trees.map(p=>this.world.addTreeBlock({x:p.x,z:p.z,r:p.r,h:p.h,perch:p.perch}));
    for(const kind of ['tree_round','tree_pine']){
      const points=plan.trees.filter(p=>p.kind===kind);
      if(points.length)this.world.assets.get(kind)?.traverse(mesh=>{if(mesh.isMesh)root.add(this.batch(mesh.geometry,mesh.material,points,cx,cz,true));});
    }
    if(plan.grass.length)root.add(this.batch(this.grassGeometry,this.grassMaterial,plan.grass,cx,cz));
    this.group.add(root);this.created++;
    return {root,groundGeometry:geometry,treeCount:plan.trees.length,grassCount:plan.grass.length,blocks};
  }

  update(position) {
    const cx=Math.floor(position.x/FIELD_TILE),cz=Math.floor(position.z/FIELD_TILE);
    // Crossing a tile border asks for a new row of five tiles (a few milliseconds each on a phone). Only tiles next to yours
    // are swapped at once (after a jump: leaving a house, waking at home); the row ahead lies 128 m or more away, outside
    // any view, so it is built one tile a frame, nearest first, and for each tile built one left behind is released (the
    // number loaded stays 25). At a vehicle's 38 m/s a row is due every 1.7 s and takes 5 frames.
    if(cx!==this.cx||cz!==this.cz){
      this.cx=cx;this.cz=cz;this.key=`${cx},${cz}`;const wanted=new Set(),first=!this.tiles.size;
      for(let x=cx-FIELD_RADIUS;x<=cx+FIELD_RADIUS;x++)for(let z=cz-FIELD_RADIUS;z<=cz+FIELD_RADIUS;z++)wanted.add(`${x},${z}`);
      this.stale=[];for(const id of this.tiles.keys())if(!wanted.has(id))this.stale.push(id);
      this.queue=[];
      for(const id of wanted)if(!this.tiles.has(id)){const [x,z]=id.split(',').map(Number),d=Math.max(Math.abs(x-cx),Math.abs(z-cz));if(first||d<=1)this.swap(id,x,z);else this.queue.push({id,x,z,d:Math.hypot(x-cx,z-cz)});}
      this.queue.sort((a,b)=>b.d-a.d); // nearest last: pop() takes it
      this.world.groundMesh.position.set((cx+.5)*FIELD_TILE,-.3,(cz+.5)*FIELD_TILE);
    }
    else if(this.queue?.length){const t=this.queue.pop();this.swap(t.id,t.x,t.z);}
    else while(this.stale?.length)this.retire(this.stale.pop());
  }
  // Release a tile's GPU instance buffers, its ground and its trees' collision.
  retire(id){const tile=this.tiles.get(id);if(!tile)return;tile.root.removeFromParent();tile.root.traverse(mesh=>{if(mesh.isInstancedMesh)mesh.dispose();});tile.groundGeometry.dispose();for(const b of tile.blocks)this.world.removeTreeBlock(b);this.tiles.delete(id);this.retired++;}
  // One tile out (if any is left behind), one tile in.
  swap(id,x,z){if(this.stale.length)this.retire(this.stale.pop());this.tiles.set(id,this.create(x,z));}

  season(color) {this.groundMaterial.color.copy(color);}
  /** Resolves once the nine tiles round (x, z) stand (a teleport waits on it). STUB (step 0, builder A): tiles are built at once, so it resolves at once. */
  ensureNear(x,z){return Promise.resolve();}
  get metrics(){return{loadedTiles:this.tiles.size,createdTiles:this.created,retiredTiles:this.retired,trees:[...this.tiles.values()].reduce((n,t)=>n+t.treeCount,0),grass:[...this.tiles.values()].reduce((n,t)=>n+t.grassCount,0)};}
}

export class FieldBirds {
  constructor(world,bake) {
    this.world=world;this.group=new T.Group();world.outside.add(this.group);this.birds=[];this.last=0;
    const templates=new Map();
    for(const [name,leftName,rightName]of [['forest-birds','forest_raptor_wing_l','forest_raptor_wing_r'],['field-gull','Bird_WingL','Bird_WingR']]) {
      const source=world.raw.get(name).clone(true),left=source.getObjectByName(leftName),right=source.getObjectByName(rightName);
      const group=new T.Group();
      for(const [wing,label]of [[left,'left'],[right,'right']]) {
        const pivot=new T.Group();pivot.name=label;pivot.position.copy(wing.position);const copy=wing.clone(true);copy.position.set(0,0,0);const container=new T.Group();container.add(copy);pivot.add(bake(container));group.add(pivot);wing.removeFromParent();
      }
      group.add(bake(source));group.traverse(m=>{if(m.isMesh)m.castShadow=false;});templates.set(name,group);
    }
    for(let i=0;i<14;i++) {
      const kind=i%3===0?'forest-birds':'field-gull',mesh=templates.get(kind).clone(true);
      mesh.scale.setScalar(kind==='forest-birds'?.46:.78);this.group.add(mesh);
      this.birds.push({mesh,kind,left:mesh.getObjectByName('left'),right:mesh.getObjectByName('right'),cx:(i%4-1.5)*19,cz:(Math.floor(i/4)-1.5)*17,phase:i*2.39,radius:8+i%4*2,height:4.5+i%3*1.8,state:'fly',timer:8+i*3.1,from:new T.Vector3(),to:new T.Vector3(),t:0,tree:null});
    }
  }

  // Where a bird flies when it is circling.
  circle(b,time,out){const angle=time*(b.kind==='forest-birds'?.23:.34)+b.phase;out.set(b.cx+Math.cos(angle)*b.radius,b.height+Math.sin(time*.65+b.phase)*.65,b.cz+Math.sin(angle)*b.radius*.7);return angle;}
  // Birds circle for a while, then glide down to a nearby tree top and rest out of sight in the leaves.
  // A resting bird is hidden and skipped, so it costs no draw call and no animation.
  update(time,player) {
    const dt=Math.min(.1,Math.max(0,time-this.last));this.last=time;
    for(const b of this.birds) {
      if(b.state==='perch'){b.timer-=dt;if(b.tree?.gone||b.timer<=0){if(b.tree)b.tree.taken=false;b.state='takeoff';b.t=0;b.mesh.visible=true;b.from.copy(b.mesh.position);}else continue;}
      if(b.state==='fly'&&Math.hypot(b.cx-player.x,b.cz-player.z)>95){b.cx=Math.round(player.x/48)*48+Math.sin(b.phase)*32;b.cz=Math.round(player.z/48)*48+Math.cos(b.phase)*32;}
      let flap;
      if(b.state==='fly'){
        const angle=this.circle(b,time,b.mesh.position);b.mesh.rotation.y=Math.atan2(-Math.sin(angle),Math.cos(angle)*.7);b.mesh.rotation.z=Math.sin(angle)*.1;
        const glide=Math.sin(time*.42+b.phase)>.25;flap=glide?.1:Math.sin(time*(b.kind==='forest-birds'?4:6)+b.phase)*.58;
        b.timer-=dt;if(b.timer<=0){const tree=this.world.perchNear(b.mesh.position.x,b.mesh.position.z,40);if(tree){tree.taken=true;b.tree=tree;b.state='land';b.t=0;b.from.copy(b.mesh.position);b.to.set(tree.x,tree.h,tree.z);}else b.timer=10;}
      } else {
        // Landing and take-off glide along an arc with quick wingbeats.
        b.t+=dt/2.6;if(b.state==='takeoff')this.circle(b,time,b.to);const k=Math.min(1,b.t),target=b.to,ease=k*k*(3-2*k);
        b.mesh.position.lerpVectors(b.from,target,ease);b.mesh.position.y+=Math.sin(k*Math.PI)*(b.state==='land'?1.2:2);
        b.mesh.rotation.y=Math.atan2(target.x-b.from.x,target.z-b.from.z);b.mesh.rotation.z=0;flap=Math.sin(time*11+b.phase)*.7;
        if(k>=1){if(b.state==='land'){b.state='perch';b.timer=14+Math.random()*26;b.mesh.visible=false;}else{b.state='fly';b.timer=22+Math.random()*30;}}
      }
      b.left.rotation.z=-flap;b.right.rotation.z=flap;
    }
  }
  get metrics(){return{count:this.birds.length,species:[...new Set(this.birds.map(b=>b.kind))],resting:this.birds.filter(b=>b.state==='perch').length};}
}
