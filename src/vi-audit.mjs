// Vietnamese strings added by the coverage audit (scripts/vi-coverage.mjs, scripts/vi-walk.mjs): facility interiors, toasts,
// refusals and labels the first two tables did not reach. Same `English|Vietnamese` lines; `{name}` placeholders follow i18n.mjs.
// Vocabulary is taken from the Zoo Garden tables (cute_game/src/locales/vi-*.ts): lồng, hạ, Titan, Chong Chóng, Đấm Đất, xu.
import { VI_REFERENCE } from './vi-reference.mjs';
import { VI_WILLOWMERE } from './vi-willowmere.mjs';
const BASE=Object.fromEntries(`
Welcome to {place}.|Chào mừng đến {place}.
Willowmere Supermarket|Siêu thị Willowmere
Cold section|Quầy đồ lạnh
Fresh produce|Rau củ tươi
Back room|Kho phía sau
Shop floor|Gian bán hàng
Checkout|Quầy thanh toán
Sell at the checkout|Bán tại quầy thanh toán
Look at the fresh produce|Ngắm rau củ tươi
Fresh from the Rowan fields. The supermarket pays 25% more for your produce at the checkout.|Tươi từ ruộng nhà Rowan. Siêu thị trả thêm 25% cho nông sản của bạn tại quầy thanh toán.
Look at the cold section|Xem quầy đồ lạnh
Peek in the back room|Ngó vào kho phía sau
Crates of tomorrow’s deliveries. Finn is counting them again.|Những thùng hàng giao ngày mai. Finn lại đang đếm chúng lần nữa.
Browse the shelves|Xem các kệ hàng
Aisles|Các lối đi
Shelf after shelf: jam, flour and Hugo’s bread. Everything tastes of Willowmere.|Hết kệ này đến kệ khác: mứt, bột mì và bánh mì của Hugo. Món nào cũng đượm vị Willowmere.
Milk, eggs and the pond’s best fish, kept cold. Sell yours at the checkout.|Sữa, trứng và những con cá ngon nhất của ao, được giữ lạnh. Hãy bán hàng của bạn tại quầy thanh toán.
Classroom|Lớp học
Art room|Phòng mỹ thuật
Library corner|Góc thư viện
Entrance hall|Sảnh vào
Schoolyard|Sân trường
Start a lesson at the blackboard|Bắt đầu bài học ở bảng đen
Lesson|Bài học
Look at the art room|Ngắm phòng mỹ thuật
Paint on the easel still wet: a willow, again. Faye signs every picture with a sun.|Màu trên giá vẽ còn ướt: lại là một cây liễu. Faye ký mỗi bức tranh bằng một mặt trời nhỏ.
Read a story|Đọc một câu chuyện
Library|Thư viện
A quiet corner with a thousand stories. You read a page before the bell.|Một góc yên tĩnh với ngàn câu chuyện. Bạn đọc một trang trước khi chuông reo.
Look at the lockers|Xem tủ đồ
Lockers|Tủ đồ
Every locker has a name tag. Pip’s has a drawing of a very large chicken.|Tủ nào cũng có thẻ tên. Tủ của Pip có hình một con gà thật to.
Look at the trophy|Ngắm chiếc cúp
Trophy|Chiếc cúp
The village run cup. Milo is the second-fastest name on it.|Chiếc cúp chạy bộ của làng. Milo là cái tên nhanh thứ hai trên đó.
Play in the schoolyard|Chơi ở sân trường
Playground|Sân chơi
The seesaw creaks, the sandbox waits. Recess is the best lesson.|Bập bênh kẽo kẹt, hố cát đang chờ. Giờ ra chơi là bài học hay nhất.
Exam room 1|Phòng khám 1
Exam room 2|Phòng khám 2
Pharmacy|Quầy thuốc
Waiting room|Phòng chờ
Reception|Quầy tiếp đón
Check-up in the bed|Khám sức khỏe trên giường bệnh
Look at the medicine|Xem thuốc men
Ginger tea, plasters and sweet cough syrup. Sylvie labels every jar in her neatest hand.|Trà gừng, băng dán và siro ho ngọt. Sylvie dán nhãn từng lọ bằng nét chữ ngay ngắn nhất.
Ask at reception|Hỏi ở quầy tiếp đón
Check-ups cost 30 coins and restore all your energy. One a day is plenty.|Khám sức khỏe tốn 30 xu và hồi đầy năng lượng. Mỗi ngày một lần là đủ.
Cell 1|Phòng giam 1
Cell 2|Phòng giam 2
Evidence room|Phòng vật chứng
Office|Văn phòng
Front desk|Quầy trực
Take a patrol shift|Nhận ca tuần tra
Read the notice board|Đọc bảng thông báo
Notice board|Bảng thông báo
Look in the cells|Nhìn vào phòng giam
Cells|Phòng giam
Two tidy cells with a blanket and a book. Nobody has stayed longer than a lunch hour.|Hai phòng giam gọn gàng, có chăn và sách. Chưa ai ở lâu hơn một giờ nghỉ trưa.
Look at the evidence|Xem vật chứng
Evidence|Vật chứng
Labelled boxes of found things: one boot, three keys and a very muddy hat.|Những hộp dán nhãn đựng đồ nhặt được: một chiếc ủng, ba chìa khóa và một cái mũ lấm bùn.
Boss office|Phòng giám đốc
Meeting room|Phòng họp
Break room|Phòng nghỉ
Open office|Văn phòng chung
Read the hiring board|Đọc bảng tuyển dụng
Hiring board|Bảng tuyển dụng
Take an office shift|Nhận ca làm văn phòng
Look at the boss’s desk|Xem bàn giám đốc
The village leader’s desk: stamps, a heap of produce orders and a very good chair.|Bàn của trưởng làng: con dấu, một chồng đơn đặt nông sản và chiếc ghế rất êm.
Have a coffee|Uống một tách cà phê
A strong coffee and a biscuit. Fern swears the water cooler gossips.|Một tách cà phê đậm và chiếc bánh quy. Fern quả quyết cây nước uống hay buôn chuyện.
Look at the meeting room|Ghé xem phòng họp
Next week’s agenda: more carrots, fewer meetings.|Chương trình tuần sau: thêm cà rốt, bớt họp hành.
Bakehouse|Gian nướng bánh
Pantry|Kho bếp
Family corner|Góc gia đình
Shop|Cửa hàng
Look at the bakes|Ngắm bánh mới nướng
Cake case|Tủ bánh
Bake at the oven|Nướng bánh ở lò
Oven|Lò nướng
Browse the bread|Xem bánh mì
Bread|Bánh mì
Still warm from the oven. The Hearths sell their bread at the market from 8:30.|Còn ấm từ lò. Nhà Hearth bán bánh mì ở chợ từ 8:30.
Peek in the pantry|Ngó vào kho bếp
Sacks of flour, crates of eggs and a jar of wild honey with a label in Nell’s hand.|Bao bột mì, thùng trứng và một hũ mật ong rừng có nhãn do Nell viết tay.
Look at the family corner|Xem góc gia đình
The Hearths live above the shop in winter and beside it in summer. There is always a pot warming.|Nhà Hearth ở tầng trên cửa hàng vào mùa đông và bên cạnh vào mùa hè. Lúc nào cũng có một nồi đang ủ ấm.
Orchard pie, honey buns and Hugo’s famous seed loaf. Bring the ingredients and the oven will do the rest.|Bánh trái cây, bánh mật ong và ổ bánh hạt nổi tiếng của Hugo. Mang nguyên liệu đến, lò nướng sẽ lo phần còn lại.
Stable|Chuồng
Family beds|Giường cả nhà
Barn floor|Sàn chuồng trại
Kitchen corner|Góc bếp
Feed sacks|Bao thức ăn
Collect the eggs and milk|Lấy trứng và sữa
Milking stall|Ô vắt sữa
Sit on the hay|Ngồi trên đống cỏ khô
Hay|Cỏ khô
Sweet-smelling hay up to the rafters. Wren says it is the best place to hide.|Cỏ khô thơm ngọt chất tận xà nhà. Wren bảo đây là chỗ trốn tuyệt nhất.
Look at the tools|Xem dụng cụ
Tools|Dụng cụ
Forks, rakes and one very old hammer. Oren knows where each one hangs.|Chĩa, cào và một cây búa rất cũ. Oren nhớ từng món treo ở đâu.
Look at the beds|Xem những chiếc giường
Three beds in a row, Wren’s with a patchwork quilt and a toy chick.|Ba chiếc giường xếp thành hàng, giường của Wren có chăn ghép mảnh và một chú gà con đồ chơi.
Look at the kitchen corner|Xem góc bếp
A pot of soup on the stove. The Moss family eat well, and mostly with their boots on.|Nồi súp trên bếp. Nhà Moss ăn uống đủ đầy, và phần lớn là vẫn mang nguyên ủng.
Vale Workshop Barn|Kho xưởng Vale
Lumber store|Kho gỗ
Tool bay|Gian dụng cụ
Parts store|Kho phụ tùng
Visit the Vale workshop counter|Ghé quầy xưởng Vale
Look at the lumber|Ngắm kho gỗ
Boards dried for a year and a day. Ash will not sell the good oak.|Ván gỗ được hong khô một năm một ngày. Ash không bán gỗ sồi tốt.
Look at the tool bay|Xem gian dụng cụ
Every chisel is sharp and every handle is worn to the shape of Ash’s hand.|Cái đục nào cũng sắc, cán nào cũng mòn vừa tay Ash.
Look at the parts|Xem phụ tùng
Hinges, hooks and a box of nails labelled “maybe”.|Bản lề, móc treo và một hộp đinh dán nhãn “biết đâu cần”.
Look at the workbench|Xem bàn thợ
A half-built chair waits on the bench, the third one this week.|Chiếc ghế đóng dở nằm chờ trên bàn thợ, cái thứ ba trong tuần.
Visit the Hearth bakery|Ghé tiệm bánh Hearth
Visit the Moss barn|Ghé chuồng Moss
Visit the Vale workshop barn|Ghé kho xưởng Vale
The building could not open.|Không mở được tòa nhà.
The door is stuck for now. Try again in a moment.|Cửa đang bị kẹt. Hãy thử lại sau giây lát.
The door is stuck for now.|Cửa đang bị kẹt.
Step outside|Bước ra ngoài
Cage|Lồng
Walk up to the cage to free {friend}.|Hãy đến gần lồng để thả {friend}.
🏡 {who} reached Willowmere and went to work!|🏡 {who} đã đến Willowmere và bắt tay vào việc!
A young tree. Fruit in {when}.|Cây còn non. Còn {when} nữa mới có quả.
Five fresh {fruit}: {season} is their season.|Năm {fruit} tươi: {season} là mùa của chúng.
Three fresh {fruit}, straight from the tree.|Ba {fruit} tươi, hái thẳng từ cây.
Which word matches {icon}?|Từ nào hợp với {icon}?
Which picture is “{word}”?|Hình nào là “{word}”?
Which number is “{word}”?|Số nào là “{word}”?
How do you write {count} in words?|Số {count} viết bằng chữ là gì?
How many? {icons}|Có bao nhiêu? {icons}
Harvested {count} {crop}!|Đã thu hoạch {count} {crop}!
Sold with thanks. +{amount} coins|Đã bán, xin cảm ơn. +{amount} xu
Your land holds {count} planted fruit trees for now. Richer soil at the workshop makes room for more.|Đất của bạn hiện có {count} cây ăn quả đã trồng. Đất màu mỡ hơn ở xưởng sẽ có thêm chỗ.
Your land holds {count} planted fruit trees for now. Rich soil from the Vale workshop makes room for 4 more.|Đất của bạn hiện có {count} cây ăn quả đã trồng. Đất màu mỡ từ xưởng Vale sẽ có thêm chỗ cho 4 cây nữa.
Clearing a tree costs {amount} coins.|Dọn một cái cây tốn {amount} xu.
A {fish}! On the grass beside you. Walk away to pack your catch.|Câu được {fish}! Nó nằm trên cỏ cạnh bạn. Hãy bước đi để cất mẻ cá.
A {fish}! Worth {amount} coins.|Câu được {fish}! Đáng giá {amount} xu.
Pip loves the {item}!|Pip rất thích {item}!
A good meal makes all the difference. +{count} health|Bữa ăn ngon giúp bạn khỏe hơn nhiều. +{count} máu
The village loved it! Harvest supper prize: {amount} coins.|Cả làng đều thích! Giải bữa tiệc mùa gặt: {amount} xu.
A lovely run: {seconds}s! Village prize +90 coins.|Một vòng chạy thật đẹp: {seconds}s! Giải thưởng của làng +90 xu.
You need {amount} coins.|Bạn cần {amount} xu.
Two new beds cost {amount} coins.|Hai luống mới tốn {amount} xu.
The family turns two more beds of soil. {beds} beds now.|Cả nhà xới thêm hai luống đất. Giờ bạn có {beds} luống.
Tree cleared for {amount} coins. +2 timber.|Đã dọn cây với {amount} xu. +2 gỗ.
Correct! +{amount} coins|Đúng rồi! +{amount} xu
Say hello to {name} first.|Hãy chào {name} trước đã.
Game speed {count}×.|Tốc độ trò chơi {count}×.
Good morning. {season} {day}|Chào buổi sáng. {season}, ngày {day}
You are wearing the {item}.|Bạn đang mang {item}.
Harvest supper is in {count} day(s).|Bữa tiệc mùa gặt còn {count} ngày nữa.
Harvest supper is today. Bring a cooked dish before going to bed.|Hôm nay có bữa tiệc mùa gặt. Hãy mang một món đã nấu trước khi đi ngủ.
Bring a dish you have cooked.|Hãy mang một món bạn đã nấu.
· {count} helper paid {amount} coins and filled your basket.|· {count} người giúp việc được trả {amount} xu và đã đổ đầy giỏ của bạn.
· {count} helpers paid {amount} coins and filled your basket.|· {count} người giúp việc được trả {amount} xu và đã đổ đầy giỏ của bạn.
Rest is part of growing. A good night’s sleep restores all your energy.|Nghỉ ngơi cũng là một phần của lớn lên. Một giấc ngủ ngon sẽ hồi đầy năng lượng cho bạn.
Rest a while|Nghỉ một lát
A quiet moment. +{energy} energy|Một khoảnh khắc yên bình. +{energy} năng lượng
Rest at home to recover energy.|Hãy nghỉ ở nhà để hồi năng lượng.
You are already full of energy.|Bạn đã đầy năng lượng rồi.
Uses {energy} energy|Dùng {energy} năng lượng
Costs {amount} coins|Tốn {amount} xu
Earns {amount} coins|Nhận {amount} xu
Takes {count} hour|Mất {count} giờ
Takes {count} hours|Mất {count} giờ
Fruit trees planted: {have} of {max}. This stump cannot be planted until Rich soil makes room, or a fruit tree is cleared.|Đã trồng {have}/{max} cây ăn quả. Gốc cây này chưa thể trồng cho đến khi Đất màu mỡ có thêm chỗ hoặc một cây ăn quả được dọn đi.
Ready to pick: {count} {fruit}.|Sẵn sàng hái: {count} {fruit}.
Pick|Hái
Clear this tree|Dọn cây này
Clear|Dọn
Clear this tree · {amount} coins|Dọn cây này · {amount} xu
FRUIT TREES {have} / {max}|CÂY ĂN QUẢ {have} / {max}
First fruit in {when}.|Quả đầu tiên sau {when}.
Young {tree} · fruit in {when}|{tree} non · quả sau {when}
{count} morning|{count} buổi sáng
{count} mornings|{count} buổi sáng
Tables|Bàn
Plants|Cây cảnh
Rugs|Thảm
Yarn|Len
Table|Bàn
Your home already holds {count} pieces. Pack one away first.|Nhà bạn đã có {count} món. Hãy cất bớt một món trước.
Your home already holds {count} pieces.|Nhà bạn đã có {count} món.
No room to turn it here. {reason}|Không đủ chỗ để xoay ở đây. {reason}
Can’t place it here. {reason}|Không đặt được ở đây. {reason}
: tap the floor to choose a spot|: chạm xuống sàn để chọn chỗ
Move {piece}|Di chuyển {piece}
Turn {piece}|Xoay {piece}
Comes with the {set}.|Đi kèm {set}.
{desc} From {first} or {second}.|{desc} Có từ {first} hoặc {second}.
{desc} From {first}.|{desc} Có từ {first}.
Bring a home-cooked dish and share in the prize.|Hãy mang một món tự nấu và cùng nhận giải thưởng.
From {first} or {second}|Từ {first} hoặc {second}
From {first}|Từ {first}
a housewarming gift|quà mừng nhà mới
the Woven meadow rug|thảm dệt đồng cỏ
the Sunday reading nook|góc đọc sách ngày nghỉ
the Windowsill garden|vườn bên cửa sổ
the Family library|tủ sách gia đình
the Gathering table|bàn sum họp
the Memory wall|bức tường kỷ niệm
Every {item} is already placed.|Tất cả {item} đã được đặt.
Pick a piece, tap the floor to move it, ↻ turns it, then ✔ Place.|Chọn một món, chạm xuống sàn để di chuyển, ↻ để xoay rồi ✔ Đặt.
in storage|trong kho
/ {max} placed|/ {max} đã đặt
{count} at home|{count} trong nhà
Your home is a fresh canvas. Find furniture at the Vale workshop.|Nhà bạn như tấm vải trắng đang chờ vẽ. Hãy tìm nội thất ở xưởng Vale.
🪚 Browse furniture|🪚 Xem nội thất
Small, sturdy, always where you need it.|Nhỏ gọn, chắc chắn, lúc nào cũng ở đúng chỗ bạn cần.
Find this place on the village map.|Tìm nơi này trên bản đồ làng.
This pillar burns for {seconds} more seconds.|Cột này còn cháy thêm {seconds} giây.
This look needs {amount} coins.|Kiểu này cần {amount} xu.
A new look: {look}!|Kiểu mới: {look}!
Enter {house} · back door|Vào {house} · cửa sau
Enter {house}|Vào {house}
Gather rock|Nhặt đá
Gather mushroom|Nhặt nấm
Gather {thing}|Nhặt {thing}
Water the {crop}|Tưới {crop}
Feed the {animal}|Cho {animal} ăn
Collect from the {animal}|Thu từ {animal}
Feed and tools|Thức ăn và dụng cụ
Roof|Mái nhà
Accent|Màu nhấn
Siding|Vách ngoài
Take off|Cởi ra
Hats, costumes, boots and little companions will hang here.|Mũ, trang phục đặc biệt, ủng và thú cưng nhỏ sẽ được cất ở đây.
Pandora’s box is open: these numbers count out in the wild.|Hộp Pandora đang mở: các chỉ số này có tác dụng ngoài hoang dã.
Iris sells them at the Finch atelier’s stall, beside the village market.|Iris bán chúng ở quầy của tiệm may Finch, cạnh chợ làng.
Taking the clothes off their hangers…|Đang lấy quần áo khỏi móc…
Opening the recipe book…|Đang mở sổ công thức…
Save {amount} more coins to craft {item}.|Hãy để dành thêm {amount} xu để chế tạo {item}.
Your coins or inventory could not be read.|Không đọc được số xu hoặc túi đồ của bạn.
Animal produce could not load.|Không tải được sản phẩm vật nuôi.
The fight effects could not load.|Không tải được hiệu ứng chiến đấu.
The fight HUD could not load.|Không tải được giao diện chiến đấu.
The map could not load.|Không tải được bản đồ.
The titans could not load.|Không tải được các Titan.
The titan skills could not load.|Không tải được kỹ năng Titan.
The outposts could not load.|Không tải được các tiền đồn.
The friends could not load.|Không tải được danh sách bạn bè.
The border banner could not load.|Không tải được biển báo vùng đất.
Outdoor fish could not load.|Không tải được cá ngoài trời.
The Pandora box could not load.|Không tải được hộp Pandora.
The wild creatures could not load.|Không tải được sinh vật hoang dã.
Pandora box open · worn gear counts in fights|Hộp Pandora đang mở · trang bị đang mặc có tác dụng khi chiến đấu
You wake in your own bed, safe at home. June has the kettle on, and Pip has drawn you a get-well card with a very large chicken on it.|Bạn tỉnh dậy trên giường của mình, an toàn ở nhà. June đã đun ấm nước, còn Pip vẽ tặng bạn tấm thiệp chúc mau khỏe có một con gà thật to.
You wake at home, rested. June paid {amount} coins for bandages and a pot of tea.|Bạn tỉnh dậy ở nhà, đã khỏe lại. June trả {amount} xu tiền băng gạc và ấm trà.
Another {gear}: traded for {amount} coins|Thêm một {gear}: đã đổi lấy {amount} xu
Attack ({key})|Tấn công ({key})
Whirlwind ({key})|Chong Chóng ({key})
Dash ({key})|Lướt Tới ({key})
Ground slam ({key})|Đấm Đất ({key})
Whirl|Chong Chóng
Slam|Đấm Đất
Special|Đặc Biệt
Special ({key})|Đặc Biệt ({key})
Wave fan|Quạt Sóng
Dive forward 9 m, hitting enemies on the way for ×2.4, then land in a burst: ×{dmg} damage within 3 m.|Lao tới trước 9 m, gây ×2,4 sát thương lên kẻ địch trên đường, rồi đáp xuống nổ tung: ×{dmg} sát thương trong 3 m.
Better gear, a meal before you go, and the skills make the far fields kinder.|Đồ tốt hơn, một bữa ăn trước khi đi và các kỹ năng sẽ giúp những cánh đồng xa dễ chịu hơn.
Step out of the vehicle to fight.|Hãy bước xuống xe để chiến đấu.
Step out to fish|Bước xuống xe để câu cá
Bosses & titans|Trùm và Titan
Locked cage · by the {boss}|Lồng bị khóa · gần {boss}
away, next visit in {when}|đã đi, lần đến tiếp theo sau {when}
resting, back in {when} · {way}|đang nghỉ, trở lại sau {when} · {way}
Peaceful · {label} when the box is open|Yên bình · {label} khi hộp mở
Canyon Rest|Trạm nghỉ Hẻm núi
Meadow Rest|Trạm nghỉ Đồng cỏ
Forest Rest|Trạm nghỉ Rừng
Swamp Rest|Trạm nghỉ Đầm lầy
Cloud Meadow Gate|Cổng Đồng Cỏ Mây
Night Land Gate|Cổng Xứ Đêm
Toybox Land Gate|Cổng Xứ Đồ Chơi
Candy Land Gate|Cổng Xứ Kẹo
Wild Jungle Gate|Cổng Rừng Rậm Nguyên Sinh
Frost Land Gate|Cổng Xứ Băng Giá
Shell Beach Gate|Cổng Bãi Biển Vỏ Sò
Ember Fields Gate|Cổng Cánh Đồng Than Hồng
Hi {name}!|Chào {name}!
Hello, little {name}.|Chào bé {name} nhé.
Lovely evening, {name}.|Một buổi tối dễ chịu nhỉ, {name}.
Lovely day!|Một ngày đẹp trời nhỉ!
Lovely evening!|Một buổi tối dễ chịu nhỉ!
Good to see you, {name}.|Mừng được gặp bạn, {name}.
Back in {place}. Home is one tap away.|Bạn đang ở {place}. Về nhà chỉ cách một lần chạm.
Back in {place}, in the motorcycle. Home is one tap away.|Bạn đang ở {place}, trên xe máy. Về nhà chỉ cách một lần chạm.
Back in {place}, in the jeep. Home is one tap away.|Bạn đang ở {place}, trên xe jeep. Về nhà chỉ cách một lần chạm.
Explore {place}|Khám phá {place}
A little drive · {ride}|Dạo một vòng · {ride}
A family’s quiet corner. Your own bed is waiting at home.|Góc yên tĩnh của một gia đình. Giường của bạn đang đợi ở nhà.
A neighbour’s wardrobe. Your own is waiting at home.|Tủ quần áo của hàng xóm. Tủ của bạn đang đợi ở nhà.
Buy the motorcycle at the workshop.|Hãy mua xe máy ở xưởng.
Theo’s jeep unlocks after {amount} coins of produce sales. Progress: {current}/{max}.|Xe jeep của Theo mở khóa sau khi bán nông sản được {amount} xu. Tiến độ: {current}/{max}.
Finish the running course on foot first.|Hãy chạy hết đường đua bằng chân trước đã.
WASD or joystick to drive · E to park and step out.|WASD hoặc cần điều khiển để lái · E để đỗ xe và bước xuống.
Finish the village run first. Home waits at the finish.|Hãy hoàn thành cuộc chạy trong làng trước. Nhà đang đợi ở đích.
Driving home. Steer in any direction to stop.|Đang lái về nhà. Hãy bẻ lái theo hướng bất kỳ để dừng.
Heading home. Move in any direction to stop.|Đang về nhà. Hãy di chuyển theo hướng bất kỳ để dừng.
Something is angry at you: hold on three seconds…|Có thứ gì đó đang giận bạn: cố giữ ba giây…
No way home from here. Try a step to one side.|Từ đây không có đường về nhà. Hãy thử bước sang một bên.
Cast again|Thả câu lại
The line held! Let go when the fish surges.|Dây vẫn chắc! Hãy thả ra khi cá lao tới.
Too early! Wait for a bite|Sớm quá! Hãy chờ cá cắn câu
Line may break! Let go!|Dây có thể đứt! Thả ra!
Green ring: hold Reel to pull|Vòng xanh: giữ Kéo cần để kéo
You have taken enough from the woodland today.|Hôm nay bạn đã lấy đủ từ khu rừng rồi.
Visit the village table outside to start the run.|Hãy đến bàn làng bên ngoài để bắt đầu cuộc chạy.
Run to the golden circles in order. First: west of the pond!|Chạy đến các vòng tròn vàng theo thứ tự. Đầu tiên: phía tây ao!
A memory to keep|Một kỷ niệm để giữ
Checkpoint {count}/3 · keep going!|Điểm mốc {count}/3 · cố lên!
Village run · {count}/3|Chạy quanh làng · {count}/3
A lovely jog. Try again for a faster time.|Một vòng chạy thật dễ thương. Hãy thử lại để nhanh hơn nhé.
A single-player adventure · automatically saved on this device|Cuộc phiêu lưu một người chơi · tự động lưu trên thiết bị này
A STORY STILL GROWING|CÂU CHUYỆN VẪN ĐANG LỚN LÊN
ALBUM COMPLETE|ĐÃ ĐỦ BỘ KỶ NIỆM
Enjoy life in Willowmere.|Tận hưởng cuộc sống ở Willowmere.
You are the village leader.|Bạn là trưởng làng.
Ms Brook teaches the village children. A daily lesson helps Pip grow and brings the family closer.|Cô Brook dạy bọn trẻ trong làng. Mỗi ngày một bài học giúp Pip lớn lên và gắn kết cả nhà hơn.
Grandmother|Bà
Grandfather|Ông
returning home|đang về nhà
Alder family|Nhà Alder
Bell family|Nhà Bell
Moss family|Nhà Moss
Reed family|Nhà Reed
Finch family|Nhà Finch
Hearth family|Nhà Hearth
Vale family|Nhà Vale
Brook family|Nhà Brook
Linden family|Nhà Linden
Willow family|Nhà Willow
Alder household|Nhà Alder
Found 2 {item}.|Tìm được 2 {item}.
Home, and the motorcycle too!|Về đến nhà rồi, cả chiếc xe máy nữa!
Home, and the jeep too!|Về đến nhà rồi, cả chiếc xe jeep nữa!
The hillside traders pay 25% more for your produce here.|thương nhân vùng đồi trả thêm 25% cho nông sản của bạn ở đây.
{count} morning(s)|{count} buổi sáng
follow the birds home|theo đàn chim về nhà
Pandora: open|Pandora: đang mở
🔒 Prison|🔒 Nhà giam
{count} m north|{count} m về phía bắc
{count} m north-east|{count} m về phía đông bắc
{count} m east|{count} m về phía đông
{count} m south-east|{count} m về phía đông nam
{count} m south|{count} m về phía nam
{count} m south-west|{count} m về phía tây nam
{count} m west|{count} m về phía tây
{count} m north-west|{count} m về phía tây bắc
Calm fields · {seconds} seconds|Cánh đồng yên bình · {seconds} giây
Volcano awakens · {seconds} seconds|Núi lửa thức giấc · {seconds} giây
Meteor shower · {seconds} seconds|Mưa thiên thạch · {seconds} giây
Magma storm · {seconds} seconds|Bão dung nham · {seconds} giây
Dragon invasion · {seconds} seconds|Rồng xâm lược · {seconds} giây
Treasure eruption · {seconds} seconds|Phun trào kho báu · {seconds} giây
Pull up a chair.|Kéo ghế ngồi đi nào.
Willowmere · game title|Ao Liễu
Willowmere · A Family’s Seasons|Ao Liễu · Bốn mùa bên gia đình
Put down roots in Willowmere. A cozy 3D farming, fishing and family-life RPG.|Bén rễ bên ao liễu. Trò chơi nhập vai 3D ấm cúng về làm vườn, câu cá và cuộc sống gia đình.
`.trim().split('\n').map(line=>{const i=line.indexOf('|');return[line.slice(0,i),line.slice(i+1)];}));
// "Bring 1 obsidian, 2 soft hide.": the crafting list joins "{n} {material}" pieces, so each count gets its own key.
const MATERIALS=['Obsidian','Soft hide','Toy cog','Jungle amber','Fallen timber','Sea pearl','Crab claw','Sky feather','Moonstone','Wild wood','Boar tusk','Wild honey'];
const counted={};
for(const name of MATERIALS){const vi=VI_WILLOWMERE[name]??VI_REFERENCE[name];if(vi)for(let n=1;n<=24;n++)counted[n+' '+name.toLowerCase()]=n+' '+vi;}
export const VI_AUDIT=Object.assign(BASE,counted);

