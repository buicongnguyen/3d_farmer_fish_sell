import test from 'node:test';
import assert from 'node:assert/strict';
import { CROPS } from '../src/content.mjs';
import { bedFromSeconds, bedProgress, bedRipe, cropDays, daysLeft, newBed, overnight } from '../src/growth.mjs';

test('every crop needs between one and five nights, and the first crops are quick', () => {
  for (const [id, c] of Object.entries(CROPS)) assert.ok(cropDays(c) >= 1 && cropDays(c) <= 5, id);
  assert.equal(cropDays(CROPS.carrot), 1);
  assert.ok(cropDays(CROPS.pumpkin) >= cropDays(CROPS.carrot));
  assert.equal(cropDays({ grow: 999, days: 2 }), 2, 'a crop can set its own days');
});

test('a watered bed grows one day a night; a dry bed does not; the morning is dry unless it rains', () => {
  let bed = newBed('pumpkin');
  assert.deepEqual(bed, { crop: 'pumpkin', grown: 0, watered: false });
  assert.equal(overnight(bed, false).grown, 0, 'never watered, never grew');
  bed = { ...bed, watered: true };
  const next = overnight(bed, false);
  assert.deepEqual(next, { crop: 'pumpkin', grown: 1, watered: false });
  assert.equal(bed.grown, 0, 'the old bed is not changed');
  assert.equal(overnight(bed, true).watered, true, 'rain waters the morning');
  assert.equal(overnight(null, false), null);
});

test('rain on the day it is planted waters it at once', () => {
  assert.equal(newBed('carrot', true).watered, true);
});

test('ripe after its days, at once in test mode, and progress and days left agree', () => {
  const days = cropDays(CROPS.pumpkin);
  let bed = { crop: 'pumpkin', grown: 0, watered: true };
  assert.equal(bedRipe(bed, CROPS), false);
  assert.equal(bedRipe(bed, CROPS, true), true);
  assert.equal(daysLeft(bed, CROPS), days);
  assert.equal(bedProgress(bed, CROPS), 0, 'watering does not move the picture; the night does');
  for (let i = 0; i < days; i++) bed = { ...overnight(bed, false), watered: true };
  assert.equal(bedRipe(bed, CROPS), true);
  assert.equal(daysLeft(bed, CROPS), 0);
  assert.equal(bedProgress(bed, CROPS), 1);
  assert.equal(bedProgress(null, CROPS), 0);
  assert.equal(bedRipe(null, CROPS), false);
});

test('a version-1 bed keeps its progress: ripe stays ripe, part-grown keeps its share, dry starts again', () => {
  const grow = CROPS.pumpkin.grow,
    days = cropDays(CROPS.pumpkin);
  assert.equal(bedFromSeconds({ crop: 'pumpkin', planted: 0, watered: true }, CROPS, grow).grown, days);
  assert.equal(bedFromSeconds({ crop: 'pumpkin', planted: 0, watered: true }, CROPS, grow * 5).grown, days);
  assert.equal(
    bedFromSeconds({ crop: 'pumpkin', planted: 0, watered: true }, CROPS, grow / 2).grown,
    Math.floor(days / 2),
  );
  assert.equal(bedFromSeconds({ crop: 'pumpkin', planted: 0, watered: false }, CROPS, grow * 5).grown, 0);
  assert.equal(bedFromSeconds({ crop: 'nonsense', planted: 0, watered: true }, CROPS, 9), null);
});

import { act, freshState } from '../src/game.mjs';
import { CROP_UNLOCK, cropUnlock } from '../src/content.mjs';

test('seeds are sold chapter by chapter: the market refuses a seed before its chapter and sells it from then on', () => {
  const s = freshState();
  s.coins = 5000;
  assert.ok(act(s, 'buySeed', { id: 'carrot' }).ok, 'the carrot is on sale from the start');
  assert.equal(act(s, 'buySeed', { id: 'radish' }).ok, false);
  assert.equal(s.coins, 5000 - CROPS.carrot.price * 3, 'a refused purchase costs nothing');
  s.chapter = cropUnlock('radish');
  assert.ok(act(s, 'buySeed', { id: 'radish' }).ok);
  assert.equal(act(s, 'buySeed', { id: 'goldcorn' }).ok, false);
  s.chapter = 8;
  for (const id of Object.keys(CROP_UNLOCK)) assert.ok(act(s, 'buySeed', { id }).ok, id);
});

test('every unlock names a real crop and a chapter the story has', () => {
  for (const [id, chapter] of Object.entries(CROP_UNLOCK)) {
    assert.ok(CROPS[id] && !CROPS[id].free, id);
    assert.ok(Number.isInteger(chapter) && chapter >= 1 && chapter <= 8, id);
  }
});
