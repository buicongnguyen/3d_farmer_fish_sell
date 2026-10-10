// Willowmere School: what Ms Cora, her five pupils and a parent waiting in the hall say (rules and format: facility-talk.mjs).
export default {
  cora: [
    { id: 'cora-who-knows', nodes: {
      a: { say: `I asked the class: who knows today’s lesson? Half did, half didn’t. So I said: those who know, tell those who don’t. Was that teaching?|Tôi hỏi cả lớp: ai biết hôm nay học gì? Nửa biết, nửa không. Tôi bảo: nửa biết giảng cho nửa chưa biết nhé. Thế có tính là dạy không?`, choices: [
        [`That is delegation|Đó gọi là giao việc`, `Bea calls it management. I call it a cup of tea in peace.|Bea gọi đó là quản lý. Tôi gọi đó là một tách trà yên thân.`, 'b'],
        [`That is cheating|Thế là ăn gian`, `Only if I get caught, and I am the one who marks the homework.|Bị bắt mới tính là ăn gian, mà người chấm bài lại là tôi.`],
        [`That is genius|Thiên tài đấy`, `Thank you. Write it on the board, I’ll trace over it and take the credit.|Cảm ơn bạn. Bạn viết lên bảng đi, tôi tô lại rồi nhận là của tôi.`],
      ] },
      b: { say: `Then Milo said he both knew the lesson and didn’t. What do I do with a boy like that?|Xong Milo giơ tay: em vừa biết vừa không biết ạ. Với một cậu như thế thì tôi làm sao đây?`, choices: [
        [`Give him both halves|Cho cậu ấy cả hai nửa`, `He already takes both halves of every biscuit. But yes, fair.|Bánh quy nào nó cũng lấy cả hai nửa rồi. Nhưng ừ, công bằng.`],
        [`Make him the teacher|Cho cậu ấy làm thầy`, `He tried on Tuesday. The lesson was running. We all passed, out of breath.|Hôm thứ Ba nó làm rồi. Bài học là chạy. Cả lớp đỗ hết, vừa đỗ vừa thở.`],
        [`Send him to Pearl|Gửi sang đồn cô Pearl`, `Pearl says the cell is taken. By the cat. It is still not under arrest.|Pearl bảo phòng giam có khách rồi. Con mèo. Nó vẫn chưa bị bắt đâu nhé.`],
      ] },
    } },
    { id: 'cora-pip-at-home', nodes: {
      a: { say: `Pip’s essay “My Family” lists you, June, and one chicken the size of a barn. How is she doing at home?|Bài văn “Gia đình em” của Pip kể có bạn, có June, và một con gà to bằng cái kho thóc. Ở nhà bé thế nào?`, choices: [
        [`She reads to the hens|Bé đọc sách cho gà nghe`, `That explains it. Her spelling test had “cluck” in it twice, both spelled correctly.|Hèn gì. Bài chính tả của bé có hai chữ “cục tác”, viết đúng cả hai.`],
        [`She draws on everything|Bé vẽ lên mọi thứ`, `I know. She handed in her homework on a pumpkin. I marked the pumpkin.|Tôi biết. Bé nộp bài tập viết trên quả bí ngô. Tôi chấm luôn quả bí.`, 'b'],
        [`She says school is “fine”|Bé bảo đi học “cũng được”`, `“Fine” is the highest mark a child ever gives. I shall frame it.|“Cũng được” là điểm cao nhất trẻ con chịu cho đấy. Tôi sẽ đóng khung treo lên.`],
      ] },
      b: { say: `One thing. She asked me whether a planted wish needs watering. What do I tell her?|À còn chuyện này. Bé hỏi tôi: điều ước trồng xuống rồi có phải tưới không. Tôi trả lời sao đây?`, choices: [
        [`Yes, every day|Có, ngày nào cũng tưới`, `Oren will be thrilled. “Water is the secret” goes up on the board again.|Oren mà nghe thì sướng lắm. Câu “nước là bí quyết” lại được lên bảng.`],
        [`Only with patience|Chỉ cần tưới bằng kiên nhẫn`, `Lovely. I’ll borrow that and pretend it was in a book.|Hay quá. Tôi xin mượn câu ấy, rồi giả vờ là trong sách có.`],
        [`Ask Grandma Ada|Hỏi bà Ada ấy`, `Ada will say one handful of water. Whose hand, she never says. Thank you, that helps.|Bà Ada sẽ bảo: một vốc nước. Vốc tay ai thì bà không nói. Cảm ơn bạn, thế là đủ rồi.`],
      ] },
    } },
    { id: 'cora-quick-quiz', when: { fresh: 'school' }, nodes: {
      a: { say: `Quick quiz before the bell. If I hold six carrots in one hand and seven in the other, what have I got?|Đố nhanh trước giờ trống nhé. Tay này tôi cầm sáu củ cà rốt, tay kia bảy củ. Vậy tôi có gì?`, choices: [
        [`Thirteen carrots|Mười ba củ cà rốt`, `Correct, and a little dull. Kit said the same, then asked to keep the carrots.|Đúng, mà hơi nhạt. Kit cũng đáp thế, xong xin luôn chỗ cà rốt.`, 'b'],
        [`Very big hands|Hai bàn tay rất to`, `That is what Milo said. I gave him a mark for observation.|Milo cũng nói y như vậy. Tôi cho nó một điểm quan sát.`, 'b'],
        [`Biscuit right behind you|Có Biscuit ngay sau lưng`, `I looked. Please never do that to a teacher who is holding carrots.|Tôi quay lại nhìn thật đấy. Đừng đùa thế với cô giáo đang cầm cà rốt.`],
      ] },
      b: { say: `You have warmed up nicely. Shall we do the proper lesson? There is a spare desk. It is slightly small.|Bạn khởi động tốt đấy. Mình vào bài học thật nhé? Còn một bàn trống. Bàn hơi bé một tí.`, choices: [
        [`Yes, ring the bell|Vâng, cô đánh trống đi`, `Sit up straight, village leader. And no whispering to Pip.|Ngồi thẳng lưng nào, trưởng làng. Cấm nói chuyện riêng với Pip nhé.`, '', 'lesson'],
        [`Do I get a gold star?|Tôi có được phiếu bé ngoan không?`, `If you earn it. I am strict with stars and soft with everything else.|Ngoan thì có. Tôi chỉ khó tính với phiếu bé ngoan, còn lại thì dễ lắm.`, '', 'lesson'],
        [`Later, the desk scares me|Để sau, tôi sợ cái bàn ấy`, `The desk is small and you are tall. Come back when your knees feel brave.|Bàn thì bé, bạn thì cao. Khi nào hai đầu gối thấy can đảm thì quay lại nhé.`],
      ] },
    } },
    { id: 'cora-seconds', when: { done: 'school' }, nodes: {
      a: { say: `You again! You have had today’s lesson. Even Milo doesn’t ask for seconds of school.|Lại là bạn! Hôm nay bạn học xong rồi mà. Đến Milo cũng chưa bao giờ xin học thêm bát nữa.`, choices: [
        [`I forgot what I learned|Tôi quên mất vừa học gì rồi`, `Already? A village record. Kit held it at nine minutes.|Nhanh thế? Kỷ lục của làng đấy. Trước giờ Kit giữ kỷ lục: chín phút.`, 'b'],
        [`I came for the chalk smell|Tôi ghé ngửi mùi phấn thôi`, `Sniff freely, it costs nothing. I smell of chalk, Ash smells of sawdust, and neither of us minds.|Cứ ngửi tự nhiên, không tính tiền. Tôi mùi phấn, Ash mùi mùn cưa, hai bên đều vui vẻ cả.`],
        [`I miss my little desk|Tôi nhớ cái bàn bé xíu`, `It misses you too. It creaked all afternoon. Come back tomorrow.|Nó cũng nhớ bạn. Kêu cót két suốt buổi chiều. Mai bạn lại đến nhé.`],
      ] },
      b: { say: `Then tell me one thing we learned today. One. Anything at all.|Vậy bạn kể tôi nghe một điều hôm nay mình đã học. Một điều thôi. Gì cũng được.`, choices: [
        [`Water is the secret|Nước là bí quyết`, `That is Oren’s lesson, not mine. But it is true, so half a mark.|Bài đó của Oren chứ đâu phải của tôi. Nhưng đúng, nên cho nửa điểm.`],
        [`Never trust a goat|Chớ tin một con dê`, `Not on my syllabus, yet correct in every season. Full marks.|Trong giáo án không có, nhưng mùa nào cũng đúng. Mười điểm.`],
        [`That I love school|Rằng tôi yêu trường lắm`, `Flattery. I accept it in place of homework, today only.|Nịnh nhé. Tôi nhận, coi như thay bài tập về nhà, riêng hôm nay thôi.`],
      ] },
    } },
    { id: 'cora-yard-lunch', when: { from: 11.5, to: 12.5 }, nodes: {
      a: { say: `Yard duty. I have one sandwich, five pupils watching it, and a crow with plans. Advise me.|Tôi đang trực sân. Có một cái bánh mì kẹp, năm đứa học trò đang nhìn nó, và một con quạ có âm mưu. Bạn hiến kế đi.`, choices: [
        [`Eat it fast|Ăn thật nhanh`, `I tried on Monday. Hiccups through all of geography. Hazel understood far too well.|Thứ Hai tôi thử rồi. Nấc suốt giờ địa lý. Hazel thông cảm lắm, thông cảm quá mức luôn.`, 'b'],
        [`Share it six ways|Chia làm sáu phần`, `Faye has drawn the lines already. Mine is the piece with the crust and a sun signed on it.|Faye kẻ sẵn đường chia rồi. Phần tôi là miếng vỏ cứng, có ký hình mặt trời.`],
        [`Guard it with the register|Lấy sổ điểm danh ra canh`, `The register is for counting children. It does swat nicely, though.|Sổ điểm danh là để đếm học trò. Mà đem đập ruồi đuổi quạ cũng êm tay phết.`, 'b'],
      ] },
      b: { say: `Now Milo says he smelled the sandwich first, so it is partly his. Is that a fair claim?|Giờ Milo bảo nó ngửi thấy cái bánh trước, nên bánh có phần của nó. Đòi thế có lý không?`, choices: [
        [`He gets the smell only|Cho cậu ấy phần mùi thôi`, `And if I charged him for it, he could pay with the jingle of his pocket money. An old judge’s trick.|Còn nếu tôi đòi tiền mùi, nó cứ lắc túi tiền cho tôi nghe tiếng là xong. Mẹo của một ông quan toà xưa đấy.`],
        [`Ask Officer Pearl|Hỏi cô cảnh sát Pearl`, `Pearl ruled last time: the sandwich belongs to whoever made it. Wise woman. Hungry, too.|Lần trước Pearl xử rồi: bánh thuộc về người làm ra bánh. Sáng suốt lắm. Mà cũng đang đói lắm.`],
        [`Yes, it is his now|Có lý, bánh của cậu ấy`, `Traitor. Fine, half each. He will run a lap for his half, and so will I, behind him.|Bạn phản tôi nhé. Thôi, mỗi người một nửa. Nó chạy một vòng sân mới được ăn, tôi chạy ngay sau lưng nó.`],
      ] },
    } },
    { id: 'cora-wet-playtime', when: { rain: true }, nodes: {
      a: { say: `Rain, so playtime is indoors. Five children, one room, forty minutes. What would you do?|Mưa rồi, giờ ra chơi phải ở trong lớp. Năm đứa trẻ, một căn phòng, bốn mươi phút. Là bạn thì bạn làm gì?`, choices: [
        [`Quiet reading|Cho các em đọc thầm`, `I said “quiet reading”. They read quietly for one whole page. Between the five of them.|Tôi bảo “đọc thầm”. Chúng nó đọc thầm được trọn một trang. Cả năm đứa gộp lại.`],
        [`A puddle lesson outside|Ra ngoài học về vũng nước`, `Science! Kit measured the puddle with Wren. Wren is the unit now. It is two Wrens deep.|Khoa học đấy! Kit lấy Wren ra đo vũng nước. Giờ Wren là đơn vị đo. Vũng sâu hai Wren.`, 'b'],
        [`Hide in the cupboard|Trốn vào tủ đồ`, `Taken. I am in there from a quarter past.|Có người đặt chỗ rồi. Tôi vào đấy từ phút thứ mười lăm.`, 'b'],
      ] },
      b: { say: `And Milo asks: if it rains on the race, does a slow time still count as second-fastest?|Còn Milo thì hỏi: trời mưa mà chạy chậm thì vẫn được tính là nhanh nhì chứ ạ?`, choices: [
        [`Yes, a wet second|Được, nhì mà ướt`, `As race steward I shall write it down: “Second, damp.” He will be proud.|Với tư cách trọng tài đường đua, tôi sẽ ghi: “Hạng nhì, hơi ẩm.” Nó sẽ hãnh diện lắm.`],
        [`Only if someone else ran|Miễn là có người khác chạy`, `We never ask how many entered. It is the first rule of the school.|Ở đây không ai hỏi có mấy người dự thi. Đấy là nội quy số một của trường.`],
        [`Rain earns a bonus mark|Chạy mưa được cộng điểm`, `Then the frogs win. They entered, and they have not stopped since.|Thế thì lũ ếch thắng. Chúng nó có dự thi, và từ đó đến giờ chưa chịu dừng.`],
      ] },
    } },
    { id: 'cora-airing-books', when: { season: 'Summer' }, nodes: {
      a: { say: `Sunny day, so we aired the school books. Milo lay down beside them, tummy up. He said he was airing everything he has learned.|Hôm nay nắng to, cả lớp đem sách ra phơi. Milo nằm ngửa ngay cạnh, vạch bụng lên. Nó bảo: em phơi chữ trong bụng ạ.`, choices: [
        [`Is there much in there?|Trong ấy có nhiều chữ không?`, `Two times tables and a great deal of Hugo’s bread. Both are well aired now.|Có hai bảng cửu chương và rất nhiều bánh mì của Hugo. Cả hai đều khô thơm rồi.`],
        [`Clever boy|Cậu bé thông minh đấy`, `I told him it is an old scholar’s trick. He says he invented it at lunch.|Tôi bảo nó đấy là mẹo của một ông trạng ngày xưa. Nó cãi là nó mới nghĩ ra lúc ăn trưa.`, 'b'],
        [`Did you join him?|Cô có nằm phơi cùng không?`, `I did. For education. Ten minutes, both sides.|Có chứ. Vì sự nghiệp giáo dục. Mười phút, trở đều hai mặt.`, 'b'],
      ] },
      b: { say: `Then the whole class lay down to air their brains. How do I mark that?|Thế rồi cả lớp lăn ra phơi chữ cùng. Tiết ấy tôi chấm điểm kiểu gì bây giờ?`, choices: [
        [`Full marks, well aired|Mười điểm, phơi rất đều`, `Done. The books get a mark too. They behaved best of all.|Chốt. Mấy quyển sách cũng được điểm. Chúng nó ngoan nhất lớp.`],
        [`Homework: turn over|Bài về nhà: lật mặt bên kia`, `Set and finished on the spot. The first homework this year with no excuses.|Giao xong là làm xong tại chỗ. Bài tập đầu tiên trong năm không ai xin khất.`],
        [`Mark it at nap time|Chấm vào giờ ngủ trưa`, `I marked it with my eyes closed. A very fair method.|Tôi nhắm mắt mà chấm. Cách ấy công bằng lắm.`],
      ] },
    } },
    { id: 'cora-night-marking', when: { night: true }, nodes: {
      a: { say: `Come in, mind my slippers. I am marking. Kit’s homework says “the crow took it”, and there is a beak hole in the page.|Vào đi, coi chừng đôi dép bông của tôi. Tôi đang chấm bài. Bài của Kit ghi “quạ tha mất rồi ạ”, và trên giấy có một lỗ mỏ thật.`, choices: [
        [`Believe him|Cô cứ tin em ấy`, `I do. The crow handed in the other half. Neater handwriting, too.|Tin chứ. Con quạ đem nộp nửa còn lại rồi. Chữ nó còn sạch hơn.`, 'b'],
        [`A classic excuse|Lý do kinh điển`, `Elsewhere it is “the dog ate it”. Here it is “Biscuit ate it”, and here it is always true.|Xứ khác thì “chó nhai mất vở”. Ở đây là “Biscuit ăn mất vở”, mà ở đây thì lần nào cũng thật.`, 'b'],
        [`Give the crow a mark|Cho con quạ điểm đi`, `Seven out of ten. It lost three for theft.|Bảy điểm. Trừ ba điểm vì tội ăn trộm.`, 'b'],
      ] },
      b: { say: `Last book. I asked “How long is a week?” and Pip wrote “Depends if it is raining.” Tick or cross?|Quyển cuối. Tôi hỏi “Một tuần dài bao lâu?”, Pip viết “Còn tuỳ trời có mưa không ạ.” Đúng hay sai đây?`, choices: [
        [`Tick. Rainy weeks are longer|Đúng. Tuần mưa dài hơn thật`, `A tick it is. I will add a small sun, to save Faye the trouble.|Vậy cho đúng. Tôi vẽ thêm một mặt trời nhỏ, đỡ cho Faye một việc.`],
        [`Wrong, but wise|Sai, nhưng khôn`, `Then a tick and a half. I invented that mark tonight. Slippers give me courage.|Thế thì một dấu đúng rưỡi. Điểm này tôi mới chế tối nay. Đi dép bông vào là tôi bạo hẳn.`],
        [`Go to bed, Cora|Đi ngủ thôi, cô Cora`, `The wisest answer I have marked today. Kettle off, red pen down. Sleep well, leader.|Câu trả lời khôn nhất hôm nay đấy. Tắt ấm, hạ bút đỏ. Trưởng làng ngủ ngon nhé.`],
      ] },
    } },
  ],
  pip: [
    { id: 'pip-family-picture', nodes: {
      a: { say: `Ms Cora said draw our family. I drew the hens first. Now there is no room for people. Are you sad?|Cô Cora bảo vẽ gia đình. Con vẽ gà trước. Giờ hết chỗ vẽ người rồi. Nhà mình có buồn không?`, choices: [
        [`Where am I, then?|Thế còn chỗ nào cho người lớn?`, `You are behind the big hen. You are waving. Nobody can see it, but I know.|Đứng sau con gà to nhất ạ. Đang vẫy tay đấy. Không ai thấy đâu, nhưng con biết.`, 'b'],
        [`Draw us on the back|Vẽ người ở mặt sau đi con`, `The back has more hens. It is a two-sided family.|Mặt sau cũng toàn gà rồi. Nhà mình là gia đình hai mặt.`],
        [`I love it|Bức này đẹp lắm`, `I knew it. Ms Cora called it “bold”. That means big.|Con biết ngay mà. Cô Cora khen là “táo bạo”. Nghĩa là to đấy.`, 'b'],
      ] },
      b: { say: `Can we keep a chicken that big at home? It would only need the kitchen.|Nhà mình nuôi một con gà to thế này được không? Nó chỉ cần mỗi cái bếp thôi.`, choices: [
        [`Ask Grandma Ada first|Con hỏi cụ Ada trước đã`, `She said ask you. So that is two yeses. I counted.|Cụ Ada bảo về hỏi nhà mình. Vậy là hai người đồng ý rồi. Con đếm rồi.`],
        [`Only on paper|Chỉ nuôi trên giấy thôi`, `Okay. But a paper chicken needs a bigger paper.|Vâng ạ. Nhưng gà giấy thì phải có tờ giấy to hơn.`],
        [`Then where do we cook?|Thế nấu cơm ở đâu?`, `Outside! Harvest supper every day. I solved it.|Ngoài sân! Ngày nào cũng là tiệc mùa gặt. Con giải xong rồi đấy.`],
      ] },
    } },
    { id: 'pip-five-sweets', when: { rain: false }, nodes: {
      a: { say: `Ms Cora asked: Pip has five sweets, Wren asks for two, how many are left? I said five. Is that wrong?|Cô Cora hỏi: Pip có năm cái kẹo, Wren xin hai cái, còn mấy cái? Con bảo còn năm. Thế là sai ạ?`, choices: [
        [`It is three, love|Còn ba chứ con`, `But nobody said I gave them! Asking is not getting.|Nhưng đã ai bảo là con cho đâu! Xin thì đã chắc gì được.`, 'b'],
        [`Five is right|Năm là đúng rồi`, `Thank you! Ms Cora laughed so much she had to sit down.|Con cảm ơn! Cô Cora cười đến nỗi phải ngồi xuống ghế.`, 'b'],
        [`Did you share with Wren?|Thế con có chia cho Wren không?`, `After school, yes. I gave her three. So I am bad at sums and good at Wren.|Tan học thì có ạ. Con cho bạn ấy ba cái. Vậy là con kém toán mà giỏi môn Wren.`, 'b'],
      ] },
      b: { say: `Now you. If you had five sweets and I asked for two, how many would you have left?|Giờ đến lượt nhà mình. Có năm cái kẹo, con xin hai cái, thì còn mấy cái?`, choices: [
        [`None. You would get all five|Không cái nào. Cho con cả năm`, `That is the wrong sum too! I will tell Ms Cora it runs in the family.|Thế cũng sai toán rồi! Con sẽ thưa cô Cora là cả nhà mình giống nhau.`],
        [`Three|Còn ba`, `Correct. One mark. You may sit at my desk tomorrow.|Đúng. Một điểm. Mai được ngồi bàn của con nhé.`],
        [`Five. I would hide them|Còn năm. Giấu đi hết`, `I know where. The blue tin. I am not saying how I know.|Con biết giấu ở đâu. Cái hộp sắt màu xanh. Con không nói vì sao con biết đâu.`],
      ] },
    } },
  ],
  wren: [
    { id: 'wren-pencil-tree', nodes: {
      a: { say: `I planted my pencil in the school garden. Ms Cora says pencils do not grow. But it is made of tree.|Cháu trồng cái bút chì ở vườn trường rồi. Cô Cora bảo bút chì không mọc được. Nhưng nó làm bằng cây mà.`, choices: [
        [`It might grow|Biết đâu nó mọc`, `I water it at break. Uncle Oren says water is the secret. He did not say what for.|Ra chơi cháu tưới đấy ạ. Chú Oren bảo nước là bí quyết. Chú không bảo bí quyết của cái gì.`, 'b'],
        [`A pencil is not a seed|Bút chì đâu phải hạt giống`, `The pencil thinks so too. I am waiting for it to change its mind.|Cái bút chì cũng nghĩ thế ạ. Cháu đang chờ nó nghĩ lại.`, 'b'],
        [`What do you write with now?|Thế giờ cháu viết bằng gì?`, `Pip’s pencil. Only until mine has babies.|Bút của Pip ạ. Chỉ mượn đến khi bút cháu đẻ con thôi.`],
      ] },
      b: { say: `When the pencil tree comes up, who gets the first pencil?|Khi cây bút chì mọc lên, ai được cái bút đầu tiên ạ?`, choices: [
        [`You, the gardener|Cháu, người trồng cây`, `Okay. The second is for Ms Cora. For ticks only, no crosses.|Vâng ạ. Cái thứ hai tặng cô Cora. Chỉ để chấm đúng thôi, không chấm sai.`],
        [`The whole class|Cả lớp`, `Then I have to plant the rubber too. For the mistakes.|Thế thì cháu phải trồng cả cục tẩy nữa. Để tẩy chỗ sai.`],
        [`The crow|Con quạ`, `No! A pencil is not shiny. I checked. We are safe.|Không! Bút chì không lấp lánh. Cháu xem kỹ rồi. An toàn ạ.`],
      ] },
    } },
    { id: 'wren-goat-homework', when: { rain: false }, nodes: {
      a: { say: `Biscuit ate my homework. Mum says it is true. Ms Cora says bring the goat as proof. Can a goat come to school?|Biscuit ăn mất bài tập của cháu. Mẹ cháu bảo thật đấy. Cô Cora bảo dắt dê đến làm chứng. Dê đi học được không ạ?`, choices: [
        [`If he sits nicely|Ngồi ngoan thì được`, `He sat. Then he ate the register. So now nobody is here, officially.|Nó ngồi ngoan ạ. Xong nó ăn sổ điểm danh. Thế là hôm nay cả lớp vắng mặt.`, 'b'],
        [`Goats cannot read|Dê có biết đọc đâu`, `He can a bit. He only eats the pages with right answers.|Biết một tí ạ. Nó chỉ ăn những trang làm đúng thôi.`],
        [`Was it tasty homework?|Bài tập ngon lắm à?`, `It was sums about carrots. I think that is why.|Bài toán về cà rốt ạ. Cháu nghĩ là tại thế.`, 'b'],
      ] },
      b: { say: `Ms Cora gave Biscuit a mark for my homework. Guess what she got.|Cô Cora chấm điểm bài tập cho Biscuit luôn. Cô chú đoán xem nó được mấy?`, choices: [
        [`Ten out of ten|Mười điểm`, `No, eight. He ate the other two.|Không ạ, tám thôi. Hai điểm kia nó ăn mất rồi.`],
        [`A gold star|Một phiếu bé ngoan`, `He ate that first. So he is a good boy on the inside now.|Cái đấy nó ăn đầu tiên. Giờ nó ngoan từ trong bụng ngoan ra.`],
        [`He has to stay behind|Bị phạt ở lại sau giờ học`, `Yes! He likes it. Ms Cora reads to him and he listens with his mouth full.|Đúng ạ! Nó thích lắm. Cô Cora đọc sách, nó vừa nhai vừa nghe.`],
      ] },
    } },
  ],
  milo: [
    { id: 'milo-second-fastest', nodes: {
      a: { say: `I came second in the playground race. Second-fastest in Willowmere, again! Guess how many ran.|Cháu về nhì cuộc đua ở sân trường. Lại nhanh nhì Willowmere nhé! Cô chú đoán xem có mấy người chạy?`, choices: [
        [`Two?|Hai à?`, `Do not ask how many entered! But yes. And the other one was Kit on his invention.|Đừng hỏi có mấy người thi mà! Nhưng vâng. Người kia là Kit, cưỡi cái máy bạn ấy chế.`, 'b'],
        [`A hundred|Một trăm`, `Yes. Write that down. A hundred. You are my favourite grown-up.|Đúng ạ. Cô chú ghi lại đi. Một trăm. Cháu quý cô chú nhất làng.`],
        [`You and one hen|Cháu với một con gà`, `The hen had a head start. And wings. I told Ms Cora it is not fair.|Con gà được chạy trước. Lại còn có cánh. Cháu thưa cô Cora là không công bằng rồi.`, 'b'],
      ] },
      b: { say: `Ms Cora asks why I walk so slowly to school and run so fast home. What do I say?|Cô Cora hỏi sao cháu đi học thì chậm rì mà về nhà thì chạy như bay. Cháu trả lời sao ạ?`, choices: [
        [`Home is downhill|Vì đường về xuống dốc`, `Both ways are flat. But I will say it with a serious face.|Hai chiều đều phẳng lì ạ. Nhưng cháu sẽ nói với vẻ mặt thật nghiêm.`],
        [`The sign says go slow|Vì biển báo ghi đi chậm`, `Yes! “School: go slow.” I only obey the sign. I am very good.|Đúng rồi! “Trường học: đi chậm.” Cháu chỉ làm đúng biển báo. Cháu ngoan lắm.`],
        [`Supper is at home|Vì ở nhà có cơm tối`, `That is the true one. Do not tell her. She knows anyway. She cooks it.|Cái này mới là thật. Đừng mách cô nhé. Mà cô biết thừa. Cô nấu mà.`],
      ] },
    } },
    { id: 'milo-test-answers', when: { from: 9, to: 14 }, nodes: {
      a: { say: `Test question: name three farm animals. I wrote: a hen, another hen, and the first hen’s friend. Fair?|Đề kiểm tra: kể tên ba con vật ở trang trại. Cháu viết: con gà, con gà nữa, và bạn của con gà đầu. Được chưa ạ?`, choices: [
        [`Three hens count|Ba con gà cũng tính`, `That is what I said! Ms Cora said “technically”. That is teacher for yes.|Cháu cũng bảo thế! Cô Cora nói “về lý thì đúng”. Tiếng cô giáo nghĩa là được.`, 'b'],
        [`You forgot the cow|Cháu quên con bò rồi`, `The cow was not in the room. I only write what I can see from my chair.|Con bò có ở trong lớp đâu ạ. Cháu chỉ viết cái gì ngồi ở ghế nhìn thấy thôi.`],
        [`What about Biscuit?|Thế còn Biscuit?`, `Biscuit is not a farm animal. She is a market animal. That is where she eats.|Biscuit không phải con vật trang trại. Nó là con vật ở chợ. Nó ăn ở đấy mà.`, 'b'],
      ] },
      b: { say: `Next question: what comes after seven? I wrote “supper”. Because it does.|Câu sau: sau bảy là gì? Cháu viết “cơm tối”. Vì đúng thế mà.`, choices: [
        [`It is eight|Sau bảy là tám chứ`, `Eight is when I am in bed. I live with the teacher. I know all the times.|Tám giờ là lúc cháu lên giường ạ. Cháu ở chung nhà với cô giáo. Giờ nào cháu cũng thuộc.`],
        [`Supper is correct|Cơm tối là đúng`, `Thank you. I will tell Ms Cora the village leader said so. That makes it a rule.|Cháu cảm ơn. Cháu sẽ thưa cô Cora là trưởng làng bảo thế. Vậy là thành luật rồi.`],
        [`Pudding comes after|Sau bữa tối là món chè`, `Oh. Oh, that is a better answer. Can I borrow a pencil?|Ơ. Ơ, câu ấy hay hơn. Cô chú cho cháu mượn cái bút chì với?`],
      ] },
    } },
    { id: 'milo-bedtime', when: { night: true }, nodes: {
      a: { say: `Shh. Ms Cora says it is bedtime. I say bedtime is a race, and I always come second. So who goes first?|Suỵt. Cô Cora bảo đến giờ ngủ rồi. Cháu bảo đi ngủ là một cuộc đua, mà cháu thì luôn về nhì. Vậy ai đi ngủ trước ạ?`, choices: [
        [`Ms Cora goes first|Cô Cora ngủ trước`, `Yes! She is the fastest, so she goes to bed. I am second-fastest. Much later.|Đúng! Cô nhanh nhất thì cô đi ngủ trước. Cháu nhanh nhì. Lâu nữa mới tới lượt.`, 'b'],
        [`The cat|Con mèo`, `We have no cat. Officer Pearl has the cat. I would have to wait for it. Could be hours.|Nhà cháu không có mèo. Mèo ở đồn cô Pearl cơ. Cháu phải chờ nó sang. Chắc mấy tiếng.`, 'b'],
        [`You, right now|Cháu, ngay bây giờ`, `That is what she said. You two have been practising.|Cô Cora cũng nói y hệt. Hai người tập với nhau trước rồi.`, 'b'],
      ] },
      b: { say: `Five more minutes? I will pay them back with five minutes of spelling tomorrow.|Cho cháu thêm năm phút nhé? Mai cháu trả bằng năm phút chính tả.`, choices: [
        [`Deal. Spell “bed”|Được. Đánh vần chữ “ngủ” đi`, `B, E, D. Oh no. That was a trap. Good night.|Ngờ, u, ngu, hỏi, ngủ. Ôi không. Cháu bị lừa rồi. Chúc cô chú ngủ ngon.`],
        [`Ask Ms Cora|Hỏi cô Cora ấy`, `She says no before I finish asking. She is very fast. That is why she is first.|Cháu chưa hỏi xong cô đã bảo không. Cô nhanh lắm. Thế nên cô mới về nhất.`],
        [`Two minutes, final offer|Hai phút, không mặc cả`, `Three? No? Two and a story? No? Two. You are as tough as her. Night night.|Ba ạ? Không ạ? Hai phút với một chuyện kể? Không ạ? Thôi hai. Cô chú rắn y như cô Cora. Cháu đi ngủ đây.`],
      ] },
    } },
  ],
  kit: [
    { id: 'kit-soup-sharpener', nodes: {
      a: { say: `My school project is a pencil sharpener that runs on pumpkin soup. It works! It just smells like lunch. Want to see?|Bài dự án của cháu là cái gọt bút chì chạy bằng súp bí ngô. Chạy được nhé! Chỉ có điều nó thơm mùi bữa trưa. Cô chú xem không?`, choices: [
        [`Yes, show me|Có, cho xem nào`, `Stand back. No, further. Milo stood there and now he is orange.|Cô chú lùi ra ạ. Chưa, lùi nữa. Milo đứng đúng chỗ đấy và giờ bạn ấy màu cam.`, 'b'],
        [`Does it sharpen?|Nó gọt được thật không?`, `It sharpens one end and cooks the other. Two jobs. Dad calls that efficiency.|Nó gọt một đầu, nấu chín đầu kia. Một máy hai việc. Bố cháu gọi thế là hiệu suất.`, 'b'],
        [`May I taste the fuel?|Cho nếm thử nhiên liệu nhé?`, `Ms Cora already did. That is why it stopped. She said it needed salt.|Cô Cora nếm rồi ạ. Thế nên máy mới hết xăng. Cô bảo hơi nhạt muối.`],
      ] },
      b: { say: `What should I invent next for the class?|Cháu nên chế cái gì tiếp cho lớp ạ?`, choices: [
        [`A homework machine|Máy làm bài tập`, `I made one. It did my homework and got it wrong. So it works exactly like me. Success!|Cháu chế rồi. Nó làm bài hộ cháu và làm sai. Tức là nó chạy giống hệt cháu. Thành công!`],
        [`A bell that rings early|Cái trống tự đánh sớm`, `Ms Cora heard that. She is looking at you. Now she is looking at me. Run.|Cô Cora nghe thấy rồi. Cô đang nhìn cô chú. Giờ cô nhìn sang cháu. Chạy thôi ạ.`],
        [`A goat-proof gate|Cái cổng chống dê`, `Impossible. Dad and I tried. Biscuit helped with the testing. She ate the plans.|Chịu ạ. Bố con cháu thử rồi. Biscuit giúp phần thử nghiệm. Nó ăn luôn bản vẽ.`],
      ] },
    } },
    { id: 'kit-dads-pen', nodes: {
      a: { say: `Ms Cora asked why my homework is in Dad’s handwriting. I said I used his pen. Good answer?|Cô Cora hỏi sao bài tập của cháu lại là chữ của bố. Cháu bảo tại cháu mượn bút của bố. Trả lời thế được không ạ?`, choices: [
        [`Very quick thinking|Nhanh trí lắm`, `Thanks. Then she asked why it smells of engine oil. I said it is a hard-working pen.|Cháu cảm ơn. Xong cô hỏi sao vở có mùi dầu máy. Cháu bảo tại cái bút ấy chăm làm.`, 'b'],
        [`Did your dad help you?|Bố cháu giúp à?`, `Only a bit. The wrong answers I managed all by myself.|Một tí thôi ạ. Mấy câu sai là cháu tự làm hết, không ai giúp.`, 'b'],
        [`Best tell the truth|Nói thật là hơn`, `I did, after. She gave Dad four out of ten and a note: “Must try harder.”|Sau đấy cháu nói thật rồi ạ. Cô cho bố cháu bốn điểm, phê: “Cần cố gắng hơn.”`, 'b'],
      ] },
      b: { say: `Now Dad has corrections to do. Should I help him?|Giờ bố cháu phải chữa bài. Cháu có nên giúp bố không ạ?`, choices: [
        [`Yes, be kind|Có, giúp bố đi`, `I will explain the sevens. He can fix a jeep, but seven times eight frightens him.|Cháu sẽ giảng bảng bảy cho bố. Xe jeep bố chữa được, nhưng bảy nhân tám thì bố sợ.`],
        [`Let him learn|Để bố tự học`, `That is what he says to me! I will say it back, in his voice.|Bố toàn nói câu ấy với cháu! Cháu sẽ nói lại, bằng đúng giọng của bố.`],
        [`One motorbike ride per sum|Mỗi phép tính đổi một vòng xe máy`, `Brilliant. I will write the contract. With his pen.|Tuyệt quá. Cháu sẽ viết hợp đồng. Bằng bút của bố.`],
      ] },
    } },
  ],
  faye: [
    { id: 'faye-twelve-suns', nodes: {
      a: { say: `I finished my sums. Ms Cora says the answers are wrong but the suns are lovely. I signed every one.|Cháu làm xong bài toán rồi. Cô Cora bảo đáp số sai, nhưng mặt trời thì đẹp. Câu nào cháu cũng ký một mặt trời.`, choices: [
        [`How many suns?|Bao nhiêu mặt trời?`, `Twelve sums, twelve suns. If you count the suns, I got twelve. That is full marks.|Mười hai phép tính, mười hai mặt trời. Đếm mặt trời thì cháu được mười hai. Hơn cả điểm mười.`, 'b'],
        [`Sums need numbers|Toán thì phải có số chứ`, `My seven has a hat and my eight is a snowman. They are still numbers. Just happy ones.|Số bảy của cháu đội mũ, số tám là người tuyết. Vẫn là số ạ. Số vui thôi.`, 'b'],
        [`Sign one for me|Ký tặng một cái nhé`, `There. That is a morning sun. An afternoon one takes more smiling.|Đây ạ. Đấy là mặt trời buổi sáng. Mặt trời buổi chiều thì phải cười nhiều hơn mới vẽ được.`],
      ] },
      b: { say: `Ms Cora asked me to draw two plus two. Guess what I drew.|Cô Cora bảo cháu vẽ hai cộng hai. Cô chú đoán xem cháu vẽ gì?`, choices: [
        [`Four|Số bốn`, `Four hens! Pip helped. So it is very big. It is on the wall, and a bit of the door.|Bốn con gà! Pip vẽ cùng. Nên nó to lắm. Nó ở trên tường, lấn sang cửa một tí.`],
        [`Two suns, twice|Hai mặt trời, hai lần`, `Yes! Then the room was so bright that everybody could see the answer.|Đúng ạ! Thế là lớp sáng trưng, bạn nào cũng nhìn rõ đáp số.`],
        [`Fish|Mấy con cá`, `How did you know? Two fish and two fish. Grandpa Ellis says there were ten, and huge.|Sao cô chú biết? Hai con cá với hai con cá. Ông Ellis bảo phải là mười con, mà to đùng.`],
      ] },
    } },
    { id: 'faye-window-sun', when: { rain: true }, nodes: {
      a: { say: `It is raining, so I drew a sun on the window. Now our classroom has good weather. Is that allowed?|Trời mưa nên cháu vẽ mặt trời lên cửa sổ. Giờ lớp cháu đẹp trời rồi. Thế có được phép không ạ?`, choices: [
        [`Allowed. It is art|Được. Đấy là nghệ thuật`, `Ms Cora said so too. Then she asked me to draw one on her Monday.|Cô Cora cũng bảo thế. Rồi cô nhờ cháu vẽ một cái lên ngày thứ Hai của cô.`, 'b'],
        [`It will wash off|Rồi nó sẽ trôi mất thôi`, `That is okay. Suns go away at night anyway. Mine is just like a real one.|Không sao ạ. Mặt trời nào tối chả lặn. Của cháu giống y mặt trời thật.`, 'b'],
        [`Add a rainbow|Vẽ thêm cầu vồng đi`, `A rainbow needs rain and sun. Oh. I have both! Wait there.|Cầu vồng thì phải có cả mưa cả nắng. Ơ. Cháu có đủ rồi! Cô chú đứng đấy nhé.`],
      ] },
      b: { say: `What colour is rain? I have to colour it in and I only have yellow left.|Mưa màu gì ạ? Cháu phải tô mưa mà chỉ còn mỗi bút vàng.`, choices: [
        [`Blue|Màu xanh`, `No blue left. Pip used it all on one hen. A very big, very blue hen.|Hết màu xanh rồi ạ. Pip tô hết vào một con gà. Một con gà rất to, rất xanh.`],
        [`Yellow rain is fine|Mưa vàng cũng được`, `Then it is raining sunshine. Ms Cora will call it “bold”. That means good.|Thế là trời mưa ra nắng. Cô Cora sẽ khen “táo bạo”. Nghĩa là đẹp đấy ạ.`],
        [`Leave it white|Cứ để trắng`, `Invisible rain! That is the wettest kind. You are good at art.|Mưa tàng hình! Loại ấy ướt nhất đấy. Cô chú giỏi mỹ thuật ghê.`],
      ] },
    } },
  ],
  '@parent': [
    { id: 'parent-in-the-hall', nodes: {
      a: { say: `I am waiting for Ms Cora. I have not stood in this hall since I was small, and I still feel I am in trouble. Do you?|Tôi đang chờ cô Cora. Từ hồi bé tí đến giờ tôi mới lại đứng ở hành lang này, mà vẫn thấy như sắp bị phạt. Bạn có thế không?`, choices: [
        [`Always, in here|Vào đây là thấy thế`, `It is the coat pegs. They sit at knee height and they judge you.|Tại mấy cái móc treo áo đấy. Chúng nó cao ngang đầu gối mà nhìn mình như chấm hạnh kiểm.`, 'b'],
        [`No, I was good|Không, hồi đó tôi ngoan lắm`, `So was I. That is what we all say, out here in the hall.|Tôi cũng ngoan. Ai đứng ngoài hành lang này cũng nói đúng câu ấy.`],
        [`What did you do?|Bạn đã làm gì nào?`, `Nothing! Which is exactly what I said back then, too.|Có làm gì đâu! Mà hồi đó tôi cũng trả lời đúng y như vậy.`, 'b'],
      ] },
      b: { say: `The note says “a quick word about the homework”. Whose homework do you think she means?|Giấy mời ghi “trao đổi nhanh về bài tập về nhà”. Bạn nghĩ cô nói bài tập của ai?`, choices: [
        [`The child’s|Của đứa nhỏ`, `I hope so. I helped with it, you see. Oh. Oh dear.|Mong là thế. Bài đó tôi có làm giúp mà. Ơ. Thôi chết.`],
        [`Yours|Của bạn`, `I knew it. I got the carrot sum wrong. There were simply too many carrots.|Biết ngay mà. Tôi làm sai bài toán cà rốt. Tại cà rốt nhiều quá chứ.`],
        [`Biscuit’s|Của Biscuit`, `That goat has a better record here than I ever had. Wish me luck.|Con dê ấy có học bạ ở đây còn đẹp hơn tôi ngày xưa. Chúc tôi may mắn đi.`],
      ] },
    } },
    { id: 'parent-kind-of-chicken', nodes: {
      a: { say: `My little one asked what a word in the schoolbook meant. I did not know. I said it was a kind of chicken. Was that wrong?|Đứa nhỏ nhà tôi hỏi một chữ trong sách nghĩa là gì. Tôi không biết. Tôi bảo đấy là một giống gà. Thế có sai không?`, choices: [
        [`What was the word?|Chữ gì thế?`, `“Isosceles.” It does sound like a chicken. A proud one, with long legs.|“Tam giác cân.” Nghe đúng là con gà ba góc đang đứng lên cân còn gì.`, 'b'],
        [`Honesty is best|Thật thà vẫn hơn`, `It is. I will be honest tomorrow. Tonight it is a chicken.|Đúng thế. Mai tôi sẽ thật thà. Còn tối nay nó cứ là con gà đã.`],
        [`Here, everything is a chicken|Ở đây cái gì chả là gà`, `That is Pip’s doing. Her hens have got into everybody’s homework.|Tại Pip cả đấy. Gà của bé chui vào bài tập của cả lớp rồi.`, 'b'],
      ] },
      b: { say: `Now the whole class is chanting it. Do I tell Ms Cora, or wait and see?|Giờ cả lớp đang đọc đồng thanh như thế. Tôi nên thưa thật với cô Cora, hay cứ chờ xem sao?`, choices: [
        [`Tell her now|Nói ngay đi`, `Right. Deep breath. “Ms Cora, about the triangle chicken…” No. You go first.|Được. Hít sâu nào. “Thưa cô Cora, về con gà tam giác…” Thôi. Bạn nói trước đi.`],
        [`Wait and see|Cứ chờ xem`, `Good. Give it three generations and it is a tradition, and nobody blames me.|Hay. Chờ đủ ba đời là thành truyền thống, lúc ấy chẳng ai trách tôi nữa.`],
        [`Ask Grandma Ada|Hỏi bà Ada`, `Ada would say it is a chicken, feed it a handful, and carry on. I like her method.|Bà Ada sẽ bảo: gà thì cho nó một vốc thóc, rồi làm việc tiếp. Tôi thích cách của bà.`],
      ] },
    } },
    { id: 'parent-june-report', when: { who: 'june' }, nodes: {
      a: { say: `You came too? Pip’s report says “a joy, and loud”. I think the loud is from your side.|Mình cũng đến à? Sổ liên lạc của Pip ghi “đáng yêu, và to tiếng”. Em nghĩ phần to tiếng là giống bên mình.`, choices: [
        [`The joy is mine|Phần đáng yêu là giống bên này`, `And the loud? Do not look at the ceiling.|Thế còn phần to tiếng? Mình đừng có nhìn lên trần nhà.`, 'b'],
        [`The loud is yours|Phần to tiếng là giống bên đó nhé`, `I am not loud, I am clear. The kettle is loud. I only keep it warm.|Em không to tiếng, em nói rõ ràng. To tiếng là cái ấm nước. Em chỉ giữ cho nó ấm thôi.`, 'b'],
        [`Both are Grandpa Ellis|Cả hai đều giống ông Ellis`, `True. His fish stories are a joy, and they get louder every year.|Chuẩn. Chuyện câu cá của ông đáng yêu lắm, mà mỗi năm một to hơn.`],
      ] },
      b: { say: `Ms Cora wants one of us to help with reading week. Which of us is braver?|Cô Cora nhờ một trong hai đứa mình giúp tuần lễ đọc sách. Mình với em, ai gan hơn?`, choices: [
        [`I will go|Để mình đi`, `My hero. It goes in the family album: “Went back to school, on purpose.”|Anh hùng của em. Em sẽ chép vào album gia đình: “Tự nguyện quay lại trường.”`],
        [`You do better voices|June giả giọng giỏi hơn`, `I do a fine goat. All right. But you are doing the hen.|Giọng dê thì em giả khéo thật. Được. Nhưng mình phải đóng vai gà mái.`],
        [`Send Biscuit|Cử Biscuit đi`, `She would eat chapter one. Come on, we go together and share the small chair.|Nó sẽ ăn mất chương một. Thôi, hai đứa mình cùng đi, ngồi chung cái ghế bé.`],
      ] },
    } },
    { id: 'parent-mara-show-and-tell', when: { who: 'mara' }, nodes: {
      a: { say: `I am here about Wren. She brought a hen for show and tell. Then another. Ms Cora counted six before lunch.|Tôi đến vì chuyện bé Wren. Bé mang một con gà đến giờ kể chuyện. Rồi con nữa. Chưa tới trưa cô Cora đã đếm được sáu con.`, choices: [
        [`Did the hens behave?|Lũ gà có ngoan không?`, `Better than the class. One laid an egg in the chalk box. Ms Cora called it a contribution.|Ngoan hơn cả lớp. Một con đẻ trứng vào hộp phấn. Cô Cora gọi đấy là đóng góp xây dựng bài.`, 'b'],
        [`Like mother, like daughter|Mẹ nào con nấy`, `I only ever brought a goat. Once. The school has still not forgiven him.|Hồi bé tôi chỉ mang mỗi con dê đến trường. Đúng một lần. Đến giờ trường vẫn chưa tha cho nó.`, 'b'],
        [`Hens need schooling too|Gà cũng cần đi học`, `They can count to one. That is one more than Biscuit will admit to.|Chúng nó đếm được đến một. Hơn Biscuit một số, nếu Biscuit chịu khai thật.`],
      ] },
      b: { say: `Wren has also planted her pencil in the school garden. Do I tell her it will not grow?|Bé Wren còn đem bút chì ra trồng ở vườn trường. Tôi có nên bảo bé là nó không mọc không?`, choices: [
        [`Let her hope|Cứ để bé hy vọng`, `I will. Pip planted a wish beside it. Between the two of them, something is coming up.|Vâng. Pip trồng một điều ước ngay bên cạnh. Hai đứa chung sức thế, thể nào cũng mọc ra cái gì đó.`],
        [`Plant a real seed there|Lén gieo một hạt thật vào đó`, `Sneaky. A sunflower by the weekend, and a small girl who believes in pencils. Done.|Ranh thật. Cuối tuần có cây hướng dương, và một cô bé tin vào bút chì. Chốt.`],
        [`Ask Oren|Hỏi Oren xem`, `He will say water is the secret. He says it about soup as well. Thank you, neighbour.|Anh ấy sẽ bảo nước là bí quyết. Nấu canh anh ấy cũng bảo thế. Cảm ơn bạn hàng xóm nhé.`],
      ] },
    } },
  ],
};
