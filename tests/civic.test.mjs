import test from 'node:test';
import assert from 'node:assert/strict';
import {freshState,act,parseSave,bedCount,makeQuestion,SUBJECTS,TEST_KEY,ripe} from '../src/game.mjs';
import {CIVIC} from '../src/content.mjs';

test('clinic, police and company each offer one daily activity', () => {
  assert.deepEqual(CIVIC.map(c=>c.id),['school','hospital','police','company']);
  const s=freshState();s.energy=50;
  assert.ok(act(s,'civic',{id:'hospital'}).ok);assert.equal(s.energy,100);assert.equal(s.coins,130);
  assert.equal(act(s,'civic',{id:'hospital'}).ok,false);
  assert.ok(act(s,'civic',{id:'company'}).ok);assert.equal(s.coins,205);assert.equal(s.energy,85);
  assert.ok(act(s,'civic',{id:'police'}).ok);assert.equal(s.coins,245);
  assert.equal(act(s,'civic',{id:'bank'}).ok,false);
  act(s,'sleep');assert.ok(act(s,'civic',{id:'company'}).ok);
  const back=parseSave(JSON.parse(JSON.stringify(s)));assert.equal(back.civicDay.company,s.day);assert.equal(back.stats.shifts,2);
});

test('school lessons in every subject pay coins for correct answers only', () => {
  for(const id of Object.keys(SUBJECTS))for(let i=0;i<40;i++){const q=makeQuestion(id);assert.equal(q.choices.length,4,id);assert.equal(new Set(q.choices).size,4,`${id} ${q.q}`);assert.ok(q.choices.includes(q.answer),`${id} ${q.q}`);}
  const s=freshState();act(s,'lesson',{id:'times'});const wrong=s.quiz.choices.find(c=>c!==s.quiz.answer);
  assert.equal(act(s,'answer',{given:wrong}).ok,false);assert.equal(s.coins,160);
  assert.ok(act(s,'answer',{given:s.quiz.answer}).ok);assert.equal(s.coins,160+SUBJECTS.times.pay);assert.equal(s.learned.times,1);
  act(s,'lesson',{id:'plus'});assert.ok(act(s,'answer',{given:s.quiz.answer}).ok);assert.equal(s.coins,160+SUBJECTS.times.pay+SUBJECTS.plus.pay+2);
});

test('fields grow two beds at a time, flowers need no seeds, trees clear for a fee', () => {
  const s=freshState();assert.equal(bedCount(s),6);assert.ok(act(s,'plot').ok);assert.equal(bedCount(s),8);assert.equal(s.coins,120);
  assert.ok(act(s,'plant',{index:7,crop:'tulip'}).ok);assert.equal(act(s,'buySeed',{id:'tulip'}).ok,false);
  assert.ok(act(s,'chop',{index:3}).ok);assert.equal(s.coins,105);assert.equal(s.inventory.wood,2);assert.equal(act(s,'chop',{index:3}).ok,false);
  assert.deepEqual(parseSave(JSON.parse(JSON.stringify(s))).cleared,[3]);
});

test('the leader hires met neighbours who are paid and produce each morning', () => {
  const s=freshState();assert.equal(act(s,'hire',{id:'oren',job:'farmhand'}).ok,false);act(s,'talk',{id:'oren'});
  assert.equal(act(s,'hire',{id:'pip',job:'farmhand'}).ok,false);
  assert.ok(act(s,'hire',{id:'oren',job:'farmhand'}).ok);assert.equal(s.coins,120);act(s,'sleep');assert.equal(s.coins,80);assert.equal(s.inventory.carrot,3);
  s.coins=0;act(s,'sleep');assert.deepEqual(s.hired,{});
});

test('test mode needs the secret key and then ripens crops instantly', () => {
  const s=freshState();assert.equal(act(s,'testMode',{key:'guess'}).ok,false);assert.equal(act(s,'testSpeed',{id:5}).ok,false);
  act(s,'plant',{index:0,crop:'carrot'});act(s,'water',{index:0});assert.equal(ripe(s,s.beds[0]),false);
  assert.ok(act(s,'testMode',{key:TEST_KEY}).ok);assert.ok(s.coins>=100000);assert.equal(ripe(s,s.beds[0]),true);assert.ok(act(s,'testSpeed',{id:20}).ok);
  assert.equal(parseSave(JSON.parse(JSON.stringify(s))).settings.speed,20);
});
