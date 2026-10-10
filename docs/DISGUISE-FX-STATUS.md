# Disguise and skill effects: Zoo Garden's own shapes, summons and uniform kits

Branch `disguise-fx` (from origin/main 14a7787). Nothing pushed. Reference: Zoo Garden (`cute_game`) at fdd3056, the same owner, so its
code and models are reused directly. Evidence: `cute_game-notes/willowmere/evidence-disguise-fx/` (`after/` frame sequences and contact
sheets, `tools/` the Playwright scripts, `calls-*.json`, the two browser-suite logs). Zoo's side of the comparison is
`evidence-disguise-anim/before-zoo/` (same Zoo commit).

This round closes what `DISGUISE-ANIM-STATUS.md` section 4 listed as "still differs" and "not checked".

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

**Still differs from Zoo, and why**

* A shot is one baked model, taken at one moment of Zoo's own animation (`poseShot` at 0.37 s): Zoo's little per-part animations (a flame that flickers, smoke puffs behind a missile, a wobbling rainbow
  tail, flapping bat wings on the bat shot) are frozen; the whole shot still turns, spins, rolls or flickers as Zoo's does. Zoo's additive
  halo sprite and star sparkles round a shot, and the dark "ink" shell of beads and bubbles, are left out (each needs a material of its own).
* Zoo lights `mist` and `rock` with the scene; here their shading is baked into the vertices (one fixed light).
* Zoo's ground band under the gaze is a textured card with crisp rims; here a flat translucent red strip of the same size.
* No "electrified" mark on shocked creatures and no screen-edge pulse on a roar (both are Zoo HUD pieces).
* `zoo-looks.mjs` is Zoo's code as it is, and a few of its builders make a small colour array each call; the painter itself allocates nothing.

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
  knight's long sword...), whatever is worn under it. Differs: the hand still shows the worn weapon, and the walk-up distance of a tap
  on a creature still uses it (both are in first-load code).
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
