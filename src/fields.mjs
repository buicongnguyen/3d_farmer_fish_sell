// The open fields (round 8, builder A; spec 1.6, 3.5): the ground and the scenery of every 64 m tile round the player, in the
// thirteen squares and on the rim beyond them.
//
// A tile is, at most: its ground (1 draw), one InstancedMesh for each blocking kind (three, four on candy and ice, up to
// six on a centre tile that holds two home regions) and ONE batch of cards for every cover and dressing kind (cover-cards.mjs).
// Only blocking pieces 1 m or taller cast a shadow. A rim tile is its ground and one batch of 20 pieces: 2 draws, 0 shadows.
//
// Reuse (Zoo Garden, the user's own game):
//   ground recipe      src/ground.ts:36-59, 69-79   ported (the landing pad and the radius terms dropped: no landing here)
//   tree shades        src/scatter.ts:29-38          ported: four shades by instance colour on every tree kind
//   stand-in shapes    src/scatter.ts:117-147        ported: cones and balls while a kit is on its way, merged to one geometry a kind
//   cover cards        src/cover-cards.ts            ported (cover-cards.mjs)
//   low graphics       src/scatter.ts:58-61          ported: every second cover card and every dressing card left out on "battery"
import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { FIELD_TILE, FIELD_RADIUS, fieldTrees, fieldCards, fieldRim, tileRegions, nearestLand } from './field-layout.mjs';
import { toon, hotToon, kitMaterial, depthFor, noise2, smoothstep } from './toon.mjs';
import { POND } from './content.mjs';
import { regionAt, borderDistance, trailDistance, inWorld, RUNS_OF, REGION } from './regions.mjs';
import { GROUND, RIM_KINDS, KIT_TINTS } from './region-life.mjs';
import { blockers } from './land-features.mjs';
import { wildCell } from './wilds.mjs';
import { CAGES, cageSpot } from './friends.mjs';
import { CoverAtlas, tickCoverCards, disposeCards } from './cover-cards.mjs';

// ---------------------------------------------------------------- the ground's colours
// cute_game's ground: soft region colours, a gentle dapple, sand trails, a sandy halo round the pond; each land its own recipe.
const HOME=new T.Color('#93e06a'),MEADOW=new T.Color('#a6e070'),FOREST=new T.Color('#5cbf57'),SAND=new T.Color('#ecd9a0'),TRAIL=new T.Color('#e8cf92'),TRAIL_CANYON=new T.Color('#e8a868'),other=new T.Color();
const tones=new Map(),tone=hex=>{let c=tones.get(hex);if(!c)tones.set(hex,c=new T.Color(hex));return c;};
/** The world's edge colour under everything, beyond the rim (the reference's far ground). */
export const UNDER_GROUND='#3f8f4a';
/** Recipes meet over this many metres on each side of a border (the ribbon covers the line itself). */
const BLEND=3;
/** A region's own ground at a point. `seen` is for a neighbour blending toward it: a checker land answers with its middle colour (its squares come from a texture). */
function regionColor(id,x,z,out,seen=false){
 const g=GROUND[id],kind=REGION[id].kind;
 if(kind==='village'){
  // The village's lawn, as before round 8.
  const region=noise2(x*.022+11,z*.022-4);out.copy(HOME);out.lerp(MEADOW,smoothstep(1-region,.55,.8));out.lerp(FOREST,smoothstep(region,.62,.85)*.75);
  out.offsetHSL(0,0,(noise2(x*.15,z*.15)*.7+noise2(x*.6,z*.6)*.3-.5)*.09);
 }else if(kind==='home'){
  // ground.ts:38-46: the region's colour, 0.09 of lightness noise, and the sand trail (redder in the canyon).
  out.copy(tone(g.base));out.offsetHSL(0,0,(noise2(x*.15,z*.15)*.7+noise2(x*.6,z*.6)*.3-.5)*.09);
  const trail=trailDistance(x,z);if(trail<2.2)out.lerp(id==='east'?TRAIL_CANYON:TRAIL,1-smoothstep(trail,1.2,2.2));
 }else{
  // ground.ts:47-59: low to high by two-octave noise, soft patches at 85 %, a fine dapple, and lava's scorch.
  const n=noise2(x*.08,z*.08)*.65+noise2(x*.4,z*.4)*.35;
  if(g.checker){if(seen)out.copy(tone(g.low)).lerp(tone(g.high),.5);else out.setRGB(1,1,1).offsetHSL(0,0,(n-.5)*.06);}
  else{
   out.copy(tone(g.low)).lerp(tone(g.high),smoothstep(n,.3,.75));
   if(g.patch){out.lerp(tone(g.patch),smoothstep(noise2(x*.11+31,z*.11-17),.5,.72)*.85);out.offsetHSL(0,0,(noise2(x*.3+5,z*.3)-.5)*.08);}
   if(g.scorch)out.lerp(tone(g.scorch),Math.max(0,noise2(x*.2+7,z*.2)-.55)*1.5);
  }
 }
 g.paint?.(x,z,out);
 return out;
}
/** The rim beyond a land: its landing colour, darkened by 0.15 where pieces stand on it (ground.ts:58); a land without rim kinds is open sea or cloud, at its own colour. */
function rimColor(land,x,z,out){
 out.copy(tone(GROUND[land].rim));if(RIM_KINDS[land]?.length)out.offsetHSL(0,0,-.15);
 return out.offsetHSL(0,0,(noise2(x*.15,z*.15)-.5)*.04);
}
const runDistance=(x,z,r)=>{const dx=r.bx-r.ax,dz=r.bz-r.az,k=Math.max(0,Math.min(1,((x-r.ax)*dx+(z-r.az)*dz)/(dx*dx+dz*dz)));return Math.hypot(x-r.ax-dx*k,z-r.az-dz*k);};
/** The ground's colour at any point: the region's recipe, blended into its neighbour's over the last 3 m; the rim's beyond the world. */
export function groundColor(x,z,out){
 const id=regionAt(x,z);
 if(id===null){
  const land=nearestLand(x,z),d=borderDistance(x,z);rimColor(land,x,z,out);
  if(d<BLEND)out.lerp(regionColor(land,x,z,other,true),.5-d/(2*BLEND));
 }else{
  regionColor(id,x,z,out);
  let d=BLEND,run=null;const runs=RUNS_OF[id];for(let i=0;i<runs.length;i++){const v=runDistance(x,z,runs[i]);if(v<d){d=v;run=runs[i];}}
  if(run){const beyond=run.left===id?run.right:run.left;if(beyond===null)rimColor(id,x,z,other);else regionColor(beyond,x,z,other,true);out.lerp(other,.5-d/(2*BLEND));}
  // The family pond's sandy halo (the four centre tiles are also the village's lawn).
  if(id==='village'){const dx=Math.max(0,Math.abs(x-POND.x)-POND.w/2),dz=Math.max(0,Math.abs(z-POND.z)-POND.d/2),p=Math.hypot(dx,dz);if(p<2.6)out.lerp(SAND,(1-smoothstep(p,.6,2.6))*.85);}
 }
 return out;
}
/** A 2 x 2 pixel checker, repeated so each square is 4 m, drawn crisp with nearest filtering (ground.ts:69-76). */
function checker(a,b){
 // The bytes are the hex colours themselves (sRGB), and the texture says so: they are drawn as every other colour of the game is.
 const bytes=hex=>{const n=parseInt(hex.slice(1),16);return[n>>16&255,n>>8&255,n&255,255];};
 const pa=bytes(a),pb=bytes(b),texture=new T.DataTexture(new Uint8Array([...pa,...pb,...pb,...pa]),2,2);
 texture.colorSpace=T.SRGBColorSpace;texture.magFilter=texture.minFilter=T.NearestFilter;texture.generateMipmaps=false;texture.wrapS=texture.wrapT=T.RepeatWrapping;texture.repeat.set(FIELD_TILE/8,FIELD_TILE/8);texture.needsUpdate=true;
 return texture;
}
/** The 20 tiles a trail lies on (each axis is a tile seam): they are built with 1 m between vertices so the 1 m fade has a vertex on each side. */
const trailTile=(cx,cz)=>((cx===-1||cx===0)&&cz>=-3&&cz<=2)||((cz===-1||cz===0)&&cx>=-3&&cx<=2);

// ---------------------------------------------------------------- stand-in shapes (scatter.ts:117-147)
const LOOK={
 tree_round:['#8a5a3b','#6fbf5a','tree'],tree_blossom:['#8a5a3b','#f4a6c6','tree'],tree_pine:['#8a5a3b','#3f9a5a','pine'],tree_swamp:['#5a4a3a','#3f8a6a','tree'],
 tree_dead:['#c8bca8','#c8bca8','spire'],ash_tree:['#3a3036','#ff8a3d','spire'],deadtree:['#4a3a5a','#a07aff','spire'],jungletree:['#6a4a2a','#3f9a3a','tree'],
 cloudtree:['#ffffff','#e8f4ff','tree'],candy_tree:['#ffffff','#ff7ab0','tree'],palm:['#c8a070','#5ab05a','tree'],snow_pine:['#6a4a3a','#e8f4ff','pine'],
 rock:['#9a9aa8','#9a9aa8','rock'],rock_red:['#e07a4a','#e07a4a','rock'],snow_rock:['#c8d8e8','#ffffff','rock'],lava_rock:['#4a3a40','#ff6a2b','rock'],skyrock:['#d8e4f0','#8fd36a','rock'],
 obsidian:['#2a2036','#6a4a8a','spire'],ice_spire:['#bfe8ff','#bfe8ff','spire'],crystals:['#a77aff','#7af0ff','spire'],candy_cane:['#ff4a5a','#ffffff','spire'],mini_volcano:['#4a3a40','#ff6a2b','pine'],
 bush:['#4fae4a','#4fae4a','blob'],dry_bush:['#d8b870','#d8b870','blob'],fern:['#3f9a4a','#3f9a4a','blob'],gumdrops:['#ff7ab0','#9be36f','blob'],donut:['#e8b070','#ff9fd0','blob'],
 cupcake:['#f2c070','#ffffff','blob'],toyblock:['#ff5a4a','#4a8aff','blob'],toyball:['#ff5a4a','#ffe14d','blob'],snowman:['#ffffff','#ffffff','blob'],coral:['#ff7a8a','#ffb070','blob'],
 toadstools:['#f4ead8','#e8443a','blob'],mushroom:['#f4ead8','#e8443a','blob'],log:['#8a5a3b','#8a5a3b','blob'],
 pebbles:['#b9b2a6','#b9b2a6','blob'],sprinkles:['#ff4fa3','#3fb6ff','tuft'],toy_bits:['#ee2d2d','#2462ea','blob'],sky_bloom:['#fcfeff','#8fd2ff','blob'],
 jungle_bloom:['#3fc23e','#ff5a2e','tuft'],shells:['#ffe3c8','#ff8a4a','blob'],ice_shards:['#bfe8ff','#bfe8ff','tuft'],embers:['#3a3036','#ff7a2b','blob'],glow_shrooms:['#d8ccf0','#9a6aff','tuft'],
 flowers:['#5aa04a','#ffd25a','tuft'],tuft:['#79b85c','#79b85c','tuft'],reeds:['#6a9a4a','#8a6a3a','tuft'],
};
const DRESSING=new Set(['pebbles','sprinkles','toy_bits','sky_bloom','jungle_bloom','shells','ice_shards','embers','glow_shrooms']);
const fallbacks=new Map(),place=new T.Matrix4();
/** The reference's stand-in for a kind whose model file has not arrived: {geometry, height}, one merged geometry with baked colour and glow. */
export function fallbackShape(kind){
 let shape=fallbacks.get(kind);if(shape)return shape;
 const [base,top,form]=LOOK[kind]??['#9a9aa8','#9a9aa8','rock'],glow=/lava|ash|crystals|deadtree/.test(kind)?1.2:0,parts=[];
 const part=(geometry,hex,x=0,y=0,z=0,sx=1,sy=sx,sz=sx,lit=0)=>{
  const g=geometry.index?geometry.toNonIndexed():geometry;g.applyMatrix4(place.makeScale(sx,sy,sz).setPosition(x,y,z));g.deleteAttribute('uv');
  const n=g.getAttribute('position').count,c=tone(hex),colors=new Float32Array(n*3);for(let i=0;i<n;i++)colors.set([c.r,c.g,c.b],i*3);
  g.setAttribute('color',new T.BufferAttribute(colors,3));g.setAttribute('glow',new T.BufferAttribute(new Float32Array(n).fill(lit),1));parts.push(g);
 };
 if(form==='tree'){part(new T.CylinderGeometry(.18,.28,2.2,6).translate(0,1.1,0),base);part(new T.IcosahedronGeometry(1.4,0),top,0,2.9,0);}
 else if(form==='pine'){part(new T.CylinderGeometry(.15,.25,1,6).translate(0,.5,0),base);part(new T.ConeGeometry(1.3,3,7),top,0,2.3,0,1,1,1,kind==='mini_volcano'?1.2:0);}
 else if(form==='spire')part(new T.ConeGeometry(.4,2.6,5).translate(0,1.3,0),base,0,0,0,1,1,1,glow);
 else if(form==='rock')part(new T.DodecahedronGeometry(.9,0),base,0,.45,0,1,.7,1);
 else if(form==='tuft')part(new T.ConeGeometry(.13,.5,3).translate(0,.25,0),kind==='flowers'?top:base);
 else if(DRESSING.has(kind))part(new T.IcosahedronGeometry(.18,0),top,0,.1,0,1,.6,1,kind==='embers'?1.2:0);
 else part(new T.IcosahedronGeometry(.55,0),base,0,.45,0,1,.8,1);
 const geometry=mergeGeometries(parts);parts.forEach(p=>p.dispose());geometry.computeBoundingBox();
 fallbacks.set(kind,shape={geometry,height:geometry.boundingBox.max.y});
 return shape;
}
// A few sun, warm and cool shades break up repeated trees: stored once in the instance buffer, no extra material or draw.
const TREE_SHADES=[[1,1,1],[.95,1,.9],[1,.96,.87],[.88,.96,1]],TREE_KIND=/tree|pine|palm/;
function treeShade(p,color){
 let h=Math.imul(Math.round(p.x*100),73856093)^Math.imul(Math.round(p.z*100),19349663);
 for(let i=0;i<p.kind.length;i++)h=Math.imul(h^p.kind.charCodeAt(i),16777619);
 h^=h>>>16;const shade=TREE_SHADES[(h>>>0)%TREE_SHADES.length];return color.setRGB(shade[0],shade[1],shade[2]);
}
/** Card kinds a creature could be mistaken for (biomes.ts LOOKALIKES): the card keeps 8 m from its twin's spawn point. */
const CARD_TWINS={mushroom:['toadstools'],mushking:['toadstools'],frog:['bush'],jelly:['gumdrops'],urchin:['coral']};
let cages=null;
/**
 * The circles a tile's cards keep out of (field-layout.mjs fieldCards takes them): 2 m round every cage, for every kind, and
 * 8 m round each seeded creature that a card kind looks like, for those kinds only. Seeded creatures and cages are the same
 * with the box open or shut, so the cards never change when the box does. Pure: it reads the plans, nothing of the view.
 */
export function cardKeepOut(cx,cz){
 const out=[],x0=cx*FIELD_TILE,z0=cz*FIELD_TILE,near=(x,z,r)=>x>x0-r&&x<x0+FIELD_TILE+r&&z>z0-r&&z<z0+FIELD_TILE+r;
 cages??=Object.keys(CAGES).map(id=>cageSpot(id)).filter(Boolean);
 for(const s of cages)if(near(s.x,s.z,2))out.push({x:s.x,z:s.z,r:2});
 // Creature cells are 32 m: the tile's four, and the ring round them (a twin 8 m beyond the tile's side still reaches in).
 for(let i=cx*2-1;i<=cx*2+2;i++)for(let k=cz*2-1;k<=cz*2+2;k++)for(const c of wildCell(i,k)){const kinds=CARD_TWINS[c.type];if(kinds&&near(c.x,c.z,8))out.push({x:c.x,z:c.z,r:8,kinds});}
 return out;
}
const LOW_DECOR=1,SHADOW_KINDS=3; // pieces lower than 1 m never cast a shadow (scatter.ts LOW_DECOR); at most three kinds a region do
const scratch=new T.Color(),dummy=new T.Object3D();

export class OpenFields {
  constructor(world) {
    this.world=world;this.group=new T.Group();world.outside.add(this.group);
    this.tiles=new Map();this.key='';this.created=0;this.retired=0;this.groundPool={};this.groundMade=0;this.queue=[];this.stale=[];this.refills=0;this.peak=0;
    // Home regions and the village take the season's tint; the lands do not (candy and ice would turn autumn-yellow).
    this.groundMaterial=toon({color:'#ffffff',vertexColors:true});
    this.landMaterial=toon({color:'#ffffff',vertexColors:true});this.hotMaterial=hotToon();
    this.checkerMaterials=new Map();
    this.kitMaterial=kitMaterial();this.kitMaterialC=kitMaterial(1);
    this.atlas=new CoverAtlas(world.renderer);
    world.canvas.addEventListener('webglcontextrestored',()=>this.atlas.restore());
    this.cardKinds=new Map(); // card key -> kind, for every kind a tile has asked for (its cell is redrawn when its kit arrives)
    this.loading=new Set();this.failed=new Set();this.missing=new Set();this.deferred=new Set();this.live=false;
    this.detail=world.state.settings.quality==='battery'?0:1;
  }
  /** Tiles still to be built or waiting for a kit: 0 when everything round the player stands in its final shape. */
  get pending(){let n=this.queue.length;for(const t of this.tiles.values())if(t.waiting.size||t.refill)n++;return n;}

  // ---- kits. A model is asked for by its key ('wilds/reeds', 'scenery/rock@shadow'). The shipped scenery kit is baked at once;
  // the other four are fetched, and never before the first frame (spec 17.3): until a kit lands its pieces are stand-in shapes.
  want(key){
   const kits=this.world.kits;if(kits.has(key))return true;
   const [kit,name]=key.split('/'),tint=name.split('@')[1];if(this.failed.has(kit)||this.missing.has(key))return false;
   if(kit!=='scenery'&&!this.live){this.deferred.add(key);return false;}
   const job=this.world.loadKit(kit,tint?{tints:{[name]:KIT_TINTS[tint]??{}}}:{});
   if(kits.has(key))return true;
   // The kit is here and has no such piece (a table names a root the file lacks): its stand-in stays, and nobody waits for it.
   if(this.world.kitScenes.has(kit)){this.missing.add(key);console.warn(`Scenery kit "${kit}" has no piece "${name}".`);return false;}
   if(!this.loading.has(kit)){this.loading.add(kit);job.then(ok=>{this.loading.delete(kit);this.arrived(kit,ok!==false);});}
   return false;
  }
  /** A kit has landed (or given up): redraw its card cells, and mark the tiles that hold its stand-ins for a refill. */
  arrived(kit,ok){
   if(!ok)this.failed.add(kit);
   for(const [key,kind] of this.cardKinds)if(key.startsWith(kit+'/')&&!this.atlas.final(key)&&ok&&this.want(key))this.atlas.draw(key,this.world.kits.get(key).geometry,true);
   for(const tile of this.tiles.values())for(const key of [...tile.waiting])if(key.startsWith(kit+'/')){if(ok&&this.want(key))tile.refill=true;else tile.waiting.delete(key);}
  }
  /** What a blocking or rim kind is drawn with: its baked kit piece, or the stand-in while the kit is on its way. */
  model(key,kind){
   if(this.want(key)){const mesh=this.world.kits.get(key);return{geometry:mesh.geometry,height:mesh.userData.height,final:true};}
   const shape=fallbackShape(kind);return{geometry:shape.geometry,height:shape.height,final:false};
  }
  /** The atlas cell of a card kind: drawn from the kit piece when it is here, from the stand-in until then. */
  cell(key,kind){
   if(this.atlas.final(key))return this.atlas.cells.get(key).index;
   this.cardKinds.set(key,kind);
   if(this.want(key))return this.atlas.draw(key,this.world.kits.get(key).geometry,true);
   return this.atlas.cells.get(key)?.index??this.atlas.draw(key,fallbackShape(kind).geometry,false);
  }

  batch(model,points,cx,cz) {
    const shaded=TREE_KIND.test(points[0].kind),mesh=new T.InstancedMesh(model.geometry,shaded?this.kitMaterialC:this.kitMaterial,points.length);
    points.forEach((p,i)=>{dummy.position.set(p.x-cx*FIELD_TILE,0,p.z-cz*FIELD_TILE);dummy.rotation.set(0,p.angle,0);dummy.scale.setScalar(p.scale);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);if(shaded)mesh.setColorAt(i,treeShade(p,scratch));});
    if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;depthFor(mesh);
    mesh.castShadow=false;mesh.receiveShadow=true;mesh.computeBoundingSphere();mesh.userData.final=model.final;mesh.userData.height=model.height;return mesh;
  }
  ground(cx,cz,regions) {
    // A retired tile's ground of the same grid is reused (smooth-dense-scenes): the plane never changes, only its colours are rewritten.
    // On "battery" the grid is coarser (48 and 32 cells a side, 1.3 and 2 m): the phone line of spec 18 holds with a phone held sideways.
    const rim=!regions.length,segments=rim?16:this.detail===0?(trailTile(cx,cz)?48:32):trailTile(cx,cz)?48:40;let geometry=this.groundPool[segments]?.pop();
    if(!geometry){geometry=new T.PlaneGeometry(FIELD_TILE,FIELD_TILE,segments,segments);geometry.rotateX(-Math.PI/2);geometry.translate(FIELD_TILE/2,.004,FIELD_TILE/2);geometry.userData.segments=segments;geometry.setAttribute('color',new T.BufferAttribute(new Float32Array(geometry.getAttribute('position').count*3),3));this.groundMade++;}
    const positions=geometry.getAttribute('position'),color=geometry.getAttribute('color'),colors=color.array,ox=cx*FIELD_TILE,oz=cz*FIELD_TILE;
    for(let i=0;i<positions.count;i++){groundColor(ox+positions.getX(i),oz+positions.getZ(i),scratch);colors[i*3]=scratch.r;colors[i*3+1]=scratch.g;colors[i*3+2]=scratch.b;}
    color.needsUpdate=true;
    // One material a tile: a tile holds either home regions and the village (the season's tint) or one land.
    const id=regions.find(r=>REGION[r].kind==='land'),g=id?GROUND[id]:null;
    let material=this.groundMaterial;
    if(rim)material=this.landMaterial;
    else if(g?.checker){material=this.checkerMaterials.get(id);if(!material)this.checkerMaterials.set(id,material=toon({color:'#ffffff',vertexColors:true,map:checker(g.low,g.high)}));}
    else if(id)material=id==='lava'?this.hotMaterial:this.landMaterial;
    const mesh=new T.Mesh(geometry,material);mesh.receiveShadow=true;mesh.name='field-ground';return mesh;
  }
  /** The tile's one batch of cards (null when it has none). On "battery" every second cover card is left out, and every dressing card. */
  cards(tile) {
    let cover=0;const list=[];
    for(const c of fieldCards(tile.cx,tile.cz,cardKeepOut(tile.cx,tile.cz))){
     if(this.detail<1&&(c.cls==='dressing'||cover++%2))continue;
     c.cell=this.cell(c.key,c.kind);if(c.cell>=0)list.push(c);
    }
    tile.cardCount=list.length;
    if(!list.length)return null;
    return this.atlas.batch(list,tile.cx*FIELD_TILE,tile.cz*FIELD_TILE);
  }
  /** Fills (or refills) a tile's instanced batches: one a kind. A batch already in its final shape is kept. */
  fill(tile) {
    for(const [key,points] of tile.kinds){
     const old=tile.batches.get(key);if(old?.userData.final)continue;
     const model=this.model(key,points[0].kind);if(old&&!model.final)continue;
     if(old){old.removeFromParent();old.dispose();}
     const mesh=this.batch(model,points,tile.cx,tile.cz);tile.root.add(mesh);tile.batches.set(key,mesh);
     if(model.final||this.failed.has(key.split('/')[0])||this.missing.has(key))tile.waiting.delete(key);else tile.waiting.add(key);
    }
    // Shadows: only pieces 1 m or taller cast one, and at most three kinds a region (the tallest), so a tile is never more than three
    // shadow draws (six on a centre tile with two regions). On candy that leaves the cupcake out, on ice nothing: the fourth kind of
    // those lands is the price of one more main draw, not of a shadow draw too. A rim tile casts none.
    if(!tile.land){
     const most=SHADOW_KINDS*Math.max(1,tile.regions.filter(id=>id!=='village').length),tall=[...tile.batches.values()].filter(m=>m.userData.height>=LOW_DECOR).sort((a,b)=>b.userData.height-a.userData.height).slice(0,most);
     for(const mesh of tile.batches.values())mesh.castShadow=mesh.userData.tall=tall.includes(mesh);
    }
    if(tile.cardDetail!==this.detail){
     if(tile.cardMesh){tile.cardMesh.removeFromParent();disposeCards(tile.cardMesh);}
     tile.cardMesh=tile.land?null:this.cards(tile);tile.cardDetail=this.detail;if(tile.cardMesh)tile.root.add(tile.cardMesh);
    }
    tile.refill=false;
  }

  create(cx,cz) {
    const root=new T.Group();root.position.set(cx*FIELD_TILE,0,cz*FIELD_TILE);
    const regions=tileRegions(cx,cz),rim=fieldRim(cx,cz),trees=fieldTrees(cx,cz),x0=cx*FIELD_TILE,z0=cz*FIELD_TILE;
    // Beyond the rim (±448 m) nothing is made: the under-plane shows there. Nobody stands near it once the world has its edge.
    const ground=regions.length||rim.land?this.ground(cx,cz,regions):null;if(ground)root.add(ground);
    // Colliders never wait for a kit: every blocking piece of the plan, and the round things of the land that lie in this tile (ponds, pools).
    const blocks=trees.map(p=>this.world.addTreeBlock({x:p.x,z:p.z,r:p.r,h:p.h,perch:p.perch}));
    for(const id of regions)for(const b of blockers(id))if(b.x>=x0&&b.x<x0+FIELD_TILE&&b.z>=z0&&b.z<z0+FIELD_TILE)blocks.push(this.world.addTreeBlock({x:b.x,z:b.z,r:b.r,carOnly:!!b.carOnly,perch:false}));
    const kinds=new Map();for(const p of regions.length?trees:rim.pieces){let list=kinds.get(p.key);if(!list)kinds.set(p.key,list=[]);list.push(p);}
    const tile={cx,cz,root,ground,groundGeometry:ground?.geometry??null,regions,land:rim.land,kinds,batches:new Map(),waiting:new Set(),refill:false,cardMesh:null,cardDetail:-1,cardCount:0,treeCount:trees.length,rimCount:rim.pieces.length,blocks};
    this.fill(tile);
    this.group.add(root);this.created++;
    return tile;
  }

  update(position) {
    const cx=Math.floor(position.x/FIELD_TILE),cz=Math.floor(position.z/FIELD_TILE);let built=0;
    tickCoverCards(this.world.t);this.world.borders?.sync();
    // Nothing is fetched before the first frame: the kits the first tiles asked for are requested on the second update.
    if(!this.live&&this.tiles.size){this.live=true;for(const key of this.deferred)if(this.want(key))for(const t of this.tiles.values())if(t.waiting.has(key))t.refill=true;this.deferred.clear();}
    const detail=this.world.state.settings.quality==='battery'?0:1;
    if(detail!==this.detail){this.detail=detail;for(const t of this.tiles.values())t.refill=true;}
    // Crossing a tile border asks for a new row of five tiles (a few milliseconds each on a phone). Only tiles next to yours
    // are built at once (at boot, after a jump: leaving a house, waking at home, Home's teleport); the others lie 64 m or more
    // away, at the edge of any view or beyond it, so they are built one tile a frame, nearest first, and for each tile built one
    // left behind is released (the number loaded stays 25). At a vehicle's 38 m/s a row is due every 1.7 s and takes 5 frames.
    if(cx!==this.cx||cz!==this.cz){
      this.cx=cx;this.cz=cz;this.key=`${cx},${cz}`;const wanted=new Set(),jump=!this.live;
      for(let x=cx-FIELD_RADIUS;x<=cx+FIELD_RADIUS;x++)for(let z=cz-FIELD_RADIUS;z<=cz+FIELD_RADIUS;z++)wanted.add(`${x},${z}`);
      this.stale=[];for(const id of this.tiles.keys())if(!wanted.has(id))this.stale.push(id);
      this.queue=[];
      for(const id of wanted)if(!this.tiles.has(id)){const [x,z]=id.split(',').map(Number),d=Math.max(Math.abs(x-cx),Math.abs(z-cz));if(d<=1){this.swap(id,x,z);built++;}else this.queue.push({id,x,z,d:Math.hypot(x-cx,z-cz)});}
      this.queue.sort((a,b)=>b.d-a.d); // nearest last: pop() takes it
      this.world.groundMesh.position.set((cx+.5)*FIELD_TILE,-.3,(cz+.5)*FIELD_TILE);
      if(!jump&&built>this.peak)this.peak=built;
    }
    else if(this.queue.length){const t=this.queue.pop();this.swap(t.id,t.x,t.z);built++;}
    else while(this.stale.length)this.retire(this.stale.pop());
    // A kit arriving (or a change of graphics setting) refills at most one tile a frame, and none in a frame that built one.
    if(!built)for(const tile of this.tiles.values())if(tile.refill){this.fill(tile);this.refills++;break;}
  }
  /** World.cullView: a tile's ground, cards and batches are drawn only while its 64 m square meets the view; a tall batch also while the
   * square stretched by its shadow does, and casts only then. Returns how many batches cast. */
  cullView(meets,shadows){let n=0;for(const t of this.tiles.values()){const b=t.box??={min:{x:t.cx*FIELD_TILE,z:t.cz*FIELD_TILE},max:{x:(t.cx+1)*FIELD_TILE,y:0,z:(t.cz+1)*FIELD_TILE}};
   for(const m of t.batches.values())if(m.userData.tall)b.max.y=Math.max(b.max.y,m.userData.height*1.4);const seen=meets(b),cast=shadows&&meets(b,true);
   if(t.ground)t.ground.visible=seen;if(t.cardMesh)t.cardMesh.visible=seen;for(const m of t.batches.values()){const c=m.castShadow=cast&&!!m.userData.tall;m.visible=seen||c;n+=c;}}return n;}
  // Release a tile's GPU instance buffers, its ground, its cards and its pieces' collision.
  retire(id){const tile=this.tiles.get(id);if(!tile)return;tile.root.removeFromParent();for(const mesh of tile.batches.values())mesh.dispose();if(tile.cardMesh)disposeCards(tile.cardMesh);const g=tile.groundGeometry;if(g){const pool=this.groundPool[g.userData.segments]??=[];if(pool.length<8)pool.push(g);else g.dispose();}for(const b of tile.blocks)this.world.removeTreeBlock(b);this.tiles.delete(id);this.retired++;}
  // One tile out (if any is left behind), one tile in.
  swap(id,x,z){if(this.stale.length)this.retire(this.stale.pop());this.tiles.set(id,this.create(x,z));}

  season(color) {this.groundMaterial.color.copy(color);}
  /** Builds the nine tiles round (x, z) now, whatever the queue holds, and resolves when they stand (Home's teleport holds its fade on it). */
  ensureNear(x,z){
   const cx=Math.floor(x/FIELD_TILE),cz=Math.floor(z/FIELD_TILE);
   for(let i=cx-1;i<=cx+1;i++)for(let k=cz-1;k<=cz+1;k++){const id=`${i},${k}`;if(this.tiles.has(id))continue;const at=this.queue.findIndex(t=>t.id===id);if(at>=0)this.queue.splice(at,1);this.swap(id,i,k);}
   return Promise.resolve();
  }
  get metrics(){
   const tiles=[...this.tiles.values()];
   return{loadedTiles:this.tiles.size,createdTiles:this.created,retiredTiles:this.retired,groundsMade:this.groundMade,trees:tiles.reduce((n,t)=>n+t.treeCount,0),grass:0,cards:tiles.reduce((n,t)=>n+t.cardCount,0),rim:tiles.reduce((n,t)=>n+t.rimCount,0),pending:this.pending,queued:this.queue.length,refills:this.refills,peakBuilt:this.peak,cardKinds:this.atlas.cells.size};
  }
  /** Read-only numbers about every loaded tile, for the browser suites: what it holds and what it costs to draw. */
  describe(){
   return[...this.tiles.values()].map(t=>{const meshes=[...t.batches.values()];
    return{x:t.cx,z:t.cz,regions:t.regions,land:t.land,blocking:t.treeCount,rim:t.rimCount,cards:t.cardCount,kinds:[...t.kinds.keys()],standIns:meshes.filter(m=>!m.userData.final).length,waiting:[...t.waiting],
     draws:(t.groundGeometry?1:0)+meshes.length+(t.cardMesh?1:0),shadowDraws:meshes.filter(m=>m.castShadow).length,triangles:(t.groundGeometry?t.groundGeometry.index.count/3:0)+meshes.reduce((n,m)=>n+m.count*(m.geometry.index?m.geometry.index.count:m.geometry.getAttribute('position').count)/3,0)+t.cardCount*2};});
  }
}

export class FieldBirds {
  constructor(world,bake) {
    this.world=world;this.group=new T.Group();world.outside.add(this.group);this.birds=[];this.last=0;this.shown=14;
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
    // Each bird is three draws (two wings and a body). Once the view is wide (effective zoom over 28.5: the far view of a ride, or
    // the wheel zoomed right out) only 6 of the 14 circle, and 3 on "battery" (spec section 18); the others wait out of sight.
    const w=this.world,far=w.zoom/(w.camera.zoom||1)>28.5,cap=far?(w.state.settings.quality==='battery'?3:6):this.birds.length;this.shown=cap;
    for(const [i,b] of this.birds.entries()) {
      if(b.state==='perch'){b.timer-=dt;if(b.tree?.gone||b.timer<=0){if(b.tree)b.tree.taken=false;b.state='takeoff';b.t=0;b.mesh.visible=true;b.from.copy(b.mesh.position);}else continue;}
      if(b.state==='fly'){const hidden=i>=cap;if(b.mesh.visible===hidden)b.mesh.visible=!hidden;if(hidden)continue;}
      // A bird that has fallen behind circles a new spot near you, and never one beyond the world's edge.
      if(b.state==='fly'&&Math.hypot(b.cx-player.x,b.cz-player.z)>95){const x=Math.round(player.x/48)*48+Math.sin(b.phase)*32,z=Math.round(player.z/48)*48+Math.cos(b.phase)*32,inside=inWorld(x,z)||!inWorld(player.x,player.z);b.cx=inside?x:player.x;b.cz=inside?z:player.z;}
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
  get metrics(){return{count:this.birds.length,species:[...new Set(this.birds.map(b=>b.kind))],resting:this.birds.filter(b=>b.state==='perch').length,shown:this.birds.filter(b=>b.mesh.visible).length};}
}
