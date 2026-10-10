// Whoever minds a Town Square building while all its staff are hired away to your farm (villagers.mjs MINDERS; rules and
// format: facility-talk.mjs). Any adult villager can say these.
export default {
  '@cover': [
    { id: 'cover-minding', nodes: {
      a: { say: `Oh, hello! I am minding the place. Everyone who works here is out on YOUR farm today, so I got the keys and no instructions.|Ô, chào bạn! Tôi đang trông chỗ này. Người làm ở đây hôm nay ra hết ruộng NHÀ BẠN rồi, tôi được giao chìa khóa, còn dặn dò thì không.`, choices: [
        [`Sorry about that|Ngại quá nhỉ`, `Do not be. I have a chair, a bell and nobody telling me how. Best job I ever had.|Ngại gì. Tôi có ghế, có chuông, lại chẳng ai chỉ việc. Chỗ làm tuyệt nhất đời tôi.`, 'b'],
        [`How is it going?|Trông coi ổn không?`, `Nothing is on fire and nothing is missing. I counted the doors twice. Still one.|Chưa cháy gì, chưa mất gì. Tôi đếm cửa hai lần rồi. Vẫn đúng một cái.`, 'b'],
        [`You look the part|Trông bạn ra dáng lắm`, `It is the standing. I stand where they stand and frown a little. People believe anything.|Nhờ cái dáng đứng đấy. Tôi đứng đúng chỗ họ đứng, hơi cau mày một tí. Thế là ai cũng tin.`, 'b'],
      ] },
      b: { say: `One thing, though. If somebody asks me a real question, what do I say?|Có điều này. Lỡ có người hỏi một câu nghiêm túc thì tôi trả lời sao?`, choices: [
        [`Say: come back tomorrow|Bảo họ mai quay lại`, `Perfect. That is what the real ones say too, only with a form.|Chuẩn. Người làm thật ở đây cũng nói vậy, chỉ khác là có kèm tờ đơn.`],
        [`Say: ask Bea|Bảo họ hỏi Bea`, `Of course. Everything in this village ends with “ask Bea”. Even Bea asks Bea.|Phải rồi. Ở làng này chuyện gì cũng kết bằng “hỏi Bea”. Đến Bea cũng tự hỏi Bea.`],
        [`Nod slowly and say “hmm”|Gật gù rồi nói “ừm”`, `Hmm. Hmm. Yes, that feels very official. I may never go home.|Ừm. Ừm. Ờ, nghe ra dáng cán bộ hẳn. Khéo tôi ở lại đây luôn.`],
      ] },
    } },
    { id: 'cover-keys', nodes: {
      a: { say: `They left me a ring of keys. Eleven keys. This building has one lock. I have been thinking about the other ten all morning.|Họ đưa tôi một chùm chìa khóa. Mười một chìa. Cả tòa nhà có đúng một ổ khóa. Từ sáng đến giờ tôi cứ nghĩ mãi về mười chìa còn lại.`, choices: [
        [`Spares, surely|Chắc là chìa dự phòng`, `Ten spares for one lock? Somebody here loses keys the way Ellis loses reading glasses.|Mười chìa dự phòng cho một ổ khóa? Ở đây hẳn có người đánh rơi chìa như ông Ellis đánh rơi kính.`, 'b'],
        [`Ten secret doors|Mười cánh cửa bí mật`, `That is what I hoped! I tapped every wall. I found a spider and a very old biscuit.|Tôi cũng mong thế! Tôi gõ thử hết các bức tường. Tìm được một con nhện và một cái bánh quy rất cũ.`, 'b'],
        [`One is for the goat pen|Một chìa là của chuồng dê`, `Then it is the only key in Willowmere that has never worked. Biscuit lets herself out.|Vậy thì đó là cái chìa duy nhất ở Willowmere chưa từng có tác dụng. Biscuit tự mở cửa lấy.`, 'b'],
      ] },
      b: { say: `When your helpers come back from the fields, shall I tell them I did well?|Lúc người làm của bạn ở ruộng về, tôi báo là tôi trông coi tốt nhé?`, choices: [
        [`You did very well|Bạn làm tốt lắm`, `Thank you. I shall want it in writing. Bea likes things in writing.|Cảm ơn bạn. Cho tôi xin một tờ giấy xác nhận. Bea thích cái gì cũng có giấy tờ.`],
        [`Tell them it was chaos|Cứ bảo là loạn hết cả lên`, `Ha! Then they will never take a day on the farm again. Clever. Cruel, but clever.|Ha! Thế thì họ hết dám ra ruộng luôn. Cao tay. Hơi ác, nhưng cao tay.`],
        [`Say nothing, keep a key|Im lặng, giữ lại một chìa`, `A souvenir! I will take the smallest one. It probably opens something very small and important.|Làm kỷ niệm! Tôi lấy cái bé nhất. Chắc nó mở một thứ gì đó rất nhỏ mà rất quan trọng.`],
      ] },
    } },
  ],
};
