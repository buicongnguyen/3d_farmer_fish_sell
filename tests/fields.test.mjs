import test from 'node:test';
import assert from 'node:assert/strict';
import {fieldPlan,fieldTrees,fieldCards,fieldRim,resetFieldPlan,nearestLand,inVillage,homeBearing,OUTDOOR_LIMIT,HOMESTEAD,GATE_ROAD,FIELD_TILE,TILE_MAX,CLEAR,RIM_TILES} from '../src/field-layout.mjs';
import {inSafeZone} from '../src/ward.mjs';
import {regionAt,cellIdAt,borderDistance,trailDistance,trailOffset,REGION,DENS} from '../src/regions.mjs';
import {DECOR,CARDS,RIM_KINDS,GROUND} from '../src/region-life.mjs';
import {groundColor,fallbackShape,cardKeepOut,UNDER_GROUND} from '../src/fields.mjs';
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
 let world=0,rim=0;
 for(let x=-RIM_TILES;x<RIM_TILES;x++)for(let z=-RIM_TILES;z<RIM_TILES;z++){
  const plan=checkTile(x,z),inside=cellIdAt((x+.5)*FIELD_TILE,(z+.5)*FIELD_TILE)!==null;
  if(inside){world++;assert.ok(plan.regions.length>=1);assert.deepEqual(plan.rim,[]);assert.equal(plan.land,null);}
  else{
   // A rim tile: nothing blocks and nothing covers; 20 pieces of one of its land's rim kinds (none where the land has no rim kinds: open sea, cloud).
   rim++;assert.deepEqual(plan.regions,[]);assert.deepEqual(plan.trees,[]);assert.deepEqual(plan.cards,[]);assert.equal(REGION[plan.land].kind,'land','every rim tile belongs to a land');
   assert.equal(plan.land,nearestLand((x+.5)*FIELD_TILE,(z+.5)*FIELD_TILE));assert.equal(plan.rim.length,RIM_KINDS[plan.land].length?TILE_MAX.rim:0);
   assert.equal(new Set(plan.rim.map(p=>p.kind)).size,plan.rim.length?1:0,'one kind a rim tile: one draw');
   for(const p of plan.rim){assert.ok(inTile(p,x,z)&&regionAt(p.x,p.z)===null&&borderDistance(p.x,p.z)>=CLEAR.border&&p.scale>=1.6&&p.scale<=2.2);assert.ok(RIM_KINDS[plan.land].some(k=>k.kind===p.kind));}
   assert.deepEqual(fieldRim(x,z),{land:plan.land,pieces:plan.rim});
  }
 }
 assert.equal(world,52);assert.equal(rim,144);
 // Beyond the rim (±448 m) nothing is ever planned.
 for(const [x,z] of [[8,0],[-8,3],[7,7],[50,-80],[-500,500]])assert.deepEqual(fieldPlan(x,z),{trees:[],grass:[],cards:[],regions:[],rim:[],land:null});
 // The named tiles of the spec: two centre tiles, the canyon, candy, a rim tile.
 assert.deepEqual(fieldPlan(2,0).regions,['east']);assert.deepEqual(fieldPlan(-3,1).regions,['candy']);assert.equal(fieldPlan(3,3).land,'cloud');assert.deepEqual([...fieldPlan(0,0).regions].sort(),['east','south','village']);assert.deepEqual([...fieldPlan(-1,-1).regions].sort(),['north','village','west']);
 assert.notDeepEqual(fieldPlan(2,0).trees,fieldPlan(2,-1).trees);assert.notDeepEqual(fieldPlan(2,0).cards.map(c=>c.x-128),fieldPlan(1,0).cards.map(c=>c.x-64),'tiles do not repeat');
 // Rim ties go to the lower planet number: the empty cell between the Toybox Land and the Wild Jungle is toy's.
 assert.equal(nearestLand(-224,-96),'toy');assert.equal(nearestLand(0,-400),'ice');
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
  for(const [x,z] of [[-3,-1],[-3,0],[-2,-1],[-2,0]]){
   const plan=checkTile(x,z),count=kind=>plan.trees.filter(t=>t.kind===kind).length,cards=kind=>plan.cards.filter(c=>c.kind===kind).length;
   assert.deepEqual([count('tree_round'),count('tree_pine'),count('rock'),plan.trees.length],[18,18,4,40],`forest tile ${x},${z}`);
   assert.deepEqual([cards('tuft'),cards('toadstools'),cards('flowers'),cards('bush'),cards('log'),cards('pebbles'),plan.cards.length],[70,32,24,26,8,42,202]);
   const rock=plan.trees.find(t=>t.kind==='rock'),tree=plan.trees.find(t=>t.kind==='tree_pine');assert.equal(rock.perch,false);assert.equal(tree.perch,true);assert.ok(Math.abs(rock.r-.7*rock.scale)<1e-12&&rock.scale>=.9&&rock.scale<=1.3&&Math.abs(tree.h-3*tree.scale)<1e-12);
   assert.equal(plan.cards.find(c=>c.kind==='pebbles').cls,'dressing');assert.equal(plan.cards.find(c=>c.kind==='pebbles').glow,1);assert.equal(plan.cards.find(c=>c.kind==='toadstools').key,'wilds/toadstools');assert.equal(tree.key,'scenery/tree_pine');
  }
  // The centre tile (0, 0) holds the ward and the strips of the meadow and the canyon: only their kinds, fewer than a whole tile's.
  const centre=checkTile(0,0),kinds=new Set(centre.trees.map(t=>t.kind));
  assert.ok([...kinds].every(k=>['tree_blossom','rock','rock_red'].includes(k)),[...kinds].join());assert.ok(centre.trees.length>=1&&centre.trees.length<9,`${centre.trees.length} pieces on the strips`);
  for(const t of centre.trees)assert.equal(t.kind==='rock_red',regionAt(t.x,t.z)==='east','each strip grows its own region’s kinds');
  for(const c of centre.cards)assert.equal(c.kind,regionAt(c.x,c.z)==='east'?'dry_bush':'flowers');
  assert.ok(centre.cards.length>10&&centre.cards.length<50);
  // The canyon tile with the Mountain Turtle's clearing holds fewer rocks than the table's 14, and none in the clearing.
  const turtle=TITANS.find(d=>d.region==='east'),tx=Math.floor(turtle.x/FIELD_TILE),tz=Math.floor(turtle.z/FIELD_TILE),near=checkTile(tx,tz);
  assert.ok(near.trees.length<14&&near.trees.length>=2,`${near.trees.length} rocks beside the turtle`);assert.equal(near.cards.length,45,'cards may grow in a titan’s clearing');
  assert.equal(checkTile(2,-1).trees.length,14);
 });
 // With the real tables back, the same tiles are planned from them again.
 assert.ok(fieldPlan(-3,-1).trees.every(t=>DECOR.west.some(r=>r.kind===t.kind)));
});
test('a tinted row is drawn from its own baked copy, `where` goes to landClear, and cards keep out of the caller’s circles without moving the others',()=>{
 withTables({shadow:[row('rock',3,.7,{tint:'shadow'})]},{shadow:[card('tuft',40,'cover',{tint:'shadow'}),card('glow_shrooms',48,'dressing',{kit:'dressing',glow:1})]},()=>{
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
 for(const [id,x,z] of [['west',-128,20],['north',20,-128],['south',20,128],['east',128,-20]]){assert.equal(regionAt(x,z),id);assert.ok(near(hex(x,z),GROUND[id].base,.09),`${id}: ${hex(x,z)} against ${GROUND[id].base}`);}
 // The trails: sand along each axis out of the village (redder in the canyon), from the ward line to the far side of the home region.
 let sandy=0;for(let z=-6;z<=6;z+=.25)if(near(hex(-128,z),'#e8cf92',.04))sandy++;assert.ok(sandy>=8&&sandy<=12,`a trail about 2.4 m wide at full colour (${sandy} of 49 samples)`);
 assert.ok(near(hex(128,trailOffset('east',128)),'#e8a868',.012)&&near(hex(-128,trailOffset('west',128)),'#e8cf92',.012)&&near(hex(trailOffset('south',100),100),'#e8cf92',.012),'full colour on the centreline');
 assert.equal(near(hex(-230,0),'#e8cf92',.1),false,'the trail stops at the land’s border');
 // Lands: between their low, high and patch colours; lava may be scorched; none is the home green.
 for(const id of Object.keys(GROUND).filter(id=>REGION[id].kind==='land')){
  const s={toy:[-128,-128],candy:[-128,128],jungle:[-256,0],ice:[0,-256],ocean:[128,-128],lava:[0,256],cloud:[128,128],shadow:[256,0]}[id],g=GROUND[id];
  for(let i=0;i<40;i++){const x=s[0]+Math.sin(i*2.4)*40,z=s[1]+Math.cos(i*1.7)*40;assert.equal(regionAt(x,z),id);groundColor(x,z,c);
   if(g.checker){assert.ok(c.r>.9&&c.g>.9&&c.b>.9,'the toy mat’s squares come from a texture; its vertices stay near white');continue;}
   const tones=[g.low,g.high,g.patch,g.scorch].filter(Boolean).map(h=>new T.Color(h));
   for(const k of ['r','g','b']){const lo=Math.min(...tones.map(t=>t[k]))-.07,hi=Math.max(...tones.map(t=>t[k]))+.07;assert.ok(c[k]>=lo&&c[k]<=hi,`${id} ${k} ${c[k].toFixed(3)} in ${lo.toFixed(3)}…${hi.toFixed(3)}`);}}
 }
 // No seam: one centimetre either side of a shared border, an outer edge, the ward line and a seam, the colours agree.
 for(const [x0,z0,x1,z1,what] of [[-192.01,30,-191.99,30,'west | jungle'],[40,191.99,40,192.01,'south | lava'],[319.99,10,320.01,10,'the east edge'],[-56.51,20,-56.49,20,'the ward line'],[30,-319.99,30,-320.01,'the north edge']])assert.ok(gap(x0,z0,x1,z1)<.03,`${what}: ${gap(x0,z0,x1,z1).toFixed(3)}`);
 // The rim: the land's own colour (darkened where pieces stand), never the home green.
 for(const [x,z,land] of [[0,-400,'ice'],[400,0,'shadow'],[0,400,'lava'],[-400,0,'jungle']]){assert.equal(regionAt(x,z),null);const rimTone=new T.Color(GROUND[land].rim);if(RIM_KINDS[land].length)rimTone.offsetHSL(0,0,-.15);assert.ok(near(hex(x,z),'#'+rimTone.getHexString(),.04),`${land} rim ${hex(x,z)}`);}
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
