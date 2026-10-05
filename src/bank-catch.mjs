import { FISH_POOLS, atBank, waterDistance } from './pond.mjs';

export const PACK_DISTANCE = 2.5;
const species = new Set(FISH_POOLS.flat());
const bank = p => p && Number.isFinite(p.x) && Number.isFinite(p.z) && atBank(p.x, p.z) && waterDistance(p.x, p.z) > .05;

// A bad anchor must not destroy otherwise valid catches: packBankCatch recovers them on load.
export function parseBankCatch(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const fish = {};
  for (const [id, count] of Object.entries(raw.fish ?? {})) if (species.has(id) && Number.isFinite(count) && count >= 1) fish[id] = Math.min(99999, Math.floor(count));
  return Object.keys(fish).length ? { x: raw.x, z: raw.z, fish } : null;
}

export function collectBankCatch(s) {
  const caught = s.bankCatch; if (!caught) return 0;
  s.bankCatch = null; let total = 0;
  for (const [id, count] of Object.entries(caught.fish)) { s.inventory[id] = (s.inventory[id] ?? 0) + count; total += count; }
  return total;
}

export function packBankCatch(s, position, location = 'village', riding = false) {
  const caught = s.bankCatch;
  if (!caught || bank(caught) && location === 'village' && !riding && position && Math.hypot(position.x - caught.x, position.z - caught.z) <= PACK_DISTANCE) return 0;
  return collectBankCatch(s);
}

export function holdBankCatch(s, id, position) {
  if (!species.has(id) || !bank(position)) return false;
  packBankCatch(s, position);
  const caught = s.bankCatch ??= { x: position.x, z: position.z, fish: {} };
  caught.fish[id] = (caught.fish[id] ?? 0) + 1;
  return true;
}
