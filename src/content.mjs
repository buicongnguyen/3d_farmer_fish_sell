export const GAME_TITLE = 'Willowmere';
export const SEASONS = ['Spring', 'Summer', 'Autumn', 'Winter'];
export const CROPS = {
  carrot: {name:'Carrot', price:6, sell:19, grow:32, yield:2, icon:'crops/carrot', color:'#df934c'},
  radish: {name:'Radish', price:9, sell:25, grow:44, yield:2, icon:'crops/radish', color:'#da7185'},
  pumpkin: {name:'Pumpkin', price:18, sell:55, grow:70, yield:2, icon:'crops/pumpkin', color:'#dc944c'},
  berry: {name:'Berry', price:14, sell:37, grow:56, yield:2, icon:'crops/berry', color:'#967fc4'},
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
 farm:{name:'Garden beds',emoji:'🌱',cost:[120,260,480],desc:['12 beds · better harvests','18 beds · +1 crop yield','24 beds · +2 crop yield']},
 pond:{name:'Family pond',emoji:'🐟',cost:[160,340,650],desc:['Clear the reeds · koi arrive','Deep water · rainbow fish','Restore the spring · golden fish']},
 pen:{name:'Animal pen',emoji:'🐓',cost:[130,290,520],desc:['A second hen joins the flock','A dairy cow and a shelter','A larger happy herd · double produce']},
 house:{name:'Family home',emoji:'🏡',cost:[220,460,850],desc:['Pip’s corner · a fresh roof','A welcoming home · extra furnishings','The family homestead · a fine fireplace']},
 kitchen:{name:'Country kitchen',emoji:'🍳',cost:[130,280,480],desc:['A proper stove · fish supper','An oven · orchard pie','A chef’s kitchen · better sale prices']},
};
export const RECIPES={soup:{name:'Garden soup',needs:{carrot:2,mushroom:1},level:0},fishplate:{name:'Ellis’s fish supper',needs:{perch:1,carrot:1},level:1},pie:{name:'Ada’s orchard pie',needs:{apple:2,egg:1},level:2}};
export const HOUSES=[
 {id:0,name:'Your homestead',family:'Rowan',x:-21,z:-9,color:'#bd7457',accent:'#e7bc82'},
 {id:1,name:'Ada’s cottage',family:'Alder',x:-37,z:-19,color:'#93a394',accent:'#ede0b6'},
 {id:2,name:'Bell garage',family:'Bell',x:0,z:-23,color:'#6c9297',accent:'#c9d3bb'},
 {id:3,name:'Moss farmhouse',family:'Moss',x:18,z:-23,color:'#a9775d',accent:'#e6c595'},
 {id:4,name:'Reed boathouse',family:'Reed',x:36,z:-12,color:'#668e9c',accent:'#d9dfbc'},
 {id:5,name:'Finch atelier',family:'Finch',x:-40,z:3,color:'#b78293',accent:'#f2d4ba'},
 {id:6,name:'Hearth bakery',family:'Hearth',x:35,z:11,color:'#bd8964',accent:'#e8d89b'},
 {id:7,name:'Vale workshop',family:'Vale',x:-38,z:27,color:'#7d9384',accent:'#d3c4a0'},
 {id:8,name:'Brook schoolhouse',family:'Brook',x:31,z:31,color:'#969cbc',accent:'#f1d9b0'},
 {id:9,name:'Linden lodge',family:'Linden',x:8,z:36,color:'#9c7563',accent:'#e2caae'},
];
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
 ['pearl','Pearl',4,'Boat maker','I remember your mother racing along the dock. Every family leaves ripples here.','#8b9fba'],
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
export const BED_POSITIONS=Array.from({length:24},(_,i)=>({x:-24+(i%6)*2.5,z:5+Math.floor(i/6)*2.7}));
export const ORCHARD_POSITIONS=[{x:-28,z:20},{x:-21,z:21},{x:-14,z:22}];
export const RACE_POINTS=[{x:-3,z:12},{x:14,z:22},{x:17,z:2}];
