// The little things to tap inside the Town Square buildings: what each one answers (pure data and rules; lazy, fetched with the
// talk view). A thing is a 'fun' target of a plan (facility-plans.mjs); its key here is '<building>:<target id>'. Town tales
// (tales.mjs) answer first when a tale or the day's moment is at that spot; otherwise the thing says the next of its lines (the day
// picks where it starts, each tap moves on), written `English|Tiếng Việt` like the talk tables.
//   lines   the answers; { say, when: 'festival' | 'rain' | 'open' | 'shut' } is only said then, and then it comes first
//   energy  [key, amount, line]: a small pick-me-up once a day per thing (s.chat.used[key]); `line` is said when it is given
//   prices  item ids: the tags on a shelf, with today's checkout prices (the game's own produce; the supermarket buys, it does not sell)
//   note    the suggestion box: a note today, the office's answer from tomorrow on
import { calendar, sellPrice } from './game.mjs';
import { ITEMS } from './content.mjs';
import { memory, pair } from './facility-talk.mjs';

export const THINGS = {
  // ------------------------------------------------------------------ school
  'school:globe': { lines: [
    `Round and round… it stops on Willowmere, of course.|Quay, quay mãi… rồi dừng đúng ở Willowmere, dĩ nhiên rồi.`,
    `You spin the globe. It stops on the sea. Milo says that is where his homework went.|Bạn quay quả địa cầu. Nó dừng giữa biển. Milo bảo bài tập của cậu ấy trôi ra đúng chỗ đó.`,
    `Someone has drawn a tiny willow on the globe, in pencil, exactly where the village is.|Ai đó đã vẽ một cây liễu tí xíu bằng bút chì lên quả địa cầu, đúng chỗ ngôi làng.`,
    `The globe squeaks as it turns. Kit says he will oil it with pumpkin soup.|Quả địa cầu kêu cót két khi quay. Kit bảo sẽ tra dầu cho nó bằng súp bí ngô.`,
  ] },
  'school:library': { lines: [
    `Book of the day: “The Carrot Who Wanted to Be Tall”. It ends well. It ends in soup.|Sách hôm nay: “Củ cà rốt muốn cao lớn”. Kết thúc có hậu. Có hậu trong nồi súp.`,
    `Book of the day: “One Hundred Excuses for Late Homework”. The last page is missing. The goat, says Wren.|Sách hôm nay: “Một trăm lý do nộp bài muộn”. Thiếu mất trang cuối. Wren bảo tại con dê.`,
    `Book of the day: “How to Fish”, by Ellis. Chapter one: wait. Chapter two: keep waiting.|Sách hôm nay: “Cách câu cá” của ông Ellis. Chương một: chờ. Chương hai: chờ tiếp.`,
    `Book of the day: “The Very Large Chicken”, written and drawn by Pip. Four pages. All of them chicken.|Sách hôm nay: “Con gà siêu to”, Pip viết và vẽ. Bốn trang. Trang nào cũng là gà.`,
    `Book of the day: an atlas. Someone has pencilled “here be Biscuit” over the market.|Sách hôm nay: tập bản đồ. Ai đó ghi bút chì lên khu chợ: “vùng này có dê Biscuit”.`,
  ] },
  'school:pet': { lines: [
    `Professor Nibbles, the class hamster, runs on his wheel. He is late for something.|Giáo sư Nhấm Nháp, chú chuột hamster của lớp, đang chạy trên vòng quay. Chắc thầy trễ việc gì đó.`,
    `Professor Nibbles looks at you, then at your pockets. He has heard you grow carrots.|Giáo sư Nhấm Nháp nhìn bạn, rồi nhìn túi áo bạn. Thầy nghe nói nhà bạn trồng cà rốt.`,
    `The feeding chart: Monday Pip, Tuesday Wren, Wednesday Milo, every day secretly Faye.|Bảng cho ăn: thứ Hai Pip, thứ Ba Wren, thứ Tư Milo, còn ngày nào Faye cũng lén cho thêm.`,
    `Professor Nibbles is asleep in his little red house. The sign says: marking homework, do not disturb.|Giáo sư Nhấm Nháp đang ngủ trong căn nhà đỏ tí hon. Biển ghi: đang chấm bài, xin đừng làm phiền.`,
  ] },
  'school:lockers': { lines: [
    `Every locker has a name tag. Pip’s has a drawing of a very large chicken.|Tủ nào cũng có bảng tên. Tủ của Pip có hình một con gà siêu to.`,
    `Kit’s locker ticks. Nobody asks. Ms Cora has decided not to know.|Tủ của Kit kêu tích tắc. Không ai hỏi. Cô Cora quyết định là mình không biết gì hết.`,
    `Milo’s locker holds one running shoe. The other one is, he says, still running.|Tủ của Milo có đúng một chiếc giày chạy. Cậu bảo chiếc kia vẫn đang chạy.`,
  ] },
  'school:trophy': { lines: [
    `The village run cup. Milo is the second-fastest name on it.|Chiếc cúp chạy bộ của làng. Milo là cái tên nhanh thứ hai trên đó.`,
    `The cup is polished every Friday. By Milo. He says it is good to know your enemy.|Thứ Sáu nào chiếc cúp cũng được đánh bóng. Milo đánh. Cậu bảo phải hiểu rõ đối thủ.`,
  ] },
  // ------------------------------------------------------------------ clinic
  'hospital:scale': { lines: [
    `The needle swings, thinks it over, and settles on “just right”.|Kim cân lắc qua lắc lại, ngẫm nghĩ một lúc, rồi dừng ở mức “vừa đẹp”.`,
    `The scale says you weigh exactly one you, plus breakfast.|Cân bảo bạn nặng đúng bằng một người như bạn, cộng thêm bữa sáng.`,
    `A note on the scale in Hazel’s hand: boots off, pockets empty, no holding pumpkins.|Trên cân có mảnh giấy chữ Hazel: cởi ủng, dốc túi, cấm ôm bí ngô khi cân.`,
    `You step on. The scale sighs. It does that to everybody, says Sylvie.|Bạn bước lên. Cái cân thở dài. Sylvie bảo ai nó cũng thở dài vậy đó.`,
  ] },
  'hospital:chart': { lines: [
    `E. F P. T O Z. The bottom line is either letters or very small ants.|E. F P. T O Z. Dòng cuối cùng hoặc là chữ, hoặc là mấy con kiến rất nhỏ.`,
    `You read the chart perfectly. Then you notice Milo has learned it by heart and whispered it.|Bạn đọc bảng không sai chữ nào. Rồi mới biết Milo thuộc lòng và đứng nhắc nhỏ.`,
    `The last line of the eye chart says: if you can read this, go and help Oren find his glasses.|Dòng cuối bảng đo mắt ghi: ai đọc được dòng này thì ra giúp Oren tìm kính.`,
  ] },
  'hospital:mags': { lines: [
    `Modern Turnip, the spring issue. From several springs ago.|Tạp chí Củ Cải Thời Nay, số mùa xuân. Của mấy mùa xuân về trước.`,
    `Pond Life Weekly. Someone has done the crossword. Every answer is “carp”.|Tuần san Đời Sống Ao Hồ. Ô chữ đã có người giải. Ô nào cũng điền “cá chép”.`,
    `Knitting for Beginners. Page one is knitted to page two.|Sách Đan Len Vỡ Lòng. Trang một đã bị đan dính vào trang hai.`,
    `A quiz: “Which vegetable are you?” You are a pumpkin. Reliable, round, good in soup.|Trắc nghiệm: “Bạn là loại rau củ nào?” Bạn là bí ngô. Đáng tin, tròn trịa, nấu súp ngon.`,
  ] },
  'hospital:pharmacy': { lines: [
    `Ginger tea, plasters and sweet cough syrup. Sylvie labels every jar in her neatest hand.|Trà gừng, băng dán và si rô ho ngọt lịm. Sylvie nắn nót ghi nhãn từng lọ.`,
    `A jar labelled “for hiccups”: empty. A jar labelled “for Hazel”: also for hiccups.|Một lọ ghi “trị nấc”: hết sạch. Một lọ ghi “của Hazel”: cũng là trị nấc.`,
    `The top shelf is labelled “sweets, for the brave”. The bottom shelf: “sweets, for the others”.|Kệ trên cùng ghi “kẹo cho người dũng cảm”. Kệ dưới cùng: “kẹo cho những người còn lại”.`,
  ] },
  'hospital:reception': { lines: [
    `Check-ups cost 30 coins and restore all your energy. One a day is plenty.|Khám sức khỏe giá 30 xu và hồi đầy năng lượng. Mỗi ngày một lần là đủ.`,
    `The sign-in book. Last entry: “Biscuit, goat. Reason for visit: ate the first sign-in book.”|Sổ đăng ký khám. Dòng mới nhất: “Biscuit, dê. Lý do đến khám: ăn mất cuốn sổ trước.”`,
    { say: `The clinic is quiet for the night. A lamp, a kettle, and Hazel’s slippers under the desk.|Phòng khám yên ắng về đêm. Một ngọn đèn, một ấm nước, và đôi dép của Hazel dưới gầm bàn.`, when: 'shut' },
  ] },
  // ------------------------------------------------------------------ police
  'police:bell': { lines: [
    `Ding! A sign beside it says: Ring once for help, twice for tea.|Keng! Tấm biển bên cạnh ghi: bấm một lần là cần giúp, hai lần là cần trà.`,
    `Ding! Somewhere in the cells, a cat opens one eye and closes it again.|Keng! Đâu đó trong buồng giam, một con mèo mở một mắt rồi nhắm lại.`,
    `Ding ding! Pearl’s rule: three rings means you are a child, or the goat.|Keng keng! Luật của Pearl: bấm ba lần thì một là trẻ con, hai là con dê.`,
    { say: `Ding! Nobody comes. A note under the bell: gone home. For anything urgent, shout toward the boathouse.|Keng! Không ai ra. Dưới chuông có mảnh giấy: về nhà rồi. Việc gấp thì cứ hét to về phía nhà thuyền.`, when: 'shut' },
  ] },
  'police:found': { lines: [
    `One sock, two umbrellas and a whistle that only works indoors.|Một chiếc tất, hai cái ô và một cái còi chỉ kêu khi ở trong nhà.`,
    `A label: “Found near the pond: one fishing story, slightly stretched. Owner: Ellis, probably.”|Nhãn ghi: “Nhặt được gần ao: một câu chuyện câu cá, hơi bị kéo dài. Chủ: chắc là ông Ellis.”`,
    `The same glove as in the supermarket’s basket. Pearl is waiting for the two to meet.|Chiếc găng giống hệt chiếc trong giỏ ở siêu thị. Pearl đang chờ ngày hai chiếc đoàn tụ.`,
    `A tin of buttons, a spoon, and a note from the crow. It is not an apology.|Một hộp cúc áo, một cái thìa, và mảnh giấy của con quạ. Không phải thư xin lỗi.`,
  ] },
  'police:notice': { lines: [
    `LOST: one goat, answers to “Biscuit”. Last seen eating the market flowers. Pearl has circled the spot twice.|TÌM: một con dê, gọi “Biscuit” là thưa. Lần cuối bị thấy đang ăn hoa ở chợ. Pearl đã khoanh chỗ đó hai vòng.`,
    `WANTED: for questioning, one crow. Charge: three spoons, a key and a hair clip. Reward: your spoon back.|TRUY TÌM: một con quạ, mời lên làm việc. Tội: ba cái thìa, một chìa khóa, một cái kẹp tóc. Thưởng: trả lại thìa cho bạn.`,
    `NOTICE: the pothole on the north road is not a pond. Please stop fishing in it. This means you, Ellis.|THÔNG BÁO: ổ gà trên đường phía bắc không phải là ao. Xin đừng câu cá ở đó nữa. Nói ông đấy, ông Ellis.`,
    `REWARD: for whoever keeps borrowing the station pen and returning a carrot.|TREO THƯỞNG: cho ai tìm ra người cứ mượn bút của đồn rồi trả lại bằng một củ cà rốt.`,
    { say: `NOTICE: harvest supper tonight. Officers on duty will be patrolling the pie table. Closely.|THÔNG BÁO: tối nay có tiệc mùa gặt. Cảnh sát trực sẽ tuần tra quanh bàn bánh nướng. Rất sát sao.`, when: 'festival' },
  ] },
  'police:cells': { lines: [
    `Two tidy cells with a blanket and a book. Nobody has stayed longer than a lunch hour.|Hai buồng giam gọn gàng, có chăn và sách. Chưa ai ở lại lâu hơn một giờ ăn trưa.`,
    `The cell door is not locked. It has never been locked. Pearl lost the key in Autumn and nobody minded.|Cửa buồng giam không khóa. Chưa bao giờ khóa. Pearl làm mất chìa từ mùa thu mà chẳng ai phiền lòng.`,
    `Scratched on the wall: day 1. Under it: went home for tea.|Trên tường có khắc: ngày thứ 1. Bên dưới: về nhà uống trà rồi.`,
  ] },
  'police:evidence': { lines: [
    `Labelled boxes of found things: one boot, three keys and a very muddy hat.|Những hộp đồ nhặt được có dán nhãn: một chiếc ủng, ba chìa khóa và một cái mũ lấm bùn.`,
    `Exhibit A: a half-eaten tulip. Exhibit B: a goat-shaped hole in a hedge.|Tang vật A: một bông tulip ăn dở. Tang vật B: một lỗ thủng hình con dê trên hàng rào.`,
    `A box labelled “mysteries, unsolved”. Inside: one sock.|Một hộp ghi “bí ẩn chưa có lời giải”. Bên trong: một chiếc tất.`,
  ] },
  // ------------------------------------------------------------------ supermarket
  'supermarket:shelves': { prices: ['carrot', 'radish', 'pumpkin', 'tulip', 'sunflower'], lines: [
    `Shelf after shelf: jam, flour and Hugo’s bread. Everything tastes of Willowmere.|Hết kệ này đến kệ khác: mứt, bột mì và bánh mì của Hugo. Món nào cũng đượm vị Willowmere.`,
    `A tag reads “carrots, extra straight”. Beside it: “carrots, with character”. Same price.|Một nhãn ghi “cà rốt thẳng tắp”. Bên cạnh: “cà rốt cá tính”. Đồng giá.`,
  ] },
  'supermarket:shelf2': { prices: ['apple', 'peach', 'grape', 'mushroom', 'truffle'], lines: [
    `The garden aisle: what the village grows, with a price on every tag.|Dãy hàng vườn: những thứ cả làng trồng được, món nào cũng có giá trên nhãn.`,
    `One pumpkin sits alone on the shelf, labelled “the last one”. Finn puts out another “last one” every hour.|Một quả bí ngô nằm lẻ loi trên kệ, nhãn ghi “quả cuối cùng”. Cứ mỗi giờ Finn lại bày thêm một “quả cuối cùng”.`,
  ] },
  'supermarket:shelf3': { prices: ['egg', 'milk', 'perch', 'carp', 'catfish'], lines: [
    `The pantry aisle: milk, eggs, honey and whatever the pond gave this morning.|Dãy đồ khô: sữa, trứng, mật ong và bất cứ thứ gì cái ao cho sáng nay.`,
    `A jar of honey labelled “from bees who know Mara”. It costs a little more.|Một hũ mật ong ghi “của đàn ong quen cô Mara”. Giá nhỉnh hơn một chút.`,
  ] },
  'supermarket:sample': { energy: ['sample', 3, `One little taste: a cube of cheese on a stick. Small, but it does you good.|Một miếng nếm thử: viên phô mai xiên que. Bé thôi, nhưng ấm bụng.`], lines: [
    `A tray of little tastes. One each, says the sign. The sign is very firm.|Một khay đồ nếm thử. Biển ghi: mỗi người một miếng. Tấm biển rất nghiêm.`,
    `You reach for a second sample. Nell coughs from the till without looking up.|Bạn với tay lấy miếng thứ hai. Nell ở quầy ho một tiếng, không cần ngẩng lên.`,
    `Today’s sample: pumpkin jam on bread. Yesterday’s: bread on pumpkin jam. Hugo is experimenting.|Món thử hôm nay: mứt bí ngô phết bánh mì. Hôm qua: bánh mì phết lên mứt bí ngô. Hugo đang thử nghiệm.`,
  ] },
  'supermarket:trolley': { lines: [
    `You push a trolley. One wheel has ideas of its own.|Bạn đẩy thử một chiếc xe hàng. Có một bánh xe sống theo ý riêng.`,
    `The trolley pulls left, toward the bread. It knows what it wants.|Chiếc xe cứ ghì sang trái, về phía quầy bánh mì. Nó biết mình muốn gì.`,
    `Wheee. You ride the trolley for two metres. Oren pretends not to see. Finn gives it an eight out of ten.|Vèo. Bạn đứng lên xe trượt được hai mét. Oren giả vờ không thấy. Finn chấm tám trên mười.`,
    `Squeak, squeak, squeak. The trolley sings. Nobody knows the tune, but it is always the same one.|Két, két, két. Chiếc xe hàng đang hát. Không ai biết bài gì, nhưng lúc nào cũng đúng một bài.`,
  ] },
  'supermarket:lost': { lines: [
    `One glove, one spoon, one very small hat. Pearl collects the basket on Fridays.|Một chiếc găng, một cái thìa, một cái mũ bé tí. Thứ Sáu nào Pearl cũng đến mang giỏ đi.`,
    `A shopping list: “carrots, string, DO NOT FORGET THE THING”. The thing is not named.|Một tờ giấy đi chợ: “cà rốt, dây, NHỚ MUA CÁI ĐÓ”. Cái đó là cái gì thì không ghi.`,
    `A single glove with a label: “The other one is at the police station. They miss each other.”|Một chiếc găng lẻ kèm nhãn: “Chiếc kia đang ở đồn cảnh sát. Hai đứa nhớ nhau lắm.”`,
    `An umbrella, a button, and Ellis’s reading glasses again. Third time this week.|Một cái ô, một cái cúc, và lại là kính đọc sách của ông Ellis. Lần thứ ba trong tuần.`,
  ] },
  'supermarket:news': { lines: [
    `FOR SALE: one wheelbarrow, nearly round wheel. WANTED: a goat-proof flower pot.|CẦN BÁN: một xe cút kít, bánh gần tròn. CẦN MUA: chậu hoa chống được dê.`,
    `LESSONS: Ellis teaches patience at the pond. First lesson free. It takes all day.|DẠY KÈM: ông Ellis dạy tính kiên nhẫn ở bờ ao. Buổi đầu miễn phí. Học hết cả ngày.`,
    `SWAP: three jars of jam for someone who can explain the wobbly trolley.|ĐỔI: ba hũ mứt lấy một người giải thích được vì sao xe hàng cứ lắc lư.`,
    { say: `TONIGHT: harvest supper on the green. Bring a dish you cooked. Nell is counting chairs.|TỐI NAY: tiệc mùa gặt ở bãi cỏ làng. Mang theo một món tự nấu. Nell đang đếm ghế.`, when: 'festival' },
    { say: `TODAY: rain. Umbrellas are by the door. Please return them. Yes, you too, Theo.|HÔM NAY: mưa. Ô để cạnh cửa. Dùng xong xin trả lại. Vâng, cả anh nữa, anh Theo.`, when: 'rain' },
  ] },
  'supermarket:chillers': { lines: [
    `Milk, eggs and the pond’s best fish, kept cold. Sell yours at the checkout.|Sữa, trứng và những con cá ngon nhất của ao, được giữ lạnh. Hãy bán hàng của bạn tại quầy thanh toán.`,
    `Brr. Finn says the cold section is the only place a fish story stays the same size.|Brr. Finn bảo quầy lạnh là nơi duy nhất chuyện câu cá không bị phóng to thêm.`,
    `A carp on ice looks back at you. You both decide to say nothing.|Một con cá chép trên đá lạnh nhìn bạn. Hai bên thống nhất là không nói gì.`,
  ] },
  'supermarket:stock': { lines: [
    `Crates of tomorrow’s deliveries. Finn is counting them again.|Những thùng hàng giao ngày mai. Finn lại đang đếm chúng lần nữa.`,
    `Twelve crates. Finn’s chalk marks say eleven, twelve, eleven, thirteen and “ask Nell”.|Mười hai thùng. Vạch phấn của Finn ghi mười một, mười hai, mười một, mười ba và “hỏi Nell”.`,
    `One crate says THIS SIDE UP. It is upside down. Everyone has agreed not to tell Finn.|Một thùng in chữ ĐỂ ĐỨNG CHIỀU NÀY. Nó đang nằm ngược. Cả tiệm thống nhất không nói với Finn.`,
  ] },
  // ------------------------------------------------------------------ Willow & Co.
  'company:coffee': { energy: ['coffee', 5, `The machine gurgles, sighs and gives you a coffee. It was not in a hurry. You feel a little brighter.|Cái máy ùng ục, thở dài, rồi cũng nhả ra một tách cà phê. Nó chẳng vội gì. Bạn thấy tỉnh táo hơn một chút.`], lines: [
    `One coffee a day, says Bea’s note on the machine. The machine agrees and will not be argued with.|Giấy của Bea dán trên máy: mỗi ngày một tách. Cái máy đồng ý và miễn bàn cãi.`,
    `You press the button. The machine makes the noise, shows the light, and keeps the coffee.|Bạn bấm nút. Máy kêu đúng tiếng, bật đúng đèn, và giữ luôn cà phê.`,
    `A list taped to the machine: “Things it has made instead of coffee”. Number four is soup.|Tờ danh sách dán trên máy: “Những thứ nó từng pha thay cho cà phê”. Số bốn là súp.`,
  ] },
  'company:cooler': { lines: [
    `Glug. The water cooler says Hugo is baking something secret for the supper. It smells of pumpkin.|Ục. Bình nước bảo Hugo đang nướng món bí mật cho bữa tiệc. Nghe mùi bí ngô.`,
    `Glug. The water cooler says Theo fixed the pothole. The pothole says otherwise.|Ục. Bình nước bảo Theo vá xong ổ gà rồi. Ổ gà thì bảo chưa.`,
    `Glug glug. The water cooler says the crow now owns more spoons than the bakery.|Ục ục. Bình nước bảo con quạ giờ có nhiều thìa hơn cả tiệm bánh.`,
    `Glug. The water cooler says Biscuit was seen reading the notice about Biscuit. Then eating it.|Ục. Bình nước bảo có người thấy Biscuit đứng đọc tờ thông báo về Biscuit. Xong ăn luôn.`,
    `Glug. The water cooler says Milo won a race. It was against Wren. She stopped to look at a snail.|Ục. Bình nước bảo Milo vừa thắng một cuộc đua. Đua với Wren. Con bé dừng lại ngắm ốc sên.`,
  ] },
  'company:white': { lines: [
    `Today’s agenda: 1. The agenda. 2. Any other carrots.|Chương trình họp hôm nay: 1. Bàn về chương trình họp. 2. Cà rốt, nếu còn.`,
    `Today’s agenda: 1. Why the last meeting ran long. 2. Short meetings. 3. Overrun.|Chương trình họp hôm nay: 1. Vì sao buổi trước họp lâu. 2. Bàn cách họp ngắn. 3. Họp lố giờ.`,
    `Today’s agenda: 1. Who took the stapler. 2. Leo’s apology. 3. The stapler’s side of the story.|Chương trình họp hôm nay: 1. Ai cầm cái dập ghim. 2. Leo xin lỗi. 3. Nghe cái dập ghim trình bày.`,
    `Today’s agenda: 1. Biscuit. 2. The hedge. 3. Biscuit and the hedge. 4. Tea.|Chương trình họp hôm nay: 1. Dê Biscuit. 2. Hàng rào. 3. Biscuit với hàng rào. 4. Trà.`,
    { say: `Today’s agenda: 1. Harvest supper. 2. Who brings chairs. 3. No other business. Go home early.|Chương trình họp hôm nay: 1. Tiệc mùa gặt. 2. Ai mang ghế. 3. Hết việc. Về sớm.`, when: 'festival' },
  ] },
  'company:printer': { lines: [
    `The printer hums, thinks, and prints half a carrot.|Máy in ù ù, nghĩ ngợi, rồi in ra nửa củ cà rốt.`,
    `PAPER JAM, says the printer. You open it. There is no paper. There is, somehow, jam.|Máy in báo KẸT GIẤY. Bạn mở ra. Không thấy giấy. Chỉ thấy, chẳng hiểu sao, một ít mứt.`,
    `It prints one perfect page. Everyone stops working and claps. It jams out of shyness.|Nó in ra một trang hoàn hảo. Cả phòng ngừng tay vỗ tay. Nó ngượng quá nên kẹt luôn.`,
    `The printer prints a page that says only: “I am fine. How are you?”|Máy in in ra một trang chỉ có một dòng: “Tôi ổn. Còn bạn thì sao?”`,
    `Fern’s note on the lid: “Do not hit it. It remembers.”|Giấy của Fern dán trên nắp: “Đừng đập nó. Nó nhớ dai lắm.”`,
  ] },
  'company:box': { note: true, lines: [
    `A box for good ideas. And for the other kind.|Hòm thư cho các ý kiến hay. Và cả các ý kiến còn lại.`,
  ], drop: [
    `You write “more biscuits at meetings” and drop it in. The answer comes tomorrow.|Bạn viết “họp thì nên có thêm bánh quy” rồi thả vào hòm. Mai sẽ có hồi âm.`,
    `You write “fewer meetings about meetings” and drop it in. The answer comes tomorrow.|Bạn viết “bớt họp để bàn về việc họp” rồi thả vào hòm. Mai sẽ có hồi âm.`,
    `You write “a second chair for the boss office, so Bea can stop borrowing mine” and drop it in. The answer comes tomorrow.|Bạn viết “thêm một ghế cho phòng sếp, để Bea khỏi mượn ghế của tôi” rồi thả vào hòm. Mai sẽ có hồi âm.`,
  ], wait: `Your note is in the box. Bea reads them in the morning, with tea, out loud.|Thư của bạn nằm trong hòm rồi. Sáng mai Bea mới mở, vừa uống trà vừa đọc to cho cả phòng nghe.`, answers: [
    `A reply is pinned to the box: “Thank you for your idea. It has been filed under Good, between Tea and Naps.”|Có hồi âm ghim trên hòm: “Cảm ơn ý kiến của bạn. Đã xếp vào mục Hay, nằm giữa mục Trà và mục Ngủ Trưa.”`,
    `A reply is pinned to the box: “We held a meeting about your note. We agreed with it. Then we held another to be sure.”|Có hồi âm ghim trên hòm: “Chúng tôi đã họp về thư của bạn. Ai cũng tán thành. Rồi họp thêm buổi nữa cho chắc.”`,
    `A reply is pinned to the box, in Leo’s dreamy hand: “Yes. Also, could the ceiling be more like the sky?”|Có hồi âm ghim trên hòm, nét chữ mơ màng của Leo: “Đồng ý. Tiện thể, trần nhà có thể giống bầu trời hơn không?”`,
  ] },
  'company:news': { lines: [
    `The village news, pinned in Bea’s neatest hand: “Nothing happened on Tuesday. Details inside.”|Tin làng, Bea nắn nót ghim lên: “Thứ Ba không có chuyện gì xảy ra. Chi tiết xem trang trong.”`,
    `NEWS: a carrot the shape of a carrot was found in the Rowan fields. Experts are calm.|TIN: tại ruộng nhà Rowan vừa phát hiện một củ cà rốt có hình củ cà rốt. Giới chuyên môn vẫn bình tĩnh.`,
    `NEWS: the school bell rang on time. Ms Cora suspects nothing, which worries her.|TIN: chuông trường reo đúng giờ. Cô Cora không thấy gì đáng ngờ, và chính điều đó làm cô lo.`,
    `NEWS: Officer Pearl reports zero crimes this week, and one very suspicious duck.|TIN: cảnh sát Pearl báo cáo tuần này không có vụ án nào, chỉ có một con vịt rất đáng ngờ.`,
    { say: `NEWS: harvest supper tonight on the green. Twenty-four places are set, and a tiny bowl for the birds.|TIN: tối nay có tiệc mùa gặt ở bãi cỏ làng. Đã bày hai mươi bốn chỗ, thêm một cái bát tí hon cho lũ chim.`, when: 'festival' },
    { say: `NEWS: rain today. The fields are delighted. The washing lines have filed a complaint.|TIN: hôm nay mưa. Ruộng đồng rất phấn khởi. Mấy dây phơi đồ đã nộp đơn khiếu nại.`, when: 'rain' },
  ] },
  'company:plant': { energy: ['plant', 0, `You water the office plant. It stands a little straighter. So do you.|Bạn tưới cho chậu cây văn phòng. Nó đứng thẳng lên một chút. Bạn cũng vậy.`], lines: [
    `The office plant has had its drink for today. It is listening to the meeting through the wall.|Chậu cây văn phòng hôm nay uống đủ nước rồi. Nó đang hóng cuộc họp qua vách tường.`,
    `A tag on the pot: “My name is Gerald. I have survived nine meetings.”|Thẻ cắm trong chậu: “Tôi tên là Tùng. Tôi đã sống sót qua chín cuộc họp.”`,
    `The plant has grown a new leaf since this morning. It points at the door.|Từ sáng đến giờ cây ra thêm một lá mới. Cái lá chỉ thẳng ra cửa.`,
  ] },
  'company:break': { lines: [
    `In the fridge: Leo’s lunch, labelled LEO. Fern’s lunch, labelled NOT LEO’S.|Trong tủ lạnh: hộp cơm của Leo, ghi LEO. Hộp cơm của Fern, ghi KHÔNG PHẢI CỦA LEO.`,
    `A jar at the back of the fridge has been there longer than the fridge.|Có một cái hũ ở góc trong cùng, ở trong tủ lạnh còn lâu hơn cả cái tủ lạnh.`,
    `Half a cake, and a note: “Whoever ate the other half, the cake forgives you. Bea does not.”|Nửa cái bánh và mảnh giấy: “Ai ăn nửa kia thì cái bánh tha thứ cho bạn. Còn Bea thì không.”`,
  ] },
  'company:meeting': { lines: [
    `Next week’s agenda: more carrots, fewer meetings.|Chương trình tuần tới: nhiều cà rốt hơn, ít họp hơn.`,
    `Six chairs round a table. One is warm. Somebody has been napping in a meeting that was not on.|Sáu cái ghế quanh bàn. Một cái còn ấm. Có người vừa ngủ gật trong một cuộc họp không hề diễn ra.`,
  ] },
  'company:boss': { lines: [
    `The village leader’s desk: stamps, a heap of produce orders and a very good chair.|Bàn của trưởng làng: con dấu, một chồng đơn đặt nông sản và một chiếc ghế rất êm.`,
    `Your own desk. A note from Bea: “I signed these for you. And these. And I ate your biscuit.”|Bàn của chính bạn. Bea để lại mảnh giấy: “Tôi ký giúp bạn chỗ này. Cả chỗ này. Và tôi ăn mất bánh quy của bạn rồi.”`,
    `The name plate says ROWAN. Under it, in pencil, in a child’s hand: “and Pip”.|Biển tên ghi ROWAN. Bên dưới, bằng bút chì, nét chữ trẻ con: “và Pip”.`,
  ] },
};
/** Fits a conditional line now? */
function holds(when, s, open) { const c = calendar(s); return when === 'festival' ? c.festival : when === 'rain' ? c.rain : when === 'open' ? open : when === 'shut' ? !open : true; }
/**
 * What a thing answers now: { text: [en, vi], energy?: gained, tags?: [[item name, price], …] } or null when it has no entry (the
 * target's own line is said then). `open`: the building is in its opening hours. Marks the tap in today's memory.
 */
export function thingAnswer(s, facility, id, open = true) {
  const key = `${facility}:${id}`, thing = THINGS[key]; if (!thing) return null;
  const m = memory(s), taps = m.used[key] ?? 0; m.used[key] = taps + 1;
  const out = { text: null };
  if (thing.note) {
    if (m.note && m.note < s.day) { out.text = pair(thing.answers[m.note % thing.answers.length]); m.note = 0; return out; }
    if (m.note === s.day) { out.text = pair(thing.wait); return out; }
    m.note = s.day; out.text = pair(thing.drop[s.day % thing.drop.length]); return out;
  }
  if (thing.energy && !m.used[thing.energy[0] + '!']) {
    m.used[thing.energy[0] + '!'] = 1; const before = s.energy; s.energy = Math.min(100, s.energy + thing.energy[1]);
    out.energy = s.energy - before; out.text = pair(thing.energy[2]); return out;
  }
  const special = taps ? null : thing.lines.find(l => l.when && holds(l.when, s, open)), plain = thing.lines.filter(l => typeof l === 'string');
  out.text = pair(special ? special.say : plain[(s.day + taps) % plain.length]);
  if (thing.prices && taps % 2 === 0) out.tags = thing.prices.filter(i => ITEMS[i]).map(i => [ITEMS[i].name, sellPrice(s, i, true)]);
  return out;
}
/** Every line of every thing, for the tests: [key, text]. */
export function thingLines() {
  const out = [];
  for (const [key, t] of Object.entries(THINGS)) { for (const l of [...t.lines, ...(t.drop ?? []), ...(t.answers ?? [])]) out.push([key, typeof l === 'string' ? l : l.say]); if (t.wait) out.push([key, t.wait]); if (t.energy) out.push([key, t.energy[2]]); }
  return out;
}
