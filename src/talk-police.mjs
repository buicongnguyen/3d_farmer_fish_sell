// Conversations by choice in the Police Station: Pearl at the front desk, Theo at the office desk, and villagers reporting lost things.
export default {
  pearl: [
    { id: 'pearl-odd', nodes: {
      a: { say: `Seen anything odd today? Yesterday’s whole report was one line: “A hen looked at me in a knowing way.”|Hôm nay bạn có thấy gì lạ không? Biên bản hôm qua có đúng một dòng: “Một con gà mái nhìn tôi rất đầy ẩn ý.”`, choices: [
        [`A goat by the tulips, whistling|Một con dê đứng huýt sáo cạnh luống tulip`, `Whistling. The most innocent sound there is. That alone is suspicious.|Huýt sáo à. Tiếng động vô tội nhất trần đời. Riêng chuyện đó đã đáng ngờ rồi.`, 'b'],
        [`A crow carrying a spoon|Một con quạ ngậm cái thìa`, `That’s the fourth spoon this week. One more and it can open a soup shop. I’ll note it under “cutlery, airborne”.|Cái thìa thứ tư trong tuần. Thêm cái nữa là nó mở được quán cháo. Tôi ghi vào mục “thìa đũa, biết bay”.`],
        [`Nothing at all|Chẳng thấy gì cả`, `Nothing. I’ll write it down. That’s the ninth nothing this week. We’re on course for a record.|Không có gì. Để tôi ghi lại. Tuần này là cái “không có gì” thứ chín rồi. Sắp phá kỷ lục đấy.`],
      ] },
      b: { say: `For the file: how would you describe the suspect?|Để ghi hồ sơ: bạn tả nghi phạm giúp tôi xem nào?`, choices: [
        [`Four legs, a beard, no remorse|Bốn chân, có râu, không chút hối hận`, `That narrows it to one goat and, on a bad day, Ellis’s old stool. I’ll question the goat first.|Vậy chỉ còn một con dê, và nếu xui thì cái ghế đẩu cũ của ông Ellis. Tôi sẽ hỏi con dê trước.`],
        [`Short, white, answers to Biscuit|Thấp, trắng, gọi Biscuit là quay lại`, `She answers to Biscuit only when Biscuit means food. Otherwise she’s suddenly a stranger here.|Nó chỉ thưa khi “Biscuit” nghĩa là có ăn. Còn không thì bỗng dưng nó thành khách lạ qua đường.`],
        [`She looked completely innocent|Trông nó ngây thơ vô cùng`, `They always do. She once looked innocent with half a tulip still in her mouth. Thank you, good witness.|Lúc nào chẳng thế. Có lần nó ngây thơ khi nửa bông tulip còn trong miệng. Cảm ơn bạn, nhân chứng tốt lắm.`],
      ] },
    } },
    { id: 'pearl-lost', nodes: {
      a: { say: `Lost and found desk. What have you lost? Please don’t say your temper, that shelf is full.|Bàn nhận đồ thất lạc đây. Bạn mất gì nào? Xin đừng nói là mất bình tĩnh, kệ đó chật lắm rồi.`, choices: [
        [`My hat|Cái mũ của tôi`, `One hat. I’ll take the report properly, pen and everything.|Một cái mũ. Tôi lập biên bản đàng hoàng, có bút hẳn hoi.`, 'b'],
        [`My train of thought|Tôi quên mất mình định nói gì`, `Try the basket at the supermarket. Lost thoughts end up there, between a single mitten and a shopping list for “things”.|Bạn ra cái giỏ ở siêu thị xem. Ý nghĩ lạc hay nằm đó, giữa một chiếc găng lẻ và tờ giấy đi chợ ghi “mua mấy thứ”.`],
        [`Nothing, I’m just looking|Không mất gì, tôi xem thôi`, `Look away. The evidence shelf has one umbrella, one left boot, and a spoon the crow gave back. Out of guilt, I think.|Cứ xem. Kệ tang vật có một cái ô, một chiếc ủng trái, và cái thìa con quạ đem trả. Chắc nó thấy áy náy.`],
      ] },
      b: { say: `First question on the form: where did you last see it?|Câu đầu tiên trong mẫu: lần cuối bạn thấy nó ở đâu?`, choices: [
        [`On my head|Trên đầu tôi`, `(She looks up, slowly.) It is still there. Case closed. The fastest of my career, and I didn’t stand up.|(Cô ngước lên, thong thả.) Nó vẫn ở đó. Kết thúc vụ án. Nhanh nhất đời tôi, mà tôi chưa cần đứng dậy.`],
        [`If I knew, it wouldn’t be lost|Biết thì đã chẳng gọi là mất`, `Fair. Clever answers go in the second drawer. It is the fullest drawer in the station.|Có lý. Câu trả lời thông minh thì cất ngăn kéo thứ hai. Đó là ngăn đầy nhất đồn này.`],
        [`By the pond, but it’s brighter here|Ở bờ ao, nhưng trong này sáng hơn`, `An old method. Search where the light is good. You find very little, but you see it beautifully. Try the pond, I’ll hold the form.|Cách cổ truyền đấy. Tìm chỗ sáng thì chẳng thấy mấy, nhưng nhìn rất rõ. Bạn ra ao xem, tôi giữ tờ đơn cho.`],
      ] },
    } },
    { id: 'pearl-patrol', when: { fresh: 'police' }, nodes: {
      a: { say: `Nobody has walked the patrol today. The route: the green, the market, the pond. The main danger: Hugo offering samples.|Hôm nay chưa ai đi tuần. Lộ trình: bãi cỏ, dãy chợ, bờ ao. Hiểm nguy lớn nhất: anh Hugo mời ăn thử bánh.`, choices: [
        [`I’ll walk it|Để tôi đi`, `Good. Report anything suspicious. Or any particularly nice ducks, I like to keep up.|Tốt. Thấy gì khả nghi thì báo. Hoặc có con vịt nào xinh xinh cũng báo, tôi thích nắm tình hình.`, '', 'patrol'],
        [`What do I look out for?|Tôi cần để ý những gì?`, `Three things, and I’ve ranked them by how fast they move.|Ba thứ, tôi xếp sẵn từ nhanh đến chậm rồi.`, 'b'],
        [`Do I get a whistle?|Tôi có được phát còi không?`, `No. The last whistle called every dog in Willowmere and one confused goose. Use stern eyebrows.|Không. Lần trước thổi còi, chó cả Willowmere chạy tới, thêm một con ngỗng ngơ ngác. Bạn dùng lông mày nghiêm nghị ấy.`],
      ] },
      b: { say: `Loose goats, open gates, and Ellis telling the fish story. Which will you handle first?|Dê xổng chuồng, cổng để ngỏ, và ông Ellis kể chuyện con cá. Bạn xử lý cái nào trước?`, choices: [
        [`The goat|Con dê`, `Don’t chase her. Walk the other way holding a tulip, and Biscuit arrests herself.|Đừng đuổi. Bạn cầm một bông tulip đi hướng ngược lại, Biscuit sẽ tự ra đầu thú.`, '', 'patrol'],
        [`The gates|Mấy cái cổng`, `Close them gently. The gates have done nothing wrong, they were only left that way.|Đóng nhẹ tay thôi. Cổng không có lỗi, nó chỉ bị người ta để ngỏ.`, '', 'patrol'],
        [`The fish story|Chuyện con cá`, `Brave. At the last telling the fish was as long as my boat. Nod, admire it, and keep walking.|Gan đấy. Lần kể gần nhất con cá đã dài bằng cái thuyền của tôi. Bạn cứ gật, trầm trồ, rồi đi tiếp.`, '', 'patrol'],
      ] },
    } },
    { id: 'pearl-done', when: { done: 'police' }, nodes: {
      a: { say: `You’ve walked today’s patrol. I read your report: “All quiet. One duck, suspicious.” Fine police work.|Bạn đi tuần hôm nay rồi. Tôi đọc báo cáo: “Yên ắng. Một con vịt, khả nghi.” Nghiệp vụ tốt lắm.`, choices: [
        [`That duck was up to something|Con vịt đó có ý đồ thật mà`, `I believe you. I’ve met that duck.|Tôi tin bạn. Tôi biết con vịt đó.`, 'b'],
        [`Can I walk it again?|Tôi đi thêm vòng nữa nhé?`, `Tomorrow. If we patrol twice, people think something happened, and Bea will have it in the news by noon.|Mai nhé. Tuần hai vòng là bà con tưởng có chuyện, rồi chưa đến trưa chị Bea đã đưa tin khắp làng.`],
        [`My feet hurt|Chân tôi mỏi quá`, `Sit. The bench is official property but it doesn’t mind. Have some tea. That is an order, the only one I’ve given all week.|Ngồi đi. Ghế là tài sản công nhưng nó không phiền đâu. Uống chén trà. Đây là mệnh lệnh, cái duy nhất tôi ra cả tuần nay.`, '', 'energy'],
      ] },
      b: { say: `For the record, what exactly was the duck doing?|Để ghi sổ cho đủ: chính xác thì con vịt đã làm gì?`, choices: [
        [`Standing very still|Đứng im phăng phắc`, `Loitering with intent to float. I’ll open a file. It will be a thin file.|Lảng vảng với ý định nổi lềnh bềnh. Tôi sẽ lập hồ sơ. Hồ sơ mỏng thôi.`],
        [`Following me|Đi theo sau tôi`, `Then you were leading a parade. No permit needed for under six ducks.|Vậy là bạn dẫn đầu một đoàn diễu hành. Dưới sáu con vịt thì khỏi xin phép.`],
        [`Staring at my sandwich|Nhìn chằm chằm ổ bánh mì của tôi`, `Attempted sandwich. Serious. I’ll have a quiet word with it, officer to duck.|Âm mưu chiếm đoạt bánh mì. Nghiêm trọng đấy. Tôi sẽ nói chuyện riêng với nó, giữa sĩ quan và vịt.`],
      ] },
    } },
    { id: 'pearl-rain', when: { rain: true }, nodes: {
      a: { say: `Rain. Crime drops to zero when it rains. It is zero on dry days too, but in the rain I feel I’ve earned it.|Mưa rồi. Trời mưa thì tội phạm giảm về không. Ngày nắng cũng bằng không, nhưng mưa thì tôi thấy mình có công hơn.`, choices: [
        [`What does the cat do in the rain?|Trời mưa thì con mèo làm gì?`, `Funny you ask. It is the one mystery we have.|Bạn hỏi đúng chỗ. Đó là bí ẩn duy nhất của đồn.`, 'b'],
        [`Good boat weather?|Trời này hợp đóng thuyền chứ?`, `Good boat testing weather. If a boat leaks today, the rain tells you from both sides at once.|Hợp để thử thuyền. Thuyền mà dột hôm nay thì nước báo cho mình biết từ cả hai phía cùng lúc.`],
        [`I forgot my umbrella|Tôi quên mang ô rồi`, `There’s one on the evidence shelf, lost since spring. I can’t lend evidence. I can let you stand beside it until the rain stops.|Trên kệ tang vật có một cái, lạc từ mùa xuân. Tang vật thì không cho mượn được. Nhưng bạn cứ đứng cạnh nó đến khi tạnh.`],
      ] },
      b: { say: `On dry days it sleeps in cell one. When it rains it moves to cell two. Why, do you think?|Ngày nắng nó ngủ buồng giam số một. Hễ mưa là nó dọn sang buồng số hai. Bạn đoán vì sao?`, choices: [
        [`Cell one leaks|Buồng số một bị dột`, `Correct, detective. Theo says he’ll fix it. He has said so for eleven rains now.|Chính xác, thám tử ạ. Anh Theo bảo sẽ sửa. Anh ấy bảo thế đã mười một trận mưa rồi.`],
        [`A change of scenery|Nó muốn đổi không khí`, `Could be. It is the only one here who has ever asked for a transfer.|Cũng có thể. Cả đồn chỉ có mình nó từng xin chuyển công tác.`],
        [`It’s escaping|Nó đang vượt ngục`, `The doors are open, so it has escaped inwards. The hardest kind to catch.|Cửa mở toang mà, nên nó vượt ngục vào phía trong. Kiểu này khó bắt nhất.`],
      ] },
    } },
    { id: 'pearl-supper', when: { festival: true }, nodes: {
      a: { say: `Supper day, and I’ve had a case. Hugo says Milo stood at the bakery window for an hour smelling the buns for free. How would you judge it?|Ngày hội mà tôi có hẳn một vụ. Anh Hugo kể bé Milo đứng cửa lò bánh cả giờ, ngửi bánh không trả tiền. Bạn xử sao?`, choices: [
        [`Milo pays for the smell|Milo phải trả tiền mùi bánh`, `So I ruled. He shook two coins by Hugo’s ear: the smell paid for with the sound. An old judgement, not mine. They both laughed.|Tôi cũng xử vậy. Thằng bé lắc hai đồng xu bên tai anh Hugo: ngửi mùi thì trả bằng tiếng. Án lệ xưa lắm rồi. Cả hai cùng cười.`, 'b'],
        [`Hugo gives him a bun|Anh Hugo nên cho thằng bé cái bánh`, `He did, in the end. A baker can’t watch a hungry nose for long. Closed with crumbs.|Cuối cùng anh ấy cho thật. Thợ bánh nào nỡ nhìn mãi một cái mũi đang đói. Vụ án khép lại bằng vụn bánh.`, 'b'],
        [`Arrest the buns|Bắt giữ mấy cái bánh`, `Too late. The whole supper queue has taken them into custody. Nobody is talking, their mouths are full.|Muộn rồi. Cả hàng người dự tiệc đã tạm giữ hết số bánh. Không ai khai gì, miệng ai cũng đang bận.`],
      ] },
      b: { say: `Second case. Biscuit ate Nell’s festival garland. Nell says guilty, Mara says hungry. Who is right?|Vụ thứ hai. Biscuit ăn mất vòng hoa ngày hội của chị Nell. Chị Nell bảo có tội, chị Mara bảo tại đói. Ai đúng?`, choices: [
        [`Nell is right|Chị Nell đúng`, `Agreed. The garland agrees as well, from inside the goat.|Đồng ý. Vòng hoa cũng đồng ý, từ trong bụng con dê.`],
        [`Mara is right|Chị Mara đúng`, `Agreed. A goat at a festival is only a guest who didn’t wait for the plates.|Đồng ý. Dê đi hội chẳng qua là vị khách không chờ được dọn đĩa.`],
        [`They can’t both be right|Không thể cả hai cùng đúng được`, `And you are right too. I told Nell she was right, then Mara. That makes three of you. A good day for the law.|Bạn cũng đúng nốt. Tôi bảo chị Nell đúng, rồi chị Mara đúng. Vậy là ba người đúng. Một ngày đẹp của công lý.`],
      ] },
    } },
  ],
  theo: [
    { id: 'theo-report', nodes: {
      a: { say: `Don’t mind the fingerprints on this report. I’ve checked them all. The suspect is me, and the motive is engine oil.|Bạn đừng để ý dấu vân tay trên biên bản. Tôi kiểm tra hết rồi. Nghi phạm là tôi, động cơ là dầu máy.`, choices: [
        [`What’s the report about?|Biên bản về vụ gì thế?`, `The quietest suspect I’ve ever had.|Về nghi phạm im lặng nhất tôi từng gặp.`, 'b'],
        [`Have you tried washing your hands?|Anh thử rửa tay chưa?`, `I did. The soap filed a complaint. Pearl put it on the evidence shelf, as evidence.|Rửa rồi. Cục xà phòng làm đơn khiếu nại. Cô Pearl đặt nó lên kệ tang vật, làm tang vật luôn.`],
        [`Nice handwriting|Chữ anh đẹp đấy`, `Thanks. Pearl says it looks like a spider fell in the oil and ran for help. It did reach help, mind you.|Cảm ơn. Cô Pearl bảo trông như con nhện rơi vào dầu rồi chạy đi kêu cứu. Mà nó kêu cứu được thật đấy nhé.`],
      ] },
      b: { say: `A pothole on the market road. Bea reported it and says it’s mine. How do I write it up?|Một cái ổ gà trên đường chợ. Chị Bea trình báo, còn bảo nó là của tôi. Tôi ghi thế nào đây?`, choices: [
        [`“Pothole, large, unarmed”|“Ổ gà, cỡ lớn, không mang vũ khí”`, `Good. And “does not move when approached”. The easiest suspect I’ve ever followed.|Hay. Thêm câu “lại gần vẫn không bỏ chạy”. Nghi phạm dễ theo dõi nhất đời tôi.`],
        [`Blame the rain|Đổ cho trời mưa`, `The rain has an alibi. It was everywhere at the time.|Mưa có chứng cứ ngoại phạm. Lúc đó nó có mặt ở khắp mọi nơi.`],
        [`Just fill the hole in|Lấp nó đi là xong`, `Fill in the hole and I’ve no form to fill in. Only a road. Fine, you win. I’ll fetch the shovel.|Lấp ổ gà thì tôi hết việc lấp chỗ trống trong biên bản. Chỉ còn lại con đường. Được, bạn thắng. Tôi đi lấy xẻng.`],
      ] },
    } },
    { id: 'theo-lunch', when: { from: 12, to: 13 }, nodes: {
      a: { say: `Lunch on the lobby bench. Station rule: sandwich in the left hand, spanner hand stays clean. Guess what’s in it today.|Giờ cơm trưa trên ghế sảnh. Luật của đồn: tay trái cầm bánh mì, tay cầm cờ lê phải sạch. Đoán xem hôm nay nhân gì.`, choices: [
        [`Cheese|Phô mai`, `Wrong. Kit packed it. With Kit you never get the easy answer.|Sai. Thằng Kit gói đấy. Nó mà gói thì chẳng bao giờ có đáp án dễ.`, 'b'],
        [`Pumpkin soup|Súp bí đỏ`, `In a sandwich? Yes. Kit packed it. It’s a wet sandwich, but it runs well.|Trong bánh mì á? Đúng rồi. Thằng Kit gói. Bánh hơi ướt, nhưng chạy êm lắm.`, 'b'],
        [`A spanner|Một cái cờ lê`, `Not since Tuesday. I chewed for a full minute before I got suspicious.|Từ hôm thứ Ba thì hết rồi. Hôm ấy tôi nhai cả phút mới bắt đầu sinh nghi.`],
      ] },
      b: { say: `Kit says his pumpkin soup makes a motorbike go. What does it do to a father, do you reckon?|Thằng Kit bảo súp bí của nó làm xe máy chạy được. Còn với ông bố thì nó làm gì, bạn đoán xem?`, choices: [
        [`Makes him faster|Làm ông bố chạy nhanh hơn`, `I did get back to my desk quickly. Mostly to find a napkin.|Tôi quay về bàn nhanh thật. Chủ yếu là để tìm khăn giấy.`],
        [`Turns him orange|Làm ông bố ngả màu cam`, `Pearl already asked if I’m a pumpkin in uniform. I said I’m undercover for the harvest supper.|Cô Pearl hỏi rồi: tôi có phải quả bí mặc cảnh phục không. Tôi bảo đang cải trang cho tiệc mùa gặt.`],
        [`Makes him proud|Làm ông bố tự hào`, `That it does. Don’t tell him, or he’ll put soup in the jeep. Here, have a ginger snap. It’s the one dry thing in the box.|Đúng thế. Đừng kể với nó, kẻo nó đổ súp vào xe jeep. Này, ăn cái bánh gừng đi. Thứ duy nhất còn khô trong hộp.`, '', 'energy'],
      ] },
    } },
    { id: 'theo-motorbike', nodes: {
      a: { say: `I rode in this morning, then spent ten minutes reporting my motorbike missing. To myself. At this desk. Guess where it was.|Sáng nay tôi đi xe máy đến, rồi mất mười phút trình báo mất xe. Báo cho chính tôi. Tại bàn này. Đoán xem xe ở đâu.`, choices: [
        [`Outside, where you parked it|Ngoài kia, chỗ anh dựng nó`, `Right by the door. I was holding the keys while I wrote “keys: also missing”.|Ngay cạnh cửa. Tay tôi cầm chìa khóa trong lúc viết “chìa khóa: cũng mất”.`, 'b'],
        [`Biscuit took it|Biscuit lấy rồi`, `She can’t reach the pedals. I checked that too. I’m thorough, just not in the right order.|Chân nó không với tới bàn đạp. Tôi kiểm tra cả điều đó rồi. Tôi kỹ lắm, chỉ là kỹ sai thứ tự.`],
        [`Were you still wearing the helmet?|Lúc đó anh còn đội mũ bảo hiểm không?`, `I was. That should have been a clue. I’m paid to notice clues.|Còn. Lẽ ra đó là manh mối. Tôi được trả lương để nhìn ra manh mối cơ mà.`, 'b'],
      ] },
      b: { say: `Pearl says I should be glad of one thing at least. Guess which.|Cô Pearl bảo dù sao tôi cũng nên mừng một điều. Bạn đoán điều gì.`, choices: [
        [`That you found it|Mừng vì tìm lại được xe`, `That too. I’d offered a reward, so I had to shake my own hand. Firm grip. Oily.|Cũng mừng. Tôi lỡ treo thưởng, nên phải tự bắt tay mình. Bắt chặt lắm. Toàn dầu.`],
        [`That you weren’t on it when it vanished|Mừng vì lúc xe mất anh không ngồi trên xe`, `Her very words. “Or we’d have lost you as well.” She didn’t even blink. It’s an old joke, she says, older than motorbikes.|Đúng lời cô ấy. “Không thì mất luôn cả anh.” Mặt tỉnh bơ. Cô ấy bảo chuyện này cổ lắm, có trước cả xe máy.`],
        [`That nobody saw|Mừng vì không ai thấy`, `Bea saw. So by now the whole village knows, and the pond fish have been told as well.|Chị Bea thấy. Nên giờ cả làng biết rồi, cá dưới ao cũng được thông báo luôn.`],
      ] },
    } },
    { id: 'theo-potholes', nodes: {
      a: { say: `Bea came in asking exactly how many potholes my jeep has made. I asked her one thing back and she went off to think. Guess what.|Chị Bea vào hỏi xe jeep của tôi đã tạo ra chính xác bao nhiêu ổ gà. Tôi hỏi lại một câu, chị ấy về nghĩ luôn. Đoán xem.`, choices: [
        [`How many steps her post round is|Một ngày đưa thư chị ấy đi mấy bước`, `Exactly that. “Tell me yours and I’ll tell you mine.” A clever boy in an old tale did it first, with a plough.|Đúng thế. “Chị đếm được bước chân thì tôi đếm được ổ gà.” Em bé thông minh trong truyện xưa hỏi vặn kiểu ấy trước tôi.`, 'b'],
        [`Whether she’d like some tea|Chị ấy có muốn uống trà không`, `That was my second question. It works on most charges.|Đó là câu thứ hai của tôi. Cáo buộc nào gặp câu ấy cũng dịu đi.`],
        [`You said “pardon?” until she left|Anh cứ “hả?” mãi cho đến khi chị ấy về`, `That’s for emergencies only. And for when Kit asks for more bolts.|Chiêu đó chỉ dùng lúc khẩn cấp. Và lúc thằng Kit xin thêm bu lông.`],
      ] },
      b: { say: `She’ll be back with a number, mind. Bea counts everything. What do I say then?|Nhưng thế nào chị ấy cũng quay lại với một con số. Chị Bea cái gì cũng đếm. Lúc đó tôi nói sao?`, choices: [
        [`Own up and mend the road|Nhận lỗi rồi vá đường`, `Honest and tiring. Fine. Pearl says a confession with a shovel is the best kind.|Thật thà mà mệt. Thôi được. Cô Pearl bảo lời thú tội có kèm cái xẻng là loại quý nhất.`],
        [`Say the holes were here first|Bảo là ổ gà có từ trước`, `They do look old. Two of them have ducks living in. I’ll call those ponds, small.|Trông chúng cũ thật. Có hai cái vịt đã dọn vào ở. Tôi sẽ gọi đó là ao, loại nhỏ.`],
        [`Count them together|Rủ chị ấy cùng đi đếm`, `A pothole walk with Bea. She brings the news, I bring the shovel. By the pond we’ll know everything and have fixed four.|Đi đếm ổ gà với chị Bea. Chị ấy mang tin tức, tôi mang xẻng. Tới bờ ao là biết hết chuyện làng, vá xong bốn cái.`],
      ] },
    } },
    { id: 'theo-rain', when: { rain: true }, nodes: {
      a: { say: `Rain day. I rode in, and now the motorbike is drying in cell two beside the cat. Neither of them is under arrest.|Hôm nay mưa. Tôi đi xe đến, giờ xe đang hong khô trong buồng số hai, cạnh con mèo. Cả hai đều không bị bắt.`, choices: [
        [`Do they get along?|Hai bên có hòa thuận không?`, `Too well. That’s the trouble.|Hòa thuận quá. Rắc rối là ở chỗ đó.`, 'b'],
        [`Why not leave it outside?|Sao anh không để xe ngoài kia?`, `It sulks when it’s wet. Won’t start until I say sorry. Kit says that’s the spark plug. I say it’s feelings.|Ướt là nó dỗi. Tôi chưa xin lỗi thì nó chưa nổ máy. Thằng Kit bảo tại bugi. Tôi bảo tại nó tủi thân.`],
        [`Is that allowed?|Thế có đúng quy định không?`, `Pearl wrote it in the book: “One motorbike, held for its own good. Visiting hours: all day.”|Cô Pearl ghi vào sổ rồi: “Một xe máy, tạm giữ vì lợi ích của chính nó. Giờ thăm nuôi: cả ngày.”`],
      ] },
      b: { say: `The cat sleeps on the seat because the engine’s warm. Going home is the problem. How do you get a cat off a motorbike?|Con mèo ngủ trên yên vì máy còn ấm. Khổ nhất là lúc về. Làm sao mời một con mèo xuống khỏi xe máy?`, choices: [
        [`Ask politely|Xin phép thật lễ độ`, `Tried. It opened one eye, looked at me, and closed the case.|Thử rồi. Nó mở một mắt, nhìn tôi, rồi đóng hồ sơ.`],
        [`Start the engine|Nổ máy lên`, `And wake a sleeping cat in a police station? I’d be the first crime Willowmere ever had.|Rồi đánh thức một con mèo đang ngủ ngay trong đồn à? Tôi sẽ thành vụ án đầu tiên của Willowmere mất.`],
        [`Walk home|Đi bộ về`, `That’s what I did last rain. The cat kept the bike till morning. Gave it back cleaner, too.|Trận mưa trước tôi làm đúng thế. Mèo giữ xe đến sáng. Lúc trả xe còn sạch hơn trước.`],
      ] },
    } },
  ],
  '@report': [
    { id: 'report-glasses', nodes: {
      a: { say: `I’m reporting my glasses missing. I’ve looked everywhere I can see, which without glasses is not very far.|Tôi đến báo mất kính. Tôi đã tìm khắp những nơi mắt tôi nhìn tới, mà không có kính thì nhìn chẳng tới đâu.`, choices: [
        [`They’re on top of your head|Kính đang ở trên đầu bạn kìa`, `Oh! So they are. Then I’d like to report them found, please. Quickly, before Pearl finishes the form.|Ơ! Đúng thật. Vậy tôi xin báo là tìm thấy rồi. Nhanh nhanh kẻo cô Pearl viết xong tờ đơn.`, 'b'],
        [`When did you last see through them?|Lần cuối bạn nhìn qua kính là lúc nào?`, `At breakfast. I saw the egg clearly. After that it’s all rumours.|Lúc ăn sáng. Tôi nhìn quả trứng rõ mồn một. Sau đó thì toàn là tin đồn.`],
        [`Try the basket at the supermarket|Bạn thử xem cái giỏ ở siêu thị`, `I did. Three pairs in it, none mine. I tried them all on. I have now seen Willowmere four different ways.|Xem rồi. Có ba cái kính, không cái nào của tôi. Tôi đeo thử hết. Giờ tôi đã thấy Willowmere theo bốn kiểu khác nhau.`],
      ] },
      b: { say: `While I’m here: is there a form for things you’ve found but never lost?|Tiện đây cho tôi hỏi: có mẫu đơn nào cho thứ mình nhặt được mà chưa từng đánh mất không?`, choices: [
        [`What did you find?|Bạn nhặt được gì thế?`, `A feeling that I left the stove on. I’d like to hand it in. I don’t want it.|Một cảm giác là mình chưa tắt bếp. Tôi muốn nộp lại. Tôi không muốn giữ nó.`],
        [`Yes, form twelve|Có, mẫu số mười hai`, `Lovely. I’ll fill it in when I find a pen. Pearl keeps hers on a string. A wise woman.|Tuyệt. Tìm được bút là tôi điền ngay. Bút của cô Pearl có buộc dây hẳn hoi. Người đâu mà sáng suốt.`],
        [`Just tell Pearl|Cứ kể với cô Pearl là được`, `I will. Glasses or goat, she writes it all down in the same calm way. It’s very soothing.|Vâng. Mất kính hay mất dê, cô ấy đều ghi bằng một vẻ điềm tĩnh như nhau. Nghe mà nhẹ cả người.`],
      ] },
    } },
    { id: 'report-umbrella', nodes: {
      a: { say: `I’ve lost my umbrella. I only notice when it rains, and then I’m too wet to come in and report it. Today I remembered.|Tôi mất cái ô. Chỉ lúc mưa tôi mới nhớ ra, mà lúc đó ướt quá chẳng dám vào báo. Hôm nay thì tôi nhớ.`, choices: [
        [`When did you lose it?|Bạn mất nó từ bao giờ?`, `Somewhere between spring and now. I’ve narrowed the place down as well: outdoors.|Đâu đó từ mùa xuân đến giờ. Địa điểm tôi cũng khoanh vùng được rồi: ngoài trời.`, 'b'],
        [`What does it look like?|Trông nó thế nào?`, `Black, with a handle. Pearl says that describes the whole shelf and one of the crows.|Màu đen, có cán. Cô Pearl bảo tả thế thì trúng cả cái kệ, thêm một con quạ.`, 'b'],
        [`Share mine next time|Lần sau che chung ô với tôi`, `Kind of you! Then we’ll both be half wet, which is how friendships start in Willowmere.|Bạn tốt quá! Thế là mỗi người ướt một nửa. Ở Willowmere, tình bạn toàn bắt đầu như vậy.`],
      ] },
      b: { say: `I’ve promised that whoever finds it may keep it. Pearl looked at me for a long time. Does that make sense to you?|Tôi hứa rồi: ai tìm thấy thì cứ giữ luôn cái ô. Cô Pearl nhìn tôi rất lâu. Bạn thấy có hợp lý không?`, choices: [
        [`Not at all|Chẳng hợp lý tí nào`, `It does to me. I lose the umbrella but I keep the joy of it being found. An old storyteller with a donkey taught me that.|Tôi thấy hợp lý. Mất cái ô nhưng được niềm vui tìm thấy. Một ông kể chuyện xưa có con lừa đã dạy tôi thế.`],
        [`So you want it back to lose it properly|Vậy là muốn tìm lại để mất cho đàng hoàng`, `Exactly. This time on purpose, with a proper goodbye.|Chính xác. Lần này mất có chủ đích, có chào tạm biệt tử tế.`],
        [`I’ll keep an eye out|Tôi sẽ để mắt tìm giúp`, `Thank you. If you see one walking about alone, be gentle. It’s shy and it folds under pressure.|Cảm ơn bạn. Thấy cái ô nào đi lang thang một mình thì nhẹ nhàng nhé. Nó nhát lắm, hơi tí là cụp.`],
      ] },
    } },
    { id: 'report-ellis', when: { who: 'ellis' }, nodes: {
      a: { say: `I’m reporting a lost fish, child. It got away this morning. It was this long. No, wait, the desk is too short to show you.|Ông đến báo mất một con cá, con ạ. Sáng nay nó sổng mất. Nó dài chừng này. À không, cái bàn ngắn quá, không đủ để chỉ.`, choices: [
        [`How long exactly, Grandpa?|Chính xác là dài bao nhiêu hả ông?`, `At breakfast, as long as my arm. By supper, as long as the boat. Fish keep growing after they get away.|Lúc ăn sáng thì dài bằng cánh tay ông. Đến bữa tối sẽ dài bằng cái thuyền. Cá sổng rồi vẫn lớn tiếp con ạ.`, 'b'],
        [`Can you describe it?|Ông tả nó cho con nghe đi`, `Golden, clever, and it winked at me. Pearl wrote “winked” without a word. A fine officer.|Vàng óng, khôn, lại còn nháy mắt với ông. Cô Pearl ghi chữ “nháy mắt” mà không hỏi câu nào. Sĩ quan giỏi đấy.`, 'b'],
        [`Fish aren’t lost, they’re at home|Cá có mất đâu, nó ở nhà nó mà ông`, `Hm. Then I should report myself: one grandfather, lost at the pond since breakfast, and quite content.|Ừ nhỉ. Vậy ông nên trình báo chính ông: một ông già, lạc ở bờ ao từ sáng, và lấy thế làm vui.`],
      ] },
      b: { say: `Pearl asks whether there were any witnesses. Who would you call, child?|Cô Pearl hỏi có ai làm chứng không. Con thì con mời ai?`, choices: [
        [`The crow|Con quạ ạ`, `It saw everything. But it would swear to anything for a shiny spoon. Not a reliable bird.|Nó thấy hết. Nhưng cho nó cái thìa sáng loáng thì nó khai gì cũng được. Con chim ấy không đáng tin.`],
        [`Finn|Anh Finn ạ`, `Finn would count that fish three times and get three sizes. All of them smaller than mine.|Finn sẽ đo con cá ba lần, ra ba cỡ khác nhau. Cỡ nào cũng bé hơn cỡ của ông.`],
        [`Me|Con ạ`, `You weren’t there, child. Perfect. Then you can’t say it was small.|Con có ở đó đâu. Thế mới tuyệt. Vậy là con không thể bảo nó bé được.`],
      ] },
    } },
    { id: 'report-ash', when: { who: 'ash' }, nodes: {
      a: { say: `I’ve lost my folding rule. I’d tell you how long it is, but I’d need it to measure it.|Tôi mất cây thước gấp. Tôi muốn nói cho bạn biết nó dài bao nhiêu, nhưng phải có nó thì mới đo được nó.`, choices: [
        [`Where did you last use it?|Lần cuối anh dùng nó ở đâu?`, `On Pearl’s new shelf. I measured twice, cut once, and lost the rule once. Two out of three is not bad.|Lúc đóng cái kệ mới cho cô Pearl. Tôi đo hai lần, cưa một lần, mất thước một lần. Ba việc đúng hai, cũng tạm.`, 'b'],
        [`Is your pencil gone too?|Bút chì của anh cũng mất à?`, `No, that’s behind my ear. I once hunted for it for an hour with it there. We don’t talk about that hour.|Không, nó giắt sau tai. Có lần tôi tìm nó cả tiếng trong khi nó vẫn ở đó. Chuyện ấy trong nhà không ai nhắc lại.`, 'b'],
        [`Measure with your hands|Anh đo bằng gang tay vậy`, `I tried. The shelf came out three hands and a thumb. Ada approved. She bakes that way.|Thử rồi. Cái kệ ra ba gang với một ngón cái. Bà Ada khen. Bà ấy làm bánh cũng đong kiểu đó.`],
      ] },
      b: { say: `Pearl wants a description for the report. What shall I say?|Cô Pearl cần tả đặc điểm để ghi biên bản. Tôi nên tả thế nào?`, choices: [
        [`Yellow, straight, honest|Màu vàng, thẳng, trung thực`, `Honest! Yes. In all these years it never once told me what I wanted to hear.|Trung thực! Đúng. Bao năm nay chưa lần nào nó nói điều tôi muốn nghe.`],
        [`Answers to “ruler”|Gọi “thước ơi” là thưa`, `It never answered to anything. A quiet tool. That’s why we got on.|Nó chưa thưa ai bao giờ. Đồ nghề ít lời. Thế nên hai bên mới hợp nhau.`],
        [`One metre, last seen being one metre|Dài một mét, lần cuối thấy vẫn dài một mét`, `Good. And if it comes back any longer, we’ll know it has been listening to Ellis’s fish stories.|Được. Nếu lúc về nó dài hơn, ta biết ngay nó đã ngồi nghe ông Ellis kể chuyện cá.`],
      ] },
    } },
    { id: 'report-hugo', when: { who: 'hugo' }, nodes: {
      a: { say: `I’m reporting a missing loaf. I put twelve in the window. Now there are eleven, and a very pleased goat outside.|Tôi báo mất một ổ bánh mì. Tôi bày mười hai ổ bên cửa sổ. Giờ còn mười một, và một con dê mặt rất mãn nguyện ngoài kia.`, choices: [
        [`Any evidence?|Có chứng cứ gì không?`, `Crumbs to the door, then a hoofprint in the flour. I’m no detective, but I knead to know.|Vụn bánh rải ra cửa, rồi một dấu móng in trên bột. Tôi không phải thám tử, nhưng vụ này tôi phải nhào cho ra lẽ.`, 'b'],
        [`Maybe you miscounted|Hay là anh đếm nhầm`, `A baker never counts short. We’re the people who put thirteen in a dozen. One less isn’t maths. It’s a goat.|Thợ bánh chỉ đếm dư chứ không đếm thiếu. Mua chục tôi còn biếu thêm một. Thiếu một ổ thì không phải toán. Là dê.`, 'b'],
        [`Was it a good loaf?|Ổ bánh đó có ngon không?`, `The best. Crusty, warm, a rising star. It had its whole life a-bread of it.|Ngon nhất mẻ. Giòn, ấm, đang nở mày nở mặt. Cả một tương lai phồng thơm đang chờ nó.`],
      ] },
      b: { say: `Pearl asks what I’d like done about it. What’s fair, do you think?|Cô Pearl hỏi tôi muốn giải quyết thế nào. Bạn thấy sao thì công bằng?`, choices: [
        [`Let Biscuit off with a warning|Nhắc nhở Biscuit rồi tha`, `A stern one. I’ll deliver it myself, with a carrot, so she listens.|Nhắc thật nghiêm. Tôi sẽ tự đi nhắc, cầm sẵn củ cà rốt để nó chịu nghe.`],
        [`Bake a goat-proof loaf|Nướng loại bánh dê không cắn nổi`, `I did once. Hard as a brick. Ash asked to buy six for a wall.|Tôi nướng một lần rồi. Cứng như gạch. Anh Ash hỏi mua sáu ổ về xây tường.`],
        [`Charge her a bun fee|Thu của nó tiền bánh`, `She has no pockets. Mara says put it on her tab. That tab is already longer than my baguettes.|Nó làm gì có túi. Chị Mara bảo cứ ghi sổ. Cuốn sổ nợ ấy giờ dài hơn cả bánh mì que của tôi rồi.`],
      ] },
    } },
  ],
};
