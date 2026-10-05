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
// Kit pieces that glow (round 8, builder A; spec 3.5). The scenery kits mark crystals, lava, embers and ice with emissive
// materials; world.mjs bake() keeps each material's strength in a per-vertex `glow` attribute beside the baked colour, and
// this one material adds colour x glow to the emissive term. One material for every kit piece, glowing or not: no extra draw.
// glowToon.patched says whether three's shader had the two places the patch needs (if a three.js upgrade moves them, the
// pieces still draw, without their glow).
export function glowToon(parameters={}){
 const material=toon({vertexColors:true,...parameters});
 material.onBeforeCompile=shader=>{
  const v=shader.vertexShader,f=shader.fragmentShader;
  glowToon.patched=v.includes('#include <begin_vertex>')&&f.includes('#include <emissivemap_fragment>');
  shader.vertexShader=v.replace('#include <common>','#include <common>\nattribute float glow;\nvarying float vGlow;').replace('#include <begin_vertex>','#include <begin_vertex>\nvGlow = glow;');
  shader.fragmentShader=f.replace('#include <common>','#include <common>\nvarying float vGlow;').replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * vGlow;');
 };
 material.customProgramCacheKey=()=>'glow-toon';
 return material;
}
glowToon.patched=null;
// Hot ground (the Ember Fields, addendum 3: hot lands read hot at a glance): a vertex colour far redder than blue glows by itself, so the
// land's seams, ember beds and pool rims stay bright in any light. The reference's own lava colours (low, high, patch, scorch) sit well
// below the threshold and are lit as before. Same draws: it replaces the land material on that land's tiles.
export function hotToon(){const m=toon({color:'#ffffff',vertexColors:true});m.onBeforeCompile=s=>{s.fragmentShader=s.fragmentShader.replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * smoothstep(.3,.75,diffuseColor.r-diffuseColor.b) * 1.3;');};m.customProgramCacheKey=()=>'hot-toon';return m;}
// The ground of round 9 (ring world, stage 2): ONE material for every ground tile. A `look` attribute (vec3, written per vertex with the colour,
// so it ramps softly across a border with the colour) says how much of the toy checker (x), of the hot glow (y) and of the season's tint (z) a point has.
// The checker is drawn from world position (4 m squares, crisp) so it never needs a texture or a material of its own.
export function groundToon(low,high){
 const m=toon({color:'#ffffff',vertexColors:true}),u={uLow:{value:new T.Color(low)},uHigh:{value:new T.Color(high)},uSeason:{value:new T.Color('#ffffff')}};
 m.userData.season=u.uSeason.value;
 m.onBeforeCompile=s=>{Object.assign(s.uniforms,u);
  s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nattribute vec3 look;varying vec3 vLook;varying vec2 vGW;').replace('#include <begin_vertex>','#include <begin_vertex>\nvLook=look;vGW=(modelMatrix*vec4(transformed,1.)).xz;');
  s.fragmentShader=s.fragmentShader.replace('#include <common>','#include <common>\nuniform vec3 uLow,uHigh,uSeason;varying vec3 vLook;varying vec2 vGW;')
   .replace('#include <color_fragment>','#include <color_fragment>\nvec2 cq=floor(vGW/4.);diffuseColor.rgb*=mix(vec3(1.),mix(uLow,uHigh,mod(cq.x+cq.y,2.)),vLook.x)*mix(vec3(1.),uSeason,vLook.z);')
   .replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\ntotalEmissiveRadiance+=diffuseColor.rgb*smoothstep(.3,.75,diffuseColor.r-diffuseColor.b)*1.3*vLook.y;');};
 m.customProgramCacheKey=()=>'ground-look';return m;
}
let kit=null;
/** The one material every scenery kit piece and stand-in shape is drawn with (world.mjs loadKit, fields.mjs). */
let kitC=null;const depths={};
export const kitMaterial=c=>c?kitC??=glowToon():kit??=glowToon();
// Three draws every shadow caster with one shared depth material and re-derives its program whenever the next caster differs (skinned or
// instanced, with instance colours or not): a cache lookup that allocates, many times a frame. One depth material per kind ends that.
export const depthFor=m=>{const a=m.material,k=m.isSkinnedMesh?2:m.isInstancedMesh?m.instanceColor?5:4:0;if(k&&!a.alphaTest&&!a.map)m.customDepthMaterial=depths[k]??=new T.MeshDepthMaterial({depthPacking:T.RGBADepthPacking});return m;};
