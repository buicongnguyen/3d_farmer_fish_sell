import './language.css';
import {getLanguage,setLanguage,onLanguageChange,t} from './i18n.mjs';
import {RESIDENTS} from './content.mjs';
const names=new Set(['Rowan',...RESIDENTS.map(p=>p.name)]),attrs=['title','aria-label','placeholder','alt'];
const skip=el=>el?.closest('script,style,code,kbd,textarea,[data-i18n-skip],[translate="no"]');
export function installLanguage(worldOf=()=>null){
 const root=document.getElementById('app'),sources=new WeakMap();
 function translate(node,attribute){
  const el=node.nodeType===3?node.parentElement:node;if(skip(el))return;
  const current=attribute?node.getAttribute(attribute):node.textContent;if(!current||!current.trim()||names.has(current.trim()))return;
  let saved=sources.get(node);if(!saved){saved={};sources.set(node,saved);}const key=attribute??'text';
  let entry=saved[key];if(!entry||entry.last!==current)entry=saved[key]={source:current,last:current};
  const next=t(entry.source);entry.last=next;if(next!==current){if(attribute)node.setAttribute(attribute,next);else node.textContent=next;}
 }
 function walk(node){
  if(node.nodeType===3){translate(node);return;}if(node.nodeType!==1||skip(node))return;
  for(const attr of attrs)if(node.hasAttribute(attr))translate(node,attr);
  for(const child of node.childNodes)walk(child);
 }
 function selector(place){const area=document.createElement('div');area.className='language-picker';area.innerHTML=`<label for="language-${place}">Language</label><select id="language-${place}" data-language aria-label="Choose your language"><option value="en" data-i18n-skip>English</option><option value="vi" data-i18n-skip>Tiếng Việt</option></select>`;area.querySelector('select').value=getLanguage();return area;}
 const signTexts=new WeakMap();let signWorld,signCount=-1,signLanguage;
 function signs(){const w=worldOf();if(!w)return;w.translate=t;const lang=getLanguage();if(w===signWorld&&w.labels.length===signCount&&lang===signLanguage)return;signWorld=w;signCount=w.labels.length;signLanguage=lang;for(const label of w.labels){const source=label.userData.label;if(!source)continue;const next=t(source);if(next===(signTexts.get(label)??source))continue;const map=label.material.map,c=map.image,g=c.getContext('2d');g.clearRect(0,0,c.width,c.height);g.strokeText(next,256,64,490);g.fillText(next,256,64,490);map.needsUpdate=true;signTexts.set(label,next);}}
 function selectors(){signs();
  const welcome=document.querySelector('.welcome-card');if(welcome&&!document.getElementById('language-welcome'))welcome.prepend(selector('welcome'));
  const modal=document.getElementById('modal');if(modal?.querySelector('#quality')&&!document.getElementById('language-settings'))modal.querySelector('.modal-content').prepend(selector('settings'));
 }
 function refresh(){selectors();root.querySelectorAll('[data-language]').forEach(el=>el.value=getLanguage());walk(root);}
 root.addEventListener('change',e=>{if(e.target.matches('[data-language]'))setLanguage(e.target.value==='vi'?'vi':'en');});
 const observer=new MutationObserver(records=>{
  selectors();for(const r of records){if(r.type==='characterData')translate(r.target);else if(r.type==='attributes')translate(r.target,r.attributeName);else for(const n of r.addedNodes)walk(n);}
 });
 observer.observe(root,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:attrs});
 onLanguageChange(refresh);refresh();return{refresh};
}

export {t};
