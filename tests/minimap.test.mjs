// The round minimap (src/minimap.mjs): the projection, the reach, the rim, the caption, and what a frame draws.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {projection,mapRadius,beyondVillage,northSpot,northAngle,rimPoint,arrowTurn,mapCaption,drawMinimap,drawFullMap,denStatus,denLabel,compass,Minimap,RANGE,CREATURE_RANGE,COLORS} from '../src/minimap.mjs';
import {HOUSES,HOMES,ROADS,POND} from '../src/content.mjs';
import {CAMERA_YAW,VILLAGE} from '../src/field-layout.mjs';
import {ROOM,ROOMS,PANDORA_SPOT,SPAWN} from '../src/home-plan.mjs';
import {SAFE,DEN,Wilds,AI} from '../src/wilds.mjs';

const near=(a,b,eps=1e-6)=>Math.abs(a-b)<eps;
/** A 2D context that records what is drawn (arcs with the transform they were drawn under, fills, text). */
function fakeContext(){
 const calls=[],state={m:[1,0,0,1,0,0],fill:'',stack:[]};
 const mul=(a,b)=>[a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];
 const at=(x,y)=>({x:state.m[0]*x+state.m[2]*y+state.m[4],y:state.m[1]*x+state.m[3]*y+state.m[5]});
 const ctx={calls,
  save(){state.stack.push({m:[...state.m],fill:state.fill});},restore(){const s=state.stack.pop();if(s){state.m=s.m;state.fill=s.fill;}},
  setTransform(a,b,c,d,e,f){state.m=[a,b,c,d,e,f];},transform(a,b,c,d,e,f){state.m=mul(state.m,[a,b,c,d,e,f]);},translate(x,y){state.m=mul(state.m,[1,0,0,1,x,y]);},rotate(r){const c=Math.cos(r),s=Math.sin(r);state.m=mul(state.m,[c,s,-s,c,0,0]);},scale(x,y){state.m=mul(state.m,[x,0,0,y,0,0]);},
  clearRect(x,y,w,h){calls.push({op:'clear',w,h});},fillRect(x,y,w,h){calls.push({op:'rect',fill:state.fill,a:at(x,y),b:at(x+w,y+h),c:at(x+w/2,y+h/2)});},strokeRect(x,y,w,h){calls.push({op:'strokeRect',c:at(x+w/2,y+h/2)});},
  beginPath(){},closePath(){},moveTo(){},lineTo(){},clip(){calls.push({op:'clip'});},fill(){calls.push({op:'fill',fill:state.fill,at:at(0,0)});},stroke(){},setLineDash(d){calls.push({op:'dash',d});},
  arc(x,y,r){calls.push({op:'arc',fill:state.fill,p:at(x,y),r});},fillText(t,x,y){calls.push({op:'text',t,p:at(x,y)});},strokeText(){},
  set fillStyle(v){state.fill=v;},get fillStyle(){return state.fill;},strokeStyle:'',lineWidth:1,lineJoin:'',font:'',textAlign:'',textBaseline:'',
 };return ctx;
}
const village=(extra={})=>({place:'village',x:0,z:-8.8,facing:0,heading:CAMERA_YAW,pandora:false,beds:6,npcs:[],creatures:[],shops:[],residents:[],spots:[],...extra});

test('the projection: you at the centre, the top of the screen at the top of the map, metres to pixels and back',()=>{
 const P=projection({x:10,z:-4,heading:0,radius:50,size:300});
 assert.deepEqual(P.point(10,-4),{x:150,y:150});assert.equal(P.k,3);
 // North up when the camera looks straight north: east is right, north is up, the rim is `radius` metres away.
 assert.deepEqual(P.point(60,-4),{x:300,y:150});assert.deepEqual(P.point(10,-54),{x:150,y:0});assert.deepEqual(P.point(10,46),{x:150,y:300});
 // The village camera is turned by CAMERA_YAW: what is farther from the camera (up the screen) is up the map, and the
 // camera's right is the map's right. These are the directions the stick and the keys walk in (world.mjs update()).
 const yaw=CAMERA_YAW,Q=projection({x:3,z:7,heading:yaw,radius:46,size:300}),step=20;
 const up=Q.point(3-Math.sin(yaw)*step,7-Math.cos(yaw)*step),right=Q.point(3+Math.cos(yaw)*step,7-Math.sin(yaw)*step);
 assert.ok(near(up.x,150)&&near(up.y,150-step*Q.k),'walking up the screen goes up the map');assert.ok(near(right.x,150+step*Q.k)&&near(right.y,150),'walking right goes right');
 // Distances are kept (a rotation and a scale), the matrix is the same mapping, and world() undoes point().
 for(const [x,z] of [[0,0],[-52,40],[236,-204],[3.5,7.25]]){
  const p=Q.point(x,z);assert.ok(near(Math.hypot(p.x-150,p.y-150),Math.hypot(x-3,z-7)*Q.k,1e-6));
  const [a,b,c,d,e,f]=Q.matrix;assert.ok(near(a*x+c*z+e,p.x,1e-6)&&near(b*x+d*z+f,p.y,1e-6));
  const w=Q.world(p.x,p.y);assert.ok(near(w.x,x,1e-6)&&near(w.z,z,1e-6));
 }
 // point() can write into an object you give it (the draw loop makes no garbage).
 const out={x:0,y:0};assert.equal(Q.point(1,2,out),out);
 // North rides the rim: straight up indoors, turned by the camera's yaw outdoors, exactly where world north projects.
 assert.deepEqual(northSpot(0),{left:50,top:0});assert.equal(northAngle(yaw),yaw);
 const n=Q.point(3,7-46),spot=northSpot(yaw);assert.ok(near(n.x/3,spot.left,1e-6)&&near(n.y/3,spot.top,1e-6));assert.ok(spot.left>50&&spot.top<10,'north is up and a little to the right');
 // The arrow points where you walk: facing up the screen is an arrow pointing up, facing the camera points down.
 assert.ok(near(Math.cos(arrowTurn(yaw+Math.PI,yaw)),1));assert.ok(near(Math.cos(arrowTurn(yaw,yaw)),-1));assert.ok(near(Math.sin(arrowTurn(yaw+Math.PI/2,yaw)),1),'facing right: turned a quarter clockwise');
});
test('the reach: the village close up, opening with the distance in the fields, the whole house indoors',()=>{
 assert.equal(mapRadius('village',0,0),RANGE.village);assert.equal(mapRadius('village',55,-45),RANGE.village,'anywhere inside the village footprint');
 assert.equal(beyondVillage(VILLAGE.x1,VILLAGE.z1),0);assert.equal(beyondVillage(VILLAGE.x1+10,0),10);assert.equal(beyondVillage(VILLAGE.x0-10,0),10);assert.equal(beyondVillage(0,VILLAGE.z0-7),7);assert.ok(near(beyondVillage(VILLAGE.x1+3,VILLAGE.z1+4),5));
 // Out in the fields the map opens up, so the village edge stays on it; it never opens past RANGE.fields.
 let last=RANGE.village;for(let d=0;d<=300;d+=10){const r=mapRadius('village',VILLAGE.x1+d,0);assert.ok(r>=last&&r<=RANGE.fields);last=r;if(r<RANGE.fields)assert.ok(r>=d*.85,'the village edge is still within reach');}
 assert.equal(mapRadius('village',5000,5000),RANGE.fields);assert.equal(mapRadius('country',0,0),RANGE.country);
 // Indoors the map is the house: every corner is inside the circle, with a little room to spare.
 const R=mapRadius('interior'),P=projection({x:0,z:0,heading:0,radius:R,size:300});
 for(const [x,z] of [[-1,-1],[1,-1],[-1,1],[1,1]]){const p=P.point(x*ROOM.w/2,z*ROOM.d/2);assert.ok(Math.hypot(p.x-150,p.y-150)<150-4);}
 assert.ok(R<Math.hypot(ROOM.w,ROOM.d)/2+2,'and the house fills the circle');
});
test('the rim: home rides it when it is off the map, pointing the way back',()=>{
 const home=HOUSES[0],P=projection({x:300,z:-260,heading:CAMERA_YAW,radius:RANGE.fields,size:300});
 const r=rimPoint(P,home.x,home.z,20);assert.equal(r.off,true);assert.ok(near(Math.hypot(r.x-150,r.y-150),130));
 // The pointer's angle is the direction of home on the map (0 = up, clockwise).
 const raw=P.point(home.x,home.z);assert.ok(near(r.angle,Math.atan2(raw.x-150,-(raw.y-150))));assert.ok(near((r.x-150)/130,Math.sin(r.angle))&&near((r.y-150)/130,-Math.cos(r.angle)));
 // On the map it is left where it is.
 const here=rimPoint(projection({x:0,z:0,heading:0,radius:46,size:300}),home.x,home.z,20);assert.equal(here.off,false);assert.deepEqual({x:here.x,y:here.y},projection({x:0,z:0,heading:0,radius:46,size:300}).point(home.x,home.z));
});
test('the caption says where you are',()=>{
 assert.equal(mapCaption(village()),'WILLOWMERE');assert.equal(mapCaption(village({x:120,z:0})),'OPEN FIELDS');
 assert.equal(mapCaption(village({x:SAFE.x1+30,z:0,pandora:true})),'NEAR MEADOWS');assert.equal(mapCaption(village({x:SAFE.x1+120,z:0,pandora:true})),'FAR THICKETS');assert.equal(mapCaption(village({x:SAFE.x1-2,z:0,pandora:true})),'VILLAGE EDGE');assert.equal(mapCaption(village({x:VILLAGE.x1-1,z:0,pandora:true})),'WILLOWMERE');assert.equal(mapCaption(village({x:0,z:SAFE.z1+20,pandora:true})),'NEAR MEADOWS');assert.equal(mapCaption(village({x:0,z:60})),'OPEN FIELDS','the old south row is open fields now');
 assert.equal(mapCaption({place:'interior',house:HOUSES[0]}),'YOUR HOMESTEAD');assert.equal(mapCaption({place:'interior',house:HOUSES[1]}),HOUSES[1].name.toUpperCase());assert.equal(mapCaption({place:'country'}),'COUNTRY MARKET');
});
test('a frame is a clean circle: clipped, the village drawn in metres, markers on top, you in the middle',()=>{
 const ctx=fakeContext(),view=village({shops:[{id:'market',x:5.5,z:23.2}],npcs:[{x:4,z:2,hidden:false},{x:9,z:9,hidden:true}]});
 const P=drawMinimap(ctx,view,300);
 assert.equal(P.radius,RANGE.village);assert.equal(ctx.calls[0].op,'clear');
 // The mask is one circle that fills the canvas: the first arc, drawn at the centre, then a clip.
 const first=ctx.calls.find(c=>c.op==='arc');assert.ok(near(first.p.x,150)&&near(first.p.y,150)&&first.r>=149&&first.r<=150);assert.ok(ctx.calls.findIndex(c=>c.op==='clip')===ctx.calls.indexOf(first)+1);
 // The pond is a blue rectangle whose centre is where the projection puts the pond; the road is drawn; no ward (the box is shut).
 const pond=ctx.calls.find(c=>c.op==='rect'&&c.fill===COLORS.pond),at=P.point(POND.x,POND.z);assert.ok(near(pond.c.x,at.x,1e-6)&&near(pond.c.y,at.y,1e-6));
 assert.equal(ctx.calls.filter(c=>c.op==='rect'&&c.fill===COLORS.road).length,5);assert.equal(ctx.calls.filter(c=>c.op==='dash').length,0);
 const roadNorth=ctx.calls.find(c=>c.op==='rect'&&c.fill===COLORS.road),mid=P.point(0,ROADS.north);assert.ok(near(roadNorth.c.x,mid.x,1e-6)&&near(roadNorth.c.y,mid.y,1e-6));
 // Neighbours out of doors are dots; one who is indoors is not drawn.
 const dots=ctx.calls.filter(c=>c.op==='arc'&&c.fill===COLORS.neighbour);assert.equal(dots.length,1);const n=P.point(4,2);assert.ok(near(dots[0].p.x,n.x,1e-6)&&near(dots[0].p.y,n.y,1e-6));
 // With the box open: the ward line, creatures in reach as dots, a boss as far as the map reaches, the dead and the far left out.
 const wild=fakeContext(),foes=[{x:100,z:10,hp:40,boss:false,angry:false},{x:110,z:0,hp:40,boss:false,angry:true},{x:100+CREATURE_RANGE+5,z:0,hp:40,boss:false,angry:false},{x:105,z:5,hp:0,boss:false,angry:false},{x:100+CREATURE_RANGE+10,z:0,hp:800,boss:true,angry:false},{x:900,z:0,hp:800,boss:true,angry:false}];
 const W=drawMinimap(wild,village({x:100,z:0,pandora:true,creatures:foes}),300);
 assert.ok(W.radius>RANGE.village&&W.radius<RANGE.fields);assert.equal(wild.calls.filter(c=>c.op==='dash'&&c.d.length).length,1,'the ward is a dashed line');
 assert.equal(wild.calls.filter(c=>c.op==='arc'&&c.fill===COLORS.creature).length,1);assert.equal(wild.calls.filter(c=>c.op==='arc'&&c.fill===COLORS.angry).length,1);assert.equal(wild.calls.filter(c=>c.op==='arc'&&c.fill===COLORS.boss).length,1);
 assert.equal(wild.calls.filter(c=>c.op==='text'&&c.t==='♛').length,1);
 // Every marker lies inside the circle.
 for(const c of [...ctx.calls,...wild.calls])if(c.op==='arc'&&c.r<20)assert.ok(Math.hypot(c.p.x-150,c.p.y-150)<150);
});
test('indoors the map is the plan of the house, and the country market has its own',()=>{
 const ctx=fakeContext(),view={place:'interior',x:SPAWN.x,z:SPAWN.z,facing:Math.PI,heading:0,houseId:0,house:HOUSES[0],chest:PANDORA_SPOT,residents:[{x:6,z:-6.7},{x:7,z:6.2}],spots:[{x:-5.35,z:-4.85}],rooms:null};
 const P=drawMinimap(ctx,view,300);
 assert.equal(P.radius,RANGE.room);assert.equal(P.heading,0,'north up indoors');assert.equal(P.x,0,'centred on the house, not on you');
 // Five rooms in their colours, each where the plan has it; walls; the front door in green at the front wall.
 for(const room of ROOMS){const r=ctx.calls.find(c=>c.op==='rect'&&c.fill===COLORS.room[room.id]),at=P.point((room.rect.x0+room.rect.x1)/2,(room.rect.z0+room.rect.z1)/2);assert.ok(r&&near(r.c.x,at.x,1e-6)&&near(r.c.y,at.y,1e-6),room.id);}
 assert.ok(ctx.calls.filter(c=>c.op==='rect'&&c.fill===COLORS.wall).length>=12);
 const door=ctx.calls.find(c=>c.op==='rect'&&c.fill===COLORS.door),front=P.point(0,ROOM.d/2);assert.ok(near(door.c.x,front.x,1e-6)&&Math.abs(door.c.y-front.y)<4);
 // The family as dots, the things to use as small rings, the chest as a diamond (a path, so no arc).
 assert.equal(ctx.calls.filter(c=>c.op==='arc'&&c.fill===COLORS.neighbour).length,2);assert.equal(ctx.calls.filter(c=>c.op==='arc'&&c.fill==='#ffffff').length,1);
 assert.ok(ctx.calls.some(c=>c.op==='fill'&&c.fill===COLORS.chest));
 // A neighbour's house has no chest; other palettes are used when given.
 const other=fakeContext();drawMinimap(other,{...view,houseId:3,house:HOUSES[3],chest:null,rooms:{bedroom:'#111111',bath:'#222222',kitchen:'#333333',living:'#444444',nook:'#555555'}},300);
 assert.ok(!other.calls.some(c=>c.fill===COLORS.chest));assert.ok(other.calls.some(c=>c.op==='rect'&&c.fill==='#444444'));
 // The country market.
 const country=fakeContext(),C=drawMinimap(country,{place:'country',x:-18,z:0,facing:0,heading:CAMERA_YAW,shops:[{id:'country',x:8,z:-2}]},300);
 assert.equal(C.radius,RANGE.country);assert.ok(country.calls.some(c=>c.op==='rect'&&c.fill===COLORS.countryRoad));assert.ok(country.calls.some(c=>c.op==='fill'&&c.fill===COLORS.shop.country));
});
test('the full map shows the whole village north up and opens out to keep you on it',()=>{
 const ctx=fakeContext(),P=drawFullMap(ctx,village(),840,580);
 assert.equal(P.heading,0);
 // The whole village footprint is on the sheet (the sheet is 840 x 580, drawn through a centred square).
 const ox=(840-P.size)/2,oy=(580-P.size)/2;for(const [x,z] of [[SAFE.x0,SAFE.z0],[SAFE.x1,SAFE.z0],[SAFE.x0,SAFE.z1],[SAFE.x1,SAFE.z1]]){const p=P.point(x,z);assert.ok(p.x+ox>=0&&p.x+ox<=840&&p.y+oy>=0&&p.y+oy<=580,`${x},${z}`);}
 assert.ok(P.k>4.6,'the compact village is drawn larger than the old one (4.08 px a metre)');
 // Five family houses, the two family barns (Moss, Hearth), the four Town Square buildings and home are named; no house is drawn south of the ring.
 const names=ctx.calls.filter(c=>c.op==='text').map(c=>c.t);assert.deepEqual(names.sort(),['Alder','Bell','Clinic','Finch','Hearth','Home','Moss','Police','Reed','School','Vale','Willow & Co.'].sort());
 const houses=ctx.calls.filter(c=>c.op==='rect'&&HOMES.slice(1).some(h=>h.color===c.fill));assert.equal(houses.length,5);for(const h of houses)assert.ok(h.c.y+oy<P.point(0,ROADS.south).y+oy,'inside the ring');
 const far=drawFullMap(fakeContext(),village({x:400,z:0}),840,580),me=far.point(400,0);assert.ok(far.k<P.k);assert.ok(me.x+(840-far.size)/2<=840,'you are still on the sheet');
});
test('the minimap redraws eight times a second, eases its reach, and updates its badge and caption only when they change',()=>{
 const ctx=fakeContext(),style={left:'',top:''},caption={textContent:''};let view=village(),writes=0;
 const north={style:new Proxy(style,{set(t,k,v){t[k]=v;writes++;return true;}})};
 const map=new Minimap({width:300,height:300,getContext:()=>ctx},{north,caption},()=>view);
 assert.equal(map.frame(.016),true);assert.equal(map.draws,1);assert.equal(caption.textContent,'WILLOWMERE');assert.equal(writes,2);
 assert.match(style.left,/^calc\(6\d\.\d+% - 10px\)$/);assert.match(style.top,/^calc\(\d\.\d+% - 10px\)$/);
 for(let i=0;i<5;i++)assert.equal(map.frame(.016),false);assert.equal(map.draws,1,'not every frame');
 assert.equal(map.frame(.06),true);assert.equal(writes,2,'the badge is not written again');
 // Walking out into the fields: the reach eases toward its target instead of jumping.
 view=village({x:200,z:0});map.invalidate();map.frame(0);assert.ok(map.radius>RANGE.village&&map.radius<RANGE.fields);for(let i=0;i<40;i++){map.invalidate();map.frame(0);}assert.equal(map.radius,RANGE.fields);assert.equal(caption.textContent,'OPEN FIELDS');
 // Going indoors snaps (a new place), turns north up, and names the house.
 view={place:'interior',x:0,z:6,facing:0,heading:0,house:HOUSES[0]};map.invalidate();map.frame(0);assert.equal(map.radius,RANGE.room);assert.equal(style.left,'calc(50.00% - 10px)');assert.equal(style.top,'calc(0.00% - 10px)');assert.equal(caption.textContent,'YOUR HOMESTEAD');
 // No view yet (the world is still loading): nothing is drawn, nothing breaks.
 const idle=new Minimap({width:300,height:300,getContext:()=>ctx},{},()=>null);assert.equal(idle.frame(1),false);
});
test('the stylesheet keeps the canvas a true circle (the old square-card rule squeezed it into a rounded rectangle)',()=>{
 const css=readFileSync(new URL('../src/hud-reference.css',import.meta.url),'utf8'),rule=css.match(/\.minimap #map-canvas \{([^}]*)\}/)?.[1]??'';
 assert.match(rule,/width: 100%/);assert.match(rule,/height: 100%/);assert.match(rule,/aspect-ratio: 1\b/);assert.match(rule,/border-radius: 50%/);
 // The id selector outranks style.css's own #map-canvas rules (one id against one id plus a class).
 const old=readFileSync(new URL('../src/style.css',import.meta.url),'utf8');assert.ok(/#map-canvas\{[^}]*aspect-ratio:320\/260/.test(old),'the old rule is still there, and still loses');
 const main=readFileSync(new URL('../src/main.mjs',import.meta.url),'utf8');assert.ok(main.indexOf("import './style.css'")<main.indexOf("import './hud-reference.css'"));
});
test('the King Bear on the map: a crown on the rim toward his den while the box is open, on his spot when the map reaches him, faint while he is down',()=>{
 // Shut: no crown anywhere, whatever the view carries.
 const shut=fakeContext();drawMinimap(shut,village({den:{x:DEN.x,z:DEN.z,down:false,left:0}}),300);assert.equal(shut.calls.filter(c=>c.op==='text'&&c.t==='♛').length,0);
 // Open, in the village: the den is far beyond the map, so the crown rides the rim in its direction (north-east), with a dart.
 const ctx=fakeContext(),view=village({pandora:true,den:{x:DEN.x,z:DEN.z,down:false,left:0}}),P=drawMinimap(ctx,view,300);
 const crown=ctx.calls.find(c=>c.op==='text'&&c.t==='♛'),disc=ctx.calls.find(c=>c.op==='arc'&&c.fill===COLORS.boss);assert.ok(crown&&disc,'a crown on a dark disc');
 const raw=P.point(DEN.x,DEN.z),want=Math.atan2(raw.x-150,-(raw.y-150)),got=Math.atan2(disc.p.x-150,-(disc.p.y-150));assert.ok(near(want,got,1e-6),'on the rim, in the direction of the den');
 assert.ok(near(Math.hypot(disc.p.x-150,disc.p.y-150),150-6.5*3,1e-6));assert.ok(disc.p.x>150&&disc.p.y<150,'north-east is up and to the right');
 assert.ok(ctx.calls.some(c=>c.op==='fill'&&c.fill===COLORS.boss&&Math.hypot(c.at.x-disc.p.x,c.at.y-disc.p.y)<1e-6),'a dart points outward from it');
 // Home is on the map here, on its own spot.
 assert.equal(rimPoint(P,HOUSES[0].x,HOUSES[0].z,19.5).off,false);
 // Near the den the crown is on the den itself, and no dart is drawn.
 const close=fakeContext(),Q=drawMinimap(close,village({x:DEN.x-30,z:DEN.z+20,pandora:true,den:{x:DEN.x,z:DEN.z,down:false,left:0}}),300),there=Q.point(DEN.x,DEN.z),on=close.calls.find(c=>c.op==='arc'&&c.fill===COLORS.boss);
 assert.ok(near(on.p.x,there.x,1e-6)&&near(on.p.y,there.y,1e-6));assert.equal(close.calls.filter(c=>c.op==='fill'&&c.fill===COLORS.boss).length,1,'only the disc: no dart');
 // The bear himself is not drawn twice when the view names the den.
 const both=fakeContext();drawMinimap(both,village({x:DEN.x-30,z:DEN.z+20,pandora:true,den:{x:DEN.x-8,z:DEN.z,down:false,left:0},creatures:[{x:DEN.x-8,z:DEN.z,hp:800,boss:true,angry:true}]}),300);assert.equal(both.calls.filter(c=>c.op==='text'&&c.t==='♛').length,1);
 // Down: a grey, faint crown instead of the dark one.
 const down=fakeContext();drawMinimap(down,village({pandora:true,den:{x:DEN.x,z:DEN.z,down:true,left:42}}),300);
 assert.ok(down.calls.some(c=>c.op==='arc'&&c.fill===COLORS.bossDown));assert.ok(!down.calls.some(c=>c.op==='arc'&&c.fill===COLORS.boss));assert.equal(down.calls.filter(c=>c.op==='text'&&c.t==='♛').length,1);
});
test('the King Bear for the map comes from the creature simulation: alive, down with a timer, or far away and unloaded',()=>{
 // Nothing loaded (you are in the village): he is at his den, alive.
 const wilds=new Wilds({},()=>.5);assert.deepEqual(denStatus(wilds),{x:DEN.x,z:DEN.z,down:false,left:0});assert.deepEqual(denStatus(undefined),{x:DEN.x,z:DEN.z,down:false,left:0});
 // Loaded and alive: the crown follows the bear himself.
 wilds.sync(true,DEN.x+10,DEN.z);const bear=wilds.list.find(e=>e.id==='w:den');assert.ok(bear);bear.x+=6;assert.deepEqual(denStatus(wilds),{x:DEN.x+6,z:DEN.z,down:false,left:0});
 // Defeated: down, with the seconds until he is back; the crown returns to the den.
 wilds.hit(bear,9999);const s=denStatus(wilds);assert.equal(s.down,true);assert.equal(s.left,AI.bossRespawn);assert.deepEqual([s.x,s.z],[DEN.x,DEN.z]);
 // You walk away (his cell unloads): the timer keeps counting on the clock of the simulation.
 wilds.time+=30;bear.respawn-=30;wilds.sync(true,0,0);assert.equal(wilds.list.some(e=>e.id==='w:den'),false);const far=denStatus(wilds);assert.equal(far.down,true);assert.ok(near(far.left,AI.bossRespawn-30));
 wilds.time+=AI.bossRespawn;assert.equal(denStatus(wilds).down,false,'back when the time is up');
 // The same object can be reused (no garbage each map frame).
 const out={x:0,z:0,down:true,left:9};assert.equal(denStatus(wilds,out),out);assert.equal(out.down,false);
});
test('the full map shows the den with its distance and direction, only while the box is open',()=>{
 assert.equal(compass(1,-1),'north-east');assert.equal(compass(0,-1),'north');assert.equal(compass(1,0),'east');assert.equal(compass(0,1),'south');assert.equal(compass(-1,1),'south-west');assert.equal(compass(-1,0),'west');
 const den={x:DEN.x,z:DEN.z,down:false,left:0},far=Math.round(Math.hypot(DEN.x,DEN.z+8.8));
 assert.equal(denLabel(village({pandora:true,den})),`King Bear · ${far} m north-east`);assert.equal(denLabel(village({pandora:true,den:null})),'');
 assert.equal(denLabel(village({pandora:true,den:{...den,down:true,left:64.2}})),`King Bear · resting, back in 1:05 · ${far} m north-east`);
 assert.equal(denLabel(village({x:DEN.x+3,z:DEN.z-4,pandora:true,den})),'King Bear · right here');
 // Indoors the distance is measured from the door you came in by, not from where you stand in the room.
 assert.equal(denLabel({place:'interior',x:3,z:6,pandora:true,den,outside:{x:0,z:-8.8}}),`King Bear · ${far} m north-east`);
 // Shut: nothing. Open: a crown at the edge of the sheet toward the den, a dart, and the label beside it, all on the sheet.
 const shut=fakeContext();drawFullMap(shut,village({den}),840,580);assert.ok(!shut.calls.some(c=>c.op==='text'&&/King Bear|♛/.test(c.t)));
 const ctx=fakeContext(),P=drawFullMap(ctx,village({pandora:true,den}),840,580);
 const crown=ctx.calls.find(c=>c.op==='text'&&c.t==='♛'),label=ctx.calls.find(c=>c.op==='text'&&/^King Bear/.test(c.t));assert.ok(crown&&label);assert.equal(label.t,`King Bear · ${far} m north-east`);
 assert.ok(crown.p.x>=0&&crown.p.x<=840&&crown.p.y>=0&&crown.p.y<=580,'the crown is on the sheet');assert.ok(crown.p.x>640&&crown.p.y<120,'at its north-east corner');
 assert.ok(label.p.x<crown.p.x,'the label is to its left, on the sheet');assert.ok(ctx.calls.some(c=>c.op==='dash'&&c.d.length),'and the ward is drawn');
 // The sheet opens out to keep you on it: once you are past the den, the crown is on the den itself.
 const near2=fakeContext(),Q=drawFullMap(near2,village({x:DEN.x+30,z:DEN.z-30,pandora:true,den}),840,580),at=Q.point(DEN.x,DEN.z),c2=near2.calls.find(c=>c.op==='arc'&&c.fill===COLORS.boss);
 assert.ok(near(c2.p.x,at.x+(840-Q.size)/2,1e-6)&&near(c2.p.y,at.y+(580-Q.size)/2,1e-6));
});
