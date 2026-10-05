import test from 'node:test';import assert from 'node:assert/strict';
import {missing,found,fragments} from '../scripts/vi-coverage.mjs';
import {t,setLanguage} from '../src/i18n.mjs';
test('every player-visible English string found in src/*.mjs, index.html and the CSS is translated (scripts/vi-coverage.mjs)',()=>{
 assert.ok(found.size>1500,'the audit found the strings: '+found.size);
 assert.deepEqual(missing.map(([s,w])=>s+'  <- '+w.join(',')),[]);
 assert.ok(fragments.length<40,'only run-time string pieces are exempt');
});
test('quoted dialogue, facility text, directions and the page title translate',()=>{
 setLanguage('vi');
 assert.equal(t('“Hi Rowan!”'),'“Chào Rowan!”');
 assert.equal(t('Look at the cold section'),'Xem quầy đồ lạnh');
 assert.equal(t('36 m south-east'),'36 m về phía đông nam');
 assert.equal(t('Willowmere · A Family’s Seasons'),'Ao Liễu · Bốn mùa bên gia đình');
 assert.equal(t('Bring 1 obsidian, 2 soft hide.'),'Cần có 1 Đá Vỏ Chai, 2 Da mềm.');
 setLanguage('en');
});
