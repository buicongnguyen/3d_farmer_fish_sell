# Performance review — 2026-10-25

Adapted from Claude's shared smooth-dense-scenes skill (C:/Users/n/.claude/skills/smooth-dense-scenes/SKILL.md), especially scripts/render-probe.mjs, scripts/draw-attribution.mjs and references/three-recipes.md. This is a portable project workflow; running it does not require Claude's local skill folder. The installed Three.js version is 0.180.0, matching the recipes' r180 target.

## Repeat the review

Build with npm run build, then serve dist with node scripts/serve-dist.mjs dist 4591. In a second PowerShell window:

    $env:GAME_URL='http://127.0.0.1:4591'
    $env:GPU='1'
    $env:EVIDENCE='test-results/performance'
    $env:PERF_LABEL='before'
    npm run review:performance

Repeat with PERF_LABEL='after' following a change. PERF_SPOTS accepts village,farm,wild,home; PERF_VIEWS accepts desktop,phone; PERF_CPU defaults to 4 for phone (desktop stays 1); PERF_FRAMES defaults to 120. Reports go to test-results/performance-LABEL.json, screenshots to EVIDENCE. These reports are local evidence, not shipped game assets. The review uses isolated save contexts and never reads the player's browser save.

## What it measures

- Raw WebGL drawArrays/drawElements and their instanced forms, including shadow submissions. renderer.info alone omits shadow work.
- Actual draws attributed to view/shadow objects by wrapping renderBufferDirect and checking how many raw calls it emits; an entry that emits no draw is not counted.
- Frame median and p95, canvas resolution/MSAA, program count, scene geometry array bytes and top draw contributors.
- Default village, fully unlocked 30-bed farm, box-open canyon and upgraded home, in desktop/high and phone/battery; phone CDP CPU throttling is 4×.

Measurements are stationary samples after loading, not complete playthroughs or physical-phone GPU tests. Frame intervals include review instrumentation and are normally capped by vsync; a draw reduction alone does not establish an FPS speedup. Compare counts first, repeat noisy timing results and use an unminified CPU profile for a reproducible remaining stall. Geometry array bytes are not total GPU memory: textures, renderer buffers and driver allocations are excluded.

## Measured change

The soil was baked independently for all 30 beds, costing one view and one shadow submission for each visible bed. Reuse one baked soil geometry with an InstancedMesh, keeping the same material family, shadows, positions, active count and original target objects. Empty Groups preserve cropViews' per-bed position/visibility interface. No plant models, bed sizes, decorations or world detail were removed.

| View | Spot | Before draws | After draws | Before p95 ms | After p95 ms |
|---|---|---:|---:|---:|---:|
| desktop | village | 127 | 126 | 16.9 | 16.9 |
| desktop | farm | 206 | 148 | 16.9 | 16.7 |
| desktop | wild | 92 | 92 | 16.9 | 16.9 |
| desktop | home | 49 | 49 | 16.9 | 16.7 |
| phone | village | 74 | 73 | 16.9 | 16.9 |
| phone | farm | 108 | 79 | 16.9 | 16.9 |
| phone | wild | 56 | 56 | 16.9 | 16.8 |
| phone | home | 22 | 22 | 16.9 | 16.9 |

Farm draws fell 28% on desktop and 27% on phone. Farm triangles were unchanged (281,841 desktop / 155,812 phone). Shared soil geometry removed 29 duplicate geometries and about 188 KB of scene geometry arrays. At the distant village camera, the single batch includes a few clipped bed triangles that individual meshes previously culled; measured draws still fall, with +540 desktop / +240 phone triangles, a small explicit tradeoff. No FPS improvement is claimed: both builds were near 16.7 ms on this GPU.

## Review checklist

1. Capture the same save, spot, camera, quality and viewport before changing code. Include shadows, upgraded saves and indoor/outdoor transitions.
2. Identify actual contributors. Choose instancing for repeated models, per-part merging for compatible materials, cheaper nearby shadow casters for shadow cost, or CPU indexing for route/collision cost.
3. Preserve emissive/glass parts, animated pivots, material lifetime, gameplay collisions, interaction areas and save identities. Preserve instance bounds/counts through upgrades and reloads.
4. Compare the picture and a same-build null control; do not trade visible quality for a smaller number without recording that choice. Measure geometry memory as well as draws.
5. Re-run relevant gameplay checks and the production first-load budget. Do not raise budgets merely to pass a regression.

## Validation

The bed-batch browser regression compares one-instance-per-bed reference draws with the batch in the same frozen scene, alternating 6 → 30 → 6 beds. Desktop/high (including shadows) and phone/battery have zero changed pixels and zero null-control pixels; active tap-target counts match. It checks lower raw submissions and disposes temporary reference instance buffers. Field planting/harvesting/watering/reload checks and full unit suite accompany this change. Re-run with GAME_URL/GPU/EVIDENCE set as above: node tests/bed-batch-browser.mjs.

Final local verification: npm test — 529 tests, 528 passed, one environment skip, zero failures; production first load 1,088,723 bytes of 1,100,000. Field-batch checks passed on desktop/phone; watering checks passed in portrait/landscape.
