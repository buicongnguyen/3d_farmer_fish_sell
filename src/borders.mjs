// The rainbow borders (round 8, builder A; spec section 2). The reference draws no borders; the user asked for them:
// "there is rainbow border for each region so that we can see it clear".
//
// One static mesh, built once at boot from regions.mjs BORDER_RUNS (never typed by hand), always visible, box open or shut:
// one draw, vertex colours only, no blending, no per-frame work. Every run is a flat ribbon at y 0.03:
//
//   white edge 0.2 | the accent of the region on that side 0.6 | seven rainbow stripes of 0.34 | the other accent 0.6 | white edge 0.2
//
// 3.98 m wide for a 'shared' or 'outer' run, half that (1.99 m) for the ward's outline and the four seams, so the ward's
// ribbon stays a metre clear of the ring road's asphalt. The rainbow answers "rainbow border"; the side strips answer "for
// each region": you can read which region lies on each side (white beyond the world's edge).
// A full run is shortened by 2 m at both ends and a slim one by 1.1 m; each of the 24 grid vertices that touch the world gets
// a 4.4 m white knot and each ward vertex a 2.2 m one, a millimetre higher, so crossing ribbons never overlap.
// 40 runs x 11 strips + 24 + 4 knots = 468 quads, 936 triangles.
//
// On "high" graphics only, the 20 outer runs also carry a 5 m additive shimmer (one more draw): the world's edge reads as
// a soft wall of light and not as a line on the ground.
import * as T from 'three';
import { BORDER_RUNS, GRID_IDS, GRID, CELL, HALF, REGION } from './regions.mjs';
import { WARD_OUTLINE } from './ward.mjs';

export const RAINBOW = Object.freeze(['#ff4d5e', '#ff9f3f', '#ffe14d', '#5fd66a', '#4cc3ff', '#6f7bff', '#c66bff']);
export const RIBBON = Object.freeze({ y: .03, knotY: .031, edge: .2, side: .6, stripe: .34, width: 3.98, cut: 2, slimCut: 1.1, knot: 4.4, slimKnot: 2.2, curtain: 5 });
const WHITE = '#ffffff';

/** The grid vertices that touch at least one square of the world: 24 of the 36 lattice points. */
export function gridKnots() {
  const out = [], inWorld = (r, c) => !!GRID_IDS[r]?.[c];
  for (let r = 0; r <= GRID; r++) for (let c = 0; c <= GRID; c++) if (inWorld(r - 1, c - 1) || inWorld(r - 1, c) || inWorld(r, c - 1) || inWorld(r, c)) out.push([c * CELL - HALF, r * CELL - HALF]);
  return out;
}
/**
 * The ribbon as flat quads: [{corners: [[x, z] x 4], y, color}], pure. Each run gives 11 (its strips from its left side
 * to its right), each knot 1.
 */
export function borderQuads(runs = BORDER_RUNS) {
  const quads = [];
  for (const run of runs) {
    const full = run.kind === 'shared' || run.kind === 'outer', k = run.half / (RIBBON.width / 2), cut = full ? RIBBON.cut : RIBBON.slimCut;
    const length = Math.hypot(run.bx - run.ax, run.bz - run.az); if (length <= cut * 2) continue; // a side too short is covered by its knots alone
    const dx = (run.bx - run.ax) / length, dz = (run.bz - run.az) / length, ax = run.ax + dx * cut, az = run.az + dz * cut, bx = run.bx - dx * cut, bz = run.bz - dz * cut;
    const strips = [[RIBBON.edge, WHITE], [RIBBON.side, run.left ? REGION[run.left].accent : WHITE], ...RAINBOW.map(c => [RIBBON.stripe, c]), [RIBBON.side, run.right ? REGION[run.right].accent : WHITE], [RIBBON.edge, WHITE]];
    let offset = run.half;
    for (const [width, color] of strips) {
      const next = offset - width * k;
      quads.push({ corners: [[ax + run.nx * offset, az + run.nz * offset], [bx + run.nx * offset, bz + run.nz * offset], [bx + run.nx * next, bz + run.nz * next], [ax + run.nx * next, az + run.nz * next]], y: RIBBON.y, color });
      offset = next;
    }
  }
  const knot = (x, z, size) => quads.push({ corners: [[x - size / 2, z - size / 2], [x + size / 2, z - size / 2], [x + size / 2, z + size / 2], [x - size / 2, z + size / 2]], y: RIBBON.knotY, color: WHITE });
  for (const [x, z] of gridKnots()) knot(x, z, RIBBON.knot);
  for (const [x, z] of WARD_OUTLINE) knot(x, z, RIBBON.slimKnot);
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
/** The shimmer over the outer runs: upright quads, the rainbow along each run, full colour at the ground and none at the top. */
function curtainGeometry(runs) {
  const position = [], color = [], index = [], c = new T.Color(), pieces = 14;
  for (const run of runs) for (let i = 0; i < pieces; i++) {
    const a = i / pieces, b = (i + 1) / pieces, x0 = run.ax + (run.bx - run.ax) * a, z0 = run.az + (run.bz - run.az) * a, x1 = run.ax + (run.bx - run.ax) * b, z1 = run.az + (run.bz - run.az) * b, at = position.length / 3;
    position.push(x0, RIBBON.y, z0, x1, RIBBON.y, z1, x1, RIBBON.curtain, z1, x0, RIBBON.curtain, z0);
    c.set(RAINBOW[i % RAINBOW.length]); color.push(c.r, c.g, c.b); c.set(RAINBOW[(i + 1) % RAINBOW.length]); color.push(c.r, c.g, c.b, 0, 0, 0, 0, 0, 0);
    index.push(at, at + 1, at + 2, at, at + 2, at + 3);
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
  const curtain = new T.Mesh(curtainGeometry(BORDER_RUNS.filter(r => r.kind === 'outer')), new T.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: .3, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide, fog: false }));
  curtain.name = 'region-curtain'; curtain.castShadow = false; curtain.matrixAutoUpdate = false; curtain.renderOrder = 2;
  world.outside.add(mesh, curtain);
  const borders = { mesh, curtain, quads: quads.length, triangles: quads.length * 2, sync() { const high = world.state.settings.quality === 'high'; if (curtain.visible !== high) curtain.visible = high; } };
  borders.sync();
  return borders;
}
