import test from 'node:test';import assert from 'node:assert/strict';
import {t,setLanguage,getLanguage,localizeHtml} from '../src/i18n.mjs';
import {LINES} from '../src/catch-reactions.mjs';
test('Vietnamese covers menus, three profiles, quantities and every catch reaction',()=>{
 setLanguage('vi');
 assert.equal(t('Profile 3'),'Hồ sơ 3');assert.equal(t('Day 7 · 987 coins · Album 2/8'),'Ngày 7 · 987 xu · Kỷ niệm 2/8');
 for(const s of ['The village market','The Finch atelier','The Vale workshop','Willowmere Supermarket','Crafting','English words','Choose a save profile'])assert.notEqual(t(s),s);
 for(const lines of Object.values(LINES))for(const line of lines){const s=line.replaceAll('{fish}','Silver carp');assert.notEqual(t(s),s,`translated catch: ${s}`);assert.ok(!t(s).includes('{fish}'));}
 assert.equal(t('Hello, Rowan!'),'Chào Rowan!');assert.equal(t('A Silver carp! My lucky cast!'),'Cá chép bạc! Lần thả câu may mắn!');
});
test('translation keeps game identifiers, inputs, names and English restoration intact',()=>{
 setLanguage('vi');const markup='<button data-action="buy" data-id="carrot" title="Buy">Buy</button><input value="carrot"><span data-i18n-skip>English</span><kbd>WASD</kbd>';
 const localized=localizeHtml(markup);assert.match(localized,/data-action="buy" data-id="carrot" title="Mua"/);assert.match(localized,/value="carrot"/);assert.match(localized,/>English<\/span>/);assert.match(localized,/>WASD<\/kbd>/);
 assert.equal(t('Player 1 <script>'),'Player 1 <script>');setLanguage('en');assert.equal(getLanguage(),'en');assert.equal(t('The village market'),'The village market');assert.equal(localizeHtml(markup),markup);
});

import * as content from '../src/content.mjs';
test('Vietnamese covers the entire village catalogue and story dialogue',()=>{
 setLanguage('vi');for(const group of ['CROPS','ITEMS','TREES','OUTFITS','KID_OUTFITS','FURNITURE','UPGRADES','CHAPTERS','JOBS'])for(const item of Object.values(content[group]))for(const field of ['name','title','subtitle','text','desc','memory'])for(const source of Array.isArray(item[field])?item[field]:[item[field]])if(source)assert.notEqual(t(source),source,group+' '+field+': '+source);
 for(const person of content.RESIDENTS)for(const field of ['role','line'])if(person[field])assert.notEqual(t(person[field]),person[field],person.name+' '+field);setLanguage('en');
});

test('Vietnamese translates recent menus and nested dynamic rewards completely',()=>{setLanguage('vi');for(const [source,expected]of [
['Uses 6 energy · Earns 40 coins · Takes 1 hour. Once per day · done 0 time(s).','Dùng 6 năng lượng · Nhận 40 xu · Mất 1 giờ. Mỗi ngày một lần · đã làm 0 lần.'],
['Workshop crafting','Chế tạo tại xưởng'],['Craft Lava boots','Chế tạo Giày Chống Dung Nham'],
['Dress with puff sleeves, a tiered skirt and a back bow.','Váy có tay phồng, chân váy nhiều tầng và nơ phía sau.'],
['HOME · VILLAGE LEADER','NHÀ · TRƯỞNG LÀNG'],['8+ coins','8+ xu'],['Fruit trees planted: 0 of 20. Room for 20 more.','Đã trồng 0/20 cây ăn quả. Còn chỗ cho 20 cây.']])assert.equal(t(source),expected);setLanguage('en');});
