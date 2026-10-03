// The village ward as a shape (round 8, step 0; owner: builder A). Pure, no imports: regions.mjs needs it and wilds.mjs
// needs regions.mjs, so it cannot live in wilds.mjs (wilds.mjs re-exports all five names for the files that import them there).
//
// The ward is the village footprint (field-layout.mjs VILLAGE: x -55.5…55.5, z -49…40.5) plus WARD_MARGIN metres on every
// side. On the west, south and east it runs 2 m beyond the outer edge of the ring road (the road with the yellow dashes);
// on the north it runs behind the Town Square and the grove, 2 m beyond their row of trees (tests/village.test.mjs keeps
// the numbers in step). No creature spawns, walks or is pushed inside, so none ever stands on the road.
//
// Round 8 supports a rectangle only: WARD_OUTLINE is the four corners of SAFE (tests/regions.test.mjs asserts it). Nothing
// else in this round's code or tests types a ward number: everything reads these exports.
export const WARD_MARGIN = 1;
export const SAFE = { x0: -56.5, x1: 56.5, z0: -50, z1: 41.5 };
/** The ward line as a simple polygon, clockwise on a north-up map (north-west, north-east, south-east, south-west), axis-aligned sides only. */
export const WARD_OUTLINE = [[SAFE.x0, SAFE.z0], [SAFE.x1, SAFE.z0], [SAFE.x1, SAFE.z1], [SAFE.x0, SAFE.z1]];
/** Inside the ward, or within `pad` metres of it (a negative pad asks for that much room inside the line). */
export const inSafeZone = (x, z, pad = 0) => x > SAFE.x0 - pad && x < SAFE.x1 + pad && z > SAFE.z0 - pad && z < SAFE.z1 + pad;
/** Metres beyond the ward (0 inside it). */
export const wildDepth = (x, z) => { const dx = Math.max(0, SAFE.x0 - x, x - SAFE.x1), dz = Math.max(0, SAFE.z0 - z, z - SAFE.z1); return Math.sqrt(dx * dx + dz * dz); };
