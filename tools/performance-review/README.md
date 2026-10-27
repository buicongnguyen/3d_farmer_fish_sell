# Local performance review tools

These development tools are separate from the production entry point. They use the repository's installed Three.js, esbuild and Playwright. Chrome with ANGLE/D3D11 is used on Windows; inspect the reported GPU before interpreting timings. No deployment or remote upload occurs.

The review's exact source snapshots and evidence are in the ignored `test-results/performance-review` directory. `before` includes the local changes that existed before this review; rebuilding from Git HEAD alone does not reproduce it. `after` is the measured candidate. The source hashes are saved alongside them. Shared models and fonts come from the project's `public` directory.

From the project root, start each server in a separate terminal:

```powershell
Set-Location test-results/performance-review
node ../../tools/performance-review/serve.mjs before 43986
```

```powershell
Set-Location test-results/performance-review
node ../../tools/performance-review/serve.mjs after 43987
```

In another terminal, from `test-results/performance-review`:

```powershell
node ../../tools/performance-review/measure.mjs final-before http://127.0.0.1:43986
node ../../tools/performance-review/measure.mjs final-after http://127.0.0.1:43987
node ../../tools/performance-review/paired.mjs
node ../../tools/performance-review/extra.mjs
node ../../tools/performance-review/pixels.mjs
node ../../tools/performance-review/pixels.mjs --extra
node ../../tools/performance-review/combat-check.mjs
```

Run timing commands sequentially. Close other review browsers first. `paired.mjs` places both versions and an identical baseline control in one local parent page; it equalizes simulation age before comparing, alternates arm order, and reports raw pairs. It does not measure GPU completion or prove FPS. `extra.mjs` uses phone dimensions/quality but does not apply CPU throttling. It also isolates particle lifecycle checks by freezing the rest of the world.

`measure.mjs` freezes the app RAF only after boot, advances the world explicitly, then wraps raw WebGL and matrix calls for work counters. It removes wrappers before CPU timing. The entry shim and `window.__perf` exist only in these measurement builds. CSS animations are disabled only for measurement screenshots. The minimap may retain dots from its last outer-loop refresh; full-frame pixel differences must be inspected and must not be silently described as exact matches.

For a normal production-loop control smoke test, run `npm run build` at the project root, start `node tools/performance-review/production-serve.mjs` (port 43988), then run `node ../../tools/performance-review/smoke.mjs` from the evidence directory. `serve.mjs <snapshot> <port> --normal` separately builds an uninstrumented snapshot in `normal-dist`. `--build` builds without opening a server.

To measure a later candidate, make a new snapshot directory with a copy of `src` before starting `serve.mjs`; avoid overwriting the original before snapshot. The server supplies the font and current index page. For a historical comparison, retain matching `public` assets and HTML too if they changed.

New unit safeguards run with `node --test tests/performance.test.mjs`. The review's broader unit run excluded the long `pen-range.test.mjs` simulation explicitly; see `PERFORMANCE_REVIEW.md` for the exact scope, browser-test failures and limitations. Local evidence is ignored by Git; retain it separately if you want to share or archive this review.
