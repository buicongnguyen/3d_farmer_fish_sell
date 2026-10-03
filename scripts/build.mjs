import { build, context } from 'esbuild';
import { mkdir, cp, copyFile, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
await mkdir('dist/assets', { recursive: true });
await cp('public', 'dist', { recursive: true });
await copyFile('index.html', 'dist/index.html');
const options = { entryPoints: ['src/main.mjs'], bundle: true, outfile: 'dist/assets/game.js', format: 'esm', target: 'es2022', loader:{'.woff2':'file'}, minify: !process.argv.includes('--serve'), sourcemap: false, logLevel: 'info' };
if (process.argv.includes('--serve')) {
  const ctx = await context(options); await ctx.watch();
  const server = await ctx.serve({ servedir: 'dist', host: '127.0.0.1', port: 4173 });
  console.log(`Willowmere ready at http://${server.hosts[0]}:${server.port}`);
} else {
  await build(options);
  // The page names the bundle it was built with (game.js?v=…, game.css?v=…): browsers cache the two files under their
  // plain names for ten minutes on GitHub Pages, so after a release a phone could run the old script with the new
  // styles, or the other way round. With the stamp a page always loads the pair it belongs to.
  const stamp = createHash('sha1').update(await readFile('dist/assets/game.js')).update(await readFile('dist/assets/game.css')).digest('hex').slice(0, 10);
  const page = await readFile('dist/index.html', 'utf8');
  await writeFile('dist/index.html', page.replace('./assets/game.css"', `./assets/game.css?v=${stamp}"`).replace('./assets/game.js"', `./assets/game.js?v=${stamp}"`));
}
