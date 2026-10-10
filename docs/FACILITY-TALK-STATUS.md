# People and conversations in the Town Square buildings: status (branch `facility-talk`, from main 29da6d3)

The request: "In school and village clinic and police station, nobody there yet. Make people there and make conversation of them
ready so that we can talk or interact with them by choice: 3 choices for each question", then "those conversations should be
funny", then "also the company building and the supermarket too: items to interact and people to say and interact".

## Why the buildings looked empty

Measured first with Playwright (`tests/facility-people-run.mjs`, `evidence-facility-talk/people-before.json`): each of the
three buildings entered at 08:00, 10:00, 12:30, 15:00, 18:00 and 21:00 on day 1 (box shut), day 3 (festival, box open) and
day 10 (rain, Hazel, Theo and Cora hired).

| | 08:00 | 10:00 | 12:30 | 15:00 | 18:00 | 21:00 |
|---|---|---|---|---|---|---|
| School | 2 pupils | Cora + 5 | 5 pupils, no teacher | Cora + 3 | 0 | 0 |
| Clinic | **0** | Hazel, Sylvie | **0** | Hazel, Sylvie | 0 | 0 |
| Police | **0** | Pearl, Theo | **0** | Pearl, Theo | 0 | 0 |

The causes, all in the timetable the interior reads (`villagers.mjs slotOf`), none in the drawing:

1. Staff were inside only 8:18 to 12:00 and 13:00 to 16:48: at lunch every worker walked out to the market or the green.
2. A new game starts at 08:00 and a new day at 07:00, before anyone has arrived, so the first visit of a day found nobody.
3. The Lindens (clinic) and the Brooks (school) lodge in those buildings, but "at home" was never drawn inside them.
4. A hired neighbour works on your farm from 8:30 to 17:00, so hiring the staff emptied their building (Hazel + Theo + Cora
   hired: clinic and police down to one, the school with no teacher).
5. Nobody ever called: no patients, parents or people with something to report.
6. A separate bug made the people who were there hard to use: a tap walks you to the target's own spot, and a pupil's spot
   is inside a desk's box, a patient's between benches, so the walk never started. Their tap boxes were also 1.8 m wide and
   overlapped (a tap on Pip chose Kit).

The Pandora box made no difference before and makes none now.

## Who is where and when

Opening hours of all five buildings: **9:00 to 16:30** (staff arrive 7:54 to 8:42 and leave 16:24 to 17:12, each on their own
clock). Outside those hours the door's prompt says "closed now, open 9:00 to 16:30"; you may still step in, and a line says
whether anybody is home.

| Building | Keeps it open | Also on the staff | Callers (by day and hour) | Before 8:20 and after 19:00 |
|---|---|---|---|---|
| School | Cora: the blackboard, yard duty and lunch 11:30, the art room 12:30, marking at her desk from 15:00 | pupils Pip, Kit, Wren, Faye, Milo: desks, the yard at midday, art and reading (easel, globe, library rug) after it, home at 15:00 | a parent in the hall: June, Mara | Cora and Milo live here: Cora reads in the library armchair, Milo on the rug |
| Clinic | Hazel at reception | Sylvie in exam room 1; her lunch at the pharmacy counter 12:00 to 13:00 | one or two patients on the waiting benches: Ada, Mara, Iris (12:10), Ellis | Hazel and Sylvie live here: the night nurse at reception, Sylvie with a book in the waiting room |
| Police | Pearl at the front desk | Theo at the office desk (he still rides his motorbike to the bay); his lunch on the lobby bench 12:00 to 13:00 | someone reporting a lost thing at the desk: Ellis, Ash, Hugo (12:10) | closed and empty; the desk bell says so. Nobody is in the cells but the cat |
| Supermarket | Nell at till 1 (lunch on a stool in the back room 12:00 to 13:00), Oren at till 2 | Finn: the back room, the aisles 11:00 to 14:00 | up to three shoppers in the aisles and at the produce bins: June, Ada, Mara, Ash, Hugo | closed and empty |
| Willow & Co. | Bea: her desk, then the boss office from 13:00 (you are the village leader: she keeps your chair warm) | Leo (lunch in the break room 12:00), Fern (lunch 13:00) | a caller at the hiring board: Ash, Mara, Ellis | closed and empty |

Rules that keep it consistent with the village outdoors:

* Everyone shown inside is, by the same `slotOf`, at that building's door outdoors, where a villager is hidden ("Knock · Hazel is
  at Village Clinic"). Callers are timetable entries too (`villagers.mjs CALLS`), so they walk to the door and go in.
* The keeper of each building, a caller and a minder do not stroll off during their stay (`staysIn`); other staff still take
  the short strolls of round 7, and someone who is out on one when you enter is not shown inside as well.
* Lunch is inside: the indoor workers' plan lost its 12:00 to 13:00 trip (Iris at her stall and Hugo at the market keep theirs).
* Hired staff work on your farm as before. With all of a building's staff hired away, a neighbour minds the keeper's place
  (`MINDERS`: school June or Ada, clinic Ada or Mara, police Ellis or Ash, Willow & Co. Ash or June, supermarket Mara or Ellis)
  and has two conversations of their own about it.
* Motorbikes, wages, the bike bay hours (8:18 to 16:48) and the Pandora box are untouched.

## The conversation system

Tap a person inside (or E / ACT beside them): the game's talk screen opens with the live 3D portrait, the person's line and
**exactly three answers**. Each answer has its own reply and may lead to a follow-up question; a talk is 2 to 4 answers long and
ends with "See you around". Keys 1, 2, 3 pick an answer on a desktop.

| File | What |
|---|---|
| `src/facility-talk.mjs` | the rules, pure: `fits`, `dealTree`, `memory`, `applyEffect`, `validate`, `measure` |
| `src/facility-talk-view.mjs` + `facility-talk.css` | the panel and the things' answers; fetched on the first tap indoors |
| `src/talk-school.mjs`, `talk-hospital.mjs`, `talk-police.mjs`, `talk-supermarket.mjs`, `talk-company.mjs` | one table per building, fetched when someone there is first talked to |
| `src/talk-common.mjs` | the minder's two trees |
| `src/talk-things.mjs` | what the things answer |
| `src/vi-talk.mjs` | Vietnamese for the new labels, prompts and panel words (registered in `i18n.mjs`) |

A tree:

```js
{ id: 'cora-quick-quiz', when: { fresh: 'school' }, nodes: {
  a: { say: `English.|Tiếng Việt.`, choices: [
    [`Answer|Câu trả lời`, `Her reply.|Câu đáp.`, 'b'],          // leads to node b
    [`Answer|Câu trả lời`, `Her reply.|Câu đáp.`],               // ends here
    [`Answer|Câu trả lời`, `Her reply.|Câu đáp.`, '', 'lesson'], // ends with a button that opens the lesson panel
  ] },
  b: { say: `…|…`, choices: [[…], […], […]] },
} }
```

**To add a tree**: append it to the person's list (or to a role list: `'@parent'`, `'@patient'`, `'@report'`, `'@shopper'`,
`'@applicant'`, `'@cover'`) in that building's table, then run `node scripts/talk-check.mjs`. To give another building the same
system: add `keeper`, `hours`, `guests`, `role` (and `posts`, `lodgers`) to its plan, a `talk-<id>.mjs` table, and its loader
in `TABLES` (facility-talk-view.mjs).

* Every string is written once with its Vietnamese beside it; English names in both halves (`vi-names.mjs` turns them into
  Cẩm, Bống, Ngọc … on screen). Pronouns: neighbours "tôi / bạn", children "cháu / cô chú", Pip "con", June "em / mình",
  Ada "bà", Ellis "ông".
* `when`: `from`, `to` (hours), `season`, `rain`, `festival`, `chapter`, `stat: [key, n]`, `done` / `fresh` (the building's
  daily action done or not yet), `night` (the lodging family at home), `who` (a role tree for one caller). The first tree of
  every person has no `when`.
* Memory: `s.chat = { day, seen, used, note }`. A tree is not dealt twice in a day while another fits; the day turns the
  order. `freshState` has the default, `parseSave` repairs anything else, saves without it load.

### Counts

| Table | Trees | Questions | Lines (each in two languages) | Per person |
|---|---|---|---|---|
| School | 23 | 46 | 322 | Cora 8, Milo 3, Pip, Wren, Kit, Faye 2 each, parent 4 |
| Clinic | 19 | 38 | 266 | Hazel 7, Sylvie 6, patient 6 |
| Police | 16 | 32 | 224 | Pearl 6, Theo 5, report 5 |
| Supermarket | 22 | 48 | 336 | Nell 5, Oren 5, Finn 5, shopper 7 |
| Willow & Co. | 21 | 42 | 294 | Bea 6, Leo 5, Fern 5, applicant 5 |
| Minder | 2 | 4 | 28 | |
| **Total** | **103** | **210** | **1,470** | |

Plus 34 things with 128 lines.

### Effects and caps (no coins, no items, anywhere)

| Effect | What it does | Cap |
|---|---|---|
| opening a talk | `act('talk')`: met, friendship +1 | once a day per person (the action's own rule) |
| `lesson`, `checkup`, `patrol`, `shift`, `hire`, `sell` | a button that opens the existing lesson, check-up, patrol, office shift, hiring or checkout panel | those panels' own daily limits and prices |
| `energy` (a sweet, a tea, a tip) | +5 energy | once a day in all conversations |
| coffee machine / free-sample tray | +5 / +3 energy | once a day each |
| suggestion box | a note today, the office's answer from the next day | one note at a time |

At most 13 energy a day from all of it. This is the one place the branch does not use an existing action: nothing in `act()`
gives a small amount of energy, so `applyEffect` and `thingAnswer` add it themselves, behind those caps.

## Things to tap

Town tales still answer first at their spots. Otherwise each thing says the next of its lines (the day picks the start, each
tap moves on; festival, rain and closed-hours lines come first when they apply).

* School: the globe, the library's book of the day, **the class pet** (Professor Nibbles), lockers, trophy; the blackboard is the lesson.
* Clinic: **the scale**, **the eye chart**, **the waiting-room magazines**, the pharmacy shelf, reception.
* Police: **the desk bell**, **the lost-and-found box**, the notice board (silly notices), the cells, the evidence shelf.
* Supermarket: three aisles with today's checkout prices of the game's own produce (the shop buys, it does not sell, so they
  are tags to read), **the free-sample tray**, **the trolleys**, **the lost-and-found basket** (its glove's twin is at the police
  station), **the notice board**, the cold section, the back-room crates; the tills are the checkout.
* Willow & Co.: **the coffee machine**, **the water cooler** (gossip of the day), **the whiteboard** (the day's agenda),
  **the printer**, **the suggestion box**, **the notice board**, **the office plant**, the fridge, the meeting room, your desk;
  the hiring board and the free desk are the existing panels.

Bold: new targets. Eight new props in `facility-props.glb` (`art/blender/build_facility_props.py`): printer, suggestion box,
bell, sample tray, scale, eye chart, pet cage, basket (+89 KB, 644 KB in all, fetched on entering a building).

## Where the humour comes from

Every line is an original retelling written for these characters: no joke, story or line is copied from any site or book, and
nothing is taken from a living author. The traditions that inspired a tree:

* **Nasreddin Hodja** (Turkish folk tales; D. L. Ashliman's collection https://sites.pitt.edu/~dash/hodja.html,
  https://www.turkestantravel.com/en/tales-of-hodja-nasreddin/, https://tapwatersommelier.substack.com/p/24-more-tales-of-hodja-nasreddin,
  https://continuingstudies.uvic.ca/elc/studyzone/330/reading/smell1): "those who know, tell those who don't" (`cora-who-knows`);
  the smell of soup paid with the sound of coins (`cora-yard-lunch`, `pearl-supper`, `leo-lunch`, `nell-lunch`); the lost donkey
  (`theo-motorbike`, `report-umbrella`, `finn-count`); searching where the light is better (`pearl-lost`, `bea-shift`); the
  soup of the soup (`nell-supper`); the turkey that thinks (`oren-thinking-pumpkin`); the aching eye (`sylvie-hodja`).
* **Vietnamese truyện cười dân gian** (https://loigiaihay.com/soan-bai-chum-truyen-cuoi-dan-gian-viet-nam-sgk-ngu-van-8-tap-1-ket-noi-tri-thuc-chi-tiet-a136247.html,
  https://toplist.vn/top-list/truyen-cuoi-dan-gian-ve-thay-do-hay-nhat-45850.htm): "Treo biển" (`bea-hire`, `nell-sign`), "Lợn cưới,
  áo mới" (`leo-scarf`, `finn-new-apron`), "Tam đại con gà" (`parent-kind-of-chicken`), "Em bé thông minh" (`theo-potholes`),
  "Đại lãn chờ sung" (`applicant-fig`), the man who walks slowly in the rain (`oren-rain`), the "bé Tí" classroom format
  (`pip-five-sweets`), the healer's instruction taken literally (`patient-ada`).
* **Trạng Quỳnh** (https://en.wikipedia.org/wiki/Tr%E1%BA%A1ng_Qu%E1%BB%B3nh): airing the books in his belly (`cora-airing-books`).
* **Classroom joke formats** (https://www.littledayout.com/80-teacher-jokes-to-laugh-about-this-teachers-day/): big hands
  (`cora-quick-quiz`), "I used his pen" (`kit-dads-pen`), the dog (here the goat) ate my homework (`cora-night-marking`,
  `wren-goat-homework`), silly exam answers (`milo-test-answers`).
* **Doctor and waiting-room formats** (https://folklore.usc.edu/tag/hiccups/, https://www.farmersalmanac.com/all-you-need-to-know-about-hiccups-9754,
  https://toplist.vn/top-list/truyen-cuoi-ve-nganh-y-hay-nhat-45991.htm): hiccup remedies (`hazel-hiccups`), "it hurts wherever I
  press" (`hazel-checkup`), an apple a day (`sylvie-apple`), the giant turnip (`patient-iris`).
* **Small-town police blotter** (https://www.npr.org/2012/04/07/150148340/small-towns-police-blotter-is-a-riot): `pearl-odd`,
  `pearl-done`, `theo-report`; "it is on your head" (`report-glasses`); measure twice (`report-ash`, `shopper-ash-shelf`); the
  baker's dozen (`report-hugo`, `nell-labels`).
* **Office and shop humour** (https://advertisingvietnam.com/article/ban-la-ai-khi-cai-may-in-hu, https://toplist.vn/top-list/truyen-cuoi-cong-so-hay-nhat-45992.htm,
  https://sites.pitt.edu/~dash/type1562a.html "Master of All Masters", https://en.wikipedia.org/wiki/The_Twelve_Idle_Servants):
  the meeting that could have been a note (`bea-meeting`), four kinds of people at a broken printer (`bea-printer`), strange names
  for things (`fern-names`), the table trimmed leg by leg (`fern-wobble`), outstanding in his field (`oren-scarecrow`).
* **Anglers' tall tales**, traditional: `report-ellis`, `patient-ellis`, `applicant-ellis`, `finn-fish-size`.
* The rest (about half the trees, all the things and the minder's trees) are original to this village.

## Tests

* `npm test`: 523 pass. Two new tests in `tests/facility-talk.test.mjs` (every question has exactly three answers, every `next`
  exists, every line has Vietnamese, everyone who can be inside has a conversation, memory, caps, old saves) and one added to
  `tests/facility-plans.test.mjs` (never empty in opening hours on nine days, box open or shut, staff hired away, lunch inside,
  nobody shares a spot, callers fit their places, the lodgers at night).
  `tests/hired-villagers.test.mjs` compares a released helper's routine with the same day's, since the day now turns the calls.
* `node scripts/build.mjs`: **1,070,528 bytes** before the first frame (limit 1,100,000; 29,472 to spare; +2,484 for the hooks
  in main.mjs, game.mjs, prompts.mjs and the timetable in villagers.mjs). The tables (265 KB of source) are all behind `import()`.
* `node scripts/vi-coverage.mjs`: 0 missing. The talk tables are outside its scan (their Vietnamese is beside each line and
  the node test checks it).
* `tests/facilities-browser.mjs`, `tests/vietnamese-browser.mjs`, `tests/browser.mjs`: pass, once each, port 4811.
* `tests/facility-talk-browser.mjs` (the scripted run, GPU): the five buildings at 08:00, 10:00, 12:30 and 15:00 on 1440x900
  and at 15:00 on 390x844; never fewer than two people in opening hours; 82 conversations walked to the end (49 different
  trees) by click, tap and keys, each step measured (three answers, full width, at least 44 px, inside the screen, clear of the
  portrait); 844x390; Vietnamese on both sizes; the lodgers at 21:00; a minder with the officers hired; 20 things tapped.
  Pictures and `talk-run.json`, `people-before.json`, `people-after.json` in `cute_game-notes/willowmere/evidence-facility-talk/`.

## What is open

* The other buildings with an inside (Hearth bakery, Moss barn, Vale barn) have their families at home but no conversations
  by choice yet: their people still open the plain talk panel. The system takes them as described under "To add a tree".
* Opening a talk makes friends and counts as "met", but the gift buttons of the plain talk panel are not on the new panel
  (gifts still work outdoors and in the houses).
* At 17:15 to 19:00 the school and the clinic are empty: the families that lodge there are out in their yards. Nobody is on
  night duty at the police station; the bell says so.
* A second worker who is out on a stroll when you enter stays out until you leave and come back (the outdoor villagers stand
  still while you are indoors).
* Shoppers have no baskets in their hands and the class pet does not move.
* On a phone the people are tapped through their 3D boxes (the label chips never take taps); the scripted run taps the ones in
  view and uses the E / ACT path for the rest. Their boxes are now person-sized (1.7 m wide, a desk apart for the pupils): about 45 px wide and 45 to 58 px tall at
  the phone's farthest zoom, where before they were 1.8 m cubes that overlapped.
* The subagent-written tables were read through in part (tone, pronouns, Biscuit's "she"), not line by line.
* Not merged with the two branches in flight (disguise effects; stall targets, race flags, fruit coin): this branch touches
  none of their files (zoo-paint, disguise-*, world.mjs).
