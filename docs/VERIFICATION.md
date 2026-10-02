# Verification · 2026-10-03

## Automated checks

* **17 unit tests passed**: roster and household counts; seed/harvest/trade economy; rejected transactions; watering and harvesting idempotency; orchard maturity; daily pen production; recipe ingredients and kitchen gates; meals; festival availability and reward limits; friendships and gifts; paid cosmetic ownership; all eight chapter rewards; save validation and storage failure; calendar and rain; country-market premium; fishing tiers; hunting/race limits; all upgrade tiers; energy recovery.
* **Desktop browser walkthrough passed** using Chrome with a 1440×960 viewport: fresh start; meet Ada using map/directory navigation; claim chapter one; plant, water, wait for actual crop growth and harvest; enter home; inventory; save and reload; fishing timing catch; sell one crop; adult outfit, child outfit and furniture purchases; cook soup inside the home; sleep; leave home.
* **390×844 touch emulation passed**: joystick movement; contextual controls; no document horizontal overflow; 24-person directory; graphics setting persistence. Screenshots were inspected. This is not a physical-device performance certification.
* **Activity walkthrough passed**: board and drive the jeep; travel through the east road; sell at the country-market premium; return home; board, drive and dismount the motorcycle; feed animals and collect eggs/milk; submit a cooked dish at harvest supper; finish the three-checkpoint run in order; enter and exit every one of the ten houses; export and import a portable save.
* Browser walkthroughs reported **zero JavaScript page errors and zero HTTP asset errors**.

## Visual and rendering checks

Inspected the title screen, fresh village, planted farm and pond, shops, furnished interior, vehicle/country area, festival and mobile screens. Corrected unlocked-bed visibility, fish-icon URLs, room wall decorations, source-model furniture offsets and stale interaction matrices after an interior rebuild.

The first village version measured **770 draw calls**. The same opening scene after combining static scenery, baking material groups on animated rigid character parts and limiting distant NPC shadows measured **289 draw calls**. A furnished home measured **105 calls**; the mobile Battery setting measured **102 calls** in the tested pond view. These are scene-dependent render counters from Three.js, not a claim about every camera position or device.

Crop sprites are generated from the original 3D crop models, while nearby actors, fish, homes and furniture remain 3D. Total copied runtime art/font files before bundling are approximately **3.85 MB**. Public build JavaScript is minified, and no source maps are produced.

## Reproduce

```sh
npm ci
npm test
npm run build
npm run dev
# In another terminal:
npm run test:browser
npm run test:activities
```

Screenshots and JSON reports are written to `test-results/`, which is intentionally excluded from Git and the website. The development server must be running for browser tests. Installed Chrome is used locally; Playwright Chromium is selected with `CI=1`.

## Scope and remaining device checks

This release contains the first eight-chapter family-story volume and continuing seasonal free play. Full generational aging/inheritance, a larger world, deeper branching NPC stories and expanded competitive festivals remain in the design roadmap. Vehicle parking positions reset to their initial village locations after a browser reload; vehicle ownership and unlocks persist. Closed-browser time is not simulated. Real-phone thermals, very old integrated GPUs and long-session economy tuning require further playtesting.

GitHub Actions and the actual public URL are verified separately during publication; the final handoff reports their observed status.
