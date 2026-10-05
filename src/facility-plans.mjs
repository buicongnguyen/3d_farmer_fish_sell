// The floor plans of the five Town Square buildings (docs/FACILITY-INTERIORS-PLAN.md). Pure data and geometry (no Three.js, no
// DOM): facility-interior.mjs builds them, facility-view.mjs enters them, tests/facility-plans.test.mjs checks them.
//
// Every plan lives in the same envelope as a family house (home-plan.mjs ROOM, 19.6 x 16.8 m: x -9.8..9.8, z -8.4..8.4, the camera
// side z = 8.4 low, a 1.6 m front door at x 0), so the room camera, the phone framing, the minimap and the walk bounds are the
// house's. A plan is { id, name, rooms, walls, palette, pieces, targets, staff, kids, yard }, the shapes of home-plan.mjs:
//   rooms    {id, name, rect:{x0,x1,z0,z1}, pattern:'planks'|'tiles'}   (they tile the envelope: no gaps, no overlap)
//   walls    {axis:'x'|'z', at, from, to, height:'full'|'low', gaps:[[a,b]]}  (doorways are 1.6 m or wider)
//   pieces   P(kit, x, z, {rot, s, y, hang, glow, role, block:false})   kit = a house.glb node or an fp_* prop (facility-props.glb)
//            s is on top of K (1.2); `role` names a thing a target stands for; `block:false` for flat or hung things
//   targets  {type, id, label, x, z, r, icon, text, role?, line?, use?: 'workers'}  (type: 'civic' | 'shop' | 'fun' | 'facility')
//   staff    resident id -> {x, z, rot, sit?}   where a worker stands (or sits: `sit` is the seat height) in work hours
//   kids     [{x, z, rot, sit}] pupils' seats (school), yard [{x, z, rot}] where the children play at midday
import { ROOM } from './home-plan.mjs';

const HX = ROOM.w / 2, HZ = ROOM.d / 2, Q = Math.PI / 2, PI = Math.PI;
const P = (kit, x, z, o = {}) => ({ kit, x, z, rot: 0, s: 1, y: 0, ...o });
const wall = (axis, at, from, to, height, gaps = []) => ({ axis, at, from, to, height, gaps });
const room = (id, name, x0, x1, z0, z1, pattern = 'planks') => ({ id, name, rect: { x0, x1, z0, z1 }, pattern });
/** The outer shell: full back and side walls, a low front wall with the front door. */
const shell = (...inner) => [wall('x', -HZ, -HX - .11, HX + .11, 'full'), wall('x', HZ, -HX - .11, HX + .11, 'low', [[-1.05, 1.05]]), wall('z', -HX, -HZ, HZ, 'full'), wall('z', HX, -HZ, HZ, 'full'), ...inner];
const pal = (walls, floors, trim) => ({ walls, floors, trim });
const win = (x, y = 2) => P('window', x, -8.26, { hang: true, y, glow: true, block: false });
const sideWin = (z, side = 1) => P('window', side * 9.66, z, { hang: true, y: 2, rot: -side * Q, glow: true, block: false });
const mat = () => P('welcome_mat', 0, 7.7, { block: false, y: .012 });
const tgt = (type, id, label, x, z, r, icon, text, o = {}) => ({ type, id, label, x, z, r, icon, text, ...o });
const fun = (id, label, x, z, icon, text, line, role, r = 1.7) => tgt('fun', id, label, x, z, r, icon, text, { line, role });
/** The mid wall every plan has: a low wall at z = -2 (the cut-away) with doorways into the back row. */
const MID = gaps => wall('x', -2, -HX, HX, 'low', gaps);

// ------------------------------------------------------------------ Supermarket
const SUPER = {
  id: 'supermarket', name: 'Willowmere Supermarket',
  rooms: [room('cold', 'Cold section', -HX, -3, -HZ, -2, 'tiles'), room('fresh', 'Fresh produce', -3, 3, -HZ, -2, 'tiles'), room('stock', 'Back room', 3, HX, -HZ, -2),
    room('aisles', 'Shop floor', -HX, 3, -2, HZ, 'tiles'), room('checkout', 'Checkout', 3, HX, -2, HZ, 'tiles')],
  walls: shell(MID([[-8.6, -3.4], [-2.4, 2.4], [3.8, 5.4]]), wall('z', -3, -HZ, -2, 'full'), wall('z', 3, -HZ, -2, 'full')),
  palette: pal({ cold: '#bfe9ff', fresh: '#d6f5c4', stock: '#ffe4b8', aisles: '#fff0d2', checkout: '#ffe0d6' },
    { cold: ['#f2fbff', '#9fd8f0'], fresh: ['#fffdf0', '#bfe58f'], stock: ['#c98a55', '#b97a48'], aisles: ['#ffffff', '#ffc4bb'], checkout: ['#fff6e4', '#ff9d8f'] }, '#c22f2a'),
  pieces: [
    win(-6.5), win(0), win(6.5), sideWin(3.2, 1), sideWin(3.2, -1),
    P('fp_chiller', -8.5, -7.5, { s: .85, role: 'chillers' }), P('fp_chiller', -6.3, -7.5, { s: .85, role: 'chillers' }), P('fp_chiller', -4.2, -7.5, { s: .85, role: 'chillers' }),
    P('fridge', -9.3, -5.0, { rot: Q, role: 'chillers' }), P('fridge', -9.3, -3.6, { rot: Q, role: 'chillers' }),
    ...[-2.1, -.7, .7, 2.1].map(x => P('fp_bin', x, -7.1, { s: .85, role: 'bins' })), ...[-1.4, 0, 1.4].map(x => P('fp_bin', x, -4.9, { s: .85, role: 'bins' })),
    P('plant_big', -2.5, -3.0), P('plant_big', 2.5, -3.0),
    ...[4.0, 5.0, 6.0].map(x => P('fp_crate', x, -7.9, { role: 'stock' })), ...[4.5, 5.5].map(x => P('fp_crate', x, -7.9, { y: .66, role: 'stock', block: false })),
    P('fp_boxes', 8.8, -7.6, { s: .8, role: 'stock' }), P('fp_boxes', 8.8, -5.8, { s: .8, role: 'stock', rot: PI }), P('fp_crate', 9.2, -4.0, { rot: Q, role: 'stock' }),
    ...[-8.6, -6.6, -4.6].map(x => P('fp_shelf', x, .5, { s: .8, role: 'shelves' })), ...[-8.6, -6.6, -4.6].map(x => P('fp_shelf', x, 3.2, { s: .8, role: 'shelves' })), ...[-8.6, -6.6].map(x => P('fp_shelf', x, 5.9, { s: .8, role: 'shelves' })),
    P('fp_cart', -3.0, 6.9, { rot: .2 }), P('fp_cart', -2.3, 6.9, { rot: -.15 }), P('plant_big', -9.2, 7.4), P('plant_big', 3.4, 7.6), mat(),
    P('counter', 5.6, 1.8, { s: .65, role: 'checkout' }), P('counter', 8.4, 1.8, { s: .65, role: 'checkout2' }),
    P('fp_register', 5.6, 1.8, { y: .93, s: .9, block: false }), P('fp_register', 8.4, 1.8, { y: .93, s: .9, block: false }), P('plant_big', 9.2, 7.0),
  ],
  targets: [
    tgt('shop', 'supermarket', 'Sell at the checkout', 5.6, 3.2, 1.8, '🧺', 'Checkout', { role: 'checkout' }),
    tgt('shop', 'supermarket', 'Sell at the checkout', 8.4, 3.2, 1.8, '🧺', 'Checkout', { role: 'checkout2' }),
    fun('bins', 'Look at the fresh produce', 0, -3.5, '🥕', 'Fresh produce', 'Fresh from the Rowan fields. The supermarket pays 25% more for your produce at the checkout.', 'bins', 2.4),
    fun('chillers', 'Look at the cold section', -6.3, -5.7, '🧊', 'Cold section', 'Milk, eggs and the pond’s best fish, kept cold. Sell yours at the checkout.', 'chillers', 2.2),
    fun('stock', 'Peek in the back room', 6.4, -5.8, '📦', 'Back room', 'Crates of tomorrow’s deliveries. Finn is counting them again.', 'stock', 2.2),
    fun('shelves', 'Browse the shelves', -6.6, 1.9, '🛒', 'Aisles', 'Shelf after shelf: jam, flour and Hugo’s bread. Everything tastes of Willowmere.', 'shelves', 1.6),
  ],
  staff: { nell: { x: 5.6, z: .95, rot: 0 }, oren: { x: 8.4, z: .95, rot: 0 }, finn: { x: 5.0, z: -5.0, rot: .2 } },
};

// ------------------------------------------------------------------ School
const desks = (xs, z) => xs.map(x => P('fp_schooldesk', x, z, { s: .9, rot: PI, role: 'desks' }));
const SCHOOL = {
  id: 'school', name: 'Willowmere School',
  rooms: [room('class1', 'Classroom', -HX, -2.2, -HZ, -2), room('class2', 'Art room', -2.2, 5.4, -HZ, -2), room('library', 'Library corner', 5.4, HX, -HZ, -2),
    room('hall', 'Entrance hall', -HX, 4.2, -2, HZ, 'tiles'), room('yard', 'Schoolyard', 4.2, HX, -2, HZ, 'tiles')],
  walls: shell(MID([[-4.0, -2.4], [.6, 2.2], [6.6, 8.2]]), wall('z', -2.2, -HZ, -2, 'full'), wall('z', 5.4, -HZ, -2, 'full'), wall('z', 4.2, -2, HZ, 'full', [[3.4, 5.0]])),
  palette: pal({ class1: '#ffe9a8', class2: '#cfe6ff', library: '#e5d4ff', hall: '#ffd9c0', yard: '#c9f0c0' },
    { class1: ['#d99c5e', '#c98b50'], class2: ['#e0a467', '#d39457'], library: ['#b98650', '#a97844'], hall: ['#fff3dc', '#f0b9a0'], yard: ['#9be07a', '#7fd062'] }, '#a8683f'),
  pieces: [
    win(-8.4), win(-3.9), win(2.2), sideWin(6.0, 1),
    P('fp_blackboard', -6.0, -8.3, { s: .9, hang: true, y: 1.95, block: false, role: 'board' }), P('desk', -3.5, -7.0, { s: .9, role: 'teacher' }), ...desks([-8.8, -6.9, -5.0], -5.4), ...desks([-8.8, -6.9, -5.0], -3.7),
    P('plant_big', -9.2, -3.0, { rot: Q }),
    P('fp_blackboard', 1.6, -8.3, { s: .9, hang: true, y: 1.95, block: false, role: 'board2' }), P('easel', 4.4, -7.2, { role: 'easel' }), P('globe', -.6, -7.4, { role: 'globe' }), ...desks([-.2, 1.8, 3.8], -5.0).map(d => ({ ...d, role: 'desks2' })),
    P('bookshelf', 6.5, -8.0, { role: 'books' }), P('bookshelf', 8.5, -8.0, { role: 'books' }), P('rug_round', 7.6, -5.2, { s: .75, y: .012, block: false }), P('armchair', 9.0, -4.6, { rot: -Q, role: 'books' }), P('floor_lamp', 9.3, -2.9, { glow: true }),
    ...[.8, 2.5, 4.2].map(z => P('wardrobe', -9.2, z, { rot: Q, s: .9, role: 'lockers' })), P('fp_waitbench', -4.4, .6, { s: .9 }), P('fp_waitbench', -4.4, 6.4, { s: .9, rot: PI }),
    P('round_table', -5.6, 3.2, { role: 'trophy' }), P('trophy', -5.6, 3.2, { y: 1.12, s: 1.2, block: false, role: 'trophy' }), P('picture', 4.06, 1.0, { hang: true, y: 2.1, rot: -Q, block: false }),
    P('fp_clock', -9.66, 5.5, { hang: true, y: 2.4, rot: Q, block: false }), P('plant_big', -2.6, 7.4), P('plant_big', 3.1, 7.4), mat(),
    P('fp_seesaw', 7.0, 1.8, { role: 'yard' }), P('fp_sandbox', 8.2, 5.8, { role: 'yard' }), P('plant_big', 9.2, -.4), P('plant_big', 5.0, 7.5), P('round_table', 6.0, 5.4, { s: .9 }),
  ],
  targets: [
    tgt('civic', 'school', 'Start a lesson at the blackboard', -6.0, -6.3, 1.9, '📚', 'Lesson', { role: 'board' }),
    fun('art', 'Look at the art room', 1.8, -3.0, '🎨', 'Art room', 'Paint on the easel still wet: a willow, again. Faye signs every picture with a sun.', 'easel', 2.4),
    fun('globe', 'Spin the globe', -.6, -5.8, '🌍', 'Globe', 'Round and round… it stops on Willowmere, of course.', 'globe', 1.4),
    fun('library', 'Read a story', 7.6, -3.6, '📖', 'Library', 'A quiet corner with a thousand stories. You read a page before the bell.', 'books', 1.8),
    fun('lockers', 'Look at the lockers', -7.6, .8, '🎒', 'Lockers', 'Every locker has a name tag. Pip’s has a drawing of a very large chicken.', 'lockers', 1.6),
    fun('trophy', 'Look at the trophy', -4.2, 3.2, '🏆', 'Trophy', 'The village run cup. Milo is the second-fastest name on it.', 'trophy', 1.6),
    fun('yard', 'Play in the schoolyard', 6.6, 3.6, '🛝', 'Playground', 'The seesaw creaks, the sandbox waits. Recess is the best lesson.', 'yard', 1.8),
  ],
  staff: { cora: { x: -8.3, z: -6.4, rot: .35, pose: 'teach' } },
  kids: [-8.8, -6.9, -5.0].flatMap(x => [-5.4, -3.7].map(z => ({ x, z: z + .66, rot: PI, sit: .4 }))),
  yard: [{ x: 6.2, z: 2.9, rot: 1 }, { x: 7.8, z: .6, rot: -1 }, { x: 8.2, z: 3.9, rot: 2.4 }, { x: 6.0, z: 6.4, rot: 3 }, { x: 5.6, z: 4.4, rot: 1.5 }],
};

// ------------------------------------------------------------------ Clinic
const CLINIC = {
  id: 'hospital', name: 'Village Clinic',
  rooms: [room('exam1', 'Exam room 1', -HX, -3.4, -HZ, -2, 'tiles'), room('exam2', 'Exam room 2', -3.4, 3, -HZ, -2, 'tiles'), room('pharm', 'Pharmacy', 3, HX, -HZ, -2, 'tiles'),
    room('wait', 'Waiting room', -HX, 4, -2, HZ), room('recep', 'Reception', 4, HX, -2, HZ, 'tiles')],
  walls: shell(MID([[-7.4, -5.6], [-1, .8], [5.6, 7.4]]), wall('z', -3.4, -HZ, -2, 'full'), wall('z', 3, -HZ, -2, 'full'), wall('z', 4, -2, HZ, 'low', [[2, 5]])),
  palette: pal({ exam1: '#d8f4ff', exam2: '#c9f0e4', pharm: '#e0f7e9', wait: '#fff6d8', recep: '#ffe4ef' },
    { exam1: ['#ffffff', '#bfe3ff'], exam2: ['#ffffff', '#b8efd8'], pharm: ['#ffffff', '#c9eec9'], wait: ['#e0b27a', '#d2a06a'], recep: ['#ffffff', '#ffc4d8'] }, '#2fa6a0'),
  pieces: [
    win(-6.6), win(0.2), win(6.2), sideWin(5.0, 1), sideWin(5.0, -1),
    P('fp_hospitalbed', -8.0, -7.0, { role: 'bed1' }), P('fp_curtain', -6.5, -6.5, { s: .9, rot: Q, role: 'bed1' }), P('fp_ivstand', -7.1, -7.9), P('sink', -9.4, -4.0, { rot: Q }), P('plant_small', -4.0, -3.0),
    P('fp_hospitalbed', 1.8, -7.0, { role: 'bed2' }), P('fp_curtain', .2, -6.5, { s: .9, rot: Q, role: 'bed2' }), P('desk', -2.2, -7.5, { s: .8 }), P('floor_lamp', -2.9, -3.2, { glow: true }), P('plant_big', 2.6, -3.0),
    P('fp_medcabinet', 4.2, -8.0, { s: .9, role: 'pharmacy' }), P('fp_medcabinet', 6.0, -8.0, { s: .9, role: 'pharmacy' }), P('fp_medcabinet', 7.8, -8.0, { s: .9, role: 'pharmacy' }),
    P('counter', 8.3, -4.6, { s: .65, role: 'pharmacy' }), P('fridge', 3.7, -4.5, { rot: Q }),
    P('fp_waitbench', -7.6, 1.0, { s: .9 }), P('fp_waitbench', -4.4, 1.0, { s: .9 }), P('fp_waitbench', -7.6, 4.2, { s: .9 }), P('fp_waitbench', -4.4, 4.2, { s: .9 }),
    P('coffee_table', -6.0, 2.6, { s: .9 }), P('books', -6.0, 2.6, { y: .6, block: false }), P('plant_big', -9.0, 7.4), P('plant_big', -2.9, 7.4), P('plant_big', 3.4, 7.4), mat(),
    P('picture', -9.66, 3.0, { hang: true, y: 2.2, rot: Q, block: false }), P('fp_clock', -9.66, 5.8, { hang: true, y: 2.4, rot: Q, block: false }),
    P('counter', 7.4, 1.6, { s: .65, role: 'reception' }), P('fp_register', 7.4, 1.6, { y: .93, s: .9, block: false }), P('plant_big', 9.2, 5.4),
  ],
  targets: [
    tgt('civic', 'hospital', 'Check-up in the bed', -8.0, -4.6, 1.8, '🛏️', 'Check-up', { role: 'bed1' }),
    tgt('civic', 'hospital', 'Check-up in the bed', 1.8, -4.6, 1.8, '🛏️', 'Check-up', { role: 'bed2' }),
    fun('pharmacy', 'Look at the medicine', 7.6, -3.0, '💊', 'Pharmacy', 'Ginger tea, plasters and sweet cough syrup. Sylvie labels every jar in her neatest hand.', 'pharmacy', 1.9),
    fun('reception', 'Ask at reception', 7.4, 3.0, '🛎️', 'Reception', 'Check-ups cost 30 coins and restore all your energy. One a day is plenty.', 'reception', 1.7),
  ],
  staff: { hazel: { x: -5.0, z: -5.5, rot: -.6 }, sylvie: { x: 8.3, z: -5.8, rot: 0 } },
};

// ------------------------------------------------------------------ Police Station
const POLICE = {
  id: 'police', name: 'Police Station',
  rooms: [room('cell1', 'Cell 1', -HX, -5.4, -HZ, -2, 'tiles'), room('cell2', 'Cell 2', -5.4, -1, -HZ, -2, 'tiles'), room('evid', 'Evidence room', -1, 3.4, -HZ, -2, 'tiles'),
    room('office', 'Office', 3.4, HX, -HZ, -2), room('lobby', 'Front desk', -HX, HX, -2, HZ, 'tiles')],
  walls: shell(MID([[.2, 2], [5.2, 7]]), wall('z', -5.4, -HZ, -2, 'full'), wall('z', -1, -HZ, -2, 'full'), wall('z', 3.4, -HZ, -2, 'full')),
  palette: pal({ cell1: '#b8c8ee', cell2: '#b8c8ee', evid: '#d0d6e0', office: '#ffe0b0', lobby: '#cfe0ff' },
    { cell1: ['#e6ebf5', '#9fb2d6'], cell2: ['#e6ebf5', '#9fb2d6'], evid: ['#eef0f5', '#aeb8cc'], office: ['#d9a066', '#c99158'], lobby: ['#f3f6ff', '#9fb2d6'] }, '#2f4c86'),
  pieces: [
    win(-7.0), win(.6), win(6.6), sideWin(5.0, 1), sideWin(5.0, -1),
    P('fp_cellbars', -8.7, -2.0, { s: .75, role: 'cells' }), P('fp_cellbars', -6.5, -2.0, { s: .75, role: 'cells' }), P('fp_cellbars', -4.3, -2.0, { s: .75, role: 'cells' }), P('fp_cellbars', -2.1, -2.0, { s: .75, role: 'cells' }),
    P('fp_cellbed', -8.9, -6.8, { role: 'cells' }), P('sink', -6.6, -7.8, { role: 'cells' }), P('stool', -7.4, -4.4), P('fp_cellbed', -4.4, -6.8, { role: 'cells' }), P('sink', -2.2, -7.8, { role: 'cells' }),
    P('fp_evidenceshelf', .1, -8.0, { s: .9, role: 'evidence' }), P('fp_evidenceshelf', 2.2, -8.0, { s: .9, role: 'evidence' }), P('fp_boxes', .2, -5.2, { s: .8, role: 'evidence' }), P('fp_crate', 2.6, -5.0, { role: 'evidence' }),
    P('desk', 5.2, -5.6, { s: .9, role: 'desks' }), P('chair', 5.2, -7.0), P('desk', 8.0, -5.6, { s: .9, role: 'desks' }), P('chair', 8.0, -7.0), P('fp_noticeboard', 6.7, -8.3, { s: .9, hang: true, y: 1.9, block: false, role: 'notice' }),
    P('fp_filecabinet', 4.2, -8.0), P('fp_filecabinet', 9.2, -8.0), P('plant_small', 4.0, -3.0),
    P('counter', -5.5, 1.4, { s: .75, role: 'desk' }), P('radio', -4.8, 1.4, { y: 1.08, block: false }), P('fp_waitbench', 5.8, 3.6, { s: .9 }), P('fp_waitbench', 8.2, 3.6, { s: .9 }),
    P('plant_big', -9.2, 7.4), P('plant_big', 9.0, 7.4), P('plant_big', 3.0, 7.4), mat(), P('picture', -9.66, 4.0, { hang: true, y: 2.2, rot: Q, block: false }), P('fp_clock', 9.66, 3.0, { hang: true, y: 2.4, rot: -Q, block: false }),
  ],
  targets: [
    tgt('civic', 'police', 'Take a patrol shift', -5.5, 2.7, 1.9, '🚓', 'Patrol', { role: 'desk' }),
    fun('notice', 'Read the notice board', 6.7, -3.6, '📌', 'Notice board', 'LOST: one goat, answers to “Biscuit”. Last seen eating the market flowers. Pearl has circled the spot twice.', 'notice', 2.0),
    fun('cells', 'Look in the cells', -5.4, -.8, '🔒', 'Cells', 'Two tidy cells with a blanket and a book. Nobody has stayed longer than a lunch hour.', 'cells', 2.4),
    fun('evidence', 'Look at the evidence', 1.2, -3.4, '🧾', 'Evidence', 'Labelled boxes of found things: one boot, three keys and a very muddy hat.', 'evidence', 1.8),
  ],
  staff: { pearl: { x: 5.2, z: -7.0, rot: 0, sit: .5 }, theo: { x: -5.5, z: .35, rot: 0 } },
};

// ------------------------------------------------------------------ Willow & Co.
const wd = (x, z, role) => P('fp_officedesk', x, z, { s: .9, role });
const COMPANY = {
  id: 'company', name: 'Willow & Co.',
  rooms: [room('boss', 'Boss office', -HX, -4.4, -HZ, -2), room('meet', 'Meeting room', -4.4, 2.6, -HZ, -2), room('brk', 'Break room', 2.6, HX, -HZ, -2), room('open', 'Open office', -HX, HX, -2, HZ, 'tiles')],
  walls: shell(MID([[-8, -6.2], [-2, -.4], [5, 6.8]]), wall('z', -4.4, -HZ, -2, 'full'), wall('z', 2.6, -HZ, -2, 'full')),
  palette: pal({ boss: '#e1d3ff', meet: '#d5ecff', brk: '#ffe3c0', open: '#fff6e0' },
    { boss: ['#b9794a', '#ad6e40'], meet: ['#c79a6b', '#b88a5c'], brk: ['#fff3dc', '#ffb48a'], open: ['#eef3ff', '#c5d3f2'] }, '#ff8a2a'),
  pieces: [
    win(-7), win(-1), win(6.2), sideWin(5.2, 1), sideWin(5.2, -1),
    P('bookshelf', -8.8, -7.9, { role: 'boss' }), P('desk', -6.4, -5.4, { s: .9, role: 'boss' }), P('chair', -6.4, -6.6), P('plant_big', -5.1, -3.1), P('trophy', -9.0, -3.4, { s: 1.2 }),
    P('fp_meetingtable', -.9, -5.8, { s: .9, role: 'meeting' }), ...[-2.2, -.9, .4].map(x => P('chair', x, -4.55, { rot: PI })), ...[-2.2, -.9, .4].map(x => P('chair', x, -7.0)), P('fp_blackboard', -.9, -8.3, { s: .6, hang: true, y: 2.1, block: false }),
    P('plant_big', 2.1, -3.1), P('floor_lamp', -3.9, -3.0, { glow: true }),
    P('counter', 4.4, -7.9, { s: .65, role: 'break' }), P('fp_coffee', 4.8, -7.9, { y: .93, s: 1.1, block: false }), P('fridge', 6.3, -7.9, { role: 'break' }), P('fp_watercooler', 7.5, -7.9, { role: 'break' }),
    P('sofa', 9.0, -5.0, { rot: -Q, role: 'break' }), P('round_table', 6.0, -4.6, { s: .9 }), P('stool', 5.0, -4.6), P('stool', 7.0, -4.6),
    wd(-6.9, 1.2, 'desks'), wd(-4.6, 1.2, 'desks'), wd(4.6, 1.2, 'desks'), wd(6.9, 1.2, 'desks'), wd(-6.9, 4.4, 'desks'), wd(-4.6, 4.4, 'desks'), wd(4.6, 4.4, 'desks'), wd(6.9, 4.4, 'shift'),
    ...[-6.9, -4.6, 4.6, 6.9].map(x => P('chair', x, .15)), ...[-6.9, -4.6, 4.6, 6.9].map(x => P('chair', x, 3.35)),
    P('fp_hiringboard', -9.66, 2.6, { s: .9, hang: true, y: 1.9, rot: Q, block: false, role: 'board' }),
    P('plant_big', -9.0, 7.4), P('plant_big', 9.0, 7.4), P('plant_big', 3.0, 7.4), mat(), P('fp_clock', 9.66, 1.6, { hang: true, y: 2.4, rot: -Q, block: false }),
  ],
  targets: [
    tgt('facility', 'hire', 'Read the hiring board', -8.3, 2.6, 1.9, '📋', 'Hiring board', { role: 'board', use: 'workers' }),
    tgt('civic', 'company', 'Take an office shift', 6.9, 5.8, 1.7, '💼', 'Office shift', { role: 'shift' }),
    fun('boss', 'Look at the boss’s desk', -6.4, -3.6, '🖋️', 'Boss office', 'The village leader’s desk: stamps, a heap of produce orders and a very good chair.', 'boss', 1.8),
    fun('break', 'Have a coffee', 6.3, -5.8, '☕', 'Break room', 'A strong coffee and a biscuit. Fern swears the water cooler gossips.', 'break', 2.0),
    fun('meeting', 'Look at the meeting room', -.9, -3.3, '🗂️', 'Meeting room', 'Next week’s agenda: more carrots, fewer meetings.', 'meeting', 1.8),
  ],
  staff: { bea: { x: -6.9, z: .15, rot: 0, sit: .5 }, leo: { x: -4.6, z: .15, rot: 0, sit: .5 }, fern: { x: 4.6, z: .15, rot: 0, sit: .5 } },
};

// ------------------------------------------------------------------ Hearth bakery (the Hearths' lodging: HOUSES[6], by the village green)
const BAKERY = {
  id: 'bakery', name: 'Hearth Bakery', homeId: 6,
  rooms: [room('bake', 'Bakehouse', -HX, -1.4, -HZ, -2), room('pantry', 'Pantry', -1.4, 3.6, -HZ, -2), room('family', 'Family corner', 3.6, HX, -HZ, -2), room('shop', 'Shop', -HX, HX, -2, HZ, 'tiles')],
  walls: shell(MID([[-6, -4.4], [.2, 1.8], [5.6, 7.2]]), wall('z', -1.4, -HZ, -2, 'full'), wall('z', 3.6, -HZ, -2, 'full')),
  palette: pal({ bake: '#ffd9a8', pantry: '#fff0c8', family: '#ffd1de', shop: '#ffe9c4' },
    { bake: ['#c98a55', '#b97a48'], pantry: ['#d7a86e', '#c99a5f'], family: ['#e0a467', '#d39457'], shop: ['#fff3dc', '#ffb48a'] }, '#d9631a'),
  pieces: [
    win(-5.0), win(1.0), win(6.4), sideWin(4.5, 1), sideWin(4.5, -1),
    P('fp_oven', -7.3, -7.2, { s: .7, role: 'oven' }), P('workbench', -3.6, -6.2, { s: .9, role: 'oven' }), P('fp_trays', -4.6, -7.8, { s: .9 }), P('fp_sacks', -9.0, -4.0, { s: .9 }), P('kettle', -3.6, -6.2, { y: 1.1, block: false }), P('plant_small', -2.2, -3.0),
    P('fp_sacks', -.2, -7.6, { s: .9, role: 'pantry' }), P('fp_sacks', 1.4, -7.6, { s: .9, rot: .2, role: 'pantry' }), P('fp_crate', 2.8, -7.7, { role: 'pantry' }), P('fp_crate', 2.8, -6.6, { role: 'pantry' }), P('fridge', 3.0, -4.6, { rot: -Q }), P('fp_boxes', 0, -4.2, { s: .7, role: 'pantry' }),
    P('bed', 8.6, -7.0, { role: 'bed' }), P('nightstand', 7.2, -7.9), P('lamp_small', 7.2, -7.9, { y: .62, glow: true, block: false }), P('sofa', 5.2, -4.2, { s: .9 }), P('round_table', 7.8, -4.4, { s: .9 }), P('plant_big', 9.2, -3.0), P('picture', 6.0, -8.3, { hang: true, y: 2.2, block: false }),
    ...[-8.6, -6.3].map(x => P('fp_breadshelf', x, .6, { s: .9, role: 'bread' })), P('fp_breadshelf', -4.0, .6, { s: .9, role: 'bread' }),
    P('fp_cakecase', 6.4, 1.8, { s: .9, role: 'counter' }), P('fp_register', 7.4, 1.8, { y: 1.1, s: .9, block: false }), P('fp_breadbasket', 5.6, 1.8, { y: 1.1, s: 1.2, block: false }),
    P('round_table', -6.0, 4.4, { s: .9 }), P('fp_breadbasket', -6.0, 4.4, { y: 1.0, s: 1.2, block: false }), P('stool', -7.0, 4.4), P('stool', -5.0, 4.4), P('plant_big', -9.0, 7.4), P('plant_big', 3.0, 7.4), P('plant_big', 9.0, 7.4), mat(),
  ],
  targets: [
    tgt('fun', 'counter', 'Look at the bakes', 6.4, 3.2, 1.8, '🥧', 'Cake case', { role: 'counter', line: 'Orchard pie, honey buns and Hugo’s famous seed loaf. Bring the ingredients and the oven will do the rest.' }),
    tgt('kitchen', 'cook', 'Bake at the oven', -6.0, -5.2, 1.9, '🍞', 'Oven', { role: 'oven', use: 'kitchen' }),
    fun('bread', 'Browse the bread', -6.3, 2.0, '🥖', 'Bread', 'Still warm from the oven. The Hearths sell their bread at the market from 8:30.', 'bread', 1.7),
    fun('pantry', 'Peek in the pantry', 1.4, -5.6, '🌾', 'Pantry', 'Sacks of flour, crates of eggs and a jar of wild honey with a label in Nell’s hand.', 'pantry', 2.0),
    fun('family', 'Look at the family corner', 6.4, -5.8, '🛋️', 'Family corner', 'The Hearths live above the shop in winter and beside it in summer. There is always a pot warming.', 'bed', 1.9),
  ],
  staff: {},
  family: { hugo: [{ x: -6.0, z: -6.0, rot: 0, pose: 'teach' }, { x: 6.4, z: -3.0, rot: PI * .9 }], nell: [{ x: 6.4, z: .8, rot: 0 }, { x: 4.2, z: -2.9, rot: .6 }] },
};

// ------------------------------------------------------------------ Moss barn (the Moss family's lodging by the animal pen: HOUSES[3])
const MOSS = {
  id: 'moss', name: 'Moss Barn', homeId: 3,
  rooms: [room('stable', 'Stable', -HX, -1, -HZ, -2), room('tools', 'Feed and tools', -1, 4.2, -HZ, -2), room('beds', 'Family beds', 4.2, HX, -HZ, -2), room('floor', 'Barn floor', -HX, 3, -2, HZ), room('living', 'Kitchen corner', 3, HX, -2, HZ)],
  walls: shell(MID([[-6.6, -5], [.4, 2], [6.4, 8]]), wall('z', -1, -HZ, -2, 'full'), wall('z', 4.2, -HZ, -2, 'full'), wall('z', 3, -2, HZ, 'low', [[2, 5]])),
  palette: pal({ stable: '#f0d9a8', tools: '#e8d0a0', beds: '#ffe0c2', floor: '#f6e3b8', living: '#ffe9c4' },
    { stable: ['#d9b36a', '#c9a35a'], tools: ['#b98650', '#a97844'], beds: ['#e0a467', '#d39457'], floor: ['#d7a86e', '#c99a5f'], living: ['#fff3dc', '#9fd38a'] }, '#4f9a3a'),
  pieces: [
    win(-6.0), win(1.6), win(7.0), sideWin(4.5, 1), sideWin(4.5, -1),
    P('fp_stall', -7.6, -6.8, { s: .95, role: 'stall' }), P('fp_stall', -4.6, -6.8, { s: .95, role: 'stall' }), P('fp_hay', -2.1, -7.2, { s: .8, role: 'hay' }), P('fp_pail', -6.2, -3.9, { block: false, role: 'stall' }),
    P('fp_toolrack', 1.6, -8.3, { s: .9, hang: true, y: 1.8, block: false, role: 'tools' }), P('workbench', 2.4, -6.3, { s: .85, role: 'tools' }), P('fp_sacks', -.1, -7.4, { s: .9, role: 'feed' }), P('fp_sacks', 1.0, -4.6, { s: .8, rot: .3, role: 'feed' }),
    ...[5.2, 7.0, 8.8].map(x => P('bed', x, -7.0, { s: .95, role: 'bed' })), P('plant_small', 4.7, -3.0),
    P('fp_hay', -8.4, 2.0, { role: 'hay' }), P('fp_hay', -6.6, 2.4, { s: .8, rot: .3, role: 'hay' }), P('fp_trough', -4.2, 3.4, { role: 'feed' }), P('fp_crate', -8.6, 6.0), P('fp_pail', -3.0, 5.2, { block: false }), P('plant_big', -2.0, 7.4), mat(),
    P('dining_table', 6.4, 2.0, { s: .9, role: 'table' }), P('chair', 5.2, 3.6, { rot: PI }), P('chair', 7.6, 3.6, { rot: PI }), P('stove', 9.1, -.6, { rot: -Q, role: 'table' }), P('kettle', 9.1, -.6, { y: 1.3, block: false }), P('fridge', 9.2, 1.2, { rot: -Q }),
    P('sofa', 6.2, 6.4, { s: .9, rot: PI }), P('rug_round', 6.4, 3.4, { s: .8, y: .012, block: false }), P('plant_big', 9.2, 7.4),
  ],
  targets: [
    tgt('feed', 'animals', 'Feed your animals', 1.2, -3.6, 1.9, '🌾', 'Feed sacks', { role: 'feed' }),
    tgt('collect', 'basket', 'Collect the eggs and milk', -6.1, -4.6, 1.9, '🥛', 'Milking stall', { role: 'stall' }),
    fun('hay', 'Sit on the hay', -7.6, 4.0, '🌾', 'Hay', 'Sweet-smelling hay up to the rafters. Wren says it is the best place to hide.', 'hay', 1.9),
    fun('tools', 'Look at the tools', 2.0, -3.9, '🔧', 'Tools', 'Forks, rakes and one very old hammer. Oren knows where each one hangs.', 'tools', 1.9),
    fun('beds', 'Look at the beds', 7.0, -4.2, '🛏️', 'Family beds', 'Three beds in a row, Wren’s with a patchwork quilt and a toy chick.', 'bed', 2.0),
    fun('table', 'Look at the kitchen corner', 6.4, 4.6, '🍲', 'Kitchen corner', 'A pot of soup on the stove. The Moss family eat well, and mostly with their boots on.', 'table', 2.0),
  ],
  staff: {},
  family: { mara: [{ x: -6.1, z: -5.6, rot: 0, pose: 'teach' }, { x: 5.6, z: 4.8, rot: PI }], oren: [{ x: 2.4, z: -5.0, rot: 0 }, { x: 7.6, z: 4.6, rot: PI }], wren: [{ x: -7.4, z: 3.2, rot: .6 }, { x: 6.2, z: 5.4, rot: -.6 }] },
};
// ------------------------------------------------------------------ Vale barn (the Vale workshop room: Ash's bench; the upgrades counter is here as well as at the well stall)
const VALE = {
  id: 'vale', name: 'Vale Workshop Barn', homeId: 7,
  rooms: [room('lumber', 'Lumber store', -HX, -1.4, -HZ, -2), room('tools', 'Tool bay', -1.4, 4.2, -HZ, -2), room('parts', 'Parts store', 4.2, HX, -HZ, -2), room('shop', 'Workshop', -HX, HX, -2, HZ)],
  walls: shell(MID([[-6.4, -4.8], [.4, 2], [6.4, 8]]), wall('z', -1.4, -HZ, -2, 'full'), wall('z', 4.2, -HZ, -2, 'full')),
  palette: pal({ lumber: '#f0d9a8', tools: '#e1d3ff', parts: '#d5ecff', shop: '#fff0d2' }, { lumber: ['#c98a55', '#b97a48'], tools: ['#b98650', '#a97844'], parts: ['#c79a6b', '#b88a5c'], shop: ['#d7a86e', '#c99a5f'] }, '#7146d8'),
  pieces: [
    win(-6.0), win(1.4), win(7.0), sideWin(4.5, 1), sideWin(4.5, -1),
    P('fp_lumber', -7.6, -7.4, { s: 1.1, role: 'lumber' }), P('fp_lumber', -4.6, -7.4, { s: 1.1, role: 'lumber' }), P('fp_lumber', -6.0, -5.0, { s: 1.1, role: 'lumber' }), P('fp_sacks', -9.0, -3.2, { s: .8 }),
    P('fp_toolrack', 1.4, -8.3, { s: 1, hang: true, y: 1.8, block: false, role: 'tools' }), P('workbench', 1.4, -6.4, { s: .9, role: 'tools' }), P('fp_anvil', 3.4, -5.4, { s: 1.1, role: 'tools' }),
    P('fp_crate', 5.4, -7.8, { role: 'parts' }), P('fp_crate', 6.5, -7.8, { role: 'parts' }), P('fp_boxes', 8.6, -7.6, { s: .8, role: 'parts' }), P('bookshelf', 8.6, -4.4, { rot: -Q, s: .9 }),
    P('counter', 5.6, 1.6, { s: .65, role: 'counter' }), P('fp_register', 5.6, 1.6, { y: .93, s: .9, block: false }), P('workbench', -6.0, 2.4, { s: .9, role: 'bench' }), P('fp_hay', -8.8, 6.0, { s: .7 }),
    P('fp_lumber', -3.2, 4.4, { s: 1.0, rot: Q }), P('fp_anvil', -3.2, 1.0, { s: 1.0 }), P('plant_big', -9.2, 7.4), P('plant_big', 9.0, 7.4), P('plant_big', 3.0, 7.4), mat(),
  ],
  targets: [
    tgt('shop', 'upgrades', 'Visit the Vale workshop counter', 5.6, 3.0, 1.8, '🪚', 'Workshop', { role: 'counter' }),
    fun('lumber', 'Look at the lumber', -6.0, -2.9, '🪵', 'Lumber store', 'Boards dried for a year and a day. Ash will not sell the good oak.', 'lumber', 2.2),
    fun('tools', 'Look at the tool bay', 2.0, -3.9, '🔨', 'Tool bay', 'Every chisel is sharp and every handle is worn to the shape of Ash’s hand.', 'tools', 2.0),
    fun('parts', 'Look at the parts', 6.4, -5.8, '⚙️', 'Parts store', 'Hinges, hooks and a box of nails labelled “maybe”.', 'parts', 2.2),
    fun('bench', 'Look at the workbench', -6.0, 3.8, '📐', 'Workbench', 'A half-built chair waits on the bench, the third one this week.', 'bench', 1.8),
  ],
  staff: {},
  family: { ash: [{ x: 1.4, z: -5.2, rot: 0, pose: 'teach' }, { x: -6.0, z: 1.2, rot: 0 }] },
};

export const FACILITIES = { moss: MOSS, vale: VALE, bakery: BAKERY, supermarket: SUPER, school: SCHOOL, hospital: CLINIC, police: POLICE, company: COMPANY };
/** Where you stand to leave (the house's front door spot) and where you arrive. */
export const FACILITY_EXIT = { x: 0, z: 7.6, r: 1.6 };
/** The villagers inside right now: [{p, at:{x, z, rot, sit?}}]. `slot(p, state)` is villagers.mjs slotOf; `RESIDENTS` the people. Staff at their stations in work hours, pupils at their desks (or the yard at midday). */
export function occupants(plan, state, RESIDENTS, slot) {
  const out = []; let seat = 0, play = 0;
  for (const p of RESIDENTS) {
    if (p.id === 'rowan_neighbour') continue;
    const key = slot(p, state);
    if (plan.id === 'school' && p.child) {
      if (key === 'school' && plan.kids[seat]) out.push({ p, at: plan.kids[seat++] });
      else if (key === 'schoolyard' && plan.yard[play]) out.push({ p, at: plan.yard[play++] });
    } else if (plan.family?.[p.id] && key === 'home') out.push({ p, at: plan.family[p.id][state.time < 12 ? 0 : 1] });
    else if (key === plan.id && plan.staff[p.id]) out.push({ p, at: plan.staff[p.id] });
  }
  return out;
}
