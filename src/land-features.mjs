// Where each land's terrain features are (round 8, step 0 stub; owner: builder B, who replaces everything below). Pure.
//   FEATURES            {toy: {tracks, ponds}, lava: {pools, vents, nest, nestIslands}, ...}, built once, by rule
//   landClear(x, z, r = 0, where = 'land')
//                       where 'land': false on a pond, pool, the nest, a rail or the sea (blocking pieces, land cards, land creatures)
//                       where 'sea':  true only in the sea, r metres inside its edge (coral cards, the sea kinds)
//   waterAt(x, z)       true in the Beach's sea
//   blockers(id)        [{x, z, r, carOnly}]: the round things of a region that stop movement (ponds: everyone; lava pools and the nest: cars only)
//
// STUB (step 0): there are no features yet, so everything is clear land, nothing is water and nothing blocks.
export const FEATURES = {};
export const landClear = (x, z, r = 0, where = 'land') => true;
export const waterAt = (x, z) => false;
export const blockers = id => [];
