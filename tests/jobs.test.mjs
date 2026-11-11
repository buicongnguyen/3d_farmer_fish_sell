import test from 'node:test';
import assert from 'node:assert/strict';
import { freshState, act, SUBJECTS } from '../src/game.mjs';
import { takeJob, jobsLeft, parseJobs, JOBS_PER_DAY } from '../src/jobs.mjs';

test('two paid jobs a day, a third pays nothing, a new day starts fresh', () => {
  const s = freshState();
  assert.equal(takeJob(s), true);
  assert.equal(takeJob(s), true);
  assert.equal(jobsLeft(s), 0);
  assert.equal(takeJob(s), false);
  s.day++;
  assert.equal(jobsLeft(s), JOBS_PER_DAY);
  assert.equal(takeJob(s), true);
});

test('test mode never runs out of jobs', () => {
  const s = freshState();
  s.settings.test = true;
  for (let i = 0; i < 5; i++) assert.equal(takeJob(s), true);
});

test('the running prize shares the slots: the third paid job gives no coins', () => {
  const s = freshState();
  takeJob(s);
  takeJob(s);
  const coins = s.coins;
  const r = act(s, 'race', { seconds: 30 });
  assert.equal(r.ok, true);
  assert.equal(s.coins, coins);
  assert.equal(s.raceDay, s.day);
});

test('a lesson day takes one slot, not one per answer, and is unpaid when the board is full', () => {
  const s = freshState();
  const id = Object.keys(SUBJECTS)[0];
  act(s, 'lesson', { id });
  for (let i = 0; i < 3; i++) assert.equal(act(s, 'answer', { given: s.quiz.answer }).ok, true);
  assert.equal(s.jobs.n, 1);
  const full = freshState();
  takeJob(full);
  takeJob(full);
  act(full, 'lesson', { id });
  const coins = full.coins;
  act(full, 'answer', { given: full.quiz.answer });
  assert.equal(full.coins, coins);
});

test('saved jobs are clamped and dropped on another day', () => {
  assert.deepEqual(parseJobs({ day: 4, n: 99 }, 4), { day: 4, n: JOBS_PER_DAY });
  assert.deepEqual(parseJobs({ day: 3, n: 1 }, 4), { day: 4, n: 0 });
});
