// Walking into the five Town Square buildings. Installed on the first entry (main.mjs fetches this file with import()), it adds
// world.enterFacility(id) and wraps world.buildInterior and world.exit, so world.mjs stays as it is: the building is "interior"
// like a house (location 'interior', houseId null) and world.facility = {id, plan, name} says which. The props (facility-props.glb,
// about 400 KB, 27 pieces) are fetched once, baked like the house kit and put in world.assets. Everything built on entering is
// disposed on leaving (facility-interior.mjs).
//
//   installFacilities(world, {state(), openPanel(name, arg), toast(text), hud()}) -> {enter(id), leave(), ...}
import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { bake } from './world.mjs';
import { SPAWN } from './home-plan.mjs';
import { installRoomView } from './room-view.mjs';
import { FACILITIES } from './facility-plans.mjs';
import { buildFacility, leaveFacility, animatePeople, peopleKey } from './facility-interior.mjs';

export function installFacilities(world, deps) {
  if (world.__facilities) return world.__facilities;
  const view = installRoomView(world), buildHouse = world.buildInterior.bind(world), exitWorld = world.exit.bind(world);
  let loading = null, clock = 0, last = performance.now(), check = 0;
  const loadProps = () => loading ??= (async () => {
    const gltf = await new GLTFLoader().loadAsync('./assets/models/facility-props.glb');
    for (const child of gltf.scene.children) { const root = new T.Group(), copy = child.clone(true); copy.position.set(0, 0, 0); root.add(copy); world.assets.set(child.name, bake(root)); }
  })().catch(error => { loading = null; throw error; });
  const build = () => { const f = world.facility; f.people = peopleKey(f.plan, deps.state()); buildFacility(world, { plan: f.plan, deps }); };
  world.buildInterior = () => world.facility ? build() : buildHouse();
  world.exit = (...args) => { if (world.facility) { const plan = world.facility.plan; world.facility = null; leaveFacility(world, plan); } return exitWorld(...args); };
  async function enter(id) {
    const plan = FACILITIES[id]; if (!plan || world.location !== 'village') return false;
    try { await loadProps(); } catch (error) { console.warn('The building could not open.', error); deps.toast('The door is stuck for now. Try again in a moment.'); return false; }
    if (world.location !== 'village') return false;
    world.dismount(); world.returnPosition = world.player.position.clone(); world.houseId = null; world.facility = { id, plan, name: plan.name, people: '' };
    world.location = 'interior'; world.outside.visible = false; world.inside.visible = true; world.buildInterior();
    world.player.position.set(SPAWN.x, 0, SPAWN.z); world.follow.set(0, 0, 0); world.clearMovement(); world.resize();
    deps.toast(`Welcome to ${plan.name}.`); deps.hud?.();
    return true;
  }
  // Per frame: idle poses, and a rebuild when the hour brings or takes someone (checked twice a second).
  view.onFrame(() => {
    const now = performance.now(), dt = Math.min(.1, (now - last) / 1000); last = now;
    if (!world.facility || world.location !== 'interior') return;
    clock += dt; animatePeople(world, clock);
    if ((check -= dt) <= 0) { check = .5; const f = world.facility; if (!world.paused && peopleKey(f.plan, deps.state()) !== f.people) world.buildInterior(); }
  });
  return world.__facilities = { enter, loadProps, buildHouse };
}
