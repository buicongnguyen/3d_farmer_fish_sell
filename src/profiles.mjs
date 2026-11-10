// Keep the original save in Profile 1. Pin writes to this tab's slot, even during reload.
export const PROFILE_COUNT=3,PROFILE_KEY='willowmere.profile.v1',BASE_KEY='willowmere.save.v1';
export const validSlot=n=>Number.isInteger(n)&&n>=0&&n<PROFILE_COUNT;
export const slotKey=n=>{if(!validSlot(n))throw Error('Invalid profile.');return n?`${BASE_KEY}.profile${n+1}`:BASE_KEY;};
export function activeSlot(storage){try{const n=Number(storage.getItem(PROFILE_KEY));return validSlot(n)?n:0;}catch{return 0;}}
export function setActiveSlot(storage,n){if(!validSlot(n))return false;try{storage.setItem(PROFILE_KEY,String(n));return true;}catch{return false;}}
export function profileStore(storage,slot=activeSlot(storage)){
 const key=slotKey(slot);
 const map=k=>k===BASE_KEY?key:k===BASE_KEY+'.unread'?key+'.unread':k; // the copy of an unreadable save stays with its own profile
 return {slot,getItem:k=>storage.getItem(map(k)),setItem:(k,v)=>storage.setItem(map(k),v)};
}
