# Fight skills: the fourth skill, the phone block, and the weapon specials

Branch `skills` (from origin/main b12e316). Nothing pushed. Evidence: `cute_game-notes/willowmere/evidence-skills/`
(`before/` Willowmere, `before-zoo/` Zoo Garden, `after/` Willowmere, `tools/` the Playwright scripts).

## 1. Comparison (Zoo Garden vs Willowmere before)

| | Zoo Garden | Willowmere before |
|---|---|---|
| Skill buttons | 4: Whirlwind, Dash, Ground slam, **special** (violet). Keys J K L ; (desktop), Space = attack | 3 (1 2 3) + F attack; ACT is the attack on phones |
| Phone portrait 390x844 | 2x2 block bottom right, 50 px (x 256-372, y 710-822) | shallow arc of 3, 52 px, above ACT |
| Phone landscape 844x390 | 2x2 block, 46 px | arc of 3, 48 px |
| Which skills | slots 1-3 are the same for every weapon; slot 4 = the weapon's `special` (16 weapon specials), a worn uniform (army, navy, aodai, aodai_man, usa, vietnam) replaces it, a disguise replaces all four | slots 1-3 only; every weapon had the same three, `special` in gear.mjs unused |
| Cooldown ring, key badge, name label | yes | yes (3) |
| Upgrades, level pip, info panel | skill-upgrades.ts (levels 0-5), skill-pip, tooltip + long-press tip | none (no XP in Willowmere, by design) |
| Sounds | skill-sounds.ts: a sound per special | one of punch / swing / whirl |

Per weapon (Zoo slot 4 = what Willowmere now casts; slots 1-3 are Whirlwind x0.55 x10 / Dash x1.7 / Slam x2.3 for all):

| Weapon(s) | Special | Cd | Damage / area | Effect |
|---|---|---|---|---|
| bare fist | Punch flurry | 6 | 6 x0.8, 1.8 m arc, 0.8 s | six punches, turning to the nearest creature |
| wood, candy sword | Crescent slash | 6 | x2.4, 3.8 m half circle | one wide slash, golden crescent |
| tusk sword | Tusk rush | 7 | x2, 10 m rush, untouchable | gore everything on the way |
| crystal, lava sword | Blade waves | 6 | 3 piercing waves x2, 12 m | |
| trident | Wave fan | 9 | 5 piercing waves x1.6, 13 m | |
| obsidian sword | Magma pillars | 8 | 5 pillars x1.5, r1.6, line 8.5 m | stun .5, lift |
| toy hammer | Giant bonk | 7 | x2.2 r3.6, stun 3 | |
| thunder hammer | Thunder chain | 9 | 6 targets within 10 m x2.4, stun 2 | bolts between them |
| moon scythe | Moon cyclone | 8 | 3 pulses x1.4 r4.4 | |
| pea blaster | Pea barrage | 8 | 14 peas x0.8 in 1 s | |
| bubble blaster | Bubble prison | 10 | x1.2, trapped 3 s, lift | big slow bubble |
| spike blaster | Thorn nova | 9 | 24 thorns x1.1, 8 m | |
| ice blaster | Blizzard | 9 | 24 shards x1, 9 m, frozen 1.5 s | |
| star bow | Starfall | 9 | 12 stars x1.1 r1.6 round the nearest | |
| fire staff | Inferno ring | 9 | 10 bursts x1.3 r1.8 on a 3.6 m ring | |
| rainbow blaster | Rainbow laser | 8 | 14 m beam x3, stun .4 | |
| army / navy / aodai / aodai_man / usa / vietnam outfit | Rifle volley / Anchor swing / Lotus petals (heals 8 %) / Dragon fan / Eagle strike / Golden star burst | 7-9 | as Zoo | replaces the weapon special while worn |

Mismatches found before: every weapon cast the same melee-style three skills (a bow, a staff and a hammer all
"Whirlwind"); no weapon-coloured skill, no skill sound per weapon, no fourth button anywhere.

## 2. What was ported or adapted

* `src/skills-special.mjs` (lazy, pure): the 22 specials with Zoo's numbers and wording (`SPECIAL_INFO`), cast through a fixed pool of
  48 delayed jobs and Combat's own pooled shots (pool 10 -> 32, each shot now has speed, radius, lift, pierce and a hit set).
  Uniform override (`UNIFORM_SPECIAL`), long tips ("Name · 7 s cooldown — what it does", the reference's `skillTip`).
* `src/skill-looks.mjs` (lazy): a look per special (crescent, surf, dragon, nova, blizzard, lotus, goldstar, anchor, magma, bonk, whirl,
  inferno, meteor, bolt, laser...) built from the existing pooled fx (instanced chips, glow sparks, instanced rings, slash arcs), density
  halved on phones, a governor step above 0 and battery quality; the glow **trail on the weapon's tip** (the 'weapon' group's far
  bounding-box corner) during melee casts; the hero pose per special (swing, aim, arms out); four new sounds (splash, pop, freeze, magic)
  and the reference's sound per special.
* `combat.mjs`: SKILLS has 4 entries (the tips moved out of the first load), cooldowns[4], `skill(3)` runs `special()`, a dash can carry its
  own power and speed (`dashing`), shots can pierce / lift / have their own speed.
* `combat-hud.mjs` / `-draw.mjs`: fourth button (violet), icon, name, aria-label and every button's title follow the special
  (`info()`); the knock-out panel text moved into the lazy half to pay for the new first-load code.
* `pandora-view.mjs` (shared file): host `special` and `heal`, `onEffect` kind `look`, `cast()` for slot 4, key 4, `hud.info()` per frame.
* Phone layout (`pandora.css`, `controls.css`): 2x2 block above ACT, as in the reference: special over ACT, Ground slam beside it, Dash and
  Whirlwind above. 390x844: 52 px buttons at x 246-362, y 598-714; 844x390: 46 px (was 48) at x 711-811, y 188-288: clear of the stick, ACT,
  the Home pill, the minimap (and its label) and the prompt pill (its max width was widened). Screenshots: `after/phone-*`, `after/landscape-*`.
* Vietnamese: "Special", "Wave fan", the eagle text, the knock-out sentence added to `vi-audit.mjs` (all other strings were already in
  `vi-reference.mjs` from Zoo); coverage test passes.
* Boss and titan rules: every blow goes through `host.hit` -> `wilds.hit`, so hard stuns only slow bosses and titans and lift is scaled.
  Targets are only the creatures, which never enter the ward, and the skills only cast beyond the village.

## 3. Numbers

* First-load bundle: 1,099,960 bytes (limit 1,100,000, 40 to spare; was 1,099,913). Lazy: 286,033 bytes.
* Draw calls, GPU Chrome, phone 390x844, box open at (150,30): idle 53; peak while no key pressed 77 (creatures walking in); peak during
  Blizzard / whirl / slam 72-75. A skill burst adds no draw call (the effects share the pooled instanced draws). Desktop idle 58.
* Node: `npm test` (all pass, one new test of the special table, the skill-table assertion widened to four).

## 4. Shared-file touches (Codex also edits main)

`src/combat.mjs`, `src/combat-hud.mjs`, `src/pandora-view.mjs` (4 small spots), `src/wilds-view.mjs` (shot mesh cap 48 -> 80),
`src/wilds-draw.mjs` (shot size per kind), `src/box-draw.mjs`, `src/combat-fx.mjs` (3 stubs), `src/combat-fx-draw.mjs` (trail call, 4
sounds), `src/pandora.css`, `src/controls.css`, `src/vi-audit.mjs`, `tests/pandora.test.mjs`, `tests/pandora-browser.mjs` (cooldowns [0,0,0,0]).

## 5. Still not matching

* Disguise kits (16 disguises x 4 own skills, buffs, allies, statuses) are not ported; a disguise is worn for looks only.
* Skill upgrades, level pip and the long-press tip panel (no XP here); tips are button titles (hover) only.
* Zoo draws crystals, petals and stars with its instanced painter; here shots are scaled coloured spheres plus sparks and rings.
* Whirlwind / Dash / Slam visuals are unchanged apart from the shared fx; weapon-tip trail only for swing-type specials.

## 6. Merge notes

Only additive besides the shared spots above. If main changed `SKILLS` consumers, keep `SKILLS[3]` and `cooldowns` of length 4.
New first-load code must stay lazy: the budget has 40 bytes left.
