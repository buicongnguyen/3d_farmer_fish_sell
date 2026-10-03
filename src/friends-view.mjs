// Cages, prisoners, followers and friends at their posts, drawn (round 8; owner: builder E; the rules are friends.mjs).
// installFriends(world, pandora) is called once from main.mjs boot(), after installPandora, installLands and installTitans.
//
// What it will use, all in place from step 0 and none of it an edit in another builder's file:
//   world.addTreeBlock({x, z, r: CAGE_RADIUS, perch: false}) / world.removeTreeBlock(block)   the cage's collider
//   world.target('cage', id, label, x, z, RESCUE_REACH) / world.removeTarget(spot)            the cage's tap and prompt
//       The 48 m rule: a target outside the ward is registered only while the player is within 48 m of it and removed
//       beyond 56 m (tests/doors-browser.mjs wants every listed target inside the ward from the ring road).
//   world.followers.push({moveTo(x, z)})        Home and a knock-out bring the follower along
//   friends.mjs cageSpot, cageState, friendsAct ('rescue', 'friendHome' through game.mjs act)
//
// STUB (step 0): installs nothing.
export function installFriends(world, pandora) {
  return world.__friends ??= {};
}
