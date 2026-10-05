// The HUD's words for where you are (src/wake.mjs, round 8 fix): the Begin toast, the idle action button and the location line
// name the region you are in out in the wilds, and keep the village's words at home.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {wakeGreeting,idleLabel,locationLine,WELCOME,REDRAWN,FAR} from '../src/wake.mjs';
import {REGION,DENS,shapeOf,regionAt} from '../src/regions.mjs';
import {STAND} from './stands.mjs';
import {wildDepth,SAFE} from '../src/ward.mjs';
const HOME={magic:+/export const HOME=\{magic:([\d.]+)/.exec(readFileSync(new URL('../src/world.mjs',import.meta.url),'utf8'))[1]};

test('the Begin toast welcomes you home in the village and names the land you wake in far out',()=>{
 assert.equal(FAR,HOME.magic,'the same line as the magic hop home');
 // A new save, the homestead, just outside the ward, indoors: the village welcome.
 assert.equal(wakeGreeting({fresh:true,x:157,z:-21}),WELCOME,'a new save is always welcomed home'); assert.equal(wakeGreeting({moved:true,x:90,z:-83}),REDRAWN,'an old save moved into the rings is told so'); assert.equal(wakeGreeting({fresh:true,moved:true}),WELCOME);
 assert.equal(wakeGreeting({x:0,z:-8}),WELCOME);
 assert.equal(wakeGreeting({x:SAFE.x1+10,z:0}),WELCOME,'10 m beyond the ward: still home');
 assert.equal(wakeGreeting({location:'interior',x:157,z:-21}),WELCOME);
 // Every region's square centre and every den: the region's name, never "Welcome home".
 for(const id of Object.keys(REGION)){if(id==='village')continue;const s=shapeOf(id),x=s.cx,z=s.cz;
  if(wildDepth(x,z)<FAR)continue;const line=wakeGreeting({x,z});assert.equal(line,`Back in ${REGION[regionAt(x,z)].name}. Home is one tap away.`,id);assert.doesNotMatch(line,/Welcome home|Ada/);}
 for(const d of DENS)assert.match(wakeGreeting({x:d.x,z:d.z+9}),new RegExp(`^Back in ${REGION[d.region].name}`),d.id);
 // The review's spots: a box-shut save in the Redrock Canyon, and the jeep parked 250 m out.
 assert.equal(wakeGreeting({x:STAND.east[0],z:STAND.east[1]}),'Back in Redrock Canyon. Home is one tap away.');
 assert.equal(wakeGreeting({x:STAND.shadow[0],z:STAND.shadow[1],riding:'jeep'}),'Back in Night Land, in the jeep. Home is one tap away.');
 assert.equal(wakeGreeting({x:STAND.lava[0],z:STAND.lava[1],riding:'bike'}),'Back in Ember Fields, in the motorcycle. Home is one tap away.');
});
test('with nothing in reach the action button says the village at home and the region out in the wilds',()=>{
 assert.equal(idleLabel({x:0,z:0}),'Explore your village');
 assert.equal(idleLabel({x:62.4,z:0}),'Explore your village','the gate road is still the village');assert.equal(idleLabel({x:SAFE.x1+FAR+1,z:-10}),'Explore Redrock Canyon','where Home becomes a hop, the land’s name');
 assert.equal(idleLabel({location:'interior',x:200,z:0}),'Look around the house');
 assert.equal(idleLabel({x:STAND.lava[0],z:STAND.lava[1]}),'Explore Ember Fields');
 assert.equal(idleLabel({x:STAND.shadow[0],z:STAND.shadow[1]}),'Explore Night Land');
 assert.equal(idleLabel({x:STAND.west[0],z:STAND.west[1]}),'Explore Mushroom Forest');
 for(const d of DENS)assert.doesNotMatch(idleLabel({x:d.x,z:d.z}),/village/,d.id);
});
test('the location line (spec 5): Willowmere inside the ward, the region and the way home outside it, decided by inWilds',()=>{
 assert.equal(locationLine({x:0,z:-8}),'Willowmere · home, at last');
 assert.equal(locationLine({x:STAND.east[0],z:STAND.east[1]}),'Redrock Canyon · follow the birds home','the review’s repro');
 assert.equal(locationLine({x:STAND.north[0],z:STAND.north[1]}),'Chomper Swamp · follow the birds home','the spec’s example');
 assert.equal(locationLine({x:SAFE.x0-1,z:10}),'Mushroom Forest · follow the birds home','one step outside the ward is the wilds');
 assert.equal(locationLine({x:500,z:500}),'Beyond the map');
 assert.equal(locationLine({x:10,z:0,riding:'jeep'}),'A little drive · Bell family jeep');
 assert.equal(locationLine({x:5,z:-6,riding:'bike'}),'A little drive · motorcycle');
 assert.equal(locationLine({x:STAND.shadow[0],z:STAND.shadow[1],riding:'jeep'}),'Night Land · Bell family jeep');
 for(const id of Object.keys(REGION))if(id!=='village'){const s=shapeOf(id);assert.match(locationLine({x:s.cx,z:s.cz}),new RegExp(`^${REGION[id].name} · `),id);assert.doesNotMatch(locationLine({x:s.cx,z:s.cz}),/Open fields/);}
});
test('main.mjs reads these words, and no village wording is typed in its HUD any more',()=>{
 const main=readFileSync(new URL('../src/main.mjs',import.meta.url),'utf8');
 assert.match(main,/toast\(wakeGreeting\(\{fresh,/);assert.match(main,/idleLabel\(\{location:world\.location/);assert.match(main,/locationLine\(\{x:at\.x,z:at\.z,riding:/);
 assert.doesNotMatch(main,/Open fields · follow the birds/);assert.doesNotMatch(main,/toast\('Welcome home\. Meet Ada/);
});
