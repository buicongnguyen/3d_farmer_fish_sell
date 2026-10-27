# Local CPU, transform and buffer review

Date: 2026-10-25. Baseline: local committed game 8f000fa, Three.js **0.180.0 (r180)**. Changes are uncommitted in the existing willowmere-finish checkout on branch codex/local-cpu-buffer-review. **No push or deployment.** The original source checkout has unfinished jump edits and remains untouched; those edits are outside this comparison.

Used C:/Users/n/.claude/skills/smooth-dense-scenes/SKILL.md and references/cpu-and-buffer-optimization.md. The latter's r185 recipes were checked against installed r180 Object3D, InstancedMesh and WebGLAttributes source rather than copied blindly. The path supplied as C:/Users/n.claude/... does not exist; the installed skill is under n/.claude.

## Findings and changes

1. **Transform work:** the live farm composed about 1,070 matrices/frame, including unchanged scenery and rig nodes. The unminified CPU profile identified updateMatrixWorld/compose alongside render submission work. Added opt-in pose caching on eligible live Scene/Group/Mesh nodes. It checks CPU-precision position/quaternion/scale, retains parent/force propagation, invalidates on reparenting, and leaves explicit updateMatrix/updateWorldMatrix methods untouched. Forced/manual/custom/skinned/bone/camera/light/pivot paths keep normal engine behavior. Weak ownership permits removed objects to be collected. Installation occurs on initialization/model sync, not as a second whole-tree pass every frame. New, not-yet-cached objects retain ordinary rendering.
2. **GPU traffic:** ripe cards resent unchanged cell/translation data and entire attribute capacities. Fish bodies/tails/shadows uploaded full capacities. Added Float32-aware changed writes and a bounded union of pending component ranges. Unrendered writes are retained; external full-update requests are not narrowed. The range object is reused after r180 consumes its list. Cards keep their identity matrices and only update changed translation/UV/box/info values. Fish retain the same matrix arithmetic and submit changed slots; spray/bubbles/rings submit their live prefixes.
3. **Effects:** combat particles keep their simulation, density, lifetimes, homing, colours and geometry, but upload live matrices and changed birth/compaction colours instead of whole capacities. Reward spheres previously added one scene mesh/draw each. They now share one growing instanced draw with the **same icosphere, toon shading, colours, trajectories, gravity and lifetime**. Records are reused; expired effects stop drawing; empty frames produce no repeated pool uploads. Instance buffers are disposed on capacity replacement, while shared geometry/material ownership is preserved.

No rendering quality tiers, resolution, shadows, object detail, simulation rate, camera behavior, controls or animation frequency were reduced. This is a focused pass on measured waste, not an assertion that the whole game is fully optimized.

## Measurement conditions

Chrome headless, ANGLE/D3D11 on RTX 4080 SUPER; desktop 1440×900/high, phone viewport 390×844/battery with **4× CDP CPU throttle**. Phone quality has shadows disabled by the game's existing rules; desktop measurements include actual shadow draws. This is not a physical-phone GPU/thermal/battery test.

Unminified local builds, same seeded fixtures, 2-second warm-up and 120 sampled rendered frames. Raw WebGL draws include shadow submissions. Matrix counters wrap the installed Matrix4 compose/multiplyMatrices methods **only in the measurement page**; packed fish arithmetic outside Matrix4 is not counted. bufferSubData counts use actual typed-array overload offsets/lengths in elements × BYTES_PER_ELEMENT, including zero/omitted-length remainder semantics. bufferData allocations are recorded separately. Wrappers are restored after sampling. CPU world.update measurements include renderer.render; do not add those durations together.

Farm: 30 unlocked beds, 10 ripe carrots, test-mode save. Pond: family pond, same planted state. Battle: box-open canyon stand and a reward burst every 30 sampled frames; fish, villagers and other normal animation continue. Because this is live simulation, moving battle draw counts can vary with particle age and actor visibility.

## Live gameplay work: medians per rendered frame

| View | Fixture | Raw draws | Shadow draws | Matrix compositions | Matrix multiplies | Upload calls | Uploaded bytes |
|---|---|---:|---:|---:|---:|---:|---:|
| desktop | farm | 150 → 150 | 43 → 43 | 1070 → 713 | 1366 → 973 | 21 → 16 | 38624 → 2236 |
| desktop | pond | 158 → 158 | 43 → 43 | 1072 → 717 | 1375 → 983 | 21 → 16 | 38624 → 2236 |
| desktop | battle | 114 → 95 | 29 → 29 | 1302 → 936 | 1557 → 1141 | 10 → 6 | 25600 → 2756 |
| phone | farm | 81 → 81 | 0 → 0 | 1067 → 710 | 1295 → 901 | 19 → 14 | 38016 → 1776 |
| phone | pond | 84 → 84 | 0 → 0 | 1069 → 714 | 1299 → 907 | 19 → 14 | 38016 → 1776 |
| phone | battle | 77 → 59 | 0 → 0 | 1300 → 930 | 1490 → 1074 | 10 → 6 | 25600 → 2572 |

Live farm upload bytes fell about **94% desktop / 95% phone**. Its matrix compositions fell about one third and multiplies about 29–30%. Farm and pond draw counts remained unchanged; those changes target CPU/bandwidth rather than drawing less content. Moving battle draw changes should not be treated as exact savings; use the fixed fixture below for that comparison.

## Fixed-presentation work

Same scene, paused simulation, zero presentation dt, **20 fixed reward spheres**, 120 warmed frames. This intentionally tests repeat work; it does not mean running gameplay uploads nothing.

| View | Fixture | Raw draws | Shadow draws | Matrix compositions | Matrix multiplies | Upload calls | Uploaded bytes |
|---|---|---:|---:|---:|---:|---:|---:|
| desktop | farm | 157 → 138 | 41 → 41 | 1090 → 583 | 1393 → 830 | 21 → 2 | 38624 → 76 |
| desktop | battle | 110 → 91 | 29 → 29 | 1286 → 789 | 1553 → 1006 | 8 → 0 | 13440 → 0 |
| phone | farm | 99 → 80 | 0 → 0 | 1087 → 580 | 1333 → 770 | 21 → 2 | 38624 → 76 |
| phone | battle | 77 → 58 | 0 → 0 | 1281 → 784 | 1490 → 943 | 8 → 0 | 13440 → 0 |

Exactly **19 view draws** are removed by pooling 20 spheres into one, with identical shadows. The frozen battle has no repeated uploads after warm-up. The frozen farm retains two small updates (76 bytes/frame) from unaffected presentation work; no zero-upload claim is made for the whole game.

## CPU time and FPS: no proven improvement

All sampled frame medians remained approximately **16.7 ms** at the display cap. Instrumented live world.update medians were 2.2 → 2.2 ms for desktop farm, 8.2 → 8.2 ms for phone farm and 7.9 → 7.3 ms for phone pond. These are diagnostic timings, not controlled speedup estimates. Phone battle runs varied substantially: the initial baseline read 6.7 ms, a repeated unchanged baseline 15.1 ms, and optimized repeats about 11.8–11.9 ms. That noise precludes a causal timing claim.

Operation wrappers were removed for a same-page pose-cache A/B. Twelve alternating cached/ordinary pairs, warm-up calls and an identical-arm null control measured frozen world.update(0), including rendering:

| View | Cached median ms | Ordinary median ms | Median absolute identical-arm difference ms |
|---|---:|---:|---:|
| desktop | 0.95 | 0.84 | 0.16 |
| phone | 11.89 | 11.18 | 1.64 |

The cache's timing difference was comparable to or below the control's noise; in the final phone run it was slightly slower rather than a clear gain. **There is no established FPS improvement or stable CPU-time improvement.** The demonstrated results are fewer matrix operations, fewer submitted bytes and fewer sphere draws. Conditional checks and cached state have their own cost. A physical-device or more stable isolated-machine benchmark is needed before claiming higher FPS, lower heat or longer battery life.

## Memory and allocation tradeoffs

| View | Fixed fixture | Reachable attribute backing bytes | JS heap bytes after forced GC | Shader programs |
|---|---|---:|---:|---:|
| desktop | farm | 29555652 → 29558084 | 24413808 → 24732992 | 26 → 27 |
| desktop | battle | 31395708 → 31398140 | 27007160 → 27107472 | 39 → 41 |
| phone | farm | 28873380 → 28875812 | 23911016 → 24132444 | 20 → 21 |
| phone | battle | 30551236 → 30553668 | 26392752 → 26548540 | 36 → 37 |

The pool adds **2,432 bytes** of instance storage at capacity 32 for the 20-sphere fixture. It replaces 20 rendered sphere nodes with one, but retains reusable particle records and peak capacity. The pose cache uses one 10-component Float64 pose (80 bytes) plus a state/closure per eligible live node; the focused browser fixture cached 525 nodes. Measured heap increases were roughly 0.1–0.32 MB, including code/caches and measurement variability. This is a deliberate memory-for-repeat-work tradeoff, not a memory reduction claim.

Backing-byte counts deduplicate ArrayBuffers reachable from geometry/instance attributes; shared glTF backing storage may exceed the individual view size. They are not total VRAM. Browser heap metrics also omit driver, texture, framebuffer and browser-process memory; actual GPU resident memory is unavailable through this portable API.

Both fixed fixtures had zero median buffer allocations after warm-up. Growing the new sphere pool does allocate/upload its instance buffers on first use; the moving measurements recorded: [{"view":"desktop","bufferAllocations":35,"allocatedBytes":33780},{"view":"phone","bufferAllocations":35,"allocatedBytes":33780}]. Old instance buffers are disposed when growing, and empty/update/reuse checks pass. Do not mistake warm steady state for zero first-use cost.

## Focused correctness checks

- 70 focused Node tests passed: pose cache, buffer ranges, burst/combat pool lifecycle, crop cards, pond simulation/ownership, farm and render/creature rules. Helper tests were rerun after final range-object reuse.
- Cached vs ordinary engine matrices agree through movement/turning/animated-child scale, visibility toggles, reparenting, forced updates, direct updateWorldMatrix, manual matrices and return to automatic mode. Source engine prototypes and clone behavior remain normal.
- Buffer tests cover Float32 stability, pending hidden writes without a render, range coalescing, external full requests, middle-slot replacement, capacity growth, expiry, empty frames and reuse.
- Desktop and phone browser comparisons: **zero changed pixels**, zero null-control pixels for cached vs ordinary rendering; pooled multicolour spheres vs individual spheres also had zero changed pixels. Real movement updates the player world matrix correctly.
- Field batch planting/harvest/watering/reload checks passed on desktop and phone. Watering passed portrait and landscape.
- Fishing bank suite passed desktop and phone: actual catches, detailed/deep fish hints, tension-ring levels, grass piles, Escape/panels, reload, transfer exactly once and outdoor pond rendering.
- The older fishing-simple suite timed out on the ground-walk-away case at line 145, on **both the unchanged baseline and optimized build**, with no page errors. It is recorded as an existing failing/flaky route check, not silently passed or changed by this review.

## Reproduce / evidence

- scripts/cpu-buffer-review.mjs: set GAME_URL to the local unminified build, GPU=1, REVIEW_LABEL, optional REVIEW_PROFILE=1, REVIEW_MODE=frozen, REVIEW_SCENES=farm,pond,battle and REVIEW_VIEWS=desktop,phone. Reports and .cpuprofile files go to test-results.
- tests/performance-caching.test.mjs and tests/cpu-buffer-browser.mjs contain focused invariants and pixel comparisons. EVIDENCE can point to a local test-results folder.
- Local evidence: test-results/cpu-buffer-before.json, cpu-buffer-after.json, cpu-buffer-frozen-before.json, cpu-buffer-frozen-after.json, cache-timing-final.json, cpu-focused-tests.log, cpu-buffer-correctness.log and cpu-fishing-bank-browser.log.
- The baseline was built locally from HEAD's original world/crop/pond/combat drawing files using an esbuild onLoad override into test-results/cpu-baseline, with shared unchanged assets. No baseline files or original working-tree changes were overwritten.

Production build verification and final local status are recorded below.

## Final local verification

Production build passed: **1,092,141 initial bytes / 1,100,000 limit**, 7,859 spare (+3,418 bytes against the committed baseline). Minified-build desktop and phone correctness checks again reported 525 cached nodes, zero cache/restore/particle pixel differences, successful expiry/reuse and correct moving world matrices. All 70 focused Node tests passed on the final source. git diff --check is clean. No commits, pushes or deployments were made. Changes and this report remain in C:/Users/n/OneDrive/Documents/Resume/willowmere-finish; the original repository's unfinished jump edits were not changed.
