# Willowmere story bible (Phase 3)

The code is in `src/story-rules.mjs` (rules, first-frame), `src/story.mjs` (chapter scenes, endings), `src/family.mjs` (June and Pip), `src/villager-lines.mjs` (villagers, heart scenes). Wiring: `docs/STORY-WIRING.md`.

## The through-line

Ada, the player's grandmother, is nearly eighty. The cottage by the pond is too much for one person: the old beam over the kitchen will not see another winter, and the county has written to her. She has quietly decided to sell and live by her sister's sea. She tells no one; a folded letter sits under the sugar bowl from the first scene, and Bea, who sorted it, says nothing.

What the family could **lose**: the cottage, the willow planted on Ada and Ellis's wedding day, and the summers that made June and the player who they are. What it could **gain**: a home that three generations choose on purpose, or a house that becomes the village's table.

The player's work is the answer. Beds, fish, sales, a roof, a supper: each is a small proof that the place can be kept. The scenes read the state (harvests, fish, sales, the funded village projects, the hearts), so the village visibly notices.

Kept from the old chapters: the brass key and seed tin, the willow, Ellis's notebook and boat, the pond, the jeep key, Pip's drawings, the harvest supper with twenty-four places, the "next spring". Titles are unchanged. The family: Ada is the player's grandmother, Ellis their grandfather, June the player's partner (she spent summers at this pond as a child), Pip their daughter.

## Tone

Warm, small, specific, never saccharine. People say less than they mean and then do something with their hands. Jokes are dry. One image per line (a kettle on since Tuesday, the footprint at the end of every row). The house voice stays: "Nothing here has to be done in a hurry." No villains, no timers; the stake is a decision Ada has not yet made.

## The eight chapters

| # | Title | Scene | Stakes |
|---|-------|-------|--------|
| 1 | A key and a seed tin | The key sticks, Ada's kettle, the tin, the letter under the sugar bowl | The letter is planted |
| 2 | Something takes root | Pip learns dirt is "busy"; June's footprints; the first album page | June comes back to herself |
| 3 | The water remembers | Ellis's boat and notebook; the entry about the daughter who swam | The place has a memory worth keeping |
| 4 | A table for everyone | Market, Theo's jeep key; Ada counts the coins and says "the roof" | The roof is named |
| 5 | Room to grow | Pip's drawings, June's room; Ada admits the county letter | Ada says it aloud |
| 6 | Beyond the willow | The valley road; the village shows its mended things; Nell's supper invitation | The wider world, and the way home |
| 7 | A recipe passed down | Ada's unwritten recipes; Pip writes "a handful, the size of your own" | What is passed on |
| 8 | The next spring | Ada puts the choice to the family, then the choice | **The ending** |

Scenes vary with state: harvests (2), fish (3), sales (4), feeding (5), house upgrades (5), funded projects (6, 8), Hugo's hearts (7), festivals (7).

## The final choice and two endings

After the last chapter is claimed, Ada holds out the key and the player chooses (act `choose`, once).

- **The key stays on its nail (`stay`).** The family keeps the cottage as their home: Ada stays, the beam gets a friend, Pip gets her own door and June finally learns the pie. A small, closed, happy circle.
- **The gate stays open (`share`).** The cottage opens to the village: Bea has Thursdays, Hugo the oven, the seed tin goes round the valley and the key hangs by the gate. A bigger, noisier, shared home.

Neither is the "good" one; both close the first volume, and play continues after either.

## Ada, June and Pip

- **Ada** begins as the keeper of a secret (tin, kettle, letter) and ends as someone who has been helped. Ch 1 hides; ch 5 admits; ch 7 teaches (the recipe); ch 8 asks.
- **June** returns to a place she loved. Ch 2 she remembers, ch 3 she learned to swim here, ch 5 she confronts Ada, ch 7 she learns the pie, ch 8 "I am already home". Her lines react to yesterday (rain, a harvest, a catch, sales).
- **Pip** grows up. Chapters 1 to 3: small, literal, delighted (worms' knees, counting stairs). Chapters 4 to 6: busy and proud (the sign, a friend, a rule). Chapters 7 and 8: quieter, older (measures herself on the doorframe, wants to look after the pond, is "a normal amount" scared of the letter).

## Eight key villagers

Chosen by role so each pillar of the village carries part of the story.

| Villager | Role | Why | Loved | Disliked |
|---|---|---|---|---|
| Ada | Grandmother, seeds | The heart of the story | pie, apple, honey | chili, durian |
| Ellis | Grandfather, fishing | The pond and the notebook | perch, carp, coffee | candy, durian |
| Bea | Postkeeper | She sorted the county letter; the village's memory | daisy, tulip, berry | eel, claw |
| Theo | Mechanic, jeep owner | The road, the jeep key (ch 4, 6) | cog, coffee, obsidian | tulip, berry |
| Mara | Animal keeper | The farm animals (ch 5) | carrot, clover, milk | hide, tusk |
| Hugo | Baker | The recipe and the supper (ch 7) | egg, sugar, honey | chili, mushroom |
| Nell | Festival host | The harvest supper (ch 6, 7) | sunflower, rainbowrose, star | wood, cog |
| Sylvie | Orchard keeper | The trees of the last chapter | apple, peach, nectar | eel, hide |

Gifts: loved +4, ordinary +2, disliked 0 (a polite refusal, the item is kept, the day's gift is not used). The other 13 residents keep +2 and their line, plus two rotating lines each; June and Pip use the family arcs.

### Heart scenes and perks (2, 5 and 8 hearts, once each)

| Villager | 2 hearts | 5 hearts | 8 hearts |
|---|---|---|---|
| Ada | a pie and 2 eggs | one more rest at home every day | 300 coins |
| Ellis | 2 perch | everything sells for 3% more | a golden carp and a koi |
| Bea | 60 coins | every liked gift gives 1 more friendship point (key villagers) | 200 coins |
| Theo | 2 cogs | seeds 5% cheaper | 250 coins |
| Mara | 3 eggs and a milk | a truffle and 2 milk | everything sells for 3% more |
| Hugo | a pie | seeds 5% cheaper | 3 pies |
| Nell | 80 coins | every liked gift gives 1 more friendship point | 200 coins |
| Sylvie | 3 apples | seeds 5% cheaper | 3 peaches and a mango |

The lasting perks stack with the village projects (`src/projects.mjs`) and are counted from scenes actually played. Total lasting: rest +1, selling +6%, seeds -15%, gifts +2 points.
