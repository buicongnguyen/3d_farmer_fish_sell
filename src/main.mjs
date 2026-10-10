import './style.css';
import {TALES,taleList,taleEvent,taleSpot} from './tales.mjs';
import './tales.css';
import './shop-interior.css';
import './hud-reference.css';
import './menus-reference.css';
import {renderShop,installShopPreview} from './shop-view.mjs';
import './decor.css';
import './looks.css';
import {installDock} from './dock.mjs';
import {outfitColour,outfitOf,outfitKey} from './outfits.mjs';
import {ui as garments} from './garments.mjs';
import {installHouseLife} from './house-life.mjs';
import {installRoomView} from './room-view.mjs';
import {collectionLog} from './house-rules.mjs';
import {bagHtml} from './bag-view.mjs';
import {
 Minimap,
 denStatuses,
} from './minimap.mjs';
import {PALETTES} from './interior.mjs';
import {PANDORA_SPOT} from './home-plan.mjs';
import {aggro} from './wilds.mjs';
import {installOutdoors} from './outdoors.mjs'; // pen animals, driving, streaming at speed, render diagnostics (round 7)
import {audio} from './audio-ctx.mjs';
let pandora=null; // the Pandora box: wild creatures and fights (pandora-view.mjs)
import {friendsLine,cageStatuses} from './friends.mjs';
import {hutStatuses,peopleHtml,civicPerk} from './rescued.mjs';
import {regionAt,borderDistance} from './regions.mjs';
import {wakeGreeting,idleLabel,locationLine} from './wake.mjs'; // the HUD's words for where you are: the region out in the wilds, the village at home (round 8 fix)
// Round 8's own sheets, one per builder (empty in step 0), before the thumb controls and what stacks above them.
import './regions.css';
import './lands.css';
import './travel.css';
import './titans.css';
import './friends.css';
import './maps.css';
import './controls.css'; // thumb controls on touch screens (loaded last): the stick, ACT, the skill arc and what stacks above them
import {World} from './world.mjs';
import {packBankCatch} from './bank-catch.mjs';
import {FishingSimulation} from './fishing.mjs';
import {castPlan,atBank,shorePoint,FISH_POOLS,fishingPond,fishPool} from './pond.mjs';
import './fishing-simple.css'; // the round Reel button and its one-line hint (after controls.css: it sits where ACT does on a phone)
import {drawKeeping,forget as forgetScroll} from './panel-scroll.mjs';
import {CROPS,ITEMS,TREES,OUTFITS,KID_OUTFITS,FURNITURE,UPGRADES,RECIPES,RESIDENTS,HOUSES,CIVIC,JOBS,POND,FISH_SPOT,CHAPTERS,RACE_POINTS,BED_POSITIONS,ORCHARD_POSITIONS,iconUrl} from './content.mjs';
import {load,save,parseSave,act,knownAction,tick,calendar,bedCount,ripe,cropProgress,currentChapter,chapterReady,itemName,sellPrice,CIVIC_ACTS,SUBJECTS,plotCost,CHOP_COST,LESSON_CAP,treeReady} from './game.mjs';
import {promptFor,JEEP_SALES,EFFORT} from './prompts.mjs';
import {grovePanel,groveArg,chopRoom} from './grove.mjs';
import { hyp } from './hyp.mjs';
import {profileStore} from './profiles.mjs';

const paths={leaf:'M12 21v-9M12 15C2 15 3 4 3 4c10 0 9 11 9 11M12 11s-1-9 9-9c0 9-9 9-9 9',bag:'M5 7h14l2 14H3L5 7Zm3 0V5a4 4 0 0 1 8 0v2',book:'M12 5C7 2 2 3 2 3v16s5-1 10 2c5-3 10-2 10-2V3s-5-1-10 2v16',people:'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M17 4a4 4 0 0 1 0 7M22 21v-2a4 4 0 0 0-3-3.87',map:'m1 6 7-4 8 4 7-4v16l-7 4-8-4-7 4V6Zm7-4v16M16 6v16',sun:'M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M5 19l1.5-1.5M17.5 6.5 19 5M17 12a5 5 0 1 1-10 0 5 5 0 0 1 10 0',coin:'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0M12 6v12M15 8h-4a2 2 0 0 0 0 4h2a2 2 0 0 1 0 4H9',heart:'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z',settings:'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2',home:'m3 11 9-8 9 8M5 9v12h14V9M9 21v-7h6v7',fish:'M19 12c-5-9-14-7-17 0 3 7 12 9 17 0Zm0 0 4-5v10l-4-5M7 10v.01',arrow:'M5 12h14M13 6l6 6-6 6',check:'m5 12 4 4L19 6',close:'m6 6 12 12M6 18 18 6',help:'M9 8a3 3 0 0 1 6 0c0 2-3 2-3 5M12 17v.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',sound:'m11 5-6 4H2v6h3l6 4V5ZM15 8c3 2 3 6 0 8M18 5c5 4 5 10 0 14',shop:'m3 9 2-6h14l2 6M3 9v3a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0V9M5 15v6h14v-6M9 21v-5h6v5',star:'m12 2 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1 3-6',tool:'m14 5 5-3-1 5-4 4-3-3L3 16a3 3 0 0 0 4 4l8-8M5 18v.01',clock:'M12 7v5l3 2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0'};
const icon=(id,cls='')=>`<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[id]??paths.leaf}"/></svg>`;
const $=id=>document.getElementById(id);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const img=(id,cls='item-art')=>{const item=ITEMS[id]??CROPS[id?.replace('seed_','')];return item?.img?`<img class="${cls}" src="${item.img}" alt="">`:item?.icon?`<img class="${cls}" src="${iconUrl(item.icon)}" alt="" loading="lazy">`:`<span class="emoji-art">${item?.emoji??'🌿'}</span>`;};
const btn=(text,action,data='',cls='')=>`<button class="${cls}" data-action="${action}" ${data}>${text}</button>`;
const profileStorage=profileStore(localStorage),loaded=load(profileStorage);let localizeText=s=>s,profilesUi,state=loaded.state,world,decor,dock,mirror,wardrobe,panel=null,panelArg=null,fishing=null,hunting=null,race=null,toastTimeout,lastFocused,saveFailed=false,booted=false,frameTimes=[];
let music=null;
function chime(good=true){if(!state.settings.sound)return;try{const audioContext=audio();audioContext.resume();music?.duck(-2,.35);const o=audioContext.createOscillator(),g=audioContext.createGain();o.type='sine';o.frequency.setValueAtTime(good?523:230,audioContext.currentTime);o.frequency.exponentialRampToValueAtTime(good?784:180,audioContext.currentTime+.13);g.gain.setValueAtTime(.06,audioContext.currentTime);g.gain.exponentialRampToValueAtTime(.001,audioContext.currentTime+.3);o.connect(g).connect(audioContext.destination);o.start();o.stop(audioContext.currentTime+.32);}catch{}}
// index.html saves through this before it reloads a page whose game files were replaced by a newer release.
window.__wmSave=()=>persist();
function persist(){if(world?.player&&world.state===state)packBankCatch(state,world.player.position,world.location,!!world.riding);const ok=save(state,profileStorage);if(!ok&&!saveFailed){saveFailed=true;toast('Saving is unavailable in this browser. Export your save from Settings.');}return ok;}
function toast(message){if(!message)return;$('toast').textContent=message;$('toast').classList.add('show');clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>$('toast').classList.remove('show'),4500);}

$('app').innerHTML=`
 <canvas id="game" aria-label="Willowmere 3D village. Move with WASD or arrow keys and interact with E."></canvas>
 <div id="vignette"></div>
 <header id="brand"><span class="brand-mark">${icon('leaf')}</span><div><h1>Willowmere<span>™</span></h1><p>A FAMILY’S SEASONS</p></div></header>
 <header class="player-card"><button class="avatar" data-action="open" data-panel="journal" aria-label="Family album"><img id="avatar-img" alt="" hidden><span id="avatar-emoji">🌱</span><b id="level-badge">1</b></button><div class="player-details"><div class="player-name"><strong id="player-name">Rowan</strong><span id="level-text">Leader · Lv. 1</span></div><div class="meter health stamina"><div id="energy-fill"></div><span><b id="energy">100</b>&nbsp;/ 100</span></div><div class="meter experience"><div id="xp-fill"></div><span id="xp-text">ALBUM 0 / 3</span></div><div class="location"><span class="location-dot"></span><span id="location-text">Your little corner of the world</span></div></div></header>
 <nav class="top-actions" aria-label="Game menu"><div class="energy coins-pill" title="Coins"><span>$</span><b id="coins">160</b></div>${[['bag','🧺','Basket · I'],['journal','📖','Family album · J'],['people','👥','Neighbours · N'],['map','🗺️','Village map · M'],['help','?','How to play'],['settings','⚙','Settings']].map(([p,glyph,title])=>`<button class="icon-button" data-action="open" data-panel="${p}" title="${title}" aria-label="${title.split(' · ')[0]}">${glyph}</button>`).join('')}</nav>
 <button class="minimap" data-action="openMap" aria-label="Open the village map"><canvas id="map-canvas" width="300" height="300"></canvas><span id="map-north">N</span><small id="map-caption">WILLOWMERE</small></button>
 <div class="tracker-stack"><div id="calendar" class="tracker-chip day-chip"><span id="weather-icon">${icon('sun')}</span><strong id="date"></strong><small id="clock"></small><span id="year"></span></div><aside class="quest-tracker"><button id="quest" data-action="open" data-panel="journal"></button></aside></div>
 <div id="hint"></div>
 <div id="action-wrap"><button id="interact" data-action="interact"><kbd>E</kbd><span>Explore your village</span>${icon('arrow')}</button><small id="move-tip">WASD to wander · click to walk · scroll or pinch to zoom</small></div>
 <button class="home-button" data-action="walkHome" title="Home" aria-label="Home">⌂ <span>Home</span></button>
 <button id="home-guide" class="paper" data-action="walkHome" hidden aria-label="Home: back to the village"><span id="home-arrow" aria-hidden="true">↑</span><span><b>Way back home</b><small id="home-distance"><span id="home-metres"></span><span class="home-tap"> · tap to go home</span></small></span></button>
 <div id="toast" role="status" aria-live="polite"></div>
 <div id="touch-controls"><div id="joystick" aria-label="Movement joystick"><i></i><span>MOVE</span></div><button id="touch-action" data-action="interact" aria-label="Interact">${icon('leaf')}<span>ACT</span></button></div>
 <button id="reel-button" class="reel-hud" data-action="reel" hidden><span class="reel-icon" aria-hidden="true">🎣</span><span id="reel-text">Reel</span></button><div id="fish-hint" role="status" hidden></div>
 <div id="race-hud" class="paper" hidden></div>
 <div id="welcome"><div class="welcome-card"><span class="eyebrow">A LITTLE VILLAGE. A LONG FAMILY STORY.</span><h2>Good things<br>take <em>root.</em></h2><p>A key to the old house. A handful of seeds.<br>And a whole village waiting to welcome you home.</p><div class="welcome-features"><span>${icon('leaf')} Grow a garden</span><span>${icon('fish')} Find your quiet</span><span>${icon('home')} Make a home</span></div><div id="profile-picker"></div><button id="begin" data-action="begin" disabled>Preparing your village… <span id="loading-percent">0%</span></button><div class="load-track"><i id="load-fill"></i></div><small>Farming, fishing & the lovely little things in between.</small><p class="save-note" id="save-note"></p></div><div class="welcome-caption"><i></i> YOUR STORY BEGINS IN WILLOWMERE</div></div>
 <div id="modal-backdrop" hidden><section id="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" tabindex="-1"></section></div>
 <div id="activity" hidden></div>
 <input id="import-file" type="file" accept="application/json,.json" hidden>
`;

function hud(){
 if(!booted)return;
 const c=calendar(state);
 $('date').textContent=`${c.season}, day ${c.day}`;
 $('clock').textContent=`${String(Math.floor(state.time)).padStart(2,'0')}:${String(Math.floor(state.time%1*60/10)*10).padStart(2,'0')} · ${c.rain?'Gentle rain':state.time>=18?'Golden evening':'A lovely day'}`;
 $('year').textContent=`YEAR ${c.year}`;
 $('coins').textContent=state.coins.toLocaleString();
 $('energy').textContent=Math.floor(state.energy);
 $('energy-fill').style.width=state.energy+'%';
 const chapter=currentChapter(state),ready=chapterReady(state);
 const goals=chapter?.goals??[],done=goals.filter(([,check])=>check(state)).length,pct=goals.length?done/goals.length*100:100;
 $('quest').innerHTML=chapter?`<span class="eyebrow">FAMILY ALBUM <span>${state.chapter+1} / 8</span></span><span class="quest-row"><span class="quest-icon">${ready?'✨':'📖'}</span><span><strong>${chapter.title}</strong><small>${ready?'A memory is ready to keep':goals.find(([,check])=>!check(state))?.[0]}</small></span><span class="chevron">›</span></span><span class="quest-progress"><i style="width:${pct}%"></i></span>`:`<span class="eyebrow">A STORY STILL GROWING</span><span class="quest-row"><span class="quest-icon">🌱</span><span><strong>The next chapter is yours.</strong><small>Enjoy life in Willowmere.</small></span></span>`;
 $('level-badge').textContent=state.chapter+1;
 $('level-text').textContent=`Leader · Lv. ${state.chapter+1}`;
 $('xp-fill').style.width=pct+'%';
 $('xp-text').textContent=chapter?`ALBUM ${done} / ${goals.length}`:'ALBUM COMPLETE';
 if(world.portraitUrl&&$('avatar-img').dataset.src!==world.portraitUrl){$('avatar-img').src=world.portraitUrl;$('avatar-img').dataset.src=world.portraitUrl;$('avatar-img').hidden=false;$('avatar-emoji').hidden=true;}
 // The prompt pill tells the truth about this moment (prompts.mjs): what the thing in reach does now, or why it has to wait.
 const near=world.nearest(),prompt=promptFor(state,near,{home:world.houseId===0,touch:matchMedia('(pointer: coarse)').matches}),waiting=!!prompt?.wait;
 $('interact').disabled=!near;
 $('interact').classList.toggle('waiting',waiting);
 const at=world.player.position;
 $('interact').querySelector('span').textContent=prompt?.label||idleLabel({location:world.location,x:at.x,z:at.z});
 $('touch-action').classList.toggle('available',!!near&&!waiting);
 $('touch-action').classList.toggle('waiting',waiting);
 document.body.classList.toggle('indoors',world.location==='interior');
 $('location-text').textContent=world.location==='interior'?(world.facility?.name??HOUSES[world.houseId].name):locationLine({x:at.x,z:at.z,riding:world.riding?.id??''});
 const guide=world.homeGuide;
 $('home-guide').hidden=!guide.visible;
 $('home-arrow').style.transform=`rotate(${guide.angle}deg)`;
 $('home-metres').textContent=`${Math.round(guide.distance)} m`; // " · tap to go home" is its own span: a portrait phone shows the arrow and the metres only (hud-reference.css)
 const r=$('race-hud');
 r.hidden=!race;
 if(race)r.innerHTML=`${icon('star')} <b>Village run · ${race.next}/3</b><span>${race.elapsed.toFixed(1)}s / 60s</span>${btn('Cancel','cancelRace')}`;
 world.sync();
}
// The round minimap and the full map (minimap.mjs) read the world through this view; its lists are reused between draws.
let minimap=null;const mapData={npcs:[],creatures:[],shops:[],residents:[],spots:[]},MAP_SPOTS=['bedroom','kitchen','wardrobe','mirror'],mapDens=[],mapCages=[],mapHuts=[],mapCars=[],mapFeatures=id=>world.lands?.mapFeatures(id)??[];let worldMap=null,worldMapLoad=null;
// The Map window (world-map.mjs and its sheet, builder F) is fetched with import() straight after boot, not before the first frame (spec 17.3).
const loadWorldMap=()=>worldMapLoad??=import('./world-map.mjs').then(m=>worldMap??=m.installWorldMap($('modal'),mapView)).catch(error=>{worldMapLoad=null;console.warn('The map could not load.',error);});
const mapList=(list,n)=>{while(list.length<n)list.push({x:0,z:0});list.length=n;return list;};
function mapView(){
 const p=world.player.position,place=world.location,indoor=place==='interior',v=mapData;
 v.place=place;
 v.x=p.x;
 v.z=p.z;
 v.facing=world.player.rotation.y;
 v.heading=indoor?0:world.yaw;
 v.pandora=state.pandora===true;
 v.beds=bedCount(state);
 v.houseId=world.houseId;
 v.house=indoor?world.facility??HOUSES[world.houseId]:null;
 v.plan=world.facility?.plan??null;
 v.rooms=indoor?world.facility?world.facility.plan.palette.walls:PALETTES[world.houseId%PALETTES.length]?.walls:null;
 v.chest=indoor&&world.houseId===0?PANDORA_SPOT:null;
 let n=0;
 if(place==='village'){mapList(v.npcs,world.npcs.length);for(const npc of world.npcs){const o=v.npcs[n++];o.x=npc.mesh.position.x;o.z=npc.mesh.position.z;o.hidden=npc.inside;}}else v.npcs.length=0;
 v.dens=v.pandora?denStatuses(pandora?.wilds,mapDens):null; // every boss and titan: crowns on the maps while the box is open
 v.cages=v.pandora?cageStatuses(state,mapCages):mapCages; // the prisons: a badge on their boss's crown
 if(!v.pandora)mapCages.length=0;
 v.huts=hutStatuses(state,mapHuts); // the rescue huts (rescued.mjs): a little house, barred, open or empty; none while the box is shut
 v.defeated=state.defeated;
 v.features=mapFeatures;
 mapCars.length=0;
 for(const car of world.vehicles)if(car.mesh.visible&&world.riding!==car)mapCars.push({id:car.id,x:car.mesh.position.x,z:car.mesh.position.z});
 v.vehicles=mapCars;
 v.outside=place==='village'?null:world.returnPosition??HOUSES[0]; // indoors: distances on the Map are measured from the door you came in by
 const foes=v.pandora&&place==='village'?pandora?.wilds.list??[]:[];
 mapList(v.creatures,foes.length);
 for(let i=0;i<foes.length;i++){const e=foes[i],o=v.creatures[i];o.x=e.x;o.z=e.z;o.hp=e.leaving>0?0:e.hp;o.boss=e.def.boss;o.den=e.id.startsWith('w:den:');o.angry=aggro(e);}
 v.shops.length=0;
 v.spots.length=0;
 for(const t of world.targets){if(t.location!==place)continue;if(t.type==='shop')v.shops.push(t);else if(indoor&&MAP_SPOTS.includes(t.type))v.spots.push(t);}
 const folk=indoor?[...(world.__houseLife?.members.values()??[])]:[];
 mapList(v.residents,folk.length);
 folk.forEach((m,i)=>{v.residents[i].x=m.avatar.position.x;v.residents[i].z=m.avatar.position.z;});
 return v;
}
function openPanel(type,arg){if(fishing||hunting)cancelActivity();lastThing='';backdropDown=false;panel=type;panelArg=arg;world.paused=true;world.clearMovement();lastFocused=document.activeElement;$('modal-backdrop').hidden=false;renderPanel();dock?.open(type);requestAnimationFrame(()=>$('modal').focus());}
function closePanel(){lastThing='';forgetScroll();if(world?.tryOn)world.setTryOn(null);dock?.close();$('modal').classList.remove('dialog-right');panel=null;$('modal-backdrop').hidden=true;world.paused=false;lastFocused?.focus?.();}
// Redraws the open panel after an action. renderPanel() keeps everything where it was scrolled to (panel-scroll.mjs).
function redraw(){if(!panel)return;renderPanel();if(lastTap){lastTap.redrawn=true;lastTap.scroll=listScroll();}}
function shell(title,kicker,body,cls=''){$('modal').className=cls;$('modal').innerHTML=`<header class="modal-head"><div><span class="eyebrow">${kicker}</span><h2 id="modal-title">${title}</h2></div>${btn(icon('close'),'close','aria-label="Close panel"','close-button')}</header><div class="modal-content">${body}</div>`;}
// One-line row like the reference shop: icon tile, name, note and chips, and the action on the right.
function card(item,action,extra='',footer='',disabled=false){return `<div class="shop-item${disabled?' is-locked':''}"><span class="shop-icon">${item.img?`<img src="${item.img}" alt="">`:item.icon?`<img src="${iconUrl(item.icon)}" alt="" loading="lazy">`:item.emoji??'🌱'}</span><div><strong>${item.name}</strong>${item.desc?`<p>${item.desc}</p>`:''}${footer}</div>${btn(action,extra.split('|')[0],`${extra.split('|')[1]??''} ${disabled?'disabled':''}`,'primary')}</div>`;}
function tabs(selected,list){return `<div class="tabs">${list.map(([id,name])=>btn(name,'tab',`data-id="${id}"`,selected===id?'active':'')).join('')}</div>`;}
let shopTab='seeds',journalTab='story',craftCategory='all',crafting=null,craftLoad=null,craftError=false;
const atCrafting=()=>panel==='shop'&&panelArg==='upgrades'&&shopTab==='crafting';
// Recipes and their view are fetched only when the workshop's recipe book is opened.
function loadCrafting(){if(crafting||craftLoad||craftError)return;craftLoad=import('./crafting-view.mjs').then(view=>{crafting=view;}).catch(()=>{craftError=true;}).finally(()=>{craftLoad=null;if(atCrafting())redraw();});}
// Draws the open panel. Drawn again (a purchase, a sale, a switch), every list, the tab strip and any row of tiles stay where
// you scrolled them; another panel or another tab starts at the top (panel-scroll.mjs).
function renderPanel(){drawKeeping($('modal'),{panel:`${panel}|${panelArg??''}`,view:atCrafting()?`${shopTab}:${craftCategory}`:panel==='shop'?shopTab:panel==='journal'?journalTab:''},drawPanel);if(panel==='settings'){music?.settings($('modal'));profilesUi?.refresh();}}
function drawPanel(){
 const s=state;
 if(panel==='bag'){shell('Your everyday basket','A LITTLE OF THIS, A LITTLE OF THAT',bagHtml(s,{art:img,itemName,sellPrice}));}
 else if(panel==='journal'){shell('The family album','SOME THINGS ARE WORTH KEEPING',`${tabs(journalTab,[['story','Our story'],['tales','Town tales'],['memories','Memories']])}${journalTab==='tales'?talesHtml(s):journalTab==='memories'?`<div class="memories">${CHAPTERS.map((c,i)=>`<article class="memory ${i<s.chapter?'':'locked'}"><span>0${i+1}</span><div><h3>${c.title}</h3><p>${i<s.chapter?c.memory:'A page waiting to be lived.'}</p></div>${i<s.chapter?icon('check'):icon('leaf')}</article>`).join('')}</div>`:currentChapter(s)?`<div class="story-number">CHAPTER 0${s.chapter+1}</div><h3 class="story-title">${currentChapter(s).title}</h3><p class="story-subtitle">${currentChapter(s).subtitle}</p><p class="story-text">${currentChapter(s).text}</p><div class="goals">${currentChapter(s).goals.map(([text,check])=>`<div class="goal ${check(s)?'complete':''}"><span>${check(s)?icon('check'):'○'}</span>${text}</div>`).join('')}</div><div class="panel-footer"><span>${icon('coin')} ${currentChapter(s).reward} coins · a family memory</span>${btn('Keep this memory '+icon('arrow'),'claim',chapterReady(s)?'':'disabled','primary')}</div>`:`<div class="story-number">VOLUME ONE · COMPLETE</div><h3 class="story-title">The next chapter is yours.</h3><p class="story-text">The old home has a future again. Keep growing your orchard, improving your home, sharing meals and making friends. Willowmere will be here for every season.</p><div class="note">All eight family memories are saved in the Memories tab.</div>`}`,'journal-modal');}
 else if(panel==='people'){
  const intro=`<p class="panel-intro">Say hello each day. Share a gift. Little moments become lasting friendships.</p>`;
  const leader=`<div class="note">You are the village leader. ${btn('Hire helpers ('+Object.keys(s.hired).length+')','open','data-panel="workers"','primary')}</div>`;
  // Rescued friends (friends.mjs friendsLine, builder E): one line, only once somebody has been rescued.
  const rescued=friendsLine(s);
  const friends=(rescued?`<div class="note friends-note">${esc(rescued)}</div>`:'')+peopleHtml(s);
  const homes=`<div class="people-grid">${HOUSES.map(h=>`<article class="household"><span class="household-number">${String(h.id+1).padStart(2,'0')}</span><h3>${h.name}</h3>${h.id===0?'<div class="resident"><span class="portrait" style="--shirt:#839778">R</span><div><b>Rowan <small>you</small></b><small>Farmer · returning home</small></div></div>':''}${RESIDENTS.filter(p=>p.home===h.id).map(p=>`<div class="resident"><span class="portrait" style="--shirt:${outfitColour(p,s)}">${p.name[0]}</span><div><b>${p.name}</b><small>${p.role}</small><span class="friendship">${'♥'.repeat(Math.ceil((s.friendship[p.id]??0)/2))}${'♡'.repeat(5-Math.ceil((s.friendship[p.id]??0)/2))}</span></div>${btn(s.met[p.id]?'Visit':'Meet','find',`data-person="${p.id}"`,'text-button')}</div>`).join('')}</article>`).join('')}</div>`;
  shell('A village full of stories','24 RESIDENTS · 10 HOUSEHOLDS',intro+leader+friends+homes,'wide-modal');
 }
 else if(panel==='map'&&!worldMap){shell('Find your little adventure','THE VILLAGE & BEYOND','<p class="note">Unrolling the map…</p>','wide-modal');loadWorldMap().then(()=>{if(panel==='map'&&worldMap)renderPanel();});}
 else if(panel==='map'){
  shell('Find your little adventure','THE VILLAGE & BEYOND',worldMap.html(mapView(),`<div class="quick-locations">${[['Home','house','0'],['Garden','bed','0'],['Fishing dock','fish','pond'],['Market','shop','market'],['Atelier','shop','clothes'],['Workshop','shop','upgrades'],['Woodland','hunt','woodland'],['School','civic','school'],['Clinic','civic','hospital'],['Police','civic','police'],['Willow & Co.','civic','company'],['Supermarket','shop','supermarket']].map(([name,type,id])=>btn(name+' ↗','find',`data-type="${type}" data-id="${id}"`)).join('')}</div>`)+`<p class="note">Drag the map to look around; scroll, pinch or press + and − to zoom. Choose a place below to walk there.</p>`,'wide-modal');
  worldMap.mount();
 }
 else if(panel==='seeds'){shell('Family fields','YOUR GARDEN','<div id="family-fields"></div>');import('./field-menu.mjs').then(m=>{if(panel==='seeds')m.renderFields($('family-fields'),state,Number(panelArg),(type,result)=>{finishAction(type,result,false);if(result.ok)closePanel();});}).catch(console.error);}
 // Fruit trees (grove.mjs): the kinds to choose from for a cleared tree's spot ('spot:<index>') or an orchard circle ('orchard:<n>'), or the tree growing there.
 else if(panel==='grove'){const v=grovePanel(s,panelArg,{iconUrl});shell(v.title,v.kicker,v.html,v.cls);}
 else if(panel==='shop'){if(atCrafting())loadCrafting();const view=renderShop({state:s,tab:shopTab,shopId:panelArg,data:{CROPS,ITEMS,OUTFITS,KID_OUTFITS,FURNITURE,UPGRADES,iconUrl},helpers:{sellPrice,itemName,bedCount,plotCost,gearHtml:wardrobe?.shopHtml(),craftingHtml:atCrafting()?(crafting?.renderCrafting(s,craftCategory)??(craftError?'<p class="panel-intro" role="status">The recipe book could not load. Check your connection, then reload the game.</p>'+btn('Reload game','craftRetry','','primary'):undefined)):undefined}});shopTab=view.tab;shell(view.title,view.kicker,view.html,view.cls);if(world.tryOn)$('modal').classList.add('dialog-right');if(shopTab==='kids')garments.view?.paintKids(world,s);}
 else if(panel==='talk'){const p=RESIDENTS.find(p=>p.id===panelArg),friend=s.friendship[p.id]??0;shell(p.name,`${p.role} · ${HOUSES[p.home].family} household`,`<div class="kids-stage person-stage"><figure class="look-mirror"><div class="mirror-glass" data-mirror-slot="person" style="--shirt:${outfitColour(p,s)}"></div></figure></div><p class="dialogue-line">“${p.line}”</p><p class="friendship large">${'♥'.repeat(Math.ceil(friend/2))}${'♡'.repeat(5-Math.ceil(friend/2))}</p><div class="note">${s.gifted[p.id]===s.day?'A gift shared today. Some things need time to grow.':'A hello each day builds friendship. A little gift adds two friendship points.'}</div><div class="gift-list">${Object.keys(s.inventory).filter(id=>ITEMS[id]).slice(0,6).map(id=>btn(`Give ${itemName(id)}`,'gift',`data-person="${p.id}" data-item="${id}" ${s.gifted[p.id]===s.day?'disabled':''}`)).join('')}</div>${btn('See you around '+icon('arrow'),'close','','primary')}`,'dialogue-modal');garments.view?.paintPerson(world,s,p);}
 else if(panel==='kitchen'){shell('A recipe passed down','THE COUNTRY KITCHEN',`<p class="panel-intro">Cook from your own basket. Eat for energy, sell at the market, or bring a dish to harvest supper.</p><div class="card-grid">${Object.entries(RECIPES).map(([id,r])=>card({...r,emoji:ITEMS[id].emoji},s.upgrades.kitchen<r.level?`Needs kitchen tier ${r.level}`:'Cook together',`do|data-type="cook" data-id="${id}"`,`<ul class="ingredients">${Object.entries(r.needs).map(([item,n])=>`<li class="${(s.inventory[item]??0)>=n?'enough':''}">${itemName(item)} <b>${s.inventory[item]??0}/${n}</b></li>`).join('')}</ul><p>Restores ${ITEMS[id].energy} energy · ${ITEMS[id].sell} coins</p>`,s.upgrades.kitchen<r.level)).join('')}</div><div class="note">Find mushrooms along the woodland trail, in the grove behind the school. Plant an apple tree (in the orchard, or on the stump of a tree you cleared) for Ada’s pie.</div>`);}
 else if(panel==='sleep'){shell('Home, at last','TAKE YOUR TIME',`<div class="rest-art">☾</div><h3 class="story-title">The garden can wait.</h3><p class="story-text">A new morning restores your energy and ripens watered crops. Young fruit trees grow with each day. Animals and neighbours will have something new to share.</p><div class="sleep-actions">${btn('Rest a while · +25 energy','rest','','secondary')}${btn('Sleep until morning '+icon('arrow'),'sleep','','primary')}</div><p class="note">${calendar(s).festival?'Harvest supper is today. Bring a cooked dish before going to bed.':`Next harvest supper in ${3-s.day%3} day(s).`}</p>`);}
 else if(panel==='civic'&&panelArg==='school'){const q=s.quiz,sub=q&&SUBJECTS[q.subject];const left=Math.max(0,LESSON_CAP-(s.learnDay===s.day?s.learnCount:0));
  const subjects=`<div class="subject-grid">${Object.entries(SUBJECTS).map(([id,x])=>`<button class="subject${q?.subject===id?' active':''}" data-action="do" data-type="lesson" data-id="${id}"><span>${x.emoji}</span><b>${x.name}</b><small>${x.desc} · ${x.pay}+ coins</small><i>${s.learned[id]??0} learned</i></button>`).join('')}</div>`;
  const quiz=q?`<section class="quiz"><div class="quiz-progress"><span>${sub.emoji} ${sub.name}</span><span>${left} paid answers left today</span></div><p class="quiz-question">${q.q}</p><div class="quiz-choices">${q.choices.map(c=>`<button class="quiz-choice" data-action="answer" data-given="${c}">${c}</button>`).join('')}</div></section>`:'<p class="panel-intro">Pick a subject. Every correct answer earns coins, and Pip learns alongside you.</p>';
  shell('Willowmere School','TOWN SQUARE · LESSONS',`${quiz}${subjects}`,'wide-modal');}
 else if(panel==='civic'){const b=CIVIC.find(c=>c.id===panelArg),a=civicPerk(s,panelArg,CIVIC_ACTS[panelArg]),done=s.civicDay[panelArg]===s.day;const blurb={school:'Ms Brook teaches the village children. A daily lesson helps Pip grow and brings the family closer.',hospital:'Dr Linden and the clinic team keep Willowmere healthy. A check-up restores all your energy.',police:'Officer Reed keeps the lanes safe and the goats where they belong. Lend a hand on patrol.',company:'Willow & Co. packs and ships village produce to the city. Part-time shifts pay a fair wage.'}[panelArg];const terms=[a.cost?`Costs ${a.cost} coins`:'',a.energy?`Uses ${a.energy} energy`:'',a.pay?`Earns ${a.pay} coins`:'',a.hours?`Takes ${a.hours} hour${a.hours>1?'s':''}`:''].filter(Boolean).join(' · ');shell(b.name,'TOWN SQUARE',`<div class="festival-banner"><span>${b.name.toUpperCase()}</span><h3>${a.title}</h3><p>${blurb}</p></div><div class="race-card"><div>${icon('star')}<h3>${a.title}</h3><p>${terms}. Once per day · done ${s.stats[a.stat]} time(s).</p></div>${btn(done?'Done for today':a.title,'do',`data-type="civic" data-id="${panelArg}"${done?' disabled':''}`,'primary')}</div>`);}
 else if(panel==='chop'){shell('Clear this tree?','YOUR LAND',`<p class="panel-intro">Cut the tree down to open up space for fields, paths and buildings. You keep the timber.</p><div class="race-card chop-card"><div><span class="tree-tag">🌳 → 🪵 ×2</span><h3>${s.settings.test?'Free in test mode':`${CHOP_COST} coins · 2 energy`}</h3><p>The stump stays as a planting spot: put a mango, an apple or any fruit tree you like on it.</p><p class="chop-room">${chopRoom(s)}</p></div>${btn('Clear the tree','chopTree',`data-id="${panelArg}"`,'primary')}</div>`);}
 else if(panel==='workers'){const helpers=RESIDENTS.filter(p=>p.home>0&&!p.child&&p.id!=='rowan_neighbour');const wages=Object.entries(s.hired).reduce((n,[,j])=>n+JOBS[j].wage,0);
  shell('Village leader','YOUR HELPERS · '+Object.keys(s.hired).length+' HIRED',`<p class="panel-intro">As head of the Rowan family you lead Willowmere. Hire neighbours you have met: pay the first wage now, then wages are paid each morning and their work fills your basket. Daily wages: <b>${wages} coins</b>.</p><div class="card-grid">${helpers.map(p=>{const job=s.hired[p.id];return `<article class="worker-card"><span class="portrait" style="--shirt:${p.color}">${p.name[0]}</span><h3>${p.name}</h3><p>${p.role} · ${HOUSES[p.home].family} family</p>${job?`<p><b>${JOBS[job].emoji} ${JOBS[job].name}</b> · ${JOBS[job].wage}/day</p>${btn('Let go','do',`data-type="release" data-id="${p.id}"`,'text-button')}`:!s.met[p.id]?`<p>Meet ${p.name} first.</p>${btn('Find '+p.name,'find',`data-person="${p.id}"`,'text-button')}`:`<div class="job-buttons">${Object.entries(JOBS).map(([id,j])=>btn(`${j.emoji} ${j.name} · ${j.wage}`,'hire',`data-person="${p.id}" data-id="${id}" title="${j.desc}"`,'small-button')).join('')}</div>`}</article>`;}).join('')}</div>`,'wide-modal');}
 else if(panel==='festival'){const c=calendar(s);shell('A table for everyone','VILLAGE ACTIVITIES',`<div class="festival-banner"><span>THE WILLOWMERE HARVEST SUPPER</span><h3>${c.festival?'Pull up a chair.':'Good food. Better company.'}</h3><p>${c.festival?'Bring a home-cooked dish and share in the prize.':`The next supper is in ${3-s.day%3} day(s). Prepare a dish in your kitchen.`}</p></div><div class="card-grid">${Object.entries(RECIPES).map(([id,r])=>card({...r,emoji:ITEMS[id].emoji},`Share · prize ${ITEMS[id].sell*2+50}`,`do|data-type="festival" data-id="${id}"`,`<p>${s.inventory[id]??0} in your basket</p>`,!c.festival||s.festivalDay===s.day||!s.inventory[id])).join('')}</div><div class="race-card"><div>${icon('star')}<h3>The little village run</h3><p>Three golden checkpoints, in order, in under a minute. On foot. One 90-coin prize each day.</p></div>${btn(s.raceDay===s.day?'Prize won today':'Let’s run!','startRace',s.raceDay===s.day?'disabled':'','primary')}</div>`);}
 else if(panel==='settings'){shell('Just the way you like it','SETTINGS & YOUR SAVE',`<div class="setting"><span><b>Graphics</b><small>Battery uses fewer pixels and no shadows.</small></span><select id="quality" aria-label="Graphics quality">${['high','balanced','battery'].map(q=>`<option ${s.settings.quality===q?'selected':''} value="${q}">${q[0].toUpperCase()+q.slice(1)}</option>`).join('')}</select></div><div class="setting"><span><b>Lighting</b><small>Always daytime keeps the village bright. Day &amp; evening lets the sun set.</small></span>${btn('Always daytime','light','data-id="day"',s.settings.light!=='cycle'?'toggle active':'toggle')}${btn('Day &amp; evening','light','data-id="cycle"',s.settings.light==='cycle'?'toggle active':'toggle')}</div><div class="setting"><span><b>Little sounds</b><small>Gentle sounds for discoveries and actions.</small></span>${btn(s.settings.sound?'On':'Off','sound','','toggle')}</div><div class="setting"><span><b>Camera distance</b><small>Scroll over the village to adjust the view.</small></span>${btn('−','zoom','data-value="4"')}${btn('+','zoom','data-value="-4"')}</div><div class="test-mode"><h3>Test mode</h3>${s.settings.test?`<p>On · crops and fruit ripen instantly, trees clear for free, builds are immediate.</p><div>${[1,5,20].map(v=>btn(`${v}× speed`,'do',`data-type="testSpeed" data-id="${v}"`,s.settings.speed===v?'primary':'secondary')).join('')}${btn('+10,000 coins','do','data-type="testCoins"','secondary')}${btn('🔓 Unlock everything','do','data-type="testUnlockAll"','primary')}${btn('Sleep to next day','sleep','','secondary')}${btn('Turn off','do','data-type="testOff"','text-button')}</div>`:`<p>Enter the secret key to unlock coins and speed for testing.</p><div><input id="test-key" type="password" autocomplete="off" aria-label="Secret key" placeholder="Secret key">${btn('Unlock','testKey','','primary')}</div>`}</div><div class="save-box"><h3>Your story stays with you.</h3><p>Progress saves automatically in this browser. Export a backup to carry your story to another browser or device.</p><div>${btn('Export save','export','','secondary')}${btn('Import save','import','','secondary')}${btn('Save now','save','','primary')}</div><small id="save-status">${saveFailed?'Browser storage is unavailable. Please export a backup.':'Autosave is on · local browser save'}</small></div><details class="performance"><summary>Performance details</summary><p>${world.metrics.drawCalls} draw calls · ${world.metrics.triangles.toLocaleString()} triangles · ${Math.round(1000/(frameTimes.reduce((a,b)=>a+b,0)/Math.max(1,frameTimes.length)||16))} measured fps</p></details>`);}
 else if(panel==='decor'){const v=decor.panel();shell(v.title,v.kicker,v.html,v.cls);}
 // The mirror, the wardrobe and the bookshelf's collection log (mirror-view.mjs, wardrobe-view.mjs, house-rules.mjs).
 else if(panel==='mirror'){const v=mirror.panel();shell(v.title,v.kicker,v.html,v.cls);mirror.paint();}
 else if(panel==='wardrobe'){const v=wardrobe.panel();shell(v.title,v.kicker,v.html,v.cls);wardrobe.paint();}
 else if(panel==='collection'){const log=collectionLog(s);shell('The family collection','THE BOOKSHELF',`<div class="house-log-total"><b>${log.pct}%</b><span>of everything Willowmere has to offer</span></div>${log.rows.map(r=>`<div class="house-log-row"><span class="house-log-icon">${r.icon}</span><div><strong>${r.label}</strong><div class="house-bar"><i style="width:${r.pct}%"></i></div></div><b>${r.have}/${r.total}</b></div>`).join('')}<p class="note">${log.paintings?`${log.paintings} picture${log.paintings>1?'s':''} painted at the easel so far.`:'Paint at the easel and the pictures are counted here too.'}</p>`);}
 else if(panel==='pandora'||panel==='knockout'){const v=pandora.panel(panel);shell(v.title,v.kicker,v.html,v.cls);}
 else if(panel==='help'){shell('A slower kind of adventure','WELCOME TO WILLOWMERE',`<div class="help-grid">${[['W A S D / arrows','Walk around. Hold Shift to run.'],['Click / tap','Walk to a place. Tap a person or object to approach and interact.'],['E / ACT','Use the nearest object, talk, enter a house, or step out of a vehicle.'],['I · J · N · M','Basket, family album, neighbours and map. Escape closes a panel.'],['Scroll / Settings','Zoom the camera. Phones have graphics and camera options in Settings. Far from home the view stays wide.'],['⌂ Home','Walks or drives you home. From far out in the lands it is a magic hop, and the car you sit in comes too.'],['Touch joystick','Drag the circle at bottom left. Use ACT at bottom right.']].map(([key,desc])=>`<div><kbd>${key}</kbd><p>${desc}</p></div>`).join('')}</div><div class="note"><b>Your first day:</b> meet Ada at her cottage northwest of home. Plant the six garden beds, water them, and visit the fishing dock while they grow. Stand at the pond’s edge and tap the water to cast there. Press Reel when the float goes under, hold to pull, let go when the fish surges. Your catches rest on the grass beside you. Walk away to put them in your bag. Sell crops at the market. Sleep in your home to start a fresh morning.</div><p class="panel-intro">There is no rush and no crop decay. Clothes change your appearance. All purchases use coins earned in play. Your village is a solo world with a browser save.</p>`);}
}
// Runs a game action and tells the player what came of it. An action the game does not know is a slip in the code, not something
// the player did: it is not sent, and nothing is toasted (this is where the stray "That action is not available." used to come from).
// The album's Town tales page: one card per building, its steps as dots, what to do next or the memory it left.
function talesHtml(s){return `<p class="panel-intro">Every building in Willowmere has a little story. Look for the sparkling spots ✨ inside.</p><div class="tale-list">${taleList(s).map(t=>`<article class="tale-card ${t.done?'done':t.step?'going':''}"><span class="tale-icon">${t.icon}</span><div><h3>${t.title}</h3><p class="tale-who">${t.who}</p><p>${t.done?t.memory:t.step?t.ask:t.intro}</p>${!t.done&&t.times>1?`<small>${t.count} / ${t.times}</small>`:''}<div class="tale-steps">${Array.from({length:t.steps},(_,i)=>`<i class="${i<t.step?'on':''}"></i>`).join('')}</div></div>${t.done?icon('check'):''}</article>`).join('')}</div>`;}
function runAction(type,arg={},refresh=true){if(!knownAction(type)){console.warn('Willowmere: unknown action',type);return {ok:false,message:'',unknown:true};}
 const result=act(state,type,arg);if(result.ok)taleNews(taleEvent(state,type,arg));return finishAction(type,result,refresh);}
// Town tales (tales.mjs): what a tale says when it moves on, after the action's own message.
let taleTimer=0;const taleQueue=[];function taleNews(list){for(const r of list){taleQueue.push(`${r.icon} ${r.line}`);if(r.done)taleQueue.push(`🏅 Tale complete · ${TALES[r.tale].title} · ${rewardText(r.reward)}`);}if(taleQueue.length&&!taleTimer)nextTale();}
function nextTale(){const line=taleQueue.shift();if(!line){taleTimer=0;return;}taleTimer=setTimeout(()=>{toast(line);chime(true);nextTale();},1600);}
const rewardText=r=>Object.entries(r??{}).map(([k,n])=>k==='coins'?`+${n} coins`:k==='energy'?`+${n} energy`:`+${n} ${itemName(k)}`).join(' · ');
// A tap on a building's spot: the tale's beat there or today's surprise (null leaves the spot's own line).
function tapTaleSpot(t){if(!world.facility)return null;const r=taleSpot(state,world.facility.id,t.id);if(!r)return null;if(r.missing){toast(`${r.icon} Not yet · ${r.line}`);return true;}persist();hud();toast(`${r.icon} ${r.line}`);chime(true);world.burst?.('#ffe39a');if(r.gift)taleQueue.push(`🎁 A little gift · ${rewardText(r.gift)}`);if(r.done)taleQueue.push(`🏅 Tale complete · ${TALES[r.tale].title} · ${rewardText(r.reward)}`);if(taleQueue.length&&!taleTimer)nextTale();if(!r.gift)world.buildInterior();return true;}
function finishAction(type,result,refresh=true){toast(type==='cast'&&result.ok?'':result.message);chime(result.ok);music?.act(type,result);if(result.ok){persist();world.sync(type!=='pandora');if(['harvest','catch','claim','festival','race','pickTree','pickSpot'].includes(type))world.burst();}hud();if(refresh)redraw();return result;}
function goFind(type,id,person){if(world.location!=='village')world.exit();closePanel();
 // From 20 m or more outside the ward: the magic hop home first, with the car you sit in, and then the usual walk inside the village.
 if(world.farFromHome()){world.teleportHome().then(landed=>{if(landed)goFind(type,id,person);});return;}
 if(world.riding){world.dismount();persist();}const target=type==='fish'&&!person?dockBank():world.targets.find(t=>t.location==='village'&&(person?t.type==='person'&&t.id===person:t.type===type&&String(t.id)===String(id)));if(target){world.routeTo(target.x,target.z);world.pending=target;toast(`On the way · ${target.label}`);}else toast('Find this place on the village map.');}
// The map's "Fishing dock": the bank by the little dock. There is no fixed fishing spot any more (the whole bank is one), so the
// map sends you to the water's edge there and the cast starts on arrival.
function dockBank(){const spot=world.rodFishing.bank(undefined,POND);shorePoint(FISH_SPOT.x,FISH_SPOT.z,spot);return spot;}
// The five Town Square buildings have an inside (facility-view.mjs, fetched on the first visit): the door opens it; the same targets inside open the panels.
let facilities=null;function enterFacility(id){return (facilities??=import('./facility-view.mjs').then(m=>m.installFacilities(world,{state:()=>state,openPanel,toast,hud}))).then(f=>f.enter(id)).then(ok=>{if(ok&&id==='supermarket')visitSupermarket();return ok;}).catch(error=>{facilities=null;console.warn(error);toast('The door is stuck for now.');});}
function interaction(target){if(panel||hunting||fishing&&target.type!=='fish')return;const {type,id}=target; // with the line out, only pointing at the pond does something (it casts again, there)
 if(type==='bed')openPanel('seeds',id);
 // A fruit tree (an orchard circle, or the spot of a tree you cleared): E picks a ready tree; otherwise the panel opens (choose a kind, or see the tree and clear it).
 else if(type==='tree'||type==='spot'){const orchard=type==='tree',t=orchard?state.trees[id]:state.planted[id];if(t&&treeReady(state,t))runAction(orchard?'pickTree':'pickSpot',{index:id});else openPanel('grove',`${orchard?'orchard':'spot'}:${id}`);}
 else if(type==='house'){world.enterHouse(id);toast(`Welcome to ${HOUSES[id].name}.`);hud();}
 else if(type==='exit'){world.exit();hud();}
 else if(type==='bedroom'){if(world.houseId===0)openPanel('sleep');else toast('A family’s quiet corner. Your own bed is waiting at home.');}
 else if(type==='kitchen')openPanel('kitchen');
 else if(type==='person'&&world.rescueTalk?.(id)){} // a rescued worker at a facility post (rescue-view.mjs) answers for themselves
 else if(type==='wardrobe'){if(world.houseId===0)openPanel('wardrobe');else toast('A neighbour’s wardrobe. Your own is waiting at home.');}
 else if(type==='mirror')openPanel('mirror');
 else if((type==='shop'&&id==='supermarket'||type==='civic')&&world.location==='village')enterFacility(id);
 else if(type==='shop'){shopTab=id==='supermarket'?'sell':id==='clothes'?'outfits':id==='upgrades'?'upgrades':'seeds';openPanel('shop',id);if(id==='supermarket'&&world.location==='village')visitSupermarket();}
 else if(type==='person'){act(state,'talk',{id});persist();openPanel('talk',id);hud();}
 else if(type==='fish')startFishing(target.tap,target.pond);
 else if(type==='feed'||type==='collect')runAction(type);
 else if(type==='festival')openPanel('festival');
 else if(type==='civic')openPanel('civic',id);
 else if(type==='chop')openPanel('chop',id);
 else if(type==='gather')runAction('gather',{id:id.split('-')[0],spot:id});
 else if(type==='hunt')startHunt();
 else if(type==='vehicle'){if(id==='bike'&&!state.bike){shopTab='upgrades';openPanel('shop','upgrades');toast('Buy the motorcycle at the workshop.');}else if(id==='jeep'&&state.stats.sales<JEEP_SALES)toast(`Theo’s jeep unlocks after ${JEEP_SALES} coins of produce sales. Progress: ${state.stats.sales}/${JEEP_SALES}.`);else if(race)toast('Finish the running course on foot first.');else {world.board(id);persist();toast('WASD or joystick to drive · E to park and step out.');}}
 else if(type==='dismount'){world.dismount();persist();}
 // A target this file does not know by type but which carries its own `use` (a cage, a Night Land lamp: registered from another
 // builder's file with world.target(...) and then spot.use = fn) answers for itself. Its prompt is the target's label (prompts.mjs).
 else if(typeof target.use==='function')target.use(target);
}
// A visit to the supermarket counts as the trip the country market used to be (stats.trips: chapter six); only the first is announced.
// Home (the round button and the way-back guide): near the village a walk, or a drive if you are in a car; from far out the magic hop (world.goHome).
function goHome(){
 if(race){toast('Finish the village run first. Home waits at the finish.');return;}
 const way=world.goHome();
 toast(way==='walk'?(world.riding?'Driving home. Steer in any direction to stop.':'Heading home. Move in any direction to stop.'):way==='magic'?(world.riding?`Home, and the ${world.riding.id==='bike'?'motorcycle':'jeep'} too!`:'Home!'):way==='wary'?'Something is angry at you: hold on three seconds…':way==='busy'?'':'No way home from here. Try a step to one side.');
}
function visitSupermarket(){const first=!state.stats.trips,r=act(state,'trip');persist();hud();if(first)toast(r.message);}
// Rod fishing happens in the world, as in Zoo Garden (cute_game main.ts): no panel, just the pond, the line, one round Reel button
// and a one-line hint. The village keeps living and you can walk off at any moment: any move packs the rod away.
const MOVE_KEYS=['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'];
const FISH_HINTS={cast:'Casting…',wait:'Wait for a fish…',approach:'A fish is coming… wait!',nibble:'A nibble… not yet!',bite:'Bite! Press Reel!'};
let lastCast=null,lastHp=0,recast=0,fishSeen=null,reelPointer=false,atPond=false,lastWater=null;
const moveInput=()=>MOVE_KEYS.some(k=>world.keys.has(k))||hyp(world.stick.x,world.stick.y)>.05;
function showReel(on,mode='reel'){const b=$('reel-button'),reeling=on&&mode==='reel';recast=0;b.hidden=!on;b.classList.toggle('cast',on&&mode==='cast');b.classList.remove('bite','down','strained','hooked');delete b.dataset.tension;b.style.setProperty('--tension','0%');b.removeAttribute('aria-pressed');b.setAttribute('aria-label',mode==='cast'?'Cast again':'Reel in the line');$('reel-text').textContent=mode==='cast'?'Cast':'Reel';$('fish-hint').hidden=!reeling;if(!reeling)$('fish-hint').textContent='';document.body.classList.toggle('rod-fishing',reeling);document.body.classList.toggle('rod-recast',on&&mode==='cast');}
// `tap` is the point of water you pointed at; it travels with that tap (world.mjs puts it on the spot it hands over), so a walk
// you cancelled or a tap that was dropped can never aim a later E, ACT or Cast.
function startFishing(tap=null,pond=null){
 const p=world.player.position;pond??=fishingPond(p.x,p.z);
 // With the line already out, pointing at another spot of water casts there, free; not once a fish is biting or on the line.
 if(fishing){if(!tap||!atBank(p.x,p.z,pond)||!['cast','wait','approach','nibble'].includes(fishing.phase))return;}
 else{if(moveInput())return; // still walking: no line is started until you stand
  // Not at the pond's border (pond.mjs atBank): you walk up to the water first and the cast starts there.
  if(!atBank(p.x,p.z,pond)){const spot=world.rodFishing.bank(undefined,pond);spot.tap=tap;lastThing='';world.pending=spot;world.routeTo(spot.x,spot.z);return;}
  if(!runAction('cast',{},false).ok)return;} // too tired to hook a fish: the reason is toasted, no line goes out
 // Toward the tap; without one, to where you last cast if you still stand there, else straight out over the water.
 const line=castPlan(p,tap??(lastCast&&hyp(p.x-lastCast.from.x,p.z-lastCast.from.z)<1.5?lastCast:null),pond);lastCast={x:line.cast.x,z:line.cast.z,from:{x:p.x,z:p.z}};
 fishing=new FishingSimulation({quality:.3+state.upgrades.pond*.15,bait:false,choose:()=>{const roll=Math.random(),pool=fishPool(state.upgrades.pond,p),id=pool[Math.floor(roll*pool.length)];return{id,roll,power:.25+state.upgrades.pond*.15};},approachFrom:pick=>pond.r?(world.fieldFish?.choose(pond.id,pick.id,line.cast)??1.1):world.pondLife?.choose(pick.id,line.cast)??1.1,cast:line.cast,water:line.water,player:{x:p.x,z:p.z}});
 fishing.held=false;fishSeen={missed:0,early:0,strains:0,tooEarlyUntil:0,hooked:false};lastHp=state.hp;world.path=[];world.pending=null;world.setFishing(true,fishing);showReel(true,'reel');fishingHud();
}
function fishingHud(){
 const f=fishing,seen=fishSeen,hooked=f.phase==='hooked';
 if(hooked&&!seen.hooked){seen.hooked=true;act(state,'hook');hud();} // fishing costs its energy here, when the bite is answered: casting, casting again and packing away are free
 if(f.missedBites>seen.missed){seen.missed=f.missedBites;toast('Missed the bite — wait for the next fish.');}
 if(f.earlyPresses>seen.early){seen.early=f.earlyPresses;seen.tooEarlyUntil=f.time+1.5;}
 if(f.strains>seen.strains){seen.strains=f.strains;if(!f.snapped){toast('The line held! Let go when the fish surges.');chime();}}
 const text=f.phase==='wait'&&f.time<seen.tooEarlyUntil?'Too early! Wait for a bite':hooked?(f.tension>=.8?'Line may break! Let go!':f.surge>0?'Surge! Let go!':f.tension>=.5?'Easy… let the line go':'Green ring: hold Reel to pull'):FISH_HINTS[f.phase]??'',hint=$('fish-hint');if(hint.textContent!==text)hint.textContent=text;
 const button=$('reel-button');button.classList.toggle('bite',f.phase==='bite');button.classList.toggle('strained',f.strained);button.classList.toggle('down',f.held);button.setAttribute('aria-pressed',String(f.held));
 button.classList.toggle('hooked',hooked);if(hooked){const tension=Math.round(Math.max(0,Math.min(1,f.tension))*100),level=f.tension<.5?'safe':f.tension<.8?'rising':'danger';button.style.setProperty('--tension',tension+'%');button.dataset.tension=level;button.setAttribute('aria-label',`Reel: ${tension}% tension. ${level==='safe'?'Safe to pull':level==='rising'?'Ease the line':'Line may break, release'}`);}
}
// Putting the rod away: at once, with nothing to close. Whatever you were doing (walking off, a route) simply carries on.
function packAway(message){if(!fishing)return;cancelActivity();toast(message);}
// Each frame, before the village moves: any move input, a walk you tapped, a ride, a door, a step too far or a blow ends the cast.
function fishingFrame(dt){
 const p=world.player.position,edge=world.location==='village'&&!world.riding&&atBank(p.x,p.z);
 if(edge!==atPond){atPond=edge;document.body.classList.toggle('at-pond',edge);} // at the pond's border the HUD lets taps on the water through (fishing-simple.css)
 if(fishing){const hit=state.hp<lastHp;lastHp=state.hp;
  if(hit)packAway('The fish got away when you were hit.');
  else if(moveInput()||world.takeWalkTap()||world.path.length||world.pending||!edge)packAway('Fishing line reeled in.');}
 if(fishing){fishing.update(dt,fishing.held||fishing.tapped);fishing.tapped=false;fishingHud();
  if(fishing.finished){const caught=fishing.phase==='caught',pick=fishing.pick,reason=fishing.reason;if(caught){const bank={x:p.x,z:p.z};if(runAction('catch',{roll:pick.roll,bank}).ok)import('./catch-reactions.mjs').then(m=>m.reactToCatch(world,pick.id,bank)).catch(console.error);world.rodFishing.land(pick.id);}cancelActivity();if(!caught){toast(reason);chime(false);}
   if(state.energy>=EFFORT.cast){showReel(true,'cast');recast=6;}}} // a green Cast button for six seconds: one more line to the same spot (not when too tired: a button that only refuses is no use)
 else if(recast>0){recast-=dt;if(recast<=0||panel||hunting||moveInput()||world.path.length||!edge)showReel(false);}
}
function startHunt(){if(state.huntDay===state.day){toast('You have taken enough from the woodland today.');return;}if(state.energy<8){toast('Rest before following the woodland trail.');return;}world.paused=true;world.clearMovement();hunting={elapsed:0,pos:0};$('activity').hidden=false;$('activity').innerHTML=`<section class="fishing-card paper"><span class="eyebrow">THE OLD WOODLAND TRAIL</span><h2>Quiet footsteps.</h2><p>Read the tracks. Press Track when the marker crosses green. One modest catch per day, enough for the family.</p><div class="trail-art">♧ · · · ♧</div><div class="timing-track"><span class="catch-zone"></span><i id="fish-cursor"></i></div><div class="fishing-actions">${btn('Leave the woodland','cancelActivity','','text-button')}${btn('Track · Space','track','','primary')}</div></section>`;}
function cancelActivity(){fishing=null;hunting=null;world.setFishing(false);$('activity').hidden=true;showReel(false);world.paused=!!panel;}
function reel(){if(fishing)fishing.held=fishing.tapped=true;} // any time: before the bite it is the reference's early press, which scares the fish. A tap shorter than a frame still counts (tapped).
function track(){if(!hunting)return;const p=hunting.pos;cancelActivity();if(p>=.36&&p<=.66)runAction('hunt');else toast('The trail went quiet. You can try again.');}
function startRace(){if(world.location!=='village'){toast('Visit the village table outside to start the run.');return;}
 if(world.farFromHome()){closePanel();world.teleportHome().then(landed=>{if(landed)startRace();});return;}
 if(world.riding){world.dismount();persist();}closePanel();race={elapsed:0,next:0};world.markers.forEach((m,i)=>{m.visible=i===0;});toast('Run to the golden circles in order. First: west of the pond!');}
function endRace(){race=null;world.markers.forEach(m=>m.visible=false);hud();}
// A double tap on a panel button: the first tap acts and redraws the panel, and the second would land on whatever the redraw put under
// the finger (Wear turns into Take off, so the hat went on and straight off again). A second tap at the same place within 0.35 s that is
// no longer on the same kind of button is dropped; tapping the same button twice (two seed packets) still counts twice.
let lastTap=null,lastThing='',lastThingAt=0;const listScroll=()=>$('modal').querySelector('.modal-content')?.scrollTop??0,tapKind=el=>{const b=el?.closest?.('button,[data-action]');return b?[b.dataset.action,b.dataset.type,b.dataset.gearAction,b.dataset.lookAction,b.dataset.gearTry?'try':''].join('|'):'';};
document.addEventListener('click',e=>{if(!e.isTrusted)return;if(!e.target.closest?.('#modal')){lastTap=null;return;}const now=performance.now(),kind=tapKind(e.target);
 if(lastTap?.redrawn&&now-lastTap.at<350&&hyp(e.clientX-lastTap.x,e.clientY-lastTap.y)<24&&kind!==lastTap.kind&&listScroll()===lastTap.scroll){e.stopImmediatePropagation();e.preventDefault();return;}
 lastTap={at:now,x:e.clientX,y:e.clientY,kind,redrawn:false,scroll:listScroll()};},true);
document.addEventListener('click',e=>{const b=e.target.closest('[data-action]');if(!b||b.disabled)return;const d=b.dataset;
 switch(d.action){
 case 'begin':{const fresh=!state.started,p=world.player.position,moved=state.layoutMoved===true;state.layoutMoved=false;state.started=true;persist();$('welcome').hidden=true;world.paused=false;world.hudSoon=true;document.body.classList.add('playing');toast(wakeGreeting({fresh,moved,location:world.location,x:p.x,z:p.z,riding:world.riding?.id??''}));break;}
 case 'open':if(booted)openPanel(d.panel);break;
 case 'close':closePanel();break;
 // Decorating your home (decor-view.mjs): the Decorate panel, the placement bar and the indoor Outside pill.
 case 'decorate':if(booted&&!panel&&!fishing&&!hunting)openPanel('decor');break;
 case 'decor-place':decor.begin({id:d.id});break;
 case 'decor-move':decor.begin({index:Number(d.index)});break;
 case 'decor-turn':runAction('rotateDecor',{index:Number(d.index)});break;
 case 'decor-remove':runAction('removeDecor',{index:Number(d.index)});break;
 case 'decor-fold':decor.fold(d.id);redraw();break;
 case 'decor-rotate':decor.rotate();break;case 'decor-confirm':decor.confirm();break;case 'decor-cancel':decor.cancel();break;case 'decor-store':decor.store();break;
 case 'decorShop':shopTab='furniture';openPanel('shop','upgrades');break;
 case 'leaveHouse':if(!panel){decor.leave();hud();}break;
 case 'interact':if(booted&&!panel)world.interact();break;
 case 'tab':if(panel==='journal')journalTab=d.id;else{shopTab=d.id;if(world.tryOn)world.setTryOn(null);}renderPanel();break;
 case 'craftCategory':if(atCrafting()){craftCategory=d.id;renderPanel();}break;
 case 'craftRetry':if(atCrafting()){persist();window.location.reload();}break;
 case 'craft':if(atCrafting()&&crafting)finishAction('craft',crafting.craft(state,d.id));break;
 case 'do':if(d.type)runAction(d.type,{id:d.id});break;
 case 'plant':if(runAction('plant',{index:Number(d.index),crop:d.id},false).ok)closePanel();break;
 // The grove panel: plant the chosen kind on a cleared tree's spot or in an orchard circle, pick a ready tree, or clear a fruit tree away.
 case 'plantFruit':if((d.where==='orchard'?runAction('plantTree',{index:Number(d.index),id:d.id},false):runAction('plantSpot',{index:Number(d.index),id:d.id},false)).ok)closePanel();break;
 case 'pickFruit':if(d.where==='orchard')runAction('pickTree',{index:Number(d.index)});else runAction('pickSpot',{index:Number(d.index)});break;
 case 'uprootFruit':if(runAction('uproot',{index:Number(d.index),orchard:d.where==='orchard'},false).ok)closePanel();break;
 case 'sell':runAction('sell',{id:d.id,one:d.one==='true',country:panelArg==='supermarket'});break;
 case 'gift':runAction('gift',{id:d.person,item:d.item});break;
 case 'chopTree':if(runAction('chop',{index:Number(d.id)},false).ok)closePanel();break;
 case 'answer':{const r=runAction('answer',{given:d.given},false);e.target.closest('.quiz-choice')?.classList.add(r.ok?'correct':'wrong');setTimeout(()=>{if(panel)renderPanel();},r.ok?380:650);}break;
 case 'hire':runAction('hire',{id:d.person,job:d.id});break;
 case 'testKey':{const input=$('test-key');runAction('testMode',{key:input?.value});}break;
 case 'claim':{const result=runAction('claim',{},false);if(result.ok){shell('A memory to keep','THE FAMILY ALBUM',`<div class="memory-illustration">${icon('leaf')}</div><p class="story-text">${result.message}</p>${btn('Turn the page '+icon('arrow'),'open','data-panel="journal"','primary')}`);}}break;
 case 'openMap':if(booted)openPanel('map');break;
 case 'walkHome':if(!panel&&!hunting)goHome();break;
 case 'find':goFind(d.type,d.id,d.person);break;
 case 'sleep':runAction('sleep',{},false);closePanel();break;
 case 'rest':runAction('rest');break;
 case 'reel':if(reelPointer)reelPointer=false;else if(fishing){if(e.detail===0)fishing.held=!fishing.held;}else if(b.classList.contains('cast')&&!panel&&!hunting)startFishing();break; // a keyboard click toggles the hold; the green Cast button casts again
 case 'track':track();break;case 'cancelActivity':cancelActivity();break;
 case 'startRace':startRace();break;case 'cancelRace':endRace();break;
 case 'light':state.settings.light=d.id==='cycle'?'cycle':'day';persist();renderPanel();break;
 case 'sound':state.settings.sound=!state.settings.sound;persist();renderPanel();break;
 case 'zoom':world.zoom=Math.max(12,Math.min(42,world.zoom+Number(d.value)));world.resize();break;
 case 'save':persist();toast(saveFailed?'Please export a backup.':'Your story is saved.');break;
 case 'export':{const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`willowmere-profile-${profileStorage.slot+1}-day-${state.day}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Your family story has been exported.');}break;
 case 'import':$('import-file').click();break;
 }
});
document.addEventListener('change',e=>{if(e.target.id==='quality'){state.settings.quality=e.target.value;world.applyQuality();persist();renderPanel();}});
$('import-file').addEventListener('change',async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>1000000)throw Error('Save file is too large.');const next=parseSave(JSON.parse(await file.text()));if(!confirm(localizeText('Replace this profile’s current Willowmere progress with the imported save? Export a backup first if you want to keep it.')))return;if(!save(next,profileStorage))throw Error('This browser could not store the imported save. Your current story is unchanged.');state=next;world.paused=true;window.location.reload();}catch(error){toast(error.message||'This save could not be imported.');}finally{e.target.value='';}});
// A press that began on the backdrop closes the panel. A tap on the world that opened it does not: on a touch screen the tap's own click arrives after the panel is up and lands on the backdrop.
let backdropDown=false;$('modal-backdrop').addEventListener('pointerdown',e=>{backdropDown=e.target===$('modal-backdrop');});
$('modal-backdrop').addEventListener('click',e=>{const began=backdropDown;backdropDown=false;if(e.target===$('modal-backdrop')&&began)closePanel();});
document.addEventListener('keydown',e=>{if(!booted)return;const k=e.key.toLowerCase();if(panel){if(k==='escape'){e.preventDefault();closePanel();}if(k==='tab'){const focusable=[...$('modal').querySelectorAll('button:not(:disabled),select,input,[tabindex="0"]')];const first=focusable[0],last=focusable.at(-1);if(e.shiftKey&&(document.activeElement===first||document.activeElement===$('modal'))){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}return;}
 if(hunting){if(k===' '){e.preventDefault();if(!e.repeat)track();}if(k==='escape')cancelActivity();return;}
 // The line is out: Space is the Reel button, Escape packs away, E does nothing; the move keys go on to the village, which packs away too.
 if(fishing){if(k===' '){e.preventDefault();if(!e.repeat)reel();return;}if(k==='escape'){packAway('Fishing line reeled in.');return;}if(k==='e')return;}if(!$('welcome').hidden)return;
 if(['arrowup','arrowdown','arrowleft','arrowright',' '].includes(k))e.preventDefault();if(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright','shift'].includes(k))world.keys.add(k);if(e.repeat)return;
 if(k==='e'||k===' ')world.interact();else if(!(k==='j'&&document.body.classList.contains('in-wilds'))&&{i:'bag',j:'journal',p:'journal',n:'people',m:'map',escape:'settings'}[k])openPanel({i:'bag',j:'journal',p:'journal',n:'people',m:'map',escape:'settings'}[k]);
});document.addEventListener('keyup',e=>{world?.keys.delete(e.key.toLowerCase());if(e.key===' '&&fishing)fishing.held=false;});window.addEventListener('blur',()=>{if(fishing)fishing.held=false;world?.clearMovement();persist();});document.addEventListener('visibilitychange',()=>{if(fishing)fishing.held=false;world?.clearMovement();persist();});window.addEventListener('beforeunload',persist);window.addEventListener('pagehide',persist);
let stickPointer=null;const joystick=$('joystick');function moveStick(e){const rect=joystick.getBoundingClientRect(),dx=e.clientX-rect.left-rect.width/2,dy=e.clientY-rect.top-rect.height/2,len=Math.max(1,hyp(dx,dy)/34);world.stick.x=dx/len/34;world.stick.y=dy/len/34;joystick.querySelector('i').style.transform=`translate(${dx/len}px,${dy/len}px)`;}
joystick.addEventListener('pointerdown',e=>{if(!world||panel)return;e.preventDefault();stickPointer=e.pointerId;joystick.setPointerCapture(e.pointerId);moveStick(e);});joystick.addEventListener('pointermove',e=>{if(e.pointerId===stickPointer)moveStick(e);});for(const type of ['pointerup','pointercancel','lostpointercapture'])joystick.addEventListener(type,()=>{stickPointer=null;if(world){world.stick.x=0;world.stick.y=0;}joystick.querySelector('i').style.transform='';});
// The Reel button: hold it (pointer capture keeps the hold when the thumb slides off); the click that ends a hold is not a second press.
{const button=$('reel-button');button.addEventListener('pointerdown',e=>{reelPointer=!!fishing;if(!fishing)return;e.preventDefault();button.setPointerCapture(e.pointerId);reel();});for(const type of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(type,()=>{if(fishing)fishing.held=false;});}

async function boot(){try{const landView=import('./land-view.mjs'),decorLoad=import('./decor-view.mjs');garments.view=await import('./garments-view.mjs');const [mirrorView,wardrobeView]=await Promise.all([import('./mirror-view.mjs'),import('./wardrobe-view.mjs')]);await document.fonts.ready;world=new World($('game'),state,interaction);world.tapTaleSpot=tapTaleSpot;await world.init(value=>{$('loading-percent').textContent=Math.round(value*100)+'%';$('load-fill').style.width=value*100+'%';});for(const item of [...FURNITURE,...Object.values(UPGRADES)])if(item.model)item.img=world.modelIcon(item.model);const decorView=await decorLoad;installShopPreview({onTryOn:(who,color,id)=>{if(who==='pip')return garments.view.tryKid(world,state,id);wardrobe.tryClothes(id);$('modal').classList.toggle('dialog-right',!!id);}});decor=decorView.installDecor(world,{state:()=>state,act:(type,arg)=>runAction(type,arg),toast,closePanel});
 const views={state:()=>state,act:(type,arg)=>runAction(type,arg),panel:()=>panel,render:redraw,toast,openPanel,openShop:()=>{shopTab='gear';openPanel('shop','clothes');}};dock=installDock(world);mirror=mirrorView.installMirror(world,views);wardrobe=wardrobeView.installWardrobe(world,views);installHouseLife(world,views);installRoomView(world).onFrame(dock.frame);
 minimap=new Minimap($('map-canvas'),{north:$('map-north'),caption:$('map-caption')},mapView);hud();let gov,previous=performance.now(),uiTime=0,saveTime=0;
 const loop=now=>{const actual=now-previous,dt=Math.min(actual/1000,.05);previous=now;frameTimes.push(actual);gov?.(actual/1000,!world.paused);if(frameTimes.length>90)frameTimes.shift();if(!document.hidden){if(!world.paused){tick(state,dt);if(race){race.elapsed+=dt;const p=RACE_POINTS[race.next];if(p&&hyp(world.player.position.x-p.x,world.player.position.z-p.z)<1.8){world.markers[race.next].visible=false;race.next++;chime();if(race.next===3){runAction('race',{seconds:race.elapsed});endRace();}else {world.markers[race.next].visible=true;toast(`Checkpoint ${race.next}/3 · keep going!`);}}if(race?.elapsed>60){endRace();toast('A lovely jog. Try again for a faster time.');}}}
  fishingFrame(dt);
  if(hunting){hunting.elapsed+=dt;hunting.pos=(Math.sin((hunting.elapsed-1.5)*2.8)+1)/2;$('fish-cursor').style.left=(hunting.pos*100)+'%';if(hunting.elapsed>14){cancelActivity();toast('The moment passed. Try again whenever you like.');}}
  world.update(dt);const packed=packBankCatch(state,world.player.position,world.location,!!world.riding);if(packed){persist();hud();toast(`Packed ${packed} fish into your bag.`);}minimap.frame(actual/1000);uiTime+=dt;saveTime+=dt;if(uiTime>.3||world.hudSoon){uiTime=0;world.hudSoon=false;hud();}if(saveTime>12){saveTime=0;persist();}}
  requestAnimationFrame(loop);
 };requestAnimationFrame(loop);
 // Draw the village before fetching indoor framing; early clients queued their frame hooks in the small wrapper.
 await new Promise(requestAnimationFrame);
 const pandoraView=import('./pandora-view.mjs'); // the Pandora box's code is a chunk of its own: fetched now, after the first frame, installed below
 const {installRoomCamera}=await import('./room-camera.mjs');installRoomView(world).initialize(installRoomCamera);
 booted=true;$('begin').disabled=false;$('begin').innerHTML=`${state.started?'Come back home':'Begin your story'} ${icon('arrow')}`;$('save-note').textContent=state.started?`Your story continues · ${calendar(state).season}, day ${calendar(state).day}, year ${calendar(state).year}`:'A single-player adventure · automatically saved on this device';if(loaded.error)toast(loaded.error);
 pandora=(await pandoraView).installPandora(world,{state:()=>state,act:runAction,toast,persist,hud,openPanel,closePanel,panel:()=>panel});
 // Round 8 (step 0): the lands' features (world.lands), the titans and the rescued friends are installed straight after the Pandora
 // box, in that order; each does nothing yet but for world.lands.
 // Each gets the same `deps` as its last argument: {state(), act(type, arg) (toasts the answer, saves and refreshes the HUD: runAction),
 // toast(message), persist(), hud()}. The region banner (builder A) is installed last.
 const deps={state:()=>state,act:runAction,toast,persist,hud};
 // The lands' features (builder B) are a chunk of their own (spec 17.3: not counted before the first frame), asked for at the top of boot()
 // while the world loads, and installed here in order, before the game is ready: their first build would stall a frame in play otherwise.
 (await landView).installLands(world,deps);
 // The titans' drawing and their skills' code (builder D2) are fetched with import() straight after boot: they are not read before the first frame (spec 17.3).
 import('./music/index.mjs').then(m=>music=m.installMusic({state:()=>state,world,pandora,persist,lib:[calendar,cageStatuses,HOUSES,BED_POSITIONS,audio,regionAt,borderDistance],ui:()=>({fishing,hunting,race,panel,arg:panelArg})})).catch(()=>{});
 import('./titans-view.mjs').then(m=>m.installTitans(world,pandora,deps)).catch(error=>console.warn('The titans could not load.',error));
 import('./outposts-view.mjs').then(m=>m.installOutposts(world)).catch(error=>console.warn('The outposts could not load.',error)); // the twelve rest spots (Amendment A3)
 // The cages, the followers and the friends at home (builder E) come the same way: the box is shut at boot for most, and friends at their posts may stand there a moment later.
 import('./friends-view.mjs').then(m=>m.installFriends(world,pandora,deps)).catch(error=>console.warn('The friends could not load.',error));
 import('./rescue-view.mjs').then(m=>m.installRescue(world,pandora,deps)).catch(error=>console.warn('The huts could not load.',error)); // the rescue huts and the workers who come home (rescued.mjs)
 loadWorldMap();
 import('./region-banner.mjs').then(m=>m.installBanner(world,deps));import('./governor.mjs').then(m=>{gov=m.installGovernor(world);}).catch(error=>console.warn('The border banner could not load.',error)); // the banner on crossing a border (builder A), fetched after boot (budget)
 installOutdoors(world,{state:()=>state,pandora,minimap:()=>minimap,toast});
 for(const [id,label,x,z] of [['bakery','Visit the Hearth bakery',27,24.7],['moss','Visit the Moss barn',28.4,-14.6],['vale','Visit the Vale workshop barn',-36.2,29]]){const door=world.target('facility',id,label,x,z,2.2);door.use=()=>enterFacility(id);} // the Hearths' bakery has an inside too (facility-plans.mjs)
 // A second tap on the same thing within 0.6 s is a double tap, not a second wish: it would only swap the answer ("+20 energy") for a
 // refusal ("ready in 2:00"). Fights are the exception (every tap on a creature is a blow), and so is anything after a panel
 // (plant a seed, then E waters it at once).
 // The pond is one thing with many spots: a tap on another spot of water (0.8 m or more from the last) is a new aim and casts
 // there at once; only the same spot twice is a double tap.
 const useThing=world.onInteract;
 world.onInteract=t=>{if(t&&t.type!=='creature'){const key=`${t.type}|${t.id}|${world.location}`,now=performance.now(),aimed=t.tap&&(!lastWater||hyp(t.tap.x-lastWater.x,t.tap.z-lastWater.z)>=.8);if(key===lastThing&&now-lastThingAt<600&&!aimed)return;lastThing=key;lastThingAt=now;if(t.type==='fish')lastWater=t.tap??null;}return useThing(t);};
 world.onNotice=toast;
 const {installProbe}=await import('./test-hook.mjs');
 installProbe(world,{enterFacility,state:()=>state,persist,hud,openPanel,music:()=>music,pandora:()=>pandora,minimap,mirror,wardrobe});
 }catch(error){console.error(error);$('begin').textContent='The village could not load';$('save-note').innerHTML=`${esc(error.message)}<br>Reload the page to try again.`;}}
import('./profiles-view.mjs').then(m=>profilesUi=m.installProfiles({storage:localStorage,slot:profileStorage.slot,beforeSwitch:persist,onError:toast})).catch(console.error);
import('./language-view.mjs').then(m=>{localizeText=m.t;m.installLanguage(()=>world);}).catch(console.error);
boot();
