// Draws the wild creatures (wilds.mjs), after Zoo Garden's creature art and body language (cute_game src/creature-art.ts,
// world.ts animateEnemy / updateEnemyVisual). The models come from wild-creatures.glb (scripts/trim-creatures.mjs): a root
// node per creature with one rigid child per part, `<id>_<part>`, whose origin is the hinge. Each part's pieces are merged
// with their colours baked into the vertices, so a creature is one draw for the body plus four legs or two wings, and every
// creature shares one vertex-colour toon material (the same shader as Willowmere's baked scenery, nothing new to compile).
//
// The file is fetched only when the box is first opened. Level of detail by distance from the view's centre: within
// 16 m a creature is its animated parts; past 20 m it is one merged mesh (legs and wings at rest, one draw); in between
// it keeps the look it has. It casts a shadow as far as the screen reaches, and beyond the view it is hidden and, a
// little farther, has no model at all (the model goes back to a pool per kind).
//
// Round 8: a kind may have no model of its own. Zoo Garden draws 22 of its land creatures and 11 of its bosses with its
// own procedural code (world.ts speciesModel), and that code is their art: it is ported here (speciesTemplate) and merged into
// one vertex-coloured mesh on the same toon material, 1 draw, 3 for a winged one. The same shapes stand in for a modelled
// kind until its file arrives: every land has its own small file (LAND_KITS), fetched when you come within 96 m of its square.
// Also here: the bosses' telegraph discs, the per-shot colour, the creatures of the sea drawn half a metre down, stealth, and
// in the Night Land's dark the creatures hidden outside every light with their eyes glinting (one instanced draw).
//
// Nothing here flips from one frame to the next (creature-lod.mjs): the simulation steps every 25 ms (a calm creature
// far away only on every 4th step) while the picture is drawn every frame, so a creature is drawn gliding between the
// place it left and the place the simulation has it (wilds.mjs glideShare); whether it walks is read from the speed
// it is drawn at, with two thresholds; its walking pose (the hop, the leg swing) fades in and out; its facing turns at
// a limited rate; and the switch between the two looks waits until the limbs are at rest, where both look alike.
//
// The split build (scripts/build.mjs): this file is read before the first frame, so it holds only what the box-shut game and
// the other modules need at once: the tables, the class with its fields, and the few cheap methods. The drawing itself (reading
// the files, the reference's procedural creatures, the body language, the per-frame update, the eye glints) is wilds-draw.mjs,
// fetched by the first load() (the box's first opening) and put onto this class's prototype. Until then the methods below draw
// nothing, and the ones that take a file or a template wait for it, so a caller never needs to know which half has arrived.
import * as T from 'three';
import { toon } from './toon.mjs';
import { CREATURES } from './wilds.mjs';
import { MIX } from './region-mix.mjs';
import { LOD } from './creature-lod.mjs';

export const CREATURE_FILE = './assets/models/wild-creatures.glb';
/**
 * A square's own creature file and the roots it holds (trimmed from Zoo Garden's creatures.glb by scripts/trim-creatures.mjs;
 * the forest's hawk is the bird already shipped in forest-birds.glb). Fetched with the box open, within KIT_REACH metres of
 * the square. The toy land, the beach and the Night Land have none: every kind there is procedural (or the crab's).
 */
export const LAND_KITS = Object.freeze({
  west: ['./assets/models/forest-birds.glb', ['forest_raptor']],
  candy: ['./assets/models/c-candy.glb', ['jelly', 'gummy']],
  ice: ['./assets/models/c-ice.glb', ['snowball', 'penguin', 'icebloom', 'yeti', 'mammoth']],
  lava: ['./assets/models/c-lava.glb', ['magmaslime', 'minislime', 'firelizard', 'magmacrab']],
  jungle: ['./assets/models/c-jungle.glb', ['chameleon', 'flytrap']],
  cloud: ['./assets/models/c-cloud.glb', ['cloudsheep']],
});
export const KIT_REACH = 96, WARM = 6;
/** Eye glints in the dark (Zoo Garden's world.ts eyeGlints): within 22 m, two per creature, 1.25 m up and 0.56 m forward on the unscaled model. */
export const GLINT = Object.freeze({ reach: 22, max: 48, up: 1.25, forward: .56, side: .18, size: .15, hole: .8, holes: 6, color: '#fff3a6' });
/** The animation's hinge names: it swings leg1 with leg2 and leg0 with leg3 (a trot). */
export const HINGES = { leg_bl: 'leg0', leg_fl: 'leg1', leg_br: 'leg2', leg_fr: 'leg3', wing_l: 'wing-l', wing_r: 'wing-r' };
/**
 * Hidden beyond `hide` metres from the view's centre (more when the camera is zoomed out); animated parts within `near`,
 * the merged mesh past `far`. A model is made within `attach` metres past the view and put away `detach` metres past it.
 */
export const VIEW = { hide: 46, near: LOD.near, far: LOD.far, attach: 10, detach: 26 };
/** Facing turns at most this fast (radians a second): calm, and when it is after you. */
export const TURN = { calm: 5, alert: 14 };
export const SHOT_COLORS = { pea: '#c4ec9f', ice: '#a9eeff', fire: '#ff985f', bubble: '#b6eaff', spike: '#cae482', arrow: '#ffe689', star: '#ffe689', volt: '#8fdcff', rainbow: '#ff9cf5' };
/** The dragon's fire rain, as it falls (the colour of a boss's meteor rain). */
export const FIRE_MARK = '#ff7a1f';
// Hot loops use plain indexed loops and this instead of for-of and Math.hypot: neither makes garbage in any JIT tier.
const len = (x, z) => Math.sqrt(x * x + z * z);

export class WildsView {
  /** @param world the Willowmere World. Nothing joins the scene until mount() (the first time the box is opened). */
  constructor(world) {
    this.world = world; this.root = new T.Group(); this.root.name = 'wild-creatures';
    this.material = toon({ vertexColors: true }); this.flash = toon({ vertexColors: true, emissive: '#ffffff', emissiveIntensity: .38 }); // a soft wash: the shape stays readable
    this.templates = new Map(); this.free = new Map(); this.icons = new Map(); this.loading = null; this.ready = false; this.visible = 0; this.failed = false;
    this.kits = new Map(); this.warming = []; this.stand = new Set(); this.glinting = 0;
    // Shots (the creatures' and the player's): one instanced draw, a colour each. 32 of the creatures' (a barrage is 20), 10 of the player's, 6 spare.
    this.shots = new T.InstancedMesh(new T.IcosahedronGeometry(.17, 1), new T.MeshBasicMaterial({ toneMapped: false }), 48);
    this.shots.setColorAt(0, new T.Color('#ffffff')); this.shots.count = 0; this.shots.frustumCulled = false; this.shots.castShadow = false; this.shots.raycast = () => {}; this.root.add(this.shots);
    this.m4 = new T.Matrix4(); this.spine = new T.Color('#fff1cf'); this.tints = new Map();
    // Eye glints: made the first time the dark needs them.
    this.eyes = null; this.candidates = []; this.lights = Array.from({ length: 16 }, () => ({ x: 0, z: 0, r: 0 }));
  }
  /** Creatures are children of world.outside, so they hide with the village. */
  mount() { if (!this.root.parent) this.world.outside.add(this.root); }
  /** The drawing code (wilds-draw.mjs), once; a failed fetch is tried again on the next call. */
  code() { return this.coding ??= import('./box-draw.mjs').then(m => { m.installView(WildsView); }).catch(error => { this.coding = null; throw error; }); }
  /** Fetches the drawing code and prepares the creature kit (once). Resolves when creatures can be drawn. */
  load() {
    return this.loading ??= this.code().then(() => this.read(CREATURE_FILE)).then(() => { this.ready = this.templates.size > 0; })
      .catch(error => { console.error('The wild creatures could not load.', error); this.failed = true; this.loading = null; });
  }
  // Until wilds-draw.mjs has arrived: these wait for it, then run its own version (install replaces them on the prototype)...
  read(url, names = null) { return this.code().then(() => this.read(url, names)); }
  addTemplate(type, group) { return this.code().then(() => this.addTemplate(type, group)); }
  addKit(url, names = []) { return this.code().then(() => this.addKit(url, names)); }
  // ...and these have nothing to do yet: nothing is drawn, no template exists, no file is asked for.
  near() {}
  update() { this.visible = 0; this.glinting = 0; }
  template() { return null; }
  attach() {}
  icon() { return ''; }
  release() {}
  /** Pool pre-warm: asks for WARM spare models of a kind (or of every kind of a region's mix), made one kind a frame in update(). */
  warm(what) {
    const types = MIX[what] ? MIX[what].map(([type]) => type).concat(what === 'lava' ? ['minislime'] : []) : [what];
    for (const type of types) if (CREATURES[type] && !this.warming.includes(type)) this.warming.push(type);
  }
  detach(e) {
    const group = e.view; if (!group) return; e.view = null; group.removeFromParent();
    if (group.userData.lit) { group.userData.lit = false; for (const m of group.userData.meshes) m.material = this.material; }
    if (group.userData.template !== this.templates.get(e.type)) return; // drawn from a stand-in that has been replaced: not kept
    let list = this.free.get(e.type); if (!list) this.free.set(e.type, list = []); list.push(group);
  }
  /** Height of a creature's head above the ground, for the target arrow and floating numbers. */
  top(e) { return (e.view?.userData.height ?? 1.6) * e.def.scale + e.lift + (e.titanLift ?? 0) + (e.def.flying ? 1 : 0); }
  footprint(e) { return Math.max(e.radius + .35, (e.view?.userData.footprint ?? e.radius) * e.def.scale * 1.15); }
}
