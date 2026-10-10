# The missing workers: rescue huts in the lands (branch `rescue`, from main 29da6d3)

Not pushed, not merged into main. Written 2026-10-10 by Claude. `origin/main` c662d32 (disguise fx 2) was merged INTO this branch at the end with no conflict: after it `npm test` is 525 of 525, the bundle is unchanged and the Vietnamese audit is still 0 missing; the browser suites below ran before that merge and were not run again. Another branch (`facility-talk`) is filling the facility buildings at the same time: section 4 says how the two meet.

## 1. The story rule

When the Pandora box was opened, twelve of the village's facility workers (school, clinic, police station, supermarket, office, bakery) were carried off, one to every land that has a boss: the 4 home regions and the 8 planets of the ring. Each is shut in a small hut in that land's style, 9 m from the boss's den. You see them at the barred window and they call out. While the boss lives the door is barred (a tap: "🔒 Tilly is shut inside. The boss of this land holds the key."). Beating the boss (the existing `state.defeated[type]` record) takes the bar off for good; a tap or E at the hut opens it, the worker steps out, cheers, says a short thank-you and hurries home. From then on they stand at a post inside their facility building, talk (a few funny three-choice conversations) and bring one small daily perk. They are 12 new people, not any of the 23 residents, so nobody is missing from the village before the box opens. With the box shut there are no huts and nobody is held; people already rescued stay at their posts. The three friend cages (Sprout, Clover, Pepper) are untouched.

## 2. The twelve

| Name | Vietnamese | Land (stars) | Boss | Hut (style, place) | Role and post | What their return unlocks |
|---|---|---|---|---|---|---|
| Tilly | Thảo | Mushroom Forest (★) | Ancient Treant | mushroom hut (-106.7, 59.7) | School cook, school hall | A free school lunch each day: +25 energy (ask) |
| Dottie | Đào | Blue Lake Meadow (★) | Mushroom King | lake cottage (59.7, 106.7) | Stock clerk, supermarket back room | One extra daily special: a free packet of 3 seeds (ask; carrot, radish or pumpkin by the day) |
| Barnaby | Bách | Toybox Land (★★) | Giant Toy Robot | toy block house (200.2, 40.8) | Librarian, school (by the library door) | Book of the day: two more paid lesson answers that day (ask) |
| Marlow | Mạnh | Chomper Swamp (★★) | Crocodile King | swamp stilt hut (-59.7, -106.7) | Baker's hand, Hearth Bakery shop | A jar of wild honey each day (ask) |
| Gus | Giáp | Redrock Canyon (★★★) | King Bear | canyon adobe (106.7, -59.7) | Second officer, police lobby | The village patrol pays 15 coins more (passive: 40 to 55) |
| Mabel | Mận | Candy Land (★★★) | Cake King | gingerbread house (102.9, 172.7) | Deli counter, supermarket cold section | A tub of Garden soup each day (ask) |
| Otis | Quý | Wild Jungle (★★★) | Jungle Gorilla | jungle tree hut (-40.8, 200.2) | Receptionist, Willow & Co. | The office shift takes one hour less (passive: 3 h to 2 h) |
| Greta | Gấm | Frost Land (★★★★) | Snow Yeti | igloo (-176.1, 104.0) | Pharmacist, clinic pharmacy door | One free remedy a day: health to at least 100 and +15 energy (ask) |
| Winnie | Vân | Shell Beach (★★★★) | Ocean Leviathan | beach shack (-200.2, -40.8) | Accountant, Willow & Co. | The office shift pays 15 coins more (passive: 75 to 90) |
| Edith | Yến | Ember Fields (★★★★) | Magma Golem | lava stone hut (-84.9, -183.7) | Doctor, clinic exam room 2 | The check-up costs half (passive: 30 to 15 coins) |
| Felix | Phúc | Cloud Meadow (★★★★) | Thunder Phoenix | cloud hut (40.8, -200.2) | Assistant teacher, school classroom 2 | Every paid lesson answer earns 2 coins more (passive, inside the daily lesson cap) |
| Nora | Nga | Night Land (★★★★★) | Shadow Lord | shadow lantern hut (170.4, -112.7) | Detective, police evidence room | A case closed each day: 30 coins (ask) |

Harder lands hold the more valuable workers (coins and prices in the four- and five-star lands, food and seeds in the easy ones). "Ask" perks are the third choice of the worker's conversation and run the `perk` action: once a day each (`state.rescuedPerk[id] = day`). Passive perks change the existing `civic` and `answer` actions only (`civicPerk`, `answerBonus`), which keep their own once-a-day rules. Each person has a look and outfit from the game's garments (`wear` row in `src/rescued.mjs`, the `outfits.mjs` row shape; a node test holds that no two people in the village dress alike), a one-line personality (`line`) and a thank-you (`THANKS`).

## 3. What was built, by file

| File | What |
|---|---|
| `src/rescued.mjs` (new, pure, first load, about 9.7 KB minified) | The 12 people, the placement rule (`hutCandidates`, `hutClear`, `hutSpot`), `hutState`, `hutStatuses`, `rescuedList`, `postsFor` (the seam), `heldIn`, `peopleHtml`, `parseRescued`, `rescueAct` ('hut', 'perk'), `civicPerk`, `answerBonus` |
| `src/rescue-view.mjs` (new, lazy) | The huts in the world (load within 96 m, drop beyond 112 m), collider (`world.addTreeBlock`, r 2 m), tap target (within 48 m; you walk to the doorstep), labels, the captive's calls, the rescue (door swings open, the worker cheers 3.4 s with a speech bubble, burst, fanfare, toast), the "back at work here" toast on the first visit to the facility, the fallback talk panel, `window.willowmere.rescue()` diagnostics |
| `src/rescued-talk.mjs`, `src/vi-rescue-talk.mjs` (new, lazy) | The conversations: `TALK[id] = {root, adv, job}`, each node `{say, choices: [{text, reply, next?, effect?, end?}] x 3}`; written once with the Vietnamese beside each line |
| `src/vi-rescue.mjs` (new), `src/i18n.mjs`, `src/vi-names.mjs` | Vietnamese for every new string; the 12 names are rows of the name table |
| `art/blender/build_huts.py` (new), `public/assets/models/rescue-huts.glb` (362 KB, 8,672 triangles in all: 12 huts of 430 to 1,060, a door, a bar, a captive bust), `art/previews/rescue-huts.webp` | The models, original, in the game's toon style; fetched on demand only |
| `src/game.mjs` | `rescued: {}`, `rescuedPerk: {}` in `freshState`; `parseSave` cleans both (old saves load as `{}`); actions `hut`, `perk`; `civicPerk` in `civic`; `answerBonus` in `answer` |
| `src/main.mjs` | one import; `v.huts` in `mapView`; the People panel's note; one line in `interaction()` (`type==='person' && world.rescueTalk?.(id)`); one `import('./rescue-view.mjs')` in boot |
| `src/minimap.mjs`, `src/world-sheet.mjs`, `src/world-map.mjs` | A little house on the minimap and the Map: grey roof = barred, gold = can be opened, green = rescued (`HUT_ROOF`); a tap on it in the Map names the person, role, state and the way; legend chip "Hut" |
| `src/region-banner.mjs` | "🏠 Tilly is held here" in the banner's detail line while somebody is held in the region (through `world.rescueHeld`) |
| `src/outfits.mjs` | `outfitOf` reads `p.wear` first (so a rescued worker is dressed by the facility code without a row in `W`) |
| `src/facility-interior.mjs` | THE ONE LINE (section 4) |
| `tests/rescued.test.mjs` (3 tests), `tests/rescue-browser.mjs` | Section 6 |

### Placement rule (computed and asserted like the den clearances)
`hutSpot(id)`: candidates on rings 9, 11 and 13 m from the den, the first one square to the line den to village (a friend cage stands on that line, 6.5 m from the den), then swinging out by 0.39 rad on alternate sides. The first candidate wins for which `hutClear` holds: in the den's own land; dry land clear of ponds, pools, vents, the nest, thorn walls, lamps and rails by the hut's radius (2 m) + 0.6 m (`landClear`); 8 m or more from every border; 10 m inside the world's edge; 14 m from every outpost; 14 m from every other den; 4.5 m from every cage; 5 m from the trail's centre line; no tree, rock or prop (`fieldTrees`) within its radius + 2.5 m. All twelve land on ring one (9.0 m from the den), inside the den's 16 m clearing, where no common creature is placed. Measured: borders 37.8 to 44.5 m away, trail 34.9 m or more. `tests/rescued.test.mjs` asserts every number.

### Hut states
`hutState(id, state)`: `hidden` whenever the box is shut; else `barred` until `state.defeated[boss]`, then `open`, then `rescued` once `state.rescued[id]` holds the day. Nothing re-locks. An empty hut stays as scenery (door open) while the box is open.

### Draw cost
A hut is exactly two meshes with one shared vertex-colour toon material and casts no shadow (its ground patch is modelled): the hut, and one mesh merged for its state (door, bar, captive bust repainted with the person's hair and shirt). So +2 draw calls for a land with its hut, by construction; the browser run asserts `meshes === 2 x built huts` and `shadows === 0`. Measured calls (least of six samples; creatures, birds and damage numbers move the count by more than the hut does) are in section 6. During the 3.4 s of the rescue the freed worker's avatar adds its six meshes, once.

## 4. The seam with `facility-talk`, and how to merge

- **The only edit in a facility file** is one line in `src/facility-interior.mjs`, where the people of a building are gathered:
  `occupants(plan, state, RESIDENTS, slotOf).concat(world.rescuedPosts?.(plan.id, state) ?? []).forEach(...)`.
  `world.rescuedPosts` is `rescued.mjs postsFor(planId, state)` (installed by `rescue-view.mjs`): `[{p, at: {x, z, rot}}]`, the same shape `occupants()` returns; `p` has `id, name, role, line, color, child: false, wear, rescued: true`. If `facility-talk` rewrote that line, re-apply the `.concat(...)` on whatever list of `{p, at}` it builds. Without the hook installed (a bare world, tests) the line adds nothing.
- **Posts** are in `PEOPLE[i].post` with `plan` (`school`, `hospital`, `police`, `supermarket`, `company`, `bakery`). A node test holds each post inside a room and 1.2 m from every `plan.staff` spot of main. If `facility-talk` adds staff or pieces on a post, move the post in `src/rescued.mjs` `ROWS` (x, z, rot).
- **Talking.** A facility person target has type `person`; main.mjs sends that to the residents' talk panel, which does not know these ids. One line before it in `interaction()` asks `world.rescueTalk?.(id)` first. If `facility-talk` rewrites the `person` branch, keep that check ahead of it (or call `world.rescueTalk(id)` from its own dispatcher).
- **Their conversations in the facility-talk system.** `rescue-view.mjs talk(id)` calls `world.facilityTalk.open({id, person, nodes, start: 'root', effect})` when that function exists, else it shows its own small panel (`#rescue-talk`). `nodes` is `TALK[id]` in the node shape above; `effect('perk')` runs the daily favour and returns the game's `{ok, message}`. **The name `world.facilityTalk.open` and its argument are my guess**: when `facility-talk` lands, point that one call at its real entry (one line), or delete the fallback panel. `end: true` on a choice means "close".
- **Likely conflicts**: `src/main.mjs` (the `interaction()` lines round `person`; the People panel line), `src/game.mjs` (`freshState`, `ACTIONS`, `parseSave` one-liners: keep both sides' fields), `src/i18n.mjs` and `src/vi-names.mjs` (keep both rows), `src/facility-interior.mjs` (the one line). Then `node scripts/build.mjs`, `npm test`, `node scripts/vi-coverage.mjs`, `tests/rescue-browser.mjs`, `tests/facilities-browser.mjs`.

## 5. Save
`state.rescued = {id: day rescued}`, `state.rescuedPerk = {id: day the favour was last asked}`; both default `{}`; `parseRescued` keeps only the 12 ids with a finite day of 1 or more. Old saves load with nobody rescued. A rescue is never lost: shutting the box hides the huts and keeps the people.

## 6. Tests and numbers

Light testing only, as asked. Browser suites on my own port 4821 (`node scripts/serve-dist.mjs dist 4821`, stopped by PID), GPU Chrome.

| Check | Result |
|---|---|
| `npm test` | **523 of 523 pass** (520 on main + the 3 new ones in `tests/rescued.test.mjs`: hut clearances; every person has a post, a hut in the GLB, an unlock, an outfit of their own, a conversation and Vietnamese; an old save loads, a rescue is kept, shows at the facility and gives its perk once a day) |
| `node scripts/build.mjs` | **1,077,971 bytes** before the first frame (limit 1,100,000; 22,029 to spare; main at 29da6d3 is 1,068,044, so +9,927: `rescued.mjs` with its texts and the small hooks). Lazy: +13.5 KB of chunks and the 362 KB `rescue-huts.glb`, asked for only with the box open and a hut within 96 m |
| `node scripts/vi-coverage.mjs` | 2,235 strings found, **0 missing** |
| `tests/rescue-browser.mjs` (new; 1440x900 and 390x844; Tilly in the Mushroom Forest, Barnaby in Toybox Land, Greta in Frost Land) | **pass**, all 16 lines: the barred hut with its label and collider, the line a tap gives, the boss beaten with `willowmere.test.defeat(den)`, the hut opened by a tap, the thank-you bubble and toast, the save, the worker at the facility post, the conversation (story, answer, the daily favour and its second refusal), the People panel, the Map; then the box shut (no hut, no `rescue-huts.glb` request, no target; Tilly still at the school). One line is a note, not a pass by tap: on the phone Greta's post is outside the picture from the clinic door, so her panel was opened by the hook |
| Draw calls, a land with its hut (`willowmere.rescueCost()`: the same frame drawn twice, with and without the huts, both passes) | **+2 in all six cases**: desktop 89 to 91 (Mushroom Forest), 71 to 73 (Toybox), 81 to 83 (Frost); phone 67 to 69, 60 to 62, 63 to 65. Counting over time instead moved by -5 to +10 with creatures, birds and damage numbers, so the frame is drawn twice |
| `tests/prisons-browser.mjs` | **fails at line 199 on this branch and, the same way, on untouched main 29da6d3** (I built 29da6d3 in a temporary worktree, served it on 4822 and ran it; worktree removed). The step seeds a pre-ring position, (-148.5, 28.5), "beside the treant's den" (the den is at (-110.5, 51.5) since the ring world), so nobody knocks you out and it times out. Everything before it (locked cage, tap, open cage, rescue, following, Home) passes with the huts present |
| `tests/pandora-browser.mjs`, `tests/facilities-browser.mjs`, `tests/browser.mjs` | pass, once each, at commit 4614140 |
| `tests/maps-browser.mjs` | failed once on my legend chip (it reused the class `legend-cage`, and the suite counts those); passes with `legend-hut` |
| All 12 posts | on 1440x900 with all twelve rescued, a tap on each worker walks you there and opens their panel (a throw-away script; Greta's first post behind the pharmacy counter could not be reached and was moved to the pharmacy door) |

Not re-run after the last small edits (the hut label's text cached per state, the civic panel reading `civicPerk`, the `rescueCost` hook): pandora-browser, facilities-browser, browser. `npm test`'s last full run was before the `rescueCost` hook and the test-script edits; `rescued.test.mjs` and `actions.test.mjs` were run after.

Pictures: `cute_game-notes/willowmere/evidence-rescue/` (`rescue-<who>-1-barred`, `-2-open`, `-3-rescued`, `-4-post`, `-5-talk`, `rescue-people`, `rescue-map`, `rescue-shut-no-hut`, each `-desktop` / `-phone`; `rescue-all-<building>-desktop` with all twelve home). Looked at: Tilly barred, rescued, talk (desktop), open and talk (phone); Barnaby barred and rescued (desktop); Greta barred (phone) and at her post (desktop); People (phone); Map (desktop); the clinic, the supermarket and the office with everybody home; the Blender sheet of all twelve huts (`art/previews/rescue-huts.webp`). Not looked at: the other pictures, and the nine other huts in the game itself.

## 7. What is open

1. **The facility-talk hook is a guess.** `world.facilityTalk.open({id, person, nodes, start, effect})` does not exist anywhere yet; until that branch lands the workers speak through the fallback panel. One line to point at the real entry (section 4).
2. **A boss that has come back can stand on an open hut and take the tap.** The cages have a rule for this in `pandora-view.mjs` (`openCage`: an open cage wins the tap and the E key over the boss on it); the huts do not, because I did not edit that file. While its boss is alive a barred hut's tap can also land on the boss (seen in Toybox Land: the run then asks through a hook). Suggested: let `openCage` also accept targets of type `hut` whose `hutState` is `open`.
3. **`tests/prisons-browser.mjs` is red on main** (stale coordinates at line 199 and probably after); not fixed here.
4. **Nine huts were never seen in the game** (only in the Blender sheet): Dottie, Marlow, Gus, Mabel, Otis, Winnie, Edith, Felix, Nora. Their placement is asserted by the node test; their look on their own ground, and whether scenery cards or land effects sit oddly next to them, is not checked. 844x390 was not run. Vietnamese was checked by the coverage tool and the node test, not looked at in a browser.
5. The freed worker cheers for 3.4 s and vanishes in a puff: no walk home (the task allowed walk or teleport).
6. Workers are at their posts at all hours, stand still and have no collider; they are not in a household, and the People panel's title still says 24 residents. On a phone some posts (Greta's) are outside the picture from the door.
7. The patrol, shift and check-up toasts keep their base wording and add the perk as a suffix ("... Reward +40 coins · Gus walked the second round: +15 coins").
8. Greta's remedy lifts health to at least 100, not to the worn gear's maximum.
9. First load grew by 9.9 KB: the workers' lines, unlock texts and thank-yous are in `rescued.mjs` because the People panel and the actions read them. They could move behind `import()` if the margin (22 KB) is needed.
10. `rescue-huts.glb` is 362 KB for 8.7k triangles (flat shading, no quantisation): it could be about a third with indexed, quantised geometry.
11. The minimap's little house was drawn but not looked at closely; on the Map it is small next to a crown (it sits on the crown's left shoulder when the zoom cannot part them).
