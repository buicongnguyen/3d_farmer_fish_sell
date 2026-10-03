// One creature row (round 8, step 0; owner: builder D). Pure, no imports: wilds.mjs and titans.mjs both build their rows
// with it, so neither reads the other while it is being evaluated. Moved, unchanged, out of wilds.mjs.
//
// The reference's facts (hp, damage, speed m/s, reach, sight, radius, cooldown and wind-up in seconds, drawn scale). Coins
// replace its XP at half the number. `level` is the kind's own label; a creature's shown level comes from its spawn plan.
export const creature = (name, hp, damage, speed, coins, behavior, color, extra = {}) =>
  ({ name, hp, damage, speed, coins, behavior, color, accent: '#fff1cf', reach: 1.6, sight: 10, radius: .7, cooldown: 1.5, windup: .45, scale: 1, level: 1, boss: false, flying: false, ...extra });
