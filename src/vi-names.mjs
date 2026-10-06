// The ONE table of Vietnamese names for every character, household and village name the player sees (docs/VIETNAMESE-NAMES.md).
// i18n.mjs runs applyNames() over every Vietnamese result, so a name is changed in exactly one row here. English mode never loads this file.
// Phrase rows come first (they win over word rows); words match whole words only, in Capitalised and UPPER case, with a trailing 's removed.
const ROWS=`
Willow & Co.|Liễu & Cộng sự
Ms Brook|Cô Cẩm
Dr Linden|Bác sĩ Hạnh
Officer Reed|Cảnh sát Ngọc
Willowmere|Ao Liễu
Rowan|Rạng
June|Dịu
Pip|Bống
Ada|Ánh
Ellis|Nhẫn
Theo|Thắng
Bea|Bích
Kit|Kiệt
Mara|Mai
Oren|Điền
Wren|Chích
Finn|Phi
Pearl|Ngọc
Iris|Lụa
Leo|Lĩnh
Faye|Phượng
Hugo|Hùng
Nell|Nhài
Ash|Ân
Fern|Dương
Cora|Cẩm
Milo|Minh
Sylvie|Sương
Hazel|Hạnh
Alder|Dẻ
Bell|Chuông
Moss|Rêu
Reed|Sậy
Finch|Sẻ
Hearth|Bếp Lửa
Vale|Thung Xanh
Brook|Suối
Linden|Bồ Đề
`.trim().split('\n').map(line=>line.split('|'));
const escape=text=>text.replace(/[.*+?^${}()|[\]\\&]/g,hit=>hit==='&'?hit:String.fromCharCode(92)+hit);
const lookup=new Map(),forms=[];
// "Theo" is also the Vietnamese verb "to follow" ("Theo dấu", "Theo ba dấu vàng"): the name is not taken when one of those words follows it.
const GUARD={Theo:String.raw`(?! (?:ba|dấu|chân|đường|cách|thứ|sự|dõi|lời|chỉ|một)(?![\p{L}\p{N}]))`};
for(const [from,to] of ROWS){lookup.set(from,to);forms.push(escape(from)+(GUARD[from]??''));if(from.toUpperCase()!==from){lookup.set(from.toUpperCase(),to.toLocaleUpperCase('vi'));forms.push(escape(from.toUpperCase()));}}
forms.sort((a,b)=>b.length-a.length);
const word=String.raw`[\p{L}\p{N}]`;
const pattern=new RegExp(`(?<!${word})(?:${forms.join('|')})(?:[’']s)?(?!${word})`,'gu');
const possessive=/[’']s$/;
export const NAME_ROWS=ROWS;
export const bareName=text=>lookup.get(text);
export function applyNames(text){return text.replace(pattern,hit=>lookup.get(hit.replace(possessive,''))??hit);}
