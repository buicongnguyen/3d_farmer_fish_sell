// Conversations in the Willowmere Supermarket: Nell and Oren at the tills, Finn among the crates, and the villagers who shop there.
export default {
  nell: [
    { id: 'nell-sign', nodes: {
      a: { say: `I painted a sign: ‘Fresh produce bought here.’ Bea said ‘here’ was obvious. Hugo said ‘fresh’ was rude to doubt. What would you cut?|Tôi sơn tấm biển: “Ở đây có mua nông sản tươi.” Chị Bea bảo chữ “ở đây” thừa. Bác Hugo bảo chữ “tươi” nghe như nghi ngờ nhau. Bạn thì bỏ chữ nào?`, choices: [
        [`Cut ‘bought’. What else is a till for?|Bỏ chữ “mua”. Quầy tính tiền thì để làm gì nữa?`, `Finn said the same. So it read ‘Produce’. Then Oren said he could see the produce perfectly well.|Anh Finn cũng nói y vậy. Thế là còn mỗi “Nông sản”. Rồi anh Oren bảo: nông sản thì mắt ai chẳng thấy.`, 'b'],
        [`Nothing. It is a fine sign.|Không bỏ gì cả. Biển đẹp mà.`, `Where were you on Tuesday? By the time everyone had helped, there was not a word left on it.|Hôm thứ Ba bạn ở đâu vậy? Đến lúc cả làng góp ý xong thì trên biển không còn chữ nào.`, 'b'],
        [`Add a drawing of a pumpkin.|Vẽ thêm một quả bí ngô.`, `Pip did. It is the only part nobody argued with, so it stayed. Everything else went.|Bé Pip vẽ rồi. Chỗ đó là chỗ duy nhất không ai cãi nên còn nguyên. Còn lại bay hết.`, 'b'],
      ] },
      b: { say: `So now I own a very tidy blank board with one pumpkin on it. What shall I do with it?|Giờ tôi có một tấm biển trắng tinh, sạch sẽ, với đúng một quả bí ngô. Làm gì với nó bây giờ?`, choices: [
        [`Hang it up. People will come and ask.|Cứ treo lên. Người ta sẽ vào hỏi.`, `They do! Six came in to ask what it means, and five of them sold me carrots. Best sign I ever had.|Hỏi thật! Sáu người vào hỏi biển nghĩa là gì, năm người tiện tay bán luôn cà rốt. Tấm biển đắt khách nhất đời tôi.`],
        [`Paint the words back at night.|Nửa đêm lén sơn chữ lại.`, `And wake up to seven opinions again? I would sooner count crates with Finn. The pumpkin stays, the words rest.|Để sáng ra lại nghe bảy ý kiến à? Thà tôi đi đếm thùng với anh Finn. Bí ngô ở lại, chữ nghỉ ngơi.`],
        [`I have produce. Does the till still buy?|Tôi có nông sản đây. Quầy còn mua chứ?`, `Sign or no sign, a quarter over the market price. Come round to till 1.|Có biển hay không thì vẫn mua cao hơn chợ một phần tư. Mời bạn qua quầy 1.`, '', 'sell'],
      ] },
    } },
    { id: 'nell-last-pumpkin', nodes: {
      a: { say: `Till 1 is stuck. Ash and Iris both reached for the last pumpkin, and each insists the other must have it. That was twenty minutes ago. Advice?|Quầy 1 đang kẹt. Anh Ash và cô Iris cùng với tay lấy quả bí ngô cuối, rồi ai cũng nhất định nhường người kia. Hai mươi phút rồi đấy. Bạn có cao kiến gì không?`, choices: [
        [`Cut it in half.|Bổ đôi ra.`, `I offered. Now each insists the other takes the bigger half. There is no bigger half. I measured.|Tôi đề nghị rồi. Giờ ai cũng đòi người kia lấy nửa to hơn. Làm gì có nửa to hơn. Tôi đo rồi.`, 'b'],
        [`I will take it. Problem solved.|Để tôi mua. Thế là xong.`, `They both said ‘good idea’, then both tried to carry it to your basket for you. Still stuck, only nearer the door.|Cả hai cùng khen “ý hay”, rồi cùng giành bê ra giỏ giúp bạn. Vẫn kẹt, chỉ là kẹt gần cửa hơn.`, 'b'],
        [`Sell tickets. The queue looks happy.|Bán vé đi. Hàng người đang xem vui lắm.`, `It is. Bea has fetched a stool and Hugo is handing round crusts. Nobody wants it to end.|Vui thật. Chị Bea đã mang ghế đẩu ra ngồi, bác Hugo đang chia vỏ bánh mì. Chẳng ai muốn hết.`, 'b'],
      ] },
      b: { say: `But truly: how does one end a politeness contest in Willowmere?|Nhưng nói thật nhé: ở Willowmere, thi nhường nhau thì làm sao cho ngã ngũ?`, choices: [
        [`Look for a second pumpkin out the back.|Ra kho sau tìm quả thứ hai.`, `Finn! Pumpkins! He says nine, behind crate four all along. Everybody clap for crate four.|Anh Finn ơi! Bí ngô! Anh ấy bảo còn chín quả, nằm sau thùng số bốn từ đầu. Cả nhà vỗ tay cho thùng số bốn nào.`],
        [`Let the goat decide.|Để con dê phân xử.`, `Biscuit settles every case by eating it. Fair, in a way: then nobody gets the bigger half.|Biscuit xử vụ nào cũng bằng cách ăn luôn tang vật. Kể cũng công bằng: khỏi ai được nửa to hơn.`],
        [`Put it in the harvest supper soup.|Cho vào nồi súp tiệc mùa.`, `Soup for everyone, and nobody has to win. You think like a festival host. I should know.|Cả làng cùng ăn, khỏi ai phải thắng. Bạn nghĩ y như một chủ tiệc. Tôi rành mà.`],
      ] },
    } },
    { id: 'nell-supper', when: { festival: true }, nodes: {
      a: { say: `Harvest supper tonight! I have forty chairs, and fifty-two people have told me ‘I will bring a friend.’ How do I stretch one pot of soup?|Tối nay tiệc mùa! Tôi có bốn mươi cái ghế, mà năm mươi hai người đã dặn “tôi dẫn theo một người bạn”. Một nồi súp thì kéo dài kiểu gì đây?`, choices: [
        [`Add water.|Thêm nước.`, `Then the friends bring friends and I add more. By nine it is the soup of the soup of the soup. Warm, though.|Rồi bạn lại dẫn bạn, tôi lại thêm nước. Đến chín giờ thì thành súp của súp của súp. Được cái vẫn ấm.`, 'b'],
        [`Smaller bowls.|Dùng bát nhỏ hơn.`, `I tried eggcups last year. Ellis came back eleven times and said it was the longest supper he ever caught.|Năm ngoái tôi thử dùng chén đựng trứng. Ông Ellis quay lại xin mười một lần, bảo đó là bữa tối dài nhất ông từng câu được.`, 'b'],
        [`Cook a second pot. I will help.|Nấu thêm nồi nữa. Tôi phụ cho.`, `A helper! You get the big spoon and the title of Deputy Ladle.|Có người phụ! Bạn nhận cái muôi to và chức Phó Muôi.`, 'b'],
      ] },
      b: { say: `And the seats. Forty chairs, ninety-odd guests by my sums. What do we do?|Còn chỗ ngồi nữa. Bốn mươi ghế, tôi tính sơ sơ hơn chín mươi khách. Tính sao đây?`, choices: [
        [`Bring crates from the back room.|Mang thùng trong kho ra.`, `Finn must count them out and count them back in. He will be so happy. Crates it is.|Anh Finn sẽ phải đếm lúc mang ra, rồi đếm lúc mang vào. Anh ấy sướng phải biết. Chốt thùng nhé.`],
        [`Sit on the pumpkins.|Ngồi lên bí ngô.`, `The big ones, yes. The small ones are guests of honour and sit on the table.|Quả to thì được. Quả nhỏ là khách quý, được ngồi trên bàn.`],
        [`Eat standing up, like the hens.|Đứng ăn, như đàn gà.`, `Mara says hens never complain about the seating. See you tonight, and bring your elbows.|Chị Mara bảo gà chưa bao giờ chê chỗ ngồi. Tối gặp nhé, nhớ mang theo hai cái khuỷu tay để chen.`],
      ] },
    } },
    { id: 'nell-lunch', when: { from: 12, to: 13 }, nodes: {
      a: { say: `Lunch on crate seven, my favourite. Oren just held his dry bread over the steam of my soup and said it tasted better. Do I charge him for steam?|Tôi ăn trưa trên thùng số bảy, thùng ruột của tôi. Anh Oren vừa hơ miếng bánh mì khô trên hơi súp của tôi rồi khen ngon hẳn. Có nên tính tiền hơi không?`, choices: [
        [`Yes. Steam is half the soup.|Có chứ. Hơi là nửa nồi súp rồi.`, `I did! He jingled his purse by my ear and said ‘paid, in sound’. An old market trick. I laughed too hard to argue.|Tôi tính rồi! Anh ấy lắc túi tiền leng keng bên tai tôi: “Trả rồi nhé, trả bằng tiếng.” Mẹo chợ xưa đấy. Tôi cười quá, hết cãi.`, 'b'],
        [`No. Steam is free, like weather.|Không. Hơi thì miễn phí, như thời tiết.`, `So I said. Then he steamed a second slice, and a third. That is not weather, that is a meal.|Tôi cũng nói thế. Rồi anh ấy hơ lát thứ hai, lát thứ ba. Thế thì hết là thời tiết, thành bữa cơm rồi.`, 'b'],
        [`Charge him one compliment.|Tính anh ấy một lời khen.`, `He paid in full: ‘Nell, your soup smells like a festival.’ I am keeping the change.|Anh ấy trả đủ luôn: “Nell à, súp của cô thơm như ngày hội.” Tiền thừa tôi xin giữ.`, 'b'],
      ] },
      b: { say: `There is a little left in the flask and half an hour of lunch. Will you sit on crate eight?|Trong bình còn một ít, giờ nghỉ còn nửa tiếng. Mời bạn ngồi thùng số tám nhé?`, choices: [
        [`Gladly. What is in it?|Vui lòng. Súp gì thế?`, `Pumpkin, patience, and whatever Ada threw in by the handful. Here, a warm cupful.|Bí ngô, kiên nhẫn, và những thứ bà Ada bốc từng nắm thả vào. Đây, một cốc ấm bụng.`, '', 'energy'],
        [`Is crate eight safe to sit on?|Thùng số tám ngồi có chắc không?`, `Finn has counted it forty times and it has never once run away. Safest seat in Willowmere.|Anh Finn đếm nó bốn mươi lần rồi, chưa lần nào nó bỏ trốn. Chỗ ngồi chắc nhất Willowmere.`],
        [`I will smell it and pay in jingles.|Tôi ngửi thôi, rồi trả bằng tiếng leng keng.`, `Cheeky! That trick works once a day, and Oren has had today’s. Try me tomorrow.|Láu thật! Mẹo ấy mỗi ngày chỉ linh một lần, hôm nay anh Oren dùng mất rồi. Mai thử lại nhé.`],
      ] },
    } },
    { id: 'nell-labels', nodes: {
      a: { say: `Somebody shuffled my shelf labels. It now says ‘free range flour’, ‘self raising eggs’ and ‘jam, sold by the bunch’. Who do you suspect?|Ai đó xáo hết nhãn trên kệ của tôi. Giờ thành “bột mì thả vườn”, “trứng tự nở” và “mứt, bán theo bó”. Bạn nghi ai?`, choices: [
        [`The crow. It likes shiny tags.|Con quạ. Nó mê nhãn sáng bóng.`, `It took the shiny ones and left a bottle top in payment. Honest, for a crow.|Nó lấy mấy cái bóng nhất rồi để lại một cái nắp chai trả tiền. Với loài quạ thì thế là sòng phẳng.`, 'b'],
        [`Pip and Wren. Club business.|Bé Pip và bé Wren. Việc của câu lạc bộ.`, `They did add one label: ‘chickens, extra large’. We do not sell chickens. I left it up anyway.|Hai đứa có dán thêm một nhãn: “gà, cỡ siêu to”. Tiệm làm gì có bán gà. Nhưng tôi vẫn để đó.`, 'b'],
        [`You, before your morning tea.|Chính bạn, lúc chưa uống trà sáng.`, `I admit nothing. Tea is the answer, and before it I cannot read the question.|Tôi không nhận gì hết. Trà là câu trả lời, mà chưa có trà thì tôi chưa đọc nổi câu hỏi.`, 'b'],
      ] },
      b: { say: `Here is my trouble: three people have already asked for a bunch of jam. Do I put the labels right?|Khổ nỗi: đã có ba người hỏi mua một bó mứt rồi. Tôi có nên dán lại cho đúng không?`, choices: [
        [`Fix them. Flour should not roam.|Dán lại đi. Bột mì không nên đi rong.`, `Sensible. Though the flour did look happier. Thank you, leader of sensible things.|Phải lắm. Dù trông bột mì có vẻ vui hơn thật. Cảm ơn bạn, trưởng làng của những điều phải lẽ.`],
        [`Keep them. Sales are up.|Cứ để vậy. Đang bán chạy mà.`, `Self raising eggs sold out by ten. Hugo bought six and is watching them very closely.|Trứng tự nở hết veo trước mười giờ. Bác Hugo mua sáu quả, giờ đang ngồi canh rất kỹ.`],
        [`So what is a bunch of jam?|Thế một bó mứt là thế nào?`, `Three jars tied with string. I decided just now. Inventing things is half of shopkeeping.|Ba hũ buộc dây lại. Tôi vừa quyết xong. Bán hàng thì một nửa là sáng tác.`, 'c'],
      ] },
      c: { say: `And while I am inventing: how many should a ‘dozen’ be at till 1?|Tiện đang sáng tác: ở quầy 1 thì “một tá” nên là bao nhiêu?`, choices: [
        [`Twelve.|Mười hai.`, `Traditional. But Hugo counts thirteen to his dozen, and I will not be outdone by bread.|Đúng sách vở. Nhưng một tá của bác Hugo là mười ba, mà tôi thì không chịu thua bánh mì.`],
        [`Thirteen, like the baker.|Mười ba, như bác thợ bánh.`, `Then fourteen for me. A festival dozen! Oren will faint, and I shall water him.|Vậy tôi lấy mười bốn. Một tá ngày hội! Anh Oren sẽ ngất, còn tôi sẽ tưới cho anh ấy tỉnh.`],
        [`As many as fit in the basket.|Đầy một giỏ thì thôi.`, `A basket dozen. Ada measures in handfuls, I in basketfuls. Willowmere: where sums come to rest.|Một tá giỏ. Bà Ada đong bằng nắm, tôi đong bằng giỏ. Willowmere: nơi các phép tính về nghỉ dưỡng.`],
      ] },
    } },
  ],
  oren: [
    { id: 'oren-secret', nodes: {
      a: { say: `Welcome to till 2. People ask why my queue is slower. It is because I tell every customer the secret of farming. Shall I tell you?|Mời vào quầy 2. Người ta hay hỏi sao hàng bên tôi chậm. Tại khách nào tôi cũng kể cho nghe bí quyết làm ruộng. Bạn nghe không?`, choices: [
        [`Let me guess. Water?|Để tôi đoán. Nước?`, `Who told you? Bea, I expect. That woman cannot keep a secret I only tell forty times a day.|Ai mách bạn thế? Chắc chị Bea rồi. Bí mật tôi chỉ kể có bốn mươi lần một ngày mà chị ấy cũng không giữ nổi.`, 'b'],
        [`Is it good soil?|Là đất tốt chứ gì?`, `Soil is the bed. Water is the breakfast. Nobody gets up for a bed.|Đất là cái giường. Nước là bữa sáng. Có ai chịu dậy vì cái giường đâu.`, 'b'],
        [`Is it talking to the carrots?|Là trò chuyện với cà rốt à?`, `I tried. Carrots are poor listeners, and thirsty ones are worse. So: water.|Tôi thử rồi. Cà rốt nghe kém lắm, cà rốt khát còn kém hơn. Cho nên: nước.`, 'b'],
      ] },
      b: { say: `Now a harder one. What is the secret of a good shop?|Giờ câu khó hơn. Bí quyết của một cửa tiệm tốt là gì?`, choices: [
        [`Also water?|Cũng là nước?`, `Mop the floor every morning and folk think you are rich. So yes. It is always water.|Sáng nào cũng lau sàn thì ai cũng tưởng tiệm mình giàu. Vậy nên đúng. Lúc nào cũng là nước.`, 'c'],
        [`Fair prices.|Giá cả phải chăng.`, `We pay a quarter over the market for good produce, on a clean floor. Have you something to sell?|Nông sản ngon thì tiệm mua cao hơn chợ một phần tư, trên sàn sạch bóng. Bạn có gì bán không?`, '', 'sell'],
        [`A short queue.|Hàng chờ ngắn.`, `Then go to Nell at till 1. She is quick. I am thorough. My customers leave knowing a secret.|Vậy bạn sang cô Nell ở quầy 1. Cô ấy nhanh. Tôi thì kỹ. Khách của tôi ra về ai cũng biết một bí mật.`],
      ] },
      c: { say: `You learn fast. Final exam: a customer is glum because the pumpkins have sold out. What do you hand them?|Bạn học nhanh đấy. Thi tốt nghiệp: một vị khách buồn thiu vì bí ngô hết sạch. Bạn đưa cho họ cái gì?`, choices: [
        [`A glass of water.|Một cốc nước.`, `Top marks! You may have till 2 when I retire. That is in forty years. Do not be late.|Điểm tuyệt đối! Khi nào tôi nghỉ hưu, quầy 2 là của bạn. Bốn mươi năm nữa nhé. Đừng đến muộn.`],
        [`A pumpkin seed.|Một hạt bí ngô.`, `And the secret with it! By next season they have their own. You forgot to say ‘water’, but I heard it.|Kèm luôn bí quyết! Sang mùa sau họ có bí nhà trồng. Bạn quên nói chữ “nước”, nhưng tôi nghe thấy rồi.`],
        [`A discount.|Một suất giảm giá.`, `On what? They are gone! No shopkeeper, you, but a generous heart. That will do for a village leader.|Giảm cho món gì? Hết sạch rồi mà! Bạn không có số bán hàng, nhưng tốt bụng. Làm trưởng làng thế là được.`],
      ] },
    } },
    { id: 'oren-rain', when: { rain: true }, nodes: {
      a: { say: `Rain! I walked to work slowly today. Finn ran past shouting ‘hurry, you are getting wet!’ What do you think I told him?|Mưa rồi! Sáng nay tôi thong thả đi bộ đến tiệm. Anh Finn chạy vụt qua, hét: “Nhanh lên, ướt hết bây giờ!” Bạn đoán tôi đáp sao?`, choices: [
        [`‘It is raining up ahead as well.’|“Đằng trước cũng mưa mà.”`, `Word for word! Why run out of this rain into that rain? Finn had no answer. He was also very far away by then.|Đúng từng chữ! Chạy khỏi mưa này để vào mưa kia làm gì? Anh Finn không cãi được. Mà lúc ấy anh ấy cũng chạy xa tít rồi.`, 'b'],
        [`‘Hush. I am being watered.’|“Suỵt. Tôi đang được tưới.”`, `Close. And I did grow a little, I think. My hat is tighter.|Gần đúng. Mà hình như tôi có lớn thêm chút thật. Cái mũ chật hơn rồi.`, 'b'],
        [`‘Wait for me!’|“Chờ tôi với!”`, `Never. A farmer does not run from his best worker. The rain does my rounds and asks no wage.|Không đời nào. Nhà nông ai lại chạy trốn người làm giỏi nhất của mình. Mưa tưới thay tôi cả buổi mà chẳng đòi công.`, 'b'],
      ] },
      b: { say: `On a wet day the fields want nothing from me. So what should a farmer do at a till?|Ngày mưa thì ruộng chẳng cần gì đến tôi. Vậy một ông nông dân đứng quầy nên làm gì?`, choices: [
        [`Water the customers.|Tưới cho khách.`, `I do. A cup of tea each. It is the same secret, served hot. Here is yours.|Có chứ. Mỗi người một tách trà. Vẫn bí quyết ấy, chỉ là rót nóng. Phần của bạn đây.`, '', 'energy'],
        [`Count raindrops with Finn.|Đếm hạt mưa với anh Finn.`, `He reached four hundred and one, then a drip landed on his list. He has begun again.|Anh ấy đếm tới bốn trăm lẻ một thì một giọt rơi trúng tờ ghi. Giờ đang đếm lại từ đầu.`],
        [`Admire the puddles.|Ngắm vũng nước.`, `I have named the one by the trolley bay. It is called Stock. Nobody leaves without stepping in it.|Cái vũng cạnh bãi xe đẩy tôi đặt tên rồi. Tên nó là Hàng Tồn. Khách nào ra về cũng giẫm phải.`],
      ] },
    } },
    { id: 'oren-scarecrow', when: { season: 'Summer' }, nodes: {
      a: { say: `Summer. I water at dawn, at noon and at dusk. This morning I caught myself watering the scarecrow. Is that too much?|Mùa hè. Tôi tưới lúc rạng sáng, giữa trưa và chiều tối. Sáng nay tôi giật mình thấy mình đang tưới cả ông bù nhìn. Thế có quá không?`, choices: [
        [`Did he grow?|Ông ấy có lớn lên không?`, `No, but his hat sprouted. Ada says there were radish seeds in the straw. He is the best dressed in the field.|Không, nhưng cái mũ thì nảy mầm. Bà Ada bảo trong rơm lẫn hạt củ cải. Giờ ông ấy diện nhất cánh đồng.`, 'b'],
        [`Yes. He is made of straw.|Quá chứ. Ông ấy bằng rơm mà.`, `So was my first hat, and it liked a drink. But I take your point.|Cái mũ đầu tiên của tôi cũng bằng rơm, và nó thích được tưới lắm. Nhưng thôi, bạn nói có lý.`, 'b'],
        [`Water him. He stands in the sun all day.|Cứ tưới. Ông ấy đứng nắng cả ngày.`, `Just what I said! Out standing in my field from dawn, that fellow, and never a word of complaint.|Tôi cũng nói thế! Sáng đứng, trưa đứng, chiều đứng: cả làng không ai đứng đắn bằng ông ấy, mà chưa hề kêu ca.`, 'b'],
      ] },
      b: { say: `He has worked for me nine summers and scared no crows at all. The crow sits on his arm. What do I do with him?|Ông ấy làm cho tôi chín mùa hè rồi mà chưa dọa được con quạ nào. Con quạ còn đậu trên tay ông ấy. Xử trí sao đây?`, choices: [
        [`Promote him.|Thăng chức cho ông ấy.`, `To what? He already runs the field. Very well: Head of Standing Still. He has earned it.|Lên chức gì? Ông ấy đang coi cả cánh đồng rồi. Thôi được: Trưởng ban Đứng Yên. Xứng đáng lắm.`],
        [`Pay the crow in shiny buttons.|Trả công con quạ bằng cúc áo bóng.`, `A wage, so the crow guards the carrots for him? You have just invented management.|Trả lương để quạ canh cà rốt thay ông ấy à? Bạn vừa phát minh ra nghề quản lý đấy.`],
        [`Keep watering. Loyalty matters.|Cứ tưới. Tình nghĩa là quý.`, `Nine summers, never late, never sat down once. Better record than mine. Mind the heat, and drink water.|Chín mùa hè, chưa đi muộn, chưa ngồi nghỉ lần nào. Thành tích hơn cả tôi. Trời nóng, bạn nhớ uống nước nhé.`],
      ] },
    } },
    { id: 'oren-trolley', nodes: {
      a: { say: `Take any trolley from the bay but the third. One of its wheels has opinions. It only turns left. Which will you have?|Xe đẩy ngoài bãi bạn lấy chiếc nào cũng được, trừ chiếc thứ ba. Nó có một bánh rất có chính kiến. Chỉ chịu rẽ trái. Bạn lấy chiếc nào?`, choices: [
        [`The third. I like a challenge.|Chiếc thứ ba. Tôi thích thử thách.`, `Brave. Last week Ash set off for the flour with it and arrived at the cold section three times.|Gan đấy. Tuần trước anh Ash đẩy nó đi lấy bột mì, và đến quầy lạnh ba lần liền.`, 'b'],
        [`A basket, thank you.|Cho tôi cái giỏ, cảm ơn.`, `Wise. Though the third trolley has followed you a little way. It does that. The floor slopes.|Khôn đấy. Có điều chiếc thứ ba vừa lăn theo bạn một đoạn. Nó hay thế. Sàn hơi dốc.`, 'b'],
        [`Can it be mended?|Sửa được không?`, `Theo looked. He says that wheel is fine. It is the other three that lack ambition.|Chú Theo xem rồi. Chú bảo bánh ấy tốt. Ba bánh còn lại mới là thiếu chí tiến thủ.`, 'b'],
      ] },
      b: { say: `Truth is, I am fond of it. How would you shop with a trolley that only turns left?|Nói thật là tôi quý nó. Với một chiếc xe chỉ rẽ trái thì bạn đi chợ kiểu gì?`, choices: [
        [`Go round the whole shop in left turns.|Rẽ trái vòng hết cả tiệm.`, `That is the long way to the jam, past everything we sell. Nell calls it our best salesman.|Thế là đường xa nhất tới kệ mứt, qua hết mọi món tiệm bán. Cô Nell gọi nó là nhân viên bán hàng giỏi nhất.`],
        [`Water the wheel.|Tưới cái bánh xe.`, `At last, a student! I did. It squeaks less, and now turns left with confidence.|Cuối cùng cũng có học trò! Tôi tưới rồi. Nó bớt kêu, và giờ rẽ trái rất tự tin.`],
        [`Walk backwards. Then left is right.|Đi giật lùi. Thế là trái thành phải.`, `I must sit down and think about that. On the till stool. Which also turns left.|Để tôi ngồi xuống nghĩ đã. Trên cái ghế xoay ở quầy. Cái ghế ấy cũng chỉ xoay trái.`],
      ] },
    } },
    { id: 'oren-thinking-pumpkin', when: { stat: ['sales', 1] }, nodes: {
      a: { say: `Before the shop, I sold at the market. A man there asked a fortune for a parrot because it talked. So I put the same price on my pumpkin. Guess why.|Hồi chưa có tiệm, tôi bán ngoài chợ. Có ông hét giá con vẹt cao ngất vì nó biết nói. Thế là tôi đề đúng giá ấy cho quả bí ngô của tôi. Đoán xem vì sao.`, choices: [
        [`Because it sings?|Vì nó biết hát?`, `Pumpkins do not sing, do not be silly. Mine was thinking. You could tell by how quiet it was.|Bí ngô sao mà hát được, bạn cứ đùa. Quả của tôi biết nghĩ. Cứ nhìn nó im lặng thế nào là rõ.`, 'b'],
        [`Because it was enormous.|Vì nó to khổng lồ.`, `Middling. But it had a thoughtful look. His bird talks, I told them, and my pumpkin thinks.|Cỡ vừa thôi. Nhưng dáng nó đăm chiêu lắm. Tôi bảo cả chợ: chim của ông ấy biết nói, bí của tôi biết nghĩ.`, 'b'],
        [`Because you watered it?|Vì anh tưới nó?`, `That too. But what I told the crowd was: his bird talks, my pumpkin thinks.|Cũng có. Nhưng tôi nói với cả chợ thế này: chim của ông ấy biết nói, bí của tôi biết nghĩ.`, 'b'],
      ] },
      b: { say: `Nobody bought it at that price. So what do you suppose became of the deep thinking pumpkin?|Giá ấy thì chẳng ai mua. Vậy bạn đoán quả bí hay suy tư ấy về sau ra sao?`, choices: [
        [`Soup. Wise soup.|Thành súp. Súp thông thái.`, `The wisest I ever ate. Halfway down the bowl I understood why hens cross the road.|Bát súp khôn nhất tôi từng ăn. Mới nửa bát tôi đã hiểu vì sao gà cứ thích băng qua đường.`],
        [`A lantern, so it could shine.|Thành đèn lồng, cho nó tỏa sáng.`, `Pip would approve. Full of bright ideas, that one, once it had a candle in.|Bé Pip hẳn sẽ ưng. Có ngọn nến bên trong là nó sáng ý hẳn ra.`],
        [`Still thinking, on your shelf?|Vẫn ngồi nghĩ trên kệ nhà anh?`, `It sits by till 2 to this day. I ask its view on prices. It has never once said no.|Nó ngồi cạnh quầy 2 tới giờ. Tôi vẫn hỏi ý nó về giá cả. Chưa lần nào nó nói không.`],
      ] },
    } },
  ],
  finn: [
    { id: 'finn-count', nodes: {
      a: { say: `Odd thing. Standing on the floor, I count nine crates. When I climb on one to check the top shelf, I count eight. Where does it go?|Lạ thật. Đứng dưới sàn tôi đếm được chín thùng. Trèo lên một thùng để ngó kệ trên cùng thì đếm còn tám. Một thùng đi đâu?`, choices: [
        [`You are standing on it, Finn.|Anh đang đứng trên nó đấy, anh Finn.`, `Standing on it. Well. So I am. That is forty counts I shall never get back. Do not tell Nell.|Đứng trên nó. Ờ. Đúng thật. Thế là mất toi bốn mươi lượt đếm. Đừng kể với cô Nell nhé.`, 'b'],
        [`The crow took it.|Con quạ tha mất rồi.`, `A whole crate? That bird struggles with a teaspoon. I do admire your faith in it.|Cả một cái thùng? Con quạ ấy tha cái thìa còn chật vật. Nhưng tôi phục lòng tin của bạn dành cho nó.`, 'b'],
        [`Crates are shy when watched from above.|Thùng hay ngượng khi bị nhìn từ trên xuống.`, `That would explain a lot. The flour hides too, whenever Hugo comes looking.|Thế thì hiểu ra khối chuyện. Bột mì cũng hay trốn, cứ lúc bác Hugo tới tìm là biến mất.`, 'b'],
      ] },
      b: { say: `Right. I need a new method, so I never lose a crate again. What do you say?|Được rồi. Tôi cần cách đếm mới, để không bao giờ lạc thùng nữa. Bạn bày giúp xem?`, choices: [
        [`Number them with chalk.|Lấy phấn đánh số.`, `I did once. Then I counted the numbers as well, got nine again, and felt I had eighteen.|Tôi làm một lần rồi. Xong tôi đếm luôn cả mấy con số, lại ra chín, thế là cứ ngỡ mình có mười tám thùng.`],
        [`Count from the floor only.|Chỉ đứng dưới sàn mà đếm.`, `Then who checks the top shelf? Hard choices. I shall count the floor ones twice to make up for it.|Thế ai ngó kệ trên? Khó nghĩ thật. Thôi tôi đếm mấy thùng dưới sàn hai lần để bù.`],
        [`Count the rest, then add your seat.|Đếm chỗ còn lại, rồi cộng cái đang đứng.`, `Eight, plus the one under my boots. Nine! You have a head for stock. Stay a minute.|Tám, cộng cái dưới chân tôi. Chín! Bạn có khiếu kiểm kho đấy. Nán lại một phút đã.`, 'c'],
      ] },
      c: { say: `Count the back room with me once? I say the numbers, and you say ‘yes, Finn’. That is the whole job.|Đếm kho sau với tôi một lượt nhé? Tôi đọc số, bạn đáp “đúng rồi, anh Finn”. Việc chỉ có thế.`, choices: [
        [`Yes, Finn.|Đúng rồi, anh Finn.`, `One, two, and so on to nine. You agreed with every single one. Best count I have had all week.|Một, hai, cứ thế tới chín. Số nào bạn cũng tán thành. Lượt đếm sướng nhất tuần của tôi.`],
        [`May I say the numbers?|Cho tôi đọc số được không?`, `You? Out loud? Go on. Well. You skipped none. I am moved, and a little out of a job.|Bạn á? Đọc to lên á? Thử xem. Chà. Không sót số nào. Tôi cảm động, và hơi lo mất việc.`],
        [`Let us count by twos.|Mình đếm nhảy hai một nhé.`, `By twos I get four and a half. I do not trust it. Half a crate is a tray. Thank you all the same.|Đếm nhảy hai thì ra bốn rưỡi. Tôi không tin nổi. Nửa cái thùng là cái khay rồi. Dù sao cũng cảm ơn bạn.`],
      ] },
    } },
    { id: 'finn-fish-size', when: { stat: ['fish', 2] }, nodes: {
      a: { say: `I hear you have been at the pond with a rod. One fisher asks another: how big was your best one? Show me with your hands.|Nghe nói bạn dạo này ra ao buông cần. Dân câu hỏi nhau câu này: con to nhất cỡ nào? Giơ tay ra ướm tôi xem.`, choices: [
        [`(Hands a sensible distance apart)|(Hai tay cách nhau vừa phải)`, `Honest hands! Rare. Ellis shows his fish with two people and a length of rope.|Đôi tay thật thà! Hiếm đấy. Ông Ellis tả cá thì phải hai người căng một đoạn dây thừng.`, 'b'],
        [`(Arms as wide as they will go)|(Dang hết cỡ hai tay)`, `Mind the jam shelf! That is no fish, that is a rowing boat with fins.|Coi chừng kệ mứt! Thế thì đâu còn là cá, là cái thuyền chèo có vây.`, 'b'],
        [`Small. But it had a big personality.|Nhỏ thôi. Nhưng cá tính thì lớn.`, `The best kind. Mine last week was so small it thanked me for the ride, so I put it back.|Loại ấy quý nhất. Con của tôi tuần trước bé tới mức nó cảm ơn tôi vì chuyến đi chơi, nên tôi thả lại.`, 'b'],
      ] },
      b: { say: `Then here is the fisher’s riddle. Why does a fish always grow after it is caught?|Vậy đố bạn câu của dân câu. Vì sao cá cứ bắt lên rồi mới lớn?`, choices: [
        [`The story needs room.|Vì câu chuyện cần chỗ rộng.`, `Just so. A fish stops growing in the pond and starts at supper. By the third telling it needs its own chair.|Chí phải. Dưới ao cá ngừng lớn, lên mâm cơm mới bắt đầu. Kể đến lần thứ ba là nó cần ghế riêng.`],
        [`Nobody measures the one that got away.|Vì con sổng mất thì chẳng ai đo.`, `And that one is always the biggest. Mine got away with my hat. Best dressed fish in the pond.|Mà con sổng bao giờ cũng to nhất. Con của tôi sổng mất, mang theo cả cái mũ. Giờ nó diện nhất ao.`],
        [`Fishers count like you count crates?|Vì dân câu đếm như anh đếm thùng?`, `Unfair! And correct. I caught twelve today. Possibly nine. Good fishing, neighbour.|Oan cho tôi! Mà cũng đúng. Hôm nay tôi câu được mười hai con. Hoặc chín. Chúc bạn mát tay nhé.`],
      ] },
    } },
    { id: 'finn-lost-found', nodes: {
      a: { say: `Lost and found report. In the basket today: one left glove, a teaspoon, a list that says ‘buy a list’, and something chewing. Which is yours?|Báo cáo giỏ đồ thất lạc. Hôm nay có: một chiếc găng tay trái, một cái thìa, một tờ giấy ghi “mua giấy ghi”, và một thứ đang nhai. Cái nào của bạn?`, choices: [
        [`The list. I forgot I had it.|Tờ giấy. Tôi quên là mình có nó.`, `It is in Bea’s handwriting. She will deny it. I shall file it under ‘found, awkward’.|Nét chữ chị Bea đấy. Chị ấy sẽ chối cho xem. Tôi xếp nó vào mục “tìm thấy, hơi khó xử”.`, 'b'],
        [`The teaspoon.|Cái thìa.`, `The crow brought it back, with a dent. First return of its career. I think it is turning honest.|Con quạ mang trả đấy, có móp một tí. Lần trả đồ đầu tiên trong sự nghiệp của nó. Chắc nó đang hoàn lương.`, 'b'],
        [`Chewing? Finn, look in the basket.|Đang nhai? Anh Finn, ngó vào giỏ đi.`, `I would sooner count it from here. One. One thing chewing. It has horns. Two of those.|Tôi đứng đây đếm cho chắc. Một. Một thứ đang nhai. Nó có sừng. Sừng thì hai.`, 'b'],
      ] },
      b: { say: `It is Biscuit. The goat is in the lost and found, eating the left glove. What is the proper procedure?|Là Biscuit. Con dê đang nằm trong giỏ đồ thất lạc, nhai chiếc găng tay trái. Đúng quy trình thì làm gì?`, choices: [
        [`Tell Mara the goat is found.|Báo chị Mara là tìm thấy dê rồi.`, `Mara will say Biscuit was never lost, only early. I shall write ‘one goat, claimed’. Thank you.|Chị Mara sẽ bảo Biscuit có lạc đâu, chỉ là đến sớm. Tôi ghi “một con dê, đã có người nhận”. Cảm ơn bạn.`, 'c'],
        [`Label the goat and shelve it.|Dán nhãn rồi xếp dê lên kệ.`, `Aisle two, between the jam and the flour? It would eat its way to aisle three by noon.|Dãy hai, giữa mứt và bột mì à? Chưa đến trưa nó đã ăn thông sang dãy ba.`],
        [`Ask if the glove wants to complain.|Hỏi xem chiếc găng có muốn khiếu nại không.`, `Pearl says a glove has no case without its partner. So: case closed, basket open.|Cô Pearl bảo găng thiếu chiếc kia thì chưa đủ một đôi để thưa kiện. Vậy là: khép hồ sơ, mở giỏ.`],
      ] },
      c: { say: `One more item. Under the goat there was a note: ‘If found, please return to the pond.’ Whose is that?|Còn một món nữa. Dưới bụng con dê có mảnh giấy: “Ai nhặt được, xin trả về ao.” Của ai nhỉ?`, choices: [
        [`A golden fish wrote it.|Một con cá vàng viết.`, `With what hand? Though the paper is damp. I shall deliver it on Sunday, rod in hand, purely as postman.|Viết bằng tay nào? Nhưng mà giấy ướt thật. Chủ nhật tôi sẽ mang ra trả, tay cầm cần câu, hoàn toàn với tư cách người đưa thư.`],
        [`Ellis. He belongs at the pond.|Ông Ellis. Ông ấy thuộc về cái ao.`, `He pins it to his coat so that somebody walks him back there by lunch. Clever old fisher.|Ông ghim nó lên áo để thế nào cũng có người dắt ông ra ao trước bữa trưa. Tay câu già cao mưu thật.`],
        [`Yours, Finn.|Của anh đấy, anh Finn.`, `So it is my writing. I wrote it for my hat. The hat is still out there. One hat, uncounted.|Đúng nét chữ tôi thật. Tôi viết cho cái mũ. Cái mũ vẫn còn lưu lạc ngoài kia. Một cái mũ, chưa đếm.`],
      ] },
    } },
    { id: 'finn-cold-section', when: { season: 'Winter' }, nodes: {
      a: { say: `Winter tip from a fisher: the cold section is the warmest corner of the shop today. It is colder outside. Guess what I keep in there now.|Mẹo mùa đông của dân câu: hôm nay quầy lạnh là góc ấm nhất tiệm. Ngoài trời còn lạnh hơn. Đoán xem giờ tôi cất gì trong đó.`, choices: [
        [`The milk, I hope.|Sữa, mong là thế.`, `The milk is out on the step, it keeps better. In the cold section I keep my lunch, so it does not freeze.|Sữa để ngoài bậc thềm, giữ được lâu hơn. Trong quầy lạnh tôi cất bữa trưa, cho nó khỏi đông đá.`, 'b'],
        [`Yourself.|Chính anh.`, `At break time, yes. I sit by the butter with my scarf off. It is like a holiday.|Giờ nghỉ thì đúng. Tôi ngồi cạnh bơ, cởi khăn quàng ra. Như đi nghỉ mát.`, 'b'],
        [`A snowman, for safekeeping.|Một người tuyết, gửi giữ hộ.`, `Wren asked me to. He is behind the cheese, and I count him as stock. One snowman, every hour.|Bé Wren nhờ tôi đấy. Cậu ta đứng sau phô mai, tôi tính vào hàng trong kho. Một người tuyết, giờ nào cũng đếm.`, 'b'],
      ] },
      b: { say: `I miss the pond, so at break I fish in the cold section with a bit of string. Guess what I have caught so far.|Nhớ cái ao quá nên giờ nghỉ tôi buông một sợi dây câu ngay trong quầy lạnh. Đoán xem tôi câu được gì rồi.`, choices: [
        [`A cabbage.|Một cây bắp cải.`, `A fine one. It did not fight much. By the time Ellis tells it, the cabbage will have pulled me in.|Một cây ra trò. Nó không giãy mấy. Chờ ông Ellis kể lại thì sẽ thành cây bắp cải kéo tôi ngã nhào.`],
        [`A tin of sardines.|Một hộp cá mòi.`, `Three! Easiest catch of my life, and already counted. I put them back. Fair is fair.|Ba hộp! Mẻ cá dễ nhất đời tôi, lại đếm sẵn rồi. Tôi thả lại lên kệ. Chơi phải đẹp.`],
        [`Nell’s attention.|Sự chú ý của cô Nell.`, `She stood behind me a full minute, said ‘any bites?’ and walked on. Good till partner, that.|Cô ấy đứng sau lưng tôi tròn một phút, hỏi “cắn câu chưa?” rồi đi tiếp. Bạn đứng quầy thế mới quý.`],
      ] },
    } },
    { id: 'finn-new-apron', nodes: {
      a: { say: `Notice anything? I have stood by the back room door since nine, turning slowly, and nobody has said a word. Go on. Look closely.|Bạn thấy gì khác không? Tôi đứng ở cửa kho từ chín giờ, xoay chầm chậm, mà chưa ai nói câu nào. Nào. Nhìn kỹ xem.`, choices: [
        [`A new apron!|Tạp dề mới!`, `At last! Since I put on this NEW apron this morning, you are the first to see it.|Mãi mới có người! Từ lúc tôi mặc cái tạp dề MỚI này sáng nay, bạn là người đầu tiên nhận ra.`, 'b'],
        [`You have counted the crates?|Anh đếm xong thùng rồi?`, `Always, but no. It is blue, it has a pocket, and I am wearing it. Think: NEW apron.|Lúc nào chẳng đếm, nhưng không phải. Nó màu xanh, có túi, và tôi đang mặc. Gợi ý: tạp dề MỚI.`, 'b'],
        [`You are standing on a crate again.|Anh lại đứng trên thùng rồi.`, `No. Well, yes. But look higher, round my middle: a NEW apron. Thank you for getting there.|Không. À, có. Nhưng nhìn cao lên, ngang bụng tôi này: tạp dề MỚI. Cảm ơn bạn, cuối cùng cũng thấy.`, 'b'],
      ] },
      b: { say: `Hugo ran by earlier asking ‘has anyone seen my festival loaf?’ Do you know what I told him?|Lúc nãy bác Hugo chạy ngang, hỏi “có ai thấy ổ bánh ngày hội của tôi không?” Bạn biết tôi đáp sao không?`, choices: [
        [`‘Not since I put on this new apron.’|“Từ lúc mặc tạp dề mới thì chưa thấy.”`, `Exactly! And he said ‘my FESTIVAL loaf, big as a cartwheel’. Two show offs in one doorway. We did laugh.|Chuẩn luôn! Còn bác ấy thì: “ổ bánh NGÀY HỘI của tôi, to bằng bánh xe bò”. Hai ông khoe của chung một cửa. Cười mãi.`],
        [`‘It is in crate four.’|“Nó ở trong thùng số bốn.”`, `It was on his own head, on the tray he was carrying. Bakers. I pointed with my new apron pocket.|Nó ở ngay trên đầu bác ấy, trong cái khay bác ấy đang đội. Thợ bánh mà. Tôi chỉ cho bác bằng cái túi tạp dề mới.`],
        [`‘Ask the goat.’|“Hỏi con dê ấy.”`, `Biscuit was innocent for once. Wearing a guilty look, mind. Not an apron. Only I have the apron.|Lần này Biscuit vô can. Mặt thì vẫn có vẻ gian gian. Nhưng không mặc tạp dề. Tạp dề thì chỉ tôi có.`],
      ] },
    } },
  ],
  '@shopper': [
    { id: 'shopper-one-thing', nodes: {
      a: { say: `I came in for one thing. One. I now have jam, flour, a brush and a pumpkin, and I cannot remember the one thing. Can you guess it?|Tôi vào mua đúng một thứ. Một thôi. Giờ trong giỏ có mứt, bột mì, cái bàn chải và quả bí ngô, còn thứ kia thì tôi quên béng. Bạn đoán giúp xem?`, choices: [
        [`Was it bread?|Bánh mì chăng?`, `Bread! No. But in it goes, the loaves are still warm. That makes five things that are not the thing.|Bánh mì! Không phải. Nhưng lấy luôn, bánh còn ấm. Vậy là năm thứ không phải thứ cần mua.`, 'b'],
        [`Was it a shopping list?|Hay là tờ ghi đồ cần mua?`, `I wrote one. I left it at home so I would not lose it. It is very safe there.|Tôi viết rồi. Tôi để ở nhà cho khỏi mất. Ở đó nó an toàn lắm.`, 'b'],
        [`Was it this basket?|Hay chính cái giỏ này?`, `I brought the basket. I think. Unless I came for a basket and this one is somebody’s. Oh dear.|Giỏ là tôi mang theo. Chắc thế. Trừ khi tôi vào để mua giỏ và cái này là của ai đó. Chết thật.`, 'b'],
      ] },
      b: { say: `It will come back to me. It always does, at my own front door. What should I do meanwhile?|Rồi tôi sẽ nhớ ra. Lần nào cũng nhớ ra, đúng lúc về tới cửa nhà. Còn bây giờ thì làm gì?`, choices: [
        [`Walk every aisle. It will wave at you.|Đi hết các dãy. Nó sẽ vẫy bạn.`, `Every aisle, with the trolley that only turns left? I shall be home by supper. Wish me luck.|Đi hết các dãy, với chiếc xe đẩy chỉ rẽ trái ấy à? Chắc kịp về ăn tối. Chúc tôi may mắn đi.`],
        [`Go home, remember, come back.|Về nhà, nhớ ra, rồi quay lại.`, `My usual method. Finn counts me in and out. On his list I am four customers a day.|Cách tôi vẫn làm. Anh Finn đếm tôi lúc vào lẫn lúc ra. Trong sổ anh ấy, mỗi ngày tôi là bốn vị khách.`],
        [`Put it all back and start again.|Trả hết lại kệ rồi làm lại từ đầu.`, `Put the jam back? I am forgetful, not heartless. Good to see you, Rowan.|Trả lại hũ mứt à? Tôi đãng trí chứ đâu có nhẫn tâm. Gặp bạn vui quá, Rowan.`],
      ] },
    } },
    { id: 'shopper-sample-tray', nodes: {
      a: { say: `Have you tried the free sample tray? I have. Six times. I am still not sure whether I like the cheese. How many tries is polite?|Bạn thử khay nếm miễn phí chưa? Tôi thử rồi. Sáu lần. Vẫn chưa chắc mình có thích món phô mai không. Nếm mấy lần thì còn lịch sự?`, choices: [
        [`One.|Một lần.`, `One! Who can know a cheese from one cube? You would not judge the pond by one fish.|Một! Một miếng thì sao hiểu hết một bánh phô mai? Có ai xem một con cá mà dám nói về cả cái ao đâu.`, 'b'],
        [`Six sounds about right.|Sáu lần nghe hợp lý.`, `Thank you. Though Nell has begun saying ‘good morning AGAIN’ in a certain voice.|Cảm ơn bạn. Có điều cô Nell bắt đầu chào “LẠI chào buổi sáng” bằng cái giọng hơi lạ.`, 'b'],
        [`Keep going till the tray is empty.|Cứ nếm đến khi khay sạch trơn.`, `Oren told me the tray is filled again at noon. I took that as encouragement.|Anh Oren bảo trưa người ta lại bày đầy khay. Tôi coi đó là lời động viên.`, 'b'],
      ] },
      b: { say: `I shall decide on the seventh cube. Will you taste one with me, as a witness?|Miếng thứ bảy tôi sẽ quyết. Bạn nếm cùng tôi một miếng, làm chứng nhé?`, choices: [
        [`Gladly.|Sẵn lòng.`, `There. Well? I agree. I like it. I liked it all six times, if I am honest. Nicer shared, though.|Đấy. Sao nào? Đồng ý. Tôi thích. Thật ra cả sáu lần trước tôi đều thích. Nhưng ăn có bạn vẫn ngon hơn.`, '', 'energy'],
        [`I will only watch.|Tôi đứng xem thôi.`, `A witness with self control. Rare in this village. Seven. Yes. It is cheese. I am decided.|Một nhân chứng biết kiềm chế. Làng này hiếm lắm. Bảy. Rồi. Đúng là phô mai. Tôi quyết xong.`],
        [`Buy the cheese. End the mystery.|Mua luôn đi. Hết thắc mắc.`, `Buy it? Then it would not be free, and half the flavour is the free part. You see my trouble.|Mua à? Thế thì hết miễn phí, mà một nửa vị ngon nằm ở chữ miễn phí. Bạn hiểu nỗi khổ của tôi chưa.`],
      ] },
    } },
    { id: 'shopper-june-jam', when: { who: 'june' }, nodes: {
      a: { say: `There you are! I said I would be five minutes. That was before I met the jam shelf. Honestly, how long have I been?|Mình đây rồi! Em bảo em đi năm phút thôi. Ấy là trước khi em gặp cái kệ mứt. Nói thật đi, em đi bao lâu rồi?`, choices: [
        [`Five minutes. Exactly.|Năm phút. Chuẩn luôn.`, `Liar. Lovely liar. The kettle at home has boiled, cooled and given up on me by now.|Nói dối. Mà dối dễ thương. Ấm nước ở nhà chắc đã sôi, đã nguội, và đã hết hy vọng vào em.`, 'b'],
        [`Long enough for Pip to draw nine chickens.|Đủ lâu để Pip vẽ xong chín con gà.`, `Nine! Large ones? Then it has been an hour. She draws chickens by the acre.|Chín con! Loại to à? Thế thì cả tiếng rồi. Con bé vẽ gà phải tính bằng mẫu ruộng.`, 'b'],
        [`I came to check you had not moved in.|Tôi ghé xem mình đã dọn hẳn vào đây chưa.`, `I did look at the back room. Cosy crates. But Nell says the tea in there is poor.|Em có ngó cái kho sau thật. Mấy cái thùng trông ấm cúng lắm. Nhưng cô Nell bảo trà trong đó dở.`, 'b'],
      ] },
      b: { say: `Help me choose and we can go. Plum jam or strawberry, for today’s page in the family album?|Chọn giúp em rồi mình về. Mứt mận hay mứt dâu, để em ghi vào trang hôm nay của cuốn album nhà mình?`, choices: [
        [`Plum.|Mận.`, `Plum. I shall write: ‘Rowan chose in one second. I took forty minutes. A balanced household.’|Mận nhé. Em sẽ ghi: “Rowan chọn trong một giây. Em mất bốn mươi phút. Nhà mình thế là cân bằng.”`],
        [`Both.|Cả hai.`, `This is why I chose you. And why our cupboard will not shut. You carry the basket, my love.|Thế mới là mình của em. Và thế nên tủ bếp nhà mình không đóng nổi. Mình xách giỏ nhé, mình ơi.`],
        [`Jam in the album? It will stick.|Mứt vào album? Dính hết bây giờ.`, `Only the label, silly. Though page twelve is still shut from the honey incident. Come on, home.|Dán cái nhãn thôi, ngốc ạ. Dù trang mười hai vẫn chưa mở ra được sau vụ mật ong. Thôi, về nhà nào.`],
      ] },
    } },
    { id: 'shopper-ada-handfuls', when: { who: 'ada' }, nodes: {
      a: { say: `Rowan, dear. The bag says ‘500 grams of flour’. My recipe says ‘four handfuls and a bit’. How many grams is a handful?|Rowan à, con xem này. Bao ghi “500 gam bột”. Công thức của bà ghi “bốn nắm và một tí”. Một nắm là bao nhiêu gam hả con?`, choices: [
        [`Whose hand, Grandma?|Nắm tay của ai hả bà?`, `Mine, of course. Your grandfather’s hand is a shovel. His cakes come out as garden walls.|Tay bà chứ ai. Tay ông con là cái xẻng. Bánh ông làm ra xây được tường rào.`, 'b'],
        [`About sixty, I think.|Con nghĩ chừng sáu mươi.`, `Sixty! You have been reading. My hand has never read a thing, and the cake still rises.|Sáu mươi! Con chịu đọc sách đấy. Tay bà chưa đọc chữ nào mà bánh vẫn nở đều.`, 'b'],
        [`Let Oren weigh your hand.|Bà nhờ anh Oren cân bàn tay xem.`, `He did. He said it weighs ‘one good grandmother’. Charming boy. No help at all.|Cân rồi. Nó bảo nặng “đúng một người bà tốt bụng”. Thằng bé khéo miệng. Mà chẳng giúp được gì.`, 'b'],
      ] },
      b: { say: `And ‘a bit’. The recipe says ‘and a bit’. How big is a bit, would you say?|Còn “một tí”. Công thức ghi “và một tí”. Con bảo một tí là chừng nào?`, choices: [
        [`A pinch more than a pinch.|Nhiều hơn một nhúm đúng một nhúm.`, `That is just what my mother said. You have her good sense. And my nose, lucky child.|Y lời cụ ngày xưa dạy bà. Con được cái khôn của cụ. Lại được cái mũi của bà, sướng nhé.`],
        [`Until it looks right.|Đến khi nhìn thấy vừa mắt.`, `There! That is all of cooking, and all of gardening too. Tell Pip her great-grandma said so.|Đấy! Nấu ăn chỉ có thế, trồng vườn cũng chỉ có thế. Con về nói với bé Pip là cụ nó dạy vậy.`],
        [`Buy two bags, to be safe.|Bà mua hai bao cho chắc.`, `Two bags is eight handfuls and two bits. I shall have to bake twice. What a hardship. Off you go, dear.|Hai bao là tám nắm và hai tí. Thế thì bà phải nướng hai mẻ. Khổ thân bà chưa. Thôi con đi đi.`],
      ] },
    } },
    { id: 'shopper-mara-hens', when: { who: 'mara' }, nodes: {
      a: { say: `I am shopping for the hens. They gave me a list. Well, they stood on a seed catalogue and I marked where. What do you think they chose?|Tôi đi chợ cho đàn gà. Chúng đưa tôi danh sách hẳn hoi. À thì chúng đứng lên cuốn danh mục hạt giống, tôi đánh dấu chỗ chúng đứng. Bạn đoán chúng chọn gì?`, choices: [
        [`Corn.|Ngô.`, `Too obvious. Hens have taste. They stood on ‘tulip bulbs, deluxe’ and looked straight at me.|Dễ đoán quá. Gà có gu chứ. Chúng đứng ngay chỗ “củ tulip, loại hảo hạng” rồi nhìn thẳng vào tôi.`, 'b'],
        [`Whatever costs most.|Món nào đắt nhất.`, `You know hens! They have never paid for a thing in their lives, and it shows.|Bạn hiểu gà ghê! Cả đời chúng chưa trả tiền món nào, nhìn là biết ngay.`, 'b'],
        [`A bigger coop door, for Pip’s chickens.|Cửa chuồng to hơn, cho gà của bé Pip.`, `The ones in her drawings? Those need a barn. I do love them. They never escape.|Mấy con trong tranh con bé à? Phải cả cái kho mới chứa nổi. Tôi quý chúng lắm. Không con nào trốn chuồng.`, 'b'],
      ] },
      b: { say: `And I left Biscuit outside, tied to the trolley bay. It has gone quiet out there. What does quiet mean?|À, tôi buộc Biscuit ở bãi xe đẩy ngoài kia. Ngoài đó tự dưng im ắng. Im ắng nghĩa là sao nhỉ?`, choices: [
        [`Biscuit is asleep.|Biscuit ngủ rồi.`, `You sweet optimist. Biscuit only sleeps after a crime. So something has already been eaten.|Bạn lạc quan dễ thương quá. Biscuit chỉ ngủ sau khi gây án. Tức là có thứ gì đã bị ăn rồi.`],
        [`The trolleys are leaving.|Mấy chiếc xe đẩy đang đi mất.`, `All in a line, with a goat in front? It would not be our first parade. Hold my basket!|Nối đuôi nhau, có con dê dẫn đầu ấy à? Cũng chẳng phải đoàn diễu hành đầu tiên. Cầm hộ tôi cái giỏ!`],
        [`The market flowers are in danger.|Hoa ngoài chợ đang gặp nguy.`, `They are past danger and into lunch. I shall go and apologise. I keep a speech ready.|Hết nguy rồi, giờ thành bữa trưa rồi. Để tôi ra xin lỗi. Bài xin lỗi tôi thuộc sẵn.`],
      ] },
    } },
    { id: 'shopper-ash-shelf', when: { who: 'ash' }, nodes: {
      a: { say: `Do not lean on that shelf. I came for nails and found the jam shelf dips a thumb’s width to the left. I cannot unsee it. Can you?|Đừng tựa vào cái kệ ấy. Tôi vào mua đinh thì phát hiện kệ mứt lệch sang trái đúng một đốt ngón tay. Thấy rồi là không quên được. Bạn có thấy không?`, choices: [
        [`It looks straight to me.|Tôi thấy nó thẳng mà.`, `So the jam believes. Meanwhile the jam is slowly sliding to one end to talk it over.|Mấy hũ mứt cũng tin thế. Trong khi chúng đang từ từ trượt về một đầu để họp bàn.`, 'b'],
        [`Now I see it. Oh no.|Giờ thì tôi thấy rồi. Thôi chết.`, `I am sorry. That is the carpenter’s curse, and now it is yours. Welcome to the trade.|Xin lỗi bạn. Đó là cái nghiệp của thợ mộc, giờ bạn cũng dính. Chào mừng vào nghề.`, 'b'],
        [`Maybe the shop tilts and the shelf is right.|Biết đâu tiệm nghiêng, còn kệ thì thẳng.`, `Hm. I never measured the shop. That would explain the third trolley.|Hừm. Tôi chưa đo cái tiệm bao giờ. Thế thì hiểu được vụ chiếc xe đẩy thứ ba.`, 'b'],
      ] },
      b: { say: `My level is in my pocket. It always is. Do I fix the shelf now, in the middle of shopping hours?|Cái thước thủy nằm sẵn trong túi tôi. Lúc nào cũng thế. Tôi có nên sửa kệ ngay bây giờ, giữa giờ khách đông không?`, choices: [
        [`Measure twice first.|Đo hai lần đã.`, `I measured four times. Finn counted my measurings. We are both satisfied and nothing is done.|Tôi đo bốn lần rồi. Anh Finn đếm số lần tôi đo. Cả hai đều hài lòng và chưa việc gì xong.`],
        [`Slip a jam lid under the short leg.|Kê cái nắp hũ mứt dưới chân thấp.`, `A lid! Quick and shameful. I shall do it, and then lie awake. Thank you, I think.|Cái nắp! Nhanh mà ngượng tay nghề. Tôi sẽ kê, rồi đêm nằm trằn trọc. Cảm ơn bạn, chắc vậy.`],
        [`Leave it. It has character.|Kệ nó. Thế mới có nét riêng.`, `So Nell says: ‘it bends like the willow’. Fine. But I am straightening every price tag on my way out.|Cô Nell cũng bảo: “nó nghiêng như cây liễu”. Được thôi. Nhưng trên đường ra tôi sẽ nắn thẳng từng cái nhãn giá.`],
      ] },
    } },
    { id: 'shopper-hugo-loaves', when: { who: 'hugo' }, nodes: {
      a: { say: `Shh. I am visiting my loaves. I baked them at dawn, and I like to see how they are getting on in the world. How do they look to you?|Suỵt. Tôi đang thăm mấy ổ bánh của tôi. Tôi nướng chúng từ rạng sáng, giờ ghé xem chúng ra đời làm ăn thế nào. Bạn thấy chúng trông ra sao?`, choices: [
        [`Very well bred.|Đúng là con nhà lò.`, `Ha! That one is mine. I have told it daily for twenty years and it never goes stale. Unlike some.|Ha! Câu ấy của tôi đấy. Hai mươi năm nay ngày nào tôi cũng nói mà chưa hề ỉu. Không như một số thứ khác.`, 'b'],
        [`Proud. Crusty, even.|Tự hào. Hơi cứng vỏ nữa.`, `As a loaf should be: crusty outside, soft inside. Same as Theo.|Bánh là phải thế: ngoài giòn cứng, trong mềm. Y như chú Theo.`, 'b'],
        [`One is facing the wrong way.|Có một ổ quay mặt vào trong.`, `That is the rye. Rye loaves have a wry turn of mind. I turn it round, it turns back.|Ổ lúa mạch đen đấy. Nó đen nên hay dỗi. Tôi xoay ra, nó lại xoay vào.`, 'b'],
      ] },
      b: { say: `Tell me true, as a customer. When somebody buys one of my loaves, what should I feel?|Nói thật với tư cách khách hàng nhé. Khi có người mua một ổ bánh của tôi, tôi nên thấy thế nào?`, choices: [
        [`Proud. It is going to a good home.|Tự hào. Nó về một nhà tử tế.`, `I do ask where they live. Nell says I must stop interviewing the customers. But a loaf deserves a good table.|Tôi có hỏi nhà họ ở đâu thật. Cô Nell bảo đừng phỏng vấn khách nữa. Nhưng ổ bánh nào cũng đáng có một cái bàn tử tế.`],
        [`Nothing. It is bread, Hugo.|Chẳng thấy gì. Bánh mì thôi mà, bác Hugo.`, `‘It is bread!’ And the willow is only wood? Go on with you. I knead a moment to myself.|“Bánh mì thôi!” Thế cây liễu cũng chỉ là củi à? Thôi bạn đi đi. Để tôi yên một lát cho cảm xúc nó bột phát.`],
        [`Hungry. Bake more.|Thấy đói. Nướng thêm đi.`, `The kindest words a baker can hear. I shall rise early tomorrow. So will the dough. We are a team.|Lời tử tế nhất mà thợ bánh được nghe. Mai tôi dậy sớm. Bột cũng dậy sớm. Hai chúng tôi là một đội.`],
      ] },
    } },
  ],
};
