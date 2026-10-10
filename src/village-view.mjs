// What the compact village (round 7) adds to World.buildVillage: market row with the Finch atelier's stall beside the
// village market, the Hearth bakery in the barn by the village green, and the signs of the families who lodge in a
// village building. Called from world.mjs while the village is built, so everything here is baked with the rest.
//
//   buildMarketRow(world, {bakeTinted})
import { HOUSES, MARKET, ATELIER } from './content.mjs';
import { STALL, OVEN, BLOCKS, COUNTER_REACH } from './village-plan.mjs';

const block = name => BLOCKS.find(b => b.name === name);
export function buildMarketRow(world, { bakeTinted } = {}) {
  const out = world.outside;
  // The market stall is drawn by world.mjs; like the atelier's it now blocks the way, so nobody walks through the counter.
  world.collider(block('market').x, block('market').z, STALL.market.w, STALL.market.d);
  // The Finch atelier's stall: hats, clothes and gear, in plain sight beside the market (it stood out by the Finch house).
  world.sized('equipment-stall', out, ATELIER.x, ATELIER.z, STALL.atelier.size);
  world.collider(block('atelier').x, block('atelier').z, STALL.atelier.w, STALL.atelier.d);
  world.target('shop', 'clothes', 'Visit the Finch atelier', ATELIER.x, ATELIER.z + 2.3, COUNTER_REACH);
  world.sign(out, 'FINCH ATELIER', ATELIER.x, ATELIER.z - .5);
  // The Hearth bakery: the barn by the village green, its doors to the green, in the family's warm colours, with its oven outside.
  const bakery = HOUSES[6], barn = world.raw.get('rural')?.getObjectByName('barn');
  if (barn && bakeTinted) {
    const b = bakeTinted(barn, { 'Barn red': '#F6C886', 'Barn roof': '#D9631A', 'Barn roof trim': '#B4491A' }); b.position.set(bakery.x, 0, bakery.z); out.add(b);
    world.collider(block('bakery').x, block('bakery').z, block('bakery').w, block('bakery').d); // the barn's own walls (its lean-to is on the east side)
    if (world.assets.has('kitchen')) { world.sized('kitchen', out, OVEN.x, OVEN.z, 2.2); world.collider(OVEN.x, OVEN.z, 2, 2); }
  }
  world.sign(out, 'HEARTH BAKERY', bakery.x, bakery.z, 8.2);
  world.sign(out, 'MOSS BARN', HOUSES[3].x, HOUSES[3].z, 8.2);
}
