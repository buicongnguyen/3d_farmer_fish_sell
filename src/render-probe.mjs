// Read-only numbers about what is drawn (not what is simulated), for the render checks: tests/render-browser.mjs and
// the probes behind docs/VERIFICATION.md. Nothing here changes the game.
//
//   willowmere.project(x, z, y)   a world point on the screen, in CSS pixels
//   willowmere.render()           {sun, camera, creatures, vehicles, riding, pen, pet}
//     sun        where the light stands, its shadow box and texel size, the shadow filter
//     camera     where the view looks, the zoom
//     creatures  every wild creature with the pose it is drawn in this frame (`draw`), beside where the simulation has it
//     vehicles   where each stands and which way its nose points; `riding` is the one being driven, with its speed
//     pen        the pen animals as drawn
//
// It reads through duck typing, so the same file measures a build from before a change and one from after it.
import * as T from 'three';

const v = new T.Vector3(), q = new T.Quaternion();
const r4 = n => Math.round(n * 1e4) / 1e4;
/** The compass angle (atan2(x, z), the game's facing convention) of an object's local +z axis. */
function noseOf(object) { object.getWorldQuaternion(q); v.set(0, 0, 1).applyQuaternion(q); return Math.atan2(v.x, v.z); }

export function installRenderProbe(world, pandora) {
  const sun = () => {
    const s = world.sun, c = s.shadow.camera, m = s.shadow.mapSize;
    return { position: s.position.toArray().map(r4), target: s.target.position.toArray().map(r4), box: { left: c.left, right: c.right, top: c.top, bottom: c.bottom, near: c.near, far: c.far },
      map: [m.x, m.y], texel: [(c.right - c.left) / m.x, (c.top - c.bottom) / m.y], type: world.renderer.shadowMap.type, enabled: world.renderer.shadowMap.enabled, bias: s.shadow.bias, normalBias: s.shadow.normalBias };
  };
  const creatures = () => (pandora?.wilds?.list ?? []).map(e => {
    const g = e.view, u = g?.userData;
    return { id: e.id, type: e.type, x: e.x, z: e.z, hp: e.hp, phase: e.phase, resting: !!e.resting,
      draw: g ? { visible: g.visible, x: g.position.x, y: g.position.y, z: g.position.z, sy: g.scale.y, yaw: g.rotation.y, roll: g.rotation.z, leg: u.legs?.[0]?.rotation.x ?? 0, close: u.close, shadow: !!u.body?.castShadow, moving: u.moving ?? null } : null };
  });
  const vehicles = () => world.vehicles.map(c => ({ id: c.id, x: c.mesh.position.x, y: c.mesh.position.y, z: c.mesh.position.z, yaw: c.mesh.rotation.y, nose: noseOf(c.mesh), speed: c.driveSpeed ?? 0, top: c.speed ?? null }));
  const pen = () => {
    if (world.pen?.diagnostics) return world.pen.diagnostics();
    return { instanced: false, animals: world.animals.map(a => ({ kind: a.id, x: a.mesh.position.x, y: a.mesh.position.y, z: a.mesh.position.z, heading: a.mesh.rotation.y, shown: a.mesh.visible })) };
  };
  const person = () => {
    const p = world.player, parts = p.userData.parts;
    return { x: p.position.x, y: p.position.y, z: p.position.z, yaw: p.rotation.y, visible: p.visible, legs: parts ? [parts.leg_l.rotation.x, parts.leg_r.rotation.x] : null, legsZ: parts ? [parts.leg_l.rotation.z, parts.leg_r.rotation.z] : null, arms: parts ? [parts.arm_l.rotation.x, parts.arm_r.rotation.x] : null,
      pet: world.companion ? { shown: world.companion.visible, id: world.companion.userData.pet ?? '', x: world.companion.position.x, y: world.companion.position.y, z: world.companion.position.z } : null };
  };
  const render = () => ({ t: world.t, sun: sun(), camera: { x: world.follow.x, z: world.follow.z, zoom: world.zoom, yaw: world.yaw, left: world.camera.left, right: world.camera.right, top: world.camera.top, bottom: world.camera.bottom },
    creatures: creatures(), vehicles: vehicles(), riding: world.riding ? world.riding.id : null, drive: world.drive?.diagnostics?.() ?? null, pen: pen(), player: person(),
    fields: world.fields?.metrics ?? null, calls: world.renderer.info.render.calls, triangles: world.renderer.info.render.triangles });
  const attach = () => { const w = window.willowmere; if (w && !w.render) { w.render = render; w.project = (x, z, y = 0) => world.project(x, z, y); } return !!w; };
  // main.mjs makes window.willowmere at the end of its boot, after the views are installed: wait for it.
  if (!attach()) { const timer = setInterval(() => { if (attach()) clearInterval(timer); }, 50); }
  return render;
}
