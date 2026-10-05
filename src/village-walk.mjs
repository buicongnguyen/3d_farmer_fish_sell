// Personal space for walkers. A person already overlapping may step out, but never farther in.
const sq = (x, z) => x * x + z * z;
const clear = (from, x, z, p, room) => { const d = sq(x - p.x, z - p.z); return d >= room * room || d > sq(from.x - p.x, from.z - p.z) + 1e-9; };
const ANGLES = [0, .7, -.7, 1.57, -1.57];
export function peopleClear(w, self, x, z) {
  const from = self ? self.mesh.position : w.player.position;
  if (self && !w.riding && !clear(from, x, z, w.player.position, .9)) return false;
  for (const o of w.npcs) if (o !== self && !o.inside && o.mesh.visible && !o.ride?.busy && !clear(from, x, z, o.mesh.position, self ? .85 : .9)) return false;
  return true;
}
// Try the lane first, then bear right so two people approaching head-on pass on opposite sides.
export function walkPerson(w, n, dx, dz, distance, dt=distance/2.6) {
  const at = n.mesh.position, d = Math.hypot(dx, dz); if (!d) return 0;
  const gx=at.x+dx,gz=at.z+dz;
  let traffic=n.traffic;
  if(!traffic||Math.hypot(traffic.x-gx,traffic.z-gz)>.01)traffic=n.traffic={x:gx,z:gz,best:d,wait:0,aside:null};
  if(d<traffic.best-.12){traffic.best=d;traffic.wait=0;}else traffic.wait+=dt;
  // Commit to a short retreat instead of alternating left/right against the same crowd.
  // Stagger who yields so everyone does not reverse together. Every segment keeps personal space.
  if(!traffic.aside&&traffic.wait>.65+((n.p?.index??w.npcs.indexOf(n))%5)*.17){
    const ux=dx/d,uz=dz/d;
    for(const angle of [2.2,-2.2,Math.PI,1.57,-1.57]){
      const c=Math.cos(angle),s=Math.sin(angle),ax=ux*c+uz*s,az=uz*c-ux*s;
      let clear=true;
      for(let t=.12;t<=1.32;t+=.12)if(w.blocked(at.x+ax*t,at.z+az*t)||!peopleClear(w,n,at.x+ax*t,at.z+az*t)){clear=false;break;}
      if(clear){traffic.aside={x:at.x+ax*1.32,z:at.z+az*1.32,left:1.6};traffic.announce=true;break;}
    }
    traffic.wait=0;
  }
  if(traffic.aside){
    const side=traffic.aside,sd=Math.hypot(side.x-at.x,side.z-at.z);side.left-=dt;
    if(sd<.12||side.left<=0){traffic.aside=null;traffic.best=d;traffic.wait=0;}
    else{dx=side.x-at.x;dz=side.z-at.z;distance=Math.min(distance,sd);}
  }
  const length=Math.hypot(dx,dz);
  dx /= length; dz /= length;
  for (const angle of ANGLES) {
    const c = Math.cos(angle), s = Math.sin(angle), ux = dx * c + dz * s, uz = dz * c - dx * s;
    const x = at.x + ux * distance, z = at.z + uz * distance;
    if (w.blocked(x, z) || !peopleClear(w, n, x, z)) continue;
    at.x = x; at.z = z; return distance;
  }
  return 0;
}
