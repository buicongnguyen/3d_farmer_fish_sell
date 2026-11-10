// What June and Pip say when you talk to them (docs/STORY.md, "The family"). Lines depend on the chapter, on yesterday (rain, what was
// harvested, caught or sold; state.yesterday is set at each sleep) and on the hearts. Pip grows over the story: small and curious in
// chapters 1 to 3, busy and proud in 4 to 6, quietly older in 7 and 8. Pure; fetched with import() (story-rules.mjs).
import { L, hash, rainOn, seasonOf, hasBoth } from './story-text.mjs';

/** The conditions a line can ask for. Each is a function of the state and of who is speaking. */
export const WHEN = {
  rainY: s => rainOn(s.day - 1),
  rain: s => rainOn(s.day),
  harvY: s => (s.yesterday?.h ?? 0) > 0,
  fishY: s => (s.yesterday?.f ?? 0) > 0,
  soldY: s => (s.yesterday?.s ?? 0) > 0,
  fest: s => s.day % 3 === 0,
  winter: s => seasonOf(s.day) === 3,
  close: (s, who) => (s.friendship?.[who] ?? 0) >= 5,
};

// [who, first chapter, last chapter, condition or null, 'English|Tiếng Việt']   (chapter = state.chapter, 0 to 8)
export const FAMILY_LINES = [
  [
    'june',
    0,
    3,
    null,
    'I keep looking for the crack in the doorframe where we measured heights. It is still there.|Mẹ cứ tìm vết nứt trên khung cửa nơi nhà mình đo chiều cao. Nó vẫn còn đó.',
  ],
  [
    'june',
    0,
    3,
    'harvY',
    'You came in smelling of earth again. I am getting fond of it.|Bạn lại về nhà thơm mùi đất. Mình bắt đầu thích mùi ấy rồi.',
  ],
  [
    'june',
    0,
    8,
    'rainY',
    'Everything smells new after yesterday’s rain. Even the ledger.|Sau trận mưa hôm qua cái gì cũng thơm mới. Kể cả cuốn sổ chi tiêu.',
  ],
  [
    'june',
    0,
    8,
    'rain',
    'Rain on the roof. Best sound in the world, and I will not be taking questions.|Mưa rơi trên mái. Âm thanh hay nhất đời, và mình không trả lời thắc mắc nào hết.',
  ],
  [
    'june',
    1,
    8,
    'fishY',
    'Fish for supper? Ellis will say it was his pond. Let him.|Tối nay có cá à? Ông Ellis sẽ bảo đó là ao của ông. Cứ để ông nói.',
  ],
  [
    'june',
    3,
    8,
    'soldY',
    'You sold well yesterday. I wrote it down in pencil, so we can be modest about it.|Hôm qua bạn bán được nhiều. Mình ghi bằng bút chì, để còn khiêm tốn được.',
  ],
  [
    'june',
    0,
    8,
    'fest',
    'It is supper day. I promised Nell a dish and Pip a bath, in that order of difficulty.|Hôm nay là ngày tiệc. Mình hứa với Nell một món ăn và hứa với Pip một lần tắm, theo thứ tự khó dần.',
  ],
  [
    'june',
    2,
    5,
    null,
    'I caught myself humming this morning. I do not know when I started again.|Sáng nay mình bắt gặp mình đang ngâm nga. Không biết bắt đầu lại từ lúc nào.',
  ],
  [
    'june',
    4,
    8,
    null,
    'Ada has not mentioned the letter. I will wait. Ada talks when the tea is ready.|Bà Ada chưa nhắc đến lá thư. Mình sẽ chờ. Bà chỉ nói khi trà đã pha xong.',
  ],
  [
    'june',
    5,
    8,
    'close',
    'I would have followed you to any village. I am glad it was this one.|Mình sẽ theo bạn đến bất cứ ngôi làng nào. Nhưng mình mừng vì đó là ngôi làng này.',
  ],
  [
    'june',
    6,
    8,
    null,
    'I am learning the pie. Ada watches and says nothing, which is the highest praise she has.|Mình đang học làm bánh. Bà Ada đứng nhìn và không nói gì, đó là lời khen cao nhất của bà.',
  ],
  ['june', 8, 8, null, 'Whatever we decide, I am already home.|Dù mình quyết định thế nào, mình đã ở nhà rồi.'],
  [
    'june',
    0,
    8,
    'winter',
    'Winter is coming. I found three more blankets and a wasp’s nest. Only one was a good find.|Mùa đông sắp đến. Mình tìm thêm ba cái chăn và một tổ ong vò vẽ. Chỉ một thứ là món hời.',
  ],

  [
    'pip',
    0,
    2,
    null,
    'Do worms have knees? I asked Gran and she said to ask the worm.|Giun có đầu gối không ạ? Con hỏi bà thì bà bảo hỏi giun.',
  ],
  [
    'pip',
    0,
    2,
    'harvY',
    'I helped! I carried the carrot. It was heavier than me, a bit.|Con có giúp nè! Con bê củ cà rốt. Nó nặng hơn con một xíu.',
  ],
  [
    'pip',
    0,
    2,
    'rain',
    'It is raining on the carrots! They are getting a drink!|Trời đang mưa lên cà rốt! Chúng đang được uống nước!',
  ],
  [
    'pip',
    0,
    2,
    null,
    'I counted the stairs. Eleven. Twelve if you count the one that creaks.|Con đếm cầu thang rồi. Mười một bậc. Mười hai nếu tính cả bậc kêu cọt kẹt.',
  ],
  [
    'pip',
    3,
    5,
    'soldY',
    'I did the sign again. I spelled CARROTS right this time. Mostly.|Con làm lại tấm biển. Lần này con viết CÀ RỐT đúng chính tả. Gần như vậy.',
  ],
  [
    'pip',
    3,
    5,
    'fishY',
    'Ellis says I can hold the rod next time. Next time I will not scream.|Ông Ellis bảo lần sau con được cầm cần câu. Lần sau con sẽ không hét đâu.',
  ],
  [
    'pip',
    3,
    5,
    null,
    'I have a friend. Faye draws too. We trade pencils and never give them back.|Con có bạn rồi. Faye cũng vẽ. Tụi con đổi bút chì cho nhau và không bao giờ trả.',
  ],
  [
    'pip',
    3,
    5,
    null,
    'Kit showed me a gear. I do not know what it does but I want ten.|Kit cho con xem một bánh răng. Con không biết nó để làm gì nhưng con muốn mười cái.',
  ],
  [
    'pip',
    3,
    5,
    'fest',
    'Can I stay up for the supper? I will be very awake and very quiet.|Con thức dự tiệc được không ạ? Con sẽ rất tỉnh táo và rất yên lặng.',
  ],
  [
    'pip',
    3,
    5,
    null,
    'I made a rule: no shoes at the table. Gran says it is an old rule. I say I invented it first.|Con đặt luật: không đi giày lên bàn ăn. Bà bảo đó là luật cũ. Con bảo con nghĩ ra trước.',
  ],
  [
    'pip',
    3,
    5,
    null,
    'I counted the chickens and then I named them. Number three is Doris.|Con đếm gà rồi đặt tên cho chúng. Con số ba tên là Doris.',
  ],
  [
    'pip',
    6,
    8,
    null,
    'Faye and I are drawing the whole village. I am in charge of the pond and the snails.|Con với Faye đang vẽ cả làng. Con phụ trách cái ao và mấy con ốc.',
  ],
  [
    'pip',
    6,
    8,
    null,
    'I measured myself on the doorframe. A whole thumb taller than in spring.|Con đo mình trên khung cửa. Cao hơn hồi xuân cả một ngón tay cái.',
  ],
  [
    'pip',
    6,
    8,
    null,
    'I think I want to look after the pond when I am bigger. Somebody has to.|Con nghĩ lớn lên con muốn chăm sóc cái ao. Phải có người làm việc đó.',
  ],
  [
    'pip',
    6,
    8,
    'rainY',
    'I wrote it in my notebook like Ellis. “Rain. Pip, three puddles.”|Con ghi vào sổ như ông Ellis. “Mưa. Pip, ba vũng nước.”',
  ],
  [
    'pip',
    6,
    8,
    'harvY',
    'I picked the carrots myself and did not draw them first. I just ate one.|Con tự nhổ cà rốt và không vẽ trước. Con ăn luôn một củ.',
  ],
  [
    'pip',
    8,
    8,
    null,
    'Gran told me about the letter. I am not scared. A little. A normal amount.|Bà kể con nghe về lá thư. Con không sợ. Một chút. Một lượng bình thường.',
  ],
  [
    'pip',
    6,
    8,
    'close',
    'Can we take the evening walk? Just us? You can talk or not talk.|Mình đi dạo buổi tối được không? Chỉ hai ta thôi? Bạn nói hay không nói cũng được.',
  ],
];

/**
 * What June or Pip says today. Deterministic for (state.day, who, seed): the same day gives the same line. A line that reacts to
 * yesterday or to the weather is chosen about two times in three when one fits.
 */
export function familyLine(state, who, seed = 0, raw = false) {
  const ch = Math.max(0, Math.min(8, state.chapter ?? 0));
  const fits = FAMILY_LINES.filter(
    ([w, a, z, when]) => w === who && ch >= a && ch <= z && (!when || WHEN[when](state, who)),
  );
  const reactive = fits.filter(l => l[3]),
    plain = fits.filter(l => !l[3]);
  const h = hash(state.day, who, seed);
  const pool = reactive.length && (plain.length === 0 || h % 3 !== 0) ? reactive : plain.length ? plain : fits;
  const line = pool[Math.floor(h / 3) % pool.length];
  return raw ? line[4] : L(line[4]);
}
export const familyLinesOk = () => FAMILY_LINES.every(l => hasBoth(l[4]));
