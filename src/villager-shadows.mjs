// Distant clothing detail has little effect on a shadow in the wider driving view.
// Keep nearby silhouettes, with hysteresis so crossing the range does not flicker.
export const SHADOW = { on: 30, off: 38, rideOn: 14, rideOff: 20 };
export function updateVillagerShadow(n, gap, riding) {
  const on = gap < (riding ? n.shadow ? SHADOW.rideOff : SHADOW.rideOn : n.shadow ? SHADOW.off : SHADOW.on);
  // A late outfit load replaces the meshes even when the distance policy stays on.
  if (on === n.shadow && n.shadowMesh === n.mesh) return;
  n.shadow = on; n.shadowMesh = n.mesh;
  n.mesh.traverse(m => { if (m.isMesh) m.castShadow = on && (m.parent?.name === 'head' || m.parent?.name === 'body'); });
}
