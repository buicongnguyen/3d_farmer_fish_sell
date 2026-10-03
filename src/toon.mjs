import * as T from 'three';
// The reference look (cute_game toon.ts): one 4-step ramp, nearest filtering, a hemisphere light and a sun,
// no tone mapping. Flat light bands read as hand-painted toys and cost less than PBR shading.
export const TOON_STEPS=[110,185,235,255];
const data=new Uint8Array(TOON_STEPS.length*4);TOON_STEPS.forEach((v,i)=>data.set([v,v,v,255],i*4));
export const TOON_RAMP=new T.DataTexture(data,TOON_STEPS.length,1);TOON_RAMP.minFilter=TOON_RAMP.magFilter=T.NearestFilter;TOON_RAMP.generateMipmaps=false;TOON_RAMP.needsUpdate=true;
export const toon=(parameters={})=>new T.MeshToonMaterial({...parameters,gradientMap:TOON_RAMP});
export const LIGHT={sky:'#e8f6ff',ground:'#9ccf7a',hemi:1.5,sun:'#fff4dd',sunIntensity:2.4};
// Value noise shared by the ground and scenery.
const hash=(x,z)=>{const v=Math.sin(x*127.1+z*311.7)*43758.5453;return v-Math.floor(v);};
export function noise2(x,z){const ix=Math.floor(x),iz=Math.floor(z),fx=x-ix,fz=z-iz,sx=fx*fx*(3-2*fx),sz=fz*fz*(3-2*fz),a=hash(ix,iz),b=hash(ix+1,iz),c=hash(ix,iz+1),d=hash(ix+1,iz+1);return a+(b-a)*sx+(c-a)*sz+(a-b-c+d)*sx*sz;}
export const smoothstep=(v,a,b)=>{const t=Math.min(1,Math.max(0,(v-a)/(b-a)));return t*t*(3-2*t);};
