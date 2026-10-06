// Distant clothing detail has little effect on a shadow in the wider driving view.
// Keep nearby silhouettes, with hysteresis so crossing the range does not flicker.
export const SHADOW = { on: 30, off: 38, rideOn: 14, rideOff: 20 };
// With `proxy` (shadow-proxy.mjs, once it has loaded) the head and the body cast through a low-polygon hull made the first time.
export function updateVillagerShadow(n, gap, riding, proxy) {
  const on = gap < (riding ? n.shadow ? SHADOW.rideOff : SHADOW.rideOn : n.shadow ? SHADOW.off : SHADOW.on);
  // A late outfit load replaces the meshes even when the distance policy stays on.
  if (on === n.shadow && n.shadowMesh === n.mesh) return;
  n.shadow = on; n.shadowMesh = n.mesh;
  n.mesh.traverse(m => {
    if (!m.isMesh || m.userData?.shadowOf) return;
    const c = on && (m.parent?.name === 'head' || m.parent?.name === 'body');
    if (c && proxy) proxy.rigid(m);
    const p = m.userData?.proxy;
    if (p) { p.castShadow = c; m.castShadow = false; } else m.castShadow = c;
  });
}
// The heads and bodies get their proxies ahead of need, one a frame (2 to 5 ms each, once per outfit), so a villager walking into
// range casts through a proxy from its first shadowed frame instead of making one then.
const WARM = ['head', 'body'];
export function warmVillagerProxy(npcs, proxy) {
  for (const n of npcs) {
    if (n.proxyWarm === n.mesh) continue;
    const parts = n.mesh.userData.parts; if (!parts || n.mesh.userData.pending) continue;
    for (const key of WARM) for (const m of parts[key]?.children ?? []) if (m.isMesh && !m.userData.shadowOf && !m.userData.proxy && !m.userData.noProxy) { proxy.rigid(m); return; }
    n.proxyWarm = n.mesh;
  }
}
