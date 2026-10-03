// A panel that is drawn again keeps its scrolling (src/panel-scroll.mjs), tested on a small stand-in for the DOM: the
// markup is rebuilt from scratch on every draw, as main.mjs shell() does.
import test from 'node:test';
import assert from 'node:assert/strict';
import { capture, restore, drawKeeping, forget } from '../src/panel-scroll.mjs';

/** A stand-in element: children, scroll offsets that clamp like a browser's, and the few queries panel-scroll makes. */
class El {
  constructor(tag, { cls = '', data = {}, maxTop = 0, maxLeft = 0, width = 100, left = 0 } = {}, children = []) {
    this.tagName = tag.toUpperCase(); this.className = cls; this.dataset = data; this.children = []; this.parentElement = null; this.maxTop = maxTop; this.maxLeft = maxLeft; this._top = 0; this._left = 0; this.width = width; this.left = left;
    for (const c of children) this.append(c);
  }
  append(c) { c.parentElement = this; this.children.push(c); return this; }
  prepend(c) { c.parentElement = this; this.children.unshift(c); return this; }
  set(children) { this.children = []; for (const c of children) this.append(c); }
  get scrollTop() { return this._top; } set scrollTop(v) { this._top = Math.max(0, Math.min(this.maxTop, v)); }
  get scrollLeft() { return this._left; } set scrollLeft(v) { this._left = Math.max(0, Math.min(this.maxLeft, v)); }
  get scrollWidth() { return this.width + this.maxLeft; } get clientWidth() { return this.width; }
  all() { const out = []; const walk = n => { for (const c of n.children) { out.push(c); walk(c); } }; walk(this); return out; }
  isTab() { return this.dataset.action === 'tab'; }
  querySelectorAll(sel) { return sel === '*' ? this.all() : this.all().filter(e => e.isTab() && e.className.split(' ').includes('active')); }
  querySelector() { return this.children.find(c => c.isTab()) ?? null; }          // ':scope > [data-action="tab"]'
  getBoundingClientRect() { const scrolled = this.parentElement?.isStrip ? this.parentElement.scrollLeft : 0; return { left: this.left - scrolled, right: this.left - scrolled + this.width }; }
}
/** A shop panel: a tab strip (5 tabs of 90 px in a 300 px strip) over a long list. */
function shop(active = 0, { rows = 30, strip = true } = {}) {
  const tabs = Array.from({ length: 5 }, (_, i) => new El('button', { cls: i === active ? 'active' : '', data: { action: 'tab' }, width: 90, left: i * 90 }));
  const bar = new El('nav', { cls: 'tabs', maxLeft: 150, width: 300 }, tabs); bar.isStrip = true;
  const list = new El('div', { cls: 'shop-list' }, Array.from({ length: rows }, () => new El('div', { cls: 'shop-item' })));
  const chips = new El('div', { cls: 'look-chips', maxLeft: 400, width: 200 }, [new El('button'), new El('button')]);
  return [new El('header', { cls: 'modal-head' }), new El('div', { cls: 'modal-content', maxTop: rows * 60 }, strip ? [bar, chips, list] : [chips, list])];
}
const content = root => root.children[1], bar = root => content(root).children[0], chips = root => content(root).children.find(c => c.className === 'look-chips');

test('the same panel drawn again keeps its list, its tab strip and its rows of tiles where they were', () => {
  forget(); const root = new El('section'); let draws = 0;
  const draw = (active = 3) => drawKeeping(root, { panel: 'shop|market', view: 'sell' }, () => { draws++; root.set(shop(active)); });
  assert.equal(draw(), 0, 'a fresh panel: nothing to keep'); assert.equal(content(root).scrollTop, 0);
  content(root).scrollTop = 640; bar(root).scrollLeft = 120; chips(root).scrollLeft = 230;
  const before = content(root); assert.equal(draw(), 3); assert.notEqual(content(root), before, 'the markup was rebuilt');
  assert.equal(content(root).scrollTop, 640); assert.equal(bar(root).scrollLeft, 120); assert.equal(chips(root).scrollLeft, 230); assert.equal(draws, 2);
  // Again and again (ten purchases): it never creeps.
  for (let i = 0; i < 10; i++) draw(); assert.equal(content(root).scrollTop, 640); assert.equal(chips(root).scrollLeft, 230);
  // The list got shorter (the last carrots were sold): as far down as it still goes.
  drawKeeping(root, { panel: 'shop|market', view: 'sell' }, () => root.set(shop(3, { rows: 8 }))); assert.equal(content(root).scrollTop, 480);
});

test('another tab starts at the top but the tab strip stays put and shows the chosen tab; another panel is fresh', () => {
  forget(); const root = new El('section'), draw = (panel, view, active) => drawKeeping(root, { panel, view }, () => root.set(shop(active)));
  draw('shop|market', 'seeds', 0); content(root).scrollTop = 500; bar(root).scrollLeft = 150; chips(root).scrollLeft = 90;
  // The last tab was tapped (the strip was scrolled to its end to reach it).
  draw('shop|market', 'furniture', 4);
  assert.equal(content(root).scrollTop, 0, 'a new tab starts at the top'); assert.equal(chips(root).scrollLeft, 0); assert.equal(bar(root).scrollLeft, 150, 'the strip did not jump back to its first tab');
  // A tab that is out of view is brought into view, and no farther: the first tab from a strip scrolled to its end.
  draw('shop|market', 'seeds', 0); assert.equal(bar(root).scrollLeft, 0);
  bar(root).scrollLeft = 0; draw('shop|market', 'upgrades', 4); assert.ok(bar(root).scrollLeft >= 150 - 1e-9, 'scrolled just far enough to show the last tab');
  // Another panel (or the same one opened again after closing): everything starts fresh.
  content(root).scrollTop = 300; draw('shop|clothes', 'upgrades', 4); assert.equal(content(root).scrollTop, 0); assert.equal(bar(root).scrollLeft, 150, 'only moved to show its chosen tab');
  content(root).scrollTop = 300; forget(); draw('shop|clothes', 'upgrades', 0); assert.equal(content(root).scrollTop, 0); assert.equal(bar(root).scrollLeft, 0);
});

test('offsets are found again by their place in the markup, and something added above the list afterwards does not move it', async () => {
  forget(); const root = new El('section'); root.set(shop(2)); content(root).scrollTop = 333; chips(root).scrollLeft = 77;
  const kept = capture(root); assert.deepEqual(kept.map(k => [k.place, k.top, k.left, k.strip]), [['DIV:0', 333, 0, false], ['DIV:0>DIV:0', 0, 77, false]]);
  root.set(shop(2)); assert.equal(restore(root, kept), 2); assert.equal(content(root).scrollTop, 333); assert.equal(chips(root).scrollLeft, 77);
  // A panel without that element any more (another layout): what can be restored is, the rest is left alone.
  root.set([new El('header'), new El('div', { maxTop: 900 })]); assert.equal(restore(root, kept), 1); assert.equal(content(root).scrollTop, 333);
  assert.equal(restore(root, kept, true), 0, 'strips only: nothing here is a tab strip');
  // The Pandora stats strip is put in above the list by an observer after the draw; the browser then nudges the offset
  // (scroll anchoring). The keeper puts it back once more after the observers have run.
  forget(); const draw = () => drawKeeping(root, { panel: 'bag|', view: '' }, () => { root.set(shop(0, { strip: false })); queueMicrotask(() => { content(root).prepend(new El('div', { cls: 'gear-stats' })); content(root).scrollTop += 49; }); });
  draw(); await Promise.resolve(); content(root).scrollTop = 92;
  draw(); assert.equal(content(root).scrollTop, 92); await Promise.resolve(); await Promise.resolve(); assert.equal(content(root).scrollTop, 92, 'still 92 after the strip was added (it crept to 141 before)');
});
