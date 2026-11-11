// The guided first ten minutes: one step at a time, worked out from the save, so nothing extra is stored.
// Each step has a hint for the goal chip. The guide ends after the first night.
export const STEPS = [
  {
    id: 'hello',
    icon: '👋',
    title: 'Say hello to Ada',
    hint: 'Walk to Ada’s cottage and press E.',
    done: s => !!s.met?.ada,
  },
  {
    id: 'plant',
    icon: '🌱',
    title: 'Plant a seed',
    hint: 'Go to a garden bed and plant a carrot.',
    done: s => s.beds.some(Boolean) || s.stats.harvests > 0,
  },
  {
    id: 'water',
    icon: '💧',
    title: 'Water your crop',
    hint: 'Stand at the bed and press E to water.',
    done: s => s.beds.some(b => b?.watered) || s.stats.harvests > 0,
  },
  {
    id: 'sleep',
    icon: '🌙',
    title: 'Sleep until morning',
    hint: 'Go home and sleep: crops grow overnight.',
    done: s => s.day > 1,
  },
  {
    id: 'harvest',
    icon: '🧺',
    title: 'Harvest your crop',
    hint: 'Your carrot is ready. Press E at the bed.',
    done: s => s.stats.harvests > 0,
  },
  {
    id: 'sell',
    icon: '🪙',
    title: 'Sell it at the market',
    hint: 'Take your harvest to the market counter.',
    done: s => s.stats.sales > 0,
  },
];

/** The step the player is on, or null once the first ten minutes are over. */
export const guideStep = s => (s.day > 2 || s.chapter > 0 ? null : (STEPS.find(step => !step.done(s)) ?? null));

/** Steps done so far, for the "2 / 6" counter. */
export const guideProgress = s => STEPS.filter(step => step.done(s)).length;
