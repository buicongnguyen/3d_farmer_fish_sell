// The outdoor counters and public doors, easy to tap (fetched after the village is playable, like the workshop):
// the whole market stall, the whole Finch atelier stall, each Town Square building and each barn with a way in answer a tap, not only
// the small unseen box at the standing spot, and the two stalls get a wide gold ring on the ground in front of the counter.
//
//   buildCounterTaps(world)        once, after World.buildVillage
//   wholeBody(world, spot, box)    box {x0, x1, z0, z1, h}: a tap anywhere on that volume is a tap on `spot`
//
// A tap on the body is never a "walk here" tap (lots-view.mjs wayGuard): the ray went through the thing itself, whatever
// ground lies behind it. The standing spot's own box keeps the guard, so the lane beyond the spot's reach still walks.
import * as T from 'three';
import { MARKET, ATELIER, CIVIC } from './content.mjs';
import { STALL, BLOCKS } from './village-plan.mjs';

/** The ring in front of a stall: metres across the outside (60 px on a phone at the default zoom, 86 px on a desktop). */
export const RING = 1.5;
const size = new T.Vector3(), bounds = new T.Box3(), unseen = new T.MeshBasicMaterial();

export function wholeBody(world, spot, box) {
  const body = new T.Mesh(new T.BoxGeometry(box.x1 - box.x0, box.h, box.z1 - box.z0), unseen);
  body.position.set((box.x0 + box.x1) / 2, box.h / 2, (box.z0 + box.z1) / 2); body.visible = false; body.userData.target = spot;
  world.outside.add(body); body.updateMatrixWorld(true);
  const cast = spot.hit.raycast;
  spot.hit.raycast = function (raycaster, hits) { cast.call(this, raycaster, hits); body.raycast(raycaster, hits); };
  return spot.body = body;
}
/** The box a model takes up where world.sized(name, …, x, z, size) put it, or the plan's own box when the model is missing. */
function modelBox(world, name, at, plan) {
  const src = world.assets.get(name);
  if (!src) return { x0: at.x - plan.w / 2, x1: at.x + plan.w / 2, z0: at.z - plan.d / 2, z1: at.z + plan.d / 2, h: 3 };
  bounds.setFromObject(src).getSize(size); const k = plan.size / Math.max(size.x, size.y, size.z);
  return { x0: at.x + bounds.min.x * k, x1: at.x + bounds.max.x * k, z0: at.z + bounds.min.z * k, z1: at.z + bounds.max.z * k, h: bounds.max.y * k };
}
/** A flat gold ring with a soft glow inside it: one small mesh, shared geometry and material. */
function ringMesh(shared, spot) {
  if (!shared.geometry) {
    const g = new T.RingGeometry(0, RING, 48, 5), p = g.getAttribute('position'), rgba = new Float32Array(p.count * 4), gold = new T.Color('#ffd95c');
    for (let i = 0; i < p.count; i++) { const r = Math.hypot(p.getX(i), p.getY(i)) / RING; rgba.set([gold.r, gold.g, gold.b, r > .79 ? .95 : r > .5 ? .2 : .08], i * 4); }
    g.setAttribute('color', new T.BufferAttribute(rgba, 4)); shared.geometry = g;
    shared.material = new T.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: T.DoubleSide, forceSinglePass: true });
  }
  const ring = new T.Mesh(shared.geometry, shared.material); ring.name = 'counter-ring'; ring.rotation.x = -Math.PI / 2; ring.position.set(spot.x, .045, spot.z); ring.raycast = () => {}; ring.visible = false;
  return ring;
}
export function buildCounterTaps(world) {
  const find = (type, id) => world.targets.find(t => t.type === type && t.id === id && t.location === 'village'), shared = {}, rings = [];
  for (const [id, name, at, plan] of [['market', 'market-stall', MARKET, STALL.market], ['clothes', 'equipment-stall', ATELIER, STALL.atelier]]) {
    const spot = find('shop', id); if (!spot) continue;
    wholeBody(world, spot, modelBox(world, name, at, plan));
    const ring = ringMesh(shared, spot); world.outside.add(ring); rings.push(ring);
  }
  // Town Square: the building itself is the door's tap (its walls up to the eaves; the roof and the sign stay out of it).
  const walls = (spot, b, h) => { if (spot && b) wholeBody(world, spot, { x0: b.x - b.w / 2, x1: b.x + b.w / 2, z0: b.z - b.d / 2, z1: b.z + b.d / 2, h }); };
  for (const c of CIVIC) walls(find(c.shop ? 'shop' : 'civic', c.id), c, 4);
  // ... and the three barns with a way in (main.mjs makes their doors): the Hearth bakery, the Moss barn, the Vale workshop barn.
  for (const [id, block] of [['bakery', 'bakery'], ['moss', 'barn'], ['vale', 'vale-barn']]) walls(find('facility', id), BLOCKS.find(b => b.name === block), 4.5);
  world.__roomView.onFrame(() => {
    const on = world.location === 'village' && !world.paused, k = 1 + Math.sin(world.t * 3) * .035;
    for (const ring of rings) { ring.visible = on && Math.hypot(world.player.position.x - ring.position.x, world.player.position.z - ring.position.z) < 40; ring.scale.setScalar(k); }
  });
  world.counterRings = rings;
}
