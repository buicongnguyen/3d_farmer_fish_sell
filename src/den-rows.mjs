// The 26 den rows of the ring world (round 9, stage 1). Pure, no imports, so regions.mjs can call denRows(RING) without a cycle.
// A home row gives a bearing (degrees clockwise from north); a planet row an angle clockwise into its sector from the sector's first radial.
// Rows are written as R1 + a and R2 - b so the dens follow the circles. Each row is [type, region, rho, bearing or angle, leash, event].
export const denRows = ({ R1, R2 }) => {
  const h = (type, region, rho, bearing) => ({ type, region, rho, bearing }), p = (type, region, rho, angle, leash, event) => ({ type, region, rho, angle, leash, event });
  return [
    h('treant', 'west', R1 - 38, 245), h('croc', 'north', R1 - 38, 335), h('mushking', 'south', R1 - 38, 155), h('bear', 'east', R1 - 38, 65), h('titan_turtle', 'east', R1 - 43, 25),
    p('shadowlord', 'shadow', R1 + 44, 14), p('titan_eye', 'shadow', R2 - 44, 31),
    p('golem', 'lava', R1 + 45.5, 22.5, 24), p('dragon', 'lava', R2 - 45.5, 10.5, 24, 'dragon'), p('titan_scorpion', 'lava', R2 - 45.5, 34.5),
    p('leviathan', 'ocean', R1 + 44, 14), p('titan_kraken', 'ocean', R2 - 44, 31),
    p('gorilla', 'jungle', R1 + 44, 14), p('titan_flower', 'jungle', R2 - 44, 31),
    p('robot', 'toy', R1 + 44, 14), p('titan_clock', 'toy', R2 - 44, 31),
    p('cake', 'candy', R1 + 41, 16.8, 24), p('gingerbread', 'candy', R1 + 48, 33.5, 24), p('jellyqueen', 'candy', R2 - 41, 9.5, 24), p('titan_hydra', 'candy', R2 - 41, 24),
    p('yeti', 'ice', R1 + 41, 16.8, 24), p('mammoth', 'ice', R1 + 48, 33.5, 24), p('frostowl', 'ice', R2 - 41, 9.5, 24), p('titan_crystal', 'ice', R2 - 41, 24),
    p('phoenix', 'cloud', R1 + 44, 14), p('titan_whale', 'cloud', R2 - 44, 31),
  ];
};
