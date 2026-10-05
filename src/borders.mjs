// The rainbow borders (round 8, rebuilt for the ring world in round 9; spec 2.8). The reference draws no borders; the user asked for them:
// "there is rainbow border for each region so that we can see it clear".
//
// One static mesh, built once at boot from regions.mjs BORDER_RUNS (never typed by hand), always visible, box open or shut:
// one draw, vertex colours only, no blending, no per-frame work. Every run is a flat ribbon at y 0.03:
//
//   white edge 0.2 | the accent of the region on that side 0.6 | seven rainbow stripes of 0.34 | the other accent 0.6 | white edge 0.2
//
// 3.98 m wide for a full run (seam, shared, sector, outer), half that (1.99 m) for the ward's outline, so the ward's ribbon stays
// a metre clear of the ring road's asphalt. Arc runs (the two circles) are exactly concentric strips drawn every ARC_STEP degrees,
// so a strip never varies in width; segment runs (the ward, the four axes, the eight radials) are straight strips.
// A full segment is shortened by 2 m at both ends and a slim one by 1.1 m; a seam starts 1.1 m past its run start (the slim knot
// of the ward stands there); a full arc is shortened by 2 / r radians at both ends. 16 full 4.4 m knots stand where the radials meet
// the two circles and 8 slim 2.2 m ones on the ward line (four corners, four axis points), a millimetre higher, so crossing ribbons
// never overlap. 36 runs: (16 arcs x 15 steps + 20 segments) x 11 strips + 24 knots = 2,884 quads, 5,768 triangles, one draw.
//
// On "high" graphics only, the outer circle also carries a 5 m additive shimmer (one more draw): the world's edge reads as a soft
// wall of light and not as a line on the ground.
import * as T from 'three';
import { BORDER_RUNS, RING, ARC_STEP, REGION } from './regions.mjs';
import { SAFE } from './ward.mjs';
import { hyp } from './hyp.mjs';

export const RAINBOW = Object.freeze(['#ff4d5e', '#ff9f3f', '#ffe14d', '#5fd66a', '#4cc3ff', '#6f7bff', '#c66bff']);
export const RIBBON = Object.freeze({ y: .03, knotY: .031, edge: .2, side: .6, stripe: .34, width: 3.98, cut: 2, slimCut: 1.1, knot: 4.4, slimKnot: 2.2, curtain: 5 });
const WHITE = '#ffffff';

const RAD = Math.PI / 180;
/** The knots: the 16 full ones where the eight radials meet R1 and R2, the 8 slim ones on the ward line (four corners, four axis points). [[x, z, size]]. */
export function knotList() {
  const out = [];
  for (const r of [RING.R1, RING.R2]) for (let k = 0; k < 8; k++) out.push([r * Math.sin(45 * k * RAD), -r * Math.cos(45 * k * RAD), RIBBON.knot]);
  for (const [x, z] of [[SAFE.x0, SAFE.z0], [0, SAFE.z0], [SAFE.x1, SAFE.z0], [SAFE.x1, 0], [SAFE.x1, SAFE.z1], [0, SAFE.z1], [SAFE.x0, SAFE.z1], [SAFE.x0, 0]]) out.push([x, z, RIBBON.slimKnot]);
  return out;
}
const stripsOf = run => [[RIBBON.edge, WHITE], [RIBBON.side, run.left ? REGION[run.left].accent : WHITE], ...RAINBOW.map(c => [RIBBON.stripe, c]), [RIBBON.side, run.right ? REGION[run.right].accent : WHITE], [RIBBON.edge, WHITE]];
/**
 * The ribbon as flat quads: [{corners: [[x, z] x 4], y, color}], pure. Each run gives 11 per step (its strips from its left side
 * to its right), each knot 1.
 */
export function borderQuads(runs = BORDER_RUNS) {
  const quads = [];
  for (const run of runs) {
    const full = run.kind !== 'ward', k = run.half / (RIBBON.width / 2), strips = stripsOf(run);
    if (run.type === 'arc') {
      const cut = RIBBON.cut / run.r / RAD, b0 = run.b0 + cut, b1 = run.b1 - cut, steps = Math.ceil((b1 - b0) / ARC_STEP - 1e-9), P = (b, o) => [(run.r + o) * Math.sin(b * RAD), -(run.r + o) * Math.cos(b * RAD)];
      for (let i = 0; i < steps; i++) {
        const ba = b0 + (b1 - b0) * i / steps, bb = b0 + (b1 - b0) * (i + 1) / steps; let offset = run.half;
        for (const [width, color] of strips) { const next = offset - width * k; quads.push({ corners: [P(ba, offset), P(bb, offset), P(bb, next), P(ba, next)], y: RIBBON.y, color }); offset = next; }
      }
      continue;
    }
    const length = hyp(run.bx - run.ax, run.bz - run.az), cutEnd = full ? RIBBON.cut : RIBBON.slimCut, cutStart = run.kind === 'seam' ? RIBBON.slimCut : cutEnd;
    if (length <= cutStart + cutEnd) continue; // a side too short is covered by its knots alone
    const dx = (run.bx - run.ax) / length, dz = (run.bz - run.az) / length, ax = run.ax + dx * cutStart, az = run.az + dz * cutStart, bx = run.bx - dx * cutEnd, bz = run.bz - dz * cutEnd;
    let offset = run.half;
    for (const [width, color] of strips) {
      const next = offset - width * k;
      quads.push({ corners: [[ax + run.nx * offset, az + run.nz * offset], [bx + run.nx * offset, bz + run.nz * offset], [bx + run.nx * next, bz + run.nz * next], [ax + run.nx * next, az + run.nz * next]], y: RIBBON.y, color });
      offset = next;
    }
  }
  const knot = (x, z, size) => quads.push({ corners: [[x - size / 2, z - size / 2], [x + size / 2, z - size / 2], [x + size / 2, z + size / 2], [x - size / 2, z + size / 2]], y: RIBBON.knotY, color: WHITE });
  for (const [x, z, size] of knotList()) knot(x, z, size);
  return quads;
}

function quadGeometry(quads) {
  const position = new Float32Array(quads.length * 12), color = new Float32Array(quads.length * 12), index = new Uint16Array(quads.length * 6), c = new T.Color();
  quads.forEach((q, i) => {
    c.set(q.color);
    q.corners.forEach(([x, z], k) => { position.set([x, q.y, z], i * 12 + k * 3); color.set([c.r, c.g, c.b], i * 12 + k * 3); });
    index.set([i * 4, i * 4 + 2, i * 4 + 1, i * 4, i * 4 + 3, i * 4 + 2], i * 6);
  });
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.BufferAttribute(position, 3)); geometry.setAttribute('color', new T.BufferAttribute(color, 3)); geometry.setIndex(new T.BufferAttribute(index, 1));
  geometry.computeBoundingSphere(); geometry.computeBoundingBox();
  return geometry;
}
/** The shimmer over the outer circle: upright quads, the rainbow along each arc run, full colour at the ground and none at the top. One open cylinder of radius R2, 5 m tall, a piece every ARC_STEP degrees. */
function curtainGeometry(runs) {
  const position = [], color = [], index = [], c = new T.Color(); let n = 0;
  for (const run of runs) {
    const steps = Math.round((run.b1 - run.b0) / ARC_STEP), P = b => [run.r * Math.sin(b * RAD), -run.r * Math.cos(b * RAD)];
    for (let i = 0; i < steps; i++, n++) {
      const [x0, z0] = P(run.b0 + (run.b1 - run.b0) * i / steps), [x1, z1] = P(run.b0 + (run.b1 - run.b0) * (i + 1) / steps), at = position.length / 3;
      position.push(x0, RIBBON.y, z0, x1, RIBBON.y, z1, x1, RIBBON.curtain, z1, x0, RIBBON.curtain, z0);
      c.set(RAINBOW[n % RAINBOW.length]); color.push(c.r, c.g, c.b); c.set(RAINBOW[(n + 1) % RAINBOW.length]); color.push(c.r, c.g, c.b, 0, 0, 0, 0, 0, 0);
      index.push(at, at + 1, at + 2, at, at + 2, at + 3);
    }
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.Float32BufferAttribute(position, 3)); geometry.setAttribute('color', new T.Float32BufferAttribute(color, 3)); geometry.setIndex(index);
  geometry.computeBoundingSphere();
  return geometry;
}

/** Builds the ribbon (and the outer shimmer) and adds them to the outdoors. Returns {mesh, curtain, triangles, sync()}. */
export function installBorders(world) {
  const quads = borderQuads(), mesh = new T.Mesh(quadGeometry(quads), new T.MeshBasicMaterial({ vertexColors: true, side: T.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
  mesh.name = 'region-borders'; mesh.castShadow = false; mesh.receiveShadow = false; mesh.matrixAutoUpdate = false;
  const curtain = new T.Mesh(curtainGeometry(BORDER_RUNS.filter(r => r.kind === 'outer')), new T.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: .3, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide, forceSinglePass: true, fog: false }));
  curtain.name = 'region-curtain'; curtain.castShadow = false; curtain.matrixAutoUpdate = false; curtain.renderOrder = 2;
  world.outside.add(mesh, curtain);
  const borders = { mesh, curtain, quads: quads.length, triangles: quads.length * 2, sync() { const high = world.state.settings.quality === 'high'; if (curtain.visible !== high) curtain.visible = high; } };
  borders.sync();
  return borders;
}
