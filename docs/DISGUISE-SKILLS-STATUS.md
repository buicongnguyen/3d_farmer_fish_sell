# Disguise fight skills

Branch `disguise-skills` (from origin/main 8eb59b4). Nothing pushed.

## 1. Evaluation (before)
Every one of the 16 disguises (gear slot `wear`, `disguise:true`) was worn for looks only: the HUD showed Whirlwind / Dash / Ground slam plus the
weapon's special, the same for a ninja and a mage. Nothing to keep: no disguise had a kit. Checked in the browser for all 16 (box open at 150,30,
HUD names, cooldowns, no errors) before and after.

| Disguise | Zoo Garden skills 1-4 | Willowmere before | Willowmere now |
|---|---|---|---|
| Shadow ninja | clones, vanish, shadow strike, smoke bomb | weapon default | same as Zoo |
| Archmage | great fireball, blink, sheep spell, black hole | default | same |
| Sun knight | shield, charge, challenge, holy blade | default | same (challenge also pulls enemies in) |
| Battle robot | tank mode, tesla turret, shock missiles, energy shield | default | same |
| Tyrannosaur | devour, tail sweep, roar, giant form | default | same (giant: -25% damage taken) |
| Flower fairy | healing flowers, float, charm, binding roots | default | same |
| Pirate captain | cannon, hook, scout parrot, cannon rain | default | same |
| Superhero | take flight, meteor dive, laser gaze, boulder | default | same |
| Vampire | life drain, bat form, bat swarm, blood moon | default | same |
| Snowman | rolling snowball, decoy, ice rink, ice age | default | same |
| Army | rifle volley, sentry turret, smoke, guided rockets | default | same |
| Navy | anchor swing, hook, cannon barrage, wave fan | default | same |
| Ao dai | lotus, healing flowers, charm, starfall | default | **changed**: lotus, silk ribbons (new), charm, starfall |
| Ao dai gown | dragon fan, roar, charge, thunder chain | default | **changed**: dragon fan, dragon breath (new), charge, thunder chain |
| Stars and stripes | eagle, shield, field cannon, thorn nova | default | same |
| Golden star flag | gold star burst, roots, holy strike, inferno | default | same |

Judgement: Zoo's kits fit their names and look and are varied, so they were ported as they are. Two changes for variety: the ao dai kept Zoo's healing
flowers and charm, both already the fairy's, and the gown kept the dinosaur's roar, so they got a new skill each (silk ribbons: 5 piercing ribbons that tangle
0.6 s; dragon breath: a 9-burst fire cone with knock-back). Still shared on purpose: knight/gown charge, knight/vietnam holy, knight/usa shield, fairy/ao dai charm.
Disguise priority as Zoo: a disguise replaces all four skills (it also beats a weapon special and a uniform special).

## 2. What was added (all new code lazy, in the box chunk)
* `src/disguise-kits.mjs`: the 16 kits (name, icon, short name, cooldown, sound, hero pose, text) and `kitInfo()`.
* `src/disguise-skills.mjs`: Combat's disguise skills: pooled timed jobs (40) and allies (8), statuses on the player (shield, hidden, flight, bats,
  giant, armour, blood moon, tank) and on creatures (fear, blind, sheep, charm, taunt, mark, slow), homing rockets, growing snowball. Hits use Combat.damage -> host.hit
  (boss and titan control unchanged: a status only slows them). Only creatures are targets; the ward is never entered. Boss/titan: slow only.
* `src/disguise-looks.mjs`: 45 looks from the pooled fx (no draw call per burst), density halved on phones / governor; hero height (flying) and size (giant).
* Edits to lazy files: skills-special.mjs (specialOf, skillTip), skill-looks.mjs (look table, cast4, trail), combat-hud-draw.mjs (all four buttons follow the kit),
  box-draw.mjs (install), wilds-draw.mjs (snowball size), vi-audit.mjs (Vietnamese for every kit name and text).
* Colours: the disguise accent is in `KIT_COLOR`; each look has its own element colour.

## 3. Shared-file touches (first load)
`src/pandora-view.mjs`: cast() takes the kit pose path (`index === 3 || combat.kit`, branch order swapped) and onHurt passes `amount * (combat.taken ?? 1)` (armour, giant);
nothing else. `wilds-draw.mjs` (lazy). First-load bundle 1,099,968 bytes (was 1,099,960; limit 1,100,000, 32 to spare); lazy 312,230 bytes.

## 4. Tests
`npm test` 508 pass (one new tiny test: 16 kits x 4 skills, disguise replaces the special, no two kits equal). `tests/pandora-browser.mjs` and `tests/browser.mjs`
pass with no errors (GPU Chrome, port 4681). A throw-away smoke (not committed) cast all four skills for all 16 disguises: 0 errors, HUD names right,
draw calls 51-69. Phone 390x844 and 844x390 screenshots viewed: the 2x2 block fits and shows the kit icons and short names.

## 5. Open
* Zoo disguises also carry their own basic weapon (mage fireball gun, knight sword...); here the worn weapon is still used (gear.mjs weaponOf, first load).
* Hidden is shown as sparks, not a fade; sheep are stunned, not shrunk; flight height relies on the avatar frame order (checked visually only on a few).
* Armour/giant do not reduce lava / fire-rain shares (hurtFraction), only creature blows.
* Allies are drawn as spark pillars, not models.

## 6. Merge notes
Branch `slim` and Codex touch main.mjs/world.mjs imports; this branch touches neither. The two pandora-view.mjs spots are one line each. If main changes
`SKILLS`/`cast()`, keep `combat.kit` check first. New code must stay lazy (32 bytes spare).
