// Screen-sized names: no extra WebGL meshes, and the closest visible neighbours win crowded space.
export function nameLayout(candidates, width, height, obstacles = []) {
  const portrait = width < 600, phone = Math.min(width, height) < 600;
  const top = portrait ? 148 : 112, bottom = height - (portrait ? 210 : 48), out = [];
  candidates.sort((a, b) => a.distance - b.distance || a.id.localeCompare(b.id));
  for (const c of candidates) {
    const w = Math.ceil(c.name.length * 6.6) + 16, x = Math.round(c.x - w / 2), y = Math.round(c.y - 24);
    if (x < 12 || x + w > width - 12 || y < top || y + 20 > bottom) continue;
    if (obstacles.some(r => x < r.right + 4 && x + w + 4 > r.left && y < r.bottom + 4 && y + 24 > r.top)) continue;
    if (out.some(p => x < p.x + p.w + 8 && x + w + 8 > p.x && y < p.y + 24 && y + 24 > p.y)) continue;
    out.push({ ...c, x, y, w }); if (out.length >= (phone ? 6 : 10)) break;
  }
  return out;
}

export function installVillagerLabels(world) {
  const layer = document.createElement('div'); layer.id = 'villager-names'; layer.setAttribute('aria-hidden', 'true');
  (document.getElementById('app') ?? document.body).append(layer);
  const labels = new Map();
  const hud = [...document.querySelectorAll('.player-card,.top-actions,.minimap,.tracker-stack,#action-wrap,#toast,#joystick,#touch-action,.home-button')];
  let obstacles = [], checked = 0;
  for (const n of world.npcs) {
    const node = document.createElement('span'); node.textContent = n.p.name; node.dataset.villager = n.p.id; node.hidden = true;
    layer.append(node); labels.set(n.p.id, node);
  }
  const frame = () => {
    layer.hidden = world.location !== 'village' || world.paused || world.fishing;
    if (layer.hidden) return;
    if (performance.now() > checked) { checked = performance.now() + 250; obstacles = hud.filter(n => n.offsetParent && (n.id !== 'toast' || n.classList.contains('show'))).map(n => n.getBoundingClientRect()); }
    const me = world.player.position, range = Math.max(28, Math.min(100, world.zoom * 2.5)), candidates = [];
    for (const n of world.npcs) {
      if (n.inside || !n.mesh.visible || n === world.villagers?.talk.who) continue;
      const at = n.mesh.position, distance = Math.hypot(at.x - me.x, at.z - me.z);
      if (distance > range) continue;
      const p = world.project(at.x, at.z, at.y + (n.p.child ? 1.75 : 2.35));
      candidates.push({ id: n.p.id, name: n.p.name, x: p.x, y: p.y, distance });
    }
    const selected = nameLayout(candidates, innerWidth, innerHeight, obstacles), shown = new Set(selected.map(n => n.id));
    for (const [id, node] of labels) node.hidden = !shown.has(id);
    for (const n of selected) {
      const node = labels.get(n.id), at = `${n.x}:${n.y}`;
      if (node.dataset.at !== at) { node.dataset.at = at; node.style.transform = `translate(${n.x}px,${n.y}px)`; node.style.width = n.w + 'px'; }
    }
  };
  world.__roomView.onAfter(frame);
  return { layer, frame };
}
