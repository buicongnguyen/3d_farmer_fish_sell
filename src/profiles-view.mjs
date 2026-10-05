import './profiles.css';
import {PROFILE_COUNT,slotKey,setActiveSlot} from './profiles.mjs';
import {parseSave} from './game.mjs';
export function profileSummary(storage,slot){
 try{const raw=storage.getItem(slotKey(slot));if(!raw)return 'New game';const s=parseSave(JSON.parse(raw));return `Day ${s.day} · ${s.coins.toLocaleString()} coins · Album ${s.chapter}/8`;}catch{return 'Save unavailable';}
}
export function installProfiles({storage,slot,beforeSwitch,onError}){
 function picker(){return `<fieldset class="profile-picker"><legend>Choose a save profile</legend>${Array.from({length:PROFILE_COUNT},(_,i)=>`<button type="button" data-profile-slot="${i}" aria-pressed="${i===slot}" class="${i===slot?'selected':''}"><b>Profile ${i+1}</b><small>${profileSummary(storage,i)}</small></button>`).join('')}</fieldset>`;}
 function refresh(){
  const welcome=document.getElementById('profile-picker');if(welcome)welcome.innerHTML=picker();
  const save=document.querySelector('#modal .save-box');if(save){let area=document.getElementById('settings-profiles');if(!area){area=document.createElement('div');area.id='settings-profiles';save.before(area);}area.innerHTML=picker();}
 }
 document.addEventListener('click',e=>{const b=e.target.closest('[data-profile-slot]');if(!b)return;const next=Number(b.dataset.profileSlot);if(next===slot)return;
  if(!beforeSwitch()||!setActiveSlot(storage,next)){onError('Could not switch profiles. Export your save from Settings to keep your progress.');return;}
  location.reload();
 });
 refresh();return{refresh};
}
