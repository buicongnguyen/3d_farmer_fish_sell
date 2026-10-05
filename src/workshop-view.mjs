// The original Blender workshop from cute_game, fetched after the village is playable.
import * as T from 'three';
import { WORKSHOP } from './content.mjs';

/** Visible workbench/awning taps use the same clear counter destination as E and ACT. */
export function linkWorkshopTarget(target, mesh) {
  mesh.traverse(part => { if (part.isMesh) part.userData.target = target; });
  const cast = target.hit.raycast;
  target.hit.raycast = function (raycaster, hits) {
    cast.call(this, raycaster, hits); // Keep the counter's existing protection for empty lane taps.
    if (mesh.visible) raycaster.intersectObject(mesh, true, hits);
  };
}

export async function buildWorkshop(world) {
  const target = world.targets.find(t => t.type === 'shop' && t.id === 'upgrades');
  if (!target) return;
  const marker = new T.Mesh(new T.RingGeometry(1.08, 1.23, 40), new T.MeshBasicMaterial({ color: '#ffd95c', transparent: true, opacity: .85, depthWrite: false, side: T.DoubleSide, forceSinglePass: true }));
  marker.name = 'workshop-interaction'; marker.rotation.x = -Math.PI / 2; marker.position.set(target.x, .045, target.z);
  world.outside.add(marker); linkWorkshopTarget(target, marker);
  world.__roomView.onFrame(() => { marker.visible = world.location === 'village' && !world.paused && Math.hypot(world.player.position.x - target.x, world.player.position.z - target.z) < 30; });
  if (!await world.loadKit('workshop')) return;
  const source = world.kits.get('workshop/workshop'); if (!source) return;
  const b = WORKSHOP.building, mesh = source.clone(); mesh.name = 'vale-workshop';
  mesh.position.set(b.x, 0, b.z); mesh.scale.setScalar(b.scale); mesh.castShadow = true; mesh.receiveShadow = true;
  linkWorkshopTarget(target, mesh);
  world.outside.add(mesh); world.sign(world.outside, 'VALE WORKSHOP', b.x, b.z, 4.05);
  world.workshop = mesh;
}
