import { CROPS, iconUrl } from './content.mjs';
import { act, ripe } from './game.mjs';
import { bedState, readyIn } from './growth.mjs';
import { fieldCounts, fieldBatch } from './field-batch.mjs';
export function renderFields(root, s, index, done) {
  const b = s.beds[index],
    counts = fieldCounts(s),
    button = (label, type, crop = '', disabled = false) =>
      `<button class="primary" data-field="${type}" data-crop="${crop}" ${disabled ? 'disabled' : ''}>${label}</button>`;
  const current = b
    ? `<div class="note"><b>${CROPS[b.crop].name} · Garden bed ${index + 1}</b><p>${bedState(b, CROPS, !!s.settings?.test) === 'ripe' ? 'Ready to harvest.' : !b.watered ? 'Water this bed, then sleep: crops grow overnight.' : `Growing · ${readyIn(b, CROPS)}.`}</p>${ripe(s, b) ? button('Harvest this bed', 'harvest', '') : b.watered ? button('Harvest this bed', 'harvest', '', true) : button('Water this bed', 'water', '', s.energy < 1)}</div>`
    : '';
  root.innerHTML = `<p class="panel-intro">Choose a crop to plant in this bed, or plant all empty family beds. Seeds and energy limit how many you can plant. Growing crops stay in place. Water planted beds each day, then sleep: crops grow overnight. Rain waters them for you.</p>${current}<div class="note">${counts.empty} empty beds · ${counts.ready} ripe beds<div class="button-row">${button('Harvest all (' + counts.ready + ')', 'harvest-all', '', !counts.ready)}</div></div><div class="card-grid">${Object.entries(
    CROPS,
  )
    .map(([crop, c]) => {
      const n = fieldCounts(s, crop).plant;
      return `<article class="shop-item"><img class="item-art" src="${iconUrl(c.icon)}" alt=""><div><strong>${c.name}</strong><p>${c.free ? 'Free cutting' : (s.inventory['seed_' + crop] ?? 0) + ' seeds owned'} · ${c.grow}s after watering · ${c.yield} ${c.flower ? 'flowers' : 'crops'} · sells ${c.sell}</p><div class="button-row">${button('Plant this bed', 'plant', crop, !!b || !n)}${button('Plant all (' + n + ')', 'plant-all', crop, !n)}</div></div></article>`;
    })
    .join('')}</div>`;
  root.onclick = e => {
    const button = e.target.closest('[data-field]');
    if (!button || button.disabled) return;
    const type = button.dataset.field,
      crop = button.dataset.crop;
    const all = type.endsWith('-all'),
      action = all ? type.slice(0, -4) : type;
    done(action, all ? fieldBatch(s, action, crop) : act(s, action, { index, crop }));
  };
}
