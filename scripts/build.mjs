import { build, context } from 'esbuild';
import { mkdir, cp, copyFile, readFile, writeFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
await mkdir('dist/assets', { recursive: true });
await cp('public', 'dist', { recursive: true });
await copyFile('index.html', 'dist/index.html');
// One entry, game.js, plus the chunks it fetches with import() (splitting): the box-open-only code (wilds-draw.mjs, ...) is not
// read before the first frame. Chunk names carry their content hash, so a cached old chunk is never paired with a new game.js.
const options = { entryPoints: { game: 'src/main.mjs' }, bundle: true, outdir: 'dist/assets', splitting: true, chunkNames: 'chunk-[hash]', metafile: true, format: 'esm', target: 'es2022', loader:{'.woff2':'file'}, charset: 'utf8', minify: !process.argv.includes('--serve'), sourcemap: false, logLevel: 'info' };
if (process.argv.includes('--serve')) {
  const ctx = await context(options); await ctx.watch();
  const server = await ctx.serve({ servedir: 'dist', host: '127.0.0.1', port: 4173 });
  console.log(`Willowmere ready at http://${server.hosts[0]}:${server.port}`);
} else {
  const { metafile } = await build(options);
  // What is read before the first frame: game.js and every chunk it imports statically (with splitting, code that game.js shares
  // with a lazy chunk goes into a chunk of its own, which game.js then imports: it counts here). The chunks behind import() do
  // not. Round 8 imports a lot from main.mjs (regions, creatures, titans, lands, friends, maps), so the build fails above this
  // size instead of letting the first load grow unnoticed. If a merge passes it, move more box-open-only code behind import()
  // (the way wilds-view.mjs fetches wilds-draw.mjs): builder A's job (spec 17.3).
  const first = new Set(), lazy = new Set(), walk = file => { if (first.has(file)) return; first.add(file); for (const i of metafile.outputs[file].imports) if (i.kind === 'import-statement') walk(i.path); else if (i.kind === 'dynamic-import') lazy.add(i.path); };
  walk('dist/assets/game.js'); for (const file of first) lazy.delete(file);
  const BUNDLE_LIMIT = 1_100_000, sizeOf = files => [...files].reduce((n, file) => n + metafile.outputs[file].bytes, 0), size = sizeOf(first);
  console.log(`dist/assets/game.js: ${size.toLocaleString('en-US')} bytes before the first frame${first.size > 1 ? ` (game.js and ${first.size - 1} chunk${first.size > 2 ? 's' : ''})` : ''} (limit ${BUNDLE_LIMIT.toLocaleString('en-US')}, ${(BUNDLE_LIMIT - size).toLocaleString('en-US')} to spare); ${sizeOf(lazy).toLocaleString('en-US')} bytes fetched later with import()`);
  if (size > BUNDLE_LIMIT) { console.error(`The bundle is ${(size - BUNDLE_LIMIT).toLocaleString('en-US')} bytes over the limit. Hand builder A this size report (spec 17.3).`); process.exit(1); }
  // The page names the bundle it was built with (game.js?v=…, game.css?v=…): browsers cache the two files under their
  // plain names for ten minutes on GitHub Pages, so after a release a phone could run the old script with the new
  // styles, or the other way round. With the stamp a page always loads the pair it belongs to.
  const stamp = createHash('sha1').update(await readFile('dist/assets/game.js')).update(await readFile('dist/assets/game.css')).digest('hex').slice(0, 10);
  const page = await readFile('dist/index.html', 'utf8');
  await writeFile('dist/index.html', page.replace('./assets/game.css"', `./assets/game.css?v=${stamp}"`).replace('./assets/game.js"', `./assets/game.js?v=${stamp}"`).replace("'./assets/game.js'", `'./assets/game.js?v=${stamp}'`));
}
