// How the inside of a house is seen, after the Zoo Garden cottage (cute_game house-session.ts houseFocus, camera-rig.ts,
// house-hotspots.ts, house.css): a 40° perspective lens looking straight into the dollhouse at a 52° pitch, framed so the
// cottage fills the screen (on phones it follows you along the house), small label chips pinned low on the things you can
// use, and on desktop a warm glow and a floor ring around the thing under the mouse, so you see what a click will use.
//
//   installRoomView(world)   once (interior.mjs calls it when a house is first built)
//
// World stays untouched: while world.location is 'interior', world.camera is swapped for a PerspectiveCamera (World's
// project(), click() and resize() keep working with it), and a wrapper around world.renderer.render aims it, then moves
// the label chips. world.exit is wrapped so the outdoor camera is back before World resizes. Labels and hover come from
// world.__roomHotspots ({target, icon, text, box}), which interior.mjs fills on every rebuild.
import * as T from 'three';

const PITCH = 52 * Math.PI / 180, FOV = 40;
/** The house box framed by the camera (floor, wall tops at the back, low walls at the front). */
const FRAME = [[-7.15, 0, -6.15], [7.15, 0, -6.15], [-7.15, 0, 6.2], [7.15, 0, 6.2], [-7.15, 3.1, -6.1], [7.15, 3.1, -6.1], [-7.15, .7, 6.15], [7.15, .7, 6.15]];
const v = new T.Vector3(), fitCam = new T.PerspectiveCamera();

/**
 * Camera framing for a screen aspect: the smallest distance that fits the house in an NDC box, centred between the HUD
 * bands. Wide screens fit the whole width (the back wall's top may tuck under the top HUD, as in the reference); tall
 * phone screens fit the depth of the house between the top HUD and the thumb controls and follow you along its width.
 */
function fit(aspect) {
  const portrait = aspect < .8, fov = portrait ? 50 : FOV, pitch = portrait ? 56 * Math.PI / 180 : PITCH;
  const box = portrait ? { x: Infinity, y0: -.36, y1: .66 } : { x: .99, y0: -.5, y1: 1.12 };
  Object.assign(fitCam, { fov, aspect, near: .5, far: 200 }); fitCam.updateProjectionMatrix();
  const place = (d, tz) => { fitCam.position.set(0, Math.sin(pitch) * d, tz + Math.cos(pitch) * d); fitCam.lookAt(0, 0, tz); fitCam.updateMatrixWorld(true); };
  const points = portrait ? FRAME.map(p => [0, p[1], p[2]]) : FRAME;
  let best = null;
  for (let d = 8; d < 90 && !best; d += .2) {
    for (let tz = -3; tz <= 3; tz += .1) {
      place(d, tz); let ok = true, top = -9, bottom = 9;
      for (const p of points) { v.set(p[0], p[1], p[2]).project(fitCam); if (Math.abs(v.x) > box.x) ok = false; top = Math.max(top, v.y); bottom = Math.min(bottom, v.y); }
      if (ok && top <= box.y1 && bottom >= box.y0) { best = { d, tz, fov, pitch, portrait }; break; }
    }
  }
  best ??= { d: 30, tz: 0, fov, pitch, portrait };
  // How far the view may slide sideways before it runs past the walls (phones see part of the width).
  place(best.d, best.tz); const left = new T.Vector3(-1, 0, .5).unproject(fitCam).sub(fitCam.position).normalize(), t = -fitCam.position.y / left.y;
  best.reachX = Math.max(0, 7.4 + (fitCam.position.x + left.x * t));
  return best;
}

export function installRoomView(world) {
  if (world.__roomView) return world.__roomView;
  const persp = new T.PerspectiveCamera(FOV, innerWidth / innerHeight, .5, 220);
  let outdoor = null, framing = null, framedAspect = 0;
  const target = new T.Vector3(), smooth = new T.Vector3();
  const swapIn = () => { if (world.camera === persp) return; outdoor = world.camera; world.camera = persp; framedAspect = 0; smooth.set(0, 0, 0); };
  const swapOut = () => { if (world.camera !== persp) return; world.camera = outdoor; outdoor = null; hideLabels(); hover(null); world.resize?.(); };

  // ---- framing
  function aim() {
    const aspect = innerWidth / Math.max(1, innerHeight);
    if (Math.abs(aspect - framedAspect) > 1e-3) { framing = fit(aspect); framedAspect = aspect; persp.fov = framing.fov; persp.aspect = aspect; persp.updateProjectionMatrix(); smooth.set(0, 0, framing.tz); }
    // Phones see part of the house: the view follows you along it, never running far past its walls (houseFocus).
    if (framing.portrait) {
      const p = world.player?.position ?? v.set(0, 0, 0), reach = framing.reachX;
      target.set(Math.max(-reach, Math.min(reach, p.x)), 0, framing.tz);
      smooth.lerp(target, .12);
    } else smooth.set(0, 0, framing.tz);
    const d = framing.d;
    persp.position.set(smooth.x, Math.sin(framing.pitch) * d, smooth.z + Math.cos(framing.pitch) * d);
    persp.lookAt(smooth.x, 0, smooth.z);
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
      el.innerHTML = `<i>${h.icon}</i>${h.text.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))}`;
      layer.append(el); chips.push({ h, el });
    }
  }
  function hideLabels() { layer.hidden = true; }
  function moveLabels() {
    const list = world.__roomHotspots; syncChips(list); layer.hidden = !!world.__decorPlacing || !list?.length;
    if (layer.hidden) return;
    const near = world.paused ? null : world.nearest?.(), w = innerWidth, h = innerHeight;
    for (const { h: spot, el } of chips) {
      const b = spot.box; if (!b) { el.style.display = 'none'; continue; }
      // Low on the middle of the thing (house-hotspots.ts labelSpot); above the head for people.
      const mid = b.y0 + (b.y1 - b.y0) * .45, y = spot.person ? b.y1 + .32 : spot.lift ? b.y1 + .3 : b.y0 > .5 ? mid : Math.max(.3, Math.min(1.0, mid));
      v.set((b.x0 + b.x1) / 2, y, (b.z0 + b.z1) / 2).project(persp);
      if (v.z > 1 || v.z < -1) { el.style.display = 'none'; continue; }
      el.style.display = ''; el.style.transform = `translate(${(v.x + 1) * w / 2}px, ${(1 - v.y) * h / 2}px) translate(-50%, -50%)`;
      el.classList.toggle('near', near === spot.target); el.classList.toggle('hover', hovered === spot.target);
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
  const hooks = [];
  const renderer = world.renderer, render = renderer.render.bind(renderer);
  renderer.render = (scene, camera) => {
    const main = scene === world.scene && renderer.getRenderTarget() === null;
    if (main) for (const f of hooks) f();
    if (main && world.location === 'interior') {
      swapIn(); aim(); camera = persp;
      if ((scan -= 1 / 60) <= 0) { scan = .05; hover(pick()); }
      if (ring.visible) { const k = 1 + Math.sin(performance.now() / 200) * .08, base = ring.userData.base ?? [1, 1]; ring.scale.set(base[0] * k, 1, base[1] * k); glow.material.opacity = .24 + Math.sin(performance.now() / 160) * .07; }
    } else if (main && world.camera === persp) { swapOut(); camera = world.camera; }
    render(scene, camera);
    if (main) { if (world.location === 'interior') moveLabels(); else hideLabels(); }
  };
  const exit = world.exit.bind(world);
  world.exit = (...args) => { swapOut(); return exit(...args); };
  return world.__roomView = { camera: persp, swapIn, swapOut, frame: () => framing, layer, onFrame: f => hooks.push(f) };
}
