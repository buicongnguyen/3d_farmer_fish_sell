import fs from 'node:fs/promises';
import {createRequire} from 'node:module';
const require=createRequire(new URL('../../package.json',import.meta.url)),{chromium}=require('playwright');
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage(),rows=[];
const extra=process.argv.includes('--extra'),cases=extra?[['crops',false],['crops',true],['pond',true]]:[false,true].flatMap(mobile=>['village','pond','effects'].map(fixture=>[fixture,mobile]));
for(const [fixture,mobile] of cases)for(const kind of ['control','candidate']){
 const suffix=fixture+(mobile?'-mobile':'-desktop')+(extra?'-fixed':''),a='results/'+(extra?'before':'final-before')+'/'+suffix+'.png',b=kind==='control'?a.replace('.png','-control.png'):'results/'+(extra?'after':'final-after')+'/'+suffix+'.png';
 const urls=await Promise.all([a,b].map(async p=>'data:image/png;base64,'+(await fs.readFile(p)).toString('base64')));
 const row=await page.evaluate(async urls=>{const imgs=await Promise.all(urls.map(src=>new Promise(resolve=>{const im=new Image();im.onload=()=>resolve(im);im.src=src;})));const c=document.createElement('canvas');c.width=imgs[0].width;c.height=imgs[0].height;const ctx=c.getContext('2d',{willReadFrequently:true});const data=imgs.map(im=>{ctx.drawImage(im,0,0);return ctx.getImageData(0,0,c.width,c.height).data;});let exact=0,over24=0,max=0;const diff=ctx.createImageData(c.width,c.height);for(let i=0;i<data[0].length;i+=4){const d=Math.max(...[0,1,2].map(j=>Math.abs(data[0][i+j]-data[1][i+j])));if(d)exact++;if(d>24)over24++;max=Math.max(max,d);diff.data.set(d>24?[255,0,255,255]:[data[1][i]*.3,data[1][i+1]*.3,data[1][i+2]*.3,255],i);}ctx.putImageData(diff,0,0);return{pixels:c.width*c.height,exact,over24,max,diff:c.toDataURL()};},urls);
 await fs.writeFile('results/'+suffix+'-'+kind+'-diff.png',Buffer.from(row.diff.split(',')[1],'base64'));delete row.diff;rows.push({fixture,mobile,kind,...row});console.log(JSON.stringify(rows.at(-1)));
}await browser.close();await fs.writeFile('results/pixels'+(extra?'-extra':'-final')+'.json',JSON.stringify(rows,null,2));
