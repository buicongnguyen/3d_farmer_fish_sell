// The original Blender workshop from cute_game, fetched after the village is playable.
import { WORKSHOP } from './content.mjs';

export async function buildWorkshop(world) {
  if (!await world.loadKit('workshop')) return;
  const source = world.kits.get('workshop/workshop'); if (!source) return;
  const b = WORKSHOP.building, mesh = source.clone(); mesh.name = 'vale-workshop';
  mesh.position.set(b.x, 0, b.z); mesh.scale.setScalar(b.scale); mesh.castShadow = true; mesh.receiveShadow = true;
  world.outside.add(mesh); world.sign(world.outside, 'VALE WORKSHOP', b.x, b.z, 4.05);
  world.workshop = mesh;
}
