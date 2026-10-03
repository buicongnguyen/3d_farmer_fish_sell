// The banner on crossing a border (round 8; owner: builder A; spec section 5). installBanner(world, deps) is called once from
// main.mjs boot(), after installPandora, installLands, installTitans and installFriends, so world.pandora and world.lands exist.
// deps = {state(), act(type, arg), toast(message), persist(), hud()}.
//
// What it will do: append #region-banner to the game root (styled in regions.css), and fire it for 2.8 s on a change of
// regions.mjs regionAt(player), outdoors only, box open or shut (world.pandora.active tells which chip to write). A per-frame
// check hangs on room-view.mjs: installRoomView(world).onFrame(fn), as dock.mjs and pandora-view.mjs do; nothing in
// World.update or boot() needs an edit. The names it prints are data: REGION (regions.mjs), MIX (region-mix.mjs),
// CREATURES (wilds.mjs), DENS (regions.mjs).
//
// STUB (step 0): installs nothing.
export function installBanner(world, deps = {}) {
  return world.__banner ??= {};
}
