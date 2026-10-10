# Disguise and skill effects: Zoo Garden's own shapes, summons and uniform kits

Branch `disguise-fx` (from origin/main 14a7787). Nothing pushed. Reference: Zoo Garden (`cute_game`) at fdd3056, the same owner, so its
code and models are reused directly. Evidence: `cute_game-notes/willowmere/evidence-disguise-fx/` (`after/` frame sequences and contact
sheets, `tools/` the Playwright scripts, `calls-*.json`, the two browser-suite logs). Zoo's side of the comparison is
`evidence-disguise-anim/before-zoo/` (same Zoo commit).

This round closes what `DISGUISE-ANIM-STATUS.md` section 4 listed as "still differs" and "not checked".

## 0. Round 2 (branch `disguise-fx2`, from origin/main 29da6d3): the differences section 1 listed, fixed

Nothing pushed. Zoo Garden at 229267e (its effect files are unchanged since fdd3056). Evidence: `cute_game-notes/willowmere/evidence-disguise-fx2/`
(`zoo-kits/`, `zoo-weapons/`, `wm-kits/`, `wm-weapons/`: frame sequences; `pairs-kits/`, `pairs-weapons/`: one sheet per kit and per weapon with
Zoo's row over Willowmere's row for every skill; `calls-*.json`; the two suite logs; `tools/`).

| # | Difference reported | Result |
|---|---|---|
| 1 | A shot was one frozen model | **Done.** Every shot is baked as its parts with Zoo's own animation numbers and posed per instance |
| 2 | No halo, no sparkles, no ink shell | **Done.** One additive instanced draw for halos, sparkles and the lighthouse beam; the ink shell is Zoo's back-face ball |
| 3 | No electrified mark, no screen pulse on a roar | **Done** (the mark rides over the creature: Willowmere has no health bar over creatures to put Zoo's ⚡ on) |
| 4 | The hand showed the worn weapon; tap-to-approach used its reach | **Done**, first load unchanged at 1,068,044 bytes |
| 5 | Mist and rock lit by one baked light; the gaze band a flat strip | **Done.** Lit by the scene's own sky and sun; the band is Zoo's card with its crisp rims |
| 6 | A few look builders made a small array per call | **Done.** No array, object or closure per call |
| 7 | Only two kits had been compared with Zoo | **Done**: all 16 kits and 17 weapons captured in both games, 30 of the 33 pair sheets looked at; one mismatch found and fixed (mist) |

**1. Parts.** `scripts/zoo/bake-entry.mjs` keeps every object Zoo animates (`userData.anim` of `shot-art-extra.ts`) as a part in that object's own
space, with its place, turn, size and Zoo's two animation numbers; `ZooPaint.anim()` is Zoo's `playAnims()` on those numbers, so per shot and per
frame: the bat's, parrot's and eagle's wings flap (phase by position, as in Zoo), the missile's and the wave's puffs drift back and shrink, the
flame cones of fire shots, the missile and the drain orb flicker, the fireball's flame ring and its embers swirl opposite ways, the rainbow's six
beads wobble, the star's two stars spin, the shuriken tumbles, the bolt zig-zags, the cannonball's fuse spark twinkles, the lighthouse's lamp
pulses. 30 animated parts in 84; parts with the same vertices share their texture rows (146 rows). Still two instanced draws for everything opaque
and translucent; fixed pools (1200 + 900 + 200 instances); the frame writes typed arrays only. Thinning: phones and governor step 1 drop every
second decoration (puffs, fuse spark) and the sparkles; step 2 and up drop all decorations, the halos and the turret's glow.
Also from Zoo's `animateSummon`: the tesla turret's core breathes, its blue glow flares and its arcs flicker; the cannon's fuse spark flickers.

**2. Halo, sparkles, ink.** The halo is Zoo's radial card as a 48-triangle disc with the same alpha stops, additive, 0.55, breathing 12 %;
sparkles are Zoo's four-point star, twinkling by Zoo's formula at the places Zoo puts them (star 2, shard, snowball, cork, cannonball 1 each).
The ink shell (bead, pea, bubble, snowball, cannonball, drain orb) is Zoo's ball at 1.22 x in `#25331f` 0.6, drawn in the translucent batch with
its front faces dropped in the fragment shader (no extra draw, no extra material). Zoo's summons have no halo and no ink.
Cost on a phone: +1 draw while a shot with a halo flies (below); kept on phones, dropped from governor step 2.

**3. Electrified, roar.** A `shock` burst (the tesla turret's volts, the shock missiles, tank mode) and the thunder chain's hit set `e.shock = 1.1 s`
(Zoo `SHOCK_MARK`) on every creature in the burst: a yellow bolt mark (Zoo's bolt outline, flickering white-hot) rides over it and small arcs
twitch on it, 7 a second as in Zoo. At most 32 creatures at once, no allocation. Looks only: no number changed.
The roar pulses the screen edges (Zoo's `screenPulse`, same CSS, made by the lazy chunk; skipped for reduced motion). The eagle strike pulses
too, in pale gold, because the list asked for it: **Zoo itself pulses only on the roar.**

**4. Hand and reach.** `playerWants` (avatar.mjs, first load) asks `world.kw?.(state)`; the lazy `skill-looks.mjs` fills it: while the box is open a
disguise holds the weapon model that fits its own attack (`KIT_HAND` in `disguise-kits.mjs`: mage and golden star the fire staff, robot the rainbow
blaster, army the pea popgun, navy the trident, pirate the spike blaster, snowman the ice blaster, ninja / knight / vampire / ao dai gown a sword,
fairy and ao dai the bubble blaster, stars and stripes the star bow; superhero and tyrannosaur bare hands). With the box shut the worn weapon is
back (checked in the browser: staff, sword, staff). `reachable()` and `drive()` in pandora-view.mjs ask `combat.host.weapon()`, which the lazy hook
already answers with the disguise's weapon, so a tap walks in to the disguise's reach and the swing arc takes its colour.
First load: +11 bytes for the two hooks, -11 by reusing one value in `playerWants`: **1,068,044 bytes, unchanged.**
Differs: Zoo keeps the worn weapon in the hand under a disguise (its disguises have no weapon model either); the models here are the nearest
existing ones, no new art.

**5. Light.** Zoo's `mist` and `rock` are Lambert materials; here the vertex shader lights them (and the boulder and the baked summons) with the
scene's own hemisphere and sun, read every frame (three's Lambert: colour x intensity / pi; both games use the same light values and no tone
mapping). Flat normals come from the triangle's three vertices in the shape texture, mist's from the sphere. Mist is single-sided as in Zoo.
The gaze band is Zoo's card as 12 triangles with its alpha stops (rims 1 / 0.95, fill 0.3 to 0.5), opacity 0.55; the scorch mark has Zoo's
two-stop fade.

**6. Allocation.** `scripts/hoist-zoo-looks.mjs` (run after the esbuild line in the header of `zoo-looks.mjs`) turns the 19 constant arrays
inside builders into module constants and rewrites the two other allocations (the whirl ring's result object, the star shield's `forEach`).

**7. Compared with Zoo.** Captured for all 16 kits (skills 1 to 4 and the basic attack) and all 17 weapons (special and basic attack) in both
games. Looked at side by side: all 16 kit sheets and 14 of the 17 weapon sheets (not opened: the wood, tusk and candy swords, whose specials are
the crescent and the gore, drawn with the game's own arc). Found and fixed: mist was drawn with both faces (twice
as dense; with real light also dark): smoke, blast puffs and bat form now read as Zoo's. Same shapes, colours and order in every pair looked at.
Could not be matched or compared, and why:
* Zoo's frames are 60 ms apart and Willowmere's 110 to 130 ms (each game's own capture loop), so timing was compared by eye only, not measured.
* In Zoo's captures the signal flare, supply drop, broadside, black hole, sheep spell and fireworks land outside the 640 x 460 crop or had no
  target; those rows show nothing on Zoo's side. Their builders are the same code.
* The plain melee swing arc is Willowmere's own (wider and more opaque than Zoo's); not part of this work.
* Zoo's light flash on a shock or a burn (`fx.flash`) has no counterpart in Willowmere's effects; the sparks, arcs and ring are there.
* Zoo shows ⚡ on the creature's health bar; Willowmere has no bar over creatures, so the mark floats over the creature.
* The turret, cannon, bat, parrot, snowman and sheep are still Willowmere's helper models (Zoo's numbers), the clones the hero's own copies.
* Creatures' own shots are still Willowmere's spheres (not on the list).

**Numbers.** GPU Chrome, phone 390x844, box open at (150, 30), mean / peak draw calls over the 2.2 s after each cast (`calls-before-phone.json`,
`calls-after-phone.json`); idle is noisy between runs (scenery in view):

| | idle before | idle after | before: skills 1-4 | after: skills 1-4 |
|---|---|---|---|---|
| Battle robot | 74 / 76 | 76 / 79 | 77/79, 77/81, 70/74, 71/72 | 80/82, 81/86, 67/79, 75/77 |
| Army | 71 / 74 | 65 / 76 | 72/73, 68/71, 69/71, 69/70 | 74/78, 69/71, 68/70, 67/70 |
| Archmage | 71 / 74 | 59 / 75 | 72/76, 66/68, 66/67, 70/71 | 76/81, 70/73, 66/71, 74/75 |
| Stars and stripes | 71 / 74 | 71 / 77 | 66/75, 70/72, 71/73, 73/74 | 69/78, 73/75, 71/76, 62/77 |
| Snowman | 71 / 74 | 74 / 77 | 72/74, 69/72, 70/70, 68/70 | 79/83, 70/72, 71/71, 69/71 |
| Pea blaster | 73 / 76 | 73 / 76 | 76/77, 79/86, 74/79, 71/75 | 76/77, 79/87, 74/79, 71/76 |
| Bubble blaster | 73 / 76 | 58 / 76 | 76/77, 78/85, 74/79, 69/73 | 59/77, 56/74, 59/76, 55/67 |
| Rainbow blaster | 74 / 77 | 74 / 77 | 77/78, 79/86, 75/80, 68/80 | 77/78, 79/87, 76/81, 68/80 |
| Star bow | 74 / 77 | 74 / 77 | 77/78, 79/86, 75/80, 69/79 | 77/78, 79/87, 75/80, 68/78 |

Weapons: +0 to +1 at the peak (the additive draw while a halo is out). Disguises: about +3 at rest and in a burst, which is the weapon now in
the hand (its meshes and their shadow pass: the same as wearing any weapon), plus the same +1. Highest peak 86 before, 87 after.

| | before | after |
|---|---|---|
| First load | 1,068,044 bytes | 1,068,044 bytes (limit 1,100,000) |
| The box chunk (lazy) | 159,236 bytes | 165,769 bytes |
| `zoo-shapes.bin` (fetched on first use) | 273,388 bytes, 53,186 gzipped | 284,516 bytes, 46,890 gzipped |

The shapes file holds more (parts, the halo, sparkle, band and mark shapes, animation numbers) but shared parts and plain colours compress
better. First-load files edited: `avatar.mjs` (the `world.kw` hook), `pandora-view.mjs` (three calls now ask the combat host for the weapon).

**Tests.** `npm test`: 522 pass, 0 fail (two new tiny tests in `tests/disguise-fx2.test.mjs`: the parts file, and the allocation-free builders
with the hand table). `tests/pandora-browser.mjs` and `tests/browser.mjs`, once each on port 4791 on the final build: exit 0, `errors: []`; the phone
block is where it was (52 px at 246-362, 598-714). To re-bake after a Zoo change: copy the three `.ts` files, `node scripts/bake-zoo-shapes.mjs`;
for the looks, the esbuild line in `zoo-looks.mjs` and `node scripts/hoist-zoo-looks.mjs`.

## 1. Zoo's shape painter (item 1): done

**What was reused**

| Zoo file | Here | How |
|---|---|---|
| `skill-visuals.ts` (58 looks) | `src/zoo-looks.mjs` | unchanged: types stripped by esbuild, no hand edits |
| `disguise-fx.ts` (painter, casts, hex dome) | `src/zoo-paint.mjs` | ported: same `put()`, same cast rules, the dome material verbatim |
| `skill-fx.ts` (laser gaze, bolts, crackling shots, scorch marks) | `src/zoo-paint.mjs` | ported with the same numbers |
| `ribbons.ts` | `src/zoo-paint.mjs` | the same shader, one batch instead of two |
| `boulder-fx.ts`, `combat-view.ts` shot posing | `src/zoo-paint.mjs` | ported |
| `shot-art.ts`, `shot-art-extra.ts`, `summon-art.ts` | `scripts/zoo/*.ts` (copies) | run as they are by `scripts/bake-zoo-shapes.mjs`; the result is `public/assets/models/zoo-shapes.bin` |

**How it is drawn.** Zoo keeps one `InstancedMesh` per shape (13) and a group of four to twelve meshes per shot. Here every shape and every
baked model is a row of one float texture (240 vertices a row: position and colour) and the vertex shader picks its row by
`gl_VertexID`. So everything opaque is **one** instanced draw and everything translucent a **second**, whatever a burst mixes. Two more
exist and are drawn only while in use: the hex dome (shields) and the ribbons (laser gaze, lightning). Fixed pools (48 casts, 8 lobs,
40 bolts, 48 scorch marks, 1000 + 800 instances); the frame writes into typed arrays and uploads only the used range.
The shapes file (273 KB, 52.7 KB gzipped, 8,942 triangles: 13 shapes, 24 shot looks, tree, lighthouse, sandbag wall, scorch) is fetched
when the fight effects first run; until it is there the old spark looks draw.

**What now uses it**

* Kit skills: every look of the 16 kits (laser gaze from the eyes with its ground band and scorch trail, boulder lob, holy blade, charge
  orb, portals, smoke, black hole, ice rink, ice age, freeze, binding roots, hearts, sheep puff, bats, blood moon, cannon rain, hook,
  drain, taunt, roar, lift, crater, dust, and the 17 uniform looks). The shield is Zoo's checkered dome.
* Shots: pea, bead, star, wave, dragon, ice shard, thorn, fire, fireball, bubble, arrow, rainbow, missile, boulder, snowball,
  cannonball, cork (24 looks baked from Zoo's `makeShot`). Electric shots crackle and burst with Zoo's bolts; shells burst with `blast`.
* The 16 weapon specials: surf, lotus, golden star, anchor, eagle, magma, bonk, moon cyclone (`whirl`), inferno, meteor and blast
  (starfall), bolt (thunder chain), rainbow laser. Thorn nova and blizzard are only their 24 thorns / shards, as in Zoo. Punch flurry,
  crescent and the bonk wind-up keep the slash arc (Zoo also draws those with its plain arc).
* The three base skills: Whirlwind is Zoo's pulsing ring round you for its 2.2 s, Dash its streak (`rush`), Slam its crater as it lands.

**Phones and the governor.** Density 1 / 0.5 (phone, battery quality, governor step 1) / 0.35 (step 2 and up) goes to Zoo's own `cnt()`,
which already draws 55 % of each look's authored pieces. Shock bolts and gaze sparks are thinned the same way. Shots are not thinned.

**Draw calls**, GPU Chrome, phone 390x844, box open at (150, 30), mean / peak over the 2.2 s after each cast (`calls-before-phone.json`,
`calls-after-phone.json`; the peaks of skill 2 are the dash moving the view):

| | idle | before: skills 1-4 | after: skills 1-4 |
|---|---|---|---|
| Superhero | 71 / 74 | 73/74, 74/80, 70/71, 70/73 | 73/74, 74/79, 72/73, 70/73 |
| Archmage | 71 / 74 | 72/74, 76/81, 70/72, 66/75 | 73/77, 67/69, 67/68, 71/72 |
| Battle robot | 73 / 76 | 76/78, 76/79, 70/73, 71/73 | 77/79, 77/81, 69/73, 70/71 |
| Snowman | 71 / 74 | 72/74, 69/72, 70/70, 68/70 | 72/74, 69/72, 70/70, 68/70 |
| Pirate | 71 / 74 | 73/78, 67/70, 69/71, 70/71 | 73/74, 68/72, 68/69, 68/70 |
| Sun knight | 71 / 74 | 73/74, 78/86, 68/76, 63/68 | 68/75, 71/84, 64/71, 63/65 |
| Ice blaster | 74 / 77 | 76/77, 79/86, 74/78, 71/77 | 77/78, 79/87, 75/80, 70/76 |
| Fire staff | 74 / 77 | 76/77, 79/86, 74/78, 70/75 | 76/78, 79/87, 75/80, 70/75 |
| Spike blaster | 73 / 76 | 74/76, 79/85, 74/78, 71/77 | 76/77, 79/85, 73/80, 68/75 |
| Trident | 73 / 76 | 75/76, 77/84, 73/77, 70/75 | 76/77, 77/83, 74/79, 64/75 |
| Rainbow blaster | 74 / 77 | 76/77, 79/86, 74/78, 68/78 | 76/78, 79/86, 76/81, 68/81 |

Highest peak over these eleven: 86 before, 87 after. A burst costs at most the painter's two draws (plus the dome or the ribbons while
one is out) and saves the old shot-sphere draw: +0 to +2. New this round, no "before": ninja 76/78, 72/75, 78/91, 62/67 (the 91 is the
shadow strike's blink with four clones out); army 71/73, 57/71, 59/71, 66/70; ao dai 67/75, 73/84, 68/70, 65/70.

**Still differs from Zoo, and why**: the five points listed here after round 1 (frozen shots without halo and ink, baked light on mist and rock,
the flat gaze band, no electrified mark and no roar pulse, arrays made per call) are closed in round 2: see section 0, which also lists what is left.

## 2. Clones (item 2): done

Four, in Zoo's ring (1.6 m, a quarter turn apart), 8 s, each hit x0.5 every 0.45 s within 1.4 m, never more than 6 m from you, back to
your side when nothing is in reach, a new cast replaces the old ones. Each has 25 % of your full health; creatures within 8 m of a clone
go for it instead of you, and it vanishes in a puff at 0.

They are **translucent copies of the hero as it looks now** (any look, disguise, hat, weapon in hand): the live avatar the avatar builder
made is baked once per avatar into five vertex-coloured geometries (body with head, and each limb about its own joint, so legs and arms
still swing), tinted 30 % towards the shadow violet, opacity 0.62. Five instanced draws for all four clones (four real avatars would be
forty-odd). The bake is kept until the avatar changes (wardrobe, a new look). Differs: Zoo's clones are its small ninja model.

## 3. Behaviour (item 3): done

All through the existing hit path (`Combat.damage` -> `host.hit`): a boss or a titan is only slowed by any status; creatures only; never
inside the ward. No creature code and no first-load file was edited: `hook()` (lazy) wraps the creatures' own `life()` and the hosts'
`hurt` / `hurtShare` / `weapon`, so a creature is handed a summon (or the spot where you vanished) as its target and walks, winds up and
strikes exactly as it does at you.

* **Hittable summons** (Zoo `SUMMON_HP`): clone 25 %, snow decoy 60 %, binding tree 80 %, cannon 50 %, tesla turret 45 %, sandbag wall
  90 % of your full health. Decoys (clones, snowman) draw every creature within 8 m; the others are attacked when they are nearer than
  you. A blow meant for a summon lands on the summon; creatures' shots that reach one hurt it. Each shows Zoo's little health bar, sinks
  and shrinks as it weakens, jolts when struck, and ends as in Zoo (puff; the snowman bursts x2.5 within 4 m and freezes 2 s; dust).
* **Parrot**: a real scout for 8 s. It flies (7 m/s) to the nearest creature within 13 m, pecks x0.4 every 0.6 s, each peck marks its
  target for 8 s (+50 % damage taken), and it comes back to you when nothing is in reach. The old "mark everything at once" is gone.
* **Fairy**: Zoo's binding tree, 3 m ahead for 6 s: roots hold everything within 5 m for 4 s, it lashes one creature a second for x0.8,
  and creatures may attack it. Zoo's tree model. Charm now needs a target within 12 m (no wasted cooldown).
* **Sheep**: Zoo's polymorph. The nearest creature within 12 m and up to two more within 3 m of it, 6 s. A sheep keeps walking (slowly)
  and its blows do nothing; when the spell ends it is itself again in a puff. Before, it stood stunned.
* **Hidden** is a real fade and creatures really lose you: they go on looking at the spot where you vanished and strike at nothing.
  You are no longer simply untouchable while hidden. (No target at all would send them home to heal, so they get the spot instead.)
  Bosses and titans still see you. As in Zoo, any hit (also a clone's) ends the vanish.
* **Defence**: Zoo's bonuses (giant 20, tank 30, sandbag cover 60, challenge 80) go into the same formula as armour,
  damage x 60 / (defence + 60), and now also soften the lands' own damage: lava, fire rain, poison, thorns (`hurtShare`, `hurtFraction`).
* **Own weapon**: a disguise fights with its own basic attack (Zoo `DISGUISES[id].weapon`: the mage's fireballs, the robot's volts, the
  knight's long sword...), whatever is worn under it. Round 2: the hand shows that weapon and a tap walks in to its reach (section 0, item 4).
* Also ported with the kits: Zoo's haste (flight +35 %, vanish +30 %, tank +80 %, bats +100 %, float +25 %, ice rink +50 %, ribbon +30 %,
  kite +30 %), the knight's shield as Zoo's block (blows from in front are stopped, shots fly back for x1.5), the laser gaze as one
  continuous 1.8 rad sweep with a 0.25 s re-hit, the great fireball's numbers, the broadside's, cannon and turret rates.

## 4. Uniform kits (item 4): done

Zoo's current six kits replace the older ones, with its names, icons, cooldowns, texts and numbers (`DZ` in `disguise-skills.mjs` is
Zoo's table):

| Uniform | 1 | 2 | 3 | 4 |
|---|---|---|---|---|
| Army | Cork popgun (5 corks) | Sandbag wall (cover, hittable) | Signal flare (dazzle 4 s, mark 6 s) | Supply drop (5 crates, heal 15 %) |
| Navy | Anchor swing | Wave ride (9.1 m rush) | Bosun's whistle (stun 2.5 s, 8 m) | Lighthouse beam (sweeping, 6 s) |
| Ao dai | Lotus petals | Silk ribbon glide | Paper fan breeze (100 degree gust) | Lantern festival (8 lanterns) |
| Ao dai gown | Dragon fan | Kite glide (5 s flight) | Ink circle (hold 3 s) | Dragon dance (5 s) |
| Stars and stripes | Eagle strike | Star shield (3 s, bash) | Liberty torch (+30 % damage) | Fireworks finale (10) |
| Golden star flag | Golden star burst | Bamboo vault | Bronze drum (3 beats) | Great golden star |

Models: sandbag wall, lighthouse (with its beam) and the cork are Zoo's, baked; everything else is Zoo's painter looks. Poses: each new
skill has one of the existing 15 pose kinds (`disguise-pose.mjs` `CAST`); the kite uses the upright float, the rushes the dash pose.
Vietnamese: all names, texts and short names are in `vi-audit.mjs` (72 lines, Zoo's own translations from `locales/vi-skills.ts` and
`vi-catalog.ts`); `node scripts/vi-coverage.mjs`: 1958 found, 0 missing. The plain uniforms' rifle volley now shoots corks, as in Zoo.

## 5. Checked in a real browser (item 5): done, one thing fixed

`after/checks/` (`checks.json` and a screenshot per step), GPU Chrome:

| Case | Before the cut | After | Result |
|---|---|---|---|
| Knock-out in giant form | scale 1.756, pose on | at home, scale 0.88, upright, no status left | ok |
| A house door while flying | 1.66 m up, pitched 1.2 | on the floor, upright, pose off | ok |
| A car seat while flying | 1.67 m up, pitched 1.2 | seated in the jeep, no pitch | ok |
| Home while flying | hovering during the charge | in the village, standing, no status left | ok |

Fixed: the flight (and bat form) went on counting behind a door or in a seat, so you stepped back out in mid-air. A door or a seat now
lands you. Drain, Charm, Devour and Hook with creatures set in reach (`after/reach/sheet-reach.jpg`, test hook `near`): all four fire and
look right; so does the parrot. A glitch seen on the way and fixed: a creature that had healed on its way home showed its last blow as
`14.549999999999898`; the number is whole now.

## 6. Numbers

* First load: **1,068,044 bytes, unchanged** (limit 1,100,000, 31,956 to spare). A first build was 346 bytes over the old number (three.js'
  `InstancedBufferGeometry` and two constants are not in the first load); the ribbons are an `InstancedMesh` now.
* Lazy: the box chunk 84,970 -> 159,236 bytes; the Vietnamese pack +9.6 KB; the shapes file 273,384 bytes on first use.
* Shared (first-load) files: none edited. Lazy files of others: `wilds-draw.mjs` (one condition: spheres only until the shapes are here),
  `test-hook.mjs` (hooks `near`, `fight`, `hurt`, `house`, `leave`, `board`, `dismount`, `home`: test mode only).

## 7. Tests

* `npm test`: 520 pass, 0 fail. Two new tiny tests (`tests/disguise-fx.test.mjs`): every look a kit skill, a weapon special or a base skill
  asks for is one of Zoo's builders and paints at most 160 pieces of known shapes; summons take the creatures' blows, the hidden hero is
  lost, a sheep is harmless and comes back, armour softens the lands, a disguise uses its own weapon.
* `tests/pandora-browser.mjs`, GPU Chrome, port 4771: exit 0, `errors: []`; the phone block is where it was (52 px at 246-362, 598-714).
* `tests/browser.mjs`, GPU Chrome, port 4771: exit 0, `errors: []` (`evidence-disguise-fx/browser.log`). Both suites ran once, before the
  last two small changes (the shot-model lookup and the re-bake below); the frame sequences in `after/shots2/` were taken after them.
* Frame sequences looked at: all 16 kits x 4 skills, 14 weapons (ice blaster all four skills), a phone run, the reach probes, the four cuts.
  Compared with Zoo's sheets (same Zoo commit) for the army and the ao dai gown kits: the same shapes (Zoo's camera is closer).

## 8. Merge notes

`disguise-skills.mjs` and `disguise-kits.mjs` are rewritten in large parts; `skill-looks.mjs` keeps its old tables as the fallback.
If main changes how creatures think: `hook()` wraps `wilds.life(e, dt, target, region, player, awake)`, `wilds.hit` and the two host
callbacks by name. To re-bake the shapes after a Zoo change: copy the three `.ts` files again and run `node scripts/bake-zoo-shapes.mjs`.
