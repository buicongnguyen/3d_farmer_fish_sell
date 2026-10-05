import {ITEMS} from './content.mjs';
import {onWay} from './lots.mjs';
import {firstBlock} from './village-plan.mjs';

export const LINES={
 player:["Got you! Look at those fins!","That was worth the wait!","What a lovely {fish}!","Whew! That one made me work!","There you are, little wriggler!","A {fish}! My lucky cast!","Look what was hiding down there!","Steady hands paid off!","Now that's a catch!","I nearly lost that one!","One more fish for today's basket!","What a splash you made!","Hello there, shiny scales!","I knew there was something on the line!","Just look at that {fish}!","Well, that woke me up!","A little patience and... got it!","This pond still has surprises!"],
 adult:["Oh, well caught!","Did you see that splash?","That's a fine {fish}!","You made that look easy!","I thought it was going to get away!","Look at those beautiful scales!","Now that was worth stopping for!","What a catch! Nicely done!","You've found a good fishing spot!","That one put up quite a fight!","A {fish}! Come and have a look!","I was cheering for you!","Lovely catch. You kept your nerve!","There's a story for supper!","I saw the line bend from over here!","That fish had you dancing!","Your patience really paid off!","You must be pleased with that one!"],
 child:["Wow! You caught it!","It's so wiggly!","Look, look! A {fish}!","That was AMAZING!","I saw it jump! I saw it!","Can I look at its fins?","It's shining like treasure!","Do you think it has a name?","How did you do that?","That splash almost got me!","You're really good at this!","I want to catch one like that!"],
 rarePlayer:["A {fish}! I can hardly believe it!","Oh! Those colours are incredible!","This is a catch I'll remember!","What a treasure under the water!","A {fish}... what a lucky day!","I have to tell someone about this one!"],
 rareWitness:["A {fish}? What an extraordinary catch!","Those colours! I've never seen anything like it!","That's one to tell the whole village about!","You found a real treasure in there!","What a lucky day to be watching!","Oh, don't let that one wriggle away!"]
};
export function nextLine(memory,kind,fish,random=Math.random){
 const pool=LINES[kind];let bag=memory[kind];
 if(!bag?.length){bag=memory[kind]=pool.map((_,i)=>i);for(let i=bag.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[bag[i],bag[j]]=[bag[j],bag[i]];}
  if(bag.at(-1)===memory[kind+'Last'])[bag[0],bag[bag.length-1]]=[bag.at(-1),bag[0]];
 }
 const i=bag.pop();memory[kind+'Last']=i;return pool[i].replaceAll('{fish}',fish);
}
export function witness(w,now){
 const me=w.player.position;
 return w.npcs.filter(n=>!n.inside&&n.mesh.visible&&!n.ride?.busy&&now-(n.catchSaid??-99)>20&&Math.hypot(n.mesh.position.x-me.x,n.mesh.position.z-me.z)<7&&!firstBlock(me,n.mesh.position))
  .sort((a,b)=>Math.hypot(a.mesh.position.x-me.x,a.mesh.position.z-me.z)-Math.hypot(b.mesh.position.x-me.x,b.mesh.position.z-me.z))[0];
}
export function canWatch(w,n){
 const p=n.mesh.position;
 return !n.working&&!onWay(p.x,p.z)&&!n.traffic?.aside&&!w.npcs.some(o=>o!==n&&!o.inside&&o.mesh.visible&&Math.hypot(o.mesh.position.x-p.x,o.mesh.position.z-p.z)<2.2);
}
export function reactToCatch(w,id,bank){
 const view=w.villagers,me=w.player.position;
 if(!view||w.location!=='village'||w.paused||Math.hypot(me.x-bank.x,me.z-bank.z)>3)return;
 const memory=w.catchLines??={},fish=ITEMS[id]?.name??'fish',rare=(ITEMS[id]?.sell??0)>=120;
 view.say({mesh:w.player,p:{child:false}},nextLine(memory,rare?'rarePlayer':'player',fish),()=>{
  if(w.location!=='village'||w.paused||w.fishing||Math.hypot(me.x-bank.x,me.z-bank.z)>3)return;
  const n=witness(w,view.time);if(!n)return;
  n.catchSaid=n.said=view.time;n.wave=1.5;
  if(canWatch(w,n)){n.pause=Math.max(n.pause,2.3);n.face=Math.atan2(me.x-n.mesh.position.x,me.z-n.mesh.position.z);}
  view.say(n,nextLine(memory,n.p.child?'child':rare?'rareWitness':'adult',fish));
 });
}
