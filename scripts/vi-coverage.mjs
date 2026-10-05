// Vietnamese coverage audit: extracts player-visible English strings from src/*.mjs and index.html and checks each through the translator.
// Usage: node scripts/vi-coverage.mjs [--list] [--json out.json] [--area name]
import fs from 'node:fs';import path from 'node:path';import {pathToFileURL} from 'node:url';
const BS=String.fromCharCode(92);
const root=path.resolve(import.meta.dirname,'..'),src=path.join(root,'src');
const {t,setLanguage}=await import(pathToFileURL(path.join(src,'i18n.mjs')).href);
setLanguage('vi');
const {englishWords}=await import('./vi-lib.mjs');
const NOISE=/^(?:[a-z][\w-]*|[A-Z_0-9]+|.*[#.\[\]=<>{}()\|;$@&%*+~^/_].*)$/;
const CODEISH=/^(?:https?:|data:|rgba?\(|#[0-9a-f]{3,8}$|\d|[a-z]+[A-Z]\w*$|[\w-]+\.(?:glb|png|jpg|webp|mjs|json|css|svg|mp3|ogg)$|[-\w]+:\s|\w+\(|\.|\/)/;
// not player-visible: shader source, selectors, media queries, SVG paths, developer diagnostics
const DEV=/(?:vec[234]|float |uniform |gl_|#ifdef|#endif|varying)|^[MmLlHhVvCcZzAa0-9 .,-]+$|^\(|^[:#\[]|[a-z]\.glb|atlas|Scenery kit|device-width|^(?:Leaf|Pine) [AB]$|^shadow lava|^alert callout/;
const UIWORDS=/[A-Za-z]{2,}/;
function literals(text){
 const out=[];let i=0;const n=text.length;
 while(i<n){const c=text[i],d=text[i+1];
  if(c==='/'&&d==='/'){while(i<n&&text[i]!=='\n')i++;continue;}
  if(c==='/'&&d==='*'){i=text.indexOf('*/',i+2);if(i<0)break;i+=2;continue;}
  if(c==="'"||c==='"'){let j=i+1,s='';while(j<n&&text[j]!==c&&text[j]!=='\n'){if(text[j]===BS){s+=text[j+1]==='n'?'\n':text[j+1];j+=2;}else s+=text[j++];}out.push({s,pos:i});i=j+1;continue;}
  if(c==='`'){let j=i+1,s='',depth=0;while(j<n){const ch=text[j];if(ch===BS){s+=text[j+1];j+=2;continue;}if(ch==='`'&&!depth)break;if(ch==='$'&&text[j+1]==='{'){let k=j+2,b=1;while(k<n&&b){if(text[k]==='{')b++;else if(text[k]==='}')b--;k++;}s+='\u0001';j=k;continue;}s+=ch;j++;}out.push({s,pos:i,tpl:true});i=j+1;continue;}
  if(c==='/'&&/[=(,:\[!&|?{;]\s*$/.test(text.slice(Math.max(0,i-3),i))){let j=i+1;while(j<n&&text[j]!=='/'&&text[j]!=='\n'){if(text[j]===BS)j++;j++;}i=j+1;continue;}
  i++;}
 return out;
}
// split a literal that holds HTML into its text nodes and title/aria/placeholder attributes
function pieces(s){
 const res=[];
 if(/<[a-z][^>]*>/i.test(s)){
  for(const m of s.matchAll(/(?:title|aria-label|placeholder|alt)="([^"]+)"/g))res.push(m[1]);
  for(const m of s.replace(/<[^>]*>/g,'\u0002').split('\u0002'))res.push(m);
 }else res.push(s);
 return res;
}
function candidate(raw){
 let s=raw.replace(/\u0001/g,'5').replace(/&middot;/g,'·').replace(/&amp;/g,'&').replace(/&nbsp;/g,' ').trim();
 if(s.length<3||s.length>400)return null;if(!UIWORDS.test(s))return null;
 if(CODEISH.test(s))return null;
 const words=s.match(/[A-Za-z][A-Za-z'’-]+/g)||[];
 if(!words.length)return null;
 const spaced=/\s/.test(s);
 if(!spaced){ if(!/^[A-Z][a-z]{2,}$/.test(s))return null; }
 else if(NOISE.test(s)&&!/[.,!?'’·—–:]/.test(s)&&!/^[A-Z]/.test(s))return null;
 else if(/^[a-z]/.test(s)&&words.length<3)return null;
 if(DEV.test(s))return null;
 if(/\b(?:querySelector|function|return|const|translate\(|px|rem|rgba?|flex|grid|solid)\b/.test(s))return null;
 if(/^[\w-]+(?:\s[\w-]+)*$/.test(s)&&/^[a-z]/.test(s)&&/(?:^|\s)(?:\w+-\w+)/.test(s))return null;
 return s;
}
const AREAS=[[/^content/,'content catalogue'],[/^game\./,'game messages'],[/^prompts/,'prompts'],[/^main\./,'main panels/toasts'],[/facility|shop-interior|shop-view/,'facilities and shops'],[/pandora|combat|wilds|titan|boss|gear|creature/,'pandora/combat/wilds/titans'],[/region|land|outpost|world-map|world-sheet|minimap|map/,'regions/lands/map'],[/garment|outfit|wardrobe|mirror|looks|avatar/,'wardrobe/looks'],[/music|settings|dock|language|profile/,'settings/profiles/music'],[/fish|pond|rod|bank|catch/,'fishing/pond'],[/friend|villager|house|home|pen|bike|drive|talk/,'villagers/house/pen/bikes'],[/index\.html/,'index.html']];
const area=f=>(AREAS.find(([r])=>r.test(f))||[0,'other'])[1];
const files=fs.readdirSync(src).filter(f=>/\.mjs$/.test(f)&&!/^vi-|^i18n|^language-view/.test(f)).map(f=>path.join(src,f));
const found=new Map(),NAMES=new Set();
for(const p of (await import(pathToFileURL(path.join(src,'content.mjs')).href)).RESIDENTS)NAMES.add(p.name);
for(const n of ['Rowan','Willowmere','Willow & Co.','Alder','Bell','Moss','Reed','Finch','Hearth','Vale','Brook','Linden','Chibi','Ada','Ellis','June','Pip'])NAMES.add(n);
function add(s,where){const c=candidate(s);if(!c||NAMES.has(c))return;if(!found.has(c))found.set(c,new Set());found.get(c).add(where);}
for(const f of files){const text=fs.readFileSync(f,'utf8'),rel=path.basename(f);for(const l of literals(text))for(const p of pieces(l.s)){const parts=p.split(/\n/);for(const q of parts)add(q,rel);}}
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
for(const m of html.matchAll(/(?:title|aria-label|placeholder|alt|content)="([^"]+)"/g))add(m[1],'index.html');
for(const m of html.replace(/<(script|style)[\s\S]*?<\/\1>/g,'').replace(/<[^>]*>/g,'\u0002').split('\u0002'))add(m,'index.html');
for(const f of fs.readdirSync(src).filter(f=>/\.css$/.test(f))){const css=fs.readFileSync(path.join(src,f),'utf8');for(const m of css.matchAll(/content:\s*"([^"]+)"/g))add(m[1],f);}
// structured walk of every importable module's exports (strings assembled in code)
let walked=0;
for(const f of files){let mod;try{mod=await import(pathToFileURL(f).href);}catch{continue;}
 const seen=new Set();const walk=(v,d)=>{if(d>6||v==null)return;if(typeof v==='string'){add(v,path.basename(f)+' (export)');return;}if(typeof v!=='object'||seen.has(v))return;seen.add(v);walked++;if(v.isObject3D||v.isMaterial||v.isBufferGeometry||ArrayBuffer.isView(v))return;for(const k of Object.keys(v).slice(0,400))walk(v[k],d+1);};
 for(const [k,v] of Object.entries(mod))if(typeof v!=='function')walk(v,0);}
// trailing quantities and names are translated by rules; a string is covered when the translator changes it
// pieces the code glues together at run time (never a whole line on screen), developer diagnostics and shader code
const FRAGMENT=/^(?:Avatar|Last|From|Rest|Gate|Feed the|Collect from the|Water the|Takes 5 hour5|Buy 5|Take off 5|Lovely 5(?:, 5)?[.!]|\u00b7 5 helper5.*|You are the village leader\. 5|Home, and the 5 too!|🔱 TITAN · 5|A creature file could not load:|transformed.*)$/;
const fragments=[...found.keys()].filter(k=>FRAGMENT.test(k));for(const k of fragments)found.delete(k);
const missing=[],covered=[];
const partial=[];
for(const [s,w] of found){const out=t(s);if(out===s)missing.push([s,[...w]]);else if(englishWords(out).length){partial.push([s,[...w]]);missing.push([s,[...w]]);}else covered.push([s,[...w]]);}
const byArea={};
for(const [s,w] of found){const a=area(w.values().next().value);byArea[a]??={found:0,missing:0};byArea[a].found++;{const o=t(s);if(o===s||englishWords(o).length)byArea[a].missing++;}}
const args=process.argv.slice(2),isMain=import.meta.url===pathToFileURL(process.argv[1]).href;
if(isMain){console.log(`strings found ${found.size}, covered ${covered.length}, missing ${missing.length} (of which half-translated ${partial.length}) (exports walked ${walked})`);
for(const [a,v] of Object.entries(byArea).sort())console.log(`  ${a}: found ${v.found}, missing ${v.missing}`);
if(args.includes('--list'))for(const [s,w] of missing)console.log(JSON.stringify(s)+'  <- '+w.slice(0,3).join(','));
const j=args.indexOf('--json');if(j>=0)fs.writeFileSync(args[j+1],JSON.stringify({found:found.size,covered:covered.length,missing,byArea},null,1));
}
export {missing,found,covered,fragments,partial};
