// Cages, prisoners, followers and friends at their posts, drawn (round 8; owner: builder E; the rules are friends.mjs).
// installFriends(world, pandora, deps) is called once from main.mjs boot(), after installPandora, installLands and installTitans.
//
// What it will use, all in place from step 0 and none of it an edit in another builder's file:
//   world.addTreeBlock({x, z, r: CAGE_RADIUS, perch: false}) / world.removeTreeBlock(block)   the cage's collider
//   world.target('cage', id, label, x, z, RESCUE_REACH) / world.removeTarget(spot)            the cage's tap and prompt
//       then spot.use = spot => { ... }: a tap or E on a target main.mjs does not know by type calls its `use` (the prompt shows the
//       label). For an open cage: deps.act('rescue', {id}) (runAction: it toasts the answer, saves and refreshes the HUD and the panel);
//       for a locked one: deps.toast('Defeat the … nearby to open this cage.').
//   deps = {state(), act(type, arg), toast(message), persist(), hud()}, the third argument, from main.mjs boot()
//       'friendHome' is sent the same way, deps.act('friendHome'), when the player stands inside the ward.
//       The 48 m rule: a target outside the ward is registered only while the player is within 48 m of it and removed
//       beyond 56 m (tests/doors-browser.mjs wants every listed target inside the ward from the ring road).
//   world.followers.push({moveTo(x, z)})        Home and a knock-out bring the follower along
//   friends.mjs cageSpot, cageState, friendsAct ('rescue', 'friendHome' through game.mjs act)
//
// STUB (step 0): installs nothing.
export function installFriends(world, pandora, deps = {}) {
  return world.__friends ??= {};
}
