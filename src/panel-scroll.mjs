// A panel that is drawn again stays where you scrolled it. Buying, selling, wearing or switching a setting redraws the
// whole panel (main.mjs shell() replaces its markup), which used to send every list back to the top and the tab strip
// back to its first tab. drawKeeping() remembers every scrolled element of the panel before the redraw and puts each one
// back after it, unless you opened another panel or another tab (then the lists start at the top, as a fresh page should;
// the tab strip itself keeps its place and only moves as far as it must to show the tab you chose).
//
//   drawKeeping(root, {panel, view}, draw)   root: the panel element; panel: which panel ("shop|market"); view: its tab
//   forget()                                 the panel closed: the next one opens fresh
//
// Works for any element that scrolls, on either axis, however deep (the list, the tab strip, a row of chips); elements
// are found again by their place in the markup, so the markup may be rebuilt from scratch.
let last = null;

/** An element's place under root: "DIV:1>NAV:0" (tag and index among the siblings with that tag). */
function placeOf(el, root) {
  const parts = [];
  for (let n = el; n && n !== root; n = n.parentElement) { const kin = n.parentElement?.children ?? []; let i = 0; for (const k of kin) { if (k === n) break; if (k.tagName === n.tagName) i++; } parts.unshift(`${n.tagName}:${i}`); }
  return parts.join('>');
}
function find(root, place) {
  let n = root; if (!place) return n;
  for (const part of place.split('>')) { const [tag, index] = part.split(':'); let i = Number(index), hit = null; for (const k of n.children) if (k.tagName === tag && i-- === 0) { hit = k; break; } if (!hit) return null; n = hit; }
  return n;
}
const isStrip = el => !!el.querySelector?.(':scope > [data-action="tab"]');
/** Every element of the panel that is scrolled: [{place, top, left, strip}]. */
export function capture(root) {
  const kept = [];
  for (const el of [root, ...root.querySelectorAll('*')]) if (el.scrollTop > 0 || el.scrollLeft > 0) kept.push({ place: placeOf(el, root), top: el.scrollTop, left: el.scrollLeft, strip: isStrip(el) });
  return kept;
}
/** Puts the kept offsets back (only the tab strips when `stripsOnly`). Returns how many elements were restored. */
export function restore(root, kept, stripsOnly = false) {
  let n = 0;
  for (const k of kept) {
    if (stripsOnly && !k.strip) continue;
    const el = find(root, k.place); if (!el) continue;
    if (el.scrollTop !== k.top) el.scrollTop = k.top; if (el.scrollLeft !== k.left) el.scrollLeft = k.left; n++;
  }
  return n;
}
/** A tab strip shows its chosen tab: scrolled just far enough, never back to the start for nothing. */
function showActiveTab(root) {
  for (const tab of root.querySelectorAll('[data-action="tab"].active')) {
    const strip = tab.parentElement; if (!strip || strip.scrollWidth <= strip.clientWidth + 1) continue;
    const a = tab.getBoundingClientRect(), b = strip.getBoundingClientRect(), pad = 28; // the strip fades out at its right edge
    if (a.left < b.left + 4) strip.scrollLeft -= b.left + 4 - a.left; else if (a.right > b.right - pad) strip.scrollLeft += a.right - (b.right - pad);
  }
}
/**
 * Draws a panel and keeps its scrolling: the same panel and view: everything stays put; another view of the same panel:
 * the tab strips stay put; another panel: fresh. The offsets are put back at once (no flash of the top of the list) and
 * once more after the page's own observers have added to the panel (a strip put in above the list moves it otherwise).
 */
export function drawKeeping(root, { panel, view = '' }, draw) {
  const samePanel = !!last && last.panel === panel, sameView = samePanel && last.view === view, kept = samePanel ? capture(root) : [];
  last = { panel, view };
  draw();
  if (kept.length) { restore(root, kept, !sameView); if (typeof queueMicrotask === 'function') queueMicrotask(() => { if (last?.panel === panel && last.view === view) restore(root, kept, !sameView); }); }
  showActiveTab(root);
  return kept.length;
}
export function forget() { last = null; }
