// Frame clients register while the village loads. The full indoor camera is installed after the first village frame.
export function installRoomView(world) {
  if (world.__roomView) return world.__roomView;
  const before = [], after = [];
  return world.__roomView = {
    camera: world.camera, swapIn() {}, swapOut() {}, frame: () => null, room: () => null,
    onFrame: f => before.push(f), onAfter: f => after.push(f),
    initialize(factory) {
      Object.assign(this, factory(world));
      for (const f of before) this.onFrame(f);
      for (const f of after) this.onAfter(f);
      before.length = after.length = 0; delete this.initialize;
      return this;
    },
  };
}
