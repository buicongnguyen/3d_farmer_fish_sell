export const GAME_TITLE = 'Willowmere';
export const SEASONS = ['Spring', 'Summer', 'Autumn', 'Winter'];
export const CROPS = {
  carrot: {name:'Carrot', price:6, sell:19, grow:32, yield:2, icon:'crops/carrot', color:'#df934c'},
  radish: {name:'Radish', price:9, sell:25, grow:44, yield:2, icon:'crops/radish', color:'#da7185'},
  pumpkin: {name:'Pumpkin', price:18, sell:55, grow:70, yield:2, icon:'crops/pumpkin', color:'#dc944c'},
  berry: {name:'Berry', price:14, sell:37, grow:56, yield:2, icon:'crops/berry', color:'#967fc4'},
  // Flowers grow from cuttings shared by the village: no seeds to buy.
  tulip: {name:'Tulip', price:0, sell:14, grow:38, yield:3, emoji:'🌷', color:'#ff4f8b', flower:true, free:true},
  sunflower: {name:'Sunflower', price:0, sell:20, grow:52, yield:2, emoji:'🌻', color:'#ffc21a', flower:true, free:true},
  daisy: {name:'Daisy', price:0, sell:11, grow:30, yield:3, emoji:'🌼', color:'#fff3a8', flower:true, free:true},
};
export const ITEMS = {
 ...Object.fromEntries(Object.entries(CROPS).map(([k,v])=>[k,v])),
 apple:{name:'Apple',sell:32,icon:'crops/apple'},peach:{name:'Peach',sell:42,icon:'crops/peach'},mango:{name:'Mango',sell:48,icon:'crops/mango'},
 perch:{name:'River perch',sell:24,icon:'fish/perch'},carp:{name:'Silver carp',sell:36,icon:'fish/carp'},catfish:{name:'Catfish',sell:52,icon:'fish/catfish'},koi:{name:'Blossom koi',sell:85,icon:'fish/koi'},rainbow:{name:'Rainbow fish',sell:120,icon:'fish/rainbow'},golden:{name:'Golden fish',sell:180,icon:'fish/golden'},
 egg:{name:'Fresh egg',sell:22,icon:'items/egg'},milk:{name:'Fresh milk',sell:38,icon:'items/milk'},mushroom:{name:'Wild mushroom',sell:18,emoji:'🍄'},wood:{name:'Fallen timber',sell:12,emoji:'🪵'},game:{name:'Woodland game',sell:48,emoji:'🌿'},
 soup:{name:'Garden soup',sell:90,emoji:'🥣',energy:35},fishplate:{name:'Ellis’s fish supper',sell:130,emoji:'🍲',energy:55},pie:{name:'Ada’s orchard pie',sell:160,emoji:'🥧',energy:70},
};
export const TREES={apple:{name:'Apple tree',price:65},peach:{name:'Peach tree',price:95},mango:{name:'Mango tree',price:120}};
export const OUTFITS = [
 ['meadow','Meadow linen','#849978',0],['harbor','Harbor blue','#668caa',75],['rose','Rose cardigan','#c77c89',90],['honey','Honey overalls','#d4a44f',100],['plum','Plum knit','#8f76a0',115],['clay','Potter’s apron','#b97052',125],['sage','Sage gardener','#52968b',140],['midnight','Midnight coat','#45546e',155],['ivory','Sunday linen','#e5d5b5',170],['coral','Summer coral','#e78366',185],['fern','Woodland jacket','#527153',200],['festival','Festival velvet','#964e66',240],['sky','Cloud blue','#a7c4cb',130],
].map(([id,name,color,price])=>({id,name,color,price}));
export const KID_OUTFITS=[['sunny','Sunshine pinafore','#e8b950',55],['rain','Puddle-jump coat','#68a8b7',75],['berry','Berry cardigan','#bf7199',95],['party','Festival dress','#a48cc3',120]].map(([id,name,color,price])=>({id,name,color,price}));
export const FURNITURE=[
 {id:'rug',name:'Woven meadow rug',price:95,emoji:'🧶',desc:'A soft green centrepiece for your living room.'},
 {id:'sofa',name:'Sunday reading nook',price:160,emoji:'🛋',desc:'A comfortable sofa and a floor lamp.'},
 {id:'plants',name:'Windowsill garden',price:85,emoji:'🪴',desc:'Bring a little of the orchard indoors.'},
 {id:'books',name:'Family library',price:140,emoji:'📚',desc:'A shelf for books and all the stories to come.'},
 {id:'dining',name:'Gathering table',price:180,emoji:'🪑',desc:'There is always room for one more guest.'},
 {id:'art',name:'Memory wall',price:110,emoji:'🖼',desc:'Pictures, a family photo and a little keepsake.'},
];
export const UPGRADES={
 farm:{name:'Rich soil',emoji:'🌱',cost:[120,260,480],desc:['Compost · healthier beds','Irrigation · +1 crop yield','Prize soil · +2 crop yield']},
 pond:{name:'Family pond',emoji:'🐟',cost:[160,340,650],desc:['Clear the reeds · koi arrive','Deep water · rainbow fish','Restore the spring · golden fish']},
 pen:{name:'Animal pen',emoji:'🐓',cost:[130,290,520],desc:['A second hen joins the flock','A dairy cow and a shelter','A larger happy herd · double produce']},
 house:{name:'Family home',emoji:'🏡',cost:[220,460,850],desc:['Pip’s corner · a fresh roof','A welcoming home · extra furnishings','The family homestead · a fine fireplace']},
 kitchen:{name:'Country kitchen',emoji:'🍳',cost:[130,280,480],desc:['A proper stove · fish supper','An oven · orchard pie','A chef’s kitchen · better sale prices']},
};
export const RECIPES={soup:{name:'Garden soup',needs:{carrot:2,mushroom:1},level:0},fishplate:{name:'Ellis’s fish supper',needs:{perch:1,carrot:1},level:1},pie:{name:'Ada’s orchard pie',needs:{apple:2,egg:1},level:2}};
// American county layout: the Rowan homestead (the village leader's farm) sits in the
// middle, a county road rings it, and the other families live out by the border,
// set back from the road behind their own lawns. rot turns the front (+z) to face the road.
export const ROADS={north:-33,south:40,west:-52,east:52};
export const POND={x:16,z:5,w:14,d:9};
export const FISH_SPOT={x:11,z:12.2};
export const HOUSES=[
 {id:0,name:'Your homestead',family:'Rowan',x:0,z:-14,rot:0,style:'house_gable',color:'#EF5A3C',trim:'#B9372A',accent:'#38A8EE',siding:'#FFF4DE'},
 {id:1,name:'Ada’s cottage',family:'Alder',x:-38,z:-20,rot:-Math.PI/2,rural:'farm_c',style:'house_round',color:'#FFB627',trim:'#E08A12',accent:'#E8433A',siding:'#FFF1D2'},
 {id:2,name:'Bell garage',family:'Bell',x:38,z:-20,rot:Math.PI/2,rural:'farm_d',style:'house_hip',color:'#3E9BE8',trim:'#2A6FC0',accent:'#FFB627',siding:'#FFE7A8'},
 {id:3,name:'Moss farmhouse',family:'Moss',x:-30,z:54,rot:Math.PI,rural:'farm_b',style:'house_front',color:'#5FC84A',trim:'#3A9A34',accent:'#E8433A',siding:'#F6EFDF'},
 {id:4,name:'Reed boathouse',family:'Reed',x:38,z:20,rot:Math.PI/2,rural:'farm_a',barn:true,style:'house_tall',color:'#22B8C8',trim:'#168B9A',accent:'#FF8A2A',siding:'#F2F7FF'},
 {id:5,name:'Finch atelier',family:'Finch',x:-38,z:0,rot:-Math.PI/2,rural:'farm_c',style:'house_front',color:'#FF7FB6',trim:'#E0508F',accent:'#8B5CF6',siding:'#FFF4F8'},
 {id:6,name:'Hearth bakery',family:'Hearth',x:10,z:54,rot:Math.PI,rural:'farm_d',style:'house_hip',color:'#FF8A2A',trim:'#D9631A',accent:'#2E9BE8',siding:'#FFF1D2'},
 {id:7,name:'Vale workshop',family:'Vale',x:-38,z:20,rot:-Math.PI/2,rural:'farm_a',barn:true,style:'house_gable',color:'#9B6BFF',trim:'#7146D8',accent:'#FFC83A',siding:'#F6EFDF'},
 {id:8,name:'Brook cottage',family:'Brook',x:30,z:54,rot:Math.PI,rural:'farm_b',style:'house_round',color:'#E8433A',trim:'#B52C26',accent:'#3E9BE8',siding:'#FFF4DE'},
 {id:9,name:'Linden lodge',family:'Linden',x:-10,z:54,rot:Math.PI,rural:'farm_a',style:'house_tall',color:'#F5B21E',trim:'#C98710',accent:'#3FB52A',siding:'#F4FFF0'},
];
// Town Square: civic buildings on the north side of the county road.
export const CIVIC=[
 {id:'school',name:'Willowmere School',verb:'Go to Willowmere School',x:-22,z:-40,w:10.6,d:7,h:9.5},
 {id:'hospital',name:'Village Clinic',verb:'Visit the village clinic',x:-6,z:-40,w:10.6,d:7.2,h:7.2},
 {id:'police',name:'Police Station',verb:'Visit the police station',x:10,z:-40,w:10,d:6.8,h:7},
 {id:'company',name:'Willow & Co.',verb:'Visit Willow & Co. offices',x:26,z:-40,w:9,d:6.8,h:9.5},
];
// Where each villager goes on a weekday (9:00–17:00). Children attend school.
export const WORKPLACE={cora:'school',hazel:'hospital',sylvie:'hospital',pearl:'police',theo:'police',bea:'company',leo:'company',hugo:'company',fern:'company'};
// The leader can hire neighbours. Wages are paid each morning; produce arrives in your basket.
export const JOBS={
 farmhand:{name:'Farmhand',wage:40,emoji:'🧑‍🌾',desc:'Tends your fields: 3 carrots and 2 radishes each morning.',yields:{carrot:3,radish:2}},
 fisher:{name:'Fisher',wage:55,emoji:'🎣',desc:'Fishes your pond at dawn: 2 perch and a carp.',yields:{perch:2,carp:1}},
 herder:{name:'Herder',wage:45,emoji:'🐄',desc:'Cares for the animals: 2 eggs and a milk each morning.',yields:{egg:2,milk:1}},
 gardener:{name:'Florist',wage:30,emoji:'💐',desc:'Grows flowers for market: 3 tulips and 2 sunflowers.',yields:{tulip:3,sunflower:2}},
};

// Player Rowan is the 24th resident. Children remain children in this first story volume.
const PEOPLE=[
 ['june','June',0,'Your partner','Let’s make a home we can grow into. I’ll keep the kettle warm.','#c78477'],
 ['pip','Pip',0,'Your daughter','I planted a tiny wish next to the garden. Do you think it will grow?','#d5b456',true],
 ['ada','Ada',1,'Grandmother · seeds','Your grandfather and I arrived with one seed tin and a very leaky roof. Roots take time, Rowan.','#9181a1'],
 ['ellis','Ellis',1,'Grandfather · fishing','See the ripples? Be patient, and reel only when the little marker meets the green water.','#708d9b'],
 ['theo','Theo',2,'Mechanic · jeep owner','Sell 200 coins of produce and our old jeep is yours to borrow. A good road begins with good neighbours.','#7b9478'],
 ['bea','Bea',2,'Postkeeper','I deliver the letters. Theo delivers the potholes. The country market is beyond the east gate.','#b97f68'],
 ['kit','Kit',2,'Young inventor','One day I’m building a motorbike powered entirely by pumpkin soup.','#739caa',true],
 ['mara','Mara',3,'Animal keeper','Feed the hens each morning and check the basket. A better pen makes room for a cow.','#cc9d56'],
 ['oren','Oren',3,'Farmer','Water is the secret. An unwatered seed will wait for you, so take your time.','#819969'],
 ['wren','Wren',3,'Little gardener','Pip and I are making a club. Only very small gardeners can join.','#b6829c',true],
 ['finn','Finn',4,'Fisher','Our pond once shone with golden fish. Clear the spring and they may return.','#609a9d'],
 ['pearl','Pearl',4,'Police officer · boat maker','I remember your mother racing along the dock. Every family leaves ripples here.','#8b9fba'],
 ['iris','Iris',5,'Tailor','Work clothes can be lovely too. My new collection has a colour for every season.','#b6809b'],
 ['leo','Leo',5,'Weaver','A rug makes a house feel lived in. Fern sells some of my best work.','#8c91b0'],
 ['faye','Faye',5,'Young artist','I drew all ten houses. Yours has the biggest sun above it.','#dc9866',true],
 ['hugo','Hugo',6,'Baker','A carrot, a mushroom, a warm pot. A little kitchen can feed a whole story.','#a7947a'],
 ['nell','Nell',6,'Festival host','Every third day is harvest supper! Bring a dish you cooked and share in the prize purse.','#c77f76'],
 ['ash','Ash',7,'Carpenter','Homes grow one good board at a time. Come to the workshop when you’re ready.','#829589'],
 ['fern','Fern',7,'Furniture maker','I keep a table ready for unexpected visitors. A village should feel like that.','#9c9e70'],
 ['cora','Cora',8,'Teacher · race steward','Follow the three golden markers in order. The village run is open every day.','#7f94b5'],
 ['milo','Milo',8,'Schoolboy','I’m the second-fastest runner in Willowmere. Don’t ask how many entered.','#c49b66',true],
 ['sylvie','Sylvie',9,'Orchard keeper','Trees are promises to your future self. Plant one now; it will feed you for seasons.','#919d6a'],
 ['rowan_neighbour','A note from home',-1,'','', '#fff'],
];
// There are 22 NPCs above; add the village nurse to the Linden household.
PEOPLE.pop(); PEOPLE.push(['hazel','Hazel',9,'Village nurse','Rest is part of growing. A good night’s sleep restores all your energy.','#b493a9']);
export const RESIDENTS=PEOPLE.map(([id,name,home,role,line,color,child=false],i)=>({id,name,home,role,line,color,child,index:i}));
export const CHAPTERS=[
 {title:'A key and a seed tin',subtitle:'Every story starts with coming home.',text:'In 1968, Ada and Ellis built a cottage beside an unnamed pond. They planted a willow on their wedding day. Decades later, you return with June and Pip, carrying their old brass key.',goals:[['Meet Grandmother Ada',s=>!!s.met.ada]],reward:40,memory:'Ada places the old seed tin in your hands. “Nothing here has to be done in a hurry.”'},
 {title:'Something takes root',subtitle:'A small harvest. A big beginning.',text:'June remembers visiting this garden as a child. Pip only sees a patch of dirt, until the first green leaves appear. The family begins keeping an album of ordinary, lovely days.',goals:[['Harvest three garden beds',s=>s.stats.harvests>=3]],reward:90,memory:'Pip draws three enormous carrots. June writes beneath them: Our first harvest.'},
 {title:'The water remembers',subtitle:'Learn the patience of the pond.',text:'Ellis kept his boat here for forty years. His notebook records fish, weather, and the day your mother first learned to swim. Now there is space on the next page for your catches.',goals:[['Catch two fish',s=>s.stats.fish>=2]],reward:110,memory:'Ellis gives you the notebook. A pressed willow leaf falls from its pages.'},
 {title:'A table for everyone',subtitle:'Your little farm finds its neighbours.',text:'The family used to trade apples for bread and eggs for mended clothes. The same quiet exchange still holds Willowmere together. Take your produce to market.',goals:[['Earn 200 coins selling produce',s=>s.stats.sales>=200]],reward:140,memory:'Theo leaves the jeep key on your doorstep. “The road is yours too,” reads the note.'},
 {title:'Room to grow',subtitle:'Make a place for the next generation.',text:'Pip asks for a corner to keep her drawings. June dreams of a room where everyone can sit together. Good harvests become walls, windows, and a happier home.',goals:[['Improve your family home',s=>s.upgrades.house>=1],['Care for the farm animals',s=>s.stats.feeds>=1]],reward:160,memory:'Pip pins her drawing beside her new bed. It shows the three of you, and one very large chicken.'},
 {title:'Beyond the willow',subtitle:'There is a wider world, and a way home.',text:'The Bells have driven this road for generations. Borrow their jeep or save for a motorcycle. Bring a piece of Willowmere to the country market beyond the east gate.',goals:[['Visit the country market',s=>s.stats.trips>=1]],reward:170,memory:'From the hill, the village looks small. For the first time, it feels entirely like home.'},
 {title:'A recipe passed down',subtitle:'Some traditions begin at the stove.',text:'Ada never wrote down her recipes. She measured by handfuls, remembered birthdays by pies, and brought soup to every new family. Make a dish and bring it to the harvest supper.',goals:[['Cook a family recipe',s=>s.stats.cooked>=1],['Share a dish at harvest supper',s=>s.stats.festivals>=1]],reward:210,memory:'Twenty-four places are set. Pip insists on adding a tiny bowl for the garden birds.'},
 {title:'The next spring',subtitle:'A home is something you keep growing.',text:'The pond runs clear. The young orchard reaches toward the light. Ada says the willow was once smaller than Pip. You turn to the next blank page of the family album.',goals:[['Plant two orchard trees',s=>s.trees.filter(Boolean).length>=2],['Restore the pond to tier two',s=>s.upgrades.pond>=2],['Meet twelve neighbours',s=>Object.keys(s.met).length>=12]],reward:350,memory:'Years will bring new harvests, new stories, new leaves on the willow. This is the end of the first volume. Your life in Willowmere continues.'},
];
export const iconUrl=id=>`./assets/icons/${id.startsWith('fish/')?'fish/fish_'+id.slice(5):id}.webp`;
export const MAX_BEDS=30;
export const BED_POSITIONS=Array.from({length:MAX_BEDS},(_,i)=>({x:-22+(i%6)*2.6,z:-3+Math.floor(i/6)*2.7}));
export const ORCHARD_POSITIONS=[{x:-20,z:16},{x:-14,z:16},{x:-8,z:16}];
export const RACE_POINTS=[{x:4,z:24},{x:24,z:30},{x:30,z:-4}];
