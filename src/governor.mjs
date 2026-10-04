// The adaptive quality governor (spec 18; smooth-dense-scenes: resolution first, then shadows, with a grace period after loads).
// It sits on top of the player's own Graphics setting, which stays the ceiling: it only ever takes steps below it, and gives them back
// when the frames are fast again. Step 1 draws 80% of the pixels, step 2 65% of them and half the shadow map, step 3 no shadow pass.
// It is fetched after boot (the first-frame bundle is at its limit) and sleeps under automation, so the suites' counts stay the same;
// ?governor=1 in the address wakes it for a check.
export const TOP = 3, SLOW = 34, FAST = 56; // TOP is the last step; the table of what each step keeps is STEPS in world.mjs
export class Governor {
  constructor() { this.step = 0; this.frames = 0; this.elapsed = 0; this.slow = 0; this.fast = 0; this.grace = 3; this.fps = 0; }
  /** The real frame time in seconds, and whether the game is being played (not paused, not in a panel or hidden). Returns -1, 0 or +1: the step it moved. */
  sample(dt, playing) {
    if (!playing || dt > .5) { this.frames = this.elapsed = this.slow = this.fast = 0; this.grace = 3; return 0; } // loads, menus and a hidden tab are not slowness
    this.frames++; this.elapsed += dt;
    if (this.elapsed < 1) return 0;
    this.fps = this.frames / this.elapsed; this.frames = this.elapsed = 0;
    if (this.grace > 0) { this.grace--; return 0; }
    if (this.fps < SLOW) { this.fast = 0; if (++this.slow >= 3 && this.step < TOP) { this.slow = 0; this.step++; this.grace = 2; return 1; } return 0; }
    this.slow = 0;
    if (this.fps > FAST && this.step > 0 && ++this.fast >= 10) { this.fast = 0; this.step--; this.grace = 2; return -1; }
    if (this.fps <= FAST) this.fast = 0;
    return 0;
  }
}
export function installGovernor(world) {
  if (navigator.webdriver && !/[?&]governor=1/.test(location.search)) return () => {};
  const g = new Governor();
  return (dt, playing) => { if (g.sample(dt, playing && !document.hidden)) world.setStep(g.step); };
}
