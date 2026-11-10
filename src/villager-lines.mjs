// What the villagers say: rotating lines keyed to day parity, season, chapter and hearts, a polite refusal for a gift they dislike, and
// the three heart scenes (2, 5 and 8 hearts) of the eight key villagers (docs/STORY.md). Pure; fetched with import() (story-rules.mjs).
// Every line is 'English|Tiếng Việt'. A condition is {par: 0|1, season: 0-3, ch: [first, last], hearts: n}.
import { RESIDENTS } from './content.mjs';
import { L, hash, seasonOf, hasBoth } from './story-text.mjs';
import { t } from './i18n.mjs';

const W = 0,
  SU = 1,
  AU = 2,
  WI = 3;

/** [condition or null, line]. The resident’s own single line (content.mjs) is always one more candidate. */
export const LINES = {
  ada: [
    [
      { par: 0 },
      'Seeds like company. Plant the carrots next to something that smells strong.|Hạt giống thích có bạn. Trồng cà rốt cạnh thứ gì có mùi nồng nhé.',
    ],
    [
      { par: 1 },
      'I kept a pinch of every seed I ever loved. The tin is the family’s memory.|Bà giữ một nhúm mỗi loại hạt bà từng thương. Cái hộp là trí nhớ của cả nhà.',
    ],
    [
      { season: W },
      'Spring cannot be hurried, but it can be met ready. Put the kettle on.|Mùa xuân không thể giục, nhưng có thể đón sẵn sàng. Bắc ấm nước lên nào.',
    ],
    [
      { season: WI },
      'Winter is for stories and soup. Sit down, and I will do one of each.|Mùa đông để dành cho chuyện kể và món súp. Ngồi xuống đi, bà làm cả hai.',
    ],
    [
      { ch: [4, 8] },
      'That beam over the kitchen holds up more than a roof, you know.|Cái xà trên bếp đỡ nhiều hơn một mái nhà đấy, con biết không.',
    ],
    [
      { hearts: 5 },
      'You have your grandfather’s patience and my stubbornness. Poor you.|Con có tính kiên nhẫn của ông và tính bướng của bà. Tội con ghê.',
    ],
    [
      { hearts: 8 },
      'Some evenings I forget I was ever worried. That is your doing.|Có những buổi tối bà quên mất mình từng lo lắng. Đó là nhờ con.',
    ],
  ],
  ellis: [
    [{ par: 0 }, 'Fish bite when you stop wanting them to.|Cá chỉ cắn khi bạn thôi mong chúng cắn.'],
    [
      { par: 1 },
      'Notebook rule: write the weather first. Without it, the fish are only a rumour.|Quy tắc sổ tay: ghi thời tiết trước. Thiếu nó, cá chỉ là lời đồn.',
    ],
    [
      { season: SU },
      'Summer. The pond is warm and the perch are lazy. So am I.|Mùa hè. Ao ấm và cá rô lười. Ông cũng vậy.',
    ],
    [
      { season: AU },
      'Autumn fish are the thoughtful kind. They take their time, and so should you.|Cá mùa thu là loại hay suy nghĩ. Chúng thong thả, bạn cũng nên vậy.',
    ],
    [
      { ch: [2, 8] },
      'Your notebook pages are filling nicely. Mine took forty years; yours will take fewer.|Trang sổ của bạn đầy lên đẹp đấy. Của ông mất bốn mươi năm, của bạn sẽ ít hơn.',
    ],
    [
      { hearts: 5 },
      'Sit in the boat. It does not have to go anywhere.|Ngồi vào thuyền đi. Nó không nhất thiết phải đi đâu cả.',
    ],
    [
      { hearts: 8 },
      'Ada will not say it, so I will: the cottage is better with all of you in it.|Bà Ada sẽ không nói, nên ông nói: căn nhà tốt hơn nhiều khi có đủ các con.',
    ],
  ],
  bea: [
    [
      { par: 0 },
      'Post is slow here. People like it that way; it gives them something to wait for.|Thư ở đây chậm. Người ta thích vậy, vì có thứ để mong chờ.',
    ],
    [
      { par: 1 },
      'I know who writes to whom. I will take it to my grave, possibly sooner, with all this cake.|Tôi biết ai viết thư cho ai. Tôi sẽ giữ kín, có khi sớm hơn dự kiến vì ăn quá nhiều bánh.',
    ],
    [
      { season: W },
      'Spring brings seed catalogues, love letters and bills. Mostly in that order.|Mùa xuân mang đến danh mục hạt giống, thư tình và hóa đơn. Thường theo thứ tự đó.',
    ],
    [
      { ch: [4, 8] },
      'A letter from the county for Ada came through. I sorted it and said nothing, which is hard for me.|Có thư của huyện gửi bà Ada. Tôi phân loại và không nói gì, điều đó khó với tôi lắm.',
    ],
    [
      { hearts: 5 },
      'You are the first in years who stays to chat. Pull up the stool.|Bạn là người đầu tiên sau nhiều năm ở lại trò chuyện. Kéo ghế đẩu lại đây.',
    ],
    [
      { hearts: 8 },
      'I kept the first postcard your family sent. It is on my wall.|Tôi giữ tấm bưu thiếp đầu tiên của gia đình bạn. Nó ở trên tường nhà tôi.',
    ],
  ],
  theo: [
    [
      { par: 0 },
      'A jeep wants three things: oil, patience, and no opinions about the left tyre.|Một chiếc jeep cần ba thứ: dầu, kiên nhẫn, và đừng có ý kiến về bánh trước bên trái.',
    ],
    [
      { par: 1 },
      'I can fix most things. Not Hugo’s jokes. Those are structural.|Tôi sửa được hầu hết mọi thứ. Trừ chuyện đùa của Hugo. Chúng hỏng từ cấu trúc rồi.',
    ],
    [
      { season: WI },
      'Cold mornings, the engine sulks. Talk to it nicely.|Sáng lạnh thì máy giận dỗi. Nói chuyện nhẹ nhàng với nó nhé.',
    ],
    [
      { season: SU },
      'Summer dust gets everywhere. I found some in a sandwich.|Bụi mùa hè chui vào mọi nơi. Tôi còn tìm thấy nó trong bánh mì kẹp.',
    ],
    [
      { ch: [5, 8] },
      'The road is open all year. Go and see the supermarket; it has an aisle for everything.|Đường mở quanh năm. Đi xem siêu thị đi, nó có một dãy hàng cho mọi thứ.',
    ],
    [
      { hearts: 5 },
      'I kept one cog from your first fix. I call it Lucky.|Tôi giữ một chiếc bánh răng từ lần sửa đầu của bạn. Tôi gọi nó là May Mắn.',
    ],
    [
      { hearts: 8 },
      'Any time you need a lift, the jeep is yours. Bring Pip; she asks good questions.|Lúc nào cần đi nhờ, xe jeep là của bạn. Đưa Pip theo, bé hỏi hay lắm.',
    ],
  ],
  mara: [
    [{ par: 0 }, 'Chickens have opinions. Cows have philosophy.|Gà có chính kiến. Bò có triết lý.'],
    [
      { par: 1 },
      'The hens laid early today. I think they heard you coming.|Hôm nay gà đẻ sớm. Tôi nghĩ chúng nghe thấy bạn đến.',
    ],
    [
      { season: W },
      'Spring: everything has a baby, and every baby thinks it is in charge.|Mùa xuân: con nào cũng có con non, và con non nào cũng tưởng mình là chủ.',
    ],
    [{ season: WI }, 'Winter feeding is a hug in a bucket.|Cho ăn mùa đông là một cái ôm đựng trong xô.'],
    [
      { ch: [4, 8] },
      'You look after your animals; you can tell by the way they do not run.|Bạn chăm thú tốt; nhìn là biết vì chúng không bỏ chạy.',
    ],
    [
      { hearts: 5 },
      'Come and meet the calf. Be quiet. She is judging.|Lại gặp chú bê nào. Nhớ yên lặng nhé. Cô bé đang đánh giá bạn.',
    ],
    [
      { hearts: 8 },
      'I would trust you with the whole barn. I do not say that to just anyone.|Tôi tin bạn giữ cả chuồng trại. Tôi không nói câu đó với bất kỳ ai.',
    ],
  ],
  hugo: [
    [
      { par: 0 },
      'Bread rises when it is ready. Not when you are.|Bánh mì nở khi nó sẵn sàng. Không phải khi bạn sẵn sàng.',
    ],
    [
      { par: 1 },
      'The first loaf is for the people who needed it. The second is for me.|Ổ bánh đầu tiên cho người đang cần. Ổ thứ hai là của tôi.',
    ],
    [
      { season: AU },
      'Autumn: apples, cinnamon and many people being very polite near my window.|Mùa thu: táo, quế và rất nhiều người đứng lịch sự cạnh cửa sổ tiệm tôi.',
    ],
    [
      { ch: [6, 8] },
      'Ada’s pie is the one I try to bake and cannot. Please do not tell her.|Bánh của bà Ada là món tôi cố làm mà không được. Xin đừng nói với bà.',
    ],
    [
      { hearts: 5 },
      'Let me teach you the crust. Butter each fold, and no rushing.|Để tôi dạy bạn làm vỏ bánh. Thêm bơ mỗi lần gấp, và đừng vội.',
    ],
    [
      { hearts: 8 },
      'My ovens are open to you. Consider it a standing order.|Lò nướng của tôi luôn mở cho bạn. Coi như một đơn hàng thường trực.',
    ],
  ],
  nell: [
    [
      { par: 0 },
      'A festival is just a Tuesday with better lighting.|Lễ hội chỉ là một ngày thứ Ba có ánh sáng đẹp hơn.',
    ],
    [
      { par: 1 },
      'I keep a list of everyone not yet asked to the supper. It is shorter every time.|Tôi giữ danh sách những người chưa được mời dự tiệc. Lần nào nó cũng ngắn hơn.',
    ],
    [
      { season: W },
      'Spring supper: flowers on every table, and nobody remembers who brought what.|Tiệc xuân: hoa trên mọi bàn, và không ai nhớ ai mang món gì.',
    ],
    [
      { season: WI },
      'Winter lanterns, hot cider, Hugo’s soup. I have planned nothing else for months.|Đèn lồng mùa đông, rượu táo nóng, súp của Hugo. Mấy tháng nay tôi chẳng lo gì khác.',
    ],
    [
      { ch: [5, 8] },
      'We have never had a supper this full. I am told it is your fault.|Chưa bao giờ có bữa tiệc đông thế này. Nghe nói là lỗi của bạn.',
    ],
    [
      { hearts: 5 },
      'Come early and hang the paper stars. You hold the ladder; I hold the opinions.|Đến sớm treo sao giấy nhé. Bạn giữ thang, tôi giữ ý kiến.',
    ],
    [
      { hearts: 8 },
      'I would put your name on the list in ink, but the ink is for every other name too.|Tôi muốn ghi tên bạn bằng mực, nhưng mực còn để ghi tên mọi người khác nữa.',
    ],
  ],
  sylvie: [
    [
      { par: 0 },
      'A tree’s best year is the one after you stop worrying about it.|Năm tốt nhất của một cái cây là năm sau khi bạn thôi lo cho nó.',
    ],
    [
      { par: 1 },
      'I talk to the young apples. They take it better than the old ones.|Tôi nói chuyện với những quả táo non. Chúng nghe tốt hơn táo già.',
    ],
    [
      { season: W },
      'Blossom does not last. That is why we walk under it.|Hoa không nở mãi. Vì vậy chúng ta mới đi dưới tán hoa.',
    ],
    [
      { season: AU },
      'Autumn: the whole orchard smells of what it has been saving up.|Mùa thu: cả vườn thơm mùi những gì nó đã để dành.',
    ],
    [
      { ch: [7, 8] },
      'Your trees will fruit before Pip is much taller. Keep them watered.|Cây của bạn sẽ ra quả trước khi Pip cao thêm nhiều. Nhớ tưới nước nhé.',
    ],
    [
      { hearts: 5 },
      'Take a cutting from my best peach. It will remember you.|Lấy một cành giâm từ cây đào tốt nhất của tôi. Nó sẽ nhớ bạn.',
    ],
    [
      { hearts: 8 },
      'Someone will sit in your trees’ shade and never know your name. Isn’t that the point?|Sẽ có người ngồi dưới bóng cây của bạn mà không biết tên bạn. Đó chẳng phải là điều đáng quý sao?',
    ],
  ],
  // The other residents keep their own line (content.mjs) and gain two more.
  kit: [
    [
      { par: 0 },
      'I am building a machine that makes tea. So far it makes noise.|Tớ đang chế một cái máy pha trà. Đến giờ nó chỉ pha ra tiếng ồn.',
    ],
    [
      { ch: [3, 8] },
      'Pip asked what a gear is for. I said “turning”. She asked what it turns about. I am still thinking.|Pip hỏi bánh răng dùng để làm gì. Tớ bảo “để quay”. Bé hỏi quay về chuyện gì. Tớ vẫn đang nghĩ.',
    ],
  ],
  oren: [
    [{ par: 1 }, 'Dirt tells you everything if you stay quiet.|Đất nói cho bạn mọi điều nếu bạn giữ yên lặng.'],
    [
      { season: WI },
      'Frost is the field’s quiet month. I mend fences and think about tomatoes.|Sương giá là tháng yên tĩnh của cánh đồng. Tôi sửa hàng rào và nghĩ về cà chua.',
    ],
  ],
  wren: [
    [{ par: 1 }, 'I planted a button. Nothing yet.|Em trồng một cái cúc áo. Chưa thấy gì.'],
    [{ par: 0 }, 'Worms are my friends. Don’t tell the sparrows.|Giun là bạn của em. Đừng nói với chim sẻ nhé.'],
  ],
  finn: [
    [{ par: 0 }, 'The best bait is not minding.|Mồi tốt nhất là không bận tâm.'],
    [
      { ch: [2, 8] },
      'Ellis says you have a good wrist. Do not tell him I agree.|Ông Ellis bảo bạn có cổ tay tốt. Đừng nói với ông là tôi cũng đồng ý.',
    ],
  ],
  pearl: [
    [
      { par: 0 },
      'Quiet village. Mostly my job is lost mittens.|Làng yên tĩnh. Việc của tôi phần lớn là tìm găng tay bị mất.',
    ],
    [
      { season: SU },
      'Summer: boats in the water, children on the bank. I count them twice.|Mùa hè: thuyền trên nước, trẻ con trên bờ. Tôi đếm chúng hai lần.',
    ],
  ],
  iris: [
    [{ par: 0 }, 'A hem is patience in a straight line.|Đường gấu áo là sự kiên nhẫn đi theo một đường thẳng.'],
    [
      { par: 1 },
      'If something fits too well, I take it in a little. Comfort first.|Nếu cái gì vừa quá, tôi sửa rộng ra một chút. Thoải mái trước đã.',
    ],
  ],
  leo: [
    [
      { par: 1 },
      'I am weaving a pond. It keeps coming out as a Tuesday.|Tôi đang dệt một cái ao. Nó cứ ra thành một ngày thứ Ba.',
    ],
    [{ season: WI }, 'Wool in winter is practically a conversation.|Len mùa đông gần như là một cuộc trò chuyện.'],
  ],
  faye: [
    [
      { par: 0 },
      'I drew Pip. She asked to be taller. Then she asked for a hat.|Tớ vẽ Pip. Bạn ấy xin được cao hơn. Rồi xin thêm một cái mũ.',
    ],
    [
      { ch: [3, 8] },
      'Pip and I trade pencils and never give them back. It is going very well.|Tớ với Pip đổi bút chì và không bao giờ trả lại. Mọi chuyện rất suôn sẻ.',
    ],
  ],
  ash: [
    [{ par: 0 }, 'Measure twice, cut once, apologise never.|Đo hai lần, cắt một lần, không bao giờ xin lỗi.'],
    [
      { ch: [4, 8] },
      'That beam in Ada’s kitchen. She would say no. I would look anyway.|Cái xà trong bếp nhà bà Ada. Bà sẽ bảo không cần. Tôi vẫn sẽ xem thử.',
    ],
  ],
  fern: [
    [{ par: 0 }, 'A chair’s whole job is to make people stay.|Việc duy nhất của cái ghế là khiến người ta ở lại.'],
    [
      { par: 1 },
      'I like furniture that has had a hard life and still stands.|Tôi thích đồ nội thất từng trải qua đời khó khăn mà vẫn đứng vững.',
    ],
  ],
  cora: [
    [
      { par: 0 },
      'Today’s lesson: nobody knows everything, and some of us know where the biscuits are.|Bài học hôm nay: không ai biết hết mọi thứ, và vài người biết chỗ để bánh quy.',
    ],
    [
      { ch: [5, 8] },
      'The children can name every road in the valley now. Some of them even use the names.|Bọn trẻ giờ gọi được tên mọi con đường trong thung lũng. Vài đứa còn dùng đến.',
    ],
  ],
  milo: [
    [{ par: 0 }, 'I came second yesterday. It was a very close second.|Hôm qua tớ về nhì. Nhì rất sát nút.'],
    [
      { par: 1 },
      'I am training for the race. By training I mean snacks.|Tớ đang luyện cho cuộc đua. Luyện nghĩa là ăn vặt.',
    ],
  ],
  hazel: [
    [
      { par: 0 },
      'Drink some water. The cheapest medicine and the least trusted.|Uống chút nước đi. Thuốc rẻ nhất và ít được tin nhất.',
    ],
    [{ season: WI }, 'Cough season. Keep Pip’s scarf on, and yours.|Mùa ho. Giữ khăn cho Pip, và cả khăn của bạn nữa.'],
  ],
};

/** What a key villager says when handed something they do not like (the gift is kept). */
export const REFUSALS = {
  ada: 'Oh, dear. No, thank you. Not for my kitchen.|Ôi trời. Không, cảm ơn con. Không hợp với bếp của bà.',
  ellis: 'Not for me, thank you. The pond would not forgive me.|Ông xin thôi. Cái ao sẽ không tha thứ cho ông.',
  bea: 'That is kind, but no. I will only have to return it to you in the post.|Cảm ơn bạn, nhưng thôi. Rồi tôi lại phải gửi trả bạn qua đường bưu điện.',
  theo: 'Ha. Keep it. It would only end up in the engine.|Ha. Bạn giữ đi. Rồi nó cũng chui vào động cơ thôi.',
  mara: 'The animals would not forgive me. Keep it, friend.|Đám thú sẽ không tha cho tôi đâu. Bạn cứ giữ lại nhé.',
  hugo: 'Not in my kitchen, friend. I will pretend I did not see it.|Không vào bếp của tôi được đâu bạn ơi. Tôi coi như chưa thấy.',
  nell: 'Lovely thought, but no. It does not go with the lanterns.|Ý đẹp lắm, nhưng thôi. Nó không hợp với những chiếc đèn lồng.',
  sylvie: 'Thank you, but the orchard would sulk. Keep it.|Cảm ơn bạn, nhưng vườn cây sẽ giận. Bạn giữ lại nhé.',
};
export const REFUSAL_DEFAULT = 'They politely hand it back. Not their taste.|Họ lịch sự trả lại. Không hợp khẩu vị.';

/** The heart scenes: HEART_SCENES[id][level] = [[who, line], …]. Their perks are in story-rules.mjs PERKS. */
export const HEART_SCENES = {
  ada: {
    2: [
      [
        'ada',
        'Come in out of the cold. Sit where Ellis sits; he will not mind, he is asleep.|Vào đây cho khỏi lạnh. Ngồi chỗ ông Ellis đi, ông không phiền đâu, ông đang ngủ.',
      ],
      ['you', 'I only came to say thank you for the tin.|Cháu chỉ đến để cảm ơn bà về cái hộp.'],
      [
        'ada',
        'Then you have said it. Here, a pie from this morning. And two eggs, in case the pie is not enough.|Vậy là con nói rồi. Đây, một chiếc bánh sáng nay. Và hai quả trứng, phòng khi bánh chưa đủ.',
      ],
      [
        'narrator',
        'She tucks a warm pie and two eggs into your arms and will not hear another word.|Bà dúi một chiếc bánh còn ấm và hai quả trứng vào tay bạn, và không nghe thêm lời nào.',
      ],
    ],
    5: [
      [
        'ada',
        'I want to show you something. Do not tell June; she would cry.|Bà muốn cho con xem một thứ. Đừng nói với June, nó sẽ khóc.',
      ],
      [
        'narrator',
        'She opens the tin to its false bottom: seeds, dated in pencil, going back sixty years.|Bà mở hộp đến đáy giả: những hạt giống ghi ngày bằng bút chì, ngược về sáu mươi năm trước.',
      ],
      [
        'ada',
        'These are the ones that never grew. I keep them anyway. Hope likes to be kept.|Đây là những hạt chưa bao giờ nảy mầm. Bà vẫn giữ. Hy vọng thích được giữ lại.',
      ],
      [
        'ada',
        'And you must rest properly, mind. A rested farmer grows more. Take one more rest each day.|Và con phải nghỉ cho đàng hoàng đấy. Người làm vườn khỏe thì trồng được nhiều hơn. Mỗi ngày nghỉ thêm một lần.',
      ],
    ],
    8: [
      ['ada', 'The county letter. You may as well read it now.|Lá thư của huyện. Con đọc luôn đi.'],
      ['you', 'It says the roof will not see another winter.|Thư nói mái nhà không qua nổi mùa đông nữa.'],
      [
        'ada',
        'And I decided the roof had better be quick, because I would be gone. I am not so sure of that now.|Và bà nghĩ mái nhà nên nhanh lên, vì bà sắp đi. Giờ bà không còn chắc thế nữa.',
      ],
      [
        'narrator',
        'She hands you a small purse. Every coin of it was saved for the roof.|Bà đưa bạn một chiếc ví nhỏ. Từng đồng trong đó được dành dụm cho mái nhà.',
      ],
      [
        'ada',
        'Spend it where it is needed. That is all anyone ever asks of money.|Con tiêu nó đúng chỗ cần. Đó là tất cả những gì người ta mong ở đồng tiền.',
      ],
    ],
  },
  ellis: {
    2: [
      [
        'ellis',
        'You will want the right bait. Worms for perch, patience for everything else.|Bạn cần mồi đúng loại. Giun cho cá rô, còn lại cần kiên nhẫn.',
      ],
      ['you', 'And where do I get patience?|Còn kiên nhẫn thì lấy ở đâu?'],
      ['ellis', 'You stay. That is the whole trick.|Bạn cứ ở lại. Mẹo chỉ có vậy.'],
      [
        'narrator',
        'He hands you two perch caught at dawn, still cool from the water.|Ông đưa bạn hai con cá rô bắt lúc bình minh, còn mát lạnh nước ao.',
      ],
    ],
    5: [
      [
        'ellis',
        'Forty years I fished this pond and sold none of it. Seemed rude to the fish.|Bốn mươi năm ông câu ao này mà không bán con nào. Có vẻ bất lịch sự với cá.',
      ],
      [
        'ellis',
        'Take my price list. Good fish go for more at market than people think.|Cầm bảng giá của ông đi. Cá ngon bán ở chợ được giá hơn người ta tưởng.',
      ],
      ['you', 'Won’t you need it?|Ông không cần nữa ạ?'],
      [
        'ellis',
        'I have a notebook. That is all the business sense I will ever need. Everything you sell fetches a little more.|Ông có cuốn sổ. Ông chỉ cần chừng đó đầu óc buôn bán. Mọi thứ bạn bán sẽ được giá hơn một chút.',
      ],
    ],
    8: [
      [
        'ellis',
        'There is a golden one in the deep end. I have seen it eleven times and never hooked it.|Có một con cá vàng ở đoạn sâu. Ông thấy nó mười một lần mà chưa lần nào câu được.',
      ],
      ['you', 'Then how do you have one in that bucket?|Vậy sao trong xô của ông lại có một con?'],
      [
        'ellis',
        'I did not catch it. It came to the boat and sat. I think it wanted company.|Ông không câu. Nó tự bơi đến thuyền rồi ở lại. Chắc nó muốn có bạn.',
      ],
      [
        'narrator',
        'He lowers a golden carp and a koi into your bucket. “Not for selling,” he says. “For showing.”|Ông thả một con cá chép vàng và một con koi vào xô của bạn. “Không để bán,” ông nói. “Để khoe.”',
      ],
      [
        'ellis',
        'Take the boat out at dawn. Bring Pip. Bring Ada, if she will come.|Dậy sớm chèo thuyền ra ao nhé. Dẫn Pip theo. Dẫn cả bà Ada, nếu bà chịu đi.',
      ],
    ],
  },
  bea: {
    2: [
      [
        'bea',
        'Post for you! Well, not post. I wanted to see you smile. Is that allowed?|Có thư cho bạn! À, không hẳn là thư. Tôi muốn thấy bạn cười. Như vậy có được không?',
      ],
      ['you', 'It is.|Được chứ.'],
      [
        'bea',
        'Good. Sixty coins from the village fund for new neighbours. It is printed on the form.|Tốt. Sáu mươi xu từ quỹ làng cho hàng xóm mới. Có in trên mẫu đơn đấy.',
      ],
      [
        'narrator',
        'The form is a napkin, but the coins are real.|Mẫu đơn là một chiếc khăn ăn, nhưng số xu thì có thật.',
      ],
    ],
    5: [
      [
        'bea',
        'Every card I send for the village is a small act of faith. You are the first to send one back.|Mỗi tấm thiệp tôi gửi cho làng là một niềm tin nhỏ. Bạn là người đầu tiên gửi lại.',
      ],
      ['you', 'It was only a flower.|Chỉ là một bông hoa thôi mà.'],
      [
        'bea',
        'A small gift, given with attention, is worth two given without.|Món quà nhỏ tặng bằng sự chú tâm đáng giá bằng hai món tặng qua loa.',
      ],
      [
        'bea',
        'So I will teach you to wrap things. From now on, every gift they like counts for a little more.|Nên tôi sẽ dạy bạn gói quà. Từ nay mỗi món quà họ thích sẽ có giá trị hơn một chút.',
      ],
    ],
    8: [
      [
        'bea',
        'The county letter for Ada went through my hands. I sorted it, said nothing, and felt dreadful.|Lá thư của huyện gửi bà Ada đi qua tay tôi. Tôi phân loại, không nói gì, và thấy rất tệ.',
      ],
      ['you', 'You did right.|Bạn làm đúng rồi.'],
      [
        'bea',
        'I did a middling thing. So I asked the square for help.|Tôi làm một việc ở mức tạm. Nên tôi đã nhờ cả quảng trường giúp.',
      ],
      [
        'narrator',
        'Two hundred coins in an envelope, with a hundred small signatures down the side.|Hai trăm xu trong một phong bì, với cả trăm chữ ký nhỏ dọc mép giấy.',
      ],
    ],
  },
  theo: {
    2: [
      [
        'theo',
        'Hold this. No, the other end. It is a cog. Two cogs; I always make a spare.|Cầm cái này. Không, đầu kia. Là một bánh răng. Hai cái; tôi lúc nào cũng làm dư một.',
      ],
      ['you', 'What are they for?|Chúng dùng để làm gì?'],
      [
        'theo',
        'Luck, mostly. Everyone needs a lucky cog.|Chủ yếu để lấy may. Ai cũng cần một chiếc bánh răng may mắn.',
      ],
      [
        'narrator',
        'He drops two brass cogs in your palm, warm from his pocket.|Anh thả hai chiếc bánh răng đồng vào lòng bàn tay bạn, còn ấm hơi túi áo anh.',
      ],
    ],
    5: [
      [
        'theo',
        'I put your seed money to work. Bulk orders. The market owes me a favour.|Tôi cho tiền mua hạt giống của bạn đi làm việc. Mua số lượng lớn. Chợ nợ tôi một ân tình.',
      ],
      ['you', 'You did what?|Anh làm gì cơ?'],
      [
        'theo',
        'Seeds are a little cheaper for you from now on. Do not tell Bea; she will want a discount on stamps.|Từ nay hạt giống rẻ hơn một chút cho bạn. Đừng nói với Bea, cô ấy sẽ đòi giảm giá tem.',
      ],
      [
        'narrator',
        'He wipes his hands, pleased with himself and trying not to show it.|Anh lau tay, hài lòng với bản thân và cố không để lộ ra.',
      ],
    ],
    8: [
      [
        'theo',
        'The jeep was my father’s. And his father’s. It has never belonged to one person.|Chiếc jeep là của cha tôi. Và của ông tôi. Nó chưa bao giờ thuộc về một người.',
      ],
      ['you', 'Then why give me the key?|Vậy sao lại đưa chìa khóa cho tôi?'],
      [
        'theo',
        'Because you bring it back cleaner than you took it. That is the whole test.|Vì bạn trả nó về sạch hơn lúc mượn. Bài kiểm tra chỉ có vậy.',
      ],
      [
        'narrator',
        'He also presses a tin marked Spare Parts into your hands. The parts are coins.|Anh còn dúi vào tay bạn một chiếc hộp ghi Phụ tùng. Phụ tùng ở đây là tiền xu.',
      ],
      ['theo', 'Kick the left front. Gently.|Đá bánh trước bên trái. Nhẹ thôi.'],
    ],
  },
  mara: {
    2: [
      ['mara', 'Hush. She is laying.|Suỵt. Nó đang đẻ trứng.'],
      [
        'narrator',
        'A hen shifts on her straw. Under her are three warm eggs.|Con gà mái nhích trên ổ rơm. Bên dưới là ba quả trứng còn ấm.',
      ],
      [
        'mara',
        'Take them, and this milk. The hen says you have earned it.|Bạn cầm lấy, cả bình sữa này nữa. Gà mái bảo bạn xứng đáng.',
      ],
    ],
    5: [
      ['mara', 'Come round the back. Gently now; she is small.|Vòng ra phía sau. Nhẹ nhàng nhé; bé còn nhỏ.'],
      ['you', 'She is tiny.|Bé xíu à.'],
      [
        'mara',
        'Three days old and already unimpressed. The pigs found a truffle for you, and here is extra milk.|Mới ba ngày tuổi mà đã tỏ vẻ chẳng ấn tượng. Lũ lợn tìm được một củ nấm cục cho bạn, và thêm sữa đây.',
      ],
      [
        'narrator',
        'The calf blinks at you, slowly, and decides you will do.|Chú bê chớp mắt nhìn bạn, chậm rãi, và quyết định bạn được.',
      ],
    ],
    8: [
      ['mara', 'I have never lent the barn to anyone.|Tôi chưa bao giờ cho ai mượn chuồng trại.'],
      [
        'you',
        'You are not lending it. You are only letting me stand in it.|Bạn đâu cho mượn. Bạn chỉ cho tôi đứng trong đó thôi.',
      ],
      [
        'mara',
        'Same thing. Your goods will fetch a little more with my name on the crate.|Cũng như nhau. Hàng của bạn sẽ được giá hơn khi có tên tôi trên thùng.',
      ],
      [
        'narrator',
        'On every crate, in Mara’s neat painted hand: Moss barn, approved.|Trên mỗi thùng, nét sơn gọn gàng của Mara: Chuồng Rêu, đã kiểm duyệt.',
      ],
    ],
  },
  hugo: {
    2: [
      ['hugo', 'Flour on your sleeve. Welcome to the family.|Bột dính trên tay áo bạn. Chào mừng vào gia đình.'],
      ['you', 'I did not come to bake.|Tôi không đến để làm bánh.'],
      [
        'hugo',
        'Nobody does. Take this: the first pie of the morning. I got carried away.|Chẳng ai đến để làm bánh. Cầm lấy: chiếc bánh đầu tiên buổi sáng. Tôi hơi quá đà.',
      ],
      ['narrator', 'A warm pie, wrapped in a tea towel.|Một chiếc bánh còn ấm, bọc trong khăn lau.'],
    ],
    5: [
      ['hugo', 'Crust: butter, cold. Fold, rest, fold. Do not hurry.|Vỏ bánh: bơ lạnh. Gấp, nghỉ, gấp. Đừng vội.'],
      ['you', 'Ada says the same.|Bà Ada cũng nói y như vậy.'],
      [
        'hugo',
        'Ada says it first. I just say it with flour on my face.|Bà Ada nói trước. Tôi chỉ nói khi mặt dính đầy bột.',
      ],
      [
        'hugo',
        'I will have a word with the grain man. Seeds ought to cost less for people who feed my ovens.|Tôi sẽ nói chuyện với người bán ngũ cốc. Hạt giống nên rẻ hơn cho người nuôi lò của tôi.',
      ],
    ],
    8: [
      [
        'hugo',
        'Ada’s pie is the one I cannot bake. And the one I will never stop trying.|Bánh của bà Ada là cái tôi không làm được. Và cái tôi sẽ không bao giờ ngừng thử.',
      ],
      ['you', 'She would love to hear that.|Bà sẽ thích nghe điều đó lắm.'],
      [
        'hugo',
        'Take these three pies. Give one to Ada and watch her face. Say nothing about the crust.|Mang ba chiếc bánh này về. Đưa một chiếc cho bà Ada và xem mặt bà. Đừng nói gì về vỏ bánh.',
      ],
      [
        'narrator',
        'Three pies, tied with string. One of them is already labelled “for Ada”.|Ba chiếc bánh buộc dây. Một chiếc đã dán nhãn “cho bà Ada”.',
      ],
    ],
  },
  nell: {
    2: [
      [
        'nell',
        'I am making a list of who sits where. You are by the window, near the cake.|Tôi đang lập danh sách ai ngồi đâu. Bạn ngồi cạnh cửa sổ, gần chỗ để bánh.',
      ],
      ['you', 'That is a very good seat.|Chỗ đó tuyệt quá.'],
      [
        'nell',
        'Of course it is. Here are eighty coins from the supper purse. I will find the money for the rest.|Tất nhiên rồi. Đây là tám mươi xu từ quỹ tiệc. Phần còn lại tôi sẽ lo.',
      ],
      [
        'narrator',
        'She presses the coins into your hand before you can protest.|Cô dúi số xu vào tay bạn trước khi bạn kịp từ chối.',
      ],
    ],
    5: [
      [
        'nell',
        'A festival is not the lanterns. It is who holds them.|Lễ hội không phải là đèn lồng. Mà là người cầm chúng.',
      ],
      ['you', 'Who is holding yours?|Ai đang cầm đèn của cô?'],
      [
        'nell',
        'Today, you. Now listen: a flower for someone’s friend counts more than gold for a stranger.|Hôm nay là bạn. Giờ nghe này: một bông hoa tặng bạn của ai đó quý hơn vàng tặng người lạ.',
      ],
      [
        'nell',
        'So give with care, and the village notices. Every gift they like counts for a little more.|Nên cứ tặng quà thật chu đáo, và cả làng sẽ nhận ra. Mỗi món quà họ thích sẽ có giá trị hơn một chút.',
      ],
    ],
    8: [
      [
        'nell',
        'Come to the hall early. There is something I want you to see.|Hãy đến sảnh sớm. Tôi có thứ muốn cho bạn xem.',
      ],
      [
        'narrator',
        'On the wall is the supper list, every name in village ink. Yours is in the middle, not the end.|Trên tường là danh sách tiệc, mọi cái tên viết bằng mực của làng. Tên bạn nằm ở giữa, không phải cuối.',
      ],
      ['you', 'I did not think I belonged on it.|Tôi không nghĩ mình có tên trong đó.'],
      [
        'nell',
        'The supper purse is yours this season. Two hundred coins, for the roof and the lanterns.|Quỹ tiệc mùa này thuộc về bạn. Hai trăm xu, cho mái nhà và đèn lồng.',
      ],
    ],
  },
  sylvie: {
    2: [
      [
        'sylvie',
        'Hold out your hands. Apples love to be carried by someone careful.|Đưa hai tay ra nào. Táo thích được người cẩn thận mang đi.',
      ],
      ['you', 'They are heavy for their size.|Chúng nặng hơn vẻ ngoài.'],
      [
        'sylvie',
        'Three. One for you, one for Pip, one for whoever you forget.|Ba quả. Một cho bạn, một cho Pip, một cho người bạn quên mất.',
      ],
      [
        'narrator',
        'The apples smell of sun and tree bark and a little of rain.|Những quả táo thơm mùi nắng, vỏ cây và một chút mưa.',
      ],
    ],
    5: [
      [
        'sylvie',
        'Take a cutting from my best peach. It will remember you.|Lấy một cành giâm từ cây đào tốt nhất của tôi. Nó sẽ nhớ bạn.',
      ],
      ['you', 'How long will it take to fruit?|Bao lâu thì nó ra quả?'],
      ['sylvie', 'Longer than you want and shorter than you fear.|Lâu hơn bạn muốn và ngắn hơn bạn sợ.'],
      [
        'sylvie',
        'And the seed man owes me a favour. Seeds will cost a little less for you.|Và người bán hạt giống nợ tôi một ân tình. Hạt giống sẽ rẻ hơn một chút cho bạn.',
      ],
    ],
    8: [
      [
        'sylvie',
        'Years from now someone will sit in your trees’ shade and never know your name.|Nhiều năm nữa, sẽ có người ngồi dưới bóng cây của bạn mà không biết tên bạn.',
      ],
      ['you', 'Is that sad?|Điều đó buồn không?'],
      [
        'sylvie',
        'Isn’t it the point? Here: three peaches and a mango from the south wall.|Đó chẳng phải là điều đáng quý sao? Đây: ba quả đào và một quả xoài từ bức tường phía nam.',
      ],
      ['narrator', 'She packs them in a basket lined with leaves.|Cô xếp chúng vào một chiếc giỏ lót lá.'],
      ['sylvie', 'Plant the stones. Slowly.|Trồng hạt đi. Thong thả thôi.'],
    ],
  },
};

const fits = (c, s, hearts) =>
  !c ||
  ((c.par === undefined || s.day % 2 === c.par) &&
    (c.season === undefined || seasonOf(s.day) === c.season) &&
    (!c.ch || (s.chapter >= c.ch[0] && s.chapter <= c.ch[1])) &&
    (c.hearts === undefined || hearts >= c.hearts));

/**
 * What a resident says today. Deterministic for (state.day, resident.id). The resident’s own line is always a candidate; lines tied to
 * a season, chapter or hearts are preferred about two days in three when one fits; parity lines take turns day by day.
 */
export function residentLine(state, resident, raw = false) {
  const hearts = state.friendship?.[resident.id] ?? 0;
  const own = `${resident.line}|${t(resident.line)}`;
  const all = [[null, own], ...(LINES[resident.id] ?? [])].filter(([c]) => fits(c, state, hearts));
  const special = all.filter(([c]) => c && (c.season !== undefined || c.ch || c.hearts !== undefined));
  const plain = all.filter(([c]) => !(c && (c.season !== undefined || c.ch || c.hearts !== undefined)));
  const h = hash(state.day, resident.id);
  const pool = special.length && (plain.length === 0 || h % 3 !== 0) ? special : plain;
  const line = pool[Math.floor(h / 3) % pool.length][1];
  if (line === own) return raw ? own : t(resident.line);
  return raw ? line : L(line);
}

/** The refusal line of a resident who dislikes the gift. */
export const refusalLine = (id, raw = false) =>
  raw ? (REFUSALS[id] ?? REFUSAL_DEFAULT) : L(REFUSALS[id] ?? REFUSAL_DEFAULT);

export const allLines = () => [
  ...Object.values(LINES).flatMap(rows => rows.map(r => r[1])),
  ...Object.values(REFUSALS),
  REFUSAL_DEFAULT,
  ...Object.values(HEART_SCENES).flatMap(levels => Object.values(levels).flatMap(beats => beats.map(b => b[1]))),
];
export const missingVietnamese = () => allLines().filter(l => !hasBoth(l));
export const RESIDENT_IDS = RESIDENTS.map(r => r.id);
