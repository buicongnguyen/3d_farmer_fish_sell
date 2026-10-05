// The music entry (lazy: main.mjs asks for it with import() after boot). It owns the engine and the director, reads the game with one
// probe polled at 4 Hz (nothing in the frame loop), turns state changes into stingers, and puts the Music rows in the Settings panel.
import { Engine } from './engine.mjs';
import { Director, NEEDS_WORLD, variantOf } from './director.mjs';
import { STINGERS } from './scores-core.mjs';
import { makeHooks } from './test-hooks.mjs';

const LODGE = { school: 'civic', hospital: 'civic', bakery: 'shop' };
/** What a stinger an action earns: the action's name and its result decide it. */
const ACT = { harvest: 'harvest', catch: 'catch', pickTree: 'pickTree', pickSpot: 'pickTree', sell: 'sell', festival: 'sell' };

export function installMusic({ state, world, pandora, ui, lib, persist = () => { } }) {
  const [calendar, cageStatuses, HOUSES, BED_POSITIONS, audio, regionAt, borderDistance] = lib; // handed over by main.mjs: importing these here would split them into chunks the first frame must read
  let engine = null, timer = 0, loading = null, loaded = false, forced = null, prev = {}, applied = { ko: false }, plan = null, welcomed = false, seenLoc = null, seenReg = null; // applied.ko starts false: the first poll is not a wake-up
  const director = new Director(), cfg = () => state().settings, wanted = () => cfg().sound !== false && cfg().music !== false;
  const vol = () => { const v = cfg().musicVol; return v >= 0 && v <= 1 ? +v : .7; };
  const interiorOf = () => { const id = world.houseId; if (typeof id === 'string') return id === 'supermarket' ? 'market' : 'civic'; return id === 0 ? 'home' : LODGE[HOUSES[id]?.lodge] ?? 'visit'; };
  /** The nearest boss or titan within 40 m that is after you (what the box's boss bar uses, without the 35 m / hurt rule): {kind, region, phase, hpf, windup}. */
  function fightInfo(p) {
    const list = pandora?.wilds?.awake; if (!list) return null; let best = null, near = 40;
    for (let i = 0; i < list.length; i++) { const e = list[i]; if (!(e.def.boss || e.titan) || !(e.hp > 0) || e.phase === 'idle' || e.phase === 'return') continue; const d = Math.hypot(e.x - p.x, e.z - p.z); if (d < near) { best = e; near = d; } }
    if (!best) return null; const f = best.hp / best.maxHp;
    return { kind: best.titan ? 'titan' : 'boss', type: best.type, region: best.region, phase: best.titan ? (f < .5 ? 2 : 1) : f < 1 / 3 ? 3 : f < 2 / 3 ? 2 : 1, hpf: f, windup: best.phase === 'windup' };
  }
  /** Everything the director needs, in one object (design 7.1). */
  function probe() {
    const s = state(), p = world.player.position, u = ui(), c = calendar(s), inVillage = world.location === 'village', region = inVillage ? regionAt(p.x, p.z) : null, wild = inVillage && region !== null && region !== 'village';
    let farm = false; if (inVillage && region === 'village') for (const b of BED_POSITIONS) if (Math.abs(b.x - p.x) < 9 && Math.abs(b.z - p.z) < 9) { farm = true; break; }
    return { cover: !document.body.classList.contains('playing'), hp: s.hp, ko: !!s.pandora && s.hp <= 0, location: world.location, interior: world.location === 'interior' ? interiorOf() : null, riding: world.riding ? String(world.riding.id).includes('bike') ? 2 : 1 : 0,
      time: s.time, season: c.season, festival: c.festival, rain: c.rain, festivalPanel: u.panel === 'festival', settingsPanel: u.panel === 'settings', shop: u.panel === 'shop' && inVillage ? (u.arg === 'supermarket' ? 'market' : 'shop') : null, region, inside: region !== null && borderDistance(p.x, p.z) > 3,
      threatened: wild && !!pandora?.threatened?.(), fight: wild ? fightInfo(p) : null, fishing: !!u.fishing || !!u.hunting, race: !!u.race, panel: !!u.panel && u.panel !== 'settings', farm, x: p.x, z: p.z };
  }
  // The first gesture starts the engine (an AudioContext made outside one stays suspended). Any later tap or key retries a context the browser suspended.
  const onGesture = fn => { for (const t of ['pointerdown', 'keydown', 'touchend']) addEventListener(t, fn, { capture: true, passive: true }); };
  const note = (name, arg) => { if (engine && engine.audible) engine.stinger(name, arg); };
  /** Stingers from changes between two polls: bite, strain, line lost, checkpoint, map, cages, a long jump (Home), victory, level up. */
  function events(i, u, s) {
    const f = u.fishing, pf = prev.fishing;
    if (f && f.phase === 'hooked' && pf !== 'hooked') note('bite'); else if (f && f.strains > (prev.strains ?? 0)) note('strain'); else if (f && f.phase === 'escaped' && pf !== 'escaped') note('lost');
    prev.fishing = f?.phase; prev.strains = f?.strains ?? 0;
    if (u.race && u.race.next > (prev.race ?? 0)) note(u.race.next >= 3 ? 'victory' : 'checkpoint'); prev.race = u.race?.next ?? 0;
    if (u.panel === 'map' && prev.panel !== 'map') note('mapOpen'); else if (prev.panel === 'map' && u.panel !== 'map') note('mapClose'); prev.panel = u.panel;
    const cages = cageStatuses(s).map(c => `${c.id}:${c.state}`).join(' ');
    if (prev.cages !== undefined && cages !== prev.cages) { const a = prev.cages, now = cages.split(' '); if (now.some(x => x.endsWith(':open') && !a.includes(x))) note('rescue_open'); if (now.some(x => x.endsWith(':rescued') && !a.includes(x))) setTimeout(() => note('friend_joy', { tonic: undefined }), 1500); } prev.cages = cages;
    if (prev.x !== undefined && i.location === prev.loc && Math.hypot(i.x - prev.x, i.z - prev.z) > 40 && !i.ko) note('teleport'); prev.x = i.x; prev.z = i.z; prev.loc = i.location;
    const won = Object.keys(s.defeated ?? {}).length; if (prev.won !== undefined && won > prev.won && (i.fight || director.lastFight)) note('victory', { tonic: director.lastFight?.tonic }); prev.won = won;
    if (typeof s.level === 'number') { if (prev.level !== undefined && s.level > prev.level) note('levelup'); prev.level = s.level; }
  }
  function ready() { return loaded || !!engine?.scores.boss; }
  function load() { engine?.hold(4); return loading ??= import('./scores-world.mjs').then(m => { engine?.addScores(m.WORLD); loaded = true; engine?.hold(2); }).catch(e => { loading = null; console.warn('The world music could not load.', e); }); }
  function poll() {
    const s = state(), i = { ...probe(), ...forced }, u = ui();
    if (engine.enabled !== wanted()) engine.setEnabled(wanted());
    if (Math.abs(engine.volume - vol()) > 1e-4) engine.setVolume(vol());
    if (engine.wantTier !== Math.min(['battery', 'balanced', 'high'].indexOf(cfg().quality), engine.capTier)) engine.setTier(cfg().quality);
    if (i.location !== seenLoc || i.region !== seenReg) { if (seenLoc !== null) engine.hold(3); seenLoc = i.location; seenReg = i.region; } // building a house or a region stalls the page for a moment
    if (!engine.audible) { events(i, u, s); return; }
    plan = director.update(i, performance.now() / 1000);
    const need = plan.main && NEEDS_WORLD.has(plan.main.piece) || plan.fight; if (need && !ready()) { load(); }
    if (engine.panelOpen !== plan.panel) { engine.panelOpen = plan.panel; engine.panel(plan.panel); }
    if (applied.ko !== plan.ko) { applied.ko = plan.ko; engine.ko(plan.ko); }
    if (!plan.ko && plan.main && (!NEEDS_WORLD.has(plan.main.piece) || ready())) {
      const m = plan.main, same = engine.main?.id === m.piece;
      if (plan.welcome && !welcomed) { welcomed = true; const len = engine.stinger('welcome'); engine.play(m.piece, { variant: m.variant, fade: .06, startAt: engine.now() + len }); }
      else if (!same || m.variant) engine.play(m.piece, { variant: m.variant, fade: plan.wake ? 3 : !engine.main ? 2 : plan.fade, quant: plan.quant });
    }
    const fp = plan.fight, key = fp ? `${fp.piece}|${fp.tonic}|${fp.mode}|${fp.phase}|${fp.windup}` : '';
    if (!plan.ko && applied.fight !== key && (!fp || ready())) { applied.fight = key; engine.fight(fp); }
    if (!plan.ko && plan.main && engine.main && !engine.fightStage?.dying && engine.main.want.tension !== plan.tension) engine.tension(plan.tension);
    events(i, u, s);
  }
  function start() {
    if (engine) return engine;
    try { engine = new Engine(audio(), { tier: cfg().quality, volume: vol(), enabled: wanted() }); } catch (e) { console.warn('Music could not start.', e); return null; }
    director.wasCover = !document.body.classList.contains('playing'); // a first gesture on the Start button: the cover is still up, so the welcome tune plays and the title is skipped
    engine.hidden = document.hidden; engine.setEnabled(wanted()); engine.panelOpen = false; api.engine = engine;
    pandora?.onHurt?.(() => engine?.hit()); setTimeout(() => { timer = setInterval(() => { try { poll(); } catch (e) { console.warn(e); } }, 250); }, 350);
    return engine;
  }
  onGesture(() => { if (!wanted()) return; if (!engine) start(); else if (engine.audible && engine.ctx.state !== 'running') engine.ctx.resume?.().catch?.(() => { }); });
  const hide = () => engine?.setHidden(document.hidden);
  document.addEventListener('visibilitychange', hide); addEventListener('pagehide', () => engine?.setHidden(true)); addEventListener('pageshow', hide);

  // ---- the Settings rows (Music and Music volume, saved in state.settings) ----
  const rows = () => `<div class="setting" data-music-rows><span><b>Music</b><small>A little tune for every place. Turn it off for quiet.</small></span><button class="toggle" data-music type="button" aria-pressed="${cfg().music !== false}">${cfg().music !== false ? 'On' : 'Off'}</button></div><div class="setting" data-music-rows><span><b>Music volume</b><small>Sound off silences the music too.</small></span><input id="music-vol" type="range" min="0" max="100" step="5" value="${Math.round(vol() * 100)}" ${cfg().music === false ? 'disabled' : ''} aria-label="Music volume" style="height:44px;min-height:44px;min-width:140px"></div>`;
  function settings(modal) {
    if (!modal || modal.querySelector('[data-music-rows]')) return; const at = modal.querySelector('[data-action="sound"]')?.closest('.setting'); if (at) at.insertAdjacentHTML('afterend', rows());
  }
  document.addEventListener('click', e => {
    const b = e.target.closest?.('[data-music]'); if (!b) return; const s = cfg(); s.music = s.music === false; persist(); b.textContent = s.music ? 'On' : 'Off'; b.setAttribute('aria-pressed', String(s.music));
    const r = document.getElementById('music-vol'); if (r) r.disabled = !s.music; if (s.music) { start(); engine?.setEnabled(wanted()); } else engine?.setEnabled(false);
  });
  document.addEventListener('input', e => { if (e.target.id !== 'music-vol') return; cfg().musicVol = Math.max(0, Math.min(1, e.target.value / 100)); engine?.setVolume(vol()); });
  document.addEventListener('change', e => { if (e.target.id === 'music-vol') persist(); });

  const api = {
    engine: null, settings, duck: (db, sec) => { if (engine?.audible) engine.duck(db, sec); },
    /** After every action: the result decides whether a harvest, a catch or a sale earns its little tune. */
    act: (type, result) => { const n = ACT[type]; if (n && result?.ok) note(n); if (type === 'race' && result?.ok) note('victory'); },
    event: note, load, probe, director,
  };
  api.test = makeHooks({ get engine() { return engine; }, director, setForced: f => { forced = f; if (!f) applied = { ko: false }; }, probe, load, poll: () => engine && poll(), stingers: Object.keys(STINGERS), variantOf, get plan() { return plan; }, get ctx() { return engine?.ctx; } });
  return api;
}
