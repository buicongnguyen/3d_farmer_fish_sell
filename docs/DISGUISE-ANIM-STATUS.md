# Disguise skills: how the hero moves (audit against Zoo Garden, and the fixes)

Branch `disguise-anim` (from origin/main 8f0aafe). Nothing pushed. Evidence: `cute_game-notes/willowmere/evidence-disguise-anim/`
(`before/` Willowmere, `before-zoo/` Zoo Garden at fdd3056, `after/` Willowmere, `tools/` the Playwright scripts). Each folder has one
contact sheet per disguise (`sheet-<id>.jpg`: rows = skills 1-4, 10 frames about 80-150 ms apart, the second half while walking) and `log.json`
(the hero's height and both leg angles at every frame).

## 1. What was wrong

* **Flight was a walk in the air.** `heroStep` added the flight height to `position.y` after the walk cycle had run, and nothing else changed:
  the body stayed upright and the legs kept the walk swing. Measured (before/log.json, superhero skill 1): height 1.8 m, legs swinging ±0.42 rad.
  The height was also *added* each frame to whatever the world had written, so with the world paused (a panel open) it kept adding up.
* **Every kit skill played the punch.** `cast4` looked for a `:` in the skill id (`dz_ninja0` has none), so all 64 kit skills fell back to the
  fist special: the punch sound and the sword-swing arm, whatever the skill. The kit's own sound and pose were never used.
* **The dash leaned the wrong way.** The lean was `rotation.x` with the default XYZ order, which tilts about the world's x axis: right when
  running north or south, sideways when running east or west.
* Helpers were spark pillars, the vanish was sparks, a sheep was a stunned creature with a white spark, the shield was a ring of sparks.

## 2. Audit (16 disguises x 4 skills)

Zoo column: what its code does to the hero's body (world.ts `animatePlayer`, flight-pose.ts, disguise-form.ts, `applyAvatarVisual`) and what it
draws (skill-visuals.ts, summon-art.ts). Zoo poses the body for few disguise skills: flight (superhero, fairy), the dash, giant size, bat form,
the vanish fade and the shield bubble; every other cast only shows its name and its effect. Verdict is for Willowmere *before*.
Sheets looked at: Zoo superhero, ninja, vampire, mecha, dino, fairy, pirate, snowman, mage, knight (its pirate run left the field after skill 1, and its uniform kits are other skills); Willowmere before superhero, ninja, vampire, mecha, fairy, pirate; after:
superhero, ninja, vampire, mecha, pirate, snowman, mage, dino, fairy, knight, usa, aodai_man, army. The other rows are from the code and the logs.

| Disguise | Skill | Zoo Garden | Willowmere before | Verdict | Now |
|---|---|---|---|---|---|
| Superhero | Take flight | 1.7 m up; hover: lean 0.18, arms a little out; moving: pitch 1.2 rad, arms ahead, legs together, head up; no walk cycle | lifted, upright, legs walking | **wrong pose, wrong motion** | fixed: glide level (pitch 1.2), right fist ahead, legs together and still, bob, bank into turns, shadow blob, trail; eased take-off and landing |
| | Meteor dive | blink 4 m, crater at 0.18 s; no pose | same, with a punch arm | ok (as Zoo) | better than Zoo: nose-down dive from the flying height (or a 1.4 m leap) to the ground in 0.18 s, landing squash |
| | Laser gaze | red beam meshes; head turns with the sweep | spark line; head still, punch arm | wrong pose | head sweeps with the beam (-0.6 to +0.6 rad in 1.2 s); beams still spark lines |
| | Boulder throw | rock mesh in an arc | falling sparks, punch arm | missing effect | overhead throw pose; the rock is still sparks |
| Shadow ninja | Shadow clones | 4 ninja models that walk and fight | 2 spark pillars | **missing effect** | Zoo's clone model (instanced), legs and arms swinging, facing its target; still 2 (gameplay unchanged) |
| | Vanish | materials at opacity 0.25 | sparks round a solid hero | **missing effect** | the hero's materials fade to 0.28 and come back exactly |
| | Shadow strike | blink behind, portals, arc | same, punch arm | ok | chop pose |
| | Smoke bomb | smoke puffs | ring and chips | ok (simpler look) | hands-together pose; the hero fades while hidden in the smoke |
| Archmage | Great fireball | charge glow, big fireball | charge sparks, sphere shot, punch arm | wrong pose | arms gather overhead 0.8 s, then thrust as the ball leaves |
| | Blink | portals | portals | ok | |
| | Sheep spell | the creature becomes a sheep model | stunned, a white spark | **missing effect** | sheep model in its place (the creature's own model is shrunk away), small hop |
| | Black hole | purple swirl disc | rings and sparks | ok (simpler look) | pointing pose |
| Sun knight | Raise shield | translucent dome | spark ring | missing effect | golden bubble while the shield lasts; guard pose |
| | Charge | dash pose (lean 0.55, arms back, one leg ahead) | lean about the world axis, legs walking | **wrong pose** | Zoo's dash pose, pitched about the hero's own axis (this also fixes the plain Dash skill) |
| | Challenge | rings | rings, punch arm | ok | roar pose |
| | Holy blade | falling blade mesh | falling sparks | ok (simpler look) | arms raised for the 0.8 s |
| Battle robot | Tank mode | treads and a barrel round the robot | sparks; legs walking | **missing effect, wrong motion** | treads and barrel (one mesh) follow the robot, legs still |
| | Tesla turret | turret model with a crackling orb | spark pillar | missing effect | Zoo's turret model, three arcs spinning round the orb |
| | Shock missiles | missiles | sphere shots | ok | both arms ahead |
| | Energy shield | dome | spark ring | missing effect | cyan bubble; guard pose |
| Tyrannosaur | Devour | bite marks | chips, arc | ok | lunge |
| | Tail sweep | arcs | arcs, punch arm | wrong motion | one whole turn in 0.4 s (ends facing where it began) |
| | Terrifying roar | rings | rings | ok | roar pose (lean in, arms back, head up) |
| | Giant form | scale 2 | scale 2 (eased) | ok | flex pose at the cast; size and ground height from one place |
| Flower fairy | Healing flowers | flower ring | ring, sparks | ok | arms raised |
| | Float | 1.7 m, upright hover pose, no walk cycle | lifted, legs walking | **wrong motion** | upright hover, legs together and still, bob, shadow blob |
| | Charm | hearts | hearts | ok | pointing pose |
| | Binding roots | a tree model (Zoo's skill is "Binding tree") | ring, chips | differs (kit) | place pose; no tree |
| Pirate captain | Cannon | cannon model | spark pillar | missing effect | Zoo's cannon model, turning to its target |
| | Hook | rope line | spark line | ok | arm thrust |
| | Scout parrot | a parrot that flies and pecks for 8 s | a ring; marks at once | missing effect | a parrot circles you for the 8 s of the marks, wings flapping (looks only: the marks are still instant) |
| | Cannon rain | falling balls, blasts | falling sparks, blasts | ok | pointing pose |
| Vampire | Life drain | pink beam | spark line | ok | both arms held out for the 2.3 s |
| | Bat form | the hero is hidden, four bats circle | sparks round the hero | **missing effect** | the body shrinks away and four bats circle (0.8 m ring, Zoo's numbers), then it grows back |
| | Bat swarm | five bat models | five dark sparks | missing effect | five bats with flapping wings |
| | Blood moon | red ring | ring | ok | arms raised |
| Snowman | Rolling snowball | growing ball mesh | growing sphere | ok | bowling pose |
| | Snow decoy | snowman model | spark pillar | missing effect | Zoo's snowman model |
| | Ice rink | white disc | ring, chips | ok (simpler look) | place pose |
| | Ice age | frost | ring, chips | ok | arms raised |
| Army | Rifle volley / Sentry turret / Smoke screen / Guided rockets | Zoo's kit is different now (popgun, sandbag wall, flare, supply drop) | weapon-special look; spark pillar; ring; spheres | turret: missing effect | turret model; fade in the smoke; both arms ahead for the rockets |
| Navy | Anchor swing / Grappling hook / Cannon barrage / Wave fan | different kit (wave ride, whistle, lighthouse) | as the specials | ok | hook and barrage poses |
| Ao dai | Lotus / Silk ribbons / Charm / Starfall | different kit (ribbon glide, paper fan, lanterns) | as the specials | ok | chop for the ribbons, pointing for the charm |
| Ao dai gown | Dragon fan / Dragon breath / Charge / Thunder chain | different kit (kite, ink circle, dragon dance) | charge: wrong pose | **wrong pose** (charge) | dash pose; roar pose for the breath |
| Stars and stripes | Eagle strike / Raise shield / Field cannon / Thorn nova | different kit (star shield, torch, fireworks) | spark ring; spark pillar | missing effect | bubble; cannon model; the eagle's rush uses the dash pose |
| Golden star flag | Golden star burst / Bamboo roots / Holy strike / Inferno ring | different kit (bamboo vault, drum, great star) | as the specials | ok | place pose, arms raised |

## 3. What was fixed, and how

* **`src/disguise-pose.mjs`** (new, lazy, pure: no three.js): the skill-pose layer. `poseStep()` runs once a frame after `World.frame` has walked the
  hero (from `CombatFx.update` -> `trail`, inside `room.onFrame`, before the picture) and writes the limbs, the head, the body's pitch and bank,
  the scale and the height **absolutely**. So the legs cannot walk in the air, and the height cannot depend on the order of the frame: it is
  `ground + FLIGHT.height * ease`, where the ground is whatever the world last wrote (kept while the world is paused).
  Numbers are Zoo's: flight 1.7 m, glide pitch 1.2, hover 0.18, arms -2.95, legs 0.08, head -1.05; dash lean 0.55 with arms 1.2 and legs 0.8 / -0.4;
  giant x2; landing squash 0.18 / 0.22. `CAST` gives each kit skill a short pose (15 kinds: up, guard, sign, place, point, both, throw, gather,
  chop, flex, roar, lunge, turn, bowl, gaze). `release()` puts back exactly what the world never rewrites (rotation order, pitch, bank, scale, head,
  limb splay) the moment no pose is on, or at once when the hero may not be posed: indoors, riding (the seat keeps the body), the box shut or a
  knock-out (`fx.clear()` now also cuts the pose). A new avatar (wardrobe) simply starts clean.
* **`src/disguise-models.mjs`** (new, lazy): everything built on the first kit cast and reused. One `InstancedMesh` per helper kind (clone, turret,
  cannon, bat, parrot, snow decoy, sheep: Zoo's summon-art.ts shapes baked into one vertex-coloured geometry each), one of boxes for all limbs,
  parrot wings and turret arcs, one of wings for all bats; the tank treads, the shield bubble and the shadow blob are one mesh each. Hidden when
  unused, so a helper kind costs one draw only while it is out (all nine bats: two draws). No allocation per frame; the vanish swaps the
  hero's materials for cached faded copies and swaps the originals back.
* `skill-looks.mjs`: `cast4` reads the kit id correctly (kit sound and pose at last), asks the pose layer, and wraps `clear()`.
  `disguise-looks.mjs`: `heroStep`, the hero's height / size and the `a_*` spark pillars are gone (fewer sparks); the aura sparks stay for
  armour and blood moon only. `disguise-skills.mjs`: helpers remember when they appeared and where they face; the parrot is a looks-only helper.
  `wilds-draw.mjs`: a creature under the sheep spell is shrunk away.
* Phones and the governor: the flight trail is halved with `fx.thin`; the models are a handful of draws and are not thinned.
* Gameplay numbers (damage, cooldowns, durations, counts) are untouched.

**Superhero flight after** (after/sheet-superhero.jpg, superhero-1-04.jpg, superhero-1-08.jpg, log.json): standing still it hovers upright with
the arms a little out and the legs together; walking, the body lies level, head first, arms ahead, legs straight behind and together, a row of
trail sparks behind and a round shadow on the ground under it. Height: 0.9 m in the first frame, 1.6 m after half a second, then 1.6-1.8 m; both leg angles are 0.08 in every frame
(before: swinging to ±0.42). After landing: height 0.006, legs 0, the same as before the cast.

## 4. What still differs from Zoo, and why

* Zoo's six uniform kits were replaced after the first port (popgun, sandbag wall, lighthouse, kite, drum...); Willowmere keeps the kits it has.
  Porting them is new gameplay, not animation.
* Clones: Zoo makes 4 and they have hit points; here 2, as before (a gameplay number). They are Zoo's ninja model, not copies of the hero.
* The parrot only looks like a helper: Willowmere's skill marks at once. The fairy has roots, not Zoo's tree.
* Shots and beams are still spheres and spark lines (laser gaze, boulder, holy blade, snowball, missiles): Zoo paints them with its instanced
  shape painter, which Willowmere does not have. Smoke, black hole and ice rink are rings and chips for the same reason.
* Zoo's shield is a checkered dome; here a plain translucent bubble. Zoo's helpers shrink as they lose hit points; here they have none.
* Flight: one fist ahead (the right) instead of both; pitch is Zoo's 1.2 rad (69 degrees), not 80.
* The after sheets were taken before one last tweak (a cast in the air bends the body half as far; fairy row 4 leans less now).
* Not checked in a browser: the cut on a knock-out, on entering a house, on mounting a vehicle and on going Home (covered by the node test
  with `ok = false`, not looked at); drain, charm, devour and hook next to a live creature (they did not fire in the sheets when nothing was in
  reach); the sheep was looked at once (after/probe-desktop-mage-3-*.jpg). Statuses still run while riding (creatures ignore a driver anyway).
* The armour / giant share of lava and fire rain, and the disguises' own basic weapons, are as open as before (DISGUISE-SKILLS-STATUS.md 5).

## 5. Shared-file touches

`src/pandora-view.mjs`: one statement, `fx.world = world;` (the lazy pose layer finds the hero and Combat through it). `src/wilds-draw.mjs`
(lazy): one line for the sheep. Everything else is in the kit's own lazy files. If main changes `cast()` in pandora-view: a kit cast that the pose
layer handles answers `'a'`, which the caller treats as a 0.35 s aim; the layer overrides that arm.

## 6. Tests and size

* `npm test`: 518 pass, 0 fail. Two new tiny tests (tests/disguise-pose.test.mjs): the flight pose holds one height with still legs, does not
  add up while the world is paused, and landing gives back the standing body exactly; every one of the 42 skill poses, run out or cut short,
  gives back the standing body exactly.
* `tests/pandora-browser.mjs` and `tests/browser.mjs`, GPU Chrome, port 4761: both exit 0, `errors: []`.
* Sequences of all 16 x 4 skills before and after, no page errors; phone 390x844 looked at for the flight (after/probe-phone-superhero-*.jpg).
* First load: 1,068,044 bytes, the same as main (limit 1,100,000, 31,956 to spare). The new code (27 KB of source) is in the box chunk.
  (A first try used `SphereGeometry`, which nothing else in the game uses, and cost 1,188 bytes of first load through the three.js chunk:
  the spheres are icosahedra now.)
* Draw calls, phone, box open: idle 48; peak 72-75 during flight and dive with creatures walking in (the earlier port measured 72-77 at the same spot).
