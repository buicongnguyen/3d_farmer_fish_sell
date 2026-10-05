# Willowmere in Vietnamese: audit status

Branch `vi-audit` (on top of `facilities` fd498a3). Worktree `3d_farmer_fish_sell-vi`. Nothing pushed.

## 1. What the audit found

Two tools, both committed:

* `node scripts/vi-coverage.mjs [--list] [--json out.json]` reads every string literal and template in `src/*.mjs`,
  the text and `title/aria-label/placeholder/alt` attributes of `index.html`, the CSS `content:` strings, and walks the
  exports of every importable module (catalogues, plans, tables). Each candidate goes through the real translator
  (`i18n.mjs`: exact keys, case folding, templates with numbers, the `·` and `,` splitting, quotes). A string counts as
  covered only if the result changes **and** no English word is left in it (the first version counted
  "Small, Vạm vỡ, always where you need it." as covered; the strict one does not).
  `${...}` holes are replaced by `5`. Run-time string pieces ("Feed the", "Rest", shader code, developer diagnostics) are
  listed in `FRAGMENT` inside the script and exempted (20 of them).
* `GAME_URL=http://127.0.0.1:4621 node scripts/vi-walk.mjs desktop|phone [out.json]` opens the real game in Vietnamese
  mode (GPU Chrome) and collects every visible text node and `title/aria-label/placeholder/alt` that still has English
  words: title screen, village HUD, 25 panels with all their tabs (bag, journal, people, map, help, settings, collection,
  decor, kitchen, festival, workers, wardrobe, mirror, Pandora, grove, sleep, talk, market, atelier, workshop, the four
  civic buildings, seeds), the eight facility interiors (reloaded one by one) with their target labels, and the nine ring
  regions (box open, standing at each `STAND` point: HUD, banner, map, journal, people, bag, wardrobe).
  `scripts/vi-scan.mjs` lists English words inside table values, `scripts/vi-t.mjs "text"` prints a translation.

### Counts

| | strings found | covered | missing | of which half-translated |
|---|---|---|---|---|
| Static audit, before | 1,656 | 1,363 | 293 | 25 |
| Static audit, after | 1,636 (20 fragments exempt) | 1,636 | 0 | 0 |

Missing by area, before (all 0 after): facilities and shops 125, main panels/toasts 44, other 35, game messages 34,
villagers/house/pen/bikes 18, pandora/combat/wilds/titans 16, regions/maps 8, wardrobe/looks 8, fishing 2, content catalogue 1,
index.html 1, prompts 1.

Runtime walk (visible text with English words left):

| | text nodes read | distinct strings with English | untranslated target labels |
|---|---|---|---|
| Before, panels, HUD and interiors (desktop) | about 6,200 | about 90 (54 panels/HUD, about 35 in the interiors) | 38 (interior prompts) |
| Mid-way, first batch translated, ring regions added | 19,603 | 311 (15 kinds: "follow the birds home", "Pandora: open", "Prison", weather, and about 270 compass distances in the Map lists) | 0 |
| After, desktop 1440x900 | 19,603 | 0 | 0 |
| After, phone 390x844 | 17,764 | 0 | 0 |

## 2. What was translated

New file `src/vi-audit.mjs` (about 480 lines, same `English|Vietnamese` format, imported last so it only adds):

* All eight facility interiors from `facility-plans.mjs`: room names, prop labels, target labels and the people lines
  (supermarket, school, clinic, police, Willow & Co., Hearth bakery, Moss barn, Vale workshop barn), the doors and the
  "could not open" messages.
* Game toasts and refusals with numbers: harvest, sell, fruit trees, grove, fish catch, civic costs/earns/takes,
  festival, race, beds, test speed, helpers, knock-out and wake-up lines, vehicle and "way home" messages, fishing hints
  (cast again, line held, too early, line may break), decor placement (move, turn, "already holds N pieces", where each
  piece comes from), looks, wardrobe, mirror, pen labels (feed, collect), "Gather", "Enter {house}".
* Fight HUD names with keys (Attack (F), Whirlwind (1), Dash (2), Ground slam (3)), load-failure messages for every lazy
  module, Pandora lines, region "Rest" and "Gate" names, region line "· follow the birds home", weather chip, Map
  distance lines in all eight compass directions, "Prison".
* Villager greetings (Hi/Hello/Lovely day/evening/Good to see you), the "Back in {place}" start-up lines, family and
  role words (Grandmother = Bà, Grandfather = Ông, "Nhà Alder" ...), crafting materials counted "Bring 1 obsidian, 2 soft hide."
  (keys generated for counts 1 to 24 from the existing material names).
* Title, tagline and page title (section 4).

Vocabulary was taken from the Zoo Garden tables: lồng (cage), hạ (defeat a boss), Titan, Chong Chóng, Lướt Tới,
Đấm Đất, Sức đánh, Giáp, xu, region and planet names, boss names (Gấu Vua, Cá Sấu Chúa, Cây Cổ Thụ Nổi Giận, Vua Nấm
Khổng Lồ), "Thú cưng", "Mặc thử".
Pronouns: the player is "bạn"; Ada says "Ông con và bà" (grandmother to Rowan), June "em", Pip "con", children say
"cháu"/"cô chú" to the player, neighbours "tôi".

### Translator bugs found and fixed (`src/i18n.mjs`)

* A line wrapped in curly quotes that ends with a full stop (every NPC line in the talk panel, quoted story lines)
  never matched its key: the final `.”` was stripped as decoration. New rule: unwrap `“...”`, translate the inside,
  put the quotes back. Before, every line Ada, Ellis and the others say stayed in English in the talk panel.
* The template `{place} Rest` matched any sentence ending in "rest" ("...and the oven will do the rest."
  became "Trạm nghỉ Orchard pie, ..."). The two generic templates `{place} Rest` / `{place} Gate` were removed from
  `vi-willowmere.mjs`; the 4 rest spots and 8 gates are explicit keys in `vi-audit.mjs`.
* Strings that are joined by the `,` / `·` fallback and come out half English are now complete keys
  ("Feed and tools" no longer reads "Cho and tools ăn").

## 3. Notable corrections of the existing Vietnamese

| English | Before | After |
|---|---|---|
| June: "I'll keep the kettle warm." | Em sẽ giữ ấm ấm trà. | Em sẽ giữ ấm trà luôn nóng. |
| Pip: "Do you think it will grow?" | Bố mẹ nghĩ nó sẽ lớn lên không? (the player is one person of unknown gender) | Không biết nó có lớn lên không nhỉ? |
| Ada: "Your grandfather and I arrived..." | Ông và bà đến đây... (wrong person: Ada is Rowan's grandmother) | Ông con và bà đến đây chỉ với một hộp hạt giống... |
| "A carrot, a mushroom, a warm pot." | Một cà rốt, một nấm, nồi nóng. (no measure words) | Một củ cà rốt, một cây nấm, một nồi nóng hổi. |
| Leo: "Fern sells some of my best work." | Fern bán vài món đẹp nhất tôi dệt. | Fern bán vài món đẹp nhất do tôi dệt. |
| Clear this tree? / Clear the tree | Chặt cây (chop) while the button said Dọn cây (clear) | Dọn cây này? / Dọn cây |
| King Bear down | Đã hạ Vua Gấu (the reference calls it Gấu Vua) | Đã hạ Gấu Vua! |
| Boss list in the Pandora help | Cổ Thụ, Vua Cá Sấu, Đầm Lầy Chomper, Hẻm Núi Đá Đỏ (names that exist nowhere else) | Cây Cổ Thụ Nổi Giận, Cá Sấu Chúa, Đầm Lầy Hoa Ăn Thịt, Hẻm Núi Đỏ |
| titans (3 strings) | khổng lồ (a giant) | Titan, as in the reference |
| Ground slam in the fight note | Đập đất (the skill is Đấm Đất everywhere else) | Đấm Đất |
| Worn gear gives health, attack and defence | tăng máu, tấn công và phòng thủ (stat labels are Sức đánh and Giáp) | tăng máu, sức đánh và giáp |
| "+3 attack" (reference table) | +3 tấn công (all neighbours say sức đánh) | +3 sức đánh |
| Fighting note "(E / ACT ...)" | E / HÀNH ĐỘNG (the button says TƯƠNG TÁC) | E / TƯƠNG TÁC |
| Outfit panel: "Tap Try on" | Chạm Thử (button is Mặc thử) | Chạm Mặc thử |
| Fishing help: "Press Reel" | Nhấn Thu dây (button is Kéo cần) | Nhấn Kéo cần |
| Pets: Companions tab, "Pet for your wardrobe" | Bạn đồng hành (Zoo Garden: Thú cưng) | Thú cưng |
| Rescued friends N / M | Bạn đã giải cứu 3/5 (reads as a sentence) | Bạn bè đã giải cứu 3 / 5 |
| "The bosses have caged them." | ...nhốt họ trong lồng | ...nhốt các bạn ấy trong lồng |
| World rings message | Thế giới nay gồm các vòng quanh làng. | Thế giới giờ mở rộng thành những vòng quanh làng. |
| Furniture set names inside "From ..." | would have mixed two spellings | one spelling per set (thảm dệt đồng cỏ, tủ sách gia đình ...) |
| Family names | gia đình Bell / Nhà Alder mixed | Nhà Bell, Nhà Alder ... everywhere |
| Let go of Reel (new strings) | nhả / thả mixed | thả, as in the fishing HUD |

Read in full: `vi-willowmere.mjs` (all 1,244 lines) and `vi-reference.mjs` lines 1 to 2,410 line by line; the last
550 lines of `vi-reference.mjs` are the Zoo Garden house-chatter lines (checked by tool: no English left, no duplicate
key with a different value except the ones listed above). `vi-reference.mjs` also carries multiplayer, server and
starship text that Willowmere never shows; it was left as is.

## 4. A Vietnamese name

How the reference does it: Zoo Garden keeps the brand and translates the tagline
(`Zoo Garden — A little world of adventure` becomes `Zoo Garden — Thế giới phiêu lưu nhỏ xinh`, set with
`document.title=t(...)`; the manifest stays English). Willowmere = willow + mere (a pond), "A Family's Seasons".

| # | Name | Meaning | Slug |
|---|---|---|---|
| 1 | **Ao Liễu** (tagline: Bốn mùa bên gia đình) | the willow pond: "ao" is the village pond of Vietnamese countryside, "liễu" the willow, a direct echo of willow + mere | `ao-lieu-bon-mua` |
| 2 | Bốn Mùa Ao Liễu | the four seasons of the willow pond | `bon-mua-ao-lieu` |
| 3 | Mùa Của Gia Đình | a family's seasons, literal | `mua-cua-gia-dinh` |
| 4 | Ngôi Nhà Bên Ao Liễu | the house by the willow pond, the opening story (Ada and Ellis's cottage) | `ngoi-nha-ben-ao-lieu` |
| 5 | Xóm Liễu | willow hamlet: short, warm, a village rather than a pond | `xom-lieu` |

Recommendation: **Ao Liễu**, tagline **Bốn mùa bên gia đình**, page title `Ao Liễu · Bốn mùa bên gia đình`, slug
`ao-lieu-bon-mua` (short, no diacritics, says what the game is; "ao-lieu" alone is too generic on GitHub).
The meta description in Vietnamese: `Bén rễ bên ao liễu. Trò chơi nhập vai 3D ấm cúng về làm vườn, câu cá và cuộc sống gia đình.`

Applied only in Vietnamese mode: the brand `h1` (`#brand h1`, only that node: "Willowmere" stays the village name
everywhere else, e.g. "Trường Willowmere"), the tagline (was already `BỐN MÙA BÊN GIA ĐÌNH`), `document.title` and the
meta description (`language-view.mjs` sets them on install and on every language change; English restores them).
Nothing renamed on disk.

### Rename steps (for you, not done)

1. GitHub: Settings > General > Repository name `ao-lieu-bon-mua` (the old URL redirects for git, not for Pages).
2. Local remote: `git remote set-url origin git@github.com:<you>/ao-lieu-bon-mua.git` in every clone and worktree
   (`git remote -v` first); rename the folder `3d_farmer_fish_sell` afterwards (close editors and servers first; the
   worktrees under the old name must be re-linked with `git worktree repair`).
3. Pages: the site moves from `<you>.github.io/<old>/` to `<you>.github.io/ao-lieu-bon-mua/`. Check `base`/asset paths
   in `scripts/build.mjs` and `index.html` (the page already uses relative `./assets/...`), the hub links (the
   buicongnguyen.github.io hub and its generated lab pages, `check_all.py`), and re-run the deploy so the first
   build lands on the new URL. Leave a one-line redirect page at the old Pages path if people have bookmarks.
4. README, `package.json` `name`, the manifest/`<title>` (English name stays Willowmere unless you want a rename there
   too), and the notes in `cute_game-notes/willowmere`.
5. The save key `willowmere.language.v1` and `SAVE_KEY` are unchanged: players keep their saves because the Pages
   origin only changes if the account/repo owner changes (a repo rename keeps the same `github.io` origin; the path
   differs but `localStorage` is per origin, so saves survive).

## 5. Not covered, and why

* Text drawn inside 3D textures or the Pandora/creature GLB files (none found in English).
* Strings built from player- or data-derived words with no fixed key: item plurals such as "Found 2 {item}." rely on
  the item name table; a new item without a Vietnamese name shows its English name inside a Vietnamese sentence
  (the coverage test fails for catalogue entries, not for plurals made at run time).
* Compass lines and distances use fixed keys per direction; a ninth direction would need a key.
* Mid-sentence item names keep the capital of their table value ("Tưới Cà rốt"): the translator inserts the table value
  as written; lowercase variants would need a second table.
* `vi-reference.mjs` multiplayer, server and spaceship text: unreachable in Willowmere.
* English remains by design: player/resident names, "Willowmere" and brand names, key names (WASD, E, Shift),
  "Pandora", "Titan", "Chibi", "jeep".

## 6. Shared-file touches (everything else is in vi files, tests and scripts)

* `src/i18n.mjs` (3 changes): `import { VI_AUDIT }` and added to the `Object.assign` (last, so it wins only where the key is new or a
  correction); the curly-quote unwrap rule (6 lines) before the `decorated` step.
* `src/language-view.mjs` (a vi file, but Codex may touch it too): brand `h1` special case in `translate()`, and
  `titles()` for `document.title` and the meta description.
* `src/vi-willowmere.mjs`: 27 wording lines changed, two generic templates removed (`{place} Rest`, `{place} Gate`).
* `src/vi-reference.mjs`: one line (`+3 attack`).
* New: `src/vi-audit.mjs`, `scripts/vi-coverage.mjs`, `vi-walk.mjs`, `vi-lib.mjs`, `vi-scan.mjs`, `vi-t.mjs`,
  `tests/vietnamese-coverage.test.mjs`, this file. No change to `main.mjs`, `game.mjs`, `content.mjs`, `index.html`,
  `scripts/build.mjs`, `package.json`.

Build: `node scripts/build.mjs` first-load 1,099,285 bytes (715 to spare, the same as before; limit 1,100,000 unchanged).
The Vietnamese tables stay in the lazy `import()` chunk (fetched later: 265,331 to 265,550 bytes).

## 7. How to merge

1. Merge `facilities` first, then `vi-audit` (it sits on top of fd498a3, so it fast-forwards after `facilities`).
2. Codex also edits `vi-willowmere.mjs` and `vi-reference.mjs`: both tables are line oriented, so conflicts are per line.
   Keep both sides' keys; where the same key exists on both sides prefer the better translation (the corrections in
   section 3 are deliberate: Titan, Gấu Vua, Dọn cây, Thú cưng, Sức đánh/Giáp). `vi-audit.mjs` is loaded last, so a
   key that is in both `vi-audit` and Codex's table resolves to `vi-audit`; delete the duplicate on the side you
   do not want. `node scripts/vi-scan.mjs` lists terms with two translations; the duplicate-key check in section 3
   (case-folded key, different value) is a three-line node script over the three tables.
3. After merging run `node scripts/vi-coverage.mjs --list` (any new English string Codex or the game adds shows up
   there, and `tests/vietnamese-coverage.test.mjs` fails with the list), then `npm test`.

## 8. Tests

* `npm test`: 505 tests, 505 pass (includes the new coverage test: 0 missing of 1,636 strings, and the quoted-dialogue,
  directions, page-title, material-count checks).
* `node scripts/build.mjs`: first-load 1,099,285 / 1,100,000 bytes.
* `tests/vietnamese-browser.mjs` (desktop, phone, landscape, GPU, port 4621): pass (language switch, reload, profile
  isolation, purchase, shops fit their modal).
* `tests/browser.mjs` (once, port 4621): pass, no page errors.
* `scripts/vi-walk.mjs desktop` and `phone`: 0 strings with English, 0 untranslated target labels, 0 errors.
* Looked at the screenshots of the title screen (390x844, Vietnamese: brand "Ao Liễu", tagline, buttons fit) and the
  school interior (390x844: "Trường Willowmere" welcome toast, "Bước ra ngoài" button fit).

## 9. Open

* The name is a proposal; only the in-game title, tagline, page title and description changed.
* In the ring regions a few mid-sentence item names are capitalised (see section 5).
* Dialogue pronoun choices (Ada "ông con và bà", Pip "con", children "cháu / cô chú") assume Rowan is addressed as an
  adult relative; if Rowan should have a fixed gender the lines could be warmer ("bố/mẹ").
* `vi-reference.mjs` lines 2,411 to 2,958 were checked by tool, not read line by line.
