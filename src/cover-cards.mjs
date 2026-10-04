// Ground cover drawn as 2D cards (round 8, builder A; spec 3.5). A port of Zoo Garden's src/cover-cards.ts.
//
// Every cover and dressing piece of a field tile (tufts, flowers, toadstools, reeds, pebbles, embers…) is one instance of
// ONE InstancedMesh of upright quads: one draw a tile, whatever the number of kinds. Each kind's picture is rendered once
// from its own 3D model, from the game camera's fixed direction, into one atlas for the whole game (1,024 px, 64 cells of
// 128 px). The cards face the camera's fixed direction, lean back perpendicular to the view, take the ground's light (an
// upward normal) and its shadows, cast none, and sway in the wind in the vertex shader.
//
// What differs from the reference, and why:
//   - One cell a kind (the reference renders two turns): Willowmere's lens is orthographic and its yaw never changes, so a
//     mirrored card is the second look; 64 cells then hold every kind of the game in one texture.
//   - The camera's yaw: the reference looks straight down its z axis; Willowmere's camera is turned CAMERA_YAW, so the
//     card's across axis is the camera's right, not world x.
//   - Each card's place on its model (x0, y0, size) is a uniform looked up by cell, not an instance attribute: when a kit
//     arrives after a tile was built, re-rendering the cell from the real model updates every card already on screen.
//     Until then the cell holds the reference's stand-in shape (fields.mjs fallbackShape), so a card is never missing.
//   - The card is slid toward the camera until its lower edge is on the ground. The reference's card stands on the piece's
//     root, so whatever of a flat piece lies in front of its root is under the ground; with an orthographic lens the slide
//     changes nothing on the screen but the depth.
//   - A per-card glow (0 or 1), added as albedo x glow to the emissive term: the reference's cards do not glow, and the
//     ember field and the night's mushrooms would be flat dots without it.
import * as T from 'three';
import { TOON_RAMP } from './toon.mjs';
import { CAMERA_YAW, CAMERA_RISE } from './field-layout.mjs';

export const CARD = Object.freeze({ cell: 128, columns: 8, sway: .07, alphaTest: .5 });
const CELLS = CARD.columns * CARD.columns;
/** The direction toward the game camera, the camera's right, and the card's "up" (perpendicular to the view). */
const toCamera = new T.Vector3(Math.sin(CAMERA_YAW), CAMERA_RISE, Math.cos(CAMERA_YAW)).normalize();
const cardRight = new T.Vector3(0, 1, 0).cross(toCamera).normalize(), cardUp = new T.Vector3().crossVectors(toCamera, cardRight).normalize();
const time = { value: 0 };
/** Advances the wind on every card. */
export function tickCoverCards(seconds) { time.value = seconds; }

const corner = new T.Vector3();
/** The card extent of a geometry seen from the camera's direction: [x0 along cardRight, y0 along cardUp, size], square and padded. */
function cardRect(geometry) {
  if (!geometry.boundingBox) geometry.computeBoundingBox();
  const box = geometry.boundingBox; if (box.isEmpty()) return [-.5, 0, 1];
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
    corner.set(x, y, z); const u = corner.dot(cardRight), v = corner.dot(cardUp);
    x0 = Math.min(x0, u); x1 = Math.max(x1, u); y0 = Math.min(y0, v); y1 = Math.max(y1, v);
  }
  const size = Math.max(x1 - x0, y1 - y0) * 1.06;
  return [(x0 + x1) / 2 - size / 2, (y0 + y1) / 2 - size / 2, size];
}
/** The average vertex colour of a geometry: the empty texels of its cell take it, so a far card's mip levels do not darken. */
function averageColor(geometry, out) {
  const colors = geometry.getAttribute('color'); if (!colors) return out.setRGB(1, 1, 1);
  let r = 0, g = 0, b = 0; for (let i = 0; i < colors.count; i++) { r += colors.getX(i); g += colors.getY(i); b += colors.getZ(i); }
  return out.setRGB(r / colors.count, g / colors.count, b / colors.count);
}

function cardMaterial(map, rects) {
  // Toon-lit like the ground under it, so a card matches the grass around it.
  const material = new T.MeshToonMaterial({ map, alphaTest: CARD.alphaTest, gradientMap: TOON_RAMP });
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, { cardTime: time, cardUp: { value: cardUp }, cardRight: { value: cardRight }, cardToCamera: { value: toCamera }, cardRect: { value: rects } });
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\nattribute vec4 aCard;\nuniform float cardTime;\nuniform vec3 cardUp;\nuniform vec3 cardRight;\nuniform vec3 cardToCamera;\nuniform vec3 cardRect[${CELLS}];\nvarying float vCardGlow;`)
      .replace('#include <begin_vertex>', [
        // aCard: cell, flip (1 or -1), wind seed, glow. position.xy is the quad's 0..1 corner.
        // A mirrored card reads the picture right to left but keeps its corners in order, so it stays front-facing.
        'vec3 cardBox = cardRect[int(aCard.x + .5)];',
        'float cardV = position.y, cardU = aCard.y > 0.0 ? position.x : 1.0 - position.x;',
        'vec3 transformed = cardRight * (aCard.y * (cardBox.x + cardU * cardBox.z)) + cardUp * (cardBox.y + cardV * cardBox.z);',
        // What stands nearer the camera than the piece's root is drawn lower on the card, below the root: left there, the ground
        // would hide it (the front stone of a heap of pebbles, the glowing bits of the embers). The lens is orthographic, so sliding
        // the whole card toward the camera moves nothing on the screen; it only lifts the card until its lower edge is on the ground.
        'transformed += cardToCamera * (max(0.0, -cardBox.y) * cardUp.y / cardToCamera.y);',
        '#ifdef USE_INSTANCING',
        'vec3 cardRoot = instanceMatrix[3].xyz;',
        '#else',
        'vec3 cardRoot = vec3(0.0);',
        '#endif',
        // Only the upper part bends, more at the tip; neighbours sway a little out of step.
        `transformed += cardRight * (sin(cardTime * 1.9 + cardRoot.x * .35 + cardRoot.z * .27 + aCard.z) * ${CARD.sway.toFixed(3)} * cardV * cardV * cardBox.z);`,
        'vCardGlow = aCard.w;',
      ].join('\n'))
      .replace('#include <uv_vertex>', `#include <uv_vertex>\n#ifdef USE_MAP\nvMapUv = (vec2(mod(aCard.x + .5, ${CARD.columns}.0) - .5, floor((aCard.x + .5) / ${CARD.columns}.0)) + vec2(aCard.y > 0.0 ? uv.x : 1.0 - uv.x, uv.y)) / ${CARD.columns}.0;\n#endif`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vCardGlow;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * vCardGlow;');
  };
  material.customProgramCacheKey = () => 'cover-card';
  return material;
}

let quad = null;
const unitQuad = () => quad ??= (() => { const g = new T.PlaneGeometry(1, 1).translate(.5, .5, 0), n = g.getAttribute('normal'); for (let i = 0; i < n.count; i++) n.setXYZ(i, 0, 1, 0); return g; })();

export class CoverAtlas {
  constructor(renderer) {
    this.renderer = renderer; this.size = CARD.cell * CARD.columns;
    this.target = new T.WebGLRenderTarget(this.size, this.size, { generateMipmaps: true, minFilter: T.LinearMipmapLinearFilter, magFilter: T.LinearFilter });
    this.target.scissorTest = true;
    this.rects = new Float32Array(CELLS * 3); for (let i = 0; i < CELLS; i++) this.rects.set([-.5, 0, 1], i * 3);
    this.material = cardMaterial(this.target.texture, this.rects);
    this.cells = new Map(); // key -> {index, final}
    this.scene = new T.Scene(); this.camera = new T.OrthographicCamera(-1, 1, 1, -1, .1, 60);
    this.camera.position.copy(toCamera).multiplyScalar(30); this.camera.lookAt(0, 0, 0); this.camera.updateMatrixWorld(true);
    this.flat = new T.MeshBasicMaterial({ vertexColors: true, side: T.DoubleSide });
    this.renders = 0;
  }
  /** Whether a kind's cell already holds the picture of its real model. */
  final(key) { return !!this.cells.get(key)?.final; }
  /**
   * Renders (or re-renders) a kind's cell from a geometry with baked vertex colours and returns the cell's index, or -1
   * when all 64 cells are taken. `final` is false for a stand-in shape that a kit will replace.
   */
  draw(key, geometry, final = true) {
    let cell = this.cells.get(key);
    if (!cell) { if (this.cells.size >= CELLS) { console.warn(`The card atlas is full; "${key}" is not drawn.`); return -1; } this.cells.set(key, cell = { index: this.cells.size, final: false }); }
    const r = this.renderer, t = this.target, col = cell.index % CARD.columns, row = Math.floor(cell.index / CARD.columns), [x0, y0, s] = cardRect(geometry);
    const saved = { target: r.getRenderTarget(), autoClear: r.autoClear, color: r.getClearColor(new T.Color()), alpha: r.getClearAlpha(), shadows: r.shadowMap.autoUpdate };
    const mesh = new T.Mesh(geometry, this.flat); this.scene.add(mesh);
    Object.assign(this.camera, { left: x0, right: x0 + s, bottom: y0, top: y0 + s }); this.camera.updateProjectionMatrix();
    // Each cell is drawn through the target's own viewport and scissor (the renderer's would be scaled by the pixel ratio).
    t.viewport.set(col * CARD.cell, row * CARD.cell, CARD.cell, CARD.cell); t.scissor.copy(t.viewport);
    r.shadowMap.autoUpdate = false; r.autoClear = false; r.setRenderTarget(t); r.setClearColor(averageColor(geometry, new T.Color()), 0); r.clear(); r.render(this.scene, this.camera);
    this.scene.remove(mesh);
    r.setRenderTarget(saved.target); r.setClearColor(saved.color, saved.alpha); r.autoClear = saved.autoClear; r.shadowMap.autoUpdate = saved.shadows;
    this.rects.set([x0, y0, s], cell.index * 3); cell.final = final; this.renders++;
    return cell.index;
  }
  /** One batch of cards for a tile: `cards` are fieldCards rows with a `cell`; positions are taken relative to (ox, oz). */
  batch(cards, ox, oz) {
    // Its own copy of the four corners: a batch is disposed with its tile, and a shared attribute would lose its buffer with it.
    const geometry = unitQuad().clone();
    const data = new Float32Array(cards.length * 4), mesh = new T.InstancedMesh(geometry, this.material, cards.length), matrix = new T.Matrix4();
    cards.forEach((c, i) => {
      data.set([c.cell, c.turn < .5 ? 1 : -1, c.turn * 19.3, c.glow ? 1 : 0], i * 4);
      mesh.setMatrixAt(i, matrix.makeScale(c.scale, c.scale, c.scale).setPosition(c.x - ox, 0, c.z - oz));
    });
    geometry.setAttribute('aCard', new T.InstancedBufferAttribute(data, 4));
    // A card reaches at most about 2.5 m from its root (a bush at scale 1.25); the instances' own places do the rest.
    geometry.boundingSphere = new T.Sphere(new T.Vector3(), 2.5); geometry.boundingBox = new T.Box3(new T.Vector3(-2.5, -2.5, -2.5), new T.Vector3(2.5, 2.5, 2.5));
    mesh.instanceMatrix.needsUpdate = true; mesh.computeBoundingSphere();
    mesh.castShadow = false; mesh.receiveShadow = true; mesh.name = 'cover-cards'; mesh.userData.coverCards = true;
    return mesh;
  }
  /** The atlas as a PNG data URL (for the evidence shots and for looking at a kind's picture; nothing in the game calls it). */
  image() {
    const n = this.size, pixels = new Uint8Array(n * n * 4); this.renderer.readRenderTargetPixels(this.target, 0, 0, n, n, pixels);
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = n; const g = canvas.getContext('2d'), data = g.createImageData(n, n);
    for (let y = 0; y < n; y++) data.data.set(pixels.subarray((n - 1 - y) * n * 4, (n - y) * n * 4), y * n * 4); // the target's first row is its bottom
    g.putImageData(data, 0, 0); return canvas.toDataURL('image/png');
  }
  dispose() { this.material.dispose(); this.target.dispose(); this.flat.dispose(); }
}
/** Frees a card batch (its own corners and instance buffers; the atlas stays). */
export function disposeCards(mesh) { mesh.geometry.dispose(); mesh.dispose(); }
