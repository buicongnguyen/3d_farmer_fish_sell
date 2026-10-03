// STUB (wm-pandora): a stand-in for wm-house's avatar module with exactly the contract's signature
// (cute_game-notes/willowmere/CONTRACT.md). Replace this whole file with wm-house's src/avatar.mjs at the merge.
//
//   buildAvatar(world, {look, outfitColor, gear}) -> THREE.Group with userData.parts {head, body, arm_l, arm_r, leg_l, leg_r}
//
// world.player is such a group; the Pandora view swings the parts for attacks (pandora-view.mjs partsOf(), which also
// accepts today's World.character() group, so nothing here is needed until wm-house lands). Gear is not drawn by the stub.
export function buildAvatar(world, { look = 'girl-tall-none-none', outfitColor = '#849978' } = {}) {
  const group = world.character(/^boy/.test(look) ? 'hero-tall' : 'hero-girl-tall', outfitColor);
  const part = name => group.getObjectByName(name) ?? null;
  group.userData.parts = { head: part('head'), body: part('body'), arm_l: part('arm-left'), arm_r: part('arm-right'), leg_l: part('leg-left'), leg_r: part('leg-right') };
  return group;
}
