// What the family says at home (house-life.mjs shows it in a speech bubble), after Zoo Garden's cottage chatter
// (cute_game src/house-talk.ts): little kids' literal logic and big wonder, grown-ups' easy household talk. Each room has
// its own pool per age; June and Pip have lines of their own about this family's story (the album, the garden, the pond,
// Ada's seed tin); neighbours in their own homes use the room pools. Two people in a room sometimes trade a line and a
// reply. A TalkBag deals lines like cards: none repeats until three quarters of its pool has been used.
export const ROOM_TALK = {
  living: {
    kid: [
      'If I sit very still, the sofa thinks I am a cushion.',
      'I built a pillow fort. Nobody may enter without a snack.',
      'Is the fire hungry? It keeps eating the logs.',
      'When I grow up I want to be taller. That is my whole plan.',
      'I am not tired. My eyes are just resting with the lights off.',
      'Can we have a party? A small one? With pie?',
      'I found a crumb in the sofa. Finders keepers!',
    ],
    grown: [
      'Ah, the sofa. My favourite place in the whole county.',
      'Someone keeps moving the cushions. I know it is you.',
      'Nothing beats a warm room after a long day in the field.',
      'Put the kettle on, would you? Just one cup. Maybe two.',
      'I sat down for one minute and an hour went by.',
      'You could at least wipe your boots before the rug.',
      'A quiet evening at home. Exactly what I ordered.',
    ],
  },
  kitchen: {
    kid: [
      'Can I lick the spoon? Just the spoon. Not the pot.',
      'Carrots help you see in the dark. I am trying it now.',
      'I am not hungry. My tummy is just very loud.',
      'I helped! I stirred it twice and only spilled once.',
      'I want soup with no green bits. Only happy bits.',
      'Is it supper yet? How about now? How about now?',
    ],
    grown: [
      'Who left the lid off the honey jar? Again?',
      'A pinch of salt, a pinch more, and… perfect.',
      'Soup is nearly ready. Do not touch the pot.',
      'Vegetables from our own beds taste twice as nice.',
      'I will do the dishes. Tomorrow. First thing.',
      'Tea is the answer. I forget the question.',
      'Cooking for the family is my favourite kind of busy.',
    ],
  },
  bedroom: {
    kid: [
      'I am not sleepy. I am just practising yawning.',
      'One more story. A short one. A medium one.',
      'My socks are lost. They went on holiday without me.',
      'Is it morning yet? It feels like it should be morning.',
      'I tucked myself in all by myself. Look, a burrito!',
    ],
    grown: [
      'A proper bed and a proper sleep. That is luxury.',
      'I will fold the laundry. Right after this little lie-down.',
      'This wardrobe is full and I still have nothing to wear.',
      'Ah, morning stretches. Everything goes pop.',
      'Open the curtains, the garden looks lovely today.',
      'Five more minutes. Then I am up. Ten at most.',
    ],
  },
  bath: {
    kid: [
      'The duck says the water is too warm. I asked him.',
      'Bubbles! I have a bubble beard! Call me Grandpa!',
      'My fingers went all wrinkly. Am I turning into a raisin?',
      'I brushed my teeth. Well, I brushed one tooth really well.',
      'Splash! Oops. The floor wanted a bath too.',
    ],
    grown: [
      'A hot bath fixes almost everything.',
      'Who used all the hot water? I have my suspicions.',
      'Hang your towel up, it will dry much faster.',
      'The duck stays. The duck always stays.',
      'Two minutes for teeth. The whole two minutes.',
      'Ah, fresh as a daisy. A slightly damp daisy.',
    ],
  },
  nook: {
    kid: [
      'This is a chicken. Or a cloud. It is still deciding.',
      'I made you a present. Please do not look until I say.',
      'Blue and yellow made green! I am a wizard!',
      'My picture needs more purple. Everything needs more purple.',
      'I drew our house, but bigger, with a slide on the roof.',
      'I know all my letters except the wiggly ones.',
    ],
    grown: [
      'That painting is coming along nicely. Bold use of orange.',
      'Has anyone seen the good scissors? They walk off by themselves.',
      'I keep every string and button. You never know.',
      'Careful, that paint is still wet. Ask me how I know.',
      'So many drawings. We will need a bigger wall.',
    ],
  },
};
/** Lines of their own, by resident id. */
export const PERSONA_TALK = {
  june: [
    'I pressed the first carrot top into the album. Do not laugh.',
    'The kettle is warm. It is always warm. That is my whole promise.',
    'Ada says the willow was smaller than Pip once. Imagine.',
    'Three harvests in and it already feels like our house.',
    'I wrote today’s page: nothing happened, and it was lovely.',
    'If you are going to the pond, take a hat. And bring back supper.',
    'Pip wants a chicken of her own. I said we would think about it.',
  ],
  pip: [
    'I planted a tiny wish next to the garden. Is it growing yet?',
    'I drew the three of us. And one very large chicken.',
    'Grandma Ada’s seed tin rattles. I think the seeds are talking.',
    'When I am big I will catch the golden fish. And then let it go.',
    'Wren and I have a club. Only very small gardeners can join.',
    'Can the hen sleep in my corner? Just tonight?',
    'I whispered to the carrots so they grow faster.',
  ],
};
/** Two-person exchanges per room: a line, then the other person in the room replies. */
export const EXCHANGES = {
  living: [['Is it my turn on the comfy cushion?', 'It is always your turn, apparently.'], ['Who wants to hear about my day?', 'Only if it ends with a snack.']],
  kitchen: [['What is for supper?', 'Food. Now set the table, please.'], ['Can I help cook?', 'Yes! Start by washing those hands.']],
  bedroom: [['Are you awake?', 'I am now.'], ['Goodnight!', 'Goodnight! Do not let the bed bugs bite. We do not have any.']],
  bath: [['Bath time!', 'Do I have to? I was clean last week.'], ['Have you seen the duck?', 'He is in the bath. Where else would he be?']],
  nook: [['Do you like my painting?', 'I love it. Which way up does it go?'], ['I need the glue.', 'It is stuck to your elbow.']],
};
/** Deals lines from a pool without repeats until three quarters of it has been used, then starts over. */
export class TalkBag {
  constructor() { this.used = new Map(); }
  pick(key, pool, random = Math.random) {
    if (!pool?.length) return '';
    let used = this.used.get(key); if (!used) this.used.set(key, used = new Set());
    if (used.size >= Math.ceil(pool.length * .75)) used.clear();
    const free = pool.map((_, i) => i).filter(i => !used.has(i)), i = free[Math.floor(random() * free.length)] ?? 0;
    used.add(i); return pool[i];
  }
}
/** One line for a person {id, child, room}: a third of the time their own, otherwise the room's, by age. */
export function lineFor(bag, person, random = Math.random) {
  const age = person.child ? 'kid' : 'grown', own = PERSONA_TALK[person.id];
  if (own && random() < .34) return bag.pick('own:' + person.id, own, random);
  return bag.pick(`${person.room}:${age}`, ROOM_TALK[person.room]?.[age] ?? ROOM_TALK.living[age], random);
}
/** A line and its reply for a room, or null. */
export function exchangeFor(bag, room, random = Math.random) {
  const pool = EXCHANGES[room]; if (!pool?.length) return null;
  const first = bag.pick('x:' + room, pool.map(p => p[0]), random); return pool.find(p => p[0] === first) ?? null;
}
