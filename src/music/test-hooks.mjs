// willowmere.test.music (test mode only): what the browser suite reads and drives. Nothing here runs unless a test calls it.
export function makeHooks(h) {
  return {
    state: () => { const e = h.engine; return e ? { ...e.describe(), plan: h.plan ? { main: h.plan.main?.piece ?? null, fight: h.plan.fight?.piece ?? null, tension: h.plan.tension, ko: h.plan.ko } : null } : { running: 'none', loaded: false, piece: null }; },
    log: (n = 200) => h.engine?.log(n) ?? [],
    clear: () => { if (h.engine) { h.engine.logBuf.length = 0; } },
    /** Overrides fields of the probe (null clears), then polls at once. */
    force: info => { h.setForced(info); h.poll(); },
    probe: () => h.probe(),
    stinger: name => h.engine?.stinger(name) ?? 0,
    stingers: () => h.stingers,
    load: () => h.load(),
    tier: t => h.engine?.setTier(t),
    resetLag: () => { const e = h.engine; if (e) { e.lateCount = 0; e.cost.n = 0; e.cost.ms = 0; e.cost.max = 0; for (const s of e.stages) s.sched.maxLag = 0; } },
    panel: () => h.engine?.panelOpen,
    gain: () => h.engine ? { music: h.engine.vol.gain.value, mute: h.engine.mute.gain.value, duck: h.engine.duckG.gain.value } : null,
  };
}
