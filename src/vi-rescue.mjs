// Vietnamese for the missing workers (rescued.mjs, rescue-view.mjs, rescued-talk.mjs): same `English|Vietnamese` lines as vi-audit.mjs.
// The twelve names are rows of vi-names.mjs; the conversations carry their own Vietnamese (rescued-talk.mjs TALK_VI).
import { TALK_VI } from './vi-rescue-talk.mjs';
const BASE=Object.fromEntries(`
School cook|Cô cấp dưỡng trường
Stock clerk|Nhân viên kho
Librarian|Thủ thư
Baker’s hand|Thợ phụ lò bánh
Second officer|Cảnh sát thứ hai
Deli counter|Quầy đồ nguội
Receptionist|Lễ tân
Pharmacist|Dược sĩ
Accountant|Kế toán
Doctor|Bác sĩ
Assistant teacher|Trợ giảng
Detective|Thám tử
Soup first, questions later.|Ăn súp trước, hỏi han sau.
I count things. It calms me down.|Mình đếm mọi thứ. Đếm xong thấy bình tĩnh hẳn.
Shh. The books are sleeping.|Suỵt. Sách đang ngủ.
Flour is just very shy snow.|Bột mì chỉ là tuyết hơi nhút nhát thôi.
I arrested a goat once. It was the wrong goat.|Tôi từng bắt một con dê. Bắt nhầm con.
Everything is better sliced thin.|Cái gì thái mỏng cũng ngon hơn.
Please hold. No, not the phone, the door.|Xin giữ giúp. Không, không phải giữ máy, giữ cửa cơ.
Take two naps and call me in the morning.|Ngủ hai giấc rồi sáng mai gọi cho mình.
I love a number that behaves.|Mình yêu những con số biết nghe lời.
Say “aah”. Lovely. Now say it in tune.|Nói “a” nào. Tuyệt. Giờ nói cho đúng nhạc.
There are no wrong answers. Except that one.|Không có câu trả lời nào sai. Trừ câu đó.
I already know what you had for breakfast.|Tôi biết sẵn sáng nay bạn ăn gì rồi.
A free school lunch each day: +25 energy.|Mỗi ngày một suất cơm trường miễn phí: +25 năng lượng.
One extra daily special: a free packet of seeds each day.|Thêm một món khuyến mãi mỗi ngày: một gói hạt giống miễn phí.
A book of the day with a tip: two more paid lesson answers that day.|Sách của ngày kèm một mẹo: thêm hai câu trả lời được thưởng trong ngày.
A jar of wild honey from the bakery each day.|Mỗi ngày một hũ mật ong rừng từ lò bánh.
The village patrol pays 15 coins more.|Chuyến tuần tra làng được thưởng thêm 15 xu.
A tub of Garden soup from the deli counter each day.|Mỗi ngày một hộp súp vườn từ quầy đồ nguội.
The office shift takes one hour less: your papers are ready.|Ca làm văn phòng ngắn hơn một giờ: giấy tờ của bạn đã sẵn sàng.
One free remedy a day: health restored and +15 energy.|Mỗi ngày một liều thuốc miễn phí: hồi đầy máu và +15 năng lượng.
A wage bonus: the office shift pays 15 coins more.|Thưởng lương: ca làm văn phòng được thêm 15 xu.
The check-up costs half: 15 coins.|Khám sức khoẻ giảm nửa giá: 15 xu.
Every paid lesson answer earns 2 coins more.|Mỗi câu trả lời được thưởng nhận thêm 2 xu.
A case closed each day: 30 coins of lost property returned.|Mỗi ngày phá một vụ: trả lại 30 xu đồ thất lạc.
Thank you! I kept the soup warm the whole time. In my heart.|Cảm ơn bạn! Mình giữ nồi súp ấm suốt. Ở trong tim.
Free! I counted the planks while I waited. Forty-one.|Tự do rồi! Trong lúc chờ mình đã đếm ván. Bốn mươi mốt tấm.
Thank you. Quietly, please: I have a reputation.|Cảm ơn bạn. Nói nhỏ thôi nhé: tôi còn phải giữ tiếng.
You found me! I have been kneading the air for days.|Bạn tìm thấy mình rồi! Mấy ngày nay mình toàn nhào không khí.
Thank you, citizen! I was about to arrest the door.|Cảm ơn công dân! Tôi sắp bắt giữ cánh cửa đến nơi.
At last! The walls were delicious, and I regret nothing.|Cuối cùng cũng xong! Mấy bức tường ngon lắm, và mình không hối hận gì cả.
Thank you for visiting. Do you have an appointment?|Cảm ơn bạn đã ghé thăm. Bạn có hẹn trước không?
Thank you! I prescribe myself one warm blanket.|Cảm ơn bạn! Mình tự kê cho mình một cái chăn ấm.
Free at last! That is one of me, minus one hut.|Tự do rồi! Một mình, trừ đi một cái chòi.
Thank you! My diagnosis: you are a very good neighbour.|Cảm ơn bạn! Chẩn đoán của tôi: bạn là một người hàng xóm rất tốt.
Thank you! Full marks, and a gold star.|Cảm ơn bạn! Điểm mười, kèm một ngôi sao vàng.
I knew you would come. I deduced it from the footsteps.|Tôi biết bạn sẽ đến. Tôi suy ra từ tiếng bước chân.
A hot school lunch. +25 energy|Một suất cơm trường nóng hổi. +25 năng lượng
Today’s extra special: a free packet of seeds.|Khuyến mãi thêm hôm nay: một gói hạt giống miễn phí.
You read the book of the day. Two more lesson answers pay today.|Bạn đã đọc cuốn sách của ngày. Hôm nay thêm hai câu trả lời được thưởng.
A jar of wild honey, still warm from the oven shelf.|Một hũ mật ong rừng, còn ấm từ kệ lò nướng.
A tub of Garden soup from the deli counter.|Một hộp súp vườn từ quầy đồ nguội.
One free remedy. Health restored and +15 energy|Một liều thuốc miễn phí. Hồi đầy máu và +15 năng lượng
Case closed: 30 coins of lost property returned.|Phá án xong: trả lại 30 xu đồ thất lạc.
Nobody is here.|Không có ai ở đây.
This hut is empty.|Cái chòi này trống rồi.
{name} is shut inside. The boss of this land holds the key.|{name} bị nhốt bên trong. Trùm của vùng đất này giữ chìa khoá.
Walk up to the hut to let {name} out.|Hãy đến sát cái chòi để thả {name} ra.
{name} is free and hurries home to work: {role}.|{name} đã tự do và vội về làng làm việc: {role}.
{name} has helped you today already. Come back tomorrow.|Hôm nay {name} đã giúp bạn rồi. Mai quay lại nhé.
Gus walked the second round: +15 coins|Giáp đi tuần vòng hai: +15 xu
Edith halved the bill|Yến giảm nửa hoá đơn
Otis had your papers ready: one hour saved|Quý đã chuẩn bị sẵn giấy tờ: đỡ một giờ
Winnie found a bonus: +15 coins|Vân tìm ra khoản thưởng: +15 xu
The missing workers|Những người làm bị mất tích
{count} of 12 are back|{count} trên 12 người đã về
held in {place}|bị giữ ở {place}
Help! In here!|Cứu với! Ở trong này!
Hello? Anybody out there?|Có ai không? Ngoài đó có ai không?
The door is stuck. Very stuck.|Cửa bị kẹt. Kẹt cứng luôn.
Psst! Over here!|Này! Bên này cơ!
Let {name} out|Thả {name} ra
{name} is back at work here. {unlock}|{name} đã trở lại làm việc ở đây. {unlock}
The huts could not load.|Không tải được mấy cái chòi.
The conversation could not load.|Không tải được cuộc trò chuyện.
back at work|đã trở lại làm việc
the hut can be opened|có thể mở chòi
the boss holds the key|trùm giữ chìa khoá
{name} is held here|{name} bị giữ ở đây
`.trim().split('\n').map(line=>{const i=line.indexOf('|');return[line.slice(0,i),line.slice(i+1)];}));
export const VI_RESCUE=Object.assign(BASE,TALK_VI);
