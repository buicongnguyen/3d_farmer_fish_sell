// Town tales: a little story in every building of Willowmere, and a small surprise there each day. Pure data and rules
// (no Three.js, no DOM): main.mjs feeds it actions, the building view feeds it taps on a building's spots, the album shows it.
//
// A tale is four beats. A beat happens at one of the building's spots (`at: 'fun:<id>'`, tapped indoors; `needs` items are
// handed over there) or when the player does something anywhere (`on: '<action>'`, `times` times). The next spot sparkles
// (decoratePlan). When the last beat is done the tale pays its reward and becomes a memory in the album.
// Every building also has a daily moment: one spot, picked by the day, with a line and a small gift (once a day per building).
//
//   s.tales = { school: { step, count } ... }   s.taleMoments = { school: day ... }   (both made safe by parseTales)
//   taleSpot(s, facility, spotId) -> { line, done?, reward? } | null       taleEvent(s, type, arg) -> [{ line, done?, reward? }]
//   decoratePlan(plan, s) -> a plan whose current spots sparkle            taleList(s) -> what the album shows

export const TALES = {
  school: {
    title: 'The bell that went quiet', icon: '🔔', who: 'Ms Cora',
    intro: 'The school bell vanished two days before the Spring Show. Ms Cora needs a detective.',
    beats: [
      { at: 'fun:lockers', ask: 'Look for clues at the lockers', line: 'A trail of straw leads from Milo’s locker to the back door… and one shiny black feather.' },
      { on: 'answer', times: 3, ask: 'Answer 3 lesson questions to help Milo count the clues', line: 'Milo counts on his fingers: three feathers, two twigs and one very guilty-looking crow.' },
      { at: 'fun:yard', needs: { wood: 2 }, ask: 'Bring 2 timber to the schoolyard for a ladder', line: 'Up the ladder, in a crow’s nest: the bell! And a spoon, a key and Pip’s missing hair clip.' },
      { at: 'fun:trophy', ask: 'Ring the bell by the trophy case', line: 'DING! The whole school cheers. The crow gets a bell of its own: a bottle cap on a string.' },
    ],
    reward: { coins: 120 }, memory: 'You found the school bell in a crow’s nest. The Spring Show started right on time.',
    moments: [
      { at: 'globe', line: 'The globe stops on a tiny island. Ms Cora gives you a gold star for curiosity.', gift: { coins: 10 } },
      { at: 'art', line: 'Faye paints your portrait in one minute. It is mostly sun.', gift: { coins: 12 } },
      { at: 'library', line: 'A pressed tulip falls out of a library book. Faye says you can keep it.', gift: { tulip: 1 } },
    ],
  },
  hospital: {
    title: 'Nurse Hazel’s hiccups', icon: '🤧', who: 'Nurse Hazel',
    intro: 'Nurse Hazel has had the hiccups for three days. Every hiccup rattles the medicine jars.',
    beats: [
      { at: 'fun:reception', ask: 'Ask at reception what happened', line: 'Sylvie whispers: “It started when Hazel laughed at Hugo’s joke about bread. Hic!”' },
      { at: 'fun:pharmacy', needs: { carrot: 2 }, ask: 'Bring 2 carrots to the pharmacy for Sylvie’s carrot tea', line: 'Carrot tea… Hazel sips it. “Hic!” Not yet. Sylvie turns the medicine book to the page called Surprises.' },
      { on: 'civic:hospital', times: 1, ask: 'Have a check-up in a clinic bed', line: 'While you lie still for the check-up, Pip jumps out from behind the curtain: “BOO!”' },
      { at: 'fun:reception', ask: 'Tell Hazel the good news at reception', line: 'Silence. Hazel listens… no hiccup! She laughs, very carefully, and gives you her lucky thermometer.' },
    ],
    reward: { coins: 90 }, memory: 'You and Pip cured Nurse Hazel’s hiccups with carrot tea and one big BOO.',
    moments: [
      { at: 'pharmacy', line: 'Sylvie gives you a ginger sweet for the road.', gift: { energy: 10 } },
      { at: 'reception', line: 'A get-well card from Milo sits on the desk. It says: Get well, everyone.', gift: { coins: 8 } },
    ],
  },
  police: {
    title: 'The great goat escape', icon: '🐐', who: 'Officer Pearl',
    intro: 'Every night someone opens the gate of Mara’s goat pen. Officer Pearl has a case and no suspects.',
    beats: [
      { at: 'fun:evidence', ask: 'Study the evidence', line: 'The clues: hoof prints, a chewed hat, and a gate that was opened from the inside.' },
      { on: 'civic:police', times: 1, ask: 'Take a patrol shift', line: 'On patrol you spot Biscuit the goat lifting the latch with her nose. The victim was the culprit!' },
      { on: 'feed', times: 1, ask: 'Feed your animals: Biscuit follows the smell of fresh hay', line: 'Biscuit trots after the hay smell all the way to your pen. Your hens are not impressed.' },
      { at: 'fun:notice', ask: 'Pin the case report on the notice board', line: 'Case closed: Biscuit, escape artist. Sentence: one goat-proof latch. Pearl makes you a junior deputy.' },
    ],
    reward: { coins: 100 }, memory: 'You solved the great goat escape. Biscuit is still very proud of it.',
    moments: [
      { at: 'cells', line: 'The cell is empty except for a sleeping cat. It is not under arrest.', gift: { coins: 6 } },
      { at: 'evidence', line: 'Pearl’s mug on the evidence table says World’s Okayest Officer. She lets you hold it.', gift: { coins: 8 } },
    ],
  },
  company: {
    title: 'The big city order', icon: '📦', who: 'Bea',
    intro: 'Willow & Co. just won its biggest order ever: a city café wants Willowmere vegetables every week.',
    beats: [
      { at: 'fun:boss', ask: 'Read the order on the boss’s desk', line: 'The order: carrots, eggs and a smile. “The smile is the hard part,” says Bea.' },
      { on: 'civic:company', times: 1, ask: 'Work one office shift', line: 'You pack forty boxes and label them in your best handwriting. Leo labels his with drawings.' },
      { at: 'fun:meeting', needs: { carrot: 5, egg: 3 }, ask: 'Bring 5 carrots and 3 eggs to the meeting room', line: 'The first crate is full. Everyone signs the lid, and Kit adds a tiny rocket for luck.' },
      { at: 'fun:break', ask: 'Celebrate in the break room', line: 'The café writes back: Best carrots in the state! Coffee and cake for everyone.' },
    ],
    reward: { coins: 180 }, memory: 'Your carrots went to the city. Willow & Co. framed the café’s letter.',
    moments: [
      { at: 'break', line: 'Fresh coffee and a slice of Hugo’s cake in the break room.', gift: { energy: 12 } },
      { at: 'meeting', line: 'A paper plane lands at your feet. It says: Lunch at noon?', gift: { coins: 8 } },
    ],
  },
  supermarket: {
    title: 'The grand-opening raffle', icon: '🎟️', who: 'The hillside traders',
    intro: 'The supermarket is holding a raffle for its grand opening. Every sale at the checkout earns a ticket.',
    beats: [
      { at: 'fun:bins', ask: 'Look at the fresh produce stand', line: 'Your own carrots are on display under a sign: Grown by the Rowans, just down the road!' },
      { on: 'sell:market', times: 3, ask: 'Sell at the checkout 3 times for raffle tickets', line: 'Three raffle tickets: numbers 7, 13 and 42. The manager winks at number 42.' },
      { at: 'fun:shelves', needs: { tulip: 1 }, ask: 'Bring 1 tulip to brighten the shelves', line: 'The tulip goes in a jar by the till. Shoppers smile at it all afternoon.' },
      { at: 'fun:stock', ask: 'Peek in the back room for the big draw', line: 'The big draw… number 42! You win a basket of treats and your picture on the wall.' },
    ],
    reward: { coins: 150 }, memory: 'You won the supermarket’s grand-opening raffle with ticket number 42.',
    moments: [
      { at: 'chillers', line: 'You stand in the cold section for a moment. Very refreshing.', gift: { energy: 8 } },
      { at: 'shelves', line: 'A free sample of honey crackers. You take two.', gift: { coins: 6 } },
    ],
  },
  bakery: {
    title: 'Hugo’s lost recipe', icon: '🍞', who: 'Hugo',
    intro: 'Hugo’s famous seed loaf recipe blew out of the window in the spring wind, three days before the festival.',
    beats: [
      { at: 'fun:counter', ask: 'Ask Hugo at the bakes counter', line: 'Hugo remembers half of it: “Pumpkin, an egg… and something golden. Or was it green?”' },
      { at: 'fun:pantry', needs: { pumpkin: 1, egg: 1 }, ask: 'Bring 1 pumpkin and 1 egg to the pantry', line: 'The dough smells right, but something is missing. Nell sniffs it: “Sunshine. It needs sunshine.”' },
      { on: 'cook', times: 1, ask: 'Cook any dish in a kitchen to warm your hands', line: 'Your hands smell of cooking. Hugo nods: now you are ready to knead.' },
      { at: 'fun:bread', needs: { sunflower: 1 }, ask: 'Bring 1 sunflower: its seeds are the secret', line: 'Sunflower seeds! The loaf comes out golden, and Hugo names a new bun after your family.' },
    ],
    reward: { coins: 130 }, memory: 'You found Hugo’s secret: sunflower seeds. The Rowan bun is on sale every Sunday.',
    moments: [
      { at: 'bread', line: 'Hugo slips you a warm roll. It is gone in four bites.', gift: { energy: 10 } },
      { at: 'family', line: 'Nell’s recipe cards hang on the fridge with fruit magnets. One is for you.', gift: { coins: 8 } },
    ],
  },
  moss: {
    title: 'The calf who would not sleep', icon: '🐮', who: 'Mara',
    intro: 'Mara’s new calf moos all night long, and the whole Moss family is yawning.',
    beats: [
      { at: 'fun:beds', ask: 'Look at the sleepy beds', line: 'Oren has hay in his hair and dark circles under his eyes. “She just won’t sleep,” he yawns.' },
      { at: 'fun:hay', needs: { carrot: 1 }, ask: 'Bring 1 carrot to the hay corner', line: 'The calf crunches the carrot and looks… more awake than ever. Wren suggests a lullaby.' },
      { at: 'fun:tools', ask: 'Find something musical among the tools', line: 'An old cowbell and a tin bucket. Not a lullaby yet, but a start.' },
      { at: 'fun:table', ask: 'Sing the lullaby in the kitchen corner', line: 'Wren sings, you ring the cowbell softly, and the calf falls asleep mid-moo. Everyone tiptoes away.' },
    ],
    reward: { coins: 80, milk: 2 }, memory: 'You and Wren sang the Moss calf to sleep with a cowbell lullaby.',
    moments: [
      { at: 'hay', line: 'A barn kitten naps in the hay. You let it sleep.', gift: { coins: 5 } },
      { at: 'table', line: 'Oren pours you a glass of fresh milk.', gift: { energy: 10 } },
    ],
  },
  vale: {
    title: 'Pip’s birdhouse', icon: '🐦', who: 'Ash and Fern',
    intro: 'Pip wants a birdhouse for the swallows under your roof. Ash says every builder starts with one.',
    beats: [
      { at: 'fun:bench', ask: 'Look at the plans on the workbench', line: 'Pip’s plan: a birdhouse with three floors, a slide and a balcony. Ambitious.' },
      { at: 'fun:lumber', needs: { wood: 3 }, ask: 'Bring 3 timber to the lumber rack', line: 'You saw and Pip holds the ruler. Fern only winces once.' },
      { at: 'fun:parts', ask: 'Find a roof in the parts bin', line: 'A tin lid becomes the roof. Kit adds a tiny weather vane shaped like a carrot.' },
      { at: 'fun:tools', ask: 'Paint the birdhouse in the tool bay', line: 'Sunflower yellow! The swallows move in the very next morning.' },
    ],
    reward: { coins: 90 }, memory: 'Pip’s birdhouse hangs under your roof. The swallows came the next morning.',
    moments: [
      { at: 'lumber', line: 'Fresh sawdust smells of pine and rain.', gift: { coins: 6 } },
      { at: 'parts', line: 'You find Ash’s lost button in the parts bin. Fern sews it back on.', gift: { coins: 10 } },
    ],
  },
};
export const TALE_IDS = Object.keys(TALES);
const ENERGY_MAX = 100;

const tale = (s, id) => (s.tales ??= {})[id] ??= { step: 0, count: 0 };
export const taleDone = (s, id) => tale(s, id).step >= TALES[id].beats.length;
export const taleBeat = (s, id) => TALES[id].beats[tale(s, id).step] ?? null;
const has = (s, needs = {}) => Object.entries(needs).every(([item, n]) => (s.inventory?.[item] ?? 0) >= n);
function give(s, gift = {}) {
  for (const [item, n] of Object.entries(gift)) {
    if (item === 'coins') s.coins = (s.coins ?? 0) + n;
    else if (item === 'energy') s.energy = Math.min(ENERGY_MAX, (s.energy ?? 0) + n);
    else (s.inventory ??= {})[item] = (s.inventory[item] ?? 0) + n;
  }
}
/** Moves a tale one beat on; the last beat pays the reward. */
function advance(s, id) {
  const t = tale(s, id), beat = TALES[id].beats[t.step]; t.step++; t.count = 0;
  const done = t.step >= TALES[id].beats.length; if (done) give(s, TALES[id].reward);
  return { tale: id, icon: TALES[id].icon, line: beat.line, done, reward: done ? TALES[id].reward : null };
}
/** Today's moment in a building: the day picks one of its spots. */
export const momentOf = (s, id) => { const list = TALES[id]?.moments ?? []; return list.length ? list[(s.day ?? 1) % list.length] : null; };

/** A tap on spot `spotId` in building `id`: the tale's beat there, or today's moment, or nothing (the spot's own line). */
export function taleSpot(s, id, spotId) {
  if (!TALES[id]) return null;
  const beat = taleBeat(s, id);
  if (beat?.at === `fun:${spotId}`) {
    if (!has(s, beat.needs)) return { tale: id, icon: TALES[id].icon, line: beat.ask, missing: true };
    for (const [item, n] of Object.entries(beat.needs ?? {})) s.inventory[item] -= n;
    return advance(s, id);
  }
  const m = momentOf(s, id);
  if (m && m.at === spotId && (s.taleMoments ??= {})[id] !== s.day) { s.taleMoments[id] = s.day; give(s, m.gift); return { tale: id, icon: '✨', line: m.line, gift: m.gift }; }
  return null;
}
/** An action done anywhere (main.mjs runAction, after it succeeded): beats waiting for it count it. */
export function taleEvent(s, type, arg = {}) {
  const key = type === 'civic' ? `civic:${arg.id}` : type === 'sell' && arg.country ? 'sell:market' : type, out = [];
  for (const id of TALE_IDS) {
    const beat = taleBeat(s, id); if (!beat || beat.on !== key) continue;
    // A beat only listens once its tale has begun (its first beat is always a visit to the building).
    if (tale(s, id).step === 0) continue;
    const t = tale(s, id); t.count++;
    if (t.count >= (beat.times ?? 1)) out.push(advance(s, id));
  }
  return out;
}
/** The building's plan with its tale spot and today's moment spot sparkling (their chips gain ✨). */
export function decoratePlan(plan, s) {
  const id = plan?.id, beat = TALES[id] ? taleBeat(s, id) : null, m = TALES[id] ? momentOf(s, id) : null, fresh = m && s.taleMoments?.[id] !== s.day;
  if (!beat?.at && !fresh) return plan;
  const targets = plan.targets.map(t => {
    if (t.type !== 'fun') return t;
    if (beat?.at === `fun:${t.id}`) return { ...t, text: `✨ ${t.text}`, label: `✨ ${beat.ask}` };
    if (fresh && m.at === t.id) return { ...t, text: `✨ ${t.text}` };
    return t;
  });
  return { ...plan, targets };
}
/** What the album's Town tales page lists. */
export function taleList(s) {
  return TALE_IDS.map(id => { const def = TALES[id], t = tale(s, id), beat = taleBeat(s, id); return { id, ...def, step: t.step, steps: def.beats.length, done: !beat, ask: beat?.ask ?? '', count: t.count, times: beat?.times ?? 0 }; });
}
/** Save safety: only known tales, steps in range, moments no later than today. */
export function parseTales(raw, s) {
  const tales = {}, moments = {};
  for (const id of TALE_IDS) {
    const t = raw?.tales?.[id]; if (t && typeof t === 'object') { const step = Math.max(0, Math.min(TALES[id].beats.length, Math.floor(Number(t.step) || 0))); tales[id] = { step, count: Math.max(0, Math.min(99, Math.floor(Number(t.count) || 0))) }; }
    const m = Math.floor(Number(raw?.taleMoments?.[id])); if (m > 0 && m <= s.day) moments[id] = m;
  }
  return { tales, taleMoments: moments };
}
