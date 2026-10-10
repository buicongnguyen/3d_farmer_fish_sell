// The village run's three checkpoints: a red flag on a pole planted at each point while the run is on (they were thin
// yellow rings on the grass). The next one to reach stands tall, bright and bobbing; the ones after it are smaller and
// dimmer; one you have passed hangs white at half mast with a green tick. Fetched after the village is playable.
//
//   new RaceFlags(world)      reads world.raceNext each frame: the index of the next checkpoint, or -1 with no run on
//
// One small mesh per flag (pole, base, cloth, tick and the ground disc share a vertex-coloured geometry). The cloth waves
// by rewriting its own 36 vertices in place: nothing is allocated per frame, and nothing runs when no run is on.
import * as T from 'three';
import { RACE_POINTS } from './content.mjs';
import { CAMERA_YAW } from './field-layout.mjs';

/** Pole height, cloth length and height (metres), the ground disc's radius (the run's trigger is 1.8 m: main.mjs). */
export const FLAG = { pole: 3.3, long: 1.35, tall: .82, disc: 1.8, cols: 6 };
const RX = Math.cos(CAMERA_YAW), RZ = -Math.sin(CAMERA_YAW), NX = Math.sin(CAMERA_YAW), NZ = Math.cos(CAMERA_YAW); // screen-right and toward the camera
// Colours are linear (vertex colours are not converted): a small green and blue keep the red from washing out to pink.
const LOOK = {
  next: { cloth: [1, .015, .02], disc: [1, .04, .03, .42], rim: [1, .02, .02, .95], top: 1, size: 1.15 },
  later: { cloth: [.45, .03, .03], disc: [.6, .05, .04, .2], rim: [.6, .05, .04, .5], top: 1, size: .86 },
  done: { cloth: [.93, .95, .96], disc: [.8, .82, .84, .14], rim: [.86, .88, .9, .4], top: .56, size: .86 },
};
// The tick's two bars in cloth space (u along the cloth, v up it), four corners each.
const TICK = [[[.3, .5], [.38, .58], [.5, .3], [.42, .22]], [[.42, .22], [.5, .3], [.78, .72], [.7, .8]]], ORDER = [0, 1, 2, 0, 2, 3];

function build() {
  const pos = [], rgba = [], tri = (a, b, c, col) => { pos.push(...a, ...b, ...c); for (let i = 0; i < 3; i++) rgba.push(col[0], col[1], col[2], col[3] ?? 1); };
  const quad = (a, b, c, d, col) => { tri(a, b, c, col); tri(a, c, d, col); };
  const box = (x, y, z, w, h, d, col, dark = .78) => {
    const x0 = x - w / 2, x1 = x + w / 2, y0 = y - h / 2, y1 = y + h / 2, z0 = z - d / 2, z1 = z + d / 2, sh = [col[0] * dark, col[1] * dark, col[2] * dark];
    quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], col); quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], sh);
    quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], col); quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], sh);
    quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], col);
  };
  // The ground disc (a soft fill) and its rim, flat on the grass.
  const N = 28, R = FLAG.disc, r1 = R * .86, at = (r, a) => [Math.cos(a) * r, .05, Math.sin(a) * r], white = [1, 1, 1, 1], disc0 = 0;
  for (let i = 0; i < N; i++) { const a = i / N * Math.PI * 2, b = (i + 1) / N * Math.PI * 2; tri([0, .05, 0], at(r1, b), at(r1, a), white); }
  const rim0 = pos.length / 3; for (let i = 0; i < N; i++) { const a = i / N * Math.PI * 2, b = (i + 1) / N * Math.PI * 2; quad(at(r1, a), at(r1, b), at(R, b), at(R, a), white); }
  const fixed0 = pos.length / 3;
  box(0, .09, 0, .62, .18, .62, [.36, .25, .17]); box(0, .24, 0, .36, .14, .36, [.47, .33, .22]); box(0, FLAG.pole / 2 + .2, 0, .09, FLAG.pole, .09, [1, .97, .88], .8); box(0, FLAG.pole + .28, 0, .2, .2, .2, [1, .8, .2]);
  // The cloth: FLAG.cols quads along its length, (u, v) of each vertex kept for the wave. Then the tick: two bars, 12 vertices.
  const cloth0 = pos.length / 3, uv = [];
  for (let i = 0; i < FLAG.cols; i++) { const u0 = i / FLAG.cols, u1 = (i + 1) / FLAG.cols; for (const [u, v] of [[u0, 0], [u1, 0], [u1, 1], [u0, 0], [u1, 1], [u0, 1]]) { pos.push(0, 0, 0); rgba.push(1, 1, 1, 1); uv.push(u, v); } }
  const tick0 = pos.length / 3; for (let i = 0; i < 12; i++) { pos.push(0, 0, 0); rgba.push(.13, .62, .27, 1); }
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(new Float32Array(pos), 3)); g.setAttribute('color', new T.BufferAttribute(new Float32Array(rgba), 4));
  g.boundingSphere = new T.Sphere(new T.Vector3(0, FLAG.pole / 2, 0), FLAG.pole + 1);
  return { g, disc0, rim0, fixed0, cloth0, tick0, uv };
}

export class RaceFlags {
  constructor(world) {
    this.world = world; this.shown = -2;
    const material = new T.MeshBasicMaterial({ vertexColors: true, transparent: true, side: T.DoubleSide, forceSinglePass: true });
    this.flags = RACE_POINTS.map((p, i) => { const parts = build(), mesh = new T.Mesh(parts.g, material); mesh.name = 'race-flag'; mesh.position.set(p.x, 0, p.z); mesh.visible = false; mesh.raycast = () => {}; world.outside.add(mesh); return { ...parts, mesh, look: null, phase: i * 1.7 }; });
    world.raceFlags = this; world.__roomView.onFrame(() => this.update());
  }
  /** The colours of the cloth, the disc and the rim for a look; the wave then only moves vertices. */
  paint(f, look) {
    f.look = look; const c = f.g.getAttribute('color'), L = LOOK[look];
    for (let i = f.disc0; i < f.rim0; i++) c.setXYZW(i, L.disc[0], L.disc[1], L.disc[2], L.disc[3]);
    for (let i = f.rim0; i < f.fixed0; i++) c.setXYZW(i, L.rim[0], L.rim[1], L.rim[2], L.rim[3]);
    for (let i = f.cloth0; i < f.tick0; i++) c.setXYZW(i, L.cloth[0], L.cloth[1], L.cloth[2], 1);
    c.needsUpdate = true;
  }
  /** One cloth-space point (u along the cloth, v up it) into vertex i, `out` metres toward the camera. */
  put(f, a, i, u, v, out, t, top, amp) {
    const w = t * 5.2 - u * 5 + f.phase, s = Math.sin(w) * u * amp + out, x = .05 + u * FLAG.long, o = i * 3;
    a[o] = RX * x + NX * s; a[o + 1] = top - (1 - v) * FLAG.tall + Math.cos(w) * u * amp * .45 - u * u * .1; a[o + 2] = RZ * x + NZ * s;
  }
  update() {
    const w = this.world, next = w.location === 'village' ? w.raceNext ?? -1 : -1;
    if (next !== this.shown) { this.shown = next; for (let i = 0; i < this.flags.length; i++) { const f = this.flags[i]; f.mesh.visible = next >= 0; if (next >= 0) this.paint(f, i < next ? 'done' : i === next ? 'next' : 'later'); } }
    if (next < 0) return;
    const t = w.t;
    for (const f of this.flags) {
      const L = LOOK[f.look], done = f.look === 'done', p = f.g.getAttribute('position'), a = p.array, top = (FLAG.pole + .12) * L.top, amp = done ? .05 : .15, uv = f.uv;
      for (let i = f.cloth0, j = 0; i < f.tick0; i++, j += 2) this.put(f, a, i, uv[j], uv[j + 1], 0, t, top, amp);
      for (let b = 0; b < 2; b++) for (let k = 0; k < 6; k++) { const q = TICK[b][ORDER[k]], i = f.tick0 + b * 6 + k; if (done) this.put(f, a, i, q[0], q[1], .05, t, top, amp); else { a[i * 3] = a[i * 3 + 2] = 0; a[i * 3 + 1] = top; } }
      p.needsUpdate = true;
      const bob = f.look === 'next' ? 1 + Math.sin(t * 6) * .05 : 1; f.mesh.scale.set(L.size, L.size * bob, L.size);
    }
  }
}
