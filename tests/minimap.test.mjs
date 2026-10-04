// The maps (src/minimap.mjs, src/world-map.mjs): the projection, the reach, the rim, the caption, what a minimap frame draws,
// the dens and which of them ride the rim, the terrain cache, and the Map window's sheet with its camera (round 8, builder F).
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {projection,mapRadius,beyondVillage,northSpot,northAngle,rimPoint,arrowTurn,mapCaption,drawMinimap,drawWorldMap,denStatuses,rimDens,denLine,denState,denRows,denName,cageLine,pickMarker,pickLine,compass,clock,Minimap,Terrain,terrainCache,terrainFill,sheetLimits,sheetProjection,RANGE,CREATURE_RANGE,COLORS,TERRAIN,SHEET,ON_MAP,RIM_MAX,REGION_SHORT} from '../src/minimap.mjs';
import {clampCam,presetCam,openingPreset,zoomAt,panBy,presetOf,mapHtml,denListHtml,STEP} from '../src/world-map.mjs';
import {HOUSES,HOMES,ROADS,POND,CIVIC} from '../src/content.mjs';
import {CAMERA_YAW,VILLAGE} from '../src/field-layout.mjs';
import {ROOM,ROOMS,PANDORA_SPOT,SPAWN} from '../src/home-plan.mjs';
import {SAFE,DEN,Wilds,AI} from '../src/wilds.mjs';
import {WARD_OUTLINE} from '../src/ward.mjs';
import {REGION,REGION_IDS,DENS,BORDER_RUNS,RIM_REACH,squareOf,regionAt} from '../src/regions.mjs';
import {nextEvent,lavaEvent,forceLavaEvent} from '../src/lava-weather.mjs';

const near=(a,b,eps=1e-6)=>Math.abs(a-b)<eps;
/** A 2D context that records what is drawn (arcs, rectangles and text with the transform they were drawn under; strokes with their path). */
function fakeContext(){
 const calls=[],state={m:[1,0,0,1,0,0],fill:'',stroke:'',width:1,font:'',alpha:1,dash:[],stack:[]};let path=[];
 const mul=(a,b)=>[a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];
 const at=(x,y)=>({x:state.m[0]*x+state.m[2]*y+state.m[4],y:state.m[1]*x+state.m[3]*y+state.m[5]}),size=()=>parseFloat(/([\d.]+)px/.exec(state.font)?.[1]??'10');
 const ctx={calls,
  save(){state.stack.push({m:[...state.m],fill:state.fill,stroke:state.stroke,width:state.width,font:state.font,alpha:state.alpha});},restore(){const s=state.stack.pop();if(s)Object.assign(state,s);},
  setTransform(a,b,c,d,e,f){state.m=[a,b,c,d,e,f];},transform(a,b,c,d,e,f){state.m=mul(state.m,[a,b,c,d,e,f]);},translate(x,y){state.m=mul(state.m,[1,0,0,1,x,y]);},rotate(r){const c=Math.cos(r),s=Math.sin(r);state.m=mul(state.m,[c,s,-s,c,0,0]);},scale(x,y){state.m=mul(state.m,[x,0,0,y,0,0]);},
  clearRect(x,y,w,h){calls.push({op:'clear',w,h});},fillRect(x,y,w,h){calls.push({op:'rect',fill:state.fill,a:at(x,y),b:at(x+w,y+h),c:at(x+w/2,y+h/2)});},strokeRect(x,y,w,h){calls.push({op:'strokeRect',c:at(x+w/2,y+h/2)});},
  beginPath(){path=[];},closePath(){path.push('close');},moveTo(x,y){path.push({move:true,...at(x,y)});},lineTo(x,y){path.push(at(x,y));},clip(){calls.push({op:'clip'});},
  fill(){calls.push({op:'fill',fill:state.fill,at:at(0,0),path});},stroke(){calls.push({op:'stroke',stroke:state.stroke,width:state.width*Math.hypot(state.m[0],state.m[1]),dash:state.dash,path});},setLineDash(d){state.dash=d;calls.push({op:'dash',d});},
  arc(x,y,r){path.push({arc:true,...at(x,y)});calls.push({op:'arc',fill:state.fill,p:at(x,y),r:r*Math.hypot(state.m[0],state.m[1]),alpha:state.alpha});},ellipse(x,y,rx){calls.push({op:'arc',fill:state.fill,p:at(x,y),r:rx});},
  fillText(t,x,y){calls.push({op:'text',t,p:at(x,y),size:size(),fill:state.fill,alpha:state.alpha});},strokeText(){},measureText(t){return {width:String(t).length*size()*.6};},drawImage(image,x,y){calls.push({op:'image',image,a:at(x,y)});},
  set fillStyle(v){state.fill=v;},get fillStyle(){return state.fill;},set strokeStyle(v){state.stroke=v;},get strokeStyle(){return state.stroke;},set lineWidth(v){state.width=v;},get lineWidth(){return state.width;},
  set font(v){state.font=v;},get font(){return state.font;},set globalAlpha(v){state.alpha=v;},get globalAlpha(){return state.alpha;},lineJoin:'',lineCap:'',textAlign:'',textBaseline:'',
 };return ctx;
}
const village=(extra={})=>({place:'village',x:0,z:-8.8,facing:0,heading:CAMERA_YAW,pandora:false,beds:6,npcs:[],creatures:[],shops:[],residents:[],spots:[],...extra});
/** The dens as the maps get them, all up (the dragon's nest set as given). */
const dens=(change={})=>denStatuses(undefined,[],0).map(d=>({...d,...(d.event?{down:false,left:0}:{}),...(change[d.type]??{})}));
const crowns=ctx=>ctx.calls.filter(c=>c.op==='text'&&c.t==='♛');
const discs=(ctx,...fills)=>ctx.calls.filter(c=>c.op==='arc'&&fills.includes(c.fill)&&c.r>6);
const bearing=(p,half=150)=>Math.atan2(p.x-half,-(p.y-half));

test('the projection: you at the centre, the top of the screen at the top of the map, metres to pixels and back',()=>{
 const P=projection({x:10,z:-4,heading:0,radius:50,size:300});
 assert.deepEqual(P.point(10,-4),{x:150,y:150});assert.equal(P.k,3);
 // North up: east is right, north is up, the rim is `radius` metres away.
 assert.deepEqual(P.point(60,-4),{x:300,y:150});assert.deepEqual(P.point(10,-54),{x:150,y:0});assert.deepEqual(P.point(10,46),{x:150,y:300});
 // A projection can still be turned (a camera's yaw makes the camera's right the map's right); the maps themselves no longer are.
 const yaw=CAMERA_YAW,Q=projection({x:3,z:7,heading:yaw,radius:46,size:300}),step=20;
 const up=Q.point(3-Math.sin(yaw)*step,7-Math.cos(yaw)*step),right=Q.point(3+Math.cos(yaw)*step,7-Math.sin(yaw)*step);
 assert.ok(near(up.x,150)&&near(up.y,150-step*Q.k));assert.ok(near(right.x,150+step*Q.k)&&near(right.y,150));
 // Distances are kept (a rotation and a scale), the matrix is the same mapping, and world() undoes point().
 for(const [x,z] of [[0,0],[-52,40],[236,-204],[3.5,7.25]]){
  const p=Q.point(x,z);assert.ok(near(Math.hypot(p.x-150,p.y-150),Math.hypot(x-3,z-7)*Q.k,1e-6));
  const [a,b,c,d,e,f]=Q.matrix;assert.ok(near(a*x+c*z+e,p.x,1e-6)&&near(b*x+d*z+f,p.y,1e-6));
  const w=Q.world(p.x,p.y);assert.ok(near(w.x,x,1e-6)&&near(w.z,z,1e-6));
 }
 // point() can write into an object you give it (the draw loop makes no garbage).
 const out={x:0,y:0};assert.equal(Q.point(1,2,out),out);
 // sees(): does a rectangle of the world touch the disc? The village from its middle, and not from the far fields.
 assert.equal(P.sees(VILLAGE),true);assert.equal(projection({x:250,z:0,radius:120}).sees(VILLAGE),false);assert.equal(projection({x:170,z:0,radius:120}).sees(VILLAGE),true);
 // North on the rim for a turn, and the arrow: it points where you walk. On the north-up maps the turn is 0 and N is at the top.
 assert.deepEqual(northSpot(0),{left:50,top:0});assert.equal(northAngle(yaw),yaw);
 assert.ok(near(Math.cos(arrowTurn(Math.PI)),1),'facing north (-z): the arrow points up');assert.ok(near(Math.cos(arrowTurn(0)),-1),'facing south: down');assert.ok(near(Math.sin(arrowTurn(Math.PI/2)),1),'facing east (+x): a quarter turn clockwise');
});
test('the reach: the village close up, opening with the distance in the fields, the whole house indoors',()=>{
 assert.equal(mapRadius('village',0,0),RANGE.village);assert.equal(mapRadius('village',55,-45),RANGE.village,'anywhere inside the village footprint');
 assert.equal(beyondVillage(VILLAGE.x1,VILLAGE.z1),0);assert.equal(beyondVillage(VILLAGE.x1+10,0),10);assert.equal(beyondVillage(VILLAGE.x0-10,0),10);assert.equal(beyondVillage(0,VILLAGE.z0-7),7);assert.ok(near(beyondVillage(VILLAGE.x1+3,VILLAGE.z1+4),5));
 // Out in the fields the map opens up, so the village edge stays on it; it never opens past RANGE.fields (about one square each way).
 let last=RANGE.village;for(let d=0;d<=260;d+=10){const r=mapRadius('village',VILLAGE.x1+d,0);assert.ok(r>=last&&r<=RANGE.fields);last=r;if(r<RANGE.fields)assert.ok(r>=d*.85,'the village edge is still within reach');}
 assert.equal(mapRadius('village',310,0),RANGE.fields);assert.equal(RANGE.country,undefined,'the country market is no longer a place');
 // Indoors the map is the house: every corner is inside the circle, with a little room to spare.
 const R=mapRadius('interior'),P=projection({x:0,z:0,heading:0,radius:R,size:300});
 for(const [x,z] of [[-1,-1],[1,-1],[-1,1],[1,1]]){const p=P.point(x*ROOM.w/2,z*ROOM.d/2);assert.ok(Math.hypot(p.x-150,p.y-150)<150-4);}
 assert.ok(R<Math.hypot(ROOM.w,ROOM.d)/2+2,'and the house fills the circle');
});
test('the rim: home rides it when it is off the map, pointing the way back',()=>{
 const home=HOUSES[0],P=projection({x:300,z:-60,heading:0,radius:RANGE.fields,size:300});
 const r=rimPoint(P,home.x,home.z,20);assert.equal(r.off,true);assert.ok(near(Math.hypot(r.x-150,r.y-150),130));
 // The pointer's angle is the direction of home on the map (0 = up, clockwise): from the Night Land, home is to the west.
 const raw=P.point(home.x,home.z);assert.ok(near(r.angle,Math.atan2(raw.x-150,-(raw.y-150))));assert.ok(near((r.x-150)/130,Math.sin(r.angle))&&near((r.y-150)/130,-Math.cos(r.angle)));assert.ok(r.x<40);
 // On the map it is left where it is.
 const here=rimPoint(projection({x:0,z:0,heading:0,radius:46,size:300}),home.x,home.z,20);assert.equal(here.off,false);assert.deepEqual({x:here.x,y:here.y},projection({x:0,z:0,heading:0,radius:46,size:300}).point(home.x,home.z));
});
test('the caption says where you are: Willowmere inside the ward, the home region one step outside it',()=>{
 assert.equal(mapCaption(village()),'WILLOWMERE');assert.equal(mapCaption(village({x:120,z:0})),'REDROCK CANYON');
 assert.equal(mapCaption(village({x:SAFE.x1+30,z:0,pandora:true})),'REDROCK CANYON');assert.equal(mapCaption(village({x:SAFE.x1+120,z:0,pandora:true})),'REDROCK CANYON');assert.equal(mapCaption(village({x:SAFE.x1+30,z:0})),'REDROCK CANYON');assert.equal(mapCaption(village({x:SAFE.x1-.5,z:0,pandora:true})),'WILLOWMERE');assert.equal(mapCaption(village({x:VILLAGE.x1-1,z:0,pandora:true})),'WILLOWMERE');assert.equal(mapCaption(village({x:0,z:SAFE.z1+20,pandora:true})),'BLUE LAKE MEADOW');assert.equal(mapCaption(village({x:0,z:60})),'BLUE LAKE MEADOW');assert.equal(mapCaption(village({x:227,z:-185})),'BEYOND THE MAP');
 // One metre outside the middle of each side of the ward, box open or shut.
 for(const box of [true,false]){assert.equal(mapCaption(village({x:SAFE.x0-1,z:0,pandora:box})),'MUSHROOM FOREST');assert.equal(mapCaption(village({x:SAFE.x1+1,z:0,pandora:box})),'REDROCK CANYON');assert.equal(mapCaption(village({x:0,z:SAFE.z0-1,pandora:box})),'CHOMPER SWAMP');assert.equal(mapCaption(village({x:0,z:SAFE.z1+1,pandora:box})),'BLUE LAKE MEADOW');assert.equal(mapCaption(village({x:SAFE.x0+1,z:0,pandora:box})),'WILLOWMERE');}
 assert.equal(mapCaption(village({x:0,z:-256})),'FROST LAND');assert.equal(mapCaption(village({x:256,z:0})),'NIGHT LAND');
 assert.equal(mapCaption({place:'interior',house:HOUSES[0]}),'YOUR HOMESTEAD');assert.equal(mapCaption({place:'interior',house:HOUSES[1]}),HOUSES[1].name.toUpperCase());
});
test('a frame is a clean circle, north up: clipped, the regions, trails, village and borders drawn in metres, markers on top, you in the middle',()=>{
 const ctx=fakeContext(),view=village({shops:[{id:'market',x:5.5,z:23.2}],npcs:[{x:4,z:2,hidden:false},{x:9,z:9,hidden:true}]});
 const P=drawMinimap(ctx,view,300);
 assert.equal(P.radius,RANGE.village);assert.equal(P.heading,0,'north up, whatever the camera’s yaw');assert.equal(ctx.calls[0].op,'clear');
 // The mask is one circle that fills the canvas: the first arc, drawn at the centre, then a clip.
 const first=ctx.calls.find(c=>c.op==='arc');assert.ok(near(first.p.x,150)&&near(first.p.y,150)&&first.r>=149&&first.r<=150);assert.ok(ctx.calls.findIndex(c=>c.op==='clip')===ctx.calls.indexOf(first)+1);
 // With no canvas to build the cache in, the regions are flat shapes: twelve squares in their ground colours, the four strips, the ward.
 for(const id of REGION_IDS){if(id==='village')continue;const s=squareOf(id),r=ctx.calls.find(c=>c.op==='rect'&&c.fill===REGION[id].ground&&near(c.c.x,P.point(s.cx,s.cz).x,1e-6)&&near(c.c.y,P.point(s.cx,s.cz).y,1e-6));assert.ok(r,id);}
 assert.equal(ctx.calls.filter(c=>c.op==='fill'&&c.path.length===5&&c.path[4]==='close'&&['west','north','south','east'].some(id=>REGION[id].ground===c.fill)).length,4,'the four strips of the centre cell');
 assert.ok(ctx.calls.some(c=>c.op==='rect'&&c.fill===REGION.village.ground&&near(c.a.x,P.point(SAFE.x0,SAFE.z0).x,1e-6)),'the ward');assert.equal(ctx.calls.filter(c=>c.op==='image').length,0);
 // The pond is a blue rectangle whose centre is where the projection puts the pond; the road is drawn; no ward line (the box is shut).
 const pond=ctx.calls.find(c=>c.op==='rect'&&c.fill===COLORS.pond),at=P.point(POND.x,POND.z);assert.ok(near(pond.c.x,at.x,1e-6)&&near(pond.c.y,at.y,1e-6));
 assert.equal(ctx.calls.filter(c=>c.op==='rect'&&c.fill===COLORS.road).length,5);assert.equal(ctx.calls.filter(c=>c.op==='dash').length,0);
 const roadNorth=ctx.calls.find(c=>c.op==='rect'&&c.fill===COLORS.road),mid=P.point(0,ROADS.north);assert.ok(near(roadNorth.c.x,mid.x,1e-6)&&near(roadNorth.c.y,mid.y,1e-6));
 // North is up: the north road is above the south road, the east road right of the west one, though the view carries the camera's yaw.
 assert.ok(P.point(0,ROADS.north).y<P.point(0,ROADS.south).y&&near(P.point(0,ROADS.north).x,P.point(0,ROADS.south).x));assert.ok(P.point(ROADS.east,0).x>P.point(ROADS.west,0).x&&near(P.point(ROADS.east,0).y,P.point(ROADS.west,0).y));
 // The four sand trails and the borders are stroked live: four trail strokes; twelve border strokes (a casing and three bands for the
 // world's edge, the shared lines, and the ward with its seams); every one of the forty runs is in each stroke of its group.
 const strokes=ctx.calls.filter(c=>c.op==='stroke');assert.equal(strokes.filter(s=>s.stroke===COLORS.trail).length,4);
 for(const color of COLORS.band)assert.equal(strokes.filter(s=>s.stroke===color).length,3,color);
 assert.equal(strokes.filter(s=>s.stroke===COLORS.casingOuter&&s.path.length===2*BORDER_RUNS.filter(r=>r.kind==='outer').length).length,1,'a dark casing along the world’s edge');
 const casings=strokes.filter(s=>s.stroke===COLORS.casing&&s.path.length>=16);assert.deepEqual(casings.map(s=>s.path.length/2),[12,8],'12 shared runs; the ward’s 4 with the 4 seams');
 assert.ok(near(casings[1].width*2,casings[0].width,1e-9),'ward and seam runs are half as wide');assert.ok(casings[0].width/2>=3-1e-9&&casings[0].width/2<=9+1e-9,'3 to 9 CSS px (the bitmap is 2 px to a CSS pixel)');
 // Neighbours out of doors are dots; one who is indoors is not drawn. Box shut: no crown, no badge, no creature dot.
 const dots=ctx.calls.filter(c=>c.op==='arc'&&c.fill===COLORS.neighbour);assert.equal(dots.length,1);const n=P.point(4,2);assert.ok(near(dots[0].p.x,n.x,1e-6)&&near(dots[0].p.y,n.y,1e-6));
 const shut=fakeContext();drawMinimap(shut,village({x:128,z:-8,dens:dens(),cages:[{id:'clover',den:'w:den:bear',x:146,z:-24,state:'locked'}],creatures:[{x:120,z:0,hp:40,boss:false,angry:true}]}),300);
 assert.equal(crowns(shut).length,0);assert.ok(!shut.calls.some(c=>[COLORS.boss,COLORS.titan,COLORS.lock,COLORS.key,COLORS.creature,COLORS.angry].includes(c.fill)),'shut: no crown, badge or dot');
 // With the box open: the ward line, creatures in reach as dots, a boss as far as the map reaches, the dead and the far left out.
 const wild=fakeContext(),foes=[{x:100,z:10,hp:40,boss:false,angry:false},{x:110,z:0,hp:40,boss:false,angry:true},{x:100+CREATURE_RANGE+5,z:0,hp:40,boss:false,angry:false},{x:105,z:5,hp:0,boss:false,angry:false},{x:100+CREATURE_RANGE+10,z:0,hp:800,boss:true,angry:false},{x:900,z:0,hp:800,boss:true,angry:false}];
 const W=drawMinimap(wild,village({x:100,z:0,pandora:true,creatures:foes}),300);
 assert.ok(W.radius>RANGE.village&&W.radius<RANGE.fields);
 // The ward is a dashed path with as many points as WARD_OUTLINE, closed.
 const ward=wild.calls.filter(c=>c.op==='stroke'&&c.stroke===COLORS.ward);assert.equal(ward.length,1);assert.equal(ward[0].path.filter(p=>p!=='close').length,WARD_OUTLINE.length);assert.equal(ward[0].path.at(-1),'close');assert.ok(ward[0].dash.length===2);
 WARD_OUTLINE.forEach(([x,z],i)=>{const p=W.point(x,z);assert.ok(near(ward[0].path[i].x,p.x,1e-6)&&near(ward[0].path[i].y,p.y,1e-6));});
 assert.equal(wild.calls.filter(c=>c.op==='dash'&&c.d.length).length,1);
 assert.equal(wild.calls.filter(c=>c.op==='arc'&&c.fill===COLORS.creature).length,1);assert.equal(wild.calls.filter(c=>c.op==='arc'&&c.fill===COLORS.angry).length,1);assert.equal(wild.calls.filter(c=>c.op==='arc'&&c.fill===COLORS.boss).length,1);
 assert.equal(crowns(wild).length,1);
 // Every marker lies inside the circle.
 for(const c of [...ctx.calls,...wild.calls])if(c.op==='arc'&&c.r<20)assert.ok(Math.hypot(c.p.x-150,c.p.y-150)<150);
});
test('indoors the map is the plan of the house; the supermarket and its parking are on the village map',()=>{
 const ctx=fakeContext(),view={place:'interior',x:SPAWN.x,z:SPAWN.z,facing:Math.PI,heading:0,houseId:0,house:HOUSES[0],chest:PANDORA_SPOT,residents:[{x:6,z:-6.7},{x:7,z:6.2}],spots:[{x:-5.35,z:-4.85}],rooms:null,pandora:true,dens:dens()};
 const P=drawMinimap(ctx,view,300);
 assert.equal(P.radius,RANGE.room);assert.equal(P.heading,0,'north up indoors');assert.equal(P.x,0,'centred on the house, not on you');
 // Five rooms in their colours, each where the plan has it; walls; the front door in green at the front wall.
 for(const room of ROOMS){const r=ctx.calls.find(c=>c.op==='rect'&&c.fill===COLORS.room[room.id]),at=P.point((room.rect.x0+room.rect.x1)/2,(room.rect.z0+room.rect.z1)/2);assert.ok(r&&near(r.c.x,at.x,1e-6)&&near(r.c.y,at.y,1e-6),room.id);}
 assert.ok(ctx.calls.filter(c=>c.op==='rect'&&c.fill===COLORS.wall).length>=12);
 const door=ctx.calls.find(c=>c.op==='rect'&&c.fill===COLORS.door),front=P.point(0,ROOM.d/2);assert.ok(near(door.c.x,front.x,1e-6)&&Math.abs(door.c.y-front.y)<4);
 // The family as dots, the things to use as small rings, the chest as a diamond (a path, so no arc). No crown, border or trail indoors.
 assert.equal(ctx.calls.filter(c=>c.op==='arc'&&c.fill===COLORS.neighbour).length,2);assert.equal(ctx.calls.filter(c=>c.op==='arc'&&c.fill==='#ffffff').length,1);
 assert.ok(ctx.calls.some(c=>c.op==='fill'&&c.fill===COLORS.chest));assert.equal(crowns(ctx).length,0);assert.equal(ctx.calls.filter(c=>c.op==='stroke'&&[COLORS.trail,...COLORS.band].includes(c.stroke)).length,0);
 // A neighbour's house has no chest; other palettes are used when given.
 const other=fakeContext();drawMinimap(other,{...view,houseId:3,house:HOUSES[3],chest:null,rooms:{bedroom:'#111111',bath:'#222222',kitchen:'#333333',living:'#444444',nook:'#555555'}},300);
 assert.ok(!other.calls.some(c=>c.fill===COLORS.chest));assert.ok(other.calls.some(c=>c.op==='rect'&&c.fill==='#444444'));
 // The country market is gone (no map of its own, no colours for it); the supermarket that took its trade is drawn in the village:
 // the building in its red, its parking, and a diamond at its door.
 assert.equal(COLORS.country,undefined);assert.equal(COLORS.shop.country,undefined);
 const sm=CIVIC.find(c=>c.id==='supermarket'),town=fakeContext(),T=drawMinimap(town,{place:'village',x:sm.x,z:sm.z+8,facing:0,heading:0,shops:[{id:'supermarket',x:sm.x,z:sm.z+sm.d/2+1.8}],npcs:[]},300);
 const at=T.point(sm.x,sm.z),box=town.calls.find(c=>c.op==='rect'&&c.fill===COLORS.civic.supermarket);assert.ok(box&&near(box.c.x,at.x,1e-6)&&near(box.c.y,at.y,1e-6),'the supermarket on the minimap');
 assert.ok(town.calls.some(c=>c.op==='rect'&&c.fill===COLORS.parking),'its parking');assert.ok(town.calls.some(c=>c.op==='fill'&&c.fill===COLORS.shop.supermarket),'a shop diamond at its door');
 // The lanes, the lots' paths and the east gate's spur are drawn too (the spur is the fifth road rectangle, east of the ring).
 assert.ok(town.calls.filter(c=>c.op==='rect'&&c.fill===COLORS.lane).length>=10);const spur=town.calls.filter(c=>c.op==='rect'&&c.fill===COLORS.road).at(-1);assert.ok(near(spur.c.x,T.point(ROADS.east+8,0).x,1e-6));
});
test('the minimap redraws eight times a second, eases its reach, keeps N at the top, and updates its caption only when it changes',()=>{
 const ctx=fakeContext(),style={left:'',top:''},caption={textContent:''};let view=village(),writes=0;
 const north={style:new Proxy(style,{set(t,k,v){t[k]=v;writes++;return true;}})};
 const map=new Minimap({width:300,height:300,getContext:()=>ctx},{north,caption},()=>view);
 assert.equal(map.frame(.016),true);assert.equal(map.draws,1);assert.equal(caption.textContent,'WILLOWMERE');assert.equal(writes,2);
 assert.equal(style.left,'calc(50.00% - 10px)');assert.equal(style.top,'calc(0.00% - 10px)');assert.equal(map.heading,0);assert.equal(map.px,2,'a 300 px bitmap shown at 150 px unless the canvas says otherwise');
 for(let i=0;i<5;i++)assert.equal(map.frame(.016),false);assert.equal(map.draws,1,'not every frame');
 assert.equal(map.frame(.06),true);assert.equal(writes,2,'the badge is not written again');
 // Walking out into the fields: the reach eases toward its target instead of jumping.
 view=village({x:200,z:0});map.invalidate();map.frame(0);assert.ok(map.radius>RANGE.village&&map.radius<RANGE.fields);for(let i=0;i<40;i++){map.invalidate();map.frame(0);}assert.equal(map.radius,RANGE.fields);assert.equal(caption.textContent,'NIGHT LAND');
 // Going indoors snaps (a new place) and names the house; N stays where it was.
 view={place:'interior',x:0,z:6,facing:0,heading:0,house:HOUSES[0]};map.invalidate();map.frame(0);assert.equal(map.radius,RANGE.room);assert.equal(style.left,'calc(50.00% - 10px)');assert.equal(caption.textContent,'YOUR HOMESTEAD');assert.equal(writes,2);
 // The size on the screen sets the CSS-pixel floor: a 96 px minimap has 3.125 canvas pixels to one of the screen's.
 const small=new Minimap({width:300,height:300,clientWidth:96,getContext:()=>fakeContext()},{},()=>village());small.frame(0);assert.ok(near(small.px,3.125));
 // No view yet (the world is still loading): nothing is drawn, nothing breaks.
 const idle=new Minimap({width:300,height:300,getContext:()=>ctx},{},()=>null);assert.equal(idle.frame(1),false);
});
test('the stylesheets: the minimap canvas is a true circle; the sheet’s rules live in maps.css, with a touch-safe canvas and 44 px buttons',()=>{
 const css=readFileSync(new URL('../src/hud-reference.css',import.meta.url),'utf8'),rule=css.match(/\.minimap #map-canvas \{([^}]*)\}/)?.[1]??'';
 assert.match(rule,/width: 100%/);assert.match(rule,/height: 100%/);assert.match(rule,/aspect-ratio: 1\b/);assert.match(rule,/border-radius: 50%/);
 // The id selector outranks style.css's own #map-canvas rules (one id against one id plus a class).
 const old=readFileSync(new URL('../src/style.css',import.meta.url),'utf8');assert.ok(/#map-canvas\{[^}]*aspect-ratio:320\/260/.test(old),'the old rule is still there, and still loses');
 const main=readFileSync(new URL('../src/main.mjs',import.meta.url),'utf8');assert.ok(main.indexOf("import './style.css'")<main.indexOf("import './hud-reference.css'"));
 // The #large-map rules moved to maps.css: none is left in style.css (the :has() selector that picks the panel's icon is not a rule for it).
 assert.ok(!/#large-map\{/.test(old));const maps=readFileSync(new URL('../src/maps.css',import.meta.url),'utf8'),sheet=maps.match(/\n#large-map \{([^}]*)\}/)?.[1]??'';
 assert.match(sheet,/touch-action: none/);assert.match(sheet,/max-height: 56vh/);assert.match(sheet,/aspect-ratio: 10 \/ 7/);assert.match(maps,/orientation: portrait[^}]*#large-map \{ aspect-ratio: 1; max-height: 50dvh; \}/);
 assert.match(maps,/\.map-tools button \{ min-width: 44px; min-height: 44px;/);
 // The Map's buttons carry data-map, never data-action (nothing is added to main.mjs's action switch), and the directory is passed through.
 const html=mapHtml(village(),'<div class="quick-locations">DIRECTORY</div>');assert.equal((html.match(/data-map="/g)??[]).length,5);for(const name of ['world','village','me','in','out'])assert.ok(html.includes(`data-map="${name}"`),name);
 assert.ok(!html.includes('data-action'));assert.ok(html.includes('id="large-map"')&&html.includes('DIRECTORY')&&html.includes('id="map-pick"'));assert.ok(!html.includes('den-list')&&!html.includes('legend-den'),'box shut: no den list, no boss in the legend');
 assert.match(main,/worldMap\.html\(mapView\(\),`<div class="quick-locations">/);assert.match(main,/worldMap\.mount\(\);/);
});
test('every den for the maps comes from the creature simulation: 26 entries, alive, down with a timer, or far away and unloaded',()=>{
 // Nothing loaded (you are in the village): one entry for every den, each at its den, alive (the dragon's nest apart).
 const wilds=new Wilds({},()=>.5),all=denStatuses(wilds,[],0);assert.equal(all.length,26);assert.deepEqual(all.map(d=>d.id),DENS.map(d=>d.id));
 for(const [i,d] of all.entries()){const row=DENS[i];assert.deepEqual(Object.keys(d),['id','type','titan','event','region','level','x','z','down','left']);assert.deepEqual([d.type,d.titan,d.event,d.region,d.level,d.x,d.z],[row.type,row.titan,row.event,row.region,row.level,row.x,row.z]);if(!d.event)assert.deepEqual([d.down,d.left],[false,0]);}
 assert.equal(all.filter(d=>d.titan).length,9);assert.equal(denStatuses(undefined).length,26);
 const bearOf=list=>list.find(d=>d.id==='w:den:bear');assert.deepEqual(bearOf(all),{id:'w:den:bear',type:'bear',titan:false,event:null,region:'east',level:13,x:DEN.x,z:DEN.z,down:false,left:0});
 // Loaded and alive: the crown follows the bear himself.
 wilds.sync(true,DEN.x+10,DEN.z);const bear=wilds.list.find(e=>e.id==='w:den:bear');assert.ok(bear);bear.x+=6;assert.deepEqual([bearOf(denStatuses(wilds)).x,bearOf(denStatuses(wilds)).z],[DEN.x+6,DEN.z]);
 // Defeated: down, with the seconds until he is back; the crown returns to the den.
 wilds.hit(bear,9999);const s=bearOf(denStatuses(wilds));assert.equal(s.down,true);assert.equal(s.left,AI.bossRespawn);assert.deepEqual([s.x,s.z],[DEN.x,DEN.z]);
 // You walk away (his cell unloads): the timer keeps counting on the clock of the simulation.
 wilds.time+=30;bear.respawn-=30;wilds.sync(true,0,0);assert.equal(wilds.list.some(e=>e.id==='w:den:bear'),false);const far=bearOf(denStatuses(wilds));assert.equal(far.down,true);assert.ok(near(far.left,AI.bossRespawn-30));
 wilds.time+=AI.bossRespawn;assert.equal(bearOf(denStatuses(wilds)).down,false,'back when the time is up');
 // The same list and the same entries are reused (no garbage each map frame); a stale list is put right.
 const out=denStatuses(wilds,[]),first=out[3];first.down=true;first.left=9;assert.equal(denStatuses(wilds,out),out);assert.equal(out[3],first);assert.equal(first.down,false);
 const stale=[{id:'stale'}];assert.equal(denStatuses(undefined,stale),stale);assert.equal(stale.length,26);assert.equal(stale[0].id,DENS[0].id);
 // A titan that is down in the simulation carries its own (longer) timer: whatever the simulation says.
 const rig={list:[{id:'w:den:titan_turtle',hp:0,respawn:431,x:1,z:2}],dead:new Map([['w:den:treant',1050]]),time:1000},mixed=denStatuses(rig,[],0);
 assert.deepEqual([mixed[4].down,mixed[4].left,mixed[4].x,mixed[4].z],[true,431,DENS[4].x,DENS[4].z]);assert.deepEqual([mixed[0].down,mixed[0].left],[true,50]);
 // The dragon's nest: down while the lava event is not "dragon", with the time to the next visit (not a respawn timer); up while it is here.
 const start=nextEvent('dragon',0);assert.ok(Number.isFinite(start)&&lavaEvent(start+5).id==='dragon');
 const calm=start-100;assert.notEqual(lavaEvent(calm).id,'dragon');const away=denStatuses(undefined,[],calm).find(d=>d.event==='dragon');assert.equal(away.down,true);assert.ok(near(away.left,100),'the time to its next visit');
 const here=denStatuses(undefined,[],start+5).find(d=>d.event==='dragon');assert.deepEqual([here.down,here.left],[false,0]);
 // Beaten during its visit: down until the next visit, however short the simulation's own timer is.
 const beaten=denStatuses({list:[{id:'w:den:dragon',hp:0,respawn:90,x:0,z:0}],time:0},[],start+5).find(d=>d.event==='dragon');assert.equal(beaten.down,true);assert.ok(beaten.left>240&&near(beaten.left,nextEvent('dragon',start+300)-(start+5)));
 // The test hook's forced event counts too.
 forceLavaEvent('dragon');assert.equal(denStatuses(undefined,[],calm).find(d=>d.event==='dragon').down,false);forceLavaEvent(null);
 // The other way round: another event held over a real visit still gives a countdown to a later visit, never "0:00".
 forceLavaEvent('normal');const held=denStatuses(undefined,[],start+5).find(d=>d.event==='dragon');forceLavaEvent(null);assert.equal(held.down,true);assert.ok(held.left>240&&Number.isFinite(held.left),`${held.left}`);
 assert.equal(denName('bear'),'King Bear');assert.equal(denName('titan_kraken'),'Abyssal Kraken');for(const d of DENS)assert.notEqual(denName(d.type),d.type,d.type);
});
test('which dens ride the rim: the four home bosses always, the nearest others within 160 m, eight in all with a tie at the cap let through',()=>{
 const types=(x,z,reach,list=dens({dragon:{down:true,left:500}}),cages)=>rimDens(list,x,z,reach,cages).map(i=>`${i.den.type} ${i.far.toFixed(1)}`);
 // The table of spec 10.2, with its order.
 assert.deepEqual(types(0,0,46),['treant 154.2','croc 154.2','mushking 154.2','bear 154.2','titan_turtle 115.4','cake 141.4','robot 144.2','leviathan 144.2','phoenix 144.2'],'nine: the three-way tie at 144.2 m is let through');
 assert.deepEqual(types(40,40,46),['treant 192.5','croc 192.5','mushking 130.0','bear 130.0','titan_turtle 73.0','phoenix 87.7','cake 152.3','leviathan 154.9']);
 assert.deepEqual(types(-128,112,120),['croc 305.6','bear 312.2','gorilla 135.0','golem 153.2']);
 // At candy's stand six dens are in reach, drawn on their spots, and so not on the rim.
 const here=dens().filter(d=>Math.hypot(d.x+128,d.z-112)<=120*ON_MAP).map(d=>d.type);assert.deepEqual(here,['treant','mushking','cake','gingerbread','jellyqueen','titan_hydra']);
 assert.equal(RIM_MAX,8);assert.equal(RIM_REACH,160);
 // The sleeping dragon never rides the rim; while it is here it may. From (0, 200) in the Ember Fields the nest is beyond a village-sized reach.
 assert.ok(!types(0,200,20).some(t=>t.startsWith('dragon')));assert.ok(types(0,200,20,dens()).some(t=>t.startsWith('dragon')));
 // The boss of an open cage is always on the rim, at any distance; a locked cage's is not forced.
 assert.ok(!types(250,0,46).some(t=>t.startsWith('robot')));assert.ok(types(250,0,46,dens(),[{id:'pepper',den:'w:den:robot',x:-98,z:-98,state:'open'}]).some(t=>t.startsWith('robot')));assert.ok(!types(250,0,46,dens(),[{id:'pepper',den:'w:den:robot',x:-98,z:-98,state:'locked'}]).some(t=>t.startsWith('robot')));
 // Never more than nine, wherever you stand; the list it is given is reused.
 for(let x=-300;x<=300;x+=20)for(let z=-300;z<=300;z+=20){if(regionAt(x,z)===null)continue;const n=rimDens(dens(),x,z,mapRadius('village',x,z)).length;assert.ok(n<=RIM_MAX+1,`${x},${z}: ${n}`);}
 const out=[];assert.equal(rimDens(dens(),0,0,46,[],out),out);
});
test('the minimap marks every den near you: in reach on its spot, the rest on the rim with a dart and its distance; a titan violet and larger; down grey with its timer',()=>{
 // Shut: no crown anywhere, whatever the view carries.
 const shut=fakeContext();drawMinimap(shut,village({x:0,z:0,dens:dens()}),300);assert.equal(crowns(shut).length,0);
 // Open, at the village centre: nine crowns on the rim, each at the bearing of its den (north up), whatever way you face and whatever the camera's yaw.
 for(const [facing,heading] of [[0,CAMERA_YAW],[2.2,1.1]]){
  const ctx=fakeContext(),P=drawMinimap(ctx,village({x:0,z:0,facing,heading,pandora:true,dens:dens({dragon:{down:true,left:500}})}),300);
  assert.equal(crowns(ctx).length,9);assert.equal(P.marks.rim.length,9);assert.deepEqual(P.marks.on,[]);
  for(const m of P.marks.rim){const d=DENS.find(o=>o.id===m.id);assert.ok(near(bearing(m),Math.atan2(d.x,-d.z),1e-9),m.id);assert.ok(Math.hypot(m.x-150,m.y-150)<150-m.s);assert.ok(near(Math.hypot(m.x-150,m.y-150),150-m.s*1.85,1e-6));}
  const bear=P.marks.rim.find(m=>m.id==='w:den:bear');assert.ok(bear.x>150+100&&Math.abs(bear.y-150)<40,'a den to the east is at the right of the disc');
  const croc=P.marks.rim.find(m=>m.id==='w:den:croc');assert.ok(croc.y<40,'one to the north at the top');
  // Eight boss discs and one violet titan disc; a home boss at full size with a white ring, the others at 0.8 with their region's accent.
  assert.equal(discs(ctx,COLORS.boss).length,8);assert.equal(discs(ctx,COLORS.titan).length,1);
  assert.ok(near(bear.s,10.2));assert.equal(bear.ring,'#ffffff');const cake=P.marks.rim.find(m=>m.id==='w:den:cake');assert.ok(near(cake.s,10.2*.8));assert.equal(cake.ring,REGION.candy.accent);
  // Every rim marker carries its distance, inward of it, at least 9 CSS px high (18 canvas px at 150 px across), and no two labels overlap.
  assert.deepEqual(P.marks.rim.map(m=>m.text),['154','154','154','154','115','141','144','144','144']);assert.ok(P.marks.rim.every(m=>m.labelled&&m.size>=18));
  for(const m of P.marks.rim){assert.ok(Math.hypot(m.lx-150,m.ly-150)<Math.hypot(m.x-150,m.y-150),'inward');const t=ctx.calls.find(c=>c.op==='text'&&c.t===m.text&&near(c.p.x,m.lx)&&near(c.p.y,m.ly));assert.ok(t&&t.size>=18);}
  const boxes=P.marks.rim.map(m=>({x0:m.lx-m.text.length*m.size*.3,x1:m.lx+m.text.length*m.size*.3,y0:m.ly-m.size*.39,y1:m.ly+m.size*.39}));
  for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++)assert.ok(!(boxes[i].x0<boxes[j].x1&&boxes[i].x1>boxes[j].x0&&boxes[i].y0<boxes[j].y1&&boxes[i].y1>boxes[j].y0),`${i} over ${j}`);
  // A dart points outward from each, in its disc's colour.
  assert.equal(ctx.calls.filter(c=>c.op==='fill'&&[COLORS.boss,COLORS.titan].includes(c.fill)&&P.marks.rim.some(m=>near(c.at.x,m.x)&&near(c.at.y,m.y))).length,9);
  // Home is on the map here, on its own spot.
  assert.equal(rimPoint(P,HOUSES[0].x,HOUSES[0].z,19.5).off,false);
 }
 // At (40, 40): eight, at their bearings.
 const mid=fakeContext(),M=drawMinimap(mid,village({x:40,z:40,pandora:true,dens:dens({dragon:{down:true,left:500}})}),300);assert.equal(M.marks.rim.length,8);assert.ok(M.marks.rim.every(m=>m.labelled));
 for(const m of M.marks.rim){const d=DENS.find(o=>o.id===m.id);assert.ok(near(bearing(m),Math.atan2(d.x-40,-(d.z-40)),1e-9),m.id);}
 // The phone's 96 px minimap (3.125 canvas pixels to a CSS pixel): the same nine markers, a crown at least 5 CSS px in radius; the four
 // nearest carry their distance at 9 CSS px, the rest keep the dart (the rule the rim mock fixed).
 const phone=fakeContext(),F=drawMinimap(phone,village({x:0,z:0,pandora:true,dens:dens({dragon:{down:true,left:500}})}),300,46,3.125);
 assert.equal(F.marks.rim.length,9);assert.ok(near(F.marks.rim[0].s,5*3.125));assert.deepEqual(F.marks.rim.filter(m=>m.labelled).map(m=>m.id.slice(6)),['titan_turtle','cake','robot','leviathan']);assert.ok(F.marks.rim.every(m=>near(m.size,9*3.125)));
 const mock=fakeContext(),K=drawMinimap(mock,village({x:0,z:0,pandora:true,dens:dens()}),300,46,2.5);assert.equal(K.marks.rim.filter(m=>m.labelled).length,9,'the 120 px minimap labels all nine');
 // At candy's stand (reach 120 m): six dens on their spots, four on the rim. The titan is violet with a gold ring and 1.3 times a boss.
 const candy=fakeContext(),C=drawMinimap(candy,village({x:-128,z:112,pandora:true,dens:dens()}),300);
 assert.equal(C.radius,RANGE.fields);assert.deepEqual(C.marks.on.map(id=>id.slice(6)),['treant','mushking','cake','gingerbread','jellyqueen','titan_hydra']);assert.deepEqual(C.marks.rim.map(m=>m.id.slice(6)),['croc','bear','gorilla','golem']);
 const hydra=C.point(-156,156),big=candy.calls.find(c=>c.op==='arc'&&c.fill===COLORS.titan&&near(c.p.x,hydra.x)&&near(c.p.y,hydra.y)),cakeAt=C.point(-100,100),small=candy.calls.find(c=>c.op==='arc'&&c.fill===COLORS.boss&&near(c.p.x,cakeAt.x)&&near(c.p.y,cakeAt.y));
 assert.ok(big&&small);assert.ok(near(big.r,small.r*1.3));assert.equal(COLORS.titan,'#5b2a86');assert.equal(crowns(candy).length,10);
 assert.ok(candy.calls.some(c=>c.op==='stroke'&&c.stroke===COLORS.crown&&c.path.some(p=>p.arc&&near(p.x,hydra.x)&&near(p.y,hydra.y))),'a gold ring on the titan');
 // A loaded boss is not drawn twice: its den's marker is the crown, on the creature itself.
 const both=fakeContext(),list=dens({bear:{x:DEN.x-8,z:DEN.z}});drawMinimap(both,village({x:DEN.x-30,z:DEN.z+20,pandora:true,dens:list,creatures:[{x:DEN.x-8,z:DEN.z,hp:800,boss:true,den:true,angry:true},{x:DEN.x-20,z:DEN.z+10,hp:30,boss:false,den:false,angry:false}]}),300);
 const B=projection({x:DEN.x-30,z:DEN.z+20,radius:mapRadius('village',DEN.x-30,DEN.z+20),size:300}),on=B.point(DEN.x-8,DEN.z);assert.equal(both.calls.filter(c=>c.op==='arc'&&c.fill===COLORS.boss&&near(c.p.x,on.x)&&near(c.p.y,on.y)).length,1);assert.equal(both.calls.filter(c=>c.op==='arc'&&c.fill===COLORS.creature).length,1);
 // Down: grey and faint with its timer under it (on the map) or in the distance's place (on the rim).
 const down=fakeContext(),D=drawMinimap(down,village({x:DEN.x-30,z:DEN.z+20,pandora:true,dens:dens({bear:{down:true,left:64.2},treant:{down:true,left:7}})}),300);
 const grey=down.calls.filter(c=>c.op==='arc'&&c.fill===COLORS.bossDown&&c.r>6);assert.equal(grey.length,2);assert.ok(grey.every(c=>c.alpha===.6));assert.ok(down.calls.some(c=>c.op==='text'&&c.t==='1:05'&&c.p.y>D.point(DEN.x,DEN.z).y));
 const treant=D.marks.rim.find(m=>m.id==='w:den:treant');assert.equal(treant.text,'0:07');assert.equal(clock(64.2),'1:05');assert.equal(clock(760),'12:40');
 // The sleeping dragon: grey on its nest with the time to its next visit when the map reaches it, never on the rim.
 const lava=fakeContext(),L=drawMinimap(lava,village({x:0,z:240,pandora:true,dens:dens({dragon:{down:true,left:760}})}),300);assert.ok(L.marks.on.includes('w:den:dragon'));assert.ok(lava.calls.some(c=>c.op==='text'&&c.t==='12:40'));
 const awake=fakeContext();drawMinimap(awake,village({x:0,z:240,pandora:true,dens:dens()}),300);assert.ok(awake.calls.some(c=>c.op==='stroke'&&c.stroke===COLORS.dragon),'while it is here: a boss crown with an orange ring');
});
test('a prison is a badge on its boss’s crown: a grey padlock while locked, a gold key while open, nothing once rescued or with the box shut',()=>{
 const at={x:DEN.x-30,z:DEN.z+20},cage=state=>[{id:'clover',den:'w:den:bear',x:DEN.x-6,z:DEN.z+2,state}],draw=(cages,extra={})=>{const ctx=fakeContext();drawMinimap(ctx,village({...at,pandora:true,dens:dens(),cages,...extra}),300);return ctx;};
 const has=(ctx,color)=>ctx.calls.some(c=>(c.op==='rect'&&c.fill===color)||(c.op==='stroke'&&c.stroke===color));
 const locked=draw(cage('locked'));assert.ok(has(locked,COLORS.lock)&&!has(locked,COLORS.key));
 const open=draw(cage('open'));assert.ok(has(open,COLORS.key)&&!has(open,COLORS.lock));
 for(const state of ['rescued','hidden']){const none=draw(cage(state));assert.ok(!has(none,COLORS.lock)&&!has(none,COLORS.key),state);}
 assert.ok(!has(draw([]),COLORS.lock));assert.ok(!has(draw(cage('locked'),{pandora:false}),COLORS.lock),'box shut');
 // On the rim too: from the village the bear's crown rides the rim with the padlock on its shoulder.
 const far=fakeContext(),P=drawMinimap(far,village({x:0,z:0,pandora:true,dens:dens(),cages:cage('locked')}),300),bear=P.marks.rim.find(m=>m.id==='w:den:bear'),body=far.calls.find(c=>c.op==='rect'&&c.fill===COLORS.lock);
 assert.ok(body&&Math.hypot(body.c.x-bear.x,body.c.y-bear.y)<bear.s*1.6&&body.c.x>bear.x&&body.c.y<bear.y+bear.s*.2);
 assert.equal(cageLine({id:'clover',state:'locked'}),'Locked cage · by the King Bear');assert.equal(cageLine({id:'clover',state:'open'}),'Clover is waiting · by the King Bear');assert.equal(cageLine({id:'sprout',state:'rescued'}),'');
});
test('what the Map says about a den: its name, level, region, distance and direction, or when it is back',()=>{
 assert.equal(compass(1,-1),'north-east');assert.equal(compass(0,-1),'north');assert.equal(compass(1,0),'east');assert.equal(compass(0,1),'south');assert.equal(compass(-1,1),'south-west');assert.equal(compass(-1,0),'west');
 const list=dens({dragon:{down:true,left:760}}),bear=list.find(d=>d.type==='bear'),far=Math.round(Math.hypot(DEN.x,DEN.z+8.8)),v=village({pandora:true,dens:list});
 assert.equal(denLine(v,bear),`King Bear · Lv 13 · Redrock Canyon · ${far} m east`);assert.equal(denLine(v,null),'');
 assert.equal(denState(v,{...bear,down:true,left:64.2}),`resting, back in 1:05 · ${far} m east`);
 assert.equal(denState(village({x:DEN.x+3,z:DEN.z-4}),bear),'right here');
 // Indoors the distance is measured from the door you came in by, not from where you stand in the room.
 assert.equal(denState({place:'interior',x:3,z:6,pandora:true,outside:{x:0,z:-8.8}},bear),`${far} m east`);
 assert.equal(denLine(v,list.find(d=>d.type==='croc')),'Crocodile King · Lv 10 · Chomper Swamp · 146 m north');
 assert.equal(denState(v,list.find(d=>d.event)),'away, next visit in 12:40');
 // The list under the sheet: a block per region with dens, the region you stand in first; a tick for a kind beaten before; a row for a cage.
 const rows=denRows(village({x:128,z:0,pandora:true,dens:list,defeated:{bear:true},cages:[{id:'clover',den:'w:den:bear',x:146,z:-24,state:'open'},{id:'sprout',den:'w:den:treant',x:-146,z:24,state:'rescued'}]}));
 assert.equal(rows.length,12);assert.equal(rows[0].region.id,'east');assert.deepEqual(rows.slice(1).map(g=>g.region.id),REGION_IDS.filter(id=>id!=='village'&&id!=='east'));assert.equal(rows.reduce((n,g)=>n+g.rows.length,0),26);
 assert.deepEqual(rows[0].rows.map(r=>[r.name,r.level,r.done,r.cage?.id??null]),[['King Bear',13,true,'clover'],['Ancient Mountain Turtle',13,false,null]]);assert.equal(rows.find(g=>g.region.id==='west').rows[0].cage,null,'a rescued friend’s cage has no row');
 assert.deepEqual(denRows(village({dens:list})),[],'box shut: no list');
 const html=denListHtml(village({x:128,z:0,pandora:true,dens:list,defeated:{bear:true},cages:[{id:'clover',den:'w:den:bear',x:146,z:-24,state:'locked'}]}));
 assert.equal((html.match(/data-den="/g)??[]).length,26);assert.match(html,/data-den="w:den:bear"><span class="den-mark">♛<\/span><b>King Bear<\/b><small>Lv 13<\/small><i class="den-done" title="Beaten before">✓<\/i><span class="den-state">\d+ m north-east<\/span>/);
 assert.match(html,/data-cage="clover"><span class="den-mark">🔒<\/span><span class="den-state">Locked cage · by the King Bear/);assert.match(html,/away, next visit in 12:40/);assert.match(html,/Redrock Canyon <small>★★★ · Lv 7\+/);
 assert.ok(mapHtml(village({pandora:true,dens:list}),'').includes('legend-titan'));
});
test('the Map’s camera: zoom limits, the three presets, the pan clamp, a zoom anchored where you point',()=>{
 for(const [w,h] of [[350,350],[320,320],[660,462],[590,218]]){
  const L=sheetLimits(w,h),side=Math.min(w,h);assert.ok(near(L.kMin,side/672));assert.equal(L.kMax,8);assert.ok(near(L.kVillage,side/(VILLAGE.x1-VILLAGE.x0+52)));assert.ok(near(L.kNames,Math.min(3,L.kVillage)));assert.ok(near(L.kMe,side/192));
  // World: all thirteen squares, centred. Village: the footprint and 26 m round it. Me: 192 m across, on you.
  const world=presetCam('world',village(),w,h);assert.deepEqual([world.cx,world.cz],[0,0]);assert.ok(near(world.k,L.kMin));
  const P=sheetProjection(world,w,h);for(const id of REGION_IDS){const s=squareOf(id);for(const [x,z] of [[s.x0,s.z0],[s.x1,s.z1]]){const p=P.point(x,z);assert.ok(p.x>=-1e-6&&p.x<=w+1e-6&&p.y>=-1e-6&&p.y<=h+1e-6,id);}}
  const vil=presetCam('village',village(),w,h),V=sheetProjection(vil,w,h);for(const [x,z] of [[VILLAGE.x0-26,VILLAGE.z0],[VILLAGE.x1+26,VILLAGE.z1],[SAFE.x0,SAFE.z0],[SAFE.x1,SAFE.z1]]){const p=V.point(x,z);assert.ok(p.x>=-1e-6&&p.x<=w+1e-6&&p.y>=-1e-6&&p.y<=h+1e-6);}
  const me=presetCam('me',village({x:40,z:-30}),w,h);assert.deepEqual([me.cx,me.cz],[40,-30]);assert.ok(near(me.k,L.kMe));
  assert.equal(presetOf(world,village(),w,h),'world');assert.equal(presetOf(vil,village(),w,h),'village');assert.equal(presetOf(me,village({x:40,z:-30}),w,h),'me');assert.equal(presetOf({cx:3,cz:3,k:1.7},village(),w,h),'');
  // The clamp: the view's centre stays within ±336 m less half the view; when the view is wider than the world the centre is locked at 0.
  for(const k of [L.kMin,1,2.5,8])for(const [cx,cz] of [[9999,0],[-9999,0],[0,9999],[0,-9999],[9999,-9999]]){
   const c=clampCam({cx,cz,k},w,h),rx=TERRAIN.half-w/2/c.k,rz=TERRAIN.half-h/2/c.k;
   assert.ok(rx>0?near(Math.abs(c.cx),cx?rx:0):c.cx===0,`${w}x${h} k ${k} x`);assert.ok(rz>0?near(Math.abs(c.cz),cz?rz:0):c.cz===0,`${w}x${h} k ${k} z`);
  }
  assert.equal(clampCam({cx:0,cz:0,k:99},w,h).k,8);assert.ok(near(clampCam({cx:0,cz:0,k:.01},w,h).k,L.kMin));
  // A wheel or a pinch keeps the world point under the cursor where it is; at the limits nothing moves.
  const cam={cx:10,cz:-20,k:2},Q=sheetProjection(cam,w,h),under=Q.world(w*.7,h*.3);zoomAt(cam,1.9,w*.7,h*.3,w,h);assert.ok(near(cam.k,3.8));const after=sheetProjection(cam,w,h).point(under.x,under.z);assert.ok(near(after.x,w*.7,1e-6)&&near(after.y,h*.3,1e-6));
  zoomAt(cam,100,w/2,h/2,w,h);assert.equal(cam.k,8);zoomAt(cam,1e-6,w/2,h/2,w,h);assert.ok(near(cam.k,L.kMin));assert.ok(Math.abs(cam.cx)<=Math.max(0,TERRAIN.half-w/2/cam.k)+1e-9);
  // A drag moves the sheet with the pointer.
  const drag={cx:0,cz:0,k:2};panBy(drag,30,-10,w,h);assert.deepEqual([drag.cx,drag.cz],[-15,5]);
 }
 assert.ok(near(sheetLimits(350,350).kVillage,2.147,1e-3)&&near(sheetLimits(350,350).kMin,.5208,1e-4),'the spec’s numbers for a 350 px phone sheet');assert.ok(STEP>1);
 // It opens on Village inside the ward and on Me outside it; indoors by the door you came in by.
 assert.equal(openingPreset(village()),'village');assert.equal(openingPreset(village({x:SAFE.x1-1,z:0})),'village');assert.equal(openingPreset(village({x:SAFE.x1+1,z:0})),'me');assert.equal(openingPreset(village({x:-128,z:112})),'me');
 assert.equal(openingPreset({place:'interior',x:2,z:3,outside:{x:0,z:-8.8}}),'village');
});
test('the Map’s sheet: the regions, borders and village at any zoom; markers of one size; names that thin out and never cover one another',()=>{
 const list=dens({dragon:{down:true,left:760},treant:{down:true,left:42}}),cages=[{id:'clover',den:'w:den:bear',x:DEN.x-6.2,z:DEN.z+2,state:'locked'},{id:'pepper',den:'w:den:robot',x:-97.4,z:-97.4,state:'open'}];
 const open=village({pandora:true,dens:list,cages,vehicles:[{id:'jeep',x:46,z:-12}],shops:[{id:'market',x:5.5,z:23.2}]});
 const apart=labels=>{for(let i=0;i<labels.length;i++)for(let j=i+1;j<labels.length;j++){const a=labels[i],b=labels[j];assert.ok(!(Math.abs(a.x-b.x)<(a.w+b.w)/2&&Math.abs(a.y-b.y)<(a.h+b.h)*.5),`"${a.text}" over "${b.text}"`);}};
 for(const [w,h] of [[350,350],[320,320],[660,462]]){
  const L=sheetLimits(w,h);
  // The Village preset: the whole ward on the sheet, the thirteen names of the village at its own zoom, on a 350 and a 320 px sheet too.
  const ctx=fakeContext(),P=drawWorldMap(ctx,open,presetCam('village',open,w,h),w,h);
  assert.equal(P.heading,0);for(const [x,z] of WARD_OUTLINE){const p=P.point(x,z);assert.ok(p.x>=0&&p.x<=w&&p.y>=0&&p.y<=h,`${x},${z}`);}
  const places=P.labels.filter(l=>l.kind==='place').map(l=>l.text);assert.deepEqual(places.sort(),['Alder','Bell','Clinic','Finch','Hearth','Home','Moss','Police','Reed','School','Supermarket','Vale','Willow & Co.'].sort(),`${w}x${h}`);
  assert.ok(P.labels.every(l=>l.size>=11));apart(P.labels);assert.ok(ctx.calls.filter(c=>c.op==='text'&&c.t!=='♛').every(c=>c.size>=11),'no text under 11 px');
  const houses=ctx.calls.filter(c=>c.op==='rect'&&HOMES.slice(1).some(hh=>hh.color===c.fill));assert.equal(houses.length,6,'five houses and the Vale workshop’s barn');for(const hh of houses)assert.ok(hh.c.y<P.point(0,ROADS.south).y,'inside the ring');
  assert.ok(ctx.calls.some(c=>c.op==='rect'&&c.fill===COLORS.civic.supermarket)&&ctx.calls.some(c=>c.op==='rect'&&c.fill===COLORS.parking)&&ctx.calls.filter(c=>c.op==='rect'&&c.fill===COLORS.road).length===5&&ctx.calls.filter(c=>c.op==='rect'&&c.fill===COLORS.lane).length>=10,'the Supermarket, its parking, the east spur, the lanes');
  assert.equal(ctx.calls.filter(c=>c.op==='stroke'&&c.stroke===COLORS.ward).length,1,'and the ward line while the box is open');
  // The World preset: every region's fill, every run, all 26 dens, the short names and the levels in their bands.
  const wide=fakeContext(),W=drawWorldMap(wide,open,presetCam('world',open,w,h),w,h);
  for(const id of REGION_IDS){if(id==='village')continue;const s=squareOf(id),c=W.point(s.cx,s.cz);assert.ok(wide.calls.some(r=>r.op==='rect'&&r.fill===REGION[id].ground&&near(r.c.x,c.x,1e-6)&&near(r.c.y,c.y,1e-6)),id);}
  assert.ok(wide.calls.some(c=>c.op==='rect'&&c.fill===REGION.village.ground));
  const strokes=wide.calls.filter(c=>c.op==='stroke');assert.equal(strokes.filter(s=>COLORS.band.includes(s.stroke)).reduce((n,s)=>n+s.path.length/2,0),3*BORDER_RUNS.length,'every run, in its three bands');
  const full=strokes.find(s=>s.stroke===COLORS.casing&&s.path.length===24);assert.ok(full.width>=3-1e-9&&full.width<=9+1e-9);
  const marks=W.markers.filter(m=>m.kind==='boss'||m.kind==='titan');assert.equal(marks.length,26);assert.ok(marks.filter(m=>m.kind==='boss').every(m=>m.r===8)&&marks.filter(m=>m.kind==='titan').every(m=>m.r===SHEET.titan),'crown r 8, titan 10.4');assert.equal(marks.filter(m=>m.kind==='titan').length,9);
  for(const m of marks){const d=list.find(o=>o.id===m.id),p=W.point(d.x,d.z);assert.ok(near(m.x,p.x)&&near(m.y,p.y)&&m.x>0&&m.x<w&&m.y>0&&m.y<h,m.id);}
  assert.equal(discs(wide,COLORS.boss).length,15);assert.equal(discs(wide,COLORS.titan).length,9);assert.equal(discs(wide,COLORS.bossDown).length,2,'the treant and the sleeping dragon are grey');
  assert.ok(W.labels.some(l=>l.kind==='timer'&&l.text==='0:42')&&W.labels.some(l=>l.kind==='timer'&&l.text==='12:40'));assert.equal(W.countdown,true);
  // The cages: at this zoom a badge on the crown's shoulder (the cage is 6.5 m from its boss); you, home and the jeep are there too.
  const cage=W.markers.filter(m=>m.kind==='cage');assert.deepEqual(cage.map(m=>[m.id,m.state,m.r]),[['clover','locked',SHEET.badge],['pepper','open',SHEET.badge]]);
  assert.deepEqual(W.markers.filter(m=>!['boss','titan','cage'].includes(m.kind)).map(m=>m.kind).sort(),['home','vehicle','you']);assert.equal(W.markers.find(m=>m.kind==='you').r,9);
  const names=W.labels.filter(l=>l.kind==='region').map(l=>l.text),levels=W.labels.filter(l=>l.kind==='level').map(l=>l.text);
  // Zoomed far out a region has its one word where a band of its square is clear of its crowns (top, bottom or the middle), and its
  // level where a band is left: on a PC sheet all twelve of each, on a 350 px phone sheet most names. A word is never half under a crown.
  if(L.kMin<SHEET.tierNames){const every=REGION_IDS.filter(id=>id!=='village').map(id=>REGION_SHORT[id]);assert.deepEqual(names,every.filter(n=>names.includes(n)),'the regions’ one word, in the map’s order');assert.ok(names.length>=(w>=600?12:w>=350?9:6),`${w}: ${names.length} names`);assert.ok(levels.length>=(w>=600?12:w>=350?4:0)&&levels.every(t=>/^Lv \d+\+$/.test(t)),`${w}: ${levels.length} levels`);assert.ok(!W.labels.some(l=>['place','den','cage'].includes(l.kind)),'no other labels this far out');
   for(const l of W.labels.filter(l=>l.kind==='region'||l.kind==='level'))for(const m of marks){const dx=Math.max(0,Math.abs(m.x-l.x)-l.w/2-2),dy=Math.max(0,Math.abs(m.y-l.y)-l.h*.58);assert.ok(Math.hypot(dx,dy)>=m.r-(l.kind==='region'?3:1)-1e-6,`"${l.text}" under ${m.id}`);}}
  assert.ok(W.labels.every(l=>l.size>=11));apart(W.labels);
  // The same markers at k = 4 are the same size; den names show there, and the full region name with its stars and level.
  const close=fakeContext(),Z=drawWorldMap(close,open,clampCam({cx:-128,cz:128,k:4},w,h),w,h),seen=Z.markers.filter(m=>m.kind==='boss'||m.kind==='titan');
  assert.ok(seen.length>=1&&seen.every(m=>m.r===(m.kind==='titan'?SHEET.titan:8)));assert.ok(Z.labels.some(l=>l.kind==='region'&&l.text==='Candy Land')&&Z.labels.some(l=>l.kind==='level'&&l.text==='★★★ · Lv 7+'));
  assert.ok(Z.labels.some(l=>l.kind==='den'));apart(Z.labels);assert.ok(Z.labels.every(l=>l.size>=11));
  // k = 1.5: full names, den names where they fit, still no house names (they begin at kNames).
  const mid=fakeContext(),Y=drawWorldMap(mid,open,clampCam({cx:0,cz:0,k:1.5},w,h),w,h);assert.ok(Y.labels.some(l=>l.kind==='region'&&l.text==='Willowmere'));assert.ok(!Y.labels.some(l=>l.kind==='place'));apart(Y.labels);
  // Where the zoom parts a cage from its boss it is its own marker, r 7, with its name.
  const bearCam=clampCam({cx:DEN.x,cz:DEN.z,k:8},w,h),N=drawWorldMap(fakeContext(),open,bearCam,w,h),own=N.markers.find(m=>m.id==='clover');assert.equal(own.r,SHEET.cage);assert.ok(near(own.x,N.point(DEN.x-6.2,DEN.z+2).x));assert.ok(N.labels.some(l=>l.kind==='cage'&&l.text==='Locked cage'));
  // A tap picks the marker within 22 px and names it.
  const croc=W.markers.find(m=>m.id==='w:den:croc');assert.equal(pickMarker(W,croc.x+6,croc.y-5).id,'w:den:croc');assert.equal(pickMarker(W,w/2+.3*w,2),null);
  assert.equal(pickLine(open,croc),'♛ Crocodile King · Lv 10 · Chomper Swamp · 146 m north');assert.equal(pickLine(open,own),'🔒 Locked cage · by the King Bear');assert.match(pickLine(open,W.markers.find(m=>m.kind==='home')),/^⌂ Home · /);assert.equal(pickLine(open,W.markers.find(m=>m.kind==='you')),'▲ You · Willowmere');assert.equal(pickLine(open,null),'');
  const ring=fakeContext();drawWorldMap(ring,open,presetCam('world',open,w,h),w,h,{picked:'w:den:croc'});assert.ok(ring.calls.filter(c=>c.op==='stroke'&&c.path.some(p=>p.arc&&near(p.x,croc.x)&&near(p.y,croc.y))).length>=3,'the picked crown is ringed');
  // Box shut: fills, borders, names and levels; no crown, no badge, no timer.
  const quiet=fakeContext(),S=drawWorldMap(quiet,village({dens:list,cages}),presetCam('world',open,w,h),w,h);assert.equal(crowns(quiet).length,0);assert.deepEqual(S.markers.map(m=>m.kind).sort(),['home','you']);assert.equal(S.countdown,false);
  if(L.kMin<SHEET.tierNames){assert.deepEqual(S.labels.filter(l=>l.kind==='region').map(l=>l.text),REGION_IDS.filter(id=>id!=='village').map(id=>REGION_SHORT[id]));assert.deepEqual(S.labels.filter(l=>l.kind==='level').map(l=>l.text),REGION_IDS.filter(id=>id!=='village').map(id=>`Lv ${REGION[id].level}+`),'box shut: every name and every level, in their bands');for(const id of REGION_IDS){if(id==='village')continue;const sq=squareOf(id),c=S.point(sq.cx,sq.cz),n=S.labels.find(l=>l.text===REGION_SHORT[id]);assert.ok(near(n.x,c.x)&&n.y<c.y,'the name in the top band');}}assert.equal(quiet.calls.filter(c=>c.op==='stroke'&&c.stroke===COLORS.ward).length,0);
 }
 // The Me preset out in a land: you in the middle, the land's name on the sheet.
 const me=village({x:-128,z:112,pandora:true,dens:list}),M=drawWorldMap(fakeContext(),me,presetCam('me',me,350,350),350,350),you=M.markers.find(m=>m.kind==='you');assert.ok(near(you.x,175)&&near(you.y,175));assert.ok(M.labels.some(l=>l.text==='Candy Land'));
});
test('the terrain cache: built 96 rows a frame over seven frames, never at boot; one blit a frame once it is whole, none before',()=>{
 assert.equal(TERRAIN.size,672);assert.equal(TERRAIN.rows,96);assert.equal(Math.ceil(TERRAIN.size/TERRAIN.rows),7);
 assert.equal(terrainFill(0,0),REGION.village.ground);assert.equal(terrainFill(-128,0),REGION.west.ground);assert.equal(terrainFill(SAFE.x0-2,0),REGION.west.ground,'the west strip of the centre cell');assert.equal(terrainFill(0,256),REGION.lava.ground);assert.equal(terrainFill(227,-185),null,'an empty cell is left transparent');assert.equal(terrainFill(330,0),null);
 const sheet=fakeContext(),canvas={getContext:()=>sheet};let made=0;
 const features=id=>id==='lava'?[{kind:'pool',x:10,z:250,r:15},{kind:'nest',x:28,z:228,r:14}]:id==='toy'?[{kind:'track',x:-156,z:-100,r:12},{kind:'pond',x:-128,z:-150,r:8}]:id==='jungle'?[{kind:'poison',x:-250,z:30,r:6},{kind:'mystery',x:0,z:0,r:3}]:[];
 const cache=terrainCache(size=>{made++;assert.equal(size,672);return canvas;});assert.equal(terrainCache(),cache,'one cache for both maps');assert.equal(cache.ready,false);
 const ctx=fakeContext(),view=village({features});let frames=0;const map=new Minimap({width:300,height:300,getContext:()=>ctx},{},()=>view);
 // The first frame draws the map with flat fills and builds nothing; the next seven build the cache; the frame it is whole draws again, with one blit.
 map.frame(.016);frames++;assert.equal(made,0,'nothing is built in the first frame');assert.equal(cache.steps,0);assert.equal(ctx.calls.filter(c=>c.op==='image').length,0);
 while(!cache.ready&&frames<20){map.frame(.016);frames++;assert.ok(sheet.calls.filter(c=>c.op==='rect').length>0);if(!cache.ready)assert.equal(ctx.calls.filter(c=>c.op==='image').length,0,'no blit before the cache is whole');}
 assert.equal(cache.steps,7);assert.equal(frames,8);assert.equal(made,1);assert.equal(map.draws,2,'drawn again the frame the cache is whole');
 const blits=ctx.calls.filter(c=>c.op==='image');assert.equal(blits.length,1);assert.equal(blits[0].image,canvas);const P=map.last,corner=P.point(-TERRAIN.half,-TERRAIN.half);assert.ok(near(blits[0].a.x,corner.x,1e-6)&&near(blits[0].a.y,corner.y,1e-6),'under the projection, at the world’s north-west corner');
 const before=ctx.calls.length;map.invalidate();map.frame(0);assert.equal(ctx.calls.slice(before).filter(c=>c.op==='image').length,1,'one blit a frame');assert.equal(ctx.calls.slice(before).filter(c=>c.op==='rect'&&c.fill===REGION.west.ground).length,0,'and no flat fill');assert.equal(cache.steps,7,'never built twice');
 // What is in it: thirteen fills (twelve regions and the village), as runs of one colour a row; nothing outside the world.
 assert.deepEqual([...cache.fills].sort(),REGION_IDS.map(id=>REGION[id].ground).sort());
 const rows=sheet.calls.filter(c=>c.op==='rect'&&near(c.b.y-c.a.y,1));assert.ok(rows.length>672&&rows.length<672*12);for(const r of rows.filter((r,i)=>i%37===0)){const x=(r.a.x+r.b.x)/2-TERRAIN.half,z=r.a.y+.5-TERRAIN.half;assert.equal(r.fill,terrainFill(x,z));assert.ok(regionAt(r.a.x+.5-TERRAIN.half,z)!==null&&regionAt(r.b.x-.5-TERRAIN.half,z)!==null);}
 assert.equal(rows.reduce((n,r)=>n+(r.b.x-r.a.x),0),13*128*128,'every metre of the thirteen squares, once');
 // The lands' features, in the reference's map colours, at their places (the cache is 1 px a metre, its origin at the world's centre).
 const pool=sheet.calls.find(c=>c.op==='arc'&&c.fill===COLORS.feature.pool);assert.deepEqual([pool.p.x,pool.p.y,pool.r],[10+336,250+336,15]);assert.equal(COLORS.feature.pool,'#ff6a2b');assert.equal(COLORS.feature.pond,'#4cb8f0');assert.equal(COLORS.feature.poison,'#7fd36b');assert.equal(COLORS.feature.sea,'#3a9ad9');assert.equal(COLORS.feature.floor,'#d9e4ff');
 assert.ok(sheet.calls.some(c=>c.op==='stroke'&&c.stroke==='#9aa6b8'),'a rail is a ring');assert.equal(cache.features,5,'an unknown kind is left out');
 // The Map blits the same cache; zoomed in it draws the features again as shapes, so they stay sharp.
 const big=fakeContext();drawWorldMap(big,view,{cx:0,cz:250,k:4},350,350);assert.equal(big.calls.filter(c=>c.op==='image').length,1);assert.ok(big.calls.some(c=>c.op==='arc'&&c.fill===COLORS.feature.pool));
 const out=fakeContext();drawWorldMap(out,view,presetCam('world',view,350,350),350,350);assert.equal(out.calls.filter(c=>c.op==='image').length,1);assert.ok(!out.calls.some(c=>c.op==='arc'&&c.fill===COLORS.feature.pool));
 cache.reset();assert.equal(cache.ready,false);assert.equal(cache.fills.size,0);
 // Where there is no canvas at all the cache gives up once, and the maps keep their flat shapes.
 const none=terrainCache(()=>null);assert.equal(none.step(view),false);assert.equal(none.dead,true);const flat=fakeContext();drawMinimap(flat,view,300);assert.equal(flat.calls.filter(c=>c.op==='image').length,0);assert.ok(flat.calls.some(c=>c.op==='arc'&&c.fill===COLORS.feature.pool),'and draw the features as shapes over them');
 assert.ok(new Terrain(()=>null) instanceof Terrain);
});
// The list F fills is wired into metrics().dens (main.mjs), and the view the maps read carries every den, cage and parked vehicle.
test('denStatuses is wired into metrics().dens and into the maps’ view',()=>{
 const main=readFileSync(new URL('../src/main.mjs',import.meta.url),'utf8');assert.match(main,/dens:denStatuses\(pandora\?\.wilds,denList\)/);assert.match(main,/\n denStatuses,\r?\n/);
 assert.match(main,/v\.dens=v\.pandora\?denStatuses\(pandora\?\.wilds,mapDens\):null;/);assert.match(main,/v\.cages=v\.pandora\?cageStatuses\(state,mapCages\):mapCages;/);assert.match(main,/v\.features=mapFeatures;/);assert.ok(!/drawFullMap|denLabel|denStatus\(/.test(main));
 const outdoors=readFileSync(new URL('../src/outdoors.mjs',import.meta.url),'utf8');assert.ok(outdoors.includes('m · tap to go home')&&!outdoors.includes("' km'"));
});
