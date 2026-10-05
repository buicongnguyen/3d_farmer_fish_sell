// The twelve outposts of the ring world (Amendment A3; stage 2): a banner, a lamp and a glowing Home pad on each rest spot of regions.mjs OUTPOSTS.
// One small merged geometry with baked colours and glow on the kit glow material, twelve meshes that share it: only those in view are drawn. Fetched with import() (first-load budget).
import * as T from 'three';
import { glowToon } from './toon.mjs';
import { OUTPOSTS, outpostNear } from './regions.mjs';
import { installRoomView } from './room-view.mjs';

const color = new T.Color();
/** The shape of one outpost, made of boxes and a disc: {pos, col, glow, idx} in local metres (x east, z south, y up). */
function outpostGeometry() {
  const pos = [], col = [], glow = [], idx = [];
  const quad = (a, b, c, d, hex, g) => { const n = pos.length / 3; color.set(hex); for (const p of [a, b, c, d]) { pos.push(...p); col.push(color.r, color.g, color.b); glow.push(g); } idx.push(n, n + 1, n + 2, n, n + 2, n + 3); };
  const box = (x, y, z, w, h, d, hex, g = 0) => {
    const [x0, x1, y0, y1, z0, z1] = [x - w / 2, x + w / 2, y - h / 2, y + h / 2, z - d / 2, z + d / 2];
    quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], hex, g); quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], hex, g);
    quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], hex, g); quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], hex, g);
    quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], hex, g);
  };
  box(0, 1.6, 0, .2, 3.2, .2, '#8a5a3b'); box(.75, 3.05, 0, 1.6, .12, .12, '#8a5a3b');           // the banner pole and its arm
  box(.8, 2.3, 0, 1.15, 1.45, .05, '#ff5f87'); box(.8, 1.62, 0, 1.15, .14, .06, '#ffd84d'); box(.8, 2.55, 0, .5, .5, .07, '#ffffff');  // the cloth, its hem and its mark
  box(-1.3, 1.1, 0, .14, 2.2, .14, '#5a4a3a'); box(-1.3, 2.4, 0, .46, .46, .46, '#fff1a8', 1.6); box(-1.3, 2.72, 0, .62, .1, .62, '#5a4a3a');  // the lamp
  const seg = 20; // the pad: a pale disc and a bright ring, a hair above the ground
  for (const [r0, r1, hex, g, y] of [[0, 2, '#dff6ff', .15, .07], [1.7, 2.1, '#8fe3ff', .9, .09]]) for (let i = 0; i < seg; i++) { const a = i / seg * Math.PI * 2, b = (i + 1) / seg * Math.PI * 2, s = Math.sin, c = Math.cos; quad([s(a) * r0, y, c(a) * r0], [s(b) * r0, y, c(b) * r0], [s(b) * r1, y, c(b) * r1], [s(a) * r1, y, c(a) * r1], hex, g); }
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new T.Float32BufferAttribute(col, 3)); g.setAttribute('glow', new T.Float32BufferAttribute(glow, 1)); g.setIndex(idx);
  g.computeVertexNormals(); g.computeBoundingSphere(); return g;
}

/** Puts the twelve outposts into the outdoor scene. Returns {meshes}. */
export function installOutposts(world) {
  if (world.outpostMeshes) return world.outpostMeshes;
  const geometry = outpostGeometry(), material = glowToon({ side: T.DoubleSide }), meshes = OUTPOSTS.map(o => {
    const m = new T.Mesh(geometry, material); m.position.set(o.x, 0, o.z); m.rotation.y = o.x * .013; m.name = o.id; m.castShadow = false; m.receiveShadow = true; world.outside.add(m); return m;
  });
  // The last outpost you stood at (within 6 m) is saved: old saves wake there, not at the inner circle.
  installRoomView(world).onFrame(() => { if (world.location !== 'village' || !world.player) return; const p = world.player.position, o = outpostNear(p.x, p.z, 6); if (o && world.state.outpost !== o.id) world.state.outpost = o.id; });
  world.outpostMeshes = meshes; return meshes;
}
