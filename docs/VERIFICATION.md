# Verification · 2026-10-03

## Automated checks

* **23 unit tests passed**: roster and household counts; seed/harvest/trade economy; rejected transactions; watering and harvesting idempotency; orchard maturity; daily pen production; recipe ingredients and kitchen gates; meals; festival availability and reward limits; friendships and gifts; paid cosmetic ownership; all eight chapter rewards; save validation and storage failure; calendar and rain; country-market premium; fishing tiers; hunting/race limits; all upgrade tiers; energy recovery.
* **Desktop browser walkthrough passed** using Chrome with a 1440×960 viewport: fresh start; meet Ada using map/directory navigation; claim chapter one; plant, water, wait for actual crop growth and harvest; enter home; inventory; save and reload; rod fishing catch with bite and tension; sell one crop; adult outfit, child outfit and furniture purchases; cook soup inside the home; sleep; leave home.
* **390×844 touch emulation passed**: joystick movement; contextual controls; no document horizontal overflow; 24-person directory; graphics setting persistence. Screenshots were inspected. This is not a physical-device performance certification.
* **Activity walkthrough passed**: board and drive the jeep; travel through the east road; sell at the country-market premium; return home; board, drive and dismount the motorcycle; feed animals and collect eggs/milk; submit a cooked dish at harvest supper; finish the three-checkpoint run in order; enter and exit every one of the ten houses; export and import a portable save.
* Browser walkthroughs reported **zero JavaScript page errors and zero HTTP asset errors**.

## Open-field and rod-fishing update

* The additional six unit tests cover deterministic sparse fields, village exclusion, distant save coordinates and validation, camera-relative home bearing, obstacle-free long routes, reference fishing bite/reel success, missed bites and slack-line failure.
* Field browser tests passed all eight movement directions outside the old bounds, section retirement (30 created / 5 released / 25 active), two loaded bird species with 14 birds, save/reload more than 2 km from home, 390-pixel mobile layout, and automatic walking back to the homestead. The terrain contains only grass and trees outside the existing village.
* Desktop and mobile pointer controls both landed a fish using the held rod, visible line/float, bite prompt and hold/release tension controls. A second cast could be cancelled with the line removed. Screenshots of desktop/mobile meadows and fishing were inspected.
* The measured field view used 72 draw calls on Balanced desktop and 51 on mobile Battery. These are sampled scene counters, not device frame-rate claims. Only 25 sections stay loaded while walking; field content is regenerated consistently when revisited.
* The two copied bird files add 100,064 bytes. The production JavaScript bundle is approximately 704 KB before transfer compression.

## The Pandora box (wild creatures and fights)

* **19 unit tests** (`tests/pandora.test.mjs`, 55 with the earlier suites): the Open / Close action and old-save defaults; nothing fought, dropped or lost while shut; creature facts against the reference; the seeded spawn plan (none inside the village ward, the rings by distance, one King Bear); creatures existing only while open and leaving within a third of a second when the box shuts; damage taken `amount × 60 / (defence + 60)` with gear and test mode; crit and spread of a blow; the gentle knock-out; healing at home, in the village and from food; coins, seeded loot and pick-ups; loot toss, magnet and 30 s lifetime; a creature noticing, winding up, striking and stopping at the ward; a driver left alone and far creatures resting; boar charge, cactus shot, snapping flower and King Bear slam; basic attacks by weapon kind; shot kinds, spread guns and a worn pet; the three skills and their cooldowns; knock-back never into the village, respawn; trees blocking creatures and pooled arrays reused.
* **Browser suite** `tests/pandora-browser.mjs` (Chrome, 1440×900, 390×844, 844×390): with the box shut no creature exists, `wild-creatures.glb` is never requested and no fight HUD shows; the chest is a target in your home, its panel switches the box, the chip and health meter appear, the stats strip shows in the panel, the bag and the wardrobe, and a reload keeps the box open; in the fields creatures stand only outside the ward; a tap targets a creature, the player walks in and fights, 1 / 2 / 3 start their cooldowns, the creature pays coins and loot reaches the basket; creatures ignore a driver and the skills dim; a knock-out wakes you at home 5 % of your coins lighter with the basket intact; shutting the box empties the fields; on both phone sizes the three skills are at least 44 px, on screen and clear of ACT, the joystick and the target frame. Zero page or HTTP errors.
* The earlier suites (`browser`, `activities`, `fields-browser`, `release`) pass against the same build with the box shut.
* **Draw calls** (GPU Chrome, Balanced, same spot, median of 180 frames; base is the commit before this feature): village 78 base / 79 shut / 81 open; near meadows (110, 0) 57 / 57 / 85 on desktop and 46 / 46 / 59 on a 390×844 phone; wild edge (300, 40) 51 / 51 / 75 and 53 / 53 / 71. Shut is the same scene as before (same geometries and textures). Game-loop JavaScript per frame: 0.7–0.8 ms shut, 0.9–1.1 ms open; with the CPU throttled 4×, 3.5 ms shut and 4.4–5.4 ms open. 25–52 creatures are loaded in the 5 × 5 cell window, 8–19 awake, and only those within the view are drawn.
* Filmstrips at 60 fps (whirlwind, dash, ground slam) show the first response 0–56 ms after the key and no stalled frames; screenshots of fights on the three viewports, the King Bear's slam disc, the ward, the chest shut and open and the knock-out card were inspected.
* `wild-creatures.glb` is 315 KB (nine of the reference's 26 creatures, 16,957 triangles), `pandora-box.glb` 72 KB (2,160 triangles). The JavaScript bundle grew from 754 KB to 825 KB.
* Not covered: a physical phone, sound (synthesised, checked only for errors), and gear worn from a shop (the gear and avatar modules are stubs until the wardrobe work lands).

## Visual and rendering checks

Inspected the title screen, fresh village, planted farm and pond, shops, furnished interior, vehicle/country area, festival and mobile screens. Corrected unlocked-bed visibility, fish-icon URLs, room wall decorations, source-model furniture offsets and stale interaction matrices after an interior rebuild.

The first village version measured **770 draw calls**, reduced to **289** in the initial release by combining static scenery, baking character material groups and limiting distant NPC shadows. With the added meadow sections and birds, the current opening measured **337 draw calls**. A furnished home measured **105 calls**, and the updated mobile Battery pond view measured **123 calls**. These are scene-dependent render counters from Three.js, not a claim about every camera position or device.

Crop sprites are generated from the original 3D crop models, while nearby actors, fish, homes and furniture remain 3D. Total copied runtime art/font files before bundling are approximately **3.95 MB**. Public build JavaScript is minified, and no source maps are produced.

## Reproduce

```sh
npm ci
npm test
npm run build
npm run dev
# In another terminal:
npm run test:browser
npm run test:activities
npm run test:fields
```

Screenshots and JSON reports are written to `test-results/`, which is intentionally excluded from Git and the website. The development server must be running for browser tests. Installed Chrome is used locally; Playwright Chromium is selected with `CI=1`.

## Scope and remaining device checks

This release contains the first eight-chapter family-story volume and continuing seasonal free play. Full generational aging/inheritance, deeper branching NPC stories and expanded competitive festivals remain in the design roadmap. Vehicle parking positions reset to their initial village locations after a browser reload; vehicle ownership and unlocks persist. Closed-browser time is not simulated. Real-phone thermals, very old integrated GPUs and long-session economy tuning require further playtesting.

GitHub Actions and the actual public URL are verified separately during publication; the final handoff reports their observed status.
