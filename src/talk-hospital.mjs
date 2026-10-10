// Conversations by choice in the Village Clinic: Hazel the nurse, Sylvie the doctor, and the villagers in the waiting room.
export default {
  hazel: [
    { id: 'hazel-hiccups', nodes: {
      a: { say: `I once had the hiccups for three days. The village gave me fourteen cures. Guess which one I tried first.|Có lần tôi nấc cụt ba ngày liền. Cả làng mách cho mười bốn mẹo chữa. Đố bạn tôi thử mẹo nào trước.`, choices: [
        [`Holding your breath|Nín thở`, `Ellis held his too, to show me how. For a minute I nearly had two patients.|Ông Ellis nín theo để làm mẫu. Suýt nữa tôi có thêm một bệnh nhân.`, 'b'],
        [`A good fright|Hù cho giật mình`, `Kit jumped out and shouted BOO. I hiccuped louder, and he was the one who needed a sit down.|Cậu Kit nhảy ra hét “Hù!”. Tôi nấc to hơn, còn cậu ấy mới là người phải ngồi nghỉ.`, 'b'],
        [`Drinking upside down|Uống nước lộn ngược`, `I watered the ceiling, my left ear and one surprised cat. The hiccups stayed perfectly dry.|Tôi tưới ướt trần nhà, tai trái và một con mèo đang ngơ ngác. Riêng cơn nấc vẫn khô ráo.`, 'b'],
      ] },
      b: { say: `What worked in the end? I forgot I had them. So, what do I prescribe for hiccups now?|Cuối cùng khỏi nhờ đâu? Tôi quên béng là mình đang nấc. Vậy đố bạn giờ tôi kê gì cho người bị nấc?`, choices: [
        [`Forgetting|Kê “hãy quên đi”`, `Correct. It is the hardest medicine of all: nobody can take it on purpose.|Đúng rồi. Thuốc này khó uống nhất đời: càng cố uống càng nhớ.`],
        [`A spoon of sugar|Một thìa đường`, `That one is for people I like. It does nothing at all, but nobody has ever complained.|Món đó tôi để dành cho người tôi quý. Chẳng chữa được gì, nhưng chưa ai phàn nàn bao giờ.`],
        [`All fourteen at once|Cả mười bốn mẹo cùng lúc`, `Then you would have hiccups and a wet ceiling. Rest is part of growing, and so is giving up gracefully.|Thế thì vừa nấc vừa ướt trần nhà. Nghỉ ngơi cũng là lớn lên, mà biết bỏ cuộc cho duyên cũng vậy.`],
      ] },
    } },
    { id: 'hazel-checkup', when: { fresh: 'hospital' }, nodes: {
      a: { say: `Welcome to the clinic. How are you feeling today? Honest answers only, the chart can always tell.|Chào bạn đến trạm xá. Hôm nay bạn thấy trong người thế nào? Nói thật nhé, sổ khám biết hết đấy.`, choices: [
        [`Fine, I think|Ổn, chắc vậy`, `“Fine, I think” is my favourite ailment. One check-up cures the “I think”.|“Ổn, chắc vậy” là bệnh tôi thích nhất. Khám một lượt là hết ngay chữ “chắc”.`, '', 'checkup'],
        [`Everything hurts when I poke it|Tôi ấn vào đâu cũng đau`, `Knee, shoulder, nose, all sore? Friend, that is one sore finger. Have you been pulling radishes?|Đầu gối, vai, mũi, chỗ nào cũng đau à? Bạn ơi, vậy là đau ngón tay rồi. Mới nhổ củ cải phải không?`, 'b'],
        [`I came for the nice chairs|Tôi đến vì ghế ở đây êm`, `They are nice chairs. Sit. I shall ask again in a softer voice.|Ghế êm thật. Mời ngồi. Để tôi hỏi lại bằng giọng êm hơn.`, 'b'],
      ] },
      b: { say: `Shall Sylvie take a proper look? It takes a moment, and I warmed the stethoscope in my cardigan pocket.|Để bác sĩ Sylvie khám kỹ cho bạn nhé? Nhanh thôi, ống nghe tôi đã ủ ấm trong túi áo len rồi.`, choices: [
        [`Yes please, nurse|Vâng, nhờ chị`, `Brave and sensible. Through you go, second door, the one with the very neat label.|Vừa gan dạ vừa biết điều. Mời vào, cửa thứ hai, cái cửa dán nhãn ngay ngắn nhất ấy.`, '', 'checkup'],
        [`Is there a sticker after?|Khám xong có được dán sao không?`, `For grown-ups there is a nod of approval. It is much rarer than a sticker. In you go.|Người lớn thì được một cái gật đầu khen. Hiếm hơn hình dán nhiều. Mời vào.`, '', 'checkup'],
        [`Later, the carrots are waiting|Để sau, cà rốt đang đợi`, `Carrots are patient, which is why they are never patients. Come back when you can.|Cà rốt giỏi chờ lắm, nên có bao giờ phải ngồi phòng chờ đâu. Lúc nào rảnh bạn ghé lại nhé.`],
      ] },
    } },
    { id: 'hazel-done', when: { done: 'hospital' }, nodes: {
      a: { say: `You again! Today’s check-up is done. Your chart says: one healthy neighbour, slightly muddy.|Lại là bạn! Hôm nay khám xong rồi mà. Sổ ghi rõ: một người hàng xóm khỏe mạnh, hơi lấm bùn.`, choices: [
        [`Can I have a second one?|Cho tôi khám thêm lần nữa?`, `A second check-up finds what the first one left behind: nothing. Greedy for good news, are we?|Khám lần hai chỉ tìm ra thứ lần một để sót: không có gì cả. Bạn tham tin vui quá nhỉ?`, 'b'],
        [`What does “slightly muddy” mean?|“Hơi lấm bùn” là bệnh gì?`, `A medical term. It means the farm is going well and the boots are doing their job.|Thuật ngữ y khoa đấy. Nghĩa là ruộng vườn đang tốt và đôi ủng làm tròn bổn phận.`, 'b'],
        [`I only came to say hello|Tôi chỉ ghé chào thôi`, `Hello is the best sort of visit. No forms, no thermometer, and I get to keep my pencil.|Ghé chào là kiểu khám tôi thích nhất. Không giấy tờ, không nhiệt kế, tôi khỏi mất cây bút chì.`],
      ] },
      b: { say: `The doctor is done with you, so now you are mine. Do you know the nurse’s orders?|Bác sĩ xong việc với bạn rồi, giờ đến lượt tôi. Bạn có biết y lệnh của y tá là gì không?`, choices: [
        [`Rest|Nghỉ ngơi`, `Rest is part of growing. Pumpkins lie down all day, and look at the size of them.|Nghỉ ngơi cũng là lớn lên. Bí ngô nằm cả ngày đấy, mà xem nó to chưa kìa.`],
        [`Eat my vegetables|Ăn nhiều rau`, `You grow them, so the hard half is done. Eating them is the easy half. Off you go.|Bạn trồng ra rau rồi, phần khó đã xong. Ăn là phần dễ. Thôi về đi nào.`],
        [`Wash behind my ears|Rửa sau vành tai`, `That order comes from your grandmother Ada, and she outranks me by forty years.|Lệnh đó là của bà Ada, mà bà thì hơn cấp tôi những bốn chục năm.`],
      ] },
    } },
    { id: 'hazel-ginger', when: { from: 13 }, nodes: {
      a: { say: `I know that walk. That is the afternoon droop. Tell the nurse: what did you have for lunch?|Tôi nhận ra dáng đi đó. Chứng “xế chiều rũ vai” đây mà. Khai thật với y tá: trưa nay bạn ăn gì?`, choices: [
        [`A proper lunch|Ăn đủ bữa đàng hoàng`, `Then it is honest tiredness, the best kind. Here, a ginger sweet. Small, but it argues back.|Vậy là mệt chính đáng, loại mệt tốt nhất. Đây, một viên kẹo gừng. Bé mà cay ra phết.`, '', 'energy'],
        [`I forgot lunch|Tôi quên ăn trưa`, `Forgot! A body is like the goat Biscuit: leave it unfed and it starts eating your plans.|Quên ăn! Cái bụng giống con dê Biscuit lắm: bỏ đói là nó gặm sạch mọi dự định của bạn.`, 'b'],
        [`Six of Hugo’s buns|Sáu cái bánh của anh Hugo`, `Then it is not a droop, it is ballast. You are a very well loaded boat.|Thế thì không phải rũ vai, mà là chở nặng. Bạn đang là chiếc thuyền đầy hàng đấy.`, 'b'],
      ] },
      b: { say: `My remedy is a cup of ginger tea and five minutes on that bench. Will you take it?|Bài thuốc của tôi: một tách trà gừng và năm phút ngồi trên cái ghế băng kia. Bạn chịu không?`, choices: [
        [`Yes, nurse|Vâng, thưa y tá`, `Good. Sip slowly. The tea does half the work and the sitting does the rest.|Ngoan. Nhấp từ từ thôi. Trà lo một nửa, ngồi yên lo nửa còn lại.`, '', 'energy'],
        [`Only five minutes?|Có năm phút thôi à?`, `Five. At six you turn into furniture and Fern tries to varnish you. Here is your tea.|Năm thôi. Sang phút thứ sáu bạn thành bàn ghế, chị Fern lại mang dầu bóng ra quét. Trà của bạn đây.`, '', 'energy'],
        [`I am too busy to rest|Tôi bận lắm, nghỉ sao được`, `Too busy to rest is how I got three days of hiccups. The bench will keep your place.|Bận không dám nghỉ, nên ngày xưa tôi mới nấc ba ngày đấy. Ghế băng vẫn giữ chỗ cho bạn.`],
      ] },
    } },
    { id: 'hazel-rain', when: { rain: true }, nodes: {
      a: { say: `Rain fills my waiting room. Seven neighbours, no ailments, one umbrella. What do you suppose they all have?|Cứ mưa là phòng chờ chật kín. Bảy người hàng xóm, không ai ốm, có đúng một cái ô. Đố bạn họ mắc chứng gì?`, choices: [
        [`A cold?|Cảm lạnh?`, `Not one sneeze. I listened. I even opened the pepper pot to make sure.|Không một tiếng hắt hơi. Tôi rình nghe rồi. Còn mở cả lọ tiêu ra thử cho chắc.`, 'b'],
        [`A need for gossip|Chứng thèm buôn chuyện`, `Chronic, that one. Bea brought it in at nine and by ten everybody had caught the news.|Bệnh mạn tính đấy. Chị Bea mang vào lúc chín giờ, mười giờ cả phòng đã lây hết tin tức.`, 'b'],
        [`Wet socks|Tất ướt`, `Correct! Treatment: the radiator. My radiator is wearing eleven socks. I am not asking about the twelfth.|Chuẩn! Cách chữa: lò sưởi. Lò sưởi nhà tôi đang mang mười một chiếc tất. Chiếc thứ mười hai tôi không dám hỏi.`],
      ] },
      b: { say: `So I wrote one prescription for the whole room. Guess what it says.|Thế là tôi kê luôn một đơn cho cả phòng. Đố bạn trong đơn viết gì.`, choices: [
        [`Tea, three times a day|Trà, ngày ba lần`, `Close. “Sit, steam gently, go home when dry.” The kettle is the pharmacy today.|Gần đúng. “Ngồi yên, bốc hơi nhè nhẹ, khô thì về.” Hôm nay ấm nước làm quầy thuốc.`],
        [`Go home|Mời về nhà`, `In this rain? I am a nurse, not a villain. It says: one chair each and be kind to the umbrella.|Giữa trời mưa thế này à? Tôi là y tá chứ đâu phải người ác. Đơn ghi: mỗi người một ghế, nhớ thương cái ô.`],
        [`Six more umbrellas|Thêm sáu cái ô nữa`, `One umbrella for seven is not medicine, it is a sum for Ms Cora. Stay dry in here a while.|Một cái ô chia bảy người thì không phải thuốc, mà là bài toán cho cô Cora. Bạn cứ ngồi đây cho khô đã.`],
      ] },
    } },
    { id: 'hazel-sun', when: { season: 'Summer' }, nodes: {
      a: { say: `Summer. Every nose in Willowmere is pink. I can tell who wore a hat by the nose alone. Did you?|Mùa hè rồi. Mũi cả làng Willowmere đỏ hồng. Nhìn mũi là tôi biết ai chịu đội mũ. Còn bạn?`, choices: [
        [`Yes, a big one|Có, mũ rộng vành hẳn hoi`, `Your nose agrees. Pale, proud and well behaved. A model nose. I may put it on a poster.|Cái mũi của bạn cũng khai thế. Trắng trẻo, ngoan ngoãn. Mũi gương mẫu, đáng in lên áp phích.`],
        [`The goat ate my hat|Con dê ăn mất mũ của tôi`, `Biscuit? That is her third hat this week. She is the best shaded goat in the valley, from the inside.|Biscuit hả? Cái mũ thứ ba trong tuần rồi. Nó là con dê được che nắng kỹ nhất vùng, che từ bên trong.`, 'b'],
        [`My nose likes the sun|Mũi tôi thích nắng mà`, `Your nose has no vote. It sticks out furthest, so it is always first into trouble.|Cái mũi không có quyền biểu quyết. Nó nhô ra xa nhất nên lúc nào cũng dính chuyện đầu tiên.`, 'b'],
      ] },
      b: { say: `The old remedy for a hot nose is a cool slice of cucumber on top. Shall I?|Mẹo xưa cho cái mũi cháy nắng: đắp một lát dưa chuột mát lên trên. Tôi đắp nhé?`, choices: [
        [`Go on then|Vâng, chị đắp đi`, `There. You look like a very calm salad. Keep it on as far as the door, at least.|Xong. Trông bạn như một đĩa gỏi rất điềm tĩnh. Ráng giữ nó ít nhất là tới cửa nhé.`],
        [`I would rather eat it|Tôi thích ăn nó hơn`, `Then it works from the inside. An unusual method. I shall write it down and blame you.|Vậy là chữa từ trong ra. Phương pháp lạ đấy. Tôi sẽ ghi vào sổ và đề tên bạn chịu trách nhiệm.`],
        [`Will people laugh?|Người ta có cười không?`, `Only kindly. Oren wore two yesterday and sold more cucumbers than he ever has.|Cười thương thôi. Hôm qua anh Oren đắp hai lát, thế là bán dưa chuột chạy nhất từ trước tới nay.`],
      ] },
    } },
    { id: 'hazel-night', when: { night: true }, nodes: {
      a: { say: `The clinic never really shuts. It just puts its slippers on. I am the night nurse, the day nurse and the cocoa nurse.|Trạm xá chẳng bao giờ đóng cửa thật. Nó chỉ đổi sang đi dép lê thôi. Tôi là y tá đêm, y tá ngày, kiêm y tá pha ca cao.`, choices: [
        [`What happens here at night?|Ban đêm ở đây có gì?`, `Mostly the kettle. Once, a hedgehog with no appointment. I saw him anyway.|Chủ yếu là tiếng ấm nước reo. Có lần một chú nhím đến không hẹn trước. Tôi vẫn tiếp.`, 'b'],
        [`Why are you still up?|Sao chị còn thức?`, `Somebody must listen in case a pumpkin carrier groans in the dark.|Phải có người thức nghe ngóng, lỡ nửa đêm có ai vác bí ngô rồi rên hừ hừ thì sao.`, 'b'],
        [`Nice slippers|Dép đẹp đấy`, `Thank you. The left one is Sylvie’s. We have stopped arguing about it and now share the pair.|Cảm ơn bạn. Chiếc bên trái là của Sylvie. Hai đứa thôi cãi nhau rồi, giờ đi chung một đôi.`],
      ] },
      b: { say: `Now the night nurse has a question of her own. Why are YOU awake?|Giờ đến lượt y tá đêm hỏi lại. Thế còn BẠN, sao giờ này chưa ngủ?`, choices: [
        [`I could not sleep|Tôi trằn trọc mãi`, `Count sheep. If Biscuit turns up in the line, start again. She always pushes in.|Bạn đếm cừu đi. Thấy Biscuit chen vào hàng thì đếm lại từ đầu. Nó chuyên chen ngang.`],
        [`I saw your lamp|Tôi thấy đèn còn sáng`, `That lamp has brought me moths, one owl and now the village leader. Sit, the cocoa is warm.|Ngọn đèn này từng dụ tới bướm đêm, một con cú, giờ thêm cả trưởng làng. Ngồi đi, ca cao còn ấm.`],
        [`Checking on the village|Tôi đi xem làng thế nào`, `The village is asleep and breathing evenly. I checked. Now bed, by order of the cocoa nurse.|Cả làng ngủ say, thở đều. Tôi khám rồi. Giờ thì đi ngủ, đây là y lệnh của y tá ca cao.`],
      ] },
    } },
  ],
  sylvie: [
    { id: 'sylvie-labels', nodes: {
      a: { say: `I am the doctor and the orchard keeper, and I mix up my notes. Yesterday I prescribed a man “more sun and a good pruning”.|Tôi vừa làm bác sĩ vừa giữ vườn quả nên hay lẫn sổ. Hôm qua tôi kê cho một anh: “thêm nắng và tỉa cành cho gọn”.`, choices: [
        [`Did it work?|Có khỏi không?`, `He had a haircut and sat in the garden. He feels splendid. I may keep that one.|Anh ấy đi cắt tóc rồi ra vườn ngồi. Khỏe hẳn ra. Chắc tôi giữ luôn bài thuốc này.`, 'b'],
        [`And the trees?|Thế còn mấy cái cây?`, `The pear tree got “two days in bed, no visitors”. It has not moved since. Very obedient.|Cây lê nhận đơn “nằm nghỉ hai ngày, miễn tiếp khách”. Từ đó nó không nhúc nhích. Ngoan hết sức.`, 'b'],
        [`Prune me too|Tỉa cho tôi với`, `You are in fine shape. Come back at blossom time and we shall see about the hat.|Bạn đang đẹp dáng rồi. Mùa hoa nở ghé lại, lúc đó ta tính chuyện cái mũ.`],
      ] },
      b: { say: `So tell me honestly. Which is easier to treat: a tree or a villager?|Bạn nói thật xem. Chữa cho cây dễ hơn hay chữa cho người làng dễ hơn?`, choices: [
        [`A tree|Cây`, `Yes. A tree never says “it was fine until you looked at it”.|Đúng. Cây không bao giờ nói “nãy còn bình thường, bác sĩ nhìn vào cái là đau”.`],
        [`A villager|Người làng`, `True. A villager can point to where it hurts. A tree just drops an apple on you and lets you guess.|Phải. Người còn chỉ được chỗ đau. Cây thì thả một quả táo lên đầu mình rồi để mình tự đoán.`],
        [`The goat|Con dê`, `Biscuit ate my prescription pad. On paper she is now the healthiest goat in Willowmere.|Biscuit ăn mất tập đơn thuốc của tôi. Tính trên giấy tờ thì nó là con dê khỏe nhất Willowmere.`],
      ] },
    } },
    { id: 'sylvie-hodja', nodes: {
      a: { say: `An old tale. A man tells Hodja the healer, “My eye aches.” Hodja says, “When my tooth ached, I had it out.” Good doctoring?|Chuyện xưa kể: có người than với thầy lang Hodja “Tôi đau mắt”. Thầy đáp: “Hồi tôi đau răng, tôi nhổ phăng đi.” Chữa vậy được không?`, choices: [
        [`Terrible!|Chữa thế thì chết!`, `Quite. One cure does not fit all. I learnt that the day I gave a rose bush a cough drop.|Chính thế. Một bài thuốc đâu hợp mọi bệnh. Tôi ngộ ra điều đó hôm lỡ cho bụi hồng ngậm kẹo ho.`, 'b'],
        [`At least he was quick|Ít ra thầy ấy chữa nhanh`, `Quick, yes. I prefer slow and right, like a pear tree.|Nhanh thì có nhanh. Tôi thì thích chậm mà chắc, như cây lê ra quả.`, 'b'],
        [`Did the man run?|Người kia có bỏ chạy không?`, `Faster than Milo. So his legs were cured, at any rate. Half a success.|Chạy nhanh hơn cả bé Milo. Vậy là ít ra đôi chân đã khỏi. Thành công một nửa.`],
      ] },
      b: { say: `So when you come to me with an ache, what do I do first?|Vậy khi bạn mang một chỗ đau đến gặp tôi, đố bạn tôi làm gì trước tiên?`, choices: [
        [`Listen|Lắng nghe`, `Yes. Two ears and one stethoscope: three ways to listen before I say a single word.|Đúng. Hai cái tai cộng một ống nghe: ba cách lắng nghe trước khi tôi mở miệng.`],
        [`Fetch the pliers|Đi lấy cái kìm`, `The pliers live in Theo’s garage and there they stay. You are perfectly safe with me.|Kìm nằm ở xưởng của anh Theo và sẽ ở yên đó. Ở chỗ tôi bạn an toàn tuyệt đối.`],
        [`Offer tea|Mời trà`, `That is Hazel’s department and she guards it fiercely. Sit down, she has already seen you.|Việc đó thuộc khoa của Hazel, cô ấy giữ kỹ lắm. Bạn ngồi đi, cô ấy thấy bạn rồi đấy.`],
      ] },
    } },
    { id: 'sylvie-lunch', when: { from: 12, to: 13 }, nodes: {
      a: { say: `Lunch at the pharmacy counter. I label everything, so my sandwich says: “Take one at noon, with tea. Do not exceed.”|Tôi ăn trưa ngay quầy thuốc. Cái gì tôi cũng dán nhãn, nên bánh mì kẹp ghi: “Trưa dùng một cái, kèm trà. Không quá liều.”`, choices: [
        [`Do you ever exceed?|Chị có bao giờ quá liều không?`, `Once. Two sandwiches. I had to write myself a very stern note.|Một lần. Hai cái bánh. Tôi phải tự viết cho mình một tờ nhắc nhở rất nghiêm.`, 'b'],
        [`What is in it?|Nhân bánh có gì?`, `Cheese, radish and the small print.|Phô mai, củ cải và mấy dòng chữ nhỏ ở mặt sau.`, 'b'],
        [`May I have a bite?|Cho tôi cắn một miếng nhé?`, `It is prescribed to me alone. Sharing a prescription is naughty. Sharing the stool is fine, sit.|Đơn này kê riêng cho tôi. Dùng chung đơn thuốc là hư. Ngồi chung ghế thì được, mời bạn.`],
      ] },
      b: { say: `Hazel swapped my labels this morning for a joke. Guess what my jam jar says now.|Sáng nay Hazel đổi nhãn của tôi để trêu. Đố bạn lọ mứt của tôi giờ ghi gì.`, choices: [
        [`Cough syrup|Xi rô ho`, `Exactly. I have not dared the toast since. Hugo’s bread deserves better than suspense.|Chính xác. Từ sáng tôi chưa dám phết bánh. Bánh mì anh Hugo đâu đáng phải hồi hộp thế.`],
        [`Do not open till supper|Chưa tới bữa tối cấm mở`, `That one is on the biscuit tin, in my own handwriting. I ignore it daily.|Nhãn đó dán trên hộp bánh quy, chính tay tôi viết. Ngày nào tôi cũng làm lơ.`],
        [`Property of Hazel|Tài sản của Hazel`, `That is on my chair, my stethoscope and, since Tuesday, my back. Lunch is over, and I am smiling.|Nhãn đó nằm trên ghế, trên ống nghe, và từ thứ Ba thì trên lưng tôi. Hết giờ ăn trưa rồi, vui ghê.`],
      ] },
    } },
    { id: 'sylvie-carry', when: { fresh: 'hospital' }, nodes: {
      a: { say: `Before I listen to your chest, one question. What have you been carrying this week?|Trước khi nghe tim phổi, tôi hỏi một câu. Tuần này bạn đã khuân vác những gì?`, choices: [
        [`A few pumpkins|Vài quả bí ngô`, `“A few.” Oren said that too. It was nineteen. His back sent me a letter of complaint.|“Vài quả.” Anh Oren cũng nói thế. Hóa ra mười chín quả. Cái lưng anh ấy gửi đơn khiếu nại tới tôi.`, 'b'],
        [`Only my worries|Chỉ vác mỗi nỗi lo`, `The heaviest crop there is, and no market stall for it. Set them down on that chair.|Thứ nông sản nặng nhất, mà chợ lại không ai mua. Bạn đặt chúng xuống cái ghế kia đi.`, 'b'],
        [`Pip, on my shoulders|Bé Pip, trên vai`, `That weight is good for the heart. Bad for hats, though. Carry on exactly as you are.|Sức nặng đó bổ tim lắm. Chỉ hại mũ thôi. Bạn cứ thế mà cõng tiếp.`],
      ] },
      b: { say: `Shall I have a listen? I promise to say “hmm” only in the friendly way.|Để tôi nghe thử nhé? Tôi hứa chỉ “hừm” theo kiểu thân thiện thôi.`, choices: [
        [`Yes, doctor|Vâng, thưa bác sĩ`, `In you come. Breathe in and think of blossom. Out, and think of supper.|Mời vào. Hít vào, nghĩ tới hoa nở. Thở ra, nghĩ tới bữa tối.`, '', 'checkup'],
        [`What is the unfriendly “hmm”?|Thế “hừm” không thân thiện là sao?`, `It means I have lost my pencil. Nothing to do with you. Come in.|Là lúc tôi làm mất bút chì. Không liên quan gì đến bạn đâu. Mời vào.`, '', 'checkup'],
        [`Not today|Hôm nay thì thôi`, `Then today’s advice is free: put the pumpkins down one at a time, and never on your foot.|Vậy lời khuyên hôm nay miễn phí: đặt bí ngô xuống từng quả một, và đừng đặt lên chân.`],
      ] },
    } },
    { id: 'sylvie-apple', when: { season: 'Autumn' }, nodes: {
      a: { say: `They say an apple a day keeps the doctor away. I grow the apples and I am the doctor. You see my difficulty.|Người ta bảo mỗi ngày một quả táo thì khỏi gặp bác sĩ. Táo tôi trồng, bác sĩ cũng là tôi. Bạn thấy tôi khó xử chưa.`, choices: [
        [`Bad for business?|Vậy là tự làm ế mình?`, `Dreadful. Every basket I sell chases me a little further out of my own clinic.|Ế thê thảm. Bán thêm giỏ táo nào là tôi tự đuổi mình ra khỏi trạm xá thêm một bước.`, 'b'],
        [`So I eat two?|Vậy tôi ăn hai quả nhé?`, `Two keeps me twice as far away. I would have to wave to you from the orchard.|Hai quả thì tôi phải tránh xa gấp đôi. Chắc tôi đứng tận vườn quả mà vẫy tay chào bạn.`, 'b'],
        [`What about pears?|Còn lê thì sao?`, `A pear a day keeps nobody away. Pears are sociable. Bring one and stay for tea.|Lê thì chẳng đuổi ai đi cả. Lê quý người lắm. Bạn mang một quả tới rồi ở lại uống trà.`],
      ] },
      b: { say: `So what do you think I tell my patients to do?|Thế bạn nghĩ tôi dặn bệnh nhân của mình thế nào?`, choices: [
        [`Eat the apple anyway|Cứ ăn táo đi`, `Right. And if the doctor turns up regardless, it is only to ask how the apple was.|Đúng. Còn nếu bác sĩ vẫn tới thì chỉ là để hỏi táo có ngọt không thôi.`],
        [`Throw it at the doctor|Ném táo vào bác sĩ`, `That needs good aim, and afterwards somebody needs a doctor. Just eat it, please.|Ném thì phải trúng, mà trúng rồi lại phải đi tìm bác sĩ. Thôi bạn cứ ăn giùm tôi.`],
        [`Plant the core|Trồng cái hạt`, `Now that is my kind of medicine. Trees are promises to your future self.|Đấy mới là phương thuốc hợp ý tôi. Trồng cây là gửi một lời hứa cho chính mình mai sau.`],
      ] },
    } },
    { id: 'sylvie-night', when: { night: true }, nodes: {
      a: { say: `After hours I am off duty, so I am writing labels for tomorrow. This one just says “Tuesday”. Too much?|Hết giờ khám là tôi nghỉ, nên tôi ngồi viết nhãn cho ngày mai. Cái này chỉ ghi “Thứ Ba”. Có quá tay không?`, choices: [
        [`Label the moon next|Dán nhãn mặt trăng luôn đi`, `I tried. It will not hold still for the string.|Tôi thử rồi. Nó không chịu đứng yên cho tôi buộc dây.`, 'b'],
        [`You should rest|Chị nên nghỉ đi`, `Hazel says rest is part of growing. I am resting. This is very restful labelling.|Hazel bảo nghỉ ngơi cũng là lớn lên. Tôi đang nghỉ đấy chứ. Đây là dán nhãn kiểu thư giãn.`, 'b'],
        [`What is left to label?|Còn gì chưa dán nhãn?`, `Only Hazel. She keeps taking hers off and sticking it on the kettle.|Còn mỗi Hazel. Cô ấy cứ gỡ nhãn của mình ra rồi dán lên ấm nước.`],
      ] },
      b: { say: `Since you are here, one bedtime prescription. Which will you take?|Tiện bạn ở đây, tôi kê một đơn trước giờ ngủ. Bạn chọn bài nào?`, choices: [
        [`Warm milk|Sữa ấm`, `A classic. It works on children, calves and village leaders. Sleep well.|Bài kinh điển. Hiệu nghiệm với trẻ con, bê con và cả trưởng làng. Ngủ ngon nhé.`],
        [`Counting apples|Đếm táo`, `Count them dropping softly into the grass. By the ninth you are asleep under my tree. Good night.|Bạn đếm từng quả rơi nhẹ xuống cỏ. Tới quả thứ chín là bạn đã ngủ dưới gốc cây của tôi. Chúc ngủ ngon.`],
        [`One more chat|Trò chuyện thêm chút nữa`, `Not without a note from Hazel, and she is in her slippers. To bed, and mind the step.|Phải có giấy của Hazel mới được, mà cô ấy đi dép lê rồi. Về ngủ thôi, coi chừng bậc thềm.`],
      ] },
    } },
  ],
  '@patient': [
    { id: 'patient-wait', nodes: {
      a: { say: `I have waited so long that my ache got bored and went home. Do I still go in?|Tôi ngồi chờ lâu quá, cái chỗ đau nó chán nên bỏ về trước rồi. Giờ tôi có nên vào khám nữa không?`, choices: [
        [`Go in and say so|Cứ vào mà kể vậy`, `“Doctor, I am here to report nothing.” She will be delighted. It is her favourite ailment.|“Thưa bác sĩ, tôi đến báo là không bị gì.” Bác sĩ sẽ mừng lắm. Bệnh đó bác sĩ khoái nhất.`, 'b'],
        [`Wait for it to come back|Ngồi đợi nó quay lại`, `I saved it a chair, look. If it is not back by the next name, I am off to the fields.|Tôi giữ sẵn cho nó một cái ghế đây này. Gọi tới tên sau mà nó chưa về là tôi ra đồng.`, 'b'],
        [`Go home after it|Về theo nó luôn`, `And lose my place? I have warmed this chair for an hour. It is practically family.|Rồi mất chỗ à? Tôi ủ ấm cái ghế này cả tiếng rồi. Nó gần như người nhà tôi rồi.`],
      ] },
      b: { say: `While we wait: what are YOU in for?|Trong lúc chờ, cho tôi hỏi: còn BẠN đến đây vì chuyện gì?`, choices: [
        [`Just visiting|Tôi ghé chơi thôi`, `Visiting a waiting room! You must love old seed catalogues. There are four. I have read them all twice.|Ghé chơi phòng chờ! Chắc bạn mê mấy cuốn mẫu hạt giống cũ. Có bốn cuốn. Tôi đọc hết hai lượt rồi.`],
        [`A splinter|Bị cái dằm`, `Ooh. Show me. No, do not. Yes, do. Tiny! It looked far braver on the fence.|Ôi. Cho tôi xem. Thôi đừng. Mà thôi cứ cho xem. Bé tí! Lúc còn ở hàng rào trông nó oai hơn nhiều.`],
        [`Too many pumpkins|Vác nhiều bí ngô quá`, `The pumpkin back. Half the village has it. We should form a choir, we all groan in the same key.|Chứng “lưng bí ngô”. Nửa làng mắc. Lập dàn hợp xướng được đấy, ai cũng rên cùng một tông.`],
      ] },
    } },
    { id: 'patient-flour', nodes: {
      a: { say: `I helped Hugo with the flour sacks. Now I sneeze little white clouds. Watch. No, wait. It only works when nobody looks.|Tôi phụ anh Hugo khuân bao bột. Giờ hắt hơi ra toàn mây trắng. Xem này. Khoan đã. Phải không ai nhìn nó mới ra.`, choices: [
        [`Bless you, in advance|Chúc sức khỏe trước nhé`, `Kind of you. I shall keep it for later. I have nine saved up in my pocket.|Bạn tử tế quá. Tôi cất đó dùng sau. Trong túi đang để dành chín câu chúc rồi.`, 'b'],
        [`Shall I look away?|Tôi quay mặt đi nhé?`, `Yes. Ah. Ah. No. It knows. A sneeze is a shy creature.|Vâng. Hắt. Hắt. Không ra. Nó biết đấy. Cái hắt hơi nhát người lắm.`, 'b'],
        [`You look like a loaf|Trông bạn như ổ bánh mì`, `Hugo said the same. He tried to stand me by the oven to rise.|Anh Hugo cũng bảo vậy. Anh ấy còn định đặt tôi cạnh lò cho nở.`],
      ] },
      b: { say: `What do you think the nurse will tell me?|Bạn đoán xem lát nữa chị y tá sẽ dặn tôi thế nào?`, choices: [
        [`Brush yourself off|Phủi bột đi`, `Outdoors, I hope. In here I would snow on the furniture.|Mong là được ra ngoài phủi. Phủi trong này thì tuyết rơi đầy bàn ghế.`],
        [`Stay away from bakeries|Tránh xa lò bánh`, `From Hugo’s buns? I would rather keep the sneeze. We shall grow old together.|Xa bánh của anh Hugo á? Thà tôi giữ cái hắt hơi. Tôi với nó sống với nhau tới già.`],
        [`Sneeze into a bowl|Hắt hơi vào cái tô`, `And give Hugo his flour back! Thrifty. You should run this village. Oh. You do.|Rồi trả bột lại cho anh Hugo! Tiết kiệm ghê. Bạn nên làm trưởng làng đi. Ơ, bạn đang làm rồi.`],
      ] },
    } },
    { id: 'patient-ada', when: { who: 'ada' }, nodes: {
      a: { say: `The doctor said “one spoonful of honey for the tickly throat”. I have never owned a measuring spoon, dear. So I took a handful.|Bác sĩ dặn “một thìa mật ong cho đỡ ngứa cổ”. Mà bà có bao giờ đong bằng thìa đâu con. Bà bốc một nắm.`, choices: [
        [`A handful of honey?|Bốc mật ong bằng tay hả bà?`, `Sticky to the elbow. The throat is cured, the sleeve is not. Three bees walked me here.|Dính tới tận khuỷu tay. Cổ thì khỏi, tay áo thì chưa. Có ba con ong đưa bà tới đây.`, 'b'],
        [`How is the throat?|Cổ bà sao rồi ạ?`, `Sweet as a songbird. It is the door handles I worry about.|Ngọt như chim hót. Bà chỉ lo cho mấy cái tay nắm cửa thôi.`, 'b'],
        [`Gran, use a spoon|Bà dùng thìa đi mà`, `A spoon! Next you will have me weighing the salt. I raised a whole garden by handfuls, and you with it.|Thìa! Rồi con lại bắt bà cân muối nữa. Bà nuôi cả khu vườn bằng nắm tay đấy, nuôi luôn cả con.`],
      ] },
      b: { say: `Now the nurse wants me to rest “a little”. How much is a little, dear?|Giờ cô y tá dặn bà nghỉ “một chút”. Một chút là bao nhiêu hả con?`, choices: [
        [`A handful of minutes|Một nắm phút bà ạ`, `That I can measure! Five fingers, five minutes. You are your grandmother’s grandchild.|Cái đó thì bà đong được! Năm ngón, năm phút. Đúng là cháu của bà.`],
        [`Until supper|Tới bữa tối`, `Until supper! And who shells the peas? I shall rest with the bowl in my lap.|Tới bữa tối! Thế ai tách đậu? Bà sẽ nghỉ với cái rổ đậu trong lòng vậy.`],
        [`A whole day|Cả ngày luôn`, `A whole day sitting? My seeds would come looking for me. Half a day and a nap. Agreed.|Ngồi cả ngày? Hạt giống nó đi tìm bà mất. Nửa ngày với một giấc trưa. Chốt thế nhé.`],
      ] },
    } },
    { id: 'patient-ellis', when: { who: 'ellis' }, nodes: {
      a: { say: `I pulled my shoulder, child. I was showing Finn how big the fish was. It was THIS... ow. This big.|Ông bị trật vai, cháu ạ. Tại ông tả cho Finn con cá to cỡ nào. Nó to chừng NÀY... ối. Chừng này thôi.`, choices: [
        [`That big, Grandpa?|To vậy hả ông?`, `Bigger. But the doctor says my arms may only go this far until Thursday.|Còn to hơn. Nhưng bác sĩ dặn tới thứ Năm tay ông chỉ được dang tới đây.`, 'b'],
        [`Tell it with one arm|Ông kể bằng một tay thôi`, `Then it is half a fish! I have a reputation to keep.|Vậy thì còn có nửa con cá! Ông còn phải giữ tiếng tăm chứ.`, 'b'],
        [`Was there a fish at all?|Mà có con cá thật không ông?`, `There is always a fish. Sometimes it is still in the pond, growing for next time.|Lúc nào cũng có cá. Chỉ là đôi khi nó còn ở dưới ao, đang lớn thêm để dành kể lần sau.`],
      ] },
      b: { say: `So what does a fisherman do while his story arm mends?|Vậy trong lúc chờ cánh tay kể chuyện lành lại, người đi câu biết làm gì đây?`, choices: [
        [`Describe it in words|Ông tả bằng lời`, `“Long as a rowing boat.” Hm. Not bad. Words stretch further than arms, and never ache.|“Dài bằng chiếc thuyền chèo.” Hừm. Được đấy. Lời nói dang xa hơn cánh tay mà chẳng bao giờ mỏi.`],
        [`Let Pip draw it|Để bé Pip vẽ lại`, `Pip would draw it as a chicken. A very large chicken. I would hang it up all the same.|Bé Pip sẽ vẽ nó thành con gà. Một con gà rất to. Ông vẫn treo lên tường như thường.`],
        [`Catch a smaller fish|Ông câu con nhỏ hơn`, `Small fish, small story, no sprain. Wise. But where is the fun? Sit by me a while.|Cá nhỏ, chuyện nhỏ, khỏi trật vai. Khôn đấy. Nhưng thế thì còn gì vui? Ngồi đây với ông một lát.`],
      ] },
    } },
    { id: 'patient-iris', when: { who: 'iris' }, nodes: {
      a: { say: `A tailor with a thimble stuck on her thumb. Twenty years of needles, and I am beaten by a tiny hat for a finger.|Thợ may mà kẹt cái đê trên ngón cái. Hai mươi năm cầm kim, giờ tôi chịu thua một cái mũ tí hon của ngón tay.`, choices: [
        [`Have you tried butter?|Bạn thử bôi bơ chưa?`, `Butter, soap and Kit’s pumpkin soup. The thumb is delicious now. Still stuck.|Bơ, xà phòng, cả súp bí ngô của cậu Kit. Ngón cái giờ thơm ngon lắm. Vẫn kẹt.`, 'b'],
        [`It suits you|Trông hợp với bạn đấy`, `Silver does go with everything. I may make a matching one for the other hand.|Màu bạc thì hợp với mọi thứ. Có khi tôi làm thêm một cái cho tay kia đủ bộ.`, 'b'],
        [`Did anyone pull?|Có ai kéo giúp chưa?`, `Ash pulled me, Leo pulled Ash. Just like the old tale of the giant turnip, with less turnip.|Anh Ash kéo tôi, anh Leo kéo anh Ash. Y như chuyện cổ nhổ củ cải khổng lồ, chỉ thiếu củ cải.`],
      ] },
      b: { say: `If Hazel cannot get it off, what do I do?|Nếu chị Hazel cũng không gỡ ra được thì tôi tính sao đây?`, choices: [
        [`Start a fashion|Biến nó thành mốt`, `By harvest supper all Willowmere wears one. Thumbs have never been so safe.|Tới bữa tiệc mùa gặt là cả Willowmere đeo đê. Chưa bao giờ ngón cái được an toàn đến thế.`],
        [`Sew one handed|May bằng một tay`, `I measure twice and cut once. Now I shall measure twice and grumble once.|Xưa nay tôi đo hai lần, cắt một lần. Giờ thì đo hai lần, càu nhàu một lần.`],
        [`Wait, it will loosen|Cứ chờ, nó sẽ lỏng ra`, `Patience, the oldest remedy. It works on thumbs, on bread and on the queue for this very room.|Kiên nhẫn, bài thuốc cổ nhất. Trị được ngón tay, bột bánh và cả hàng người chờ ở phòng này.`],
      ] },
    } },
    { id: 'patient-mara', when: { who: 'mara' }, nodes: {
      a: { say: `I came about a peck on the finger. A hen thought my ring was corn. The hen is fine. The hen is always fine.|Tôi đến vì bị mổ vào ngón tay. Con gà mái tưởng cái nhẫn của tôi là hạt ngô. Con gà không sao. Gà thì có bao giờ sao đâu.`, choices: [
        [`Which hen?|Con gà nào vậy?`, `The speckled one. She has apologised in her own way: she laid an egg in my boot.|Con mái đốm. Nó xin lỗi theo kiểu của nó rồi: đẻ một quả trứng vào ủng của tôi.`, 'b'],
        [`Is the ring all right?|Cái nhẫn có sao không?`, `Polished. The crow watched the whole thing from the fence, taking notes.|Bóng loáng hơn trước. Con quạ đậu trên hàng rào xem từ đầu tới cuối, ghi chép cẩn thận.`, 'b'],
        [`Did you peck back?|Bạn có mổ lại không?`, `I gave her a stern look. She gave me one back. Hers was better.|Tôi lườm nó một cái thật nghiêm. Nó lườm lại. Nó lườm giỏi hơn tôi.`],
      ] },
      b: { say: `And guess who walked me here and is waiting outside.|Mà đố bạn ai đưa tôi tới đây và đang đứng chờ ngoài cửa.`, choices: [
        [`Wren|Bé Wren`, `Wren is at school. No, it is Biscuit. She thinks “clinic” is a kind of clover.|Bé Wren đang ở trường. Là Biscuit đấy. Nó tưởng “trạm xá” là tên một loại cỏ ba lá.`],
        [`The hen|Con gà mái`, `She does not do visits. It is Biscuit, and she is eating the “please wipe your feet” sign.|Nó không đi thăm ai bao giờ. Là Biscuit, đang gặm tấm biển “xin chùi chân trước khi vào”.`],
        [`Biscuit|Biscuit`, `Of course. She ate my appointment card, so by rights the appointment is now hers.|Chứ còn ai. Nó ăn mất phiếu hẹn của tôi, nên giờ lượt khám này chính thức là của nó.`],
      ] },
    } },
  ],
};
