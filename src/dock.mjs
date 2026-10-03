// Desktop panel docking, after Zoo Garden's (cute_game src/dialog-dock.ts + dialog-dock.css): on a wide screen with a
// mouse every menu docks to the right without dimming or blurring the world, so the character stays in view and a
// change of clothes shows as it happens. Only dialogs that ask for a decision stay centred over a dimmed world. Phones
// keep their sheets; the CSS applies under (pointer: fine) and (min-width: 1000px).
//
// The mirror and the wardrobe ("look panels") go further on every screen: no dimming at all, a short sheet on phones
// (a side sheet on landscape phones), and the indoor camera moves in on the character and slides the picture into the
// free part of the screen (room-view.mjs reads world.__lookFocus = {dx, dy, span}).
//
//   const dock = installDock(world)     once (main.mjs)
//   dock.open(type)                     after a panel is rendered;  dock.close() when it closes
export const CENTRED = new Set(['sleep', 'chop', 'memory', 'knockout']);
export const LOOK_PANELS = new Set(['mirror', 'wardrobe']);
export const DOCK_QUERY = '(pointer: fine) and (min-width: 1000px)';
export const dockable = type => !!type && !CENTRED.has(type);

export function installDock(world) {
  if (world.__dock) return world.__dock;
  const backdrop = document.getElementById('modal-backdrop'), modal = document.getElementById('modal'), wide = matchMedia(DOCK_QUERY);
  const ortho = world.camera; // the village camera (room-view.mjs swaps in its own indoors)
  let type = null, shift = 0, left = 0, tick = 0;
  /** Where the panel is, and so where the free part of the screen is. */
  function measure() {
    if (!type) { world.__lookFocus = null; return; }
    const r = modal.getBoundingClientRect(), W = innerWidth, H = innerHeight; left = r.left;
    if (!LOOK_PANELS.has(type)) { world.__lookFocus = null; return; }
    const side = r.left > W * .28 && r.height > H * .6; // a panel at the right; otherwise a sheet at the bottom
    // Under the player card (the rest of the HUD steps aside for a look panel on small screens: looks.css).
    const top = side ? 0 : Math.min(r.top * .5, document.querySelector('.player-card')?.getBoundingClientRect().bottom ?? 0);
    const focus = world.__lookFocus ??= { dx: 0, dy: 0, span: 6.2 }, free = side ? H : Math.max(120, r.top - top);
    focus.dx = side ? W / 2 - r.left / 2 : 0; focus.dy = side ? -H * .03 : H / 2 - (top + r.top) / 2 - free * .06;
    // Metres of height the screen shows: the character (about 2.6 m with a hat) takes four fifths of the free height at most.
    focus.span = Math.max(6.2, 3.25 * H / free);
  }
  function open(next) {
    type = next ?? null;
    backdrop.classList.toggle('docked', dockable(type)); backdrop.classList.toggle('look-panel', LOOK_PANELS.has(type));
    if (LOOK_PANELS.has(type) && world.player && world.location === 'interior') world.player.rotation.y = 0; // face the room's camera
    measure(); tick = 0;
  }
  function close() { type = null; backdrop.classList.remove('docked', 'look-panel'); world.__lookFocus = null; }
  addEventListener('resize', () => { if (type) measure(); });
  /** Per frame: outdoors the picture slides left when a docked panel would reach the character at screen centre. */
  function frame() {
    if (type && ++tick % 20 === 0) measure(); // a panel's height changes as it re-renders
    let want = 0;
    if (type && world.location !== 'interior' && !world.previewColor && !world.tryOn && backdrop.classList.contains('docked') && wide.matches) want = Math.max(0, (innerWidth / 2 + 96 - (left - 24)) / innerWidth);
    if (Math.abs(want - shift) < 1e-4) { if (shift === want) return; shift = want; } else shift += (want - shift) * .18;
    if (shift < 1e-4 && want === 0) { shift = 0; ortho.clearViewOffset(); } else ortho.setViewOffset(1, 1, shift, 0, 1, 1);
  }
  return world.__dock = { open, close, measure, frame, get type() { return type; } };
}
