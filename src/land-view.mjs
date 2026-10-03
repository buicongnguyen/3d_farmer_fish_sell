// The lands' terrain features, drawn and played (round 8; owner: builder B). installLands(world) puts `world.lands` on the
// world: the one object through which every other module meets a land's features (spec 3.9). Nobody adds a member to it
// without changing that block of the spec.
//
// installLands(world, deps) is called once from main.mjs boot(), after installPandora. deps = {state(), act(type, arg), toast(message),
// persist(), hud()}: toast is for the vent and lightning warnings, the weather's event names and the gust; act is main.mjs runAction
// (it toasts the answer, saves and refreshes the HUD).
//
// What a land's code may call, all in place from step 0:
//   world.pandora.hurtFraction(share, source)       land damage (real)
//   world.pandora.mark(x, z, r, progress, hex)      a telegraph disc for THIS frame (a meteor, a bolt, a vent's ring). Call it every frame
//       the mark should show, from step(): the marks are kept and drawn inside Pandora's own frame, between its fx.begin() and fx.end().
//       Never call world.pandora.fx.decal yourself: begin() runs later in the frame and wipes it. Marks show only while the box is open.
//   world.push(dx, dz)                              a gust (a rider is left alone)
//   world.push(dx, dz, {car: true, crawl})          a toy train: on foot it walks the player aside, in a car it shoves the car
//       (crawl: true with the box open drops the car to a crawl; with the box shut pass crawl: false)
//   world.target('lamp', id, label, x, z, r) then spot.use = spot => { ... }; world.removeTarget(spot)
//       A tap or E on a target main.mjs does not know by type calls its `use`; the prompt shows the label. The 48 m rule applies
//       (register within 48 m of the player, remove beyond 56 m).
//
// STUB (step 0): exactly the interface, doing nothing. Builder B replaces every body; the names and shapes are final.
//   step(dt, {x, z, riding, box})        once a frame, from World.update (builder C adds the call): simulation and drawing
//   walk({dx, dz, speed, riding}, dt)    -> {vx, vz, limit, nodeReach}: the velocity to apply (ice eases it), a speed factor
//                                        (0.6 in the sea) and how close a tapped walk must come to a route node (1 on ice)
//   carLimit(x, z)                       -> 0.6 in the sea, else 1 (DriveView.step multiplies its limit by it)
//   status(x, z)                         -> null | {icon, label, value}: the land line of the HUD
//   mapFeatures(id)                      -> [{kind, x, z, r, …}] for the maps' terrain cache
//   lampAt(x, z)                         -> true inside a lit lamp's disc (no creature enters: wilds host.noGo)
//   holes, creatureHoles                 reused arrays [{x, z, r}]: holes in the Night Land's dark (B writes the first, D the second)
//   eclipse(seconds)                     the Shadow Lord's skill
//   setNest(stage)                       the dragon's stage changed (from 2 the nest is lava)
export function installLands(world, deps = {}) {
  if (world.lands) return world.lands;
  const walked = { vx: 0, vz: 0, limit: 1, nodeReach: .22 };
  return world.lands = {
    step(dt, at) {},
    walk({ dx, dz, speed }, dt) { walked.vx = dx * speed; walked.vz = dz * speed; walked.limit = 1; walked.nodeReach = .22; return walked; },
    carLimit(x, z) { return 1; },
    status(x, z) { return null; },
    mapFeatures(id) { return []; },
    lampAt(x, z) { return false; },
    holes: [],
    creatureHoles: [],
    eclipse(seconds) {},
    setNest(stage) {},
  };
}
