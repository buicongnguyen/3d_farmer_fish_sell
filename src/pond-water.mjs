// The family pond's bank and water, from cute_game's pond-view.ts: two smooth vertex-coloured meshes (the bank: deep middle, shallows,
// a sandy lip just above the water line, then out over the grass where its alpha fades to nothing; the water: a translucent sheet
// lighter and foamier toward the rim). The reference's pond is round, so its rings are polar; here each ring is a rounded rectangle.
// Same profile tables, same colours. Toon material, no textures, no shaders, no shadows: 2 draws.
import * as T from 'three';
import { toon } from './toon.mjs';
import { POND } from './content.mjs';
import { SURFACE } from './pond-sim.mjs';

export const LOOK = { water: '#5ec8ff', sand: '#e6dc9e', deep: '#5ab4d8', shallow: '#9bd3dc' };
const CORNER = 2.5, PER = 10, R = Math.min(POND.w, POND.d) / 2;
// [offset from the water line (negative = under water; a function gets the half depth R), height, colour, alpha]
const BANK = [[r => -r, .02, 'deep', 1], [r => -r * .55, .03, 'deep', 1], [r => -r * .28, .07, ['deep', 'shallow', .5], 1], [-.55, .15, 'shallow', 1], [-.18, .25, ['shallow', 'sand', .55], 1], [0, .3, ['sand', 'shallow', .18], 1], [.16, .33, 'sand', 1], [.42, .12, 'sand', .7], [.8, .03, 'sand', .3], [1.2, .008, 'sand', 0]];
// Alpha is lower in the middle than Zoo's .5 (the fish seen through it keep their colour: an orange carp under half a sheet of blue turns grey-green).
const WATER = [[r => -r, 0, .3], [r => -r * .45, .03, .3], [-.9, .12, .3], [-.32, .3, .36], [-.08, .62, .66], [.12, .7, .8]];
const white = new T.Color('#ffffff'), c1 = new T.Color(), c2 = new T.Color();

/** The outline of the water line pushed out by `o` metres: a rounded rectangle, 4 * (PER + 1) points, in order round. */
export function outline(o, pond = POND, corner = CORNER) {
  const A = Math.max(.25, pond.w / 2 + o), B = Math.max(.25, pond.d / 2 + o), C = Math.min(Math.max(.12, corner + o), A, B), ix = A - C, iz = B - C, pts = [];
  // Quadrants counter-clockwise from +x: the straight edges are the jumps between a quadrant's last point and the next one's first.
  for (let q = 0; q < 4; q++) {
    const sx = q === 0 || q === 3 ? 1 : -1, sz = q < 2 ? 1 : -1;
    for (let k = 0; k <= PER; k++) { const a = q * Math.PI / 2 + k / PER * Math.PI / 2; pts.push([sx * ix + Math.cos(a) * C, sz * iz + Math.sin(a) * C]); }
  }
  return pts;
}
function ringMesh(rings, material) {
  const n = rings[0].pts.length, count = 1 + rings.length * n, position = new Float32Array(count * 3), color = new Float32Array(count * 4), normal = new Float32Array(count * 3);
  const put = (i, x, y, z, c, a) => { position.set([x, y, z], i * 3); normal.set([0, 1, 0], i * 3); color.set([c.r, c.g, c.b, a], i * 4); };
  put(0, 0, rings[0].y, 0, rings[0].color, rings[0].alpha);
  rings.forEach((ring, k) => ring.pts.forEach(([x, z], s) => put(1 + k * n + s, x, ring.y, z, ring.color, ring.alpha)));
  const index = []; for (let s = 0; s < n; s++) index.push(0, 1 + (s + 1) % n, 1 + s);
  for (let k = 0; k < rings.length - 1; k++) for (let s = 0; s < n; s++) { const a = 1 + k * n + s, a2 = 1 + k * n + (s + 1) % n, b = a + n, b2 = a2 + n; index.push(a, a2, b, a2, b2, b); }
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(position, 3)); g.setAttribute('normal', new T.BufferAttribute(normal, 3)); g.setAttribute('color', new T.BufferAttribute(color, 4)); g.setIndex(index); g.computeBoundingSphere();
  const mesh = new T.Mesh(g, material); mesh.raycast = () => {}; mesh.castShadow = false; return mesh;
}
/** The bank and the water, as one group centred on the pond. */
export function buildPondWater() {
  const colour = c => Array.isArray(c) ? c1.set(LOOK[c[0]]).lerp(c2.set(LOOK[c[1]]), c[2]).clone() : new T.Color(LOOK[c]);
  const off = o => typeof o === 'function' ? o(R) : o;
  const bank = ringMesh(BANK.map(([o, y, c, alpha]) => ({ pts: outline(off(o)), y, color: colour(c), alpha })), toon({ vertexColors: true, transparent: true }));
  bank.name = 'pond-bank'; bank.renderOrder = -1; bank.receiveShadow = true;
  const base = new T.Color(LOOK.water);
  const water = ringMesh(WATER.map(([o, w, alpha]) => ({ pts: outline(off(o)), y: SURFACE, color: base.clone().lerp(white, w), alpha })), toon({ vertexColors: true, transparent: true, depthWrite: false }));
  water.name = 'pond-water'; water.renderOrder = 1;
  const group = new T.Group(); group.name = 'pond'; group.add(bank, water); group.position.set(POND.x, 0, POND.z); return group;
}
