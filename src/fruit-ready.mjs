import * as T from 'three';
import {TREE_SIZE} from './grove.mjs';
const transform=new T.Object3D();
// A fruit tree ready to pick carries a shiny gold coin over its crown (it was a yellow disc with a green tick): the coin turns slowly,
// bobs a little, a band of light sweeps across it every few seconds and a small star glints at its shoulder. One instanced draw for
// every ready tree; the turn, the bob and the glint are in the shader (one time uniform), so nothing is allocated per frame.
/** The coin's quad in metres (the coin itself is 100/128 of it across: 1.13 m) and how far it bobs. */
export const COIN={quad:1.45,bob:.09};
function coinTexture(){
 const canvas=document.createElement('canvas');canvas.width=canvas.height=128;const g=canvas.getContext('2d'),disc=(r,fill)=>{g.beginPath();g.arc(64,64,r,0,Math.PI*2);g.fillStyle=fill;g.fill();};
 const star=(cx,cy,R,r,fill)=>{g.beginPath();for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,k=i%2?r:R;g.lineTo(cx+Math.cos(a)*k,cy+Math.sin(a)*k);}g.closePath();g.fillStyle=fill;g.fill();};
 disc(50,'#b96a06');const face=g.createLinearGradient(30,24,98,104);face.addColorStop(0,'#fff6a8');face.addColorStop(.45,'#ffd132');face.addColorStop(1,'#f29a12');disc(45.5,face); // the dark edge, the gold face
 g.lineWidth=3.5;g.strokeStyle='#fff3a0';g.beginPath();g.arc(64,64,43,0,Math.PI*2);g.stroke();g.lineWidth=2.5;g.strokeStyle='#d98a0c';g.beginPath();g.arc(64,64,35,0,Math.PI*2);g.stroke(); // the lighter rim, the groove inside it
 star(66,67,24,10.5,'#c97a08');star(64,64.5,24,10.5,'#fff7c4'); // the star, embossed (its shadow first)
 g.lineWidth=5;g.lineCap='round';g.strokeStyle='rgba(255,255,255,.8)';g.beginPath();g.arc(64,64,39,Math.PI*1.08,Math.PI*1.42);g.stroke(); // a highlight on the upper left
 const map=new T.CanvasTexture(canvas);map.colorSpace=T.SRGBColorSpace;return map;
}
const VERTEX=`uniform float time;varying vec2 uv0;varying float turn;
void main(){uv0=uv;vec4 at=instanceMatrix*vec4(0.,0.,0.,1.);float phase=at.x*1.7+at.z*.9,c=cos(time*1.7+phase);turn=abs(c);
vec4 p=modelViewMatrix*at;p.x+=position.x*max(turn,.2)*${COIN.quad};p.y+=position.y*${COIN.quad}+sin(time*2.3+phase)*${COIN.bob};gl_Position=projectionMatrix*p;}`;
const FRAGMENT=`uniform sampler2D map;uniform float time;varying vec2 uv0;varying float turn;
void main(){vec4 c=texture2D(map,uv0);float sweep=fract(time*.31)*3.2-.6,band=smoothstep(.1,0.,abs((uv0.x+uv0.y)*.5-sweep));
vec2 d=uv0-vec2(.8,.82);float star=clamp(.0011/((abs(d.x)+.012)*(abs(d.y)+.012)),0.,1.)*smoothstep(.2,.02,length(d))*pow(max(0.,sin(time*2.4)),4.);
float a=max(c.a,star);if(a<.1)discard;vec3 rgb=c.rgb*(.72+.28*turn)+vec3(1.,.98,.8)*band*.7*c.a;gl_FragColor=vec4(mix(rgb,vec3(1.,1.,.9),star),a);
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`;
export class FruitReadyView{
 constructor(world,capacity){this.world=world;const uniforms={map:{value:coinTexture()},time:{value:0}};this.mesh=new T.InstancedMesh(new T.PlaneGeometry(1,1),new T.ShaderMaterial({uniforms,transparent:true,depthWrite:false,vertexShader:VERTEX,fragmentShader:FRAGMENT}),capacity);this.mesh.name='fruit-ready-badges';this.mesh.frustumCulled=false;this.mesh.raycast=()=>{};this.mesh.count=0;this.mesh.visible=false;this.mesh.onBeforeRender=()=>{uniforms.time.value=world.t;};world.outside.add(this.mesh);}
 sync(plan){for(const target of this.world.targets)if(target.type==='tree'||target.type==='spot'){target.hit.scale.y=1;target.hit.position.y=1.1;}const ready=plan.trees.filter(t=>t.ready);this.mesh.count=ready.length;this.mesh.visible=ready.length>0;ready.forEach((t,i)=>{transform.position.set(t.x,TREE_SIZE+.65,t.z);transform.updateMatrix();this.mesh.setMatrixAt(i,transform.matrix);});this.mesh.instanceMatrix.needsUpdate=true;for(const t of plan.trees){const target=this.world.targets.find(a=>a.type===(t.where==='orchard'?'tree':'spot')&&Number(a.id)===t.index);if(target){target.hit.scale.y=t.ready?2.2:1;target.hit.position.y=t.ready?2.75:1.1;}}}
}
