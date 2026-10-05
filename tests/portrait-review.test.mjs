import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { MirrorPreview } from '../src/mirror-view.mjs';
import { paintPerson } from '../src/garments-view.mjs';
import { useAvatarLoader, styleKey } from '../src/avatar.mjs';
import { outfitOf } from '../src/outfits.mjs';

test('a late resident asset load cannot replace the next resident in the talk portrait', async () => {
  const before = globalThis.document, show = MirrorPreview.prototype.show, drawn = [], pending = [];
  const slot = {}, context = { createRadialGradient: () => ({ addColorStop() {} }), fillRect() {} };
  globalThis.document = { querySelector: () => slot, createElement: () => ({ getContext: () => context }) };
  MirrorPreview.prototype.show = function (_, key) { drawn.push(key); };
  useAvatarLoader(() => new Promise(resolve => pending.push(resolve)));
  try {
    const world = { raw: new Map(['hero-girl-tall', 'wm-garments'].map(k => [k, new T.Group()])), iconScene: () => new T.Scene() };
    paintPerson(world, {}, { id: 'pearl' }); // Her hat is still loading.
    paintPerson(world, {}, { id: 'june' });
    await Promise.resolve(); assert.ok(pending.length > 0);
    for (const resolve of pending) resolve(new T.Group());
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(drawn.length, 2, 'the stale portrait never repaints');
    assert.equal(drawn.at(-1), styleKey(outfitOf({ id: 'june' }, false, {})));
  } finally {
    MirrorPreview.prototype.show = show;
    if (before === undefined) delete globalThis.document; else globalThis.document = before;
  }
});

test('a failed portrait render restores its caller render target and clear colour', () => {
  for (const fault of ['render', 'readRenderTargetPixels']) {
    const initialTarget = { name: 'caller target' }, colour = new T.Color('#123456'); let target = initialTarget, alpha = .7;
    const renderer = {
      getRenderTarget: () => target, getClearColor: out => out.copy(colour), getClearAlpha: () => alpha,
      setRenderTarget: value => { target = value; }, setClearColor: (value, a) => { colour.set(value); alpha = a; },
      clear() {}, render() {}, readRenderTargetPixels() {},
    };
    renderer[fault] = () => { throw Error('portrait unavailable'); };
    const preview = { world: { renderer }, opts: { width: 2, height: 2 }, key: '', holder: new T.Group(), frame() {},
      target: { width: 2, height: 2 }, pixels: new Uint8Array(16), canvas: {}, scene: new T.Scene(), camera: new T.Camera() };
    assert.equal(MirrorPreview.prototype.show.call(preview, null, fault, () => new T.Group()), false);
    assert.equal(target, initialTarget); assert.equal(colour.getHexString(), '123456'); assert.equal(alpha, .7);
    assert.equal(preview.holder.children.length, 0, 'the temporary portrait model is also released');
  }
});
