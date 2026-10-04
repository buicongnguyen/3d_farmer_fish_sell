// Analysis of rendered music in Node: peak, RMS, DC, silence, the click at a loop boundary, spectral balance, stereo, plus WAV writing and the render driver
// (scripts/music-render.mjs and tests/music-browser.mjs share it). Measurable proxies only: none of these numbers says a tune is good.
import { build } from 'esbuild';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

export const dB = x => 20 * Math.log10(Math.max(x, 1e-9));
export const decode = b64 => { const b = Buffer.from(b64, 'base64'), n = b.length >> 1, f = new Float32Array(n); for (let i = 0; i < n; i++) f[i] = b.readInt16LE(i * 2) / 32767; return f; };
export const rms = (x, a = 0, b = x.length) => { let s = 0; for (let i = a; i < b; i++) s += x[i] * x[i]; return Math.sqrt(s / Math.max(1, b - a)); };
export const peak = x => { let p = 0, hot = 0; for (let i = 0; i < x.length; i++) { const v = Math.abs(x[i]); if (v > p) p = v; if (v >= .999) hot++; } return { peak: p, hot }; };
export const mean = x => { let s = 0; for (let i = 0; i < x.length; i++) s += x[i]; return s / x.length; };
export const percentile = (arr, q) => { const s = Float32Array.from(arr).sort(); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; };
const diffs = (x, a, b) => { const out = new Float32Array(Math.max(0, b - a - 1)); for (let i = a + 1; i < b; i++) out[i - a - 1] = Math.abs(x[i] - x[i - 1]); return out; };
/** The lowest 1 s window RMS (dBFS) from `from` seconds on. */
export function quietest(x, rate, from = 1) { let low = 0; for (let s = Math.floor(from * rate); s + rate <= x.length; s += rate) { const r = rms(x, s, s + rate); if (!low || r < low) low = r; } return dB(low); }
/** Click at time T: the largest 1-sample step in +-win around T against the 99.5th percentile of the same quantity elsewhere (ratio; below 2 passes). */
export function clickRatio(x, rate, T, win = .005, from = 0, to = x.length / rate) {
  const a = Math.floor((T - win) * rate), b = Math.floor((T + win) * rate), near = diffs(x, a, b), keep = [], off = Math.floor(from * rate), d = diffs(x, off, Math.floor(to * rate));
  for (let i = 0; i < d.length; i++) { const at = i + off; if (at < a - rate * .05 || at > b + rate * .05) keep.push(d[i]); }
  let m = 0; for (const v of near) if (v > m) m = v; return m / Math.max(percentile(keep, .995), 1e-6);
}
function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) { let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; } }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = -2 * Math.PI / len, wr = Math.cos(ang), wi = Math.sin(ang), h = len / 2;
    for (let i = 0; i < n; i += len) { let cr = 1, ci = 0; for (let k = 0; k < h; k++) { const ur = re[i + k], ui = im[i + k], xr = re[i + k + h], xi = im[i + k + h], vr = xr * cr - xi * ci, vi = xr * ci + xi * cr; re[i + k] = ur + vr; im[i + k] = ui + vi; re[i + k + h] = ur - vr; im[i + k + h] = ui - vi; const nr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = nr; } }
  }
}
/** Energy shares (fractions) under 250 Hz, 250 to 2000, over 4000, over 3000, and the spectral centroid in Hz, on a mono mix, Hann windows of 4096. */
export function spectrum(l, r, rate, N = 4096) {
  const bins = new Float64Array(N / 2), re = new Float64Array(N), im = new Float64Array(N); let windows = 0;
  for (let s = 0; s + N <= l.length; s += N * 2) { for (let i = 0; i < N; i++) { const w = .5 - .5 * Math.cos(2 * Math.PI * i / N); re[i] = (l[s + i] + r[s + i]) / 2 * w; im[i] = 0; } fft(re, im); for (let k = 1; k < N / 2; k++) bins[k] += re[k] * re[k] + im[k] * im[k]; windows++; }
  let tot = 0, lo = 0, mid = 0, hi = 0, hi3 = 0, cen = 0; const df = rate / N;
  for (let k = 1; k < N / 2; k++) { const f = k * df, e = bins[k]; tot += e; cen += e * f; if (f < 250) lo += e; else if (f <= 2000) mid += e; if (f > 4000) hi += e; if (f > 3000) hi3 += e; }
  return { low: lo / tot, mid: mid / tot, high: hi / tot, high3: hi3 / tot, centroid: cen / tot, windows };
}
/** A phone speaker, roughly: a 4th-order Butterworth high-pass at 350 Hz (two biquads). Returns the filtered copy of x. */
export function phoneFilter(x, rate, fc = 350) {
  let y = x; for (const q of [.5412, 1.3066]) {
    const w = 2 * Math.PI * fc / rate, al = Math.sin(w) / (2 * q), c = Math.cos(w), b0 = (1 + c) / 2, b1 = -(1 + c), b2 = (1 + c) / 2, a0 = 1 + al, a1 = -2 * c, a2 = 1 - al, o = new Float32Array(y.length); let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (let i = 0; i < y.length; i++) { const v = (b0 * y[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0; o[i] = v; x2 = x1; x1 = y[i]; y2 = y1; y1 = v; } y = o;
  } return y;
}
export function metrics(res) {
  const l = decode(res.l), r = decode(res.r), rate = res.rate, p = peak(l), q = peak(r), both = new Float32Array(l.length * 2); both.set(l); both.set(r, l.length);
  return { rate, seconds: l.length / rate, peakDb: dB(Math.max(p.peak, q.peak)), hot: p.hot + q.hot, rmsDb: dB(rms(both)), dcL: Math.abs(mean(l)), dcR: Math.abs(mean(r)), quietDb: quietest(l, rate, 1), stereoDb: Math.abs(dB(rms(l)) - dB(rms(r))), spec: spectrum(l, r, rate), phoneDb: (() => { const pl = phoneFilter(l, rate), pr = phoneFilter(r, rate), b = new Float32Array(pl.length * 2); b.set(pl); b.set(pr, pl.length); return dB(rms(b)); })(), peakVoices: res.peakVoices, schedMs: res.schedMs, totalMs: res.totalMs, l, r };
}
export function wav(res) {
  const l = decode(res.l), r = decode(res.r), n = l.length, buf = Buffer.alloc(44 + n * 4);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 4, 4); buf.write('WAVEfmt ', 8); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22); buf.writeUInt32LE(res.rate, 24); buf.writeUInt32LE(res.rate * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(n * 4, 40);
  for (let i = 0; i < n; i++) { buf.writeInt16LE(Math.round(l[i] * 32767), 44 + i * 4); buf.writeInt16LE(Math.round(r[i] * 32767), 46 + i * 4); }
  return buf;
}
/** A blank Chromium page with the real engine bundled in (esbuild, in memory): render(opts) runs MusicOffline.render in it. */
export async function offlinePage(root = process.cwd(), args = []) {
  const out = await build({ entryPoints: [`${root}/src/music/offline.mjs`], bundle: true, write: false, format: 'iife', target: 'es2022', minify: false, logLevel: 'silent' });
  const browser = await chromium.launch({ channel: process.env.CI ? undefined : 'chrome', headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', ...args] });
  const page = await browser.newPage(); await page.setContent('<!doctype html><title>music</title>'); await page.addScriptTag({ content: out.outputFiles[0].text });
  return { browser, page, render: o => page.evaluate(o => MusicOffline.render(o), o), info: () => page.evaluate(() => ({ core: MusicOffline.CORE, world: MusicOffline.WORLD, stingers: MusicOffline.STINGERS })) };
}
export async function writeWav(dir, name, res) { await mkdir(dir, { recursive: true }); await writeFile(`${dir}/${name}.wav`, wav(res)); }
