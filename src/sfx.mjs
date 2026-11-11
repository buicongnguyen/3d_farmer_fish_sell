// Feedback with weight: each kind of action has its own little sound, and coins earned fly to the purse.
// A note is [frequency Hz, start s, length s, wave, volume]. Kept small: a few oscillators, no samples.
const UP = (a, b) => [a, 0, 0.13, 'sine', 0.06, b];
export const SFX = {
  good: [UP(523, 784)],
  bad: [UP(230, 180)],
  // coins: two bright pings
  sell: [
    [1319, 0, 0.09, 'triangle', 0.05],
    [1760, 0.08, 0.2, 'triangle', 0.05],
  ],
  // a crop comes up: a soft pop and a lift
  harvest: [
    [330, 0, 0.08, 'sine', 0.07, 520],
    [660, 0.07, 0.18, 'sine', 0.05],
  ],
  plant: [[220, 0, 0.1, 'sine', 0.05, 180]],
  water: [
    [880, 0, 0.05, 'sine', 0.025],
    [740, 0.05, 0.05, 'sine', 0.025],
    [988, 0.1, 0.07, 'sine', 0.025],
  ],
  catch: [
    [440, 0, 0.1, 'sine', 0.06],
    [587, 0.1, 0.1, 'sine', 0.06],
    [880, 0.2, 0.2, 'sine', 0.06],
  ],
  // a chapter kept, a festival won: a rising chord
  claim: [
    [523, 0, 0.5, 'sine', 0.05],
    [659, 0.12, 0.5, 'sine', 0.05],
    [784, 0.24, 0.5, 'sine', 0.05],
    [1047, 0.36, 0.7, 'sine', 0.05],
  ],
};
SFX.festival = SFX.claim;
SFX.race = SFX.claim;
SFX.pickTree = SFX.harvest;
SFX.pickSpot = SFX.harvest;
SFX.sleep = [
  [392, 0, 0.6, 'sine', 0.04],
  [294, 0.25, 0.8, 'sine', 0.04],
];

/** The notes for an action: its own sound when it succeeded and has one, else the plain chime. */
export const sfxFor = (type, ok) => (ok ? (SFX[type] ?? SFX.good) : SFX.bad);

/** Play notes on an AudioContext. */
export function playNotes(ctx, notes) {
  const t0 = ctx.currentTime;
  for (const [freq, at, len, wave, vol, to] of notes) {
    const o = ctx.createOscillator(),
      g = ctx.createGain();
    o.type = wave;
    o.frequency.setValueAtTime(freq, t0 + at);
    o.frequency.exponentialRampToValueAtTime(to ?? freq * 1.5, t0 + at + len);
    g.gain.setValueAtTime(vol, t0 + at);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + at + len + 0.17);
    o.connect(g).connect(ctx.destination);
    o.start(t0 + at);
    o.stop(t0 + at + len + 0.2);
  }
}

/** How many coins to throw for an amount earned: 2 to 10. */
export const coinCount = gained => Math.max(2, Math.min(10, 2 + Math.floor(gained / 40)));

/** Coins that fly from `from` ({x, y} on screen) to the purse element. Skipped for reduced motion. */
export function flyCoins(from, purse, gained, doc = document) {
  if (!purse || gained <= 0 || matchMedia('(prefers-reduced-motion: reduce)').matches) return 0;
  const to = purse.getBoundingClientRect(),
    n = coinCount(gained);
  for (let i = 0; i < n; i++) {
    const c = doc.createElement('i');
    c.className = 'fly-coin';
    c.textContent = '🪙';
    c.setAttribute('aria-hidden', 'true');
    c.style.left = from.x + (Math.random() - 0.5) * 60 + 'px';
    c.style.top = from.y + (Math.random() - 0.5) * 30 + 'px';
    doc.body.append(c);
    const dx = to.left + to.width / 2 - parseFloat(c.style.left),
      dy = to.top + to.height / 2 - parseFloat(c.style.top);
    const a = c.animate(
      [
        { transform: 'translate(0, 0) scale(.6)', opacity: 0 },
        { transform: `translate(${dx * 0.1}px, ${-40 - Math.random() * 30}px) scale(1)`, opacity: 1, offset: 0.25 },
        { transform: `translate(${dx}px, ${dy}px) scale(.7)`, opacity: 1 },
      ],
      { duration: 650 + i * 60, delay: i * 55, easing: 'cubic-bezier(.4,0,.3,1)', fill: 'backwards' },
    );
    a.onfinish = () => {
      c.remove();
      if (i === n - 1) {
        purse.classList.add('pulse');
        setTimeout(() => purse.classList.remove('pulse'), 300);
      }
    };
  }
  return n;
}
