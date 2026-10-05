// The banner on crossing a border (round 8; owner: builder A; spec section 5). installBanner(world, deps) is called once from
// main.mjs boot(), after installPandora, installLands, installTitans and installFriends, so world.pandora and world.lands exist.
// deps = {state(), act(type, arg), toast(message), persist(), hud()}.
//
// One banner, in its own node: #region-banner, appended to the game root and styled in regions.css after Zoo Garden's
// #zone-banner (style.css:475-496): outlined text and a small chip, no card; it plays for 2.8 s and never takes a tap. It is
// DOM only, never a world.target. It fires on every change of regions.mjs regionAt(player) outdoors, box open or shut, and
// the ward line is a border like any other: "Willowmere" on the way in, the home region's name on the way out. Beyond the
// map (a null region) nothing fires. Coming out of a house is not a crossing.
//
//   box shut   the name; chip "Peaceful · Lv N+ when the box is open"
//   box open   the name; "Wild creatures: first three names"; chip "★★ · Lv 4+ · 👑 Crocodile King" (a land adds "· 🔱 titan";
//              from four stars up the chip is red and starts with "Dangerous")
//
// The names it prints are data: REGION and DENS (regions.mjs), MIX (region-mix.mjs), CREATURES (wilds.mjs). A boss or titan
// whose row does not exist yet is left out of the chip, so the banner is right at every merge of the round.
//
// It also hangs a read-only probe on window.willowmere for the browser suites: willowmere.regions() (see `probe` below).
import { REGION, DENS, regionAt } from './regions.mjs';
import { MIX } from './region-mix.mjs';
import { CREATURES } from './wilds.mjs';
import { glowToon } from './toon.mjs';
import { installRoomView } from './room-view.mjs';

export const BANNER_SECONDS = 2.8;
/** What the banner says for a region: {name, detail, chip, danger}. Pure. */
export function bannerText(id, open) {
  const region = REGION[id]; if (!region) return null;
  if (region.kind === 'village') return { name: region.name, detail: 'Home, at last', chip: 'Safe', danger: false };
  if (!open) return { name: region.name, detail: '', chip: `Peaceful · Lv ${region.level}+ when the box is open`, danger: false };
  const names = (MIX[id] ?? []).map(([type]) => CREATURES[type]?.name).filter(Boolean).slice(0, 3);
  const dens = DENS.filter(d => d.region === id && !d.event), boss = CREATURES[dens.find(d => !d.titan)?.type]?.name, titan = CREATURES[dens.find(d => d.titan)?.type]?.name;
  const danger = region.stars >= 4;
  return { name: region.name, detail: names.length ? `Wild creatures: ${names.join(', ')}` : '', danger,
    chip: `${danger ? 'Dangerous · ' : ''}${'★'.repeat(region.stars)} · Lv ${region.level}+${boss ? ` · 👑 ${boss}` : ''}${titan ? ` · 🔱 ${titan}` : ''}` };
}

export function installBanner(world, deps = {}) {
  if (world.__banner) return world.__banner;
  const app = document.getElementById('app') ?? document.body, node = document.createElement('div');
  node.id = 'region-banner'; node.setAttribute('role', 'status'); node.setAttribute('aria-live', 'polite');
  node.innerHTML = '<strong></strong><small></small><span></span>';
  app.append(node);
  const [title, detail, chip] = node.children, banner = { node, count: 0, region: null, text: null, shownAt: 0 };
  let last, timer = 0, pending = null;
  // The east gate's road lies on the line between the canyon and the meadow, so a change of region fires its banner only once the player has
  // been in the new region for DWELL seconds without a change back: a flip that reverts inside it fires nothing.
  const DWELL = 500;
  banner.show = id => {
    const text = bannerText(id, !!world.pandora?.active); if (!text) return;
    title.textContent = text.name; detail.textContent = text.detail; chip.textContent = text.chip; chip.classList.toggle('danger', text.danger);
    // Restart the animation: a second crossing inside 2.8 s replaces the first banner, it does not queue behind it.
    node.classList.remove('show'); void node.offsetWidth; node.classList.add('show');
    clearTimeout(timer); timer = setTimeout(() => node.classList.remove('show'), BANNER_SECONDS * 1000);
    banner.count++; banner.region = id; banner.text = text; banner.shownAt = performance.now();
  };
  installRoomView(world).onFrame(() => {
    if (world.location !== 'village' || !world.player) return; // indoors the last outdoor region is kept: stepping out is not a crossing
    const id = regionAt(world.player.position.x, world.player.position.z);
    if (last === undefined || id === last) { last = id; pending = null; return; }
    const now = performance.now(); if (!pending || pending.id !== id) pending = { id, since: now };
    if (now - pending.since < DWELL) return;
    last = id; pending = null; if (id !== null) banner.show(id);
  });
  // Read-only numbers for tests/borders-browser.mjs (nothing here changes the game).
  //   willowmere.regions() -> {banner: {count, region, name, detail, chip, danger, showing}, border: {triangles, visible, curtain},
  //                            tiles: [{x, z, regions, land, blocking, rim, cards, kinds, standIns, waiting, draws, shadowDraws, triangles}],
  //                            kits: {key: {height, glow}}, glowPatched, birds}
  //   willowmere.perchNear(x, z, reach) -> {x, z, h} | null
  //   willowmere.cardAtlas() -> {image: a PNG data URL of the card atlas, cells: {key: index}}
  const probe = () => ({
    banner: { count: banner.count, region: banner.region, name: banner.text?.name ?? '', detail: banner.text?.detail ?? '', chip: banner.text?.chip ?? '', danger: !!banner.text?.danger, showing: node.classList.contains('show') },
    border: { triangles: world.borders ? world.borders.mesh.geometry.index.count / 3 : 0, visible: !!world.borders?.mesh.visible && world.borders.mesh.parent === world.outside, curtain: !!world.borders?.curtain.visible },
    tiles: world.fields?.describe() ?? [],
    kits: Object.fromEntries([...world.kits].map(([key, mesh]) => [key, { height: mesh.userData.height, glow: mesh.userData.glow }])),
    glowPatched: glowToon.patched,
    birds: world.birds?.metrics ?? null,
  });
  const attach = () => { const w = window.willowmere; if (w && !w.regions) { w.regions = probe; w.cardAtlas = () => ({ image: world.fields.atlas.image(), cells: Object.fromEntries([...world.fields.atlas.cells].map(([key, c]) => [key, c.index])) }); w.perchNear = (x, z, reach = 40) => { const t = world.perchNear(x, z, reach); return t ? { x: t.x, z: t.z, h: t.h } : null; }; } return !!w; };
  // main.mjs makes window.willowmere at the end of its boot, after the views are installed: wait for it (as render-probe.mjs does).
  if (!attach()) { const wait = setInterval(() => { if (attach()) clearInterval(wait); }, 50); }
  return world.__banner = banner;
}
