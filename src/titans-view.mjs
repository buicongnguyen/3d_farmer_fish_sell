// The titans, drawn (round 8; owner: builder D2). installTitans(world, pandora) is called once from main.mjs boot(),
// straight after installPandora and installLands. deps = {state(), act(type, arg), toast(message), persist(), hud()}.
// It draws its own three meshes (spec 4.3), and its telegraph marks through world.pandora.mark(x, z, r, progress, hex): call it every
// frame a mark should show (from a room-view onFrame hook or from the simulation's events); the marks are kept and drawn inside Pandora's
// own frame, between its fx.begin() and fx.end(). A direct world.pandora.fx.decal call from another hook is wiped by that begin().
// The other fx members (burst, ring, text, play) are retained and safe to call at any time.
//
// STUB (step 0): installs nothing.
export function installTitans(world, pandora, deps = {}) {
  return world.__titans ??= {};
}
