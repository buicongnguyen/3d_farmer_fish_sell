// What round 7 adds round the world, installed once by main.mjs after the world and the Pandora box: the pen animals
// (pen-view.mjs), the HUD keeping up with a vehicle (the minimap and the way-home guide), and the read-only render
// diagnostics (render-probe.mjs). Driving itself lives in World (world.drive, drive-view.mjs).
//
//   installOutdoors(world, {state, pandora, minimap, toast})
//     state()      the current game state        pandora      what installPandora returned (creatures, for the probe)
//     minimap()    main.mjs's Minimap (made after this runs): redrawn as fast as you drive
import { installRoomView } from './room-view.mjs';
import { PenView } from './pen-view.mjs';

/** The map is redrawn 8 times a second on foot; in a vehicle also whenever it has moved this far (metres). */
const MAP_STEP = 1.5;

export function installOutdoors(world, deps) {
  if (world.__outdoors) return world.__outdoors;
  import('./render-probe.mjs').then(m => m.installRenderProbe(world, deps.pandora)); // read-only diagnostics: fetched after boot, off the first-frame budget
  const pen = world.pen = new PenView(world, deps.state);
  const guide = { box: document.getElementById('home-guide'), arrow: document.getElementById('home-arrow'), distance: document.getElementById('home-metres'), angle: NaN, text: '' };
  let mapX = 0, mapZ = 0, last = world.t;
  installRoomView(world).onFrame(() => {
    if (!world.ready || !world.player) return;
    const dt = Math.min(.05, Math.max(0, world.t - last)); last = world.t;
    pen.update(dt, world.t);
    if (!world.riding) return;
    // At 38 m/s the HUD's own pace (the map 8 times a second, the guide every 0.3 s) lags by metres: follow the vehicle.
    const p = world.player.position, map = deps.minimap?.();
    if (map && Math.abs(p.x - mapX) + Math.abs(p.z - mapZ) > MAP_STEP) { mapX = p.x; mapZ = p.z; map.invalidate(); }
    if (guide.box && guide.arrow && guide.distance) {
      const g = world.homeGuide, angle = Math.round(g.angle), text = `${Math.round(g.distance)} m`; // the same words as main.mjs hud(), which writes #home-metres (" · tap to go home" is a span of its own after it)
      if (guide.box.hidden !== !g.visible) guide.box.hidden = !g.visible;
      if (angle !== guide.angle) { guide.angle = angle; guide.arrow.style.transform = `rotate(${angle}deg)`; }
      if (text !== guide.text) { guide.text = text; guide.distance.textContent = text; }
    }
  });
  return world.__outdoors = { pen };
}
