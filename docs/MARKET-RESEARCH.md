# Willowmere — market research and where to grow (October 2026)

What similar games teach, which of their strengths are backed by evidence, whether they need online multiplayer, how AI
friends could replace it, and a scored ranking of the ways Willowmere can grow its audience. Companion to
`docs/GAME-DIRECTION.md`.

## 1. Summary

- **Single-player first is proven.** The biggest farming and life games are played alone: Stardew Valley (50+ million
  sold), Animal Crossing: New Horizons (about 50 million) and Township (about $1 billion lifetime) are all fully playable
  solo. Hay Day needs an internet connection but its club ("neighborhood") is optional. Online multiplayer is a bonus
  layer, not the reason they succeed.
- **The proven loop is Hay Day and Township's:** crops feed production buildings, goods go to an order board, coins buy
  the next building, levels unlock it. Township adds the exact idea in our plan: **community buildings such as the school
  raise the population cap**, which allows more homes and more growth.
- **Our measured weakness:** the economy. On Willowmere's own rules, a keen player owns all 30 beds by day 2 and every
  upgrade by day 5, then earns about 20,000 coins a day with nothing left to buy (section 5).
- **Best way to grow players (section 7):** fix the economy with an order board and production chains (score 88), then
  the land grid with rentals and a population build order where **layout matters** (85), friendships with heart scenes
  (83), a guided first session (82) and **scripted AI neighbours** instead of online multiplayer (80). Cloud-AI chat and
  real online multiplayer score lowest (54) because of running cost, safety and effort.

## 2. The games compared

| Game | Who and when | Scale (evidence) | Online needed? |
|---|---|---|---|
| **Hay Day** | Supercell, iOS 2012, Android 2013 | $132.9 million in 2024; $13–15 million a month in late 2025 | Internet connection required (server-based); the neighborhood is **optional** |
| **Township** | Playrix, 2011 | About **$1 billion lifetime**, $200 million a year by 2019 | **Playable offline**; only co-op events and PvP need internet |
| **Stardew Valley** | ConcernedApe, 2016 | **50+ million** copies by February 2026 | **Single-player**; optional co-op for 4 (8 since update 1.6) |
| **Animal Crossing: New Horizons** | Nintendo, 2020 | About **50 million** units by June 2026 | **Single-player**; optional online visits |
| **Browser farm games** (Poki, CrazyGames) | Many small studios | High ratings, mostly idle or tycoon games (e.g. Farming Tycoon 3D, Oct 2025, rated 9.0) | Single-player |

## 3. Strengths, with evidence

Each strength is graded: **strong** = primary source or long-run data, **medium** = respected analysis or reported data,
**weak** = secondary summary only.

| # | Strength | Evidence | Grade |
|---|---|---|---|
| S1 | A short loop that is clear without a tutorial: crops → production → orders → new buildings, unlocked by level | Supercell's designer: "we don't teach our players to play Hay Day… we give them the freedom to learn"; real-world logic chains (chickens → eggs → cakes) [DoF 2013] | Medium |
| S2 | Orders make selling a puzzle instead of "sell everything" | Township's four order types (helicopter, train, plane, zoo) "create a production puzzle" [DoF 2020]; Hay Day sells through truck, boat and visitors [Wikipedia] | Medium |
| S3 | Gated growth keeps players returning for years | Hay Day reached 55 % DAU/MAU (2013) and still earned $132.9 million in 2024, its best since 2021 [DoF 2013; AppMagic via Udonis] | Strong (long-run revenue) / medium (DAU/MAU is old) |
| S4 | Population-gated building is the town-growth engine | Township: community buildings raise the population cap, enabling more houses, factories and land [DoF 2020; Wikipedia] | Medium |
| S5 | **Layout does not matter in Township**: a gap we can fill | "Township is not really a city building game because the layout and city planning does not have any impact on the outcome" [DoF 2020] | Medium |
| S6 | Regular events with mini-games keep a farm game fresh | Township events every 2–3 weeks with match-3, cooking and physics mini-games; it overtook Hay Day by out-working it on live content [DoF 2020] | Medium |
| S7 | People and story keep players for hundreds of hours | Stardew: 12 romance candidates with multi-hour arcs; 50+ million sold [game guides; VGChartz] | Strong (sales) |
| S8 | A short daily habit beats long grinding for cozy players | Animal Crossing is designed for 20–30 minutes a day and never punishes absence [comparison guides] | Weak to medium |
| S9 | Cozy players play to relax at their own pace | Sago survey (US, UK, France, Spain, Germany): 53 % switch off from stress, 52 % play at their own pace, 51 % feel calmer [Sago] | Medium |
| S10 | Social play is optional even in the biggest F2P farms | Hay Day neighborhoods optional; Township playable offline; "if you are not a social person, there is still an option to play the game alone" [Supercell forum/guides; Playrix help; DoF 2020] | Strong |
| S11 | Online play brings real harm | ADL: 76 % of adult online multiplayer players faced harassment; 68 % severe harassment (threats, stalking, sustained harassment) [ADL 2023] | Strong |
| S12 | Players look for "cozy" and for reassurance they can play alone | Among Steam games over $100,000, "cozy" in descriptions grew from 0.4 % to 3.1 % (2022–2025); "solo" grew 450 %, used to promise co-op games can be played alone [GameDiscoverCo via Outlook] | Medium |

**Logic check.** The plan in `GAME-DIRECTION.md` matches S1–S4 and S6–S10. S5 is our advantage. S11 and S10 support
choosing AI neighbours over online multiplayer. Dropped from the earlier draft for lack of a primary source: an audience
split of "45–55 % female, 25–45 years"; and the reading of "solo" as single-player games (it is about co-op games).

## 4. Weaknesses of those games (our openings)

- Heavy pay pressure in Hay Day and Township: full barns and timers push players to buy the premium currency [Game
  Developer; DoF 2020]. **We have no store: our pacing can be generous and honest.**
- Little story or personality in Hay Day; layout without consequence in Township (S5).
- Mobile-only apps; few cozy 3D games with people and story in the browser (Poki and CrazyGames farm games are mostly
  idle or tycoon games). **We are instant-play on any device.**

## 5. Our own evidence: the economy today

`scripts/economy-sim.mjs` plays a keen player on the game's own rules (`act`, `tick`): plant, water, harvest, sell at the
supermarket, buy beds and upgrades as soon as affordable. One in-game day is about 8 real minutes.

| Day | Coins earned that day | Beds | Upgrades |
|---|---|---|---|
| 1 | 1,368 | 26 / 30 | 0 / 15 |
| 2 | 744 | 30 | 1 |
| 5 | 2,448 | 30 | **15 (all)** |
| 6 | 17,680 | 30 | 15 |
| 21 | ~20,000 a day, 315,000 banked | 30 | 15 |

Causes: crops grow in seconds (a carrot in 32 s) against cheap seeds, and "once a day" limits reset every 8 minutes.
A player a fifth as efficient still earns about 4,000 coins a day. **Every goal in the plan would be passed in minutes
unless the economy is rebuilt first.** Run it again after any balance change: `node scripts/economy-sim.mjs`.

## 6. Online multiplayer or AI friends?

**Finding:** none of the four big games *needs* other players; social features are optional extras (S10). For us, a
server would add cost, accounts, moderation and the harassment risk in S11, and the game is currently a static site with
no backend.

**AI friends, three levels:**

| Level | What it is | Cost to run | Fit |
|---|---|---|---|
| 1. **Scripted AI neighbours** | Simulated friends with names, homes and schedules (like our villagers) who visit, leave gifts, post requests on the order board, ask for help, trade, and race you in festivals. Built from rules and written lines. | **None** (runs in the browser) | **Best fit.** Always friendly, works offline, translatable, testable. |
| 2. Cloud AI chat | A large language model writes a friend's replies through an API | About **$0.001–0.005 per exchange**; at 50,000 daily players with 30 % chatting, about **$60 a day** [Neural Base]. Needs our own server to hide the API key, plus moderation. Whispers from the Star limits play to about 40–60 minutes a day, which players link to cost [Steam]. | Later, optional, behind a server. |
| 3. In-browser AI chat | A small model runs on the player's device with WebLLM (WebGPU) | Free to run, but a **130 MB–2.2 GB download**; Android Chrome 121+, iPhone only from Safari 26 [WebLLM guides] | Experiment for strong PCs only. |

**Recommendation:** level 1 as the "neighbourhood". It replaces online clubs with friends who are never rude, costs
nothing per player, and fits the existing villager schedules, Town tales and order board. Keep level 2 or 3 as an
optional "chat with your friend" experiment much later.

## 7. Scoring the directions

**Criteria and weights** (what matters for gaining many players with a small team and no servers):

| Criterion | Weight | 5 means |
|---|---|---|
| Proven player demand | 25 | Strong evidence in section 3 |
| Retention | 20 | Daily return and long-term goals |
| Reuse of what we have | 15 | Mostly existing code and assets |
| Build effort and risk | 15 | Cheap and safe to build |
| Running cost | 10 | No servers, no per-player cost |
| Stand-out in the browser | 10 | Rare among web games |
| Friendliness and safety | 5 | Calm, no harassment, no pay pressure |

Score = Σ weight × (rating ÷ 5), out of 100.

| Direction | Demand | Retention | Reuse | Effort | Running | Stand-out | Friendly | **Score** |
|---|---|---|---|---|---|---|---|---|
| A. Economy fix: order board + production chains + two clocks | 5 | 5 | 4 | 4 | 5 | 2 | 5 | **88** |
| B. Land grid + rentals + population build order (layout matters) | 5 | 5 | 3 | 2 | 5 | 5 | 5 | **85** |
| C. Friendships with heart scenes, gift tastes, birthdays | 5 | 4 | 4 | 3 | 5 | 3 | 5 | **83** |
| D. Guided first session (one goal at a time, gated unlocks) | 4 | 4 | 5 | 4 | 5 | 2 | 5 | **82** |
| E. Scripted AI neighbours (visits, requests, trades, festival rivals) | 4 | 4 | 4 | 3 | 5 | 4 | 5 | **80** |
| F. "Today" board + collections (real calendar) | 4 | 4 | 4 | 4 | 5 | 2 | 5 | **79** |
| G. Festivals as mini-games | 4 | 4 | 4 | 3 | 5 | 3 | 5 | **78** |
| H. Generations (play Pip's adult life) | 3 | 4 | 3 | 2 | 5 | 5 | 5 | **71** |
| I. More Pandora action (bosses, regions) | 2 | 3 | 4 | 3 | 5 | 3 | 4 | **63** |
| J. In-browser AI chat friend (WebLLM) | 3 | 3 | 2 | 2 | 4 | 5 | 3 | **60** |
| K. Cloud AI chat friend | 3 | 3 | 2 | 2 | 1 | 5 | 3 | **54** |
| L. Online multiplayer clubs and trading | 4 | 5 | 1 | 1 | 1 | 2 | 2 | **54** |

**Why these ratings.**
- A and B lead because their loops are the proven core of Hay Day and Township (S1–S4), and A fixes the measured economy
  problem that would otherwise empty every other feature.
- B is the most distinctive: Township's town growth plus the planning it lacks (S5).
- C, D, E, F and G turn our cozy strengths (S7–S9) into habits at no running cost.
- I splits the identity: cozy players come to relax (S9), so combat stays optional.
- J, K and L cost money, servers or safety: L adds the harassment risk (S11), K needs a backend and per-message fees.

**Sensitivity** (re-computed): doubling the stand-out weight puts B first (86) ahead of A (84) and E above D; doubling the
running-cost weight sinks K and L to 51. The same five directions stay on top either way, so the ranking is stable.

## 8. Recommended order

1. **Foundation:** A (economy, order board, production chains, two clocks) together with D (guided first session).
2. **Signature:** B (land grid, rentals, population build order, layout that matters) with E (AI neighbours on the order
   board and at festivals).
3. **Heart and habit:** C (friendships), F (Today board and collections), G (one festival first, the fishing derby).
4. **Later:** H (generations); I as optional content; J or K only as an experiment after the rest.

Measure each step with the economy simulation (pace) and with three to five first-time players (clarity).

## 9. Sources

- [Behind the Success of Hay Day — Deconstructor of Fun (2013)](https://www.deconstructoroffun.com/blog//2013/01/behind-success-of-hay-day.html)
- [How Playrix' Township Became a Billion Dollar Game — Deconstructor of Fun (2020)](https://www.deconstructoroffun.com/blog/2020/10/13/how-playrix-township-became-a-billion-dollar-game)
- [Game monetization design: Analysis of Hay Day — Game Developer](https://www.gamedeveloper.com/business/game-monetization-design-analysis-of-hay-day)
- [Hay Day — Wikipedia](https://en.wikipedia.org/wiki/Hay_Day); [Township — Wikipedia](https://en.wikipedia.org/wiki/Township_(video_game))
- [Supercell revenue by year (AppMagic data) — Udonis](https://www.blog.udonis.co/mobile-marketing/mobile-games/supercell)
- Hay Day monthly revenue, Oct–Dec 2025 (AppMagic-based reports): [Oct](https://x.com/BrawlSource/status/1984936354069774690), [Nov](https://x.com/BrawlSource/status/1995863300261978519?lang=en), [Dec](https://x.com/BrawlSource/status/2007460643259945107)
- [Supercell 2025 results — GamesBeat](https://gamesbeat.com/supercell-generates-3b-in-2025-revenue-down-4-while-profits-grew/)
- [Does Hay Day require internet? — Playbite](https://www.playbite.com/q/does-hay-day-require-internet); [Supercell forum](https://forum.supercell.com/showthread.php/146404-Hay-Day-is-their-a-way-to-play-without-connecting-to-the-Internet)
- [Township: Play offline — Playrix Help Center](https://playrix.helpshift.com/hc/en/3-township/faq/14775-play-offline/?p=ios)
- [Stardew Valley sales top 50 million — VGChartz](https://www.vgchartz.com/article/467162/stardew-valley-sales-top-50-million-units/); [Stardew Valley 1.3 multiplayer](https://www.stardewvalley.net/stardew-valley-1-3-multiplayer-update-is-now-available/)
- [Animal Crossing: New Horizons sales — list of best-selling Switch games](https://en.wikipedia.org/wiki/List_of_best-selling_Nintendo_Switch_video_games); [50.29 million as of June 2026](https://x.com/Stealth40k/status/2085307875895730468)
- [Animal Crossing vs Stardew Valley — Farm Game Hub](https://www.farmgamehub.com/en/guides/best-games/animal-crossing-vs-stardew-valley)
- [The rise of cozy gaming — Sago](https://sago.com/en/resources/insights/the-rise-of-cozy-gaming-across-borders/)
- [Steam "cozy" keyword trend (GameDiscoverCo data) — Outlook Respawn](https://respawn.outlookindia.com/gaming/gaming-news/steam-vibe-shift-why-cozy-is-the-most-dominant-keyword-of-2026)
- [Hate is No Game 2023 — ADL](https://www.adl.org/resources/report/hate-no-game-hate-and-harassment-online-games-2023)
- [LLM NPC cost scaling — The Neural Base](https://theneuralbase.com/ai-for-gaming/learn/beginner/cost-scaling-with-players/)
- [Whispers from the Star daily play limit — Steam discussion](https://steamcommunity.com/discussions/forum/0/601913636778280700)
- [Run an LLM in your browser with WebLLM — Local AI Master](https://localaimaster.com/blog/run-llm-in-browser)
- [Farm games — Poki](https://poki.com/en/farm); [Farming Tycoon 3D — CrazyGames](https://www.crazygames.com/game/farming-tycoon-3d-diu)
