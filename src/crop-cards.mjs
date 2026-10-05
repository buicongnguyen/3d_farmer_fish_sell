// The crops in the garden beds, drawn the way Zoo Garden draws them (crop-cards.ts): every crop model is baked once into one
// picture atlas, seen from the game's own camera, and each bed shows one flat card of it that turns to face the camera.
// All the cards are one instanced mesh and everything flat on the soil (a soft shadow, the gold ring of a ripe crop) is a second one:
// two draws for thirty beds. This file is fetched with import() while the world is made; it is not in the first-frame bundle.
//
// What makes a crop sit in the middle of its bed and be as big as the reference's (see notes CROPS.md):
//   * fitModel() moves every model's bounding-box centre (x, z) and its lowest point to the origin, so the pivot is the middle of
//     the footprint standing on the soil, whatever the model's own origin was (any future crop model too);
//   * and scales it so its picture, from the game camera, is 1 unit tall (Zoo's viewBounds rule: every crop fits the same height,
//     whatever its width or depth); the stage then says how many bed-sides tall it is: SHARE (Zoo's measured proportions).
import * as T from 'three';
import { CAMERA_YAW, CAMERA_RISE } from './field-layout.mjs';
import { CROPS, BED_POSITIONS } from './content.mjs';
import { cropProgress, ripe, bedCount } from './game.mjs';

export const BED_SIDE = 2.1, SOIL_Y = .06;
/** How tall a crop stands in bed-sides (Zoo Garden, measured from its screenshots: sprout .22, young .34, ripe .78 of the bed's width). */
export const SHARE = { sprout: .22, young: .34, ripe: .78 };
/** The flowers have no model of their own: they use the reference's flower models (the shop and bag icons already do). */
export const CROP_MODEL = { tulip: 'rainbowrose', sunflower: 'star', daisy: 'moonflower' };
export const modelOf = id => CROP_MODEL[id] ?? id;
/** Zoo's rule: the sprout picture until the crop is half grown, then the crop itself small, and full size when ripe. An unwatered seed is a sprout. */
export const stageOf = (watered, progress) => !watered ? 'sprout' : progress >= 1 ? 'ripe' : progress >= .5 ? 'young' : 'sprout';
/** How tall the card's picture is, in view units (screen height at the game camera), for a stage. */
export const stageHeight = stage => SHARE[stage] * BED_SIDE;
/** Zoo's pop when a crop changes stage: from a third of its size, past it and back. */
export const popScale = t => { if (t >= 1) return 1; const u = t - 1; return .35 + .65 * (1 + 2.70158 * u * u * u + 1.70158 * u * u); };

/** Thin or pale models measure short once drawn (the moonflower's picture is .6 of its geometry): the factor that brings a picture under .8 up to a full unit, within the atlas cell's headroom. */
export const refitFactor = measured => measured >= .8 ? 1 : Math.min(1.35, 1 / Math.max(.01, measured));

/** The game camera's axes (world.mjs: yaw CAMERA_YAW, up CAMERA_RISE for every metre back; orthographic, so a view unit is a screen unit). */
export function viewBasis(yaw = CAMERA_YAW, rise = CAMERA_RISE) {
  const back = new T.Vector3(Math.sin(yaw), rise, Math.cos(yaw)).normalize(), right = new T.Vector3().crossVectors(new T.Vector3(0, 1, 0), back).normalize();
  return { back, right, up: new T.Vector3().crossVectors(back, right).normalize() };
}
/** The picture of an object from the camera, over its vertices: left/right/top/bottom along the screen axes, relative to the world origin. */
export function viewBounds(object, basis = viewBasis()) {
  object.updateMatrixWorld(true);
  const b = { left: Infinity, right: -Infinity, top: -Infinity, bottom: Infinity }, v = new T.Vector3();
  object.traverse(m => {
    const p = m.isMesh && m.geometry?.getAttribute('position'); if (!p) return;
    for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i).applyMatrix4(m.matrixWorld); const x = v.dot(basis.right), y = v.dot(basis.up); b.left = Math.min(b.left, x); b.right = Math.max(b.right, x); b.top = Math.max(b.top, y); b.bottom = Math.min(b.bottom, y); }
  });
  return b;
}
/**
 * A copy of a model standing on the origin: the middle of its footprint at (0, 0), its lowest point at y 0, scaled so that from the
 * camera it is 1 unit tall (top to the lower of the origin and its front edge). Returns {holder, scale, bounds} (bounds: its picture).
 */
export function fitModel(source, basis = viewBasis()) {
  const holder = new T.Group(), model = source.clone(true); model.position.set(0, 0, 0); model.rotation.set(0, 0, 0); model.scale.set(1, 1, 1); holder.add(model); holder.updateMatrixWorld(true);
  const box = new T.Box3().setFromObject(holder), c = box.getCenter(new T.Vector3()); model.position.set(-c.x, -box.min.y, -c.z); holder.updateMatrixWorld(true);
  const raw = viewBounds(holder, basis), scale = 1 / Math.max(1e-6, raw.top - Math.min(0, raw.bottom)); holder.scale.setScalar(scale);
  return { holder, scale, bounds: viewBounds(holder, basis) };
}

// The atlas: 4 columns of 256 x 198 cells (a cell is a 2.2 x 1.7 window on the view plane: x -1.1 to 1.1, y -.3 to 1.4, the origin's picture at (0, 0)).
const COLS = 4, CELL_W = 256, CELL_H = 198, SIZE = 1024, FRAME = { x0: -1.1, x1: 1.1, y0: -.3, y1: 1.4 }, ASPECT = CELL_W / CELL_H;
const INK = new T.Color('#3a2433');
const VERT = `attribute vec4 aCell; attribute vec4 aBox; attribute vec4 aInfo; varying vec2 vUv; varying vec4 vCell; varying vec4 vInfo;
void main(){ vec2 uv = position.xy + .5; vec3 base = (modelMatrix * instanceMatrix * vec4(0., 0., 0., 1.)).xyz; vec2 l = aBox.xy + uv * aBox.zw;
 vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]), up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]), back = vec3(viewMatrix[0][2], viewMatrix[1][2], viewMatrix[2][2]);
 vec3 p = aInfo.x > .5 ? base + vec3(l.x, 0., l.y) : base + right * l.x + up * l.y + back * aInfo.y;
 gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.); vUv = aCell.xy + uv * aCell.zw; vCell = aCell; vInfo = aInfo; }`;
const FRAG = `uniform sampler2D map; uniform vec2 texel; uniform vec3 ink; varying vec2 vUv; varying vec4 vCell; varying vec4 vInfo;
vec4 tap(vec2 uv){ return texture2D(map, clamp(uv, vCell.xy + texel * .5, vCell.xy + vCell.zw - texel * .5)); }
void main(){ vec4 t = tap(vUv); float a = t.a; vec3 col = t.rgb / max(a, 1e-3); float o = 0.;
 if (vInfo.z > .5) { vec2 d = texel * 2.4; o = max(max(max(tap(vUv + vec2(d.x, 0.)).a, tap(vUv - vec2(d.x, 0.)).a), max(tap(vUv + vec2(0., d.y)).a, tap(vUv - vec2(0., d.y)).a)), max(max(tap(vUv + d * .7).a, tap(vUv - d * .7).a), max(tap(vUv + vec2(d.x, -d.y) * .7).a, tap(vUv + vec2(-d.x, d.y) * .7).a))); }
 float ob = o * (1. - a), A = a + ob; vec3 C = (col * a + ink * ob) / max(A, 1e-3); A *= vInfo.w; if (A < .02) discard; gl_FragColor = vec4(C, A);
 #include <colorspace_fragment>
}`;

/** The cards of every bed: bake() once the models are loaded, then update(state, dt, t) each frame. */
export class CropCards {
  constructor(world) {
    this.world = world; this.cells = new Map(); this.bounds = new Map(); this.beds = BED_POSITIONS.map((_, i) => ({ crop: '', t0: -9, i, stage: '', watered: false, pop: 1, bob: 1, done: false, b: null })); this.v = new Float64Array(16); this.fx = new Float64Array(BED_POSITIONS.length * 2); this.live = []; this.liveN = 0; this.rev = 0; this.level = world.step ?? 0; this.dirty = true; this.marks = true; this.bake();
    // A lost WebGL context empties the atlas (phones lose it when the tab is backgrounded): paint it again, the cards keep their cells.
    this.restore = () => { this.bake(); this.rebakes = (this.rebakes ?? 0) + 1; this.dirty = true; }; world.canvas.addEventListener('webglcontextrestored', this.restore);
  }
  cellOf(model) { return this.cells.get(model) ?? this.cells.get('sprout'); }
  /** One picture per crop model (and the sparkle, the soft shadow and the ring), in one 1,024 px texture seen from the game's camera. */
  bake() {
    const { renderer } = this.world, basis = this.basis = viewBasis(), models = [...new Set([...Object.keys(CROPS).map(modelOf), 'sprout'])]; this.cells.clear(); this.bounds.clear();
    const target = this.target ??= new T.WebGLRenderTarget(SIZE, SIZE, { samples: 4, generateMipmaps: true, minFilter: T.LinearMipmapLinearFilter, magFilter: T.LinearFilter, depthBuffer: true })
    const scene = new T.Scene(), cam = new T.OrthographicCamera(FRAME.x0, FRAME.x1, FRAME.y1, FRAME.y0, .1, 40); cam.position.copy(basis.back).multiplyScalar(12); cam.lookAt(0, 0, 0);
    scene.add(new T.HemisphereLight('#fff8e6', '#647450', 2.8)); const light = new T.DirectionalLight('#fff3db', 3); light.position.copy(basis.back).multiplyScalar(4).addScaledVector(basis.up, 5).addScaledVector(basis.right, -3); scene.add(light);
    const flat = new T.OrthographicCamera(-1, 1, 1, -1, .1, 4); flat.position.z = 2;
    const oldColor = renderer.getClearColor(new T.Color()), oldAlpha = renderer.getClearAlpha(), oldAuto = renderer.autoClear;
    renderer.setRenderTarget(target); renderer.setClearColor(0, 0); renderer.clear(); renderer.autoClear = false; target.scissorTest = true;
    const put = (name, draw) => { const i = this.cells.size, x = (i % COLS) * CELL_W, y = Math.floor(i / COLS) * CELL_H; target.viewport.set(x, y, CELL_W, CELL_H); target.scissor.set(x, y, CELL_W, CELL_H); renderer.setRenderTarget(target); draw(); this.cells.set(name, [x / SIZE, y / SIZE, CELL_W / SIZE, CELL_H / SIZE]); };
    const fits = new Map(), draw = fit => () => { scene.add(fit.holder); renderer.render(scene, cam); scene.remove(fit.holder); };
    for (const id of models) { const src = this.world.assets.get('crop_' + id); if (!src) continue; const fit = fitModel(src, basis); fits.set(id, fit); this.bounds.set(id, fit.bounds); put(id, draw(fit)); }
    // Measure the pictures (one read of the atlas): a model whose opaque picture is under .8 of a unit tall is drawn again, bigger.
    const px = new Uint8Array(SIZE * SIZE * 4); renderer.readRenderTargetPixels(target, 0, 0, SIZE, SIZE, px);
    for (const [id, fit] of fits) {
      const [u, v] = this.cells.get(id), x0 = Math.round(u * SIZE), y0 = Math.round(v * SIZE), rows = []; for (let r = 0; r < CELL_H; r++) for (let c = 0; c < CELL_W; c++) if (px[((y0 + r) * SIZE + x0 + c) * 4 + 3] > 40) { rows.push(r); break; }
      const f = refitFactor(rows.length ? (rows[rows.length - 1] - rows[0] + 1) / CELL_H * (FRAME.y1 - FRAME.y0) : 1); if (f === 1) continue;
      fit.holder.scale.multiplyScalar(f); fit.holder.updateMatrixWorld(true); this.bounds.set(id, viewBounds(fit.holder, basis));
      target.viewport.set(x0, y0, CELL_W, CELL_H); target.scissor.set(x0, y0, CELL_W, CELL_H); renderer.setRenderTarget(target); renderer.clear(); draw(fit)();
    }
    const marks = new T.Scene(), canvas = Object.assign(document.createElement('canvas'), { width: CELL_W, height: CELL_H }), g = canvas.getContext('2d'), tex = new T.CanvasTexture(canvas); tex.colorSpace = T.SRGBColorSpace;
    const quad = new T.Mesh(new T.PlaneGeometry(2, 2), new T.MeshBasicMaterial({ map: tex, transparent: true, depthTest: false })); marks.add(quad);
    const paint = fn => () => { g.clearRect(0, 0, CELL_W, CELL_H); fn(); tex.needsUpdate = true; renderer.render(marks, flat); };
    put('blob', paint(() => { const r = g.createRadialGradient(CELL_W / 2, CELL_H / 2, 0, CELL_W / 2, CELL_H / 2, CELL_H / 2); r.addColorStop(0, 'rgba(45,30,20,.55)'); r.addColorStop(.6, 'rgba(45,30,20,.3)'); r.addColorStop(1, 'rgba(45,30,20,0)'); g.fillStyle = r; g.fillRect(0, 0, CELL_W, CELL_H); }));
    put('ring', paint(() => { g.strokeStyle = '#e7d383'; g.lineWidth = 7; g.beginPath(); g.arc(CELL_W / 2, CELL_H / 2, CELL_H / 2 - 12, 0, 7); g.stroke(); }));
    put('sparkle', paint(() => { const cx = CELL_W / 2, cy = CELL_H / 2, R = CELL_H / 2 - 8; g.fillStyle = '#ffe27a'; g.strokeStyle = '#a8731f'; g.lineWidth = 5; g.beginPath(); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4 - Math.PI / 2, r = i % 2 ? R * .28 : R; g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); } g.closePath(); g.fill(); g.stroke(); }));
    tex.dispose(); quad.geometry.dispose(); quad.material.dispose(); target.scissorTest = false;
    renderer.setRenderTarget(null); renderer.setClearColor(oldColor, oldAlpha); renderer.autoClear = oldAuto;
    this.sparkle = this.cellOf('sparkle'); this.blob = this.cellOf('blob'); this.ring = this.cellOf('ring'); if (this.cards) return; this.cards = this.make(false); this.ground = this.make(true); this.world.outside.add(this.ground, this.cards);
    // A tap that lands on a crop's picture answers for that crop's bed alone (the frontmost one), whatever bed boxes the ray crosses.
    this.world.cropViews.forEach((view, i) => { const hit = view.target.hit, cast = hit.raycast, p = this.world.pointer; hit.raycast = (rc, hits) => { const b = this.pick((p.x + 1) / 2 * innerWidth, (1 - p.y) / 2 * innerHeight); if (b === null) cast.call(hit, rc, hits); else if (b === i) hits.push({ distance: .01, point: rc.ray.origin.clone(), object: hit }); }; });
  }
  /** One instanced mesh of quads (60 slots: a crop and its sparkle per bed, or a shadow and a ring per bed). */
  make(flat) {
    const n = BED_POSITIONS.length * 2, geometry = new T.PlaneGeometry(1, 1), attr = k => { const a = new T.InstancedBufferAttribute(new Float32Array(n * 4), 4); a.setUsage(T.DynamicDrawUsage); geometry.setAttribute(k, a); return a; };
    const material = new T.ShaderMaterial({ uniforms: { map: { value: this.target.texture }, texel: { value: new T.Vector2(1 / SIZE, 1 / SIZE) }, ink: { value: new T.Vector3(INK.r, INK.g, INK.b) } }, vertexShader: VERT, fragmentShader: FRAG, side: T.DoubleSide, transparent: flat, depthWrite: !flat, alphaToCoverage: !flat, forceSinglePass: true, polygonOffset: flat, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    const mesh = new T.InstancedMesh(geometry, material, n); mesh.count = 0; mesh.frustumCulled = false; mesh.castShadow = false; mesh.receiveShadow = false; mesh.renderOrder = flat ? 1 : 2; mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
    mesh.userData = { cell: geometry.getAttribute('aCell') ?? attr('aCell'), box: geometry.getAttribute('aBox') ?? attr('aBox'), info: geometry.getAttribute('aInfo') ?? attr('aInfo'), n: 0 }; return mesh;
  }
  /** Writes one quad from the scratch array this.v = [x, y, z, boxX, boxY, boxW, boxH, info0..3] (typed-array stores allocate nothing; a call with a dozen numbers would box each one). */
  put(mesh, i, cell) { const d = mesh.userData, m = mesh.instanceMatrix.array, o = i * 16, v = this.v, k = i * 4, q = d.box.array, w = d.info.array, c = d.cell.array; m.fill(0, o, o + 16); m[o] = m[o + 5] = m[o + 10] = m[o + 15] = 1; m[o + 12] = v[0]; m[o + 13] = v[1]; m[o + 14] = v[2]; c[k] = cell[0]; c[k + 1] = cell[1]; c[k + 2] = cell[2]; c[k + 3] = cell[3]; q[k] = v[3]; q[k + 1] = v[4]; q[k + 2] = v[5]; q[k + 3] = v[6]; w[k] = v[7]; w[k + 1] = v[8]; w[k + 2] = v[9]; w[k + 3] = v[10]; }
  /** How far along the screen axis the picture's middle is from the pivot (the card is slid back by it, so the plant stands in the bed's middle even when its leaves lean). */
  shift(id) { const b = this.bounds.get(id); return b ? (b.left + b.right) / 2 : 0; }
  /** The governor's step (world.setStep): from step 1 the sparkle, the pop and the ripe bob are dropped (a ripe crop then costs nothing per frame), from step 2 the outline's eight extra taps too. */
  setStep(n) { if (n === this.level) return; this.level = n; this.dirty = true; }
  flush(mesh, n) { mesh.count = n; mesh.instanceMatrix.needsUpdate = true; const u = mesh.userData; u.cell.needsUpdate = u.box.needsUpdate = u.info.needsUpdate = true; }
  /** The beds' state to the cards: the stage of every crop, a pop when it changes, a gentle bob when it is ripe. Allocates nothing: the beds' records are reused. */
  update(s, dt, t) {
    if (!this.world.outside.visible) return;
    const open = bedCount(s), live = this.live, lite = this.level >= 1, fx = this.fx; let c = 0, g = 0, moving = this.dirty, k = 0;
    for (let i = 0; i < BED_POSITIONS.length; i++) {
      const st = this.beds[i], b = i < open ? s.beds[i] : null; if (!b) { if (st.crop) { st.crop = ''; moving = true; } continue; }
      const stage = stageOf(b.watered, cropProgress(s, b)), w = !!b.watered;
      if (b.crop !== st.crop || stage !== st.stage || w !== st.watered) {
        // Water changes the soil, not the plant's size. On a phone the old .35 pop made a tiny sprout vanish.
        // Growth starts at the previous visible height, so changing models never shrinks a living plant either.
        if (st.crop && (b.crop !== st.crop || stage !== st.stage)) { st.t0 = t; st.from = Math.min(1, stageHeight(st.stage) / stageHeight(stage)); }
        st.crop = b.crop; st.stage = stage; st.watered = w; moving = true;
      }
      const age = (t - st.t0) / .4, done = ripe(s, b); fx[i * 2] = lite ? 1 : Math.max(st.from ?? 1, popScale(age)); fx[i * 2 + 1] = done && !lite ? 1 + Math.sin(t * 4 + i) * .04 : 1; st.done = done; st.b = b; if (age < 1 && !lite || done && !lite) moving = true;
      live[k++] = st;
    }
    this.liveN = k; if (!moving) return; this.dirty = false; this.rev++;
    const ink = this.level >= 2 ? 0 : 1, v = this.v;
    for (let n = 0; n < k; n++) {
      const st = live[n], i = st.i, stage = st.stage, done = st.done, bob = fx[i * 2 + 1];
      const p = BED_POSITIONS[i], model = modelOf(st.b.crop), id = this.bounds.has(stage === 'sprout' ? 'sprout' : model) ? (stage === 'sprout' ? 'sprout' : model) : 'sprout', h = stageHeight(stage) * fx[i * 2] * bob, cell = this.cellOf(id), A = ASPECT, sx = -this.shift(id) * h;
      v[0] = p.x; v[1] = SOIL_Y; v[2] = p.z; v[3] = FRAME.x0 * h + sx; v[4] = FRAME.y0 * h; v[5] = (FRAME.x1 - FRAME.x0) * h; v[6] = (FRAME.y1 - FRAME.y0) * h; v[7] = 0; v[8] = h * .35; v[9] = ink; v[10] = 1; this.put(this.cards, c++, cell);
      if (done && this.marks && !lite) { v[0] = p.x; v[1] = SOIL_Y; v[2] = p.z; v[3] = -.3 * A; v[4] = stageHeight(stage) * 1.08 * bob; v[5] = .6 * A; v[6] = .6; v[7] = 0; v[8] = h * .35; v[9] = 0; v[10] = .95 + Math.sin(t * 6 + i) * .05; this.put(this.cards, c++, this.sparkle); }
      if (!this.marks) continue; const r = h * .4; v[0] = p.x; v[1] = SOIL_Y + .01; v[2] = p.z; v[3] = -r * A; v[4] = -r; v[5] = 2 * r * A; v[6] = 2 * r; v[7] = 1; v[8] = 0; v[9] = 0; v[10] = 1; this.put(this.ground, g++, this.blob);
      if (done) { v[0] = p.x; v[1] = SOIL_Y + .015; v[2] = p.z; v[3] = -.95 * A; v[4] = -.95; v[5] = 1.9 * A; v[6] = 1.9; v[7] = 1; v[8] = 0; v[9] = 0; v[10] = 1; this.put(this.ground, g++, this.ring); }
    }
    this.flush(this.cards, c); this.flush(this.ground, g);
  }
  /** Where each crop stands on the screen, for the suites (willowmere.crops()): its bed, model, stage, pivot, and its picture's box in pixels. */
  setMarks(on) { this.marks = on; this.dirty = true; }
  info() {
    const w = this.world, ppu = innerHeight / (2 * w.camera.top), out = [];
    for (let n = 0; n < this.liveN; n++) { const st = this.live[n];
      const i = st.i, b = st.b, stage = st.stage, done = st.done, p = BED_POSITIONS[i], model = modelOf(b.crop), id = stage === 'sprout' ? 'sprout' : model, h = stageHeight(stage), bb = this.bounds.get(id), o = w.project(p.x, p.z, SOIL_Y), bed = w.project(p.x, p.z, 0);
      out.push({ bed: i, crop: b.crop, model: id, stage, ripe: done, height: h, ppu, bedPx: BED_SIDE * ppu, base: { x: p.x, y: SOIL_Y, z: p.z }, bedScreen: bed, baseScreen: o, box: { x0: o.x + (bb.left - this.shift(id)) * h * ppu, x1: o.x + (bb.right - this.shift(id)) * h * ppu, y0: o.y - bb.top * h * ppu, y1: o.y - bb.bottom * h * ppu } });
    }
    return out;
  }
  /**
   * Which bed a tap on the screen at (x, y) means when it lands on a crop's picture: the frontmost picture whose box holds the point (null when none does).
   * The beds' tap boxes are low, so without this a tap on the upper half of a back crop would pick the bed in front of it, or one behind it.
   */
  pick(x, y) {
    const key = x + ',' + y, camera = this.world.camera, old = this.picked;
    if (old?.rev === this.rev && old.key === key && old.camera === camera && old.width === innerWidth && old.height === innerHeight && old.view.every((v, i) => v === (i < 16 ? camera.matrixWorld.elements[i] : camera.projectionMatrix.elements[i - 16]))) return old.bed;
    let bed = null, front = -1e9; for (const i of this.info()) if (x >= i.box.x0 && x <= i.box.x1 && y >= i.box.y0 && y <= i.box.y1 && i.baseScreen.y > front) { front = i.baseScreen.y; bed = i.bed; }
    this.picked = { rev: this.rev, key, bed, camera, width: innerWidth, height: innerHeight, view: [...camera.matrixWorld.elements, ...camera.projectionMatrix.elements] }; return bed;
  }
  /** The atlas as a picture (tests only: reads the texture back). */
  atlasImage() {
    const px = new Uint8Array(SIZE * SIZE * 4); this.world.renderer.readRenderTargetPixels(this.target, 0, 0, SIZE, SIZE, px);
    const c = Object.assign(document.createElement('canvas'), { width: SIZE, height: SIZE }), g = c.getContext('2d'), img = g.createImageData(SIZE, SIZE);
    for (let y = 0; y < SIZE; y++) img.data.set(px.subarray((SIZE - 1 - y) * SIZE * 4, (SIZE - y) * SIZE * 4), y * SIZE * 4);
    g.putImageData(img, 0, 0); return c.toDataURL('image/png');
  }
  diagnostics(atlas) { return { atlas: atlas ? this.atlasImage() : undefined, rebakes: this.rebakes ?? 0, cards: this.cards.count, ground: this.ground.count, cells: [...this.cells.keys()], bounds: Object.fromEntries([...this.bounds].map(([k, v]) => [k, v])) }; }
  dispose() { this.world.canvas.removeEventListener('webglcontextrestored', this.restore); this.cards.removeFromParent(); this.ground.removeFromParent(); for (const m of [this.cards, this.ground]) { m.geometry.dispose(); m.material.dispose(); } this.target.dispose(); }
}
