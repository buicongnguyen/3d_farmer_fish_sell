import { build, context } from 'esbuild';
import { mkdir, cp, copyFile } from 'node:fs/promises';
await mkdir('dist/assets', { recursive: true });
await cp('public', 'dist', { recursive: true });
await copyFile('index.html', 'dist/index.html');
const options = { entryPoints: ['src/main.mjs'], bundle: true, outfile: 'dist/assets/game.js', format: 'esm', target: 'es2022', loader:{'.woff2':'file'}, minify: !process.argv.includes('--serve'), sourcemap: false, logLevel: 'info' };
if (process.argv.includes('--serve')) {
  const ctx = await context(options); await ctx.watch();
  const server = await ctx.serve({ servedir: 'dist', host: '127.0.0.1', port: 4173 });
  console.log(`Willowmere ready at http://${server.hosts[0]}:${server.port}`);
} else await build(options);
