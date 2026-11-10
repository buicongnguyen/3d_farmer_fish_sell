// What the first frame needs to know about a creature without loading the creature simulation (wilds.mjs).
/** A creature that has noticed someone: alive and not idle or walking back. */
export const aggro = e => e.hp > 0 && e.phase !== 'idle' && e.phase !== 'return';
