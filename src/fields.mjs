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
    const plan=fieldPlan(cx,cz);
    for(const kind of ['tree_round','tree_pine']){
      const points=plan.trees.filter(p=>p.kind===kind);
      if(points.length)this.world.assets.get(kind)?.traverse(mesh=>{if(mesh.isMesh)root.add(this.batch(mesh.geometry,mesh.material,points,cx,cz,true));});
    }
    if(plan.grass.length)root.add(this.batch(this.grassGeometry,this.grassMaterial,plan.grass,cx,cz));
    this.group.add(root);this.created++;
    return {root,groundGeometry:geometry,treeCount:plan.trees.length,grassCount:plan.grass.length};
  }

  update(position) {
    const cx=Math.floor(position.x/FIELD_TILE),cz=Math.floor(position.z/FIELD_TILE),key=`${cx},${cz}`;
    if(key===this.key)return;
    this.key=key;const wanted=new Set();
    for(let x=cx-FIELD_RADIUS;x<=cx+FIELD_RADIUS;x++)for(let z=cz-FIELD_RADIUS;z<=cz+FIELD_RADIUS;z++)wanted.add(`${x},${z}`);
    // Release old GPU instance buffers before creating the incoming row.
    for(const [id,tile]of this.tiles)if(!wanted.has(id)){
      tile.root.removeFromParent();tile.root.traverse(mesh=>{if(mesh.isInstancedMesh)mesh.dispose();});tile.groundGeometry.dispose();this.tiles.delete(id);this.retired++;
    }
    for(const id of wanted)if(!this.tiles.has(id)){const [x,z]=id.split(',').map(Number);this.tiles.set(id,this.create(x,z));}
    this.world.groundMesh.position.set((cx+.5)*FIELD_TILE,-.3,(cz+.5)*FIELD_TILE);
  }

  season(color) {this.groundMaterial.color.copy(color);}
  get metrics(){return{loadedTiles:this.tiles.size,createdTiles:this.created,retiredTiles:this.retired,trees:[...this.tiles.values()].reduce((n,t)=>n+t.treeCount,0),grass:[...this.tiles.values()].reduce((n,t)=>n+t.grassCount,0)};}
}

export class FieldBirds {
  constructor(world,bake) {
    this.group=new T.Group();world.outside.add(this.group);this.birds=[];
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
      this.birds.push({mesh,kind,left:mesh.getObjectByName('left'),right:mesh.getObjectByName('right'),cx:(i%4-1.5)*19,cz:(Math.floor(i/4)-1.5)*17,phase:i*2.39,radius:8+i%4*2,height:4.5+i%3*1.8});
    }
  }

  update(time,player) {
    for(const b of this.birds) {
      if(Math.hypot(b.cx-player.x,b.cz-player.z)>95){b.cx=Math.round(player.x/48)*48+Math.sin(b.phase)*32;b.cz=Math.round(player.z/48)*48+Math.cos(b.phase)*32;}
      const angle=time*(b.kind==='forest-birds'?.23:.34)+b.phase;
      b.mesh.position.set(b.cx+Math.cos(angle)*b.radius,b.height+Math.sin(time*.65+b.phase)*.65,b.cz+Math.sin(angle)*b.radius*.7);
      b.mesh.rotation.y=Math.atan2(-Math.sin(angle),Math.cos(angle)*.7);b.mesh.rotation.z=Math.sin(angle)*.1;
      const glide=Math.sin(time*.42+b.phase)>.25,flap=glide?.1:Math.sin(time*(b.kind==='forest-birds'?4:6)+b.phase)*.58;
      b.left.rotation.z=-flap;b.right.rotation.z=flap;
    }
  }
  get metrics(){return{count:this.birds.length,species:[...new Set(this.birds.map(b=>b.kind))]};}
}
