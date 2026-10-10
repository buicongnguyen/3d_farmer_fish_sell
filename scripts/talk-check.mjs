// Checks conversation tables (src/talk-*.mjs) against the rules of src/facility-talk.mjs: node scripts/talk-check.mjs [file ...]
import fs from 'node:fs';import path from 'node:path';import {pathToFileURL} from 'node:url';
import {validate,measure} from '../src/facility-talk.mjs';
const src=path.resolve(import.meta.dirname,'..','src'),files=process.argv.length>2?process.argv.slice(2).map(f=>path.resolve(f)):fs.readdirSync(src).filter(f=>/^talk-.*\.mjs$/.test(f)&&f!=='talk-things.mjs').map(f=>path.join(src,f));
let bad=0;const total={trees:0,nodes:0,lines:0};
for(const f of files){const table=(await import(pathToFileURL(f).href)).default,problems=validate(table,path.basename(f)),m=measure(table);for(const k in total)total[k]+=m[k];
 console.log(`${path.basename(f)}: ${m.trees} trees, ${m.nodes} questions, ${m.lines} lines · ${Object.entries(table).map(([who,l])=>`${who} ${l.length}`).join(', ')}`);for(const p of problems)console.log('  ✗ '+p);bad+=problems.length;}
console.log(`total: ${total.trees} trees, ${total.nodes} questions, ${total.lines} lines (each in English and Vietnamese); ${bad} problem${bad===1?'':'s'}`);process.exit(bad?1:0);
