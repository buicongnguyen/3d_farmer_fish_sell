// The stand points of the ring world (round 9 spec 3.5): one point per region in the open, 30 m or more from every den, border and feature.
// The planets' are written for the first draft's order of the sectors and turned into the numbered order by regions.mjs fromZigzag.
// Not a test: the node and browser suites import STAND from here, and `at(id)` for an object.
import { fromZigzag, SECTOR_ID } from '../src/regions.mjs';
const RAW = { east: [90.5, -83], south: [83.5, 81.5], west: [-74.5, 85], north: [-103, -46.5], shadow: [76, -237], lava: [230.5, -86.5], ocean: [237, 76], jungle: [113.5, 221.5], toy: [-37, 256.5], candy: [-240, 45], ice: [-201.5, -138], cloud: [-113.5, -221.5] };
export const STAND = Object.fromEntries(Object.entries(RAW).map(([id, [x, z]]) => { if (!SECTOR_ID.includes(id)) return [id, [x, z]]; const p = fromZigzag(id, x, z); return [id, [Math.round(p.x * 2) / 2, Math.round(p.z * 2) / 2]]; }));
export const at = id => ({ x: STAND[id][0], z: STAND[id][1] });
