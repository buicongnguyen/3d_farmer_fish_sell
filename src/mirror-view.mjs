// The bedroom mirror's character builder, after Zoo Garden's (cute_game src/look-shop.ts, look-tiles.ts,
// mirror-preview.ts): four rows of option tiles (body, height, ears, hood), each a rendered portrait, beside a
// wooden-framed mirror that shows the whole combination on your own avatar, in your shirt colour and outfit. Every tap
// also previews the combination on the character in the room (world.setTryOn, never saved); one button buys what the
// combination still needs (act 'look') or wears it. Owned options combine freely.
//
//   lookShopHtml(state, draft, iconBase)   the panel body (pure string: the tests read it)
//   const mirror = installMirror(world, {state, act, panel, render, toast})   once (main.mjs)
//   mirror.panel() -> {title, kicker, html, cls} for main.mjs renderPanel (panel === 'mirror'); mirror.paint() after it
//   new MirrorPreview(world, {reach, yaw})  the framed picture: the wardrobe uses one too
import * as T from 'three';
import { OPTIONS, ROWS, ROW_IDS, ROW_NAMES, lookName, lookOf, lookOptions, lookPrice, missingOptions, ownsOption, swapOption, headline } from './looks.mjs';
import { avatarAssets, buildAvatar, disposeAvatar, playerWants, restPose, styleKey } from './avatar.mjs';
import { gearOf } from './gear.mjs';
import { ui } from './garments.mjs';
import { CAMERA_PITCH } from './field-layout.mjs';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const coin = '<i class="sv-coin" aria-hidden="true"></i>';
export const lookArt = (row, value, base = './assets/icons/looks/') => `${base}${OPTIONS[row][value].art}.webp`;

/** The four rows of tiles: the chosen one is lit, owned ones say so, the others show their price. */
export function lookRowsHtml(s, draft, worn = lookOf(s), base) {
  const wornOpts = lookOptions(worn), chosen = lookOptions(draft);
  return ROW_IDS.map((row, r) => `<div class="look-row" data-look-row="${row}"><span class="look-row-name">${ROW_NAMES[row]}</span><div class="look-chips">${ROWS[row].map(value => {
    const opt = OPTIONS[row][value], on = chosen[r][1] === value, owned = ownsOption(s, row, value), wearing = wornOpts[r][1] === value;
    const tag = wearing ? '<small class="look-state">Wearing</small>' : owned ? (opt.price ? '<small class="look-state owned">✓ Owned</small>' : '') : `<small class="look-price">${coin}${opt.price}</small>`;
    return `<button class="look-chip${on ? ' on' : ''}${wearing ? ' worn' : ''}" data-look-option="${row}:${value}" aria-pressed="${on}" title="${esc(opt.name)}"><span class="look-chip-icon"><img class="look-chip-art" src="${esc(lookArt(row, value, base))}" alt="${opt.icon}" width="128" height="128" loading="lazy" decoding="async" draggable="false"></span><span class="look-chip-name">${esc(opt.name)}</span>${tag}</button>`;
  }).join('')}</div></div>`).join('');
}
/** The wooden mirror frame; MirrorPreview draws into its glass (`slot` names whose picture it holds). */
export const mirrorHtml = (slot, caption = '') => `<figure class="look-mirror"><div class="mirror-glass" data-mirror-slot="${slot}"></div>${caption ? `<figcaption>${esc(caption)}</figcaption>` : ''}</figure>`;
/** The builder: mirror, rows, and the footer that buys or wears the combination. */
export function lookShopHtml(s, draft, base) {
  const worn = lookOf(s), price = lookPrice(s, draft), missing = missingOptions(s, draft);
  const main = draft === worn ? '<span class="chip equipped">✓ Wearing</span>'
    : missing.length ? `<button class="primary price-btn${(s.coins ?? 0) < price ? ' cant-afford' : ''}" data-look-action="buy">Buy ${coin}<b>${price}</b></button>`
    : '<button class="primary" data-look-action="wear">Wear</button>';
  const back = draft === worn ? '' : '<button class="soft-button" data-look-action="reset">Back to mine</button>';
  return `<p class="panel-intro look-intro">Mix a body, a height, ears and an animal hood. Owned options combine freely; a hood brings its own ears and a hat covers it. Your clothes and gear fit every look.</p>`
    + `<div class="look-studio">${mirrorHtml('mirror')}<div class="look-builder">${lookRowsHtml(s, draft, worn, base)}${ui.view?.mirrorClothesHtml(s) ?? ''}</div></div>`
    + `<div class="look-footer"><strong class="look-name">${esc(lookName(draft))}</strong><div class="look-buttons">${back}${main}</div></div>`;
}
/**
 * Brings each row's chosen tile into view when it is not: a row opens centred on its tile. A row you scrolled yourself
 * stays where it is (panel-scroll.mjs keeps it across a redraw), since the tile you tapped is in view already.
 */
export function centreChosen(root = document) {
  root.querySelectorAll('.look-chips .look-chip.on').forEach(chip => {
    const row = chip.parentElement; if (row.scrollWidth <= row.clientWidth) return;
    const a = chip.getBoundingClientRect(), b = row.getBoundingClientRect();
    if (a.left < b.left - 1 || a.right > b.right + 1) row.scrollLeft = chip.offsetLeft - (row.clientWidth - chip.offsetWidth) / 2;
  });
}

// ---------------------------------------------------------------- the framed picture
const box = new T.Box3(), part = new T.Box3(), corner = new T.Vector3();
/** The picture is turned a little, so the face and one side read. */
export const MIRROR_YAW = -.3;
/**
 * How a picture of a figure is framed from the game's camera: high above, looking down at `pitch` (the angle the
 * village is seen from, field-layout.mjs CAMERA_PITCH), so the glass shows the character as it looks in play.
 * `bounds` is the figure's box {min, max} (already turned); `aspect` the glass's width over height; `reach` the metres
 * of standing height the glass is sized for (omit it to fit the figure). Seen from that camera a point lands at
 * (x, y cos pitch − z sin pitch): the frame keeps the feet a little above its bottom edge and always holds the whole
 * figure, hat and hood included, growing when a look is taller or wider than `reach` allows.
 * Returns {span, u, v, target: [x, y, z], pitch}: the frame is `span` high and centred on (u, v) in that view.
 */
export function mirrorFrame(bounds, aspect, { reach = 0, pitch = CAMERA_PITCH, depth = 1, margin = .07 } = {}) {
  const c = Math.cos(pitch), s = Math.sin(pitch), { min, max } = bounds;
  // The figure's extent up the picture: its lowest point is the front of the feet, its highest the back of the head.
  const low = min.y * c - max.z * s, high = max.y * c - min.z * s, tall = high - low, wide = max.x - min.x;
  const sized = reach ? reach * c + depth * s : 0, pad = (sized || tall) * margin;
  const span = Math.max(sized, tall + pad * 2, (wide + pad * 2) / aspect);
  const u = (min.x + max.x) / 2, v = low - pad + span / 2;
  return { span, u, v, pitch, low, high, target: [u, v * c, -v * s] };
}
/**
 * A portrait of an avatar in a 2D canvas, drawn only when what it shows changes: show(slot, key, build) puts the canvas
 * into `slot` and, when `key` (or the slot's size) differs from the last drawing, builds the model, renders it once
 * through the game's own renderer into a render target, copies the pixels and frees the model. The same key again costs
 * nothing, so a panel can re-render its HTML on every tap. The picture is taken from the game's own camera angle
 * (mirrorFrame), with a soft shadow on the floor under the feet. `reach` fixes how many metres of height the glass is
 * sized for (the tallest look fits and every look is drawn at the same scale, so they compare in it); without it the
 * model is fitted.
 */
export class MirrorPreview {
  constructor(world, opts = {}) {
    this.world = world; this.opts = opts; this.renders = 0; this.key = '';
    this.canvas = document.createElement('canvas'); this.canvas.className = 'mirror-canvas';
    this.scene = world.iconScene(); this.holder = new T.Group(); this.scene.add(this.holder);
    // The floor under the feet: a soft round shadow, seen from the same high camera as the figure.
    const shade = document.createElement('canvas'); shade.width = shade.height = 64; const g = shade.getContext('2d'), fade = g.createRadialGradient(32, 32, 4, 32, 32, 32);
    fade.addColorStop(0, 'rgba(50,80,112,.34)'); fade.addColorStop(.55, 'rgba(50,80,112,.2)'); fade.addColorStop(1, 'rgba(50,80,112,0)'); g.fillStyle = fade; g.fillRect(0, 0, 64, 64);
    const map = new T.CanvasTexture(shade); map.colorSpace = T.SRGBColorSpace;
    const blob = new T.Mesh(new T.PlaneGeometry(2.1, 2.1), new T.MeshBasicMaterial({ map, transparent: true, depthWrite: false, toneMapped: false })); blob.rotation.x = -Math.PI / 2; blob.position.y = .004; blob.renderOrder = -1;
    this.scene.add(blob);
    this.camera = new T.PerspectiveCamera(16, 1, .1, 120); this.target = null; this.pixels = null; this.framing = null;
  }
  reset() { this.key = ''; }
  show(slot, key, build) {
    if (slot && this.canvas.parentElement !== slot) slot.replaceChildren(this.canvas);
    const w = Math.round(slot?.clientWidth || this.opts.width || 160), h = Math.round(slot?.clientHeight || this.opts.height || 220);
    const dpr = Math.min(2, Math.max(1, globalThis.devicePixelRatio || 1)), full = `${key}|${w}x${h}@${dpr}`;
    if (full === this.key) return false;
    this.key = full; // set first: a failure is not retried on every repaint
    let model = null; const r = this.world.renderer, pw = Math.round(w * dpr), ph = Math.round(h * dpr), oldTarget = r.getRenderTarget(), old = r.getClearColor(new T.Color()), alpha = r.getClearAlpha();
    try {
      model = build(); if (!model) return false;
      this.holder.add(model); model.rotation.y += this.opts.yaw ?? MIRROR_YAW; this.frame(model, w / h);
      if (!this.target || this.target.width !== pw || this.target.height !== ph) { this.target?.dispose(); this.target = new T.WebGLRenderTarget(pw, ph, { samples: 4 }); this.target.texture.colorSpace = T.SRGBColorSpace; this.pixels = new Uint8Array(pw * ph * 4); }
      r.setClearColor(0, 0); r.setRenderTarget(this.target); r.clear(); r.render(this.scene, this.camera);
      r.readRenderTargetPixels(this.target, 0, 0, pw, ph, this.pixels);
      this.canvas.width = pw; this.canvas.height = ph;
      const g = this.canvas.getContext('2d'), img = g.createImageData(pw, ph), row = pw * 4;
      for (let y = 0; y < ph; y++) img.data.set(this.pixels.subarray((ph - 1 - y) * row, (ph - y) * row), y * row);
      g.putImageData(img, 0, 0); this.renders++; return true;
    } catch { return false; } finally { try { r.setRenderTarget(oldTarget); r.setClearColor(old, alpha); } finally { if (model) { this.holder.remove(model); disposeAvatar(model); } } }
  }
  /** Aims the camera from high above (mirrorFrame): the whole figure in, the feet near the glass's bottom edge. */
  frame(model, aspect) {
    model.updateMatrixWorld(true); box.makeEmpty();
    model.traverseVisible(o => { if (!o.isMesh) return; o.geometry.boundingBox ?? o.geometry.computeBoundingBox(); part.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld); box.union(part); });
    if (box.isEmpty()) box.set(new T.Vector3(-.5, 0, -.5), new T.Vector3(.5, 2.3, .5));
    const f = this.framing = mirrorFrame(box, aspect, { reach: this.opts.reach, pitch: this.opts.pitch }), fov = T.MathUtils.degToRad(this.camera.fov);
    // Far enough that the long lens is almost flat (the village camera is orthographic), behind and above the figure.
    const dist = f.span / 2 / Math.tan(fov / 2), c = Math.cos(f.pitch), s = Math.sin(f.pitch);
    this.camera.aspect = aspect; this.camera.position.set(f.target[0], f.target[1] + s * dist, f.target[2] + c * dist);
    this.camera.lookAt(corner.set(f.target[0], f.target[1], f.target[2])); this.camera.updateProjectionMatrix();
  }
}

// ---------------------------------------------------------------- the panel
export function installMirror(world, deps) {
  if (world.__mirror) return world.__mirror;
  const preview = new MirrorPreview(world, { reach: 3.75, width: 190, height: 270 });
  const s = () => deps.state(), open = () => deps.panel() === 'mirror';
  const draft = () => world.tryOn?.look ?? lookOf(s());
  function panel() { return { title: 'Mirror, mirror', kicker: 'YOUR LOOK', html: lookShopHtml(s(), draft()), cls: 'ref-menu mirror-modal' }; }
  /** Draws the glass (only when the combination, the colour or the outfit changed) and keeps the chosen tiles in view. */
  function paint() {
    if (!open()) return;
    if (!world.tryOn && gearOf(s()).hat) tryLook(lookOf(s())); // the hat comes off at the mirror
    const id = draft(), wants = playerWants(world), gear = { ...wants.gear, hat: '', pet: '' }; // bare-headed: a hat would cover the ears or hood being tried
    const want = { look: id, gear }, waiting = avatarAssets(world, want);
    centreChosen(document.getElementById('modal') ?? document);
    preview.show(document.querySelector('[data-mirror-slot="mirror"]'), styleKey({ look: id, outfitColor: wants.outfitColor, gear }) + (waiting ? '|loading' : ''), () => restPose(buildAvatar(world, { look: id, outfitColor: wants.outfitColor, gear })));
    waiting?.then(() => { if (open() && draft() === id) paint(); });
  }
  /** The look on the character in the room, bare-headed like the glass (a hat would cover the ears or hood being tried). */
  function tryLook(id) {
    const mine = lookOf(s()), gear = gearOf(s());
    world.setTryOn(id === mine && !gear.hat ? null : { look: id, gear: { ...gear, hat: '' } });
  }
  document.addEventListener('click', e => {
    if (!open()) return;
    const chip = e.target.closest?.('[data-look-option]');
    if (chip) { const [row, value] = chip.dataset.lookOption.split(':'), next = swapOption(draft(), row, value); if (next !== draft()) { tryLook(next); world.burst?.('#ffe66d'); } deps.render(); return; }
    const button = e.target.closest?.('[data-look-action]'); if (!button || button.disabled) return;
    const action = button.dataset.lookAction, id = draft();
    if (action === 'reset') { tryLook(lookOf(s())); deps.render(); return; }
    world.setTryOn(null); // the saved look takes over (or stays, when the coins are short)
    const r = deps.act('look', { id });
    if (!r?.ok) { tryLook(id); deps.render(); } else { world.burst?.('#ff9ec7'); deps.render(); }
  });
  return world.__mirror = { panel, paint, preview, draft, headline: () => headline(draft()) };
}
