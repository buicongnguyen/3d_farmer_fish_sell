# Bundle slim (first load)

scripts/build.mjs fails above 1,100,000 bytes loaded before the first frame (game.js plus its static chunks).

## Result
- Before (8eb59b4): 1,099,960 bytes (40 spare); fetched later 285,952.
- After: 1,052,556 bytes (47,444 spare); fetched later 277,971.

## What moved (main.mjs only)
- pandora-view.mjs (the box view; with it wilds-view, combat-hud, combat-fx, creature-lod, pandora.css): `import()` started right after the first frame
  (next to the room-camera import) and awaited where `installPandora` was called in boot(). About 37.7 KB.
- decor-view.mjs (about 9.8 KB): `import()` started at the top of boot(), awaited and installed at its original place
  (before the shop preview / dock / mirror). Installing it later broke the sofa test in house-browser (wrapping order), so the order is kept.
- tests/seams.test.mjs searches for `.installPandora(world,` instead of `pandora=installPandora(world,`.

## Measurements (Playwright, GPU flags, 3 runs, begin button ready)
- Desktop ready 840-1090 ms before and after; phone profile with 4x CPU throttle 3.5 s before and after (no difference).
- JS/CSS files fetched before ready: 60-65 before, 56 after (the box chunk comes after). Total 68 vs 72 files (more, smaller chunks).
- First box open (willowmere.test.box(true) plus two frames): 23-33 ms before, 19-34 ms after: no extra hitch, because the chunk is already loaded.

## Still large in the first load
three (about 540 KB: three.module, three.core, GLTFLoader), main.mjs 50 KB, world.mjs 47 KB, wilds.mjs 27 KB, game.mjs 25 KB, minimap 20 KB,
fields 18 KB, content 18 KB, avatar 16 KB. wilds/combat/pandora/friends/titans data are pulled in statically by game.mjs (act logic), fields.mjs and minimap.mjs.
Moving them needs those three to stop importing the data (split the pure tables from the logic): the next step if more room is needed.
Other candidates by size: drive-view 12 KB (imported by world.mjs), shop-view 8.5 KB, pen-view 8 KB, minimap 20 KB.

## Rule for new code
Lazy by default: new panels, views and tools are loaded with `import()` on first use (preload after the first frame), never imported statically from main.mjs/world.mjs.
Check with `node scripts/build.mjs` (it prints the first-load bytes and the spare margin).

## Merge notes
Codex edits main.mjs: conflicts should be the import line removal of `installPandora` / `installDecor`, the added `decorLoad` in boot()'s first statement,
`const decorView=await decorLoad;` before installShopPreview, `decor=decorView.installDecor(...)` after it, `const pandoraView=import(...)` after the first-frame rAF,
and `pandora=(await pandoraView).installPandora(`.

## Tests
npm test (after the seam fix), browser, pandora-browser, house-browser, render, maps, facilities, vietnamese, old-save smoke: clean.
lands-browser: 17 checks ok, cut by my 280 s timeout, no failure.
