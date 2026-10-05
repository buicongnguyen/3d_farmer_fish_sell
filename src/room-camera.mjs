// How the inside of a house is seen, after the Zoo Garden cottage (cute_game house-session.ts houseFocus, camera-rig.ts,
// house-hotspots.ts, house.css): a 40° perspective lens looking straight into the dollhouse at a 52° pitch, framed so the
// cottage fills the screen, small label chips pinned low on the things you can use, and on desktop a warm glow and a
// floor ring around the thing under the mouse, so you see what a click will use.
// Wide screens show the whole house. Phones frame the occupied room and glide between rooms; the larger living
// room follows the player within its walls. The small rooms stay centred, with their furniture clear of the HUD.
//
//   installRoomCamera(world)   loaded after the first village frame; room-view.mjs preserves each client's handle.
//
// While the mirror or the wardrobe is open (world.__lookFocus = {dx, dy, span}, set by dock.mjs) the camera moves in on the
// player and slides the picture by (dx, dy) pixels, so the character stands in the free part of the screen: left of a
// docked panel, above a phone's sheet (the reference's dialog-dock.ts does this for its follow camera).
//
// World stays untouched: while world.location is 'interior', world.camera is swapped for a PerspectiveCamera (World's
// project(), click() and resize() keep working with it), and a wrapper around world.renderer.render aims it, then moves
// the label chips. world.exit is wrapped so the outdoor camera is back before World resizes. Labels and hover come from
// world.__roomHotspots ({target, icon, text, box}), which interior.mjs fills on every rebuild.
import * as T from 'three';
import { ROOM, ROOMS, roomAt } from './home-plan.mjs';

const PITCH = 52 * Math.PI / 180, FOV = 40;
/** Metres of height the screen shows around the player while the mirror or the wardrobe is open. */
const LOOK_SPAN = 6.2;
/** The house box framed by the camera (floor, wall tops at the back, low walls at the front). */
const FX = ROOM.w / 2 + .15, FZ0 = -(ROOM.d / 2 + .15), FZ1 = ROOM.d / 2 + .2;
export const FRAME = [[-FX, 0, FZ0], [FX, 0, FZ0], [-FX, 0, FZ1], [FX, 0, FZ1], [-FX, ROOM.full, FZ0 + .05], [FX, ROOM.full, FZ0 + .05], [-FX, ROOM.low + .04, FZ1 - .05], [FX, ROOM.low + .04, FZ1 - .05]];
const v = new T.Vector3(), fitCam = new T.PerspectiveCamera();
/** Portrait phones: the pixels the HUD keeps at the top (player card, day chip) and the bottom (controls.css: the stick ends 144 px up, the prompt pill 204). */
export const BAND = { top: 148, bottom: 212 };
/** On a phone a metre is never drawn smaller than this many pixels (a 2.3 m person stays 60 px tall): the view follows you instead. */
export const MIN_SCALE = 26;
/** A portrait phone shows the whole house across the screen (overview), so a metre may be this few pixels at the narrowest. */
export const MIN_SCALE_OVERVIEW = 16;
/** A landscape phone stands this near at the nearest: the stick (bottom left) and ACT (bottom right) then stay clear of the house's front corners. */
export const MIN_SCALE_SHORT = 23;
/** Overview: the pixels kept clear of the screen's edge on each side of the house (the safe-area inset is added by the page). */
export const EDGE_PX = 14;
/** Overview: how far (NDC) the house may sit from the middle of the band before the camera backs off to centre it. */
export const OFF_CENTRE = .12;
/** A landscape phone: wide and short (the same line the stylesheets draw at max-height 500px). */
const SHORT = 500;
/** Which framing a screen gets: 'portrait' (follows you along the width), 'short' (follows you along the depth) or 'whole'. */
export const frameFor = (width, height) => width / Math.max(1, height) < .8 ? 'portrait' : height <= SHORT && width > height ? 'short' : 'whole';

/**
 * Camera framing for a screen: the smallest distance that fits the house in the band of the screen the HUD leaves
 * free, but on a phone never so far that things get smaller than MIN_SCALE pixels to the metre. What then does not fit
 * is followed: the view slides with you, up to reachX along the width and between tzBack and tzFront along the depth,
 * and stops at the walls.
 *   whole     wide screens: the whole house, no sliding;
 *   portrait  tall phones: the depth of the house between the top HUD and the thumb controls, sliding along the width
 *             (a short phone slides along the depth too);
 *   short     landscape phones: the width of the house between the stick and ACT, sliding along the depth so the back
 *             wall stays under the top HUD line and the front wall above the prompt pill.
 * Returns {mode, d, tz, fov, pitch, scale, reachX, tzBack, tzFront, tanX, cos}; `scale` is pixels per metre where the
 * camera looks, `reachX` the slide along the width at that depth (reachX() gives it for any depth: nearer the camera
 * the view is narrower, so it may slide farther).
 */
export function fit(aspect, height = 900) {
  const mode = frameFor(aspect * height, height), portrait = mode === 'portrait', short = mode === 'short';
  const fov = FOV, pitch = portrait ? 64 * Math.PI / 180 : PITCH, tan = Math.tan(fov * Math.PI / 360);
  // The band of the screen the house may take (NDC: -1 bottom, 1 top). On a portrait phone it is what the HUD leaves
  // free in pixels: BAND.top for the player card and the chips under it, BAND.bottom for the stick, ACT and the prompt pill.
  const box = portrait ? { x: 1 - 2 * EDGE_PX / (aspect * height), y0: -1 + 2 * BAND.bottom / height, y1: 1 - 2 * BAND.top / height } : short ? { x: .8, y0: -.6, y1: .46 } : { x: .99, y0: -.56, y1: .97 };
  Object.assign(fitCam, { fov, aspect, near: .5, far: 200 }); fitCam.updateProjectionMatrix();
  const place = (d, tz, tx = 0) => { fitCam.position.set(tx, Math.sin(pitch) * d, tz + Math.cos(pitch) * d); fitCam.lookAt(tx, 0, tz); fitCam.updateMatrixWorld(true); };
  // What has to fit: the depth on a portrait phone, the width on a landscape one, everything on a wide screen.
  const points = FRAME, span = Math.ceil(ROOM.d / 2);
  let best = null;
  for (let d = 8; d < 120 && !best; d += .2) {
    for (let tz = short ? 0 : -span * 2; tz <= (short ? 0 : span * 2); tz += .1) {
      place(d, tz); let ok = true, top = -9, bottom = 9;
      for (const p of points) { v.set(p[0], p[1], p[2]).project(fitCam); if (Math.abs(v.x) > box.x) ok = false; top = Math.max(top, v.y); bottom = Math.min(bottom, v.y); }
      // Overview: the house also rests within OFF_CENTRE of the middle of the band, not at its top.
      if (ok && (short || (top <= box.y1 && bottom >= box.y0 && (!portrait || Math.abs(top + bottom - box.y0 - box.y1) <= 2 * OFF_CENTRE)))) { best = { d, tz }; break; }
    }
  }
  best ??= { d: 40, tz: 0 };
  // A phone never stands farther back than MIN_SCALE allows (pixels per metre at the point looked at: height / (2 d tan(fov / 2))).
  if (short) best.d = Math.min(best.d, height / (2 * MIN_SCALE_SHORT * tan));
  // tanX: half the floor's width in view for every metre of distance along the lens (between the thumbs on a landscape phone).
  const d = best.d; Object.assign(best, { mode, portrait, short, fov, pitch, scale: height / (2 * d * tan), reachX: 0, tzBack: best.tz, tzFront: best.tz, tanX: tan * aspect * (short ? box.x : 1), cos: Math.cos(pitch) });
  if (mode === 'whole' || portrait) return best; // (a portrait phone sees the whole house: no sliding)
  // How far the view may slide sideways before it runs past the walls: nothing when the whole width is on the screen.
  best.reachX = reachX(best);
  // Where the view stops along the depth: looking farther back than tzBack would drop the back wall's top below the
  // band; nearer than tzFront would lift the front wall's foot above it. When the whole depth is in the band the two
  // meet (no travel), and the view rests where the fit put it.
  let back = null, front = null;
  for (let tz = -ROOM.d; tz <= ROOM.d; tz += .05) {
    place(d, tz);
    const wallTop = v.set(0, ROOM.full, FZ0).project(fitCam).y, frontBase = v.set(0, 0, FZ1).project(fitCam).y;
    if (back === null && wallTop >= box.y1) back = tz;
    if (frontBase <= box.y0) front = tz;
  }
  back ??= best.tz; front ??= best.tz;
  if (back >= front - .1) back = front = (back + front) / 2;
  best.tzBack = back; best.tzFront = front; if (short || back < front) best.tz = front;
  return best;
}
/** Where the view looks along the depth for a player at z: a little past them, inside its travel. */
export const followZ = (framing, z) => Math.max(framing.tzBack, Math.min(framing.tzFront, z - 1.4));
/**
 * How far the view may slide along the width while it looks at depth `tz` and you stand at depth `z`: until the side
 * wall (and 0.4 m of the table beyond it) is at the edge of the screen at your depth. The floor nearer the camera is
 * drawn larger, so there the view shows less of the width and slides farther; you are never pushed off the screen.
 */
export function reachX(framing, z = framing.tz, tz = framing.tz) {
  if (framing.mode === 'whole') return 0;
  const reach = ROOM.w / 2 + .4 - framing.tanX * (framing.d - (z - tz) * framing.cos);
  return reach < .15 ? 0 : reach;
}
/** Where it looks along the width for a player at (x, z) while it looks at depth `tz`. */
export function followX(framing, x, z = framing.tz, tz = framing.tz) { const r = reachX(framing, z, tz); return Math.max(-r, Math.min(r, x)); }

/** Keep the last room through a doorway's threshold, avoiding a camera jump when feet cross a seam repeatedly. */
export function focusRoom(p, previous, list = ROOMS) {
  const r = previous?.rect;
  return r && p.x >= r.x0 - .28 && p.x <= r.x1 + .28 && p.z >= r.z0 - .28 && p.z <= r.z1 + .28 ? previous : list.find(q => p.x >= q.rect.x0 && p.x <= q.rect.x1 && p.z >= q.rect.z0 && p.z <= q.rect.z1) ?? previous ?? list[Math.min(3, list.length - 1)];
}
/** A room-sized phone view. Fit once per screen size; the large rooms slide a bounded window within their walls. */
export function frameRoom(base, width, height, room) {
  const r = room.rect, spanX = Math.max(6.2, Math.min(9, r.x1 - r.x0)), spanZ = Math.max(6.4, Math.min(8.4, r.z1 - r.z0));
  const top = base.short ? 92 : BAND.top, bottom = base.short ? 66 : BAND.bottom, shiftY = (bottom - top) / 2;
  const side = base.short ? Math.min(126, width * .2) : EDGE_PX, tan = Math.tan(base.fov * Math.PI / 360), sin = Math.sin(base.pitch), cos = Math.cos(base.pitch);
  // Perspective divide: each corner's depth must fit its horizontal and vertical extent in the free screen band.
  const across = spanX / (2 * tan * width / height * (1 - 2 * side / width)), vertical = tan * (1 - (top + bottom) / height);
  let d = 4;
  for (const z of [-spanZ / 2, spanZ / 2]) for (const y of [-.8, ROOM.full - .8]) {
    d = Math.max(d, y * sin + z * cos + Math.max(across, Math.abs(y * cos - z * sin) / vertical));
  }
  return { room, spanX, spanZ, d, shiftY, top, bottom };
}
const roomBound = (n, a, b, span) => b - a <= span ? (a + b) / 2 : Math.max(a + span / 2, Math.min(b - span / 2, n));
export function roomTarget(frame, p, out = {}) {
  const r = frame.room.rect;
  out.x = roomBound(p.x, r.x0, r.x1, frame.spanX); out.y = .8; out.z = roomBound(p.z, r.z0, r.z1, frame.spanZ); return out;
}

export function installRoomCamera(world) {
  if (world.__roomCamera) return world.__roomCamera;
  const persp = new T.PerspectiveCamera(FOV, innerWidth / innerHeight, .5, 220);
  let framedFor = null, outdoor = null, framing = null, framedAspect = 0, framedHeight = 0, snap = true, focus = 0, shiftX = 0, shiftY = 0, span = LOOK_SPAN, room = null, rooms = null, distance = 0;
  const target = new T.Vector3(), smooth = new T.Vector3();
  const swapIn = () => { if (world.camera === persp) return; outdoor = world.camera; world.camera = persp; framedAspect = 0; snap = true; smooth.set(0, 0, 0); };
  const swapOut = () => { if (world.camera !== persp) return; world.camera = outdoor; outdoor = null; hideLabels(); hover(null); world.resize?.(); };

  // ---- framing
  function aim() {
    const aspect = innerWidth / Math.max(1, innerHeight);
    if (Math.abs(aspect - framedAspect) > 1e-3 || innerHeight !== framedHeight || framedFor !== (world.facility ?? null)) { framedFor = world.facility ?? null; room = null; framing = fit(aspect, innerHeight); rooms = framing.mode === 'whole' ? null : new Map((framedFor?.plan.rooms ?? ROOMS).map(r => [r, frameRoom(framing, innerWidth, innerHeight, r)])); framedAspect = aspect; framedHeight = innerHeight; persp.fov = framing.fov; persp.aspect = aspect; persp.updateProjectionMatrix(); snap = true; }
    // A small room stays centred. Larger rooms follow the player without drifting beyond their walls.
    const p = world.player?.position ?? v.set(0, 0, 0);
    let active = null;
    if (!rooms) target.set(0, 0, framing.tz); else { room = focusRoom(p, room, world.facility?.plan.rooms ?? ROOMS); active = rooms.get(room); roomTarget(active, p, target); }
    const wantDistance = active?.d ?? framing.d;
    if (snap || !rooms) { smooth.copy(target); distance = wantDistance; snap = false; } else { smooth.lerp(target, .12); distance += (wantDistance - distance) * .12; }
    // The mirror and the wardrobe: move in on the player.
    const look = world.__lookFocus, want = look && world.player ? 1 : 0;
    focus += (want - focus) * .16; if (Math.abs(want - focus) < .003) focus = want;
    let d = distance, tx = smooth.x, ty = smooth.y, tz = smooth.z, offsetX = 0, offsetY = active?.shiftY ?? 0;
    if (focus > 0) {
      if (look) span = look.span ?? LOOK_SPAN;
      const p = world.player.position, near = span / (2 * Math.tan(persp.fov * Math.PI / 360));
      tx += (p.x - tx) * focus; ty += (1 - ty) * focus; tz += (p.z - tz) * focus; d += (near - d) * focus;
      if (look) { shiftX = look.dx; shiftY = look.dy; }
      offsetX = shiftX * focus; offsetY += (shiftY - offsetY) * focus;
    }
    if (offsetX || offsetY) persp.setViewOffset(innerWidth, innerHeight, offsetX, offsetY, innerWidth, innerHeight); else if (persp.view?.enabled) persp.clearViewOffset();
    persp.position.set(tx, ty + Math.sin(framing.pitch) * d, tz + Math.cos(framing.pitch) * d);
    persp.lookAt(tx, ty, tz);
    persp.updateMatrixWorld(true);
  }

  // ---- label chips (DOM, like the reference's .world-label pills; they never take taps themselves)
  const layer = document.createElement('div'); layer.id = 'room-labels'; layer.setAttribute('aria-hidden', 'true');
  (document.getElementById('game')?.after ? document.getElementById('game').after(layer) : document.body.append(layer));
  let shown = null, chips = [];
  function syncChips(list) {
    if (list === shown) return; shown = list; layer.textContent = ''; chips = [];
    for (const h of list ?? []) {
      const el = document.createElement('span'); el.className = 'room-label' + (h.person ? ' person' : '');
      el.innerHTML = `<i>${h.icon}</i><b>${h.text.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))}</b>`;
      layer.append(el); chips.push({ h, el });
    }
  }
  function hideLabels() { layer.hidden = true; }
  function moveLabels() {
    const list = world.__roomHotspots; syncChips(list); layer.hidden = !!world.__decorPlacing || !list?.length || focus > .02;
    if (layer.hidden) return;
    const near = world.paused ? null : world.nearest?.(), w = innerWidth, h = innerHeight, compact = framing?.mode === 'portrait' && w < 450, crowded = compact || w < 1100 || h < 520, placed = [];
    layer.classList.toggle('compact', compact);
    // The chip you stand at or hover is placed first and keeps its place; the others give way (a nudge down, else hidden: the thing stays tappable).
    const order = chips.map((c, i) => ({ ...c, i })).sort((p, q) => ((q.h.target === near || q.h.target === hovered) - (p.h.target === near || p.h.target === hovered)) || p.i - q.i);
    for (const { h: spot, el } of order) {
      const b = spot.box; if (!b) { el.style.display = 'none'; continue; }
      const isNear = near === spot.target, isHover = hovered === spot.target;
      el.classList.toggle('near', isNear); el.classList.toggle('hover', isHover);
      // Low on the middle of the thing (house-hotspots.ts labelSpot); above the head for people. A compact chip sits on the floor just in front of the thing instead, off it.
      const mid = b.y0 + (b.y1 - b.y0) * .45, floorFront = compact && !spot.person && !spot.lift && b.y0 <= .5, y = floorFront ? .05 : spot.person ? b.y1 + .32 : spot.lift ? b.y1 + .3 : b.y0 > .5 ? mid : Math.max(.3, Math.min(1.0, mid));
      v.set((b.x0 + b.x1) / 2, y, floorFront ? b.z1 : (b.z0 + b.z1) / 2).project(persp);
      if (v.z > 1 || v.z < -1 || (rooms && (Math.abs(v.x) > .98 || Math.abs(v.y) > .94))) { el.style.display = 'none'; continue; }
      el.style.display = '';
      // A chip stays whole on the screen: its middle is kept half its size plus LABEL_EDGE px from every edge.
      const full = el._w || (el._w = el.offsetWidth || 0), small = compact && !isNear && !isHover, cwid = small ? 22 : full || 60, ch = small ? 22 : 20, cw = cwid / 2 + 6;
      const cx = T.MathUtils.clamp((v.x + 1) * w / 2, cw, w - cw); let cy = T.MathUtils.clamp((1 - v.y) * h / 2 + (floorFront ? 13 : 0), 17, h - 17);
      if (crowded) {
        const free = yy => placed.every(r => Math.abs(r.x - cx) >= (r.w + cwid) / 2 + 1 || Math.abs(r.y - yy) >= (r.h + ch) / 2 + 1);
        let ok = free(cy); if (!ok && !isNear && !isHover) for (const dy of [ch + 2, -(ch + 2)]) { const yy = T.MathUtils.clamp(cy + dy, 17, h - 17); if (free(yy)) { cy = yy; ok = true; break; } }
        if (!ok && !isNear && !isHover) { el.style.display = 'none'; continue; }
        placed.push({ x: cx, y: cy, w: cwid, h: ch });
      }
      el.style.transform = `translate(${cx}px, ${cy}px) translate(-50%, -50%)`;
    }
  }

  // ---- hover (desktop): a warm glow box and a floor ring around the thing under the mouse
  const ringGeo = new T.RingGeometry(.5, .62, 32); ringGeo.rotateX(-Math.PI / 2);
  const ring = new T.Mesh(ringGeo, new T.MeshBasicMaterial({ color: '#ffe066', transparent: true, opacity: .95, depthWrite: false, toneMapped: false }));
  const glowGeo = new T.BoxGeometry(1, 1, 1); glowGeo.translate(0, .5, 0);
  const glow = new T.Mesh(glowGeo, new T.MeshBasicMaterial({ color: '#ffd84a', transparent: true, opacity: .28, depthWrite: false, toneMapped: false, blending: T.AdditiveBlending }));
  ring.renderOrder = 3; glow.renderOrder = 4; ring.visible = glow.visible = false; ring.name = 'room-hover-ring'; glow.name = 'room-hover-glow';
  world.scene.add(ring, glow);
  let hovered = null, mouse = null, scan = 0;
  const ray = new T.Raycaster(), ndc = new T.Vector2();
  world.canvas?.addEventListener('pointermove', e => { mouse = e.pointerType === 'mouse' ? { x: e.clientX, y: e.clientY } : null; });
  world.canvas?.addEventListener('pointerleave', () => { mouse = null; });
  function hover(t) {
    if (t !== hovered) { hovered = t; if (world.canvas) world.canvas.style.cursor = t ? 'pointer' : ''; }
    const spot = t && world.__roomHotspots?.find(h => h.target === t), b = spot?.box;
    ring.visible = glow.visible = !!b; if (!b) return;
    const sx = Math.max(.5, (b.x1 - b.x0) / 2 + .3) / .56, sz = Math.max(.5, (b.z1 - b.z0) / 2 + .3) / .56;
    ring.position.set((b.x0 + b.x1) / 2, .06, (b.z0 + b.z1) / 2); ring.userData.base = [sx, sz]; ring.scale.set(sx, 1, sz);
    glow.position.set((b.x0 + b.x1) / 2, b.y0, (b.z0 + b.z1) / 2); glow.scale.set(b.x1 - b.x0 + .08, b.y1 - b.y0 + .06, b.z1 - b.z0 + .08);
  }
  function pick() {
    if (!mouse || world.paused || world.__decorPlacing) return null;
    ndc.set(mouse.x / innerWidth * 2 - 1, -mouse.y / innerHeight * 2 + 1); ray.setFromCamera(ndc, persp);
    const hits = ray.intersectObjects(world.activeTargets().map(t => t.hit), false);
    return hits[0]?.object.userData.target ?? null;
  }

  // ---- the frame hook (decor-view.mjs adds its own per-frame work through onFrame)
  // onFrame hooks run before the picture is drawn (World has just posed its own camera: do not project through the
  // room camera there); onAfter hooks run after it, when the room camera is aimed (labels, bubbles).
  const hooks = [], after = [];
  const renderer = world.renderer, render = renderer.render.bind(renderer);
  // three.js resets its counters after the shadow pass, so renderer.info shows the main pass only. measureCalls() asks
  // the next frames to count both passes and returns the last count ({calls, triangles}); a performance probe calls it twice.
  let measure = 0, measured = null;
  world.measureCalls = () => { measure = 3; return measured; };
  renderer.render = (scene, camera) => {
    const main = scene === world.scene && renderer.getRenderTarget() === null, counting = main && measure > 0;
    if (counting) { renderer.info.autoReset = false; renderer.info.reset(); }
    if (main) for (const f of hooks) f();
    if (main && world.location === 'interior') {
      swapIn(); aim(); camera = persp;
      if ((scan -= 1 / 60) <= 0) { scan = .05; hover(pick()); }
      if (ring.visible) { const k = 1 + Math.sin(performance.now() / 200) * .08, base = ring.userData.base ?? [1, 1]; ring.scale.set(base[0] * k, 1, base[1] * k); glow.material.opacity = .24 + Math.sin(performance.now() / 160) * .07; }
    } else if (main && world.camera === persp) { swapOut(); camera = world.camera; }
    render(scene, camera);
    if (counting) { measured = { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles }; renderer.info.autoReset = true; measure--; }
    if (main) { if (world.location === 'interior') moveLabels(); else hideLabels(); for (const f of after) f(); }
  };
  const exit = world.exit.bind(world);
  world.exit = (...args) => { swapOut(); return exit(...args); };
  return world.__roomCamera = { camera: persp, swapIn, swapOut, frame: () => framing, room: () => rooms ? { id: room?.id, x: smooth.x, y: smooth.y, z: smooth.z, d: distance } : null, layer, onFrame: f => hooks.push(f), onAfter: f => after.push(f) };
}
