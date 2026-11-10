// The eight chapter scenes and the two endings (docs/STORY.md). Pure data and pure functions; fetched with import() (story-rules.mjs).
// A beat is {who, text} with text 'English|Tiếng Việt'. `alt` is a list of [test(state), text] that replaces the text when the test is
// true (the first that holds), so a scene reacts to what the player did. who: 'ada' | 'june' | 'pip' | 'you' | 'narrator' | a resident id.
import { L, hasBoth, projectsFunded } from './story-text.mjs';

const b = (who, text, alt) => (alt ? { who, text, alt } : { who, text });
const funded2 = s => projectsFunded(s) >= 2;
const fr = (s, id) => s.friendship?.[id] ?? 0;

export const SCENES = [
  // 0  A key and a seed tin
  [
    b(
      'narrator',
      'The brass key turned on the second try, as if the door had been waiting to be sure.|Chìa khóa đồng xoay ở lần thứ hai, như thể cánh cửa đã chờ cho chắc chắn.',
    ),
    b(
      'ada',
      'You came. Sit, sit. The kettle has been on since Tuesday.|Các con đến rồi. Ngồi đi, ngồi đi. Ấm nước bà để sôi từ hôm thứ Ba rồi.',
    ),
    b(
      'june',
      'It smells exactly the same. Pond, wood smoke, and something with cinnamon.|Mùi vẫn y như xưa. Mùi ao, mùi khói củi, và một chút quế.',
    ),
    b(
      'pip',
      'Is that a real willow? It is bigger than our whole building.|Đó là cây liễu thật ạ? To hơn cả tòa nhà của mình ngày xưa.',
    ),
    b(
      'ada',
      'Your grandfather and I planted it the day we married. It was smaller than you.|Ông và bà trồng nó ngày cưới. Hồi đó nó còn thấp hơn con.',
    ),
    b(
      'ada',
      'Take this tin. Seeds, mostly; a few are older than your mother. Nothing here has to be done in a hurry.|Cầm hộp này đi. Toàn hạt giống, vài hạt còn già hơn mẹ con. Ở đây không việc gì phải vội.',
    ),
    b(
      'narrator',
      'Under the sugar bowl there is a folded letter from the county. Ada slides the bowl a little further over it.|Dưới hũ đường có một lá thư gấp của huyện. Bà Ada khẽ đẩy hũ đường che kín nó hơn.',
    ),
  ],
  // 1  Something takes root
  [
    b(
      'narrator',
      'Three beds cleared, soil under your nails, and a smell of green you had forgotten.|Ba luống đã thu hoạch, đất còn trong móng tay, và mùi xanh mà bạn đã quên từ lâu.',
      [
        [
          s => s.stats.harvests >= 8,
          'Eight harvests already, soil under your nails, and a smell of green you had forgotten.|Đã tám lần thu hoạch, đất còn trong móng tay, và mùi xanh mà bạn đã quên từ lâu.',
        ],
      ],
    ),
    b('pip', 'I thought dirt was boring. It was only busy.|Con tưởng đất chán lắm. Hóa ra nó chỉ đang bận thôi.'),
    b(
      'june',
      'I used to hide in this row so I would not have to shell peas. You can still see my footprints.|Hồi nhỏ mẹ hay trốn ở luống này để khỏi bóc đậu. Vẫn còn dấu chân của mẹ kìa.',
      [
        [
          s => s.day % 5 === 0,
          'It is raining and the whole row is singing. I used to hide here so I would not have to shell peas.|Trời mưa và cả luống như đang hát. Hồi nhỏ mẹ hay trốn ở đây để khỏi bóc đậu.',
        ],
      ],
    ),
    b(
      'ada',
      'You left a little footprint at the end of every row. I never filled them in.|Cuối mỗi luống con đều để lại một dấu chân nhỏ. Bà chưa bao giờ lấp chúng đi.',
    ),
    b(
      'pip',
      'Can I draw them? The carrots? They are as big as me.|Con vẽ chúng được không ạ? Mấy củ cà rốt ấy? Chúng to bằng con luôn.',
    ),
    b(
      'june',
      'Then we will keep an album. Ordinary days only. The big ones can look after themselves.|Vậy nhà mình làm một cuốn album. Chỉ ghi những ngày bình thường thôi. Ngày trọng đại tự lo được rồi.',
    ),
    b(
      'narrator',
      'The first page is three enormous carrots, signed Pip. Below, in June’s hand: Our first harvest.|Trang đầu là ba củ cà rốt khổng lồ, ký tên Pip. Bên dưới, nét chữ của June: Vụ thu hoạch đầu tiên của nhà mình.',
    ),
  ],
  // 2  The water remembers
  [
    b(
      'ellis',
      'That boat has waited forty years for somebody to row it badly. Welcome.|Chiếc thuyền ấy chờ bốn mươi năm để có người chèo dở ẹc. Chào mừng nhé.',
    ),
    b('ellis', 'Two fish. The pond is polite to beginners.|Hai con cá. Ao lúc nào cũng lịch sự với người mới.', [
      [
        s => s.stats.fish >= 6,
        'Six already. Careful, the pond will start expecting you.|Đã sáu con rồi. Coi chừng, ao sẽ bắt đầu chờ bạn đấy.',
      ],
    ]),
    b('you', 'I only wanted to see how still the water could be.|Tôi chỉ muốn xem mặt nước có thể yên đến đâu.'),
    b(
      'ellis',
      'Then you are a fisher already. Here: my notebook. Every fish, every weather, forty years of it.|Vậy là bạn đã thành người câu cá rồi. Đây, cuốn sổ của ông: mọi con cá, mọi kiểu thời tiết, bốn mươi năm.',
    ),
    b(
      'ellis',
      'Read this one: “Sunny, wind west, two perch. Daughter swam today, no rope.” Your mother.|Đọc dòng này: “Nắng, gió tây, hai con rô. Hôm nay con gái bơi, không cần dây.” Đó là mẹ con.',
    ),
    b(
      'june',
      'I learned in that same spot, one summer. Your mother held my chin and swore it was floating.|Mẹ cũng học bơi đúng chỗ đó, một mùa hè. Mẹ con đỡ cằm mẹ và cứ khăng khăng là mẹ tự nổi.',
    ),
  ],
  // 3  A table for everyone
  [
    b(
      'narrator',
      'The market square smells of bread and wet stone. Somebody is whistling out of tune on purpose.|Quảng trường chợ thơm mùi bánh mì và đá ẩm. Ai đó đang huýt sáo lạc điệu một cách cố ý.',
    ),
    b(
      'bea',
      'Your carrots have already been in three lunches. One of them was mine.|Cà rốt của bạn đã vào ba bữa trưa rồi. Một bữa là của tôi.',
      [
        [
          s => s.stats.sales >= 600,
          'Your produce is in half the pots in the village. I stopped counting at my own.|Nông sản của bạn có trong nửa số nồi cả làng. Tôi thôi đếm từ nồi của mình.',
        ],
      ],
    ),
    b(
      'theo',
      'The Bells have driven this road for generations. Take the jeep key. Kick the left front, gently.|Nhà họ Bell đi con đường này mấy đời rồi. Cầm chìa khóa xe jeep đi. Đá nhẹ vào bánh trước bên trái.',
    ),
    b('you', 'I have not earned a key yet.|Tôi vẫn chưa xứng đáng nhận chìa khóa.'),
    b(
      'theo',
      'You carried Hugo’s flour up the step without being asked. That counts.|Bạn tự vác bột của Hugo lên bậc thềm mà không ai nhờ. Thế là đủ.',
    ),
    b(
      'pip',
      'I am in charge of the sign. It says CARROTS, and also sorry about the spelling.|Con phụ trách tấm biển. Trên đó ghi CÀ RỐT, và cả xin lỗi vì viết sai chính tả.',
    ),
    b(
      'narrator',
      'Ada counted the coins twice, went quiet, and put them in the tin. “The roof,” she said, to nobody.|Bà Ada đếm tiền hai lần, lặng đi, rồi cho vào hộp. “Mái nhà,” bà nói, không với ai cả.',
    ),
  ],
  // 4  Room to grow
  [
    b(
      'pip',
      'I need somewhere to keep my drawings. They keep falling out of the album.|Con cần một chỗ để cất tranh. Chúng cứ rơi khỏi cuốn album.',
    ),
    b(
      'june',
      'And I would like one room where we can all sit without moving somebody’s boots.|Còn mẹ muốn có một căn phòng để cả nhà ngồi mà không phải dọn giày của ai.',
    ),
    b(
      'ada',
      'The old beam over the kitchen is a grumbler. It has been telling me so for years.|Cái xà cũ trên bếp hay cằn nhằn lắm. Nó kể lể với bà bao năm rồi.',
      [
        [
          s => s.upgrades.house >= 2,
          'The new boards are lovely. The old beam over the kitchen still grumbles, mind.|Ván mới đẹp lắm. Nhưng cái xà cũ trên bếp vẫn còn cằn nhằn đấy.',
        ],
      ],
    ),
    b(
      'ada',
      'There is a letter from the county about it. I was not going to say.|Có thư của huyện nói về nó. Bà định không nói.',
    ),
    b('june', 'Ada. What does the letter say?|Bà ơi. Thư ấy nói gì ạ?'),
    b(
      'ada',
      'That a roof needs somebody to love it. I have been loving it on my own for a while.|Rằng mái nhà cần có người thương nó. Bà thương nó một mình cũng lâu rồi.',
    ),
    b(
      'narrator',
      'Pip pins her drawing beside her new bed: the three of you, and one very large chicken.|Pip ghim bức tranh bên cạnh giường mới: ba người nhà mình, và một con gà rất to.',
      [
        [
          s => s.stats.feeds >= 5,
          'Pip pins her drawing beside her new bed: the three of you, and now a whole very large flock.|Pip ghim bức tranh bên cạnh giường mới: ba người nhà mình, và cả một đàn gà rất to.',
        ],
      ],
    ),
  ],
  // 5  Beyond the willow
  [
    b(
      'narrator',
      'The road leaves the willow behind and the whole valley opens like a hand.|Con đường bỏ cây liễu lại phía sau và cả thung lũng mở ra như một bàn tay.',
    ),
    b(
      'theo',
      'Left front tyre, gently. And do not let Pip near the horn.|Bánh trước bên trái, nhẹ thôi. Và đừng để Pip lại gần cái còi.',
    ),
    b(
      'june',
      'Look at the lane. Someone has hung lanterns along it for us.|Nhìn con đường kìa. Có người đã treo đèn lồng dọc lối cho nhà mình.',
      [
        [
          s => !s.projects?.lanterns && funded2(s),
          'Look at the lane. Two things in this village are mended now, and some of that is us.|Nhìn con đường kìa. Hai thứ trong làng đã được sửa, và một phần là nhờ nhà mình.',
        ],
        [
          s => !s.projects?.lanterns,
          'Look at the lane. It is a good road, even without a single lantern on it.|Nhìn con đường kìa. Một con đường đẹp, dù chưa có chiếc đèn lồng nào.',
        ],
      ],
    ),
    b(
      'pip',
      'Can I choose one thing that is not for anything? Just one, for the cottage.|Con chọn một món không dùng để làm gì được không? Chỉ một thôi, cho căn nhà.',
    ),
    b(
      'nell',
      'The harvest supper is every third day. Bring something that tastes like home.|Bữa tiệc mùa gặt cứ ba ngày một lần. Hãy mang theo thứ gì đó có vị quê nhà.',
    ),
    b(
      'ada',
      'A wide world is lovely. It is the road home that makes it worth leaving.|Thế giới rộng lớn thật đẹp. Chính con đường về nhà mới khiến việc ra đi đáng giá.',
    ),
  ],
  // 6  A recipe passed down
  [
    b(
      'ada',
      'I never wrote it down. A handful, a pinch, and whatever the birthday needed.|Bà chưa bao giờ ghi lại. Một nắm, một nhúm, và bất cứ thứ gì sinh nhật cần.',
    ),
    b(
      'hugo',
      'Pie crust is patience with butter in it. Ada taught me that, so blame her.|Vỏ bánh là sự kiên nhẫn có thêm bơ. Bà Ada dạy tôi vậy, nên cứ trách bà ấy.',
    ),
    b(
      'pip',
      'I want to write it down. I can write a handful, but how big is a handful? Mine is small.|Con muốn ghi lại. Con viết được một nắm, nhưng một nắm là to cỡ nào? Tay con nhỏ lắm.',
    ),
    b(
      'ada',
      'Then write: a handful, the size of your own. That is the whole recipe.|Vậy con ghi: một nắm, bằng tay của chính con. Đó là cả công thức.',
    ),
    b(
      'june',
      'Twenty-four places at the table. I counted twice. Nobody is hungry tonight.|Hai mươi bốn chỗ trên bàn. Mẹ đếm hai lần rồi. Tối nay không ai đói cả.',
      [
        [
          s => fr(s, 'hugo') >= 5,
          'Hugo has sent his own oven over. Twenty-four places, and nobody is hungry tonight.|Hugo cho mượn cả lò nướng của mình. Hai mươi bốn chỗ, và tối nay không ai đói cả.',
        ],
      ],
    ),
    b(
      'narrator',
      'Pip insists on adding a tiny bowl for the garden birds. Ada does not argue.|Pip nhất định thêm một chiếc bát nhỏ cho lũ chim trong vườn. Bà Ada không cãi.',
      [
        [
          s => s.stats.festivals >= 3,
          'Pip adds a tiny bowl for the garden birds, as she has every supper since the first. Ada does not argue.|Pip lại thêm một chiếc bát nhỏ cho lũ chim, như mọi bữa tiệc từ lần đầu. Bà Ada không cãi.',
        ],
      ],
    ),
  ],
  // 7  The next spring: five beats, then the choice, then three ending beats
  [
    b(
      'narrator',
      'The pond runs clear. The young trees lean toward the light. Everyone has found a place on the porch.|Ao đã trong. Những cây non nghiêng về phía ánh sáng. Ai cũng đã tìm được chỗ ngồi trên hiên.',
      [
        [
          s => funded2(s),
          'The pond runs clear. The young trees lean toward the light. Half the village has left a ladder against the cottage wall.|Ao đã trong. Những cây non nghiêng về phía ánh sáng. Nửa làng đã dựng thang bên tường nhà, không ai nhờ.',
        ],
      ],
    ),
    b(
      'ada',
      'The county wants an answer by spring. I keep the cottage, or I sell and live by my sister’s sea.|Huyện cần câu trả lời trước mùa xuân. Bà giữ nhà, hoặc bán đi và về sống cạnh biển với chị bà.',
    ),
    b('june', 'You were going to leave it? After all this?|Bà định bỏ nơi này sao? Sau tất cả những chuyện này?'),
    b(
      'ada',
      'I was going to leave it quietly. That is different. It did not last the summer.|Bà định lặng lẽ rời đi. Khác chứ. Mà quyết định ấy không qua nổi mùa hè.',
    ),
    b(
      'pip',
      'Gran says the willow was smaller than me once. I want it to be there when I am big.|Bà bảo cây liễu từng thấp hơn con. Con muốn lúc con lớn nó vẫn ở đó.',
    ),
    {
      who: 'ada',
      text: 'Ada holds out the key, warm from her hand. “Whatever you choose, I will be glad. Choose.”|Bà Ada chìa chiếc chìa khóa còn ấm hơi tay. “Con chọn gì bà cũng vui. Chọn đi.”',
      choice: true,
      choices: [
        { id: 'stay', label: 'Keep the cottage as our home|Giữ căn nhà làm tổ ấm của gia đình' },
        { id: 'share', label: 'Open the cottage to the village|Mở căn nhà ra cho cả làng' },
      ],
    },
  ],
];

/** The three closing beats of each ending, and the words that close the first volume. */
export const ENDINGS = {
  stay: {
    title: 'The key stays on its nail|Chìa khóa vẫn treo trên đinh',
    pick: 'Keep the cottage as our home|Giữ căn nhà làm tổ ấm của gia đình',
    beats: [
      b(
        'ada',
        'Then it is settled. The kettle stays on, the beam gets a new friend, and I get to complain about the noise.|Vậy là xong. Ấm nước cứ sôi, cái xà có thêm bạn mới, còn bà thì được phàn nàn về tiếng ồn.',
      ),
      b(
        'june',
        'We will winter here. Pip gets her own door, and I will finally learn the pie.|Nhà mình sẽ ở đây qua mùa đông. Pip có cửa riêng, và mẹ cuối cùng cũng học được món bánh.',
      ),
      b(
        'narrator',
        'The brass key goes back on its nail. Some homes are kept by staying, one ordinary day at a time.|Chiếc chìa khóa đồng lại treo trên đinh. Có những ngôi nhà được giữ bằng cách ở lại, từng ngày bình thường một.',
      ),
    ],
    closing:
      'Years will bring new harvests and new leaves on the willow. The family stays, and the kettle is always on.|Năm tháng sẽ mang đến những vụ mùa mới và lá mới trên cây liễu. Cả nhà ở lại, và ấm nước lúc nào cũng sôi.',
  },
  share: {
    title: 'The gate stays open|Cổng luôn mở',
    pick: 'Open the cottage to the village|Mở căn nhà ra cho cả làng',
    beats: [
      b(
        'ada',
        'Then we leave the gate open. Anyone who passes may sit down.|Vậy mình để ngỏ cổng. Ai đi ngang cũng có thể ngồi xuống.',
      ),
      b(
        'june',
        'Bea can have Thursdays. Hugo, the oven. I will bring far too many chairs.|Bea giữ các ngày thứ Năm. Hugo giữ lò nướng. Còn mẹ sẽ mang thật nhiều ghế.',
      ),
      b(
        'narrator',
        'The seed tin goes round the village, a few seeds at a time. The key hangs by the gate where everyone can see it.|Hộp hạt giống đi khắp làng, mỗi nhà vài hạt. Chiếc chìa khóa treo cạnh cổng cho mọi người cùng thấy.',
      ),
    ],
    closing:
      'Years will bring new harvests and new leaves on the willow. The cottage has a long table now, and the gate is never shut.|Năm tháng sẽ mang đến những vụ mùa mới và lá mới trên cây liễu. Căn nhà giờ có một bàn dài, và cổng không bao giờ đóng.',
  },
};

const pick = (beat, s) => beat.alt?.find(([test]) => test(s))?.[1] ?? beat.text;
const resolve = (beat, s, raw) => {
  const text = pick(beat, s);
  const out = { who: beat.who, text: raw ? text : L(text) };
  if (beat.choices && !s.ending) out.choices = beat.choices.map(c => ({ id: c.id, label: raw ? c.label : L(c.label) }));
  return out;
};

/**
 * The beats of chapter `i`'s scene, with the player's state resolved. The last chapter has six beats until the ending is chosen (the
 * sixth carries `choices`), then its first five plus the chosen ending's three. `raw` keeps the 'English|Vietnamese' text (tests).
 */
export function sceneFor(state, i, raw = false) {
  const scene = SCENES[i];
  if (!scene) return [];
  if (i === 7 && state.ending && ENDINGS[state.ending])
    return [...scene.slice(0, 5), ...ENDINGS[state.ending].beats].map(x => resolve(x, state, raw));
  return scene.map(x => resolve(x, state, raw));
}

/** The chosen ending: {id, title, closing}, or null before the choice. */
export function endingFor(state, raw = false) {
  const e = ENDINGS[state.ending];
  if (!e) return null;
  return { id: state.ending, title: raw ? e.title : L(e.title), closing: raw ? e.closing : L(e.closing) };
}

/** The first pending scene as the UI shows it: {beat, index, total, kind, chapter|id, level}, or null when nothing waits. */
export function viewPending(state) {
  const e = state.pendingScenes?.[0];
  if (!e) return null;
  const beats = e.k === 'h' ? heartBeats(state, e.id, e.lv) : sceneFor(state, e.i);
  const beat = beats[Math.min(e.b, beats.length - 1)];
  return {
    beat,
    index: Math.min(e.b, beats.length - 1),
    total: beats.length,
    kind: e.k === 'h' ? 'heart' : 'chapter',
    entry: e,
  };
}

import { HEART_SCENES } from './villager-lines.mjs';
const heartBeats = (state, id, lv, raw = false) =>
  HEART_SCENES[id][lv].map(([who, text]) => ({ who, text: raw ? text : L(text) }));
export { heartBeats };

export const allLines = () => {
  const lines = [];
  for (const scene of SCENES)
    for (const x of scene) {
      lines.push(x.text, ...(x.alt ?? []).map(a => a[1]), ...(x.choices ?? []).map(c => c.label));
    }
  for (const e of Object.values(ENDINGS)) lines.push(e.title, e.pick, e.closing, ...e.beats.map(x => x.text));
  return lines;
};
export const missingVietnamese = () => allLines().filter(l => !hasBoth(l));
