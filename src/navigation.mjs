// A small visibility graph routes around village buildings without searching an
// enormous world grid. Long meadow walks therefore cost the same as short ones.
export function findRoute(start, end, obstacles, bounds) {
  if (![start.x, start.z, end.x, end.z].every(Number.isFinite)) return [];
  const boxes = obstacles.map(c => ({ minX:c.x-c.w/2-.33, maxX:c.x+c.w/2+.33, minZ:c.z-c.d/2-.33, maxZ:c.z+c.d/2+.33 }));
  const valid = p => Math.abs(p.x) <= bounds.x && Math.abs(p.z) <= bounds.z && !boxes.some(b => p.x>b.minX&&p.x<b.maxX&&p.z>b.minZ&&p.z<b.maxZ);
  if (!valid(end)) return [];
  const clear = (a, b) => !boxes.some(box => {
    let low=0, high=1;
    for (const [key,min,max] of [['x',box.minX,box.maxX],['z',box.minZ,box.maxZ]]) {
      const delta=b[key]-a[key];
      if (Math.abs(delta)<1e-9) { if(a[key]<=min||a[key]>=max) return false; }
      else { const t1=(min-a[key])/delta,t2=(max-a[key])/delta;low=Math.max(low,Math.min(t1,t2));high=Math.min(high,Math.max(t1,t2));if(high<=low)return false; }
    }
    return high>0&&low<1;
  });
  if (clear(start,end)) return [{...end}];
  const nodes=[{...start},{...end}];
  for (const b of boxes) for (const x of [b.minX-.4,b.maxX+.4]) for (const z of [b.minZ-.4,b.maxZ+.4]) if(valid({x,z}))nodes.push({x,z});
  const costs=Array(nodes.length).fill(Infinity),previous=Array(nodes.length).fill(-1),closed=new Set();costs[0]=0;
  for(let iteration=0;iteration<nodes.length;iteration++) {
    let current=-1,score=Infinity;
    for(let i=0;i<nodes.length;i++)if(!closed.has(i)&&costs[i]<Infinity){const estimate=costs[i]+Math.hypot(nodes[i].x-end.x,nodes[i].z-end.z);if(estimate<score){score=estimate;current=i;}}
    if(current<0)return [];
    if(current===1){const route=[];for(let i=1;i!==0;i=previous[i])route.unshift(nodes[i]);return route;}
    closed.add(current);
    for(let i=1;i<nodes.length;i++){if(closed.has(i)||i===current)continue;const distance=Math.hypot(nodes[i].x-nodes[current].x,nodes[i].z-nodes[current].z),next=costs[current]+distance;if(next<costs[i]&&clear(nodes[current],nodes[i])){costs[i]=next;previous[i]=current;}}
  }
  return [];
}
