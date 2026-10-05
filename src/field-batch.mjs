import {act,bedCount,ripe} from './game.mjs';
import {CROPS} from './content.mjs';
export function fieldCounts(s,crop){
 const beds=s.beds.slice(0,bedCount(s)),empty=beds.filter(b=>!b).length;
 return {empty,ready:beds.filter(b=>ripe(s,b)).length,plant:CROPS[crop]?Math.min(empty,Math.floor(s.energy/2),CROPS[crop].free?empty:s.inventory['seed_'+crop]??0):0};
}
export function fieldBatch(s,type,crop){
 if(type!=='plant'&&type!=='harvest')return {ok:false,message:'Choose planting or harvesting.',count:0};
 let count=0,reason='';
 for(let index=0;index<bedCount(s);index++){
  if(type==='plant'?!!s.beds[index]:!ripe(s,s.beds[index]))continue;
  const result=act(s,type,{index,crop});if(!result.ok){reason=result.message;break;}count++;
 }
 return {ok:count>0,count,message:count?`${type==='plant'?'Planted':'Harvested'} ${count} garden beds.${reason?' · '+reason:''}`:reason||(type==='plant'?'There are no empty garden beds.':'Nothing is ripe yet.')};
}
