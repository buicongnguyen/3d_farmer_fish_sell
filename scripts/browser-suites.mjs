// Runs the browser suites named in tests/browser-suites.json, one process per suite, each with its own time limit.
//
//   node scripts/browser-suites.mjs gate                 the deploy gate (short, steady under software WebGL)
//   node scripts/browser-suites.mjs nightly              everything else (timing- or GPU-sensitive, or long)
//   node scripts/browser-suites.mjs all | <suite> ...    every listed suite, or the ones named
//   node scripts/browser-suites.mjs nightly --list       print the list as a JSON array (the workflow's matrix) and stop
//
// Options: --jobs N (suites at once, default 1)   --timeout S (seconds per suite, default 600)   --port P (default 4418)
// With GAME_URL set the suites use that server. Without it this script serves dist/ itself on --port and stops that
// one server when it is done. GPU=1 and CI=1 are passed through to the suites untouched.
// Each suite's output goes to test-results/suite-logs/<suite>.log; the summary to test-results/browser-suites.json.
import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
export async function suiteLists() {
  const lists = JSON.parse(await readFile(path.join(root, 'tests/browser-suites.json'), 'utf8'));
  const files = (await readdir(path.join(root, 'tests')))
    .filter(f => /browser.*\.mjs$/.test(f) && !f.endsWith('.test.mjs') && f !== 'browser-suites.json')
    .map(f => f.replace(/\.mjs$/, ''))
    .sort();
  return { gate: lists.gate, nightly: lists.nightly, files };
}
/** Stop one child and what it started (its browser), by its own process id. */
function stop(child) {
  if (child.exitCode !== null) return;
  if (process.platform === 'win32') spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
  else {
    try {
      process.kill(-child.pid, 'SIGKILL');
    } catch {
      child.kill('SIGKILL');
    }
  }
}
function runSuite(name, env, seconds, logs) {
  return new Promise(resolve => {
    const began = Date.now(),
      log = createWriteStream(path.join(logs, `${name}.log`));
    const child = spawn(process.execPath, [`tests/${name}.mjs`], {
      cwd: root,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: process.platform !== 'win32',
    });
    child.stdout.pipe(log, { end: false });
    child.stderr.pipe(log, { end: false });
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      stop(child);
    }, seconds * 1000);
    child.on('close', code => {
      clearTimeout(timer);
      log.end();
      resolve({
        suite: name,
        result: timedOut ? 'timeout' : code === 0 ? 'pass' : 'fail',
        seconds: Math.round((Date.now() - began) / 1000),
      });
    });
  });
}
async function waitFor(url, seconds) {
  for (let i = 0; i < seconds * 4; i++) {
    try {
      if ((await fetch(url)).ok) return true;
    } catch {
      /* not up yet */
    }
    await new Promise(r => setTimeout(r, 250));
  }
  return false;
}

if (process.argv[1] && path.resolve(process.argv[1]) === import.meta.filename) {
  const args = process.argv.slice(2),
    option = (name, fallback) => {
      const i = args.indexOf(`--${name}`);
      return i < 0 ? fallback : Number(args.splice(i, 2)[1]);
    };
  const jobs = option('jobs', 1),
    seconds = option('timeout', 600),
    port = option('port', 4418);
  const listOnly = args.includes('--list'),
    names = args.filter(a => !a.startsWith('--'));
  const lists = await suiteLists();
  const wanted = names.flatMap(n =>
    n === 'all' ? [...lists.gate, ...lists.nightly] : lists[n] && n !== 'files' ? lists[n] : [n.replace(/\.mjs$/, '')],
  );
  if (!wanted.length) {
    console.error('Name a list (gate, nightly, all) or suites.');
    process.exit(2);
  }
  const unknown = wanted.filter(n => !lists.files.includes(n));
  if (unknown.length) {
    console.error(`No such suite: ${unknown.join(', ')}`);
    process.exit(2);
  }
  if (listOnly) {
    console.log(JSON.stringify(wanted));
    process.exit(0);
  }

  const logs = path.join(root, 'test-results/suite-logs');
  await mkdir(logs, { recursive: true });
  let server = null,
    url = process.env.GAME_URL;
  if (!url) {
    url = `http://127.0.0.1:${port}`;
    server = spawn(process.execPath, ['scripts/serve-dist.mjs', 'dist', String(port)], { cwd: root, stdio: 'ignore' });
    if (!(await waitFor(url, 30))) {
      server.kill();
      console.error(`The build did not come up on ${url} (is dist/ built, is the port free?)`);
      process.exit(2);
    }
  }
  const env = { ...process.env, GAME_URL: url },
    began = Date.now(),
    results = [],
    queue = [...wanted];
  const worker = async () => {
    for (let name; (name = queue.shift()); ) {
      const r = await runSuite(name, env, seconds, logs);
      results.push(r);
      console.log(`${r.result.padEnd(8)}${String(r.seconds).padStart(5)}s  ${name}`);
      if (r.result !== 'pass')
        console.log(
          (await readFile(path.join(logs, `${name}.log`), 'utf8'))
            .trimEnd()
            .split(/\r?\n/)
            .slice(-25)
            .map(line => '    ' + line.slice(0, 600))
            .join('\n'),
        );
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, jobs) }, worker));
  server?.kill();
  const total = Math.round((Date.now() - began) / 1000),
    bad = results.filter(r => r.result !== 'pass');
  await writeFile(
    path.join(root, 'test-results/browser-suites.json'),
    JSON.stringify({ url, jobs, timeout: seconds, total, results }, null, 1),
  );
  console.log(
    `\n${results.length - bad.length} of ${results.length} suites passed in ${total}s${bad.length ? `; not passed: ${bad.map(r => `${r.suite} (${r.result})`).join(', ')}` : ''}`,
  );
  process.exit(bad.length ? 1 : 0);
}
