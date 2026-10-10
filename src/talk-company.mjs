// Conversations by choice at Willow & Co. (the village office): Bea, Leo, Fern and the villagers who read the hiring board.
export default {
  bea: [
    { id: 'bea-meeting', nodes: {
      a: { say: `This morning’s meeting took an hour. We decided one thing: to hold another meeting. Shall I read you the minutes?|Sáng nay họp mất một tiếng. Quyết được đúng một việc: họp thêm buổi nữa. Tôi đọc biên bản cho bạn nghe nhé?`, choices: [
        [`Yes, read them out|Vâng, đọc đi`, `“Nine o’clock: tea. Half past nine: more tea. Ten o’clock: Leo asked what the meeting was about.” That is all of it.|“Chín giờ: uống trà. Chín rưỡi: uống trà tiếp. Mười giờ: anh Leo hỏi họp về việc gì.” Hết biên bản.`, 'b'],
        [`Could it have been a note?|Viết một tờ giấy có xong không?`, `It was a note. We held the meeting to decide who would read the note.|Vốn là một tờ giấy đấy. Họp là để bàn xem ai đọc tờ giấy.`, 'b'],
        [`I will read them next year|Sang năm tôi đọc`, `Wise. By then they will be history, and history is always more interesting than minutes.|Khôn đấy. Đến lúc ấy nó thành lịch sử, mà lịch sử thì bao giờ cũng hay hơn biên bản.`],
      ] },
      b: { say: `The next meeting has one item, sent in by the suggestion box: “more carrots, fewer meetings”. How do you vote, boss?|Buổi họp tới có một mục, do hòm thư góp ý gửi: “thêm cà rốt, bớt họp”. Sếp biểu quyết thế nào?`, choices: [
        [`In favour of the carrots|Tôi bầu cho cà rốt`, `Carried! I shall announce it at a short meeting. Very short. We will stand up, so nobody gets comfortable.|Thông qua! Tôi sẽ báo tin ở một buổi họp ngắn. Rất ngắn. Họp đứng, cho khỏi ai ngồi ấm chỗ.`],
        [`Who wrote that suggestion?|Ai viết góp ý đó vậy?`, `It is unsigned. But the paper smells of carrots and has a hoof print, so I suspect Biscuit the goat.|Không ký tên. Nhưng tờ giấy thơm mùi cà rốt, lại in một dấu móng, nên tôi ngờ con dê Biscuit.`],
        [`Let us meet about it|Ta họp bàn chuyện này đi`, `A meeting about having fewer meetings. You truly are management. I will put the kettle on.|Họp để bàn chuyện bớt họp. Bạn đúng là có tố chất lãnh đạo. Để tôi đặt ấm nước.`],
      ] },
    } },
    { id: 'bea-shift', when: { fresh: 'company' }, nodes: {
      a: { say: `There is a free desk with your name on it. I was not sure of the spelling, so it has your name on it three ways. Fancy a shift?|Có một bàn trống ghi tên bạn. Tôi không chắc chính tả nên ghi luôn ba kiểu. Bạn làm một ca nhé?`, choices: [
        [`Yes, I will take a shift|Được, tôi nhận một ca`, `Splendid. The orders are on the left, the stamps on the right, and the biscuits are a rumour.|Tuyệt. Đơn hàng bên trái, con dấu bên phải, còn bánh quy thì mới chỉ là tin đồn.`, '', 'shift'],
        [`What does the job involve?|Việc gồm những gì?`, `Three things: packing the orders, stamping the papers, and looking for the stapler.|Có ba việc: đóng gói đơn hàng, đóng dấu giấy tờ, và đi tìm cái dập ghim.`, 'b'],
        [`I am the boss. Must I?|Tôi là sếp mà. Có bắt buộc không?`, `Not at all. But the staff work twice as fast when the boss is here. Mostly at hiding the biscuits.|Không hề. Nhưng có sếp thì nhân viên nhanh gấp đôi. Chủ yếu là nhanh tay giấu bánh quy.`],
      ] },
      b: { say: `The stapler vanished on Tuesday. I am searching for it by the window. Which of the three jobs suits you best?|Cái dập ghim mất từ thứ Ba. Tôi đang tìm nó ở chỗ cửa sổ. Trong ba việc, bạn hợp việc nào nhất?`, choices: [
        [`Packing. I am good with boxes|Đóng gói. Tôi giỏi xếp hộp`, `Then the free desk is yours. Carrots go pointy end down, and no tasting until the lid is on.|Vậy bàn trống là của bạn. Cà rốt xếp đầu nhọn xuống dưới, và đậy nắp rồi mới được nếm.`, '', 'shift'],
        [`Stamping. Thump, thump|Đóng dấu. Cộp, cộp`, `A natural. Stamp the paper, not the desk. The desk has been APPROVED eleven times already.|Có khiếu đấy. Đóng vào giấy, đừng đóng vào bàn. Cái bàn đã được ĐÃ DUYỆT mười một lần rồi.`, '', 'shift'],
        [`Did you lose it by the window?|Nó mất ở chỗ cửa sổ à?`, `No, in the dark cupboard. But the light is much better over here, so here is where I look.|Không, mất trong cái tủ tối om. Nhưng ngoài này sáng sủa hơn nhiều, nên tôi tìm ở đây.`],
      ] },
    } },
    { id: 'bea-done', when: { done: 'company' }, nodes: {
      a: { say: `A whole shift from the boss! I have filed it under “Wonders”, right beside the day the printer worked first time.|Sếp làm trọn một ca! Tôi xếp vào hồ sơ “Chuyện lạ”, ngay cạnh cái ngày máy in chạy được từ lần đầu.`, choices: [
        [`How did I do?|Tôi làm có được không?`, `Every order packed, and only one carrot posted to the wrong village. They wrote back to say thank you.|Đơn nào cũng gói xong, chỉ gửi nhầm một củ cà rốt sang làng bên. Bên ấy đã viết thư cảm ơn.`, 'b'],
        [`My stamping arm is tired|Tay đóng dấu của tôi mỏi rồi`, `That is how you know it was real work. A tired arm is the only certificate this office gives.|Thế mới biết là làm thật. Ở đây, cánh tay mỏi chính là tấm bằng khen duy nhất.`, 'b'],
        [`I want a medal|Tôi muốn được huy chương`, `I can offer a round stamp on a ribbon. From far away, in poor light, it is a medal.|Tôi có con dấu tròn buộc dây ruy băng. Đứng xa mà nhìn, lúc tranh tối tranh sáng, thì đúng là huy chương.`],
      ] },
      b: { say: `I wrote today’s report in one line, to save paper. Would you like to hear it before it goes in the drawer?|Tôi viết báo cáo hôm nay gọn trong một dòng cho đỡ tốn giấy. Bạn nghe trước khi tôi cất vào ngăn kéo nhé?`, choices: [
        [`Go on, read the line|Đọc dòng ấy đi`, `“Boss came, boss worked, nobody fainted.” I think it is the best report we have ever had.|“Sếp đến, sếp làm, không ai ngất.” Tôi cho đó là bản báo cáo hay nhất từ trước tới giờ.`],
        [`Add that I found a pencil|Ghi thêm là tôi tìm thấy cây bút chì`, `Then it is two lines, and a two-line report needs a meeting. I will keep the pencil quiet.|Thế thành hai dòng, mà báo cáo hai dòng là phải họp. Thôi, chuyện cây bút chì tôi giữ kín.`],
        [`Which drawer is that?|Ngăn kéo nào thế?`, `The one that sticks. Nothing has ever come out of it, so it is the safest place in Willowmere.|Cái ngăn bị kẹt ấy. Xưa nay chưa thứ gì ra khỏi nó, nên đó là chỗ an toàn nhất Willowmere.`],
      ] },
    } },
    { id: 'bea-chair', when: { from: 13 }, nodes: {
      a: { say: `I am keeping your chair warm. It is harder than it looks: I have been at it since lunch and I may need a rest.|Tôi đang ngồi giữ ấm ghế cho bạn. Việc này khó hơn bạn tưởng: tôi ngồi từ trưa tới giờ, chắc phải nghỉ một lát.`, choices: [
        [`What have you stamped today?|Hôm nay cô đóng dấu những gì rồi?`, `Forty orders, two letters and, by accident, one sandwich. The sandwich is now APPROVED.|Bốn mươi đơn hàng, hai lá thư, và lỡ tay một cái bánh mì kẹp. Giờ cái bánh đã được ĐÃ DUYỆT.`, 'b'],
        [`Is my chair comfortable?|Ghế của tôi ngồi có êm không?`, `Too comfortable. I sat down to sign one paper and woke up to find I had signed a very nice nap.|Êm quá mức. Tôi ngồi xuống ký một tờ giấy, lúc tỉnh dậy mới biết mình vừa ký xong một giấc ngon lành.`, 'b'],
        [`Keep it. I like standing|Cô cứ ngồi. Tôi thích đứng`, `A boss who stands! The news will be round the village before your knees get tired.|Sếp mà chịu đứng! Tin này sẽ chạy khắp làng trước khi đầu gối bạn kịp mỏi.`],
      ] },
      b: { say: `There is one paper left that needs the boss. It asks: “Should the office clock be right, or stay ten minutes kind?”|Còn một tờ giấy phải chờ sếp. Nó hỏi: “Đồng hồ văn phòng nên chạy đúng, hay cứ dễ tính chậm mười phút như cũ?”`, choices: [
        [`Make it right|Chỉnh cho đúng đi`, `Stamped. Leo will be late for the first time in his life, and he will not understand why.|Đóng dấu. Lần đầu tiên trong đời anh Leo sẽ đi muộn, mà không hiểu vì sao.`],
        [`Stay ten minutes kind|Cứ để dễ tính mười phút`, `Stamped twice, for joy. A kind clock is the cheapest pay rise there is.|Đóng hai lần cho vui. Cái đồng hồ dễ tính là kiểu tăng lương đỡ tốn nhất trên đời.`],
        [`Ask the suggestion box|Hỏi hòm thư góp ý xem`, `I did. It holds one note, and the note says “please empty the suggestion box”.|Hỏi rồi. Trong hòm có đúng một tờ, ghi rằng “làm ơn dọn hòm thư góp ý”.`],
      ] },
    } },
    { id: 'bea-hire', nodes: {
      a: { say: `I wrote a notice for the hiring board: “Willow & Co. seeks kind helpers here.” Then everyone gave advice. Now it just says “helpers”.|Tôi viết bảng tuyển người: “Willow & Co. cần tìm người giúp việc tốt bụng ở đây.” Ai đi qua cũng góp ý. Giờ chỉ còn hai chữ “người giúp”.`, choices: [
        [`Let me read the board|Cho tôi xem bảng tuyển người`, `Do. Your neighbours are on it, and each one has promised to be useful at least once a day.|Mời bạn. Hàng xóm của bạn có tên cả đấy, ai cũng hứa mỗi ngày có ích ít nhất một lần.`, '', 'hire'],
        [`What did they cut?|Họ bảo bỏ những chữ nào?`, `Hugo said “kind” goes without saying. Pearl said “here” is plain to see. And “seeks” sounded too keen.|Anh Hugo bảo “tốt bụng” thì khỏi nói. Cô Pearl bảo “ở đây” ai chẳng thấy. Còn “cần tìm” nghe sốt sắng quá.`, 'b'],
        [`Cut “helpers” too|Bỏ nốt chữ “người giúp” đi`, `A blank board? The crow would apply at once. It thinks every empty place is an invitation.|Bảng trắng trơn à? Con quạ sẽ xin việc ngay. Nó coi chỗ trống nào cũng là lời mời.`],
      ] },
      b: { say: `So, village leader, you decide: what should the hiring board say?|Vậy trưởng làng quyết đi: bảng tuyển người nên ghi gì?`, choices: [
        [`Put every word back|Viết lại đủ cả câu`, `Done. And if anyone has advice, I will hire them on the spot to repaint the sign.|Xong. Ai còn góp ý nữa, tôi tuyển luôn tại chỗ vào việc sơn lại bảng.`, '', 'hire'],
        [`Just draw a carrot|Vẽ một củ cà rốt là đủ`, `Then only Biscuit will apply. To be fair, that goat has never missed a day of eating.|Thế thì chỉ có dê Biscuit nộp đơn. Mà nói cho công bằng, nó chưa nghỉ ăn ngày nào.`],
        [`“Tea provided”|“Có trà uống”`, `Two words, and the whole village will queue. You have a gift for this. Come and see who is on the board.|Ba chữ thôi mà cả làng sẽ xếp hàng. Bạn có khiếu đấy. Lại xem trên bảng có những ai nào.`, '', 'hire'],
      ] },
    } },
    { id: 'bea-printer', nodes: {
      a: { say: `The printer is jammed again. I asked it for one page. It gave me half a page and a long, sad sigh.|Máy in lại kẹt giấy. Tôi xin nó một trang. Nó đưa nửa trang kèm một tiếng thở dài não nề.`, choices: [
        [`Shall I take a look?|Để tôi xem thử nhé?`, `Brave. There are four kinds of people at a jammed printer, and I have met all four this morning.|Gan đấy. Đứng trước máy in kẹt giấy có bốn kiểu người, sáng nay tôi gặp đủ cả bốn.`, 'b'],
        [`Speak kindly to it|Nói ngọt với nó xem`, `I tried. I said “good printer”. It printed the word “good” and kept the rest of my letter.|Thử rồi. Tôi bảo “máy in ngoan”. Nó in ra đúng chữ “ngoan” rồi giữ luôn phần còn lại của lá thư.`, 'b'],
        [`Write it by hand|Viết tay cho xong`, `I did, for forty years. My handwriting never jammed, though Pearl says it looks like hens dancing.|Tôi viết tay bốn mươi năm rồi. Chữ tôi chưa kẹt bao giờ, dù cô Pearl bảo trông như gà nhảy múa.`],
      ] },
      b: { say: `One walks past whistling. One tells everybody. One explains how to mend it. One rolls up a sleeve. Which are you?|Kiểu một huýt sáo đi qua. Kiểu hai đi báo cả làng. Kiểu ba giảng cách sửa. Kiểu bốn xắn tay áo. Bạn là kiểu nào?`, choices: [
        [`I roll up my sleeve|Tôi xắn tay áo`, `The rarest kind. Mind your sleeve, though. The printer ate Leo’s cuff in spring and has not said sorry.|Kiểu hiếm nhất. Nhưng coi chừng tay áo: hồi mùa xuân máy in xơi mất cổ tay áo anh Leo, đến giờ chưa xin lỗi.`],
        [`I whistle rather well|Tôi huýt sáo khá hay`, `An honest boss. Whistle something cheerful, then. The printer likes music better than it likes paper.|Một vị sếp thật thà. Vậy huýt bài gì vui vui nhé. Cái máy in này thích nhạc hơn thích giấy.`],
        [`I tell everybody|Tôi đi báo cả làng`, `That post is taken, dear. I had told the whole village before the printer had finished sighing.|Chỗ đó có người rồi bạn ạ. Máy in chưa thở dài xong thì tôi đã báo khắp làng.`],
      ] },
    } },
  ],
  leo: [
    { id: 'leo-stapler', nodes: {
      a: { say: `The stapler looked cold, so I wove it a little cosy. Now nobody can find the stapler. Have you seen a very small rug with a lump in it?|Thấy cái dập ghim có vẻ lạnh, tôi dệt cho nó cái áo ấm. Giờ không ai tìm ra nó nữa. Bạn có thấy tấm thảm tí hon nào cộm lên một cục không?`, choices: [
        [`What colour is the cosy?|Cái áo ấm màu gì?`, `The colour of the desk. I wanted it to feel at home. I see now that this was the mistake.|Màu mặt bàn. Tôi muốn nó thấy thân thuộc như ở nhà. Giờ tôi mới hiểu mình sai ở chỗ ấy.`, 'b'],
        [`Have you tried calling it?|Anh thử gọi nó chưa?`, `I called “stapler, stapler” for a while. Fern’s chair creaked, but I think that was only Fern.|Tôi gọi “ghim ơi, ghim à” một hồi. Ghế của cô Fern kêu cót két, nhưng chắc chỉ là cô Fern thôi.`, 'b'],
        [`Weave a bright one next time|Lần sau dệt cái áo sặc sỡ nhé`, `Bright orange, with a bell. A stapler that jingles. You have just made the office a happier place.|Màu cam chói, đính thêm cái chuông. Dập ghim kêu leng keng. Bạn vừa làm văn phòng vui hẳn lên.`],
      ] },
      b: { say: `Bea says the crow took it, because it is shiny. But it is not shiny any more. It is woolly. Where would you look?|Cô Bea bảo con quạ tha đi vì nó sáng bóng. Nhưng nó hết bóng rồi, giờ nó xù lông. Bạn thì sẽ tìm ở đâu?`, choices: [
        [`Under your papers|Dưới chồng giấy của anh`, `Oh. There it is, and my lunch from Monday, and a letter I meant to post in spring. What a good day.|Ồ. Nó đây rồi, cả bữa trưa hôm thứ Hai, cả lá thư tôi định gửi từ mùa xuân. Hôm nay đẹp trời thật.`],
        [`In the crow’s nest|Trong tổ quạ`, `Then the crow has a warm stapler and a tidy nest. I cannot be cross. I will weave it a second one.|Thế thì quạ có cái dập ghim ấm áp và cái tổ gọn gàng. Tôi chẳng giận nổi. Để tôi dệt cho nó cái nữa.`],
        [`Let it go and use paper clips|Thôi kệ, dùng kẹp giấy vậy`, `Paper clips look cold as well, now you say it. Excuse me, I have forty very small cosies to weave.|Bạn nhắc mới nhớ, kẹp giấy trông cũng lạnh. Xin lỗi nhé, tôi còn bốn mươi cái áo tí hon phải dệt.`],
      ] },
    } },
    { id: 'leo-lunch', when: { from: 12, to: 13 }, nodes: {
      a: { say: `I only brought plain rice. So I ate it beside Hugo’s warm loaf, breathing in. It was delicious. Do I owe Hugo for the smell?|Tôi chỉ mang cơm trắng. Nên tôi ngồi ăn cạnh ổ bánh nóng của anh Hugo, vừa ăn vừa hít. Ngon tuyệt. Tôi có nợ anh ấy tiền mùi không nhỉ?`, choices: [
        [`Pay with the clink of a coin|Trả bằng tiếng đồng xu leng keng`, `A sound for a smell! I shall jingle my pocket as I pass the bakery. Hugo will be paid in full.|Lấy tiếng trả mùi! Đi ngang lò bánh tôi sẽ lắc túi leng keng. Thế là trả anh Hugo đủ cả vốn lẫn lãi.`, 'b'],
        [`Tell him it smelled lovely|Khen anh ấy là bánh thơm lắm`, `I did. He said compliments are the only thing in his shop that never goes stale.|Khen rồi. Anh ấy bảo trong tiệm chỉ có lời khen là để mấy hôm cũng không ỉu.`, 'b'],
        [`Next time, borrow the taste too|Lần sau mượn luôn cả vị đi`, `I asked. He said the taste lives inside the loaf and does not go out visiting. Very sensible.|Hỏi rồi. Anh ấy bảo cái vị nó ở trong ổ bánh, không ra ngoài chơi. Nghe cũng phải.`],
      ] },
      b: { say: `The coffee machine is singing. It takes four minutes and makes a sound like a kettle with opinions. Would you like a cup?|Máy pha cà phê đang hát kìa. Nó pha mất bốn phút và kêu như cái ấm nước có chính kiến. Bạn uống một tách nhé?`, choices: [
        [`Yes please, a small one|Vâng, cho tôi một tách nhỏ`, `Here. I stirred it nine times each way, like a warp and a weft. It is very well woven coffee.|Đây. Tôi khuấy xuôi chín vòng, ngược chín vòng, như sợi dọc sợi ngang. Cà phê này dệt kỹ lắm.`, '', 'energy'],
        [`What is it singing?|Nó hát bài gì thế?`, `The same song as the kettle at home, only slower, and with a cough at the end.|Vẫn bài của cái ấm ở nhà, có điều chậm hơn, và cuối bài có thêm một tiếng ho.`],
        [`I will just smell it|Tôi ngửi thôi là đủ`, `Then you owe the machine the clink of a spoon. Tap the cup twice. There, all square.|Vậy bạn nợ cái máy một tiếng thìa leng keng. Gõ vào tách hai cái. Đấy, sòng phẳng rồi.`],
      ] },
    } },
    { id: 'leo-scarf', nodes: {
      a: { say: `I wove a new scarf last night. I have stood by this door all morning and nobody has said a word about it. Are you looking for something?|Tối qua tôi dệt cái khăn mới. Tôi đứng cạnh cửa suốt buổi sáng mà chẳng ai nói câu nào. Bạn đang tìm gì à?`, choices: [
        [`Have you seen Bea?|Anh có thấy cô Bea không?`, `Since I put on this NEW SCARF, nobody at all has come past me. Not even Bea.|Từ lúc tôi quàng cái KHĂN MỚI này, chưa thấy ai đi ngang qua cả. Kể cả cô Bea.`, 'b'],
        [`What a handsome scarf|Cái khăn đẹp quá`, `At last! I can sit down now. My legs gave up an hour ago, but the scarf would not let me.|Mãi mới có người khen! Giờ tôi ngồi được rồi. Chân mỏi từ một tiếng trước mà cái khăn chưa cho ngồi.`, 'b'],
        [`Is that a rug on your neck?|Anh quàng tấm thảm lên cổ đấy à?`, `It began as a rug. Then it kept getting narrower, so I told it kindly that it was a scarf.|Lúc đầu nó là tấm thảm. Rồi càng dệt càng hẹp, tôi đành nhẹ nhàng báo cho nó biết: mày là cái khăn.`],
      ] },
      b: { say: `Fern says I should simply tell people. But a scarf should be noticed, not announced. Do you think so too?|Cô Fern bảo cứ nói thẳng ra cho mọi người biết. Nhưng khăn đẹp là để người ta tự thấy, ai lại đi rao. Bạn thấy đúng không?`, choices: [
        [`Wear it to the harvest supper|Quàng đi bữa tiệc mùa đi`, `Everyone in one place, and me by the soup. Forty people will notice at once. You think like a weaver.|Cả làng tụ một chỗ, còn tôi đứng cạnh nồi súp. Bốn mươi người cùng thấy một lúc. Bạn nghĩ y như thợ dệt.`],
        [`Put a little sign on it|Gắn cái biển nhỏ lên khăn`, `“New.” One word, pinned at the front. Modest, yet clear. I only need to find the stapler first.|“Mới.” Một chữ thôi, ghim đằng trước. Khiêm tốn mà rõ ràng. Chỉ cần tìm ra cái dập ghim đã.`],
        [`I will tell Bea|Để tôi kể với cô Bea`, `Then the pond, the hens and the next village will know by teatime. That is better than any sign.|Thế thì đến giờ trà chiều, cả cái ao, đàn gà lẫn làng bên đều biết. Hơn đứt mọi tấm biển.`],
      ] },
    } },
    { id: 'leo-dream', when: { from: 14 }, nodes: {
      a: { say: `I was not asleep. I was checking the pattern on the inside of my eyelids. It is a very fine pattern.|Tôi không ngủ đâu. Tôi đang xem hoa văn ở mặt trong mí mắt. Hoa văn đẹp lắm.`, choices: [
        [`What did the pattern show?|Hoa văn ấy vẽ gì thế?`, `A rug as wide as the pond, with a golden fish in every corner. Then Fern coughed and it unravelled.|Một tấm thảm rộng bằng cái ao, góc nào cũng có một con cá vàng. Rồi cô Fern ho một tiếng, thế là nó tuột chỉ hết.`, 'b'],
        [`You were snoring, Leo|Anh ngáy đấy, anh Leo`, `That was the loom in my dream. It needs oiling. I shall mention it the next time I am there.|Đấy là tiếng khung cửi trong mơ. Nó cần tra dầu. Lần tới ghé qua đó tôi sẽ nhắc.`, 'b'],
        [`Carry on, I saw nothing|Cứ tiếp tục, tôi không thấy gì`, `The kindest boss in Willowmere. I will dream you a corner office with a hammock in it.|Vị sếp tốt bụng nhất Willowmere. Tôi sẽ mơ cho bạn một phòng làm việc ở góc, có mắc cái võng.`],
      ] },
      b: { say: `Bea says I must count orders in the afternoon, not sheep. But the orders are for wool. What is a weaver to do?|Cô Bea bảo buổi chiều tôi phải đếm đơn hàng chứ không được đếm cừu. Nhưng đơn hàng toàn là len. Thợ dệt biết làm sao đây?`, choices: [
        [`Count them standing up|Đứng dậy mà đếm`, `Clever. Nobody has ever dozed off standing up. Except the cow, and she gets all her work done.|Hay. Xưa nay chưa ai ngủ đứng. Trừ con bò, mà nó vẫn làm xong hết việc đấy thôi.`],
        [`Have a coffee first|Uống tách cà phê trước đã`, `We will share the pot. One cup for you, one for me, and a drop for the plant, who looks sleepy too.|Mình chia nhau một ấm. Bạn một tách, tôi một tách, thêm một giọt cho chậu cây, trông nó cũng buồn ngủ.`, '', 'energy'],
        [`Count the sheep out loud|Đếm cừu thành tiếng đi`, `One, two, three... no, Fern has nodded off already. You see? It is not me. It is the sheep.|Một, hai, ba... thôi, cô Fern gật gù mất rồi. Bạn thấy chưa? Đâu phải tại tôi. Tại lũ cừu đấy.`],
      ] },
    } },
    { id: 'leo-rain', when: { rain: true }, nodes: {
      a: { say: `Listen to the rain on the roof. It is weaving, you know. Thousands of threads, straight down, and it never drops a stitch.|Bạn nghe mưa trên mái kìa. Nó đang dệt đấy. Hàng nghìn sợi thẳng tắp từ trên xuống, không lỗi một mũi nào.`, choices: [
        [`What is it weaving?|Nó dệt cái gì thế?`, `A puddle, mostly. A large grey one by the door. It is not finished, but I admire the patience.|Chủ yếu là một vũng nước. Vũng to màu xám ngay cửa. Chưa xong đâu, nhưng tôi phục cái tính kiên nhẫn.`, 'b'],
        [`Did you bring an umbrella?|Anh có mang ô không?`, `I brought a rug, by mistake. It kept me dry for six steps and it now weighs as much as the cow.|Tôi mang nhầm một tấm thảm. Nó che được sáu bước, và giờ thì nặng ngang con bò.`, 'b'],
        [`The rain works harder than us|Mưa còn chăm hơn chúng ta`, `And it asks for no wages and takes no lunch. Please do not let Bea hear, she will hire it.|Mà nó chẳng đòi lương, chẳng nghỉ trưa. Đừng để cô Bea nghe thấy, cô ấy tuyển nó mất.`],
      ] },
      b: { say: `My wet rug is drying on the meeting room table. Bea wanted that table for a meeting. Have I done a bad thing or a good thing?|Tấm thảm ướt của tôi đang phơi trên bàn phòng họp. Cô Bea thì cần cái bàn ấy để họp. Tôi vừa làm việc xấu hay việc tốt nhỉ?`, choices: [
        [`A very good thing|Việc rất tốt`, `So I thought. One wet rug has saved the whole office an hour. I should be on the hiring board.|Tôi cũng nghĩ thế. Một tấm thảm ướt cứu cả văn phòng được một tiếng. Lẽ ra tôi phải có tên trên bảng tuyển người.`],
        [`Hold the meeting on the rug|Trải thảm ra mà ngồi họp`, `A picnic meeting, on a damp rug, with tea. Everyone will agree quickly just to stand up again.|Họp kiểu dã ngoại, trên thảm ẩm, có trà. Ai cũng sẽ đồng ý thật nhanh để còn được đứng dậy.`],
        [`Move it before Bea sees|Dời đi trước khi cô Bea thấy`, `Too late. Bea knew before the rug was wet. I think she knew before it rained.|Muộn rồi. Thảm chưa kịp ướt cô Bea đã biết. Tôi ngờ là trời chưa mưa cô ấy đã biết rồi.`],
      ] },
    } },
  ],
  fern: [
    { id: 'fern-chair', nodes: {
      a: { say: `I keep this chair for unexpected visitors. But you are the boss, so you were expected. Could you go out and come back in by surprise?|Cái ghế này tôi dành cho khách bất ngờ. Nhưng bạn là sếp, tức là khách có hẹn. Bạn ra ngoài rồi bất ngờ bước vào lại được không?`, choices: [
        [`Surprise! It is me|Bất ngờ chưa! Tôi đây`, `Goodness, what a shock. Do sit down. It is the nicest chair in the office and it has waited all week.|Ôi, giật cả mình. Mời ngồi. Ghế đẹp nhất văn phòng đấy, nó đợi cả tuần rồi.`, 'b'],
        [`Who was the last visitor?|Vị khách gần đây nhất là ai?`, `A hen. She walked in, sat for an hour and left without a word. A perfect visitor.|Một cô gà mái. Nó bước vào, ngồi một tiếng rồi đi, không nói câu nào. Khách thế mới là khách quý.`, 'b'],
        [`I will stand. Save it|Tôi đứng được. Cứ để dành`, `You understand furniture. A chair that is saved for someone is the happiest chair there is.|Bạn hiểu đồ gỗ đấy. Cái ghế được để dành cho ai đó là cái ghế hạnh phúc nhất trần đời.`],
      ] },
      b: { say: `I have built a second chair, in case two visitors arrive unexpectedly. Now I worry about three. Where does it stop?|Tôi đóng thêm cái ghế thứ hai, phòng khi có hai vị khách bất ngờ. Giờ tôi lại lo có ba vị. Biết dừng ở đâu bây giờ?`, choices: [
        [`Build one long bench|Đóng một cái ghế băng dài`, `A bench! One piece of wood for a whole village of surprises. That is the wisest thing said here all week.|Ghế băng! Một tấm gỗ đón được cả làng khách bất ngờ. Câu khôn nhất tuần này ở đây đấy.`],
        [`It stops at the door|Dừng ở chỗ cửa ra vào`, `True. The door fits one visitor at a time. I shall thank the door. It has been managing me for years.|Phải. Cửa chỉ lọt mỗi lần một người. Tôi phải cảm ơn cái cửa, bao năm nay nó quản tôi khéo thật.`],
        [`Keep building. I like chairs|Cứ đóng tiếp. Tôi thích ghế`, `Then one day this will be a room of chairs with a small office in the corner. I can see it already.|Thế thì có ngày nơi này thành căn phòng toàn ghế, văn phòng nằm gọn một góc. Tôi hình dung ra rồi.`],
      ] },
    } },
    { id: 'fern-cooler', when: { from: 13, to: 14 }, nodes: {
      a: { say: `Lower your voice. The water cooler gossips. Tell a secret near it and it goes “blub”, and by teatime Bea knows.|Nói nhỏ thôi. Cái bình nước này hay buôn chuyện lắm. Kể bí mật gần nó là nó “ục” một tiếng, đến giờ trà chiều cô Bea đã biết.`, choices: [
        [`What has it been saying?|Nó vừa buôn chuyện gì thế?`, `That the fridge is cross. Somebody labelled a pudding “Fern” and it was not me. Now there are two Ferns.|Rằng cái tủ lạnh đang dỗi. Có người dán nhãn “Fern” lên hộp bánh mà không phải tôi. Giờ có tới hai Fern.`, 'b'],
        [`Let us test it with a secret|Thử kể một bí mật xem sao`, `Good. I will say it softly: “The boss likes two sugars.” ... Did you hear that blub? It is on its way.|Được. Tôi nói khẽ nhé: “Sếp uống trà hai thìa đường.” ... Bạn nghe tiếng “ục” chưa? Tin đang đi rồi đấy.`, 'b'],
        [`It is only bubbles, Fern|Chỉ là bọt nước thôi, cô Fern`, `That is exactly what it wants you to think. Bubbles are how water whispers.|Nó muốn bạn nghĩ đúng như thế đấy. Sủi bọt chính là cách nước thì thầm.`],
      ] },
      b: { say: `I am having my lunch facing the coffee machine instead. It only hisses. Hissing I can trust. Will you sit with me?|Nên tôi quay sang ngồi ăn trưa với cái máy pha cà phê. Nó chỉ biết xì hơi. Xì hơi thì tin được. Bạn ngồi cùng tôi nhé?`, choices: [
        [`Gladly. What is for lunch?|Vui lòng. Trưa nay ăn gì?`, `Pumpkin rice, on a table I made last week. It does not wobble. I checked it with a full bowl of soup.|Cơm bí đỏ, bày trên cái bàn tôi đóng tuần trước. Không cập kênh đâu. Tôi thử bằng một bát súp đầy rồi.`],
        [`Only if the fridge agrees|Nếu tủ lạnh đồng ý đã`, `It hummed. I take that as a yes. It hums all day, which makes it the most agreeable one in the office.|Nó vừa ù ù đấy. Tôi coi như đồng ý. Nó ù ù cả ngày, nên là đứa dễ tính nhất văn phòng.`],
        [`Tell the cooler I said hello|Chuyển lời chào của tôi tới bình nước`, `Blub. There. By tomorrow all Willowmere will hear that the boss talks to the furniture. Welcome to my side.|Ục. Đấy. Mai là cả Willowmere biết sếp nói chuyện với đồ đạc. Chào mừng bạn về phe tôi.`],
      ] },
    } },
    { id: 'fern-names', nodes: {
      a: { say: `I made every desk here, so I gave each one a name. Mine is Old Steady. Leo’s is Cloud. Bea’s is The Listening Post.|Bàn nào ở đây cũng do tôi đóng, nên tôi đặt tên cho từng cái. Bàn tôi tên Vững Chãi. Bàn anh Leo tên Đám Mây. Bàn cô Bea tên Trạm Nghe Ngóng.`, choices: [
        [`What is the boss’s desk called?|Thế bàn của sếp tên gì?`, `Sir. It is the only desk I am polite to. I knock before I open its drawers.|Tên là Ngài. Cái bàn duy nhất tôi phải giữ lễ. Muốn mở ngăn kéo tôi còn gõ trước.`, 'b'],
        [`Does anyone use the names?|Có ai gọi mấy cái tên đó không?`, `Leo does. Yesterday he said “I left my lunch on Cloud” and Bea went outside to look up.|Anh Leo có gọi. Hôm qua anh ấy nói “tôi để cơm trưa trên Đám Mây”, cô Bea chạy ra sân ngửa cổ nhìn trời.`, 'b'],
        [`And the printer?|Còn cái máy in?`, `I did not make the printer. So I have not named it. Everyone else has, and those names I will not repeat.|Máy in không phải tôi đóng nên tôi không đặt tên. Người khác đặt cả rồi, mà mấy cái tên đó tôi xin phép không nhắc lại.`],
      ] },
      b: { say: `The free desk by the window has no name yet. You may choose, since it is the one you sit at. What shall it be?|Cái bàn trống cạnh cửa sổ chưa có tên. Bạn hay ngồi bàn ấy, vậy mời bạn chọn. Đặt tên gì bây giờ?`, choices: [
        [`Carrot|Cà Rốt`, `Short, bright, and it will not make the other desks jealous. I shall carve it underneath, where it counts.|Ngắn, tươi, lại không làm mấy bàn kia ghen tị. Tôi sẽ khắc ở mặt dưới, chỗ quan trọng nhất.`],
        [`The Desk of Great Decisions|Bàn Của Những Quyết Định Lớn`, `That is forty letters to carve, and the desk is small. May I shorten it to “Hmm”?|Khắc từng ấy chữ thì mỏi tay lắm, mà bàn lại nhỏ. Tôi rút gọn thành “Ừm” được không?`],
        [`Whatever you like, Fern|Tùy cô Fern`, `Then it is Welcome. A desk for whoever turns up. I have always wanted to make one of those.|Vậy đặt là Mời Ngồi. Cái bàn dành cho bất cứ ai ghé qua. Tôi vẫn ao ước đóng được một cái như thế.`],
      ] },
    } },
    { id: 'fern-wobble', nodes: {
      a: { say: `The meeting room table wobbled. So I trimmed one leg. Then it wobbled the other way, so I trimmed another. Guess how tall it is now.|Bàn phòng họp bị cập kênh. Tôi cưa bớt một chân. Nó lại kênh sang bên kia, tôi cưa chân nữa. Bạn đoán xem giờ nó cao chừng nào.`, choices: [
        [`Knee height?|Ngang đầu gối?`, `Ankle height. We hold meetings sitting on the floor now. They are short, because knees have opinions.|Ngang mắt cá chân. Giờ họp phải ngồi bệt xuống sàn. Họp nhanh lắm, vì đầu gối ai cũng có ý kiến.`, 'b'],
        [`It is a tray now, is it not?|Giờ nó thành cái khay rồi chứ gì?`, `A very fine tray, with four small feet. Bea carries the tea on it and tells everyone it was the plan.|Một cái khay rất đẹp, có bốn cái chân tí xíu. Cô Bea dùng bưng trà, gặp ai cũng bảo đó là chủ ý từ đầu.`, 'b'],
        [`Why not fold a paper under it?|Sao không kê tờ giấy gấp xuống dưới?`, `A furniture maker does not use folded paper. We have our pride. We have a low table, but we have our pride.|Thợ đóng bàn ghế ai lại đi kê giấy. Chúng tôi có lòng tự trọng. Bàn thì thấp lè tè, nhưng tự trọng thì vẫn còn.`],
      ] },
      b: { say: `And today I found out why it wobbled. It was never the legs. It was the floor. What do I do about a floor?|Mà hôm nay tôi mới biết vì sao nó kênh. Không phải tại chân bàn. Tại cái sàn. Sàn nhà thì tôi biết làm gì bây giờ?`, choices: [
        [`Please do not trim the floor|Xin đừng cưa cái sàn`, `I had the saw in my hand. You came just in time. This is why a village needs a leader.|Tôi đang cầm cưa trong tay rồi đấy. Bạn đến vừa kịp. Bởi vậy làng mới cần có trưởng làng.`],
        [`Ask Ash the carpenter|Hỏi anh thợ mộc xem`, `He will look at it for a long while, say “hm”, and it will be level by supper. Carpenters are like that.|Anh ấy sẽ nhìn thật lâu, “hừm” một tiếng, và đến bữa tối là sàn phẳng lì. Thợ mộc là thế đấy.`],
        [`Make a table that likes wobbling|Đóng cái bàn thích cập kênh đi`, `A rocking table! The tea would spill, but the meetings would be over in a minute. I must draw this.|Bàn bập bênh! Trà thì đổ, nhưng họp một phút là xong. Tôi phải vẽ ngay mới được.`],
      ] },
    } },
    { id: 'fern-rain', when: { rain: true }, nodes: {
      a: { say: `When it rains the wood swells and every drawer in the office sticks shut. I call it the furniture taking a day off.|Trời mưa là gỗ nở ra, ngăn kéo nào trong văn phòng cũng kẹt cứng. Tôi gọi đó là ngày nghỉ phép của đồ gỗ.`, choices: [
        [`What is shut inside them?|Trong ngăn kéo đang kẹt những gì?`, `The orders, the stamps and Leo’s lunch. Leo is the calmest of us about it. He is talking to his drawer.|Đơn hàng, con dấu và bữa trưa của anh Leo. Anh ấy bình tĩnh nhất nhà, đang ngồi trò chuyện với cái ngăn kéo.`, 'b'],
        [`Can you not plane them down?|Bào bớt đi không được à?`, `Then on a dry day they would rattle like loose teeth. A drawer should fit on its good days.|Thế thì hôm nắng ráo chúng lại lỏng lẻo, kêu lạch cạch suốt. Ngăn kéo phải vừa khít vào những ngày đẹp trời của nó.`, 'b'],
        [`Then we all take a day off|Vậy ta nghỉ cả thôi`, `Spoken like a boss the furniture can respect. I will tell the chairs. They have been standing all year.|Nói thế mới là vị sếp được đồ gỗ nể. Để tôi báo cho mấy cái ghế, chúng nó đứng cả năm rồi.`],
      ] },
      b: { say: `Bea needs her stamp before the post goes. The stamp is in the top drawer and the top drawer says no. Any ideas?|Cô Bea cần con dấu trước giờ chuyển thư. Con dấu nằm trong ngăn trên cùng, mà ngăn trên cùng bảo không. Bạn có cao kiến gì không?`, choices: [
        [`Wait for the sun|Đợi nắng lên`, `The patient answer. Wood teaches that. The post will be a day late, and so will the rain’s apology.|Câu trả lời của người kiên nhẫn. Gỗ dạy ta điều đó. Thư sẽ chậm một ngày, lời xin lỗi của ông trời cũng vậy.`],
        [`We pull together, on three|Cùng kéo nào, đếm đến ba`, `One, two, three! ... It opened. So did the two below it. We have found the stapler, and a biscuit from winter.|Một, hai, ba! ... Mở rồi. Hai ngăn dưới cũng bật ra luôn. Tìm thấy cái dập ghim, với một cái bánh quy từ mùa đông.`],
        [`Bea can draw the stamp by hand|Cô Bea vẽ tay con dấu vậy`, `She tried. It came out as a potato with a crown. The next village will think we have a king.|Cô ấy vẽ thử rồi. Ra hình củ khoai đội vương miện. Làng bên sẽ tưởng bên mình có vua.`],
      ] },
    } },
  ],
  '@applicant': [
    { id: 'applicant-carrots', nodes: {
      a: { say: `The board says “helpers wanted, must be good with carrots”. I am very good with carrots. Mainly at eating them. Does that count?|Bảng ghi “cần người giúp, phải thạo cà rốt”. Tôi thạo cà rốt lắm. Chủ yếu là thạo ăn. Thế có tính không?`, choices: [
        [`It is a start|Cũng là một khởi đầu`, `That is what I said to myself after the first carrot. And after the ninth.|Ăn xong củ thứ nhất tôi cũng tự nhủ y như vậy. Ăn xong củ thứ chín vẫn vậy.`, 'b'],
        [`Can you also pack them?|Thế có biết đóng gói không?`, `I can pack a great many into one person. Into a box, I am willing to learn.|Xếp thật nhiều vào một người thì tôi làm được. Xếp vào hộp thì tôi sẵn lòng học.`, 'b'],
        [`Let us read the board together|Ta cùng xem bảng nào`, `Yes, do read it with me. You take the top half, I am stuck on the word “punctual”.|Vâng, bạn xem cùng tôi với. Bạn đọc nửa trên nhé, tôi đang mắc ở hai chữ “đúng giờ”.`, '', 'hire'],
      ] },
      b: { say: `It also asks for “a helpful person who starts early”. I am helpful. I am a person. Two out of three is a pass, is it not?|Bảng còn đòi “người được việc, bắt đầu từ sớm”. Tôi được việc. Tôi là người. Trúng hai trên ba là đỗ rồi, phải không?`, choices: [
        [`It is a pass in my village|Ở làng tôi thế là đỗ`, `Kind leader! I will start early tomorrow. Early for me, that is. The hens need not worry.|Trưởng làng tốt quá! Mai tôi sẽ bắt đầu từ sớm. Sớm kiểu của tôi thôi. Đàn gà khỏi phải lo bị tranh phần.`],
        [`How early is early for you?|Sớm của bạn là mấy giờ?`, `Before lunch. Well before. I have seen the morning several times and I liked it.|Trước bữa trưa. Trước hẳn hoi. Tôi từng thấy buổi sáng vài lần rồi, cũng ưng lắm.`],
        [`Set two alarm clocks|Đặt hai cái đồng hồ báo thức đi`, `I have a rooster. He is loud, but he keeps his own hours. I will have a word with him.|Tôi có con gà trống. Nó to mồm, nhưng gáy giờ nào tùy hứng. Để tôi nói chuyện với nó.`],
      ] },
    } },
    { id: 'applicant-fig', nodes: {
      a: { say: `Is there a job on this board for someone who lies under the orchard trees and waits for the fruit to fall? I have years of experience.|Trên bảng có việc nào cho người nằm dưới gốc cây trong vườn chờ quả rụng không? Món này tôi có thâm niên nhiều năm.`, choices: [
        [`How many fruits have you caught?|Bạn hứng được bao nhiêu quả rồi?`, `None in the mouth. One on the nose. I am told that with practice the aim improves.|Vào miệng thì chưa quả nào. Trúng mũi thì được một. Nghe nói cứ luyện rồi sẽ rụng chuẩn hơn.`, 'b'],
        [`We call that “orchard watch”|Việc đó gọi là “canh vườn”`, `A title! I knew it was a real profession. My mother always called it something shorter.|Có chức danh hẳn hoi! Tôi biết ngay là nghề đàng hoàng mà. Mẹ tôi thì toàn gọi bằng cái tên ngắn hơn.`, 'b'],
        [`Sylvie picks before they fall|Cô Sylvie hái trước khi rụng rồi`, `So that is why I have been so unlucky. All this time I blamed the wind.|Thảo nào tôi đen đủi mãi. Bấy lâu nay tôi cứ đổ tại gió.`],
      ] },
      b: { say: `I also have a friend who is lazier than I am. He would like to apply, but walking to the board seemed a great deal. Can I apply for him?|Tôi còn một anh bạn lười hơn cả tôi. Anh ấy muốn xin việc, nhưng đi bộ ra tới bảng thì ngại quá. Tôi nộp hộ được không?`, choices: [
        [`Only if he comes himself|Phải tự đến mới được`, `I will tell him. Not today, though. Today I have already walked here, and one must not overdo it.|Để tôi nhắn lại. Nhưng không phải hôm nay. Hôm nay tôi đã đi bộ tới tận đây rồi, làm quá sức là không nên.`],
        [`What is he good at?|Anh ấy giỏi việc gì?`, `Resting. Nobody rests like him. Put him beside a busy person and that person looks twice as busy.|Nghỉ ngơi. Không ai nghỉ giỏi bằng. Đặt anh ấy cạnh người bận rộn là người kia trông bận gấp đôi.`],
        [`Come and look at the real jobs|Lại xem mấy việc thật đi`, `Very well. Read them out slowly, please. I like to get used to an idea before it gets used to me.|Cũng được. Bạn đọc chậm thôi nhé. Tôi thích làm quen dần với một ý nghĩ trước khi nó quen tôi.`, '', 'hire'],
      ] },
    } },
    { id: 'applicant-ash', when: { who: 'ash' }, nodes: {
      a: { say: `I came to read the board. I cannot. It hangs two fingers lower on the left, and I have been staring at that corner since nine.|Tôi ra đọc bảng tuyển người. Mà đọc không nổi. Nó treo lệch bên trái hai đốt ngón tay, tôi nhìn cái góc ấy từ chín giờ tới giờ.`, choices: [
        [`Then straighten it, Ash|Thì anh chỉnh lại đi, anh Ash`, `I did. Then the wall looked crooked. So I am now applying for the job of straightening the office.|Chỉnh rồi. Xong lại thấy bức tường lệch. Nên giờ tôi xin nhận việc chỉnh cả cái văn phòng.`, 'b'],
        [`Tilt your head to match|Anh nghiêng đầu cho khớp vậy`, `I tried it. Bea asked if my neck was hurting and Leo tilted his head to keep me company.|Thử rồi. Cô Bea hỏi tôi có đau cổ không, còn anh Leo thì nghiêng đầu cùng cho tôi đỡ lẻ loi.`, 'b'],
        [`I rather like it crooked|Tôi lại thích nó lệch lệch`, `You are the leader, so I will say nothing. I will only breathe out slowly, the way carpenters do.|Bạn là trưởng làng, tôi không dám nói gì. Tôi chỉ thở ra thật chậm, kiểu thợ mộc vẫn thở.`],
      ] },
      b: { say: `Since I am here: Fern asked me to look at the meeting room floor. I looked. I said “hm”. What do you think “hm” means?|Tiện đang ở đây: cô Fern nhờ tôi xem cái sàn phòng họp. Tôi xem rồi. Tôi “hừm” một tiếng. Bạn nghĩ “hừm” nghĩa là gì?`, choices: [
        [`It means “easy”|Nghĩa là “dễ thôi”`, `It means “easy, but I shall take a long time, because there is tea here”. You speak good carpenter.|Nghĩa là “dễ thôi, nhưng tôi sẽ làm thật lâu, vì ở đây có trà”. Bạn nói tiếng thợ mộc khá đấy.`],
        [`It means “oh dear”|Nghĩa là “gay rồi”`, `No, that one is “hmmm”, with three m. One m is good news. I will have it level by supper.|Không, “gay rồi” là “hừmmm”, kéo dài cơ. “Hừm” cụt lủn là tin tốt. Bữa tối là sàn phẳng.`],
        [`Shall we look at the board?|Ta xem bảng tuyển người nhé?`, `Now that it hangs straight, gladly. A level board gives level work. My grandfather said so, to a shelf.|Giờ nó treo ngay ngắn rồi thì xem. Bảng ngay thì việc mới thẳng. Ông tôi dạy thế, lúc ấy ông đang nói với cái kệ.`, '', 'hire'],
      ] },
    } },
    { id: 'applicant-mara', when: { who: 'mara' }, nodes: {
      a: { say: `I am not applying. I am writing a reference for Biscuit. “Strengths: eats everything. Weaknesses: eats everything.” Is that fair?|Tôi không xin việc đâu. Tôi viết thư giới thiệu cho dê Biscuit. “Điểm mạnh: cái gì cũng ăn. Điểm yếu: cái gì cũng ăn.” Thế có công bằng không?`, choices: [
        [`What job does Biscuit want?|Biscuit muốn làm việc gì?`, `Filing. Hand Biscuit a paper and you never see that paper again. Is that not what filing is?|Lưu hồ sơ. Đưa nó tờ giấy nào là không bao giờ thấy lại tờ ấy nữa. Lưu hồ sơ chẳng phải là thế sao?`, 'b'],
        [`Very fair. Add “punctual”|Công bằng lắm. Thêm “đúng giờ” nữa`, `Truly. Biscuit has never once been late to the market flowers. Not in any season.|Chuẩn. Biscuit chưa bao giờ đến muộn ở sạp hoa ngoài chợ. Mùa nào cũng thế.`, 'b'],
        [`Can a goat hold a pen?|Dê có cầm được bút không?`, `For about two seconds. After that there is no pen. So I am the one writing the reference.|Được chừng hai giây. Sau đó thì không còn cây bút nào nữa. Nên tôi phải viết thay đấy.`],
      ] },
      b: { say: `The hens want to apply too, but they insist on working as a team and on stopping whenever it rains. What shall I tell them?|Đàn gà cũng muốn nộp đơn, nhưng đòi làm chung cả nhóm và cứ mưa là nghỉ. Tôi biết trả lời chúng nó sao đây?`, choices: [
        [`They already have the best job|Chúng nó có việc tốt nhất rồi`, `Laying eggs and holding opinions. You are right. I will tell them they have been promoted to hens.|Đẻ trứng và phát biểu ý kiến. Bạn nói phải. Tôi sẽ báo là chúng nó vừa được thăng chức lên làm gà.`],
        [`Hire the lot. The office needs noise|Nhận hết. Văn phòng đang thiếu tiếng ồn`, `It has a printer and Bea, it will manage. Still, I will pass on the offer. They will discuss it all day.|Có máy in với cô Bea rồi, đủ ồn đấy. Nhưng tôi sẽ chuyển lời. Chúng nó sẽ bàn cả ngày cho xem.`],
        [`Show me who is on the board|Cho tôi xem trên bảng có ai`, `Come on, then. No goats on it yet. I checked twice, and Biscuit checked once, with her teeth.|Lại đây. Trên bảng chưa có con dê nào. Tôi xem hai lượt rồi, Biscuit xem một lượt, bằng răng.`, '', 'hire'],
      ] },
    } },
    { id: 'applicant-ellis', when: { who: 'ellis' }, nodes: {
      a: { say: `Too old to apply, never too old to read the board. In my day there was no board. You stood by the pond looking useful until somebody noticed.|Già rồi không xin việc nữa, nhưng đọc bảng thì chưa bao giờ già. Thời ông làm gì có bảng. Cứ ra bờ ao đứng cho ra dáng được việc, đợi người ta để ý.`, choices: [
        [`How long did you stand?|Ông đứng bao lâu ạ?`, `Three days. Then a fish noticed me. I have worked for the fish ever since, and the hours are kind.|Ba ngày. Rồi có con cá để ý tới ông. Từ đó ông làm cho cá, giờ giấc dễ chịu lắm.`, 'b'],
        [`What job would you pick today?|Giờ thì ông chọn việc nào ạ?`, `“Office helper, must sit still and wait patiently.” That is fishing with a roof on. I am tempted.|“Phụ việc văn phòng, cần ngồi yên và kiên nhẫn chờ.” Thế là đi câu có mái che còn gì. Ông cũng thấy ham.`, 'b'],
        [`You could run this office|Ông quản cả văn phòng này được ấy chứ`, `And put Bea out of news? No, child. A village needs its postkeeper more than it needs my stories.|Rồi để cô Bea hết tin mà kể à? Thôi con ạ. Làng cần người giữ bưu cục hơn cần chuyện của ông.`],
      ] },
      b: { say: `I did have an office job once, for one morning. They asked me to file the papers by size. So I did, the fisherman’s way.|Hồi xưa ông cũng làm văn phòng, được đúng một buổi sáng. Người ta bảo xếp giấy tờ lớn bé cho có thứ tự. Ông xếp đúng kiểu dân câu.`, choices: [
        [`The fisherman’s way?|Kiểu dân câu là sao ạ?`, `I held my hands apart and said “this big”. Each time I told it the papers were bigger. They sent me back to the pond.|Ông dang hai tay ra bảo “to chừng này”. Mỗi lần kể, giấy lại to thêm một chút. Thế là họ cho ông về lại bờ ao.`],
        [`Was it a good morning?|Buổi sáng ấy có vui không ông?`, `The best. I caught a paper clip, two rubber bands and a nap. I let the paper clip go. It was a small one.|Vui nhất đời. Ông câu được một cái kẹp giấy, hai sợi dây thun và một giấc ngủ. Cái kẹp giấy ông thả, nó còn bé quá.`],
        [`Shall we read the board, Grandpa?|Mình cùng đọc bảng nhé ông?`, `Yes, read it to me, child. My eyes are for water now. Skip anything that says “brisk”.|Ừ, con đọc cho ông nghe. Mắt ông giờ chỉ quen nhìn mặt nước. Chỗ nào ghi “nhanh nhẹn” thì con bỏ qua.`, '', 'hire'],
      ] },
    } },
  ],
};
