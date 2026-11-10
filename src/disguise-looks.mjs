// What the disguise skills look like (fetched with the box; skill-looks.mjs asks for them). Every look is built from the pooled effects
// combat-fx-draw.mjs owns (instanced chips and glow sparks, instanced rings, slash arcs), so a burst adds no draw call. n is the density
// (0.5 on phones, under the governor and on battery). 'hero' is the player's own aura; the pose, the size and the helper models are disguise-models.mjs's.
const TAU = Math.PI * 2;
const R = (fx, x, z, r, c, life = 0.5, from = 0.4) => fx.ring(x, z, r, c, life, from);
const B = (fx, x, y, z, n, c, sp, up, size, life, glow = true) =>
  fx.burst(x, y, z, Math.max(1, Math.ceil(n)), c, sp, up, size, life, glow);
const ring = (fx, x, z, r, n, c, y, size = 0.55, life = 0.5) => {
  const m = Math.max(4, Math.ceil(n));
  for (let i = 0; i < m; i++) {
    const a = (i / m) * TAU;
    fx.sparks.emit(
      x + Math.cos(a) * r,
      y,
      z + Math.sin(a) * r,
      0,
      0.6,
      0,
      life,
      size,
      Array.isArray(c) ? c[i % c.length] : c,
      0,
    );
  }
};
const beam = (fx, x, z, r, f, n, c, y = 1.1) => {
  const m = Math.max(2, Math.ceil(r * 2 * n));
  for (let i = 0; i <= m; i++) {
    const d = 0.8 + (i / m) * Math.max(0, r - 0.8);
    fx.sparks.emit(
      x + Math.sin(f) * d,
      y,
      z + Math.cos(f) * d,
      0,
      0,
      0,
      0.35,
      0.7,
      Array.isArray(c) ? c[i % c.length] : c,
      0,
    );
  }
};
const up1 = (fx, x, z, c, size = 0.6) => fx.sparks.emit(x, 2.4, z, 0, 1, 0, 0.6, size, c, 0);
export const DLOOKS = {
  lift(fx, x, z, r, f, n) {
    R(fx, x, z, r, '#ffffff', 0.5);
    B(fx, x, 0.2, z, 10 * n, ['#ffffff', '#cfe0ff'], 3, 6, 0.14, 0.7);
  },
  portal(fx, x, z, r, f, n) {
    R(fx, x, z, 1.4, '#c9a8ff', 0.35, 0.1);
    B(fx, x, 0.8, z, 10 * n, ['#c9a8ff', '#ffffff', '#7f6fff'], 4, 3, 0.14, 0.5);
  },
  crater(fx, x, z, r, f, n) {
    R(fx, x, z, r, '#ffe0b0', 0.45, 0.5);
    B(fx, x, 0.2, z, 14 * n, ['#c96a3a', '#e8c39a', '#ffffff'], 6, 6, 0.17, 0.8, false);
    fx.shake(0.35);
  },
  eyes(fx, x, z, r, f, n) {
    beam(fx, x, z, r, f, n * 0.6, ['#ff3b30', '#ffb347'], 1.5);
  },
  burn(fx, x, z, r, f, n) {
    B(fx, x, 0.6, z, 5 * n, ['#ff6a3a', '#ffe66d'], 3, 3, 0.12, 0.4);
  },
  shield(fx, x, z, r, f, n) {
    R(fx, x, z, r, '#a1fbdf', 0.6, r * 0.5);
    ring(fx, x, z, r * 0.8, 8 * n, ['#a1fbdf', '#ffffff'], 1.1, 0.5, 0.5);
  },
  heal(fx, x, z, r, f, n) {
    R(fx, x, z, r, '#bbffb9', 0.7, 0.5);
    for (let i = 0; i < 10 * n; i++) {
      const a = Math.random() * TAU,
        d = Math.random() * r;
      fx.sparks.emit(
        x + Math.cos(a) * d,
        0.1,
        z + Math.sin(a) * d,
        0,
        1.6,
        0,
        1.2,
        0.5,
        i % 2 ? '#ff9ec8' : '#bbffb9',
        0,
      );
    }
  },
  poof(fx, x, z, r, f, n) {
    R(fx, x, z, r, '#c0ace8', 0.45, 0.4);
    B(fx, x, 0.7, z, 14 * n, ['#c0ace8', '#ffffff', '#6a5a9a'], 4, 3, 0.16, 0.7, false);
  },
  bats(fx, x, z, r, f, n) {
    R(fx, x, z, r, '#6a3d9a', 0.5, 0.4);
    B(fx, x, 1, z, 14 * n, ['#3b2560', '#6a3d9a', '#b0203a'], 5, 4, 0.15, 0.8, false);
  },
  tail(fx, x, z, r, f, n) {
    fx.slash(x, z, f, r, '#8fe08a', 0.6);
    fx.slash(x, z, f + Math.PI, r, '#8fe08a', 0.6);
    R(fx, x, z, r, '#5fbf5a', 0.4, 1);
  },
  bite(fx, x, z, r, f, n) {
    B(fx, x + Math.sin(f) * 1.6, 1, z + Math.cos(f) * 1.6, 10 * n, ['#ffffff', '#d4e79a', '#b0203a'], 4, 3, 0.13, 0.4);
    fx.slash(x, z, f, 2, '#ffffff', 1);
  },
  smoke(fx, x, z, r, f, n) {
    R(fx, x, z, r, '#c8c8d8', 0.9, 0.5);
    B(fx, x, 0.6, z, 22 * n, ['#9a9aa8', '#c8c8d8', '#ffffff'], 6, 2, 0.26, 1.2, false);
  },
  roar(fx, x, z, r, f, n) {
    R(fx, x, z, r, '#79c487', 0.6, 1);
    R(fx, x, z, r * 0.6, '#ffffff', 0.45, 0.5);
    fx.shake(0.3);
  },
  taunt(fx, x, z, r, f, n) {
    R(fx, x, z, r, '#ff6a4a', 0.7, 1);
    R(fx, x, z, r * 0.5, '#ffe0a0', 0.5, 0.5);
  },
  hearts(fx, x, z, r, f, n) {
    for (let i = 0; i < 8 * n; i++)
      fx.sparks.emit(
        x + (Math.random() - 0.5) * 1.5,
        0.6,
        z + (Math.random() - 0.5) * 1.5,
        0,
        2,
        0,
        1.2,
        0.6,
        i % 2 ? '#ff80bd' : '#ffd0e6',
        0,
      );
  },
  sheepspell(fx, x, z, r, f, n) {
    R(fx, x, z, r, '#ccbae8', 0.7, 0.6);
    B(fx, x, 1, z, 14 * n, ['#ffffff', '#ccbae8'], 3, 3, 0.2, 0.9, false);
  },
  roots(fx, x, z, r, f, n) {
    R(fx, x, z, r, '#aad487', 0.7, 0.6);
    B(fx, x, 0.1, z, 8 * n, ['#aad487', '#5b8a3a'], 4, 5, 0.16, 0.6, false);
  },
  drain(fx, x, z, r, f, n) {
    beam(fx, x, z, r, f, n * 0.8, ['#ea7a9c', '#ffffff']);
  },
  moon(fx, x, z, r, f, n) {
    R(fx, x, z, r, '#cf6290', 0.6, 0.5);
    ring(fx, x, z, r * 0.9, 10 * n, ['#cf6290', '#ffb3c8'], 0.7, 0.6, 0.6);
  },
  blackhole(fx, x, z, r, f, n) {
    R(fx, x, z, r, '#9c8ee5', 0.5, r);
    ring(fx, x, z, 2.5, 8 * n, ['#2a1f5a', '#9c8ee5'], 0.8, 0.7, 0.45);
    B(fx, x, 0.8, z, 6 * n, ['#2a1f5a', '#bc97ed'], 2, 1, 0.2, 0.5);
  },
  holy(fx, x, z, r, f, n) {
    R(fx, x, z, r, '#fff1b0', 0.8, r);
    for (let i = 0; i < 8 * n; i++)
      fx.sparks.emit(x + (Math.random() - 0.5) * 2, 6, z + (Math.random() - 0.5) * 2, 0, -9, 0, 0.6, 0.8, '#fff1b0', 0);
  },
  holyhit(fx, x, z, r, f, n) {
    R(fx, x, z, r, '#fff1b0', 0.45, 0.5);
    B(fx, x, 0.4, z, 22 * n, ['#fff1b0', '#ffffff'], 7, 6, 0.15, 0.7);
    fx.shake(0.4);
    fx.freeze(0.05);
  },
  boulder(fx, x, z, r, f, n) {
    for (let i = 0; i < 6; i++)
      fx.sparks.emit(
        x + (Math.random() - 0.5),
        7,
        z + (Math.random() - 0.5),
        0,
        -14,
        0,
        0.6,
        1.1,
        i % 2 ? '#c96a3a' : '#ffb06a',
        0,
      );
  },
  charge(fx, x, z, r, f, n) {
    ring(fx, x, z, 1.2, 8 * n, ['#ffad6b', '#ffe66d'], 1.3, 0.6, 0.7);
  },
  silk(fx, x, z, r, f, n) {
    fx.slash(x, z, f, 3, '#ffb3cf', 1.2);
    B(
      fx,
      x + Math.sin(f) * 1.6,
      1.1,
      z + Math.cos(f) * 1.6,
      12 * n,
      ['#ffb3cf', '#fff0f8', '#ffd35e'],
      5,
      2,
      0.15,
      0.6,
    );
  },
  flame(fx, x, z, r, f, n) {
    B(
      fx,
      x + Math.sin(f) * 1.2,
      0.9,
      z + Math.cos(f) * 1.2,
      12 * n,
      ['#ffb347', '#ff6b3a', '#ffe66d'],
      5,
      3,
      0.16,
      0.5,
    );
    R(fx, x, z, 1.6, '#ff874c', 0.3, 0.8);
  },
  hook(fx, x, z, r, f, n) {
    beam(fx, x, z, r, f, n, ['#d6c19b', '#ffffff'], 1.2);
  },
  parrot(fx, x, z, r, f, n) {
    R(fx, x, z, 12, '#8ae394', 0.8, 1);
    B(fx, x, 2, z, 8 * n, ['#8ae394', '#ff6a4a', '#ffe66d'], 3, 5, 0.16, 1);
  },
  cannonfall(fx, x, z) {
    fx.sparks.emit(x - 1, 5, z, 2, -10, 0, 0.5, 0.9, '#dca66c', 0);
    fx.sparks.emit(x, 3.5, z, 0, -7, 0, 0.5, 0.6, '#ffffff', 0);
  },
  icefield(fx, x, z, r, f, n) {
    R(fx, x, z, r, '#c2f1ff', 0.8, r * 0.6);
    B(fx, x, 0.1, z, 10 * n, ['#c2f1ff', '#ffffff'], 6, 1, 0.16, 0.6);
  },
  iceage(fx, x, z, r, f, n) {
    R(fx, x, z, r, '#d0f7ff', 0.8, 1);
    B(fx, x, 0.8, z, 20 * n, ['#d0f7ff', '#ffffff', '#9fe8ff'], 6, 4, 0.14, 0.8);
    fx.shake(0.25);
  },
  freeze(fx, x, z, r, f, n) {
    R(fx, x, z, r, '#ffffff', 0.4, 0.5);
    B(fx, x, 0.8, z, 22 * n, ['#d0f7ff', '#ffffff'], 7, 6, 0.14, 0.6);
    fx.shake(0.3);
  },
  shock(fx, x, z, r, f, n) {
    R(fx, x, z, r, '#6ff2ff', 0.3, 0.5);
    B(fx, x, 0.4, z, 5 * n, ['#6ff2ff', '#ffffff'], 4, 2, 0.12, 0.3);
  },
  st_fear(fx, x, z) {
    up1(fx, x, z, '#79c487');
  },
  st_blind(fx, x, z) {
    up1(fx, x, z, '#9a9aa8');
  },
  st_sheep(fx, x, z) {
    up1(fx, x, z, '#ffffff', 0.7);
  },
  st_charm(fx, x, z) {
    up1(fx, x, z, '#ff80bd', 0.7);
  },
  st_taunt(fx, x, z) {
    up1(fx, x, z, '#ff6a4a');
  },
  /** The player's own aura (r: 5 armour, 6 blood moon). Height, size, the bubble, the fade and the bats are disguise-models.mjs's, read from Combat itself. */
  hero(fx, x, z, r, f, n) {
    const p = fx.world?.player?.position;
    if (!p || !r) return;
    const c = r === 5 ? '#ffe0a0' : '#cf6290';
    for (let i = 0; i < 3 * n; i++) {
      const a = Math.random() * TAU;
      fx.sparks.emit(
        p.x + Math.cos(a) * 1.1 * z,
        1 + Math.random() * 1.2 * z,
        p.z + Math.sin(a) * 1.1 * z,
        0,
        0.3,
        0,
        0.4,
        0.5,
        c,
        0,
      );
    }
  },
};
