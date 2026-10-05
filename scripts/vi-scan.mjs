// Scan the Vietnamese tables for English words left inside a translation (a word that is plain ASCII, is an English word of
// some key and is never a Vietnamese syllable seen with its marks elsewhere).
import {VI_REFERENCE} from '../src/vi-reference.mjs';import {VI_WILLOWMERE} from '../src/vi-willowmere.mjs';import {VI_AUDIT} from '../src/vi-audit.mjs';
const all=Object.assign({},VI_REFERENCE,VI_WILLOWMERE,VI_AUDIT);
const strip=w=>w.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/Đ/g,'D').toLowerCase();
const words=s=>s.match(/[A-Za-z\u00C0-\u1EF9]+/g)||[];
const marked=new Set(),eng=new Set();
for(const [k,v] of Object.entries(all)){for(const w of words(v))if(/[^\x00-\x7f]/.test(w))marked.add(strip(w));for(const w of words(k))eng.add(w.toLowerCase());}
const NAMES=new Set(['rowan','ada','ellis','june','pip','theo','bea','kit','mara','oren','wren','finn','iris','leo','faye','hugo','nell','ash','fern','cora','milo','sylvie','hazel','willowmere','alder','bell','moss','reed','finch','hearth','vale','brook','linden','pandora','titan','wasd','xp','hp','fps','jeep','chibi','lava','koi','kimono','hoodie','robot','ninja','viking','samurai','vampire','pirate','slime','totem','sofa','ok','esc','shift','act','tulip','mochi','marshmallow','hawaii','noel','sprout','clover','pepper','leviathan','yeti','mini','pin','vest','hacker','cowboy','laser','rocket','magma','menu','album','logo','tank','gara']);
let n=0;const out=[];
for(const [k,v] of Object.entries(all)){const bad=words(v.replace(/\{\w+\}/g,'')).filter(w=>!/[^\x00-\x7f]/.test(w)&&w.length>=3&&eng.has(w.toLowerCase())&&!marked.has(w.toLowerCase())&&!NAMES.has(w.toLowerCase()));if(bad.length){n++;out.push(JSON.stringify(k).slice(0,80)+' => '+JSON.stringify(v).slice(0,120)+'  ['+[...new Set(bad)].join(',')+']');}}
if(process.argv[2]!=='count')console.log(out.join('\n'));
console.log('entries with English words left:',n,'of',Object.keys(all).length);
