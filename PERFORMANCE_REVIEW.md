# Willowmere performance review — 2026-10-25

The local changes reduce repeated matrix calculations, buffer traffic and burst-particle draws while retaining the existing models, shadows, resolution, animation rates and controls. **An FPS improvement is not established. CPU timings sometimes leaned slower, so the work-count gains must not be advertised as a frame-rate gain.** Nothing was committed, pushed or deployed.

## Scope and baseline

Project: `3d_farmer_fish_sell`. Baseline HEAD: `9ca557bed3ebc6c36906e2eb84582aef23f4375b`, plus the local changes that were already present in controls.css, main.mjs, test-hook.mjs, vi-willowmere.mjs, world.mjs and the new jump.mjs. The saved baseline includes those changes; it is not a clean HEAD checkout. Existing jump/control work was preserved. References in the older game-building conversation were not modified.

Used the requested smooth-dense-scenes skill, found at `C:/Users/n/.claude/skills/smooth-dense-scenes/SKILL.md` (the supplied path omitted the separator before .claude), its CPU/buffer reference, render-probe and pixel-diff tools. Checked the installed Three.js **0.180.0** implementation of Object3D and WebGLAttributes before adapting the cache and update ranges.

## Measurement conditions

- Windows 11 Pro 10.0.26200; Intel Core i7-14700KF; NVIDIA GeForce RTX 4080 SUPER through ANGLE/D3D11. Google Chrome 155.0.8059.79, headless, real GPU (no SwiftShader); Node 26.7.0, Playwright 1.61.1, esbuild 0.28.2.
- Desktop: 1440×900, DPR 1, High quality, CPU ×1. Phone simulation: 390×844, device DPR 2, Balanced quality, actual WebGL buffer 585×1266 (render ratio 1.5), CPU ×4. Antialiasing remains enabled. This is **not a physical-phone GPU measurement**.
- Fresh isolated save per fixture; time 10; pen, farm and pond tier 3; seeded Math.random (71). Village starts at (0, −4), pond at its north bank. Effects adds 96 original opaque burst particles, advances 0.1 s, then captures. Crop fixtures plant and water 18 mature crops at (−15.5, −7).
- Warm assets, 180 simulation steps, then fixed cosmetic time 10. Main RAF stops only after the normal boot handshake. Frozen fixtures use dt=0, 30 samples. Moving fixtures hold D for 40 steps at 1/60 s. Extra crop measurements animate for 40 steps without moving the player; they have phone viewport/quality but **no CPU throttle**, so their CPU numbers are not compared with the main phone timing run.
- Counts wrap raw WebGL draws (including shadow passes), Matrix4.compose/multiplyMatrices, bufferSubData and bufferData. WebGL2 element offsets/lengths are converted to bytes. Shadow calls are separated through shadowMap.render; renderer.info alone would miss them. Counts are per rendered update, not FPS.
- CPU sampling removes all operation wrappers first, uses 100 RAF-spaced World.update calls and saves DevTools profiles. It includes simulation, scene work and synchronous renderer/driver submission, but excludes the outer main-loop HUD/save work and asynchronous GPU completion. No GPU timer-query or VRAM measurement was made.

## Bottlenecks and changes

1. **Repeated transforms:** roughly 1,100 local compositions and 1,400 matrix multiplications per frozen frame, over a 1,205-node village. New `transform-cache.mjs` caches position/quaternion/scale on live instances and registers subsequently added children. It preserves r180 force propagation, parent changes, direct updateMatrix/updateWorldMatrix, manual matrix ownership and hidden descendants. Cameras, lights, bones, skinned meshes and custom local/world updaters retain native behavior. The scene root is cached too, so an unchanged root does not invalidate everything. There is no engine-prototype patch or additional per-frame scene traversal. Cache records are weakly owned. The r180 traversal is version-sensitive and has an explicit upgrade guard test.
2. **Unconditional full-capacity uploads:** the frozen pond/village still submitted 13 buffer updates / 25,184 bytes each frame. New `buffer-updates.mjs` compares the already-rounded typed-array live prefix, merges a bounded dirty interval with pending unrendered ranges, and marks only changed attributes. Applied to pond fish/effects, outdoor fish, crop cards and the existing combat particle pools. Counts, culling and animation updates retain their old behavior; zero uploads in a frozen scene do not mean zero uploads during play. Crop atlas cells/ground can stay unchanged while crop bobbing updates its own data.
3. **One mesh per burst particle:** new `burst-pool.mjs` retains the same lit icosahedra, toon gradient, colors, sizes, trajectories, gravity and lifetime, but draws one InstancedMesh. It grows without dropping particles, compacts in stable order, reuses records, disposes replaced instance buffers and keeps shared geometry alive. Empty pools stop uploads; re-emission restores the live count. Existing combat pools keep their original visibility and lifecycle semantics.

The game already has scenery instancing, crop cards, shadow proxies, pooled fish, lazy assets and a quality governor. Those remain in place. Reducing shadow quality or simulation frequency was not justified by this review.

## Measured work

Frozen fixture medians. Upload values are bufferSubData bytes/frame; all optimized frozen fixtures have **0 uploads**, down from 13. Steady-state bufferData allocations are zero in both arms.

| Fixture | Total draws | Shadow draws | Compositions | Multiplications | Upload bytes |
|---|---:|---:|---:|---:|---:|
| Desktop / village | 158 → 158 | 45 → 45 | 1117 → 41 | 1419 → 218 | 25,184 → 0 |
| Desktop / pond | 154 → 154 | 45 → 45 | 1122 → 41 | 1420 → 214 | 25,184 → 0 |
| Desktop / effects | 254 → 159 | 45 → 45 | 1213 → 137 | 1611 → 219 | 25,184 → 0 |
| Phone / village | 128 → 128 | 38 → 38 | 1117 → 41 | 1389 → 188 | 25,184 → 0 |
| Phone / pond | 106 → 106 | 30 → 30 | 1122 → 41 | 1372 → 166 | 25,184 → 0 |
| Phone / effects | 225 → 130 | 38 → 38 | 1213 → 137 | 1582 → 190 | 25,184 → 0 |

The desktop burst contributes **96 → 1 draws**, saving 95 submissions without removing triangles. For example, desktop village has 273,403 triangles/frame in both versions; the burst has 281,083 in both. Shadows and their triangle counts are unchanged.

Moving fixture medians:

| Fixture | Total draws | Compositions | Multiplications | Upload calls | Upload bytes |
|---|---:|---:|---:|---:|---:|
| Desktop / village | 158 → 158 | 1117 → 100 | 1419 → 424 | 13 → 13 | 25,184 → 1,228 |
| Desktop / pond | 147 → 147 | 1122 → 100 | 1413 → 419 | 13 → 13 | 25,184 → 1,228 |
| Desktop / effects | 254 → 159 | 1213 → 197 | 1611 → 426 | 13 → 14 | 25,184 → 7,368 |
| Phone / village | 126 → 126 | 1117 → 100 | 1387 → 393 | 11 → 11 | 24,576 → 724 |
| Phone / pond | 104 → 104 | 1122 → 100 | 1370 → 376 | 11 → 11 | 24,576 → 724 |
| Phone / effects | 222 → 127 | 1213 → 197 | 1579 → 394 | 11 → 12 | 24,576 → 6,864 |

Moving village bandwidth falls **95.1% on desktop** and **97.1% in the phone view**. During the burst, the instance matrices introduce one additional upload, but total bandwidth still falls. These are measured submission/work reductions, not an estimate of FPS.

For the mature garden, desktop draws remain 212 (70 shadow) and phone draws 163 (62 shadow) when frozen. Frozen uploads fall from 21 / 38,624 bytes to zero. During crop animation, desktop uploads fall from 21 / 38,624 to 16 / 2,928 bytes; phone from 19 / 38,016 to 14 / 2,424 bytes. Crop bobbing, sparkles, growth stages and picking remain enabled.

## CPU timing, noise and FPS limits

Separate-run World.update CPU medians / p95 in milliseconds, without counting wrappers:

| Fixture | Before | After |
|---|---:|---:|
| Desktop / village | 2.1 / 2.7 | 2.1 / 2.8 |
| Desktop / pond | 2.2 / 3 | 2.2 / 3 |
| Desktop / effects | 2.4 / 3.2 | 2.6 / 3.3 |
| Phone / village | 11.8 / 15.4 | 12.4 / 16.1 |
| Phone / pond | 10.9 / 14.4 | 12.2 / 15.1 |
| Phone / effects | 12.3 / 17.1 | 10.2 / 18.6 |

These separate runs are not proof of speed. The effects timing window also outlives some particles, so it is not a sustained 96-particle benchmark. Profiles still show native/driver work, renderer submission, scene traversal and villager label layout; after caching, cachedUpdate itself becomes prominent. Fewer arithmetic operations do not make the cache comparisons free.

An additional single-page test hosts baseline, optimized and identical-baseline frames. It alternates A/B order over **12 pairs × 12 frames**, with equal simulation age and warm-up, and measures an identical-arm control. This measures synchronous update/submission, not display FPS.

| View | Comparison | A mean ms | B mean ms | Mean change | Individual pair changes |
|---|---|---:|---:|---:|---:|
| Desktop | Identical baseline arms | 1.21 | 1.2 | -0.17% | -11.43% to 26.09% |
| Desktop | Baseline vs optimized | 1.12 | 1.17 | 4.9% | -19.31% to 77.59% |
| Phone, CPU ×4 | Identical baseline arms | 11.46 | 11.73 | 2.38% | -18.82% to 40.2% |
| Phone, CPU ×4 | Baseline vs optimized | 11.31 | 12.57 | 11.11% | -4.92% to 32.07% |

The optimized arm's means leaned **4.9% slower on desktop and 11.1% slower under CPU throttle** in this run. Individual identical-arm pairs varied substantially, and other workloads were active on this machine. This does **not** establish an FPS gain or prove absence of a CPU regression. Treat the cache's CPU tradeoff as a remaining validation risk on actual target hardware; this local review claims the repeatable work reductions only. No battery, heat, sustained frame-rate or mobile GPU improvement is claimed.

The skill's independent render-probe also exercised the complete production loop at 390×844 / CPU ×4: 119 median total draws, 38 instanced draws, 219,357 triangles, frame intervals 13.3 ms median / 30.5 ms p95 / 51.7 ms max, 1 of 120 frames above 33.4 ms, no page errors. That probe disables the frame-rate limit and uses a different fresh-save scene; its intervals must not be converted into a claimed before/after FPS improvement.

## Memory and lifecycle

The village's unique scene geometry/instance backing buffers remain **29,605,560 bytes (28.23 MiB)**, 606 scene geometries and 253 materials. Pond geometry storage is also unchanged. Desktop village renderer counters remain 181 geometries / 13 textures / 26 programs. A phone render counter differed by one geometry between runs, while the scene's geometry count and typed-array storage were identical; these renderer counters are initialization/visibility dependent.

For the 96-particle burst, scene nodes fall **1,301 → 1,206**, materials **256 → 254**, and geometry count stays 607. Retaining a 128-slot matrix/color pool adds **9,728 bytes** of instance backing storage versus the separate meshes; it also needs one instanced shader variant (26 → 27 programs in this fixture). That is an explicit memory-for-submission tradeoff, not a memory reduction.

Heap snapshots after forced GC (MiB):

| Fixture | JS used heap before → after | Backing storage before → after |
|---|---:|---:|
| Desktop / village | 23.13 → 23.63 | 78.16 → 78.19 |
| Desktop / pond | 23.34 → 23.86 | 78.16 → 78.19 |
| Desktop / effects | 23.35 → 23.68 | 78.16 → 78.20 |
| Phone / village | 23.20 → 23.61 | 78.16 → 78.19 |
| Phone / pond | 23.25 → 23.75 | 78.16 → 78.19 |
| Phone / effects | 23.35 → 23.70 | 78.16 → 78.20 |

Desktop village heap rises about **0.50 MiB**, and backing storage about **29 KiB**, consistent with pose records and previous-commit typed arrays. These browser counters include other JS/native backing storage; they are not GPU VRAM or a precise allocation attribution. Textures are counted, not byte-sized; shared render targets, driver allocations, MSAA and GPU copies are outside the scene-buffer estimate.

After one warm-up burst, 12 more cycles of 96 particles at fixed world state reuse the same 128-slot mesh and end at zero particles. Before/after resource counts are identical: 1,210 scene nodes, 610 scene geometries, 254 materials, 29,746,628 scene-buffer bytes, 207 renderer geometries, 11 textures and 27 programs. This verifies the changed particle lifecycle; it is not a claim that every world-streaming path is leak-free.

## Visual and correctness checks

- Final identical-build screenshot controls: **0 differing pixels** for all six main fixtures and all three extra fixtures, after disabling CSS animation only in the measurement page.
- Desktop village, pond and burst: **0 / 1,296,000 pixels differ** before/after. Phone village: **0 / 1,316,640**. Mature crops on desktop and phone: **0**. The extra phone pond capture also matches exactly.
- In the main final phone captures, pond differs at 332 pixels (233 above channel delta 24) and burst at 535 (297 above 24). Inspected diff images locate the high-contrast differences in asynchronous minimap resident dots. The earlier controlled burst pair differs at only 54 pixels with maximum channel delta **1**, consistent with instance-color rounding. These full-screen images are not claimed pixel-identical; no changed world geometry, shadow or visible particle shape was found.
- **527 unit tests pass** after the final changes, including eight new performance correctness tests. The test run excludes `pen-range.test.mjs` explicitly: its existing 20-seed, multi-hour simulation was stopped after roughly seven minutes during the baseline run. The initial baseline run passed 519 other tests. Do not call this a complete passing `npm test` run.
- Focused checks cover native/cached matrix equivalence under movement, rotation, construction scaling, hiding/reveal, reparenting, explicit updates and force; real ray picking/bounds; manual bones/custom updaters; Float32 equality; pending culled ranges; middle-slot replacement, shrinking and storage growth; particle expiry, reuse and geometry ownership. Existing crop, fish, pond, outfit/foot, bike and collision tests pass.
- Production browser smoke passes for desktop and phone: keyboard/touch movement, jump rise/landing, three indoor/outdoor cycles with room targets, bike and jeep boarding/driving/dismounting; no page errors. The current Space behavior is preserved: interact near a target, jump in a clear spot.
- Combat pool browser checks pass for opaque and glow particles: expiry/compaction, unchanged dt=0 versions, a retained pending range while hidden, empty-state stability, reappearance, and exactly one reward-arrival callback.
- Existing `pond-browser.mjs` fails the same “desktop: headings change” assertion in both the untouched baseline and optimized build. The broader fishing browser suite passes 12 cases (three banks on desktop, phone and landscape, plus keyboard cancellation) with no page errors, then times out waiting for a walk-to-grass destination. That suite is **incomplete**, not a pass; the timeout was not isolated as a new regression. Fishing logic/catch/animation unit checks pass.
- Final production build passes: **1,095,283 bytes** before the first frame versus the existing 1,100,000-byte limit (4,717 bytes remain). Measurement code is not imported by production. Script syntax checks and `git diff --check` pass.

## Evidence and reproduction

Portable harnesses: [tools/performance-review](tools/performance-review/README.md). Local evidence is under the ignored [test-results/performance-review](test-results/performance-review/): exact before/after source snapshots, JSON counters/heap snapshots, CPU profiles, screenshot pairs, diff images, the unit log, paired timing, particle lifecycle and browser checks. Authoritative main results are [final-before](test-results/performance-review/results/final-before/measurements.json), [final-after](test-results/performance-review/results/final-after/measurements.json), [extra](test-results/performance-review/results/extra.json) and [paired](test-results/performance-review/results/paired.json). Earlier exploratory results are retained separately and are not substituted for the final table.

Remaining work before any performance claim: repeat sustained, full-game profiling on representative Android/iOS hardware; investigate the cache's CPU overhead, driver submission and label layout; use GPU timers/device tooling for pixel/shadow cost; isolate the pre-existing/incomplete browser assertions. No graphics reduction, FPS claim or deployment is part of this change.
