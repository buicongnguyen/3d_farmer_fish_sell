# Vietnamese names for the characters, households and village

Branch `vi-names` (cut from origin/main b12e316). One table, `src/vi-names.mjs`; nothing else knows a Vietnamese name.

## The rule

* Humans get a natural Vietnamese given name that suits age, role and character, and keeps the initial or sound of the English
  name where a good word exists (Theo = Thắng, Hugo = Hùng, Faye = Phượng, Kit = Kiệt, Nell = Nhài, Mara = Mai). Where no
  sound fits, the name carries the character's meaning instead (Pearl = Ngọc "pearl", Iris = Lụa "silk" for the tailor,
  Leo = Lĩnh "silk weave" for the weaver, Oren = Điền "field", Wren = Chích "little bird").
* Children get nicknames or short names (Pip = Bống, Wren = Chích, Kit = Kiệt, Faye = Phượng, Milo = Minh).
* Households and buildings become short Vietnamese nature words, as the reference does with its places
  (Clover Village = Hành Tinh Mầm Xanh). They keep the "Nhà / Tiệm / Xưởng / Trường" word already in the strings.
* The rescued friends Sprout, Clover, Pepper (the prison captives) are KEPT: Zoo Garden keeps its friend names
  (Sprout, Clover, Pepper, Bolt) in every Vietnamese line. Bosses and animals were already translated by the audit.
* Pronouns stay as in the audit: the player is "bạn", Ada to Rowan "bà", Ellis "ông", June "em", Pip "con", children say
  "cháu"/"cô chú", neighbours "tôi". Titles are not part of a name: "bà", "ông", "bác sĩ" come from the lines and roles.

## The mapping (English -> Vietnamese)

| English | Vietnamese | Role | Reason |
|---|---|---|---|
| Rowan (player, "Nhà Rowan") | **Rạng** | the player, any gender; the farm family | "rạng" = dawn, neutral; R initial, close to the sound of Rowan; works as "Rạng à" and "Nhà Rạng" |
| June | Dịu | partner | gentle, warm; sounds like "June" said softly |
| Pip | Bống | small daughter | "bống" is the Vietnamese pet name for a little girl (and a little fish: the pond) |
| Ada | Ánh | grandmother, seeds | keeps the A; "ánh" = light ("bà Ánh") |
| Ellis | Nhẫn | grandfather, fishing | "nhẫn" = patience, the lesson of his line ("ông Nhẫn") |
| Theo | Thắng | mechanic, jeep | Th sound; a strong, steady name |
| Bea | Bích | postkeeper | B initial; "bích" = jade green |
| Kit | Kiệt | young inventor | K initial; "kiệt" = outstanding |
| Mara | Mai | animal keeper | Ma/Mai; apricot blossom |
| Oren | Điền | farmer | "điền" = field |
| Wren | Chích | little gardener | "chích" is the wren-sized bird (chim chích) |
| Finn | Phi | fisher | F = Ph; short, sounds like Finn |
| Pearl | Ngọc | police officer, boat maker | "ngọc" = pearl, gem |
| Iris | Lụa | tailor | "lụa" = silk |
| Leo | Lĩnh | weaver | "lĩnh" = a fine silk weave |
| Faye | Phượng | young artist | F = Ph; flame tree, colourful |
| Hugo | Hùng | baker | H initial; a sturdy, friendly name |
| Nell | Nhài | festival host | N initial; jasmine, festive |
| Ash | Ân | carpenter | A sound; "ân" = kindness |
| Fern | Dương | furniture maker | "dương xỉ" = fern; short and gender neutral |
| Cora | Cẩm | teacher | C sound; "cẩm" = brocade ("cô Cẩm") |
| Milo | Minh | schoolboy | M initial; "minh" = bright |
| Sylvie | Sương | orchard keeper | S initial; morning dew in the orchard |
| Hazel | Hạnh | nurse | H initial; "hạnh" = virtue, almond |
| Alder (family, Ada's cottage) | Dẻ | household | chestnut-like tree; short |
| Bell (garage, jeep) | Chuông | household | literal |
| Moss (barn) | Rêu | household | literal: "Chuồng Rêu"; the sign MOSS BARN = CHUỒNG RÊU |
| Reed (boathouse) | Sậy | household | literal |
| Finch (atelier) | Sẻ | household | sparrow: "Tiệm may Sẻ" |
| Hearth (bakery) | Bếp Lửa | household | "Tiệm bánh Bếp Lửa" |
| Vale (farmhouse, workshop) | Thung Xanh | household | "Xưởng Thung Xanh", "Nhà nông trại Thung Xanh" |
| Brook (schoolhouse) | Suối | household | "Trường Suối" |
| Linden (clinic) | Bồ Đề | household | a tall shade tree; "Phòng khám Bồ Đề" |
| Willowmere (village, school, supermarket) | Ao Liễu | the village | the game's Vietnamese name; "Trường Ao Liễu", "Siêu thị Ao Liễu" |
| Willow & Co. | Liễu & Cộng sự | the company | |
| Ms Brook / Dr Linden / Officer Reed | Cô Cẩm / Bác sĩ Hạnh / Cảnh sát Ngọc | titles with a family name | the person is the resident of that household (Cora, Hazel, Pearl); a surname is not a Vietnamese title word |
| Sprout, Clover, Pepper | kept | rescued friends | the reference keeps them |

## How it is applied

`src/vi-names.mjs` exports `applyNames(text)`, `bareName(text)` and `NAME_ROWS`.
`src/i18n.mjs` (Vietnamese only): `t()` runs `applyNames` on every result (plain and with params); `translate()` checks
`bareName` first so a bare resident name is never taken for an item (the reference table has "Pearl" = Ngọc Trai).
Matching is whole-word (letters and digits count as word parts, so "Adamant" and "Pipe" are untouched), Capitalised and UPPER
case (a sign MOSS BARN becomes CHUỒNG RÊU), and a trailing 's is dropped. It runs on the finished Vietnamese text, so it covers
names inside table values ("Fern bán vài món..."), dialogue, panels, toasts, the talk screen, people panel, album, quest text and
facility labels. "Theo" is also the verb "to follow", so a guard skips it before ba, dấu, đường and similar words.

Where the 3D tags and signs are routed (no new drawing code was needed):
* Villager name tags are DOM spans in `#villager-names` (`villager-labels.mjs`), not canvas. `language-view.mjs` translates
  them through `t()` like any text and again on a language switch. The tags used to be exempt from translation (a set of
  resident names); that exemption was removed, and `villager-labels.mjs` now sizes the tag from the shown text
  (`labels.get(id).textContent`) so a longer Vietnamese name fits.
* House, barn, shop and civic signs are canvas textures from `world.mjs labelTexture`. `language-view.mjs signs()` already
  re-renders every `world.labels` sign through `t()` on a language change; now `t()` includes the names.
* Facility interior labels, prompts and target labels use `t()` as before.

## Saves

Nothing is saved by name: saves use ids (`ada`, `pip`, house ids 0 to 9, friend ids) and the player name is not stored.

## Changed shared files

* `src/i18n.mjs`: the import, `bareName` in `translate()`, `applyNames` in `t()` (3 lines).
* `src/language-view.mjs`: removed the resident-name skip set and the `RESIDENTS` import (2 lines).
* `src/villager-labels.mjs`: one expression (`name: labels.get(n.p.id).textContent`).
* `tests/vietnamese.test.mjs`: "Chào Rowan!" is now "Chào Rạng!". `tests/vietnamese-coverage.test.mjs`: the same line and one new test.
* New: `src/vi-names.mjs`, this file. The vi tables were not edited.

## Not covered / open

* English mode is unchanged and still shows the English names.
* The English manifest and meta keep Willowmere.
* The names are my choices; swap a row if you prefer another (below).

## Change a name later

Edit its row in `ROWS` at the top of `src/vi-names.mjs` (`English|Vietnamese`); nothing else. Add a row for a new resident.
`npm test` fails if an English name from the table is left in the character tables.

## Merge notes

Codex edits `i18n.mjs`, `language-view.mjs` and the vi tables: the changes above are tiny and line based. After merging run
`node scripts/vi-coverage.mjs`, `npm test` and `node scripts/build.mjs` (first load must stay below 1,100,000).

## Test results

(filled in below)
