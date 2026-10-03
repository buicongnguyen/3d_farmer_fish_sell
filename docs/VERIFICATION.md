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

## Mirror, wardrobe and house life update

Ported from `cute_game` (analysis: `cute_game-notes/willowmere/HOUSE-ANALYSIS.md`): the modular hero (ten bodies, ears, tails, twelve animal hoods), 65 pieces of gear, the mirror's character builder, the wardrobe, energy-restoring things to use at home, a family that walks between rooms and talks, and menus docked to the right on PC.

* **61 unit tests pass** (`npm test`). The 25 new ones cover the gear table (every piece has an icon and a model in its kit file), `gearStats` and `weaponOf`, buying, wearing and taking off, save round trips and migration of the old `body` field to a look, look prices and ownership, gear fit per height, the avatar built from the real GLB files (six meshes, gear merged into the parts, a hat tucking the hood away, every height standing on the floor), the wardrobe, atelier, mirror and basket markup, house activities and cooldowns, the collection log, the spot kept free for the Pandora box, hangout reachability through the doorways, talk lines and the walk cycle.
* **`tests/house-browser.mjs` passes** (`npm run test:house`, SwiftShader and GPU): home targets; pointer cursor on hover; the mirror docked with no dimming, a live preview, a look tried, bought with coins and recombined for free; the wardrobe's groups, try-on, wear and take-off; sofa and tea restoring energy with a cooldown; the collection log; June or Pip walking to another hangout; docked menus outdoors; the atelier's gear tab (65 pieces, try on, buy, saved across a reload); and at 390×844 and 844×390 the mirror and wardrobe as a short sheet / side sheet with no sideways scroll and every button a 44 px target.
* `tests/browser.mjs`, `tests/fields-browser.mjs` and `tests/release.mjs` pass unchanged. `tests/activities.mjs` passes on a GPU; under SwiftShader its timed village run does not finish in time, on this branch and on the commit before it alike.
* **Draw calls inside the furnished home** (tier 3, every furniture set, 1440×900, counting the shadow pass, which `renderer.info` leaves out): **142 before, 46 after** (main pass 75 → 27). Each person is now six meshes instead of twenty-two. With a hat, an outfit, boots, a sword and a pet on the player: 50. Geometries in memory 537 → 132. The opening village view: 128 → 96.
* Checked by eye at 1440×900, 390×844 and 844×390: home, mirror (try, buy), wardrobe (try, wear), atelier gear tab, docked basket, neighbours, map, journal, settings and help, a neighbour's house, a speech bubble, June on the sofa, and four looks outdoors with gear and a pet.

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
