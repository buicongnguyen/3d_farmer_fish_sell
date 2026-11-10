// Claiming a chapter plays its scene: the card opens over the world, Next walks through every beat, and the card closes with nothing pending.
//   GAME_URL=http://127.0.0.1:<port> node tests/story-scene-browser.mjs
import assert from 'node:assert/strict';
import { launch, open, VIEWS } from './travel-kit.mjs';

const browser = await launch();
try {
  for (const view of ['phone', 'desktop']) {
    const { page, context, errors } = await open(browser, view, s => {
      s.settings.test = true;
      s.day = 6;
      s.chapter = 0;
      s.met.ada = true;
    });
    await page.waitForTimeout(2500);
    await page.evaluate(() => willowmere.test.open('journal'));
    await page.waitForSelector('[data-action="claim"]');
    const tap = sel => (VIEWS[view].hasTouch ? page.locator(sel).first().tap() : page.locator(sel).first().click());
    await tap('[data-action="claim"]');
    await page.waitForSelector('#modal.scene-modal [data-type="sceneNext"]', { state: 'visible' });
    const box = await page.locator('#modal').boundingBox();
    assert.ok(box.x >= 0 && box.x + box.width <= VIEWS[view].viewport.width + 1, `${view}: the card fits the width`);
    const button = await page.locator('[data-type="sceneNext"]').first().boundingBox();
    assert.ok(button.width >= 44 && button.height >= 44, `${view}: Next is at least 44 px`);
    let beats = 0;
    while (
      await page
        .locator('#modal.scene-modal [data-type="sceneNext"]')
        .first()
        .isVisible()
        .catch(() => false)
    ) {
      await tap('#modal.scene-modal [data-type="sceneNext"]');
      await page.waitForTimeout(200);
      assert.ok(++beats < 12, 'the scene ends');
    }
    assert.ok(beats >= 4 && beats <= 8, `${view}: a chapter scene has 4 to 8 beats (saw ${beats})`);
    const s = await page.evaluate(() => willowmere.snapshot());
    assert.equal(s.chapter, 1);
    assert.equal(s.pendingScenes.length, 0);
    assert.equal(
      await page.evaluate(() => document.getElementById('modal-backdrop').hidden),
      true,
      `${view}: the card closed`,
    );
    assert.deepEqual(errors, []);
    await context.close();
  }
  console.log('story scene browser: ok');
} finally {
  await browser.close();
}
