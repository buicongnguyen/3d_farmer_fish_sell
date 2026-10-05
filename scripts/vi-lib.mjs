// Shared by vi-coverage.mjs and vi-walk.mjs: a word-level test for English left inside a Vietnamese string.
import fs from 'node:fs';import path from 'node:path';import {pathToFileURL} from 'node:url';
const root=path.resolve(import.meta.dirname,'..');
const load=async f=>{const p=path.join(root,'src',f);return fs.existsSync(p)?import(pathToFileURL(p).href):{};};
const [ref,own,audit,content]=await Promise.all([load('vi-reference.mjs'),load('vi-willowmere.mjs'),load('vi-audit.mjs'),load('content.mjs')]);
const lower=s=>s.toLowerCase();
export const wordsOf=s=>(s.match(/[A-Za-z\u00C0-\u1EF9]+/g)||[]).map(lower);
const eng=new Set(),vie=new Set();
for(const tb of [ref.VI_REFERENCE,own.VI_WILLOWMERE,audit.VI_AUDIT])if(tb)for(const [k,v] of Object.entries(tb)){for(const w of wordsOf(k))eng.add(w);for(const w of wordsOf(v))vie.add(w);}
export const ALLOW=new Set(['wasd','xp','hp','coins','pip','ada','june','ellis','rowan','willowmere','esc','ok','vi','en','english','wifi','mm','kg','fps','gpu','hud','id','atk','def','crit','lv','jeep','wc','ms','mr','mrs','titan','pandora','chibi','lava','kit','oak','hearth','vale','moss','finch','alder','linden','brook','reed','bell']);
const NAMES=new Set((content.RESIDENTS||[]).map(p=>lower(p.name)));
/** Words of text that are English (known from the English side of the tables, never used on the Vietnamese side). */
export function englishWords(text){const bad=[];for(const w of wordsOf(text)){if(w.length<3||ALLOW.has(w)||NAMES.has(w))continue;if(eng.has(w)&&!vie.has(w))bad.push(w);}return bad;}
