import test from 'node:test';
import assert from 'node:assert/strict';
import {fieldPlan,fieldTrees,fieldCards,fieldRim,resetFieldPlan,nearestLand,inVillage,homeBearing,OUTDOOR_LIMIT,HOMESTEAD,GATE_ROAD,FIELD_TILE,TILE_MAX,CLEAR,RIM_TILES} from '../src/field-layout.mjs';
import {inSafeZone} from '../src/ward.mjs';
import {landClear} from '../src/land-features.mjs';
import {regionAt,shapeOf,trailPoint,borderDistance,trailDistance,trailOffset,REGION,DENS} from '../src/regions.mjs';
import {DECOR,CARDS,RIM_KINDS,GROUND,HEAT} from '../src/region-life.mjs';
import {groundColor,fallbackShape,cardKeepOut,UNDER_GROUND,OpenFields} from '../src/fields.mjs';
import {hotToon} from '../src/toon.mjs';
import {CAGES,cageSpot} from '../src/friends.mjs';
import {wildCell} from '../src/wilds.mjs';
import {findRoute} from '../src/navigation.mjs';
import {FishingSimulation,LINE_BREAK,STRAIN,lineBreakChance} from '../src/fishing.mjs';
import * as T from 'three';

// Round 8 (builder A): the plan of a 64 m tile is by region. fieldTrees gives the blocking pieces, fieldCards the cover and
// dressing cards, fieldRim the rim beyond the world; fieldPlan wraps the three. No number of the ward is typed here.
const inTile=(p,x,z)=>p.x>=x*FIELD_TILE&&p.x<(x+1)*FIELD_TILE&&p.z>=z*FIELD_TILE&&p.z<(z+1)*FIELD_TILE;
const onGateRoad=(p,pad=0)=>p.x>GATE_ROAD.x0&&p.x<GATE_ROAD.x1+pad&&p.z>GATE_ROAD.z0-pad&&p.z<GATE_ROAD.z1+pad;
const TITANS=DENS.filter(d=>d.titan);
/** Everything a tile's plan must keep to, whatever the tables hold. */
function checkTile(x,z){
 const plan=fieldPlan(x,z);assert.deepEqual(plan,fieldPlan(x,z),`tile ${x},${z} is the same on every call`);assert.deepEqual(fieldTrees(x,z),plan.trees);assert.deepEqual(plan.grass,[],'the grass blades are gone: cards replace them');
 assert.ok(plan.trees.length<=TILE_MAX.blocking&&plan.cards.length<=TILE_MAX.cards,`tile ${x},${z}: ${plan.trees.length} blocking, ${plan.cards.length} cards`);
 for(const p of [...plan.trees,...plan.cards]){
  assert.ok(inTile(p,x,z));assert.equal(inVillage(p.x,p.z),false);assert.equal(inSafeZone(p.x,p.z),false,'no field piece inside the ward');
  assert.ok(plan.regions.includes(regionAt(p.x,p.z))&&regionAt(p.x,p.z)!=='village');assert.ok(borderDistance(p.x,p.z)>=CLEAR.border,`3 m from every border (${borderDistance(p.x,p.z).toFixed(2)})`);assert.ok(trailDistance(p.x,p.z)>=CLEAR.trail,'5 m from a trail');assert.equal(onGateRoad(p),false);
 }
 for(const [i,t] of plan.trees.entries()){
  assert.ok(t.r>0&&t.h>0&&typeof t.perch==='boolean'&&typeof t.kind==='string'&&t.key.endsWith('/'+t.kind)||t.key.includes('/'+t.kind+'@'),'r, h, perch, kind and key on every blocking piece');
  assert.ok(borderDistance(t.x,t.z)>=CLEAR.border+t.r-1e-9,'its collider too is clear of the ribbon');assert.equal(onGateRoad(t,2),false,'a trunk keeps 2 m off the gate’s road');
  assert.ok(TITANS.every(d=>Math.hypot(d.x-t.x,d.z-t.z)>=CLEAR.titan),'no blocking piece within 32 m of a titan’s den');
  for(const u of plan.trees.slice(i+1))assert.ok(Math.hypot(u.x-t.x,u.z-t.z)>=u.r+t.r+CLEAR.gap-1e-9,'a walker fits between any two colliders');
 }
 for(const c of plan.cards){assert.ok(c.scale>0&&(c.glow===0||c.glow===1)&&(c.cls==='cover'||c.cls==='dressing')&&c.turn>=0&&c.turn<1);assert.ok(plan.trees.every(t=>Math.hypot(t.x-c.x,t.z-c.z)>=t.r),'no card inside a collider');}
 return plan;
}
test('every tile of the world and its rim has a stable plan inside its budget, with nothing in the ward, on a border, on a trail or on the gate’s road',()=>{
 let world=0,rim=0,straddle=0;
 for(let x=-RIM_TILES;x<RIM_TILES;x++)for(let z=-RIM_TILES;z<RIM_TILES;z++){
  const plan=checkTile(x,z);
  if(plan.regions.length){
   // A tile of the world (88 touch the disc: 52 whole, 36 straddling its edge): its regions, pieces by position, rim pieces only outside the circle.
   world++;assert.deepEqual(fieldRim(x,z),{land:plan.land,pieces:plan.rim});
   if(plan.rim.length){straddle++;for(const p of plan.rim){assert.ok(inTile(p,x,z)&&regionAt(p.x,p.z)===null&&borderDistance(p.x,p.z)>=CLEAR.border&&p.scale>=1.6&&p.scale<=2.2);assert.ok(RIM_KINDS[nearestLand(p.x,p.z)].some(k=>k.kind===p.kind));}}
  }
  else{
   // A rim tile: nothing blocks and nothing covers; pieces of its lands' rim kinds (none where the land has no rim kinds: open sea, cloud).
   rim++;assert.deepEqual(plan.trees,[]);assert.deepEqual(plan.cards,[]);
   if(plan.land)assert.equal(REGION[plan.land].kind,'land','every rim tile belongs to a land');
   for(const p of plan.rim){assert.ok(inTile(p,x,z)&&regionAt(p.x,p.z)===null&&borderDistance(p.x,p.z)>=CLEAR.border&&p.scale>=1.6&&p.scale<=2.2);assert.ok(RIM_KINDS[nearestLand(p.x,p.z)].some(k=>k.kind===p.kind));}
   assert.deepEqual(fieldRim(x,z),{land:plan.land,pieces:plan.rim});
  }
  assert.ok(new Set(plan.rim.map(p=>p.key)).size<=2,'at most one kind a land, two lands at most in a tile');
 }
 assert.equal(world,88,'88 tiles touch the disc');assert.ok(straddle>20&&rim>20,straddle+' straddling tiles, '+rim+' rim tiles');
 // Beyond the rim (±448 m) nothing is ever planned.
 for(const [x,z] of [[8,0],[-8,3],[7,7],[50,-80],[-500,500]])assert.deepEqual(fieldPlan(x,z),{trees:[],grass:[],cards:[],regions:[],rim:[],land:null});
 // The named tiles: the homestead's tiles hold the village and one quarter each, the junction of the forest, the Candy Land and the Toybox holds three regions.
 assert.deepEqual([...fieldPlan(0,0).regions].sort(),['south','village']);assert.deepEqual([...fieldPlan(-1,-1).regions].sort(),['north','village']);assert.deepEqual([...fieldPlan(0,-1).regions].sort(),['east','village']);assert.deepEqual([...fieldPlan(-1,0).regions].sort(),['village','west']);
 assert.deepEqual([...fieldPlan(-2,1).regions].sort(),['ice','jungle','west'],'a diagonal meeting the inner circle: three regions');
 assert.notDeepEqual(fieldPlan(2,0).trees,fieldPlan(2,-1).trees);assert.notDeepEqual(fieldPlan(2,0).cards.map(c=>c.x-128),fieldPlan(1,0).cards.map(c=>c.x-64),'tiles do not repeat');
 // The rim's land is the sector of the point: no tie rule beyond the radial lines.
 assert.equal(nearestLand(0,-400),'cloud');assert.equal(nearestLand(400,0),'toy');assert.equal(nearestLand(-400,0),'ocean');assert.equal(nearestLand(0,400),'jungle');
});
/** Runs `body` with made-up tables for some regions, and puts the real ones back. */
function withTables(decor,cards,body){
 const keep=[{...DECOR},{...CARDS}];Object.assign(DECOR,decor);Object.assign(CARDS,cards);resetFieldPlan();
 try{body();}finally{Object.assign(DECOR,keep[0]);Object.assign(CARDS,keep[1]);resetFieldPlan();}
}
const row=(kind,count,r,extra={})=>({kind,kit:'scenery',count,r,h:3,perch:/tree/.test(kind),scale:[.9,1.3],glow:false,...extra});
const card=(kind,count,cls='cover',extra={})=>({kind,kit:'scenery',count,cls,glow:0,...extra});
test('a tile away from the village and the dens holds exactly its table’s counts; a centre tile’s follow the share of each strip',()=>{
 // The forest of spec 3.5: 40 blocking pieces and 202 cards on a 64 m tile.
 const forest=[row('tree_round',18,.42,{scale:[1.25,2.1]}),row('tree_pine',18,.42,{scale:[1.25,2.1]}),row('rock',4,.7)];
 const cover=[card('tuft',70),card('toadstools',32,'cover',{kit:'wilds'}),card('flowers',24),card('bush',26),card('log',8,'cover',{kit:'wilds'}),card('pebbles',42,'dressing',{kit:'dressing',glow:1})];
 withTables({west:forest,south:[row('tree_blossom',5,.42),row('rock',4,.7)],east:[row('rock_red',14,1.1,{kit:'wilds'})]},{west:cover,south:[card('flowers',66)],east:[card('dry_bush',45,'cover',{kit:'wilds'})]},()=>{
  for(const [x,z] of [[-2,0],[-1,1]]){
   const plan=checkTile(x,z),count=kind=>plan.trees.filter(t=>t.kind===kind).length,cards=kind=>plan.cards.filter(c=>c.kind===kind).length;
   assert.deepEqual([count('tree_round'),count('tree_pine'),count('rock'),plan.trees.length],[18,18,4,40],`forest tile ${x},${z}`);
   assert.deepEqual([cards('tuft'),cards('toadstools'),cards('flowers'),cards('bush'),cards('log'),cards('pebbles'),plan.cards.length],[70,32,24,26,8,42,202]);
   const rock=plan.trees.find(t=>t.kind==='rock'),tree=plan.trees.find(t=>t.kind==='tree_pine');assert.equal(rock.perch,false);assert.equal(tree.perch,true);assert.ok(Math.abs(rock.r-.7*rock.scale)<1e-12&&rock.scale>=.9&&rock.scale<=1.3&&Math.abs(tree.h-3*tree.scale)<1e-12);
   assert.equal(plan.cards.find(c=>c.kind==='pebbles').cls,'dressing');assert.equal(plan.cards.find(c=>c.kind==='pebbles').glow,1);assert.equal(plan.cards.find(c=>c.kind==='toadstools').key,'wilds/toadstools');assert.equal(tree.key,'scenery/tree_pine');
  }
  // The tile (0, 0) holds the ward and one quarter, the meadow: only its kinds, fewer than a whole tile's.
  const centre=checkTile(0,0),kinds=new Set(centre.trees.map(t=>t.kind));
  assert.ok([...kinds].every(k=>['tree_blossom','rock'].includes(k)),[...kinds].join());assert.ok(centre.trees.length>=1&&centre.trees.length<9,`${centre.trees.length} pieces beside the ward`);
  for(const t of centre.trees)assert.equal(regionAt(t.x,t.z),'south','the quarter grows its own region’s kinds');
  for(const c of centre.cards)assert.equal(c.kind,'flowers');
  assert.ok(centre.cards.length>10&&centre.cards.length<50);
  // The tile with the Mountain Turtle's clearing holds fewer rocks than a whole canyon tile (14), and none in the clearing.
  const turtle=TITANS.find(d=>d.region==='east'),tx=Math.floor(turtle.x/FIELD_TILE),tz=Math.floor(turtle.z/FIELD_TILE),near=checkTile(tx,tz);
  assert.ok(near.trees.length<14,`${near.trees.length} rocks beside the turtle`);
  assert.equal(checkTile(1,-1).trees.length,14);
 });
 // With the real tables back, the same tiles are planned from them again.
 assert.ok(fieldPlan(-2,0).trees.every(t=>DECOR.west.some(r=>r.kind===t.kind)));
});
test('a tinted row is drawn from its own baked copy, `where` goes to landClear, and cards keep out of the caller’s circles without moving the others',()=>{
 withTables({toy:[row('rock',3,.7,{tint:'shadow'})]},{toy:[card('tuft',40,'cover',{tint:'shadow'}),card('glow_shrooms',48,'dressing',{kit:'dressing',glow:1})]},()=>{
  const plan=checkTile(3,0);assert.equal(plan.trees.length,3);assert.ok(plan.trees.every(t=>t.key==='scenery/rock@shadow'&&t.kind==='rock'));assert.ok(plan.cards.some(c=>c.key==='scenery/tuft@shadow'));
  const all=fieldCards(3,0,[]),hole={x:all[0].x,z:all[0].z,r:9},inside=c=>Math.hypot(c.x-hole.x,c.z-hole.z)<hole.r;
  assert.ok(all.filter(inside).length>=1);
  // A circle for every kind: the cards outside it are exactly the plan's.
  assert.deepEqual(fieldCards(3,0,[hole]),all.filter(c=>!inside(c)));
  // A circle for some kinds only (a lookalike twin): the other kinds stay.
  assert.deepEqual(fieldCards(3,0,[{...hole,kinds:['tuft']}]),all.filter(c=>!(inside(c)&&c.kind==='tuft')));
  assert.deepEqual(fieldCards(3,0,[{...hole,kinds:['coral']}]),all);
 });
});
test('the circles the tiles build: no card within 2 m of a cage, and no toadstool or bush card within 8 m of the creature it looks like',()=>{
 // Cages: every cage's tile gets a circle for every kind, and the plan made with it has no card inside.
 for(const id of Object.keys(CAGES)){
  const s=cageSpot(id),tx=Math.floor(s.x/FIELD_TILE),tz=Math.floor(s.z/FIELD_TILE),circles=cardKeepOut(tx,tz);
  assert.ok(circles.some(c=>c.x===s.x&&c.z===s.z&&c.r===2&&!c.kinds),`${id}'s cage has its circle`);
  for(const c of fieldCards(tx,tz,circles))assert.ok(Math.hypot(c.x-s.x,c.z-s.z)>=2,`a card ${Math.hypot(c.x-s.x,c.z-s.z).toFixed(2)} m from ${id}'s cage`);
 }
 // Lookalikes: toadstools keep 8 m from every seeded mushroom, bushes from every frog; tufts and flowers do not move.
 withTables({},{west:[card('toadstools',60,'cover',{kit:'wilds'}),card('tuft',60)],north:[card('bush',60),card('toadstools',40,'cover',{kit:'wilds'}),card('flowers',40)]},()=>{
  let twins=0,kept=0;
  for(const [tx,tz] of [[-3,-1],[-2,0],[-2,-1],[0,-3],[-1,-2],[0,-2]]){
   const circles=cardKeepOut(tx,tz),cards=fieldCards(tx,tz,circles),free=fieldCards(tx,tz,[]),seeded=[];
   for(let i=tx*2-1;i<=tx*2+2;i++)for(let k=tz*2-1;k<=tz*2+2;k++)seeded.push(...wildCell(i,k));
   for(const c of cards)for(const e of seeded){const d=Math.hypot(e.x-c.x,e.z-c.z);if((e.type==='mushroom'&&c.kind==='toadstools')||(e.type==='frog'&&c.kind==='bush'))assert.ok(d>=8,`${c.kind} ${d.toFixed(1)} m from a ${e.type}`);}
   twins+=circles.filter(c=>c.kinds).length;kept+=cards.length;
   assert.ok(circles.every(c=>!c.kinds||c.r===8));assert.deepEqual(cards.filter(c=>c.kind==='tuft'||c.kind==='flowers'),free.filter(c=>c.kind==='tuft'||c.kind==='flowers'),'kinds that look like nothing stay where they are');
   assert.ok(cards.length<=free.length);
  }
  assert.ok(twins>=6&&kept>200,`${twins} twins round these tiles, ${kept} cards kept`);
 });
});
const hex=(x,z)=>'#'+groundColor(x,z,new T.Color()).getHexString(),near=(a,b,by)=>{const p=new T.Color(a),q=new T.Color(b);return Math.abs(p.r-q.r)<by&&Math.abs(p.g-q.g)<by&&Math.abs(p.b-q.b)<by;};
test('the ground takes each region’s recipe: home colours with their trails, the lands’ own, the rim’s beyond the edge, and no seam at a border',()=>{
 const c=new T.Color(),d=new T.Color(),gap=(x0,z0,x1,z1)=>{groundColor(x0,z0,c);groundColor(x1,z1,d);return Math.max(Math.abs(c.r-d.r),Math.abs(c.g-d.g),Math.abs(c.b-d.b));};
 // Home regions: the region's colour within the 0.09 lightness noise, 20 m off any trail and border.
 for(const [id,x,z] of [['west',115*Math.sin(205*Math.PI/180),-115*Math.cos(205*Math.PI/180)],['north',115*Math.sin(295*Math.PI/180),-115*Math.cos(295*Math.PI/180)],['south',115*Math.sin(110*Math.PI/180),-115*Math.cos(110*Math.PI/180)],['east',115*Math.sin(70*Math.PI/180),-115*Math.cos(70*Math.PI/180)]]){assert.equal(regionAt(x,z),id);assert.ok(near(hex(x,z),GROUND[id].base,.09),`${id}: ${hex(x,z)} against ${GROUND[id].base}`);}
 // The trails: sand along each axis out of the village (redder in the canyon), from the ward line to the far side of the home region.
 const at=(id,along,t=0)=>{const p=trailPoint(id,along),b=({east:45,south:135,west:225,north:315})[id]*Math.PI/180;return [p.x+Math.cos(b)*t,p.z+Math.sin(b)*t];};
 let sandy=0;for(let t=-6;t<=6;t+=.25)if(near(hex(...at('west',110,t)),'#e8cf92',.04))sandy++;assert.ok(sandy>=8&&sandy<=12,`a trail about 2.4 m wide at full colour (${sandy} of 49 samples)`);
 assert.ok(near(hex(...at('east',110)),'#e8a868',.012)&&near(hex(...at('west',110)),'#e8cf92',.012)&&near(hex(...at('south',100)),'#e8cf92',.012),'full colour on the centreline');
 assert.equal(near(hex(Math.sin(225*Math.PI/180)*175,-Math.cos(225*Math.PI/180)*175),'#e8cf92',.1),false,'the trail stops at the planet’s border');
 // Lands: between their low, high and patch colours; lava may be scorched or burning (its heat); none is the home green.
 for(const id of Object.keys(GROUND).filter(id=>REGION[id].kind==='land')){
  const a=shapeOf(id),s=[a.cx,a.cz],g=GROUND[id];
  for(let i=0;i<40;i++){const x=s[0]+Math.sin(i*2.4)*40,z=s[1]+Math.cos(i*1.7)*40;assert.equal(regionAt(x,z),id);if(!landClear(x,z,8))continue;groundColor(x,z,c);
   if(g.checker){assert.ok(c.r>.9&&c.g>.9&&c.b>.9,'the toy mat’s squares come from a texture; its vertices stay near white');continue;}
   const tones=[g.low,g.high,g.patch,g.scorch,...(id==='lava'?[HEAT.hot,HEAT.bed]:[])].filter(Boolean).map(h=>new T.Color(h));
   for(const k of ['r','g','b']){const lo=Math.min(...tones.map(t=>t[k]))-.07,hi=Math.max(...tones.map(t=>t[k]))+.07;assert.ok(c[k]>=lo&&c[k]<=hi,`${id} ${k} ${c[k].toFixed(3)} in ${lo.toFixed(3)}…${hi.toFixed(3)}`);}}
 }
 // No seam: one centimetre either side of a shared border, an outer edge, the ward line and a seam, the colours agree.
 const P=(rho,b)=>[rho*Math.sin(b*Math.PI/180),-rho*Math.cos(b*Math.PI/180)];
 for(const [x0,z0,x1,z1,what] of [[...P(159.99,200),...P(160.01,200),'forest | jungle'],[...P(295.99,20),...P(296.01,20),'the edge'],[-56.51,20,-56.49,20,'the ward line'],[...P(230,179.99),...P(230,180.01),'candy | jungle'],[...P(100,-.01+360),...P(100,.01),'north | east']])assert.ok(gap(x0,z0,x1,z1)<.03,`${what}: ${gap(x0,z0,x1,z1).toFixed(3)}`);
 // The rim: the land's own colour (darkened where pieces stand), never the home green.
 for(const [x,z,land] of [[0,-400,'cloud'],[400,0,'toy'],[0,400,'jungle'],[-400,0,'ocean']]){assert.equal(regionAt(x,z),null);const rimTone=new T.Color(GROUND[land].rim);if(RIM_KINDS[land].length)rimTone.offsetHSL(0,0,-.15);assert.ok(near(hex(x,z),'#'+rimTone.getHexString(),.04),`${land} rim ${hex(x,z)}`);}
 assert.equal(UNDER_GROUND,'#3f8f4a');
 // The village's lawn keeps the family pond's sandy halo.
 assert.ok(near(hex(HOMESTEAD.x,HOMESTEAD.z),'#93e06a',.25));
});
test('a kind whose kit has not arrived has a stand-in shape with baked colour and glow',()=>{
 for(const kind of ['tree_round','tree_pine','rock','crystals','lava_rock','pebbles','embers','tuft','toyblock','no_such_kind']){
  const shape=fallbackShape(kind),g=shape.geometry;assert.ok(g.getAttribute('position').count>0&&g.getAttribute('color')&&g.getAttribute('glow')&&g.getAttribute('normal'),kind);assert.ok(shape.height>0);assert.equal(fallbackShape(kind),shape,'made once');
 }
 const lit=kind=>Math.max(...fallbackShape(kind).geometry.getAttribute('glow').array);
 assert.ok(lit('crystals')>0&&lit('embers')>0&&lit('tree_round')===0&&lit('rock')===0);assert.ok(fallbackShape('tree_round').height>=1&&fallbackShape('tuft').height<1,'trees cast a shadow, tufts do not');
});
test('home arrow follows screen-space direction, including diagonals and rotated camera',()=>{
 for(const [x,z,angle] of [[0,10,0],[10,0,-90],[0,-10,180],[-10,0,90]]){const b=homeBearing({x,z},{x:0,z:0},0);assert.ok(Math.abs(Math.abs(b.angle)-Math.abs(angle))<.001);assert.equal(b.distance,10);}
 assert.equal(homeBearing(HOMESTEAD).distance,0);
 for(const x of [-200,200])for(const z of [-200,200]){const b=homeBearing({x,z});assert.ok(Number.isFinite(b.angle));assert.ok(b.distance>250);}
});
test('long-distance routes avoid buildings without a world-sized grid',()=>{
 const boxes=[{x:0,z:0,w:10,d:10},{x:12,z:2,w:6,d:8}],bounds={x:OUTDOOR_LIMIT,z:OUTDOOR_LIMIT};
 for(const start of [{x:-20000,z:0},{x:20000,z:0},{x:0,z:-20000},{x:0,z:20000}]){
  const end={x:-8,z:2},path=findRoute(start,end,boxes,bounds);assert.ok(path.length>0&&path.length<12);assert.deepEqual(path.at(-1),end);
  let previous=start;for(const p of path){for(let i=0;i<=1000;i++){const x=previous.x+(p.x-previous.x)*i/1000,z=previous.z+(p.z-previous.z)*i/1000;assert.equal(boxes.some(c=>Math.abs(x-c.x)<c.w/2+.32&&Math.abs(z-c.z)<c.d/2+.32),false);}previous=p;}
 }
 assert.deepEqual(findRoute({x:0,z:10},{x:0,z:0},boxes,bounds),[]);
 assert.deepEqual(findRoute({x:0,z:10},{x:Infinity,z:0},boxes,bounds),[]);
});
const round=(extra={})=>new FishingSimulation({quality:.3,bait:false,random:()=>.4,choose:()=>({id:'carp',power:.65}),approachFrom:()=>.55,cast:{x:0,z:0},water:{x:0,z:0,r:7},player:{x:0,z:8},...extra});
function advance(s,until,holding=()=>false){for(let i=0;i<3000&&!until(s);i++)s.update(.025,holding(s));assert.ok(until(s));}
test('reference fishing requires a real bite and controlled reeling to land a fish',()=>{
 const s=round();assert.equal(s.phase,'cast');advance(s,s=>s.phase==='nibble');s.press();assert.equal(s.phase,'wait');assert.equal(s.earlyPresses,1);s.release();advance(s,s=>s.phase==='bite');s.update(.025,true);assert.equal(s.phase,'hooked');advance(s,s=>s.finished,s=>s.tension<.6&&s.surge<=0);assert.equal(s.phase,'caught');assert.equal(s.progress,1);
});
test('a strained line is announced, then holds or snaps by the rod\'s chance (the reference\'s line strain)',()=>{
 // The family rod and its first two upgrades snap 60 % of the time, the best pond rod (quality 0.75) 30 %.
 assert.deepEqual([0,1,2,3].map(tier=>lineBreakChance({quality:.3+tier*.15})),[LINE_BREAK.bamboo,LINE_BREAK.bamboo,LINE_BREAK.bamboo,LINE_BREAK.golden]);assert.equal(round().breakChance,.6);
 // Holding Reel through every surge: the warning comes first (from STRAIN.warn), then the roll at full tension.
 const held=round({breakChance:0});advance(held,s=>s.phase==='bite');held.update(.025,true);assert.equal(held.strained,false);advance(held,s=>s.strained,()=>true);assert.ok(held.tension>=STRAIN.warn&&held.tension<1&&held.strains===0);
 let before=0;advance(held,s=>{if(s.strains===0)before=s.progress;return s.strains===1;},()=>true);
 assert.equal(held.phase,'hooked');assert.equal(held.strainsHeld,1);assert.equal(held.tension,STRAIN.relief);assert.ok(held.progress<before&&held.progress>before-STRAIN.slip-.02,'the fish took a little line');assert.equal(held.strained,false);
 // Letting go when warned lands the fish without another roll.
 advance(held,s=>s.finished,s=>s.tension<.6&&s.surge<=0);assert.equal(held.phase,'caught');assert.equal(held.strains,1);
 const snap=round({breakChance:1});advance(snap,s=>s.phase==='bite');snap.update(.025,true);advance(snap,s=>s.finished,()=>true);assert.equal(snap.phase,'escaped');assert.ok(snap.snapped);assert.equal(snap.strains,1);assert.equal(snap.strainsHeld,0);assert.match(snap.reason,/snapped/);
});
test('a slack line loses the fish and missed bites recover into waiting',()=>{
 const s=round();advance(s,s=>s.phase==='bite');advance(s,s=>s.missedBites===1);assert.equal(s.phase,'wait');advance(s,s=>s.phase==='bite');s.press();s.release();advance(s,s=>s.finished);assert.equal(s.phase,'escaped');assert.match(s.reason,/slack/);
});

// Round 8 fix (reviewer: "Ember Fields does not read as hot at a glance"): glowing seams, ember beds and burning pool rims are painted over
// the reference's lava colours, and the land's tiles are drawn with hotToon, which lights only colours far redder than blue.
test('the Ember Fields read hot: about a third of the ground glows, the reference colours stay unlit, and lava tiles take the hot material',()=>{
 const s={x0:-296,x1:0,z0:-296,z1:-100},c=new T.Color(),glows=k=>k.r-k.b>.3;let n=0,hot=0;
 for(let x=s.x0+2;x<s.x1;x+=1.7)for(let z=s.z0+2;z<s.z1;z+=1.7){if(regionAt(x,z)!=='lava')continue;n++;if(glows(groundColor(x,z,c)))hot++;}
 assert.ok(hot/n>.15&&hot/n<.5,`${(100*hot/n).toFixed(1)}% of the Ember Fields glows`);
 for(const h of [GROUND.lava.low,GROUND.lava.high,GROUND.lava.patch,GROUND.lava.scorch,GROUND.lava.rim])assert.equal(glows(new T.Color(h)),false,`${h} is the reference's own and stays unlit`);
 assert.ok(glows(new T.Color(HEAT.hot))&&glows(new T.Color(HEAT.bed)));
 // Only the lava's tiles take hotToon (candy's pink is redder than blue too, and stays plainly lit).
 const material=hotToon(),shader={vertexShader:'',fragmentShader:'#include <emissivemap_fragment>'};material.onBeforeCompile(shader);assert.match(shader.fragmentShader,/totalEmissiveRadiance \+= diffuseColor\.rgb \* smoothstep\(\.3,\.75,diffuseColor\.r-diffuseColor\.b\)/);
 const host={groundPool:{},groundMade:0,groundMaterial:'home',landMaterial:'land',hotMaterial:'hot',checkerMaterials:new Map()};
 assert.equal(OpenFields.prototype.ground.call(host,0,4,['lava']).material,'hot');assert.equal(OpenFields.prototype.ground.call(host,2,0,['east']).material,'home');assert.equal(OpenFields.prototype.ground.call(host,-4,2,['candy']).material,'land');
});
// Round 8 fix (reviewer: "Field tiles allocate a new PlaneGeometry and colour arrays on every build"): a retired tile's ground is reused.
test('a retired tile’s ground geometry is reused for the next tile of the same grid, recoloured as if new',()=>{
 const host={groundPool:{},groundMade:0,groundMaterial:'home',landMaterial:'land',hotMaterial:'hot',checkerMaterials:new Map()},ground=OpenFields.prototype.ground;
 const a=ground.call(host,3,0,['east']).geometry;assert.equal(host.groundMade,1);
 const fresh=ground.call(host,3,1,['east']).geometry;assert.equal(host.groundMade,2);
 host.groundPool[a.userData.segments]=[a];const again=ground.call(host,3,1,['east']).geometry;
 assert.equal(again,a,'the pooled plane comes back');assert.equal(host.groundMade,2,'and nothing new is made');assert.equal(again.getAttribute('color').version>0,true,'its colours are re-uploaded');
 assert.deepEqual([...again.getAttribute('color').array],[...fresh.getAttribute('color').array],'with the new tile’s colours');assert.deepEqual([...again.getAttribute('position').array],[...fresh.getAttribute('position').array]);
});
