# Willowmere — game direction (October 2026)

Where the game stands, what makes it more attractive, and the next big step: land you plan cell by cell. It also covers how to
test every facility at once, and how this game becomes the standard kit for future games.

## 1. Where the game stands

**Strong already**
- A lot to do: farming, flowers and fruit trees, fishing in the family pond and outdoor ponds, animals and their produce,
  cooking, school lessons, hiring villagers, eight walk-in buildings with their Town tales, house decorating, wardrobe and
  crafting, the optional Pandora wilds (regions, bosses, titans), vehicles, save profiles, English and Vietnamese.
- A consistent, polished look in Zoo Garden's style (toon shading, glossy round menus, compact shop rows), on desktop and phones.

**What holds players back**
1. **Two games at once.** A cozy village sim and an action RPG share one screen with no path between them. A new player cannot
   tell what the game is about or what to do next.
2. **A crowded first quarter hour.** Every system is visible on day one. Players stay when things unlock one at a time.
3. **Coins without a purpose.** Coins come from everywhere (tales, surprises, shifts, lessons, sales, the raffle) but there is
   little to save up for once the house is upgraded. Goals go soft after about five days.
4. **Villagers are scenery.** 23 named people with hearts, but friendship pays off almost nothing.
5. **Stability.** Many people ship to `main` at once; some releases broke the first visit. The first-load size is close to
   its limit. One broken first session loses a player for good.

## 2. Identity

**Lead your family and grow your village.** The cozy life sim is the core: the farm, the family, the villagers and the town
you build up as its leader. The Pandora adventure stays, as an optional side that opens later and is fed by the farm
(materials, gear, food).

## 3. Roadmap

**Step 0, before everything below: rebuild the economy** (order board, production chains, two clocks). The research
and the economy simulation in `docs/MARKET-RESEARCH.md` show that today every goal is passed within five in-game days,
and score this the most valuable direction (88/100). That document also ranks the steps below and explains why scripted
AI neighbours replace online multiplayer.

In order of how much each makes the game more attractive for the effort.

| # | What | Why it matters |
|---|------|----------------|
| 1 | **Guided first session.** One clear goal at a time; Pandora, hiring, crafting and decorating unlock with story chapters, each with a small celebration. | Players who understand the first 15 minutes keep playing. |
| 2 | **Land you plan cell by cell** (section 4), with **village projects**: as leader you fund new buildings in a required order. | Gives coins a purpose and makes progress visible on the map. |
| 3 | **Festivals as mini-games:** fishing derby, cooking contest judged by villagers, harvest fair, the village run against rivals. On the calendar, with ribbons and rankings. | Big fun from systems that already exist. |
| 4 | **Friendships that pay off:** 2–3 short heart scenes per villager, favourite and disliked gifts, birthdays, a reward at high hearts. | The Town tales gave buildings stories; this does it for people. |
| 5 | **Collections:** fish, crop, flower and creature book with completion stickers and a display shelf at home. | Long-term goals at low cost. |
| 6 | **"Today in Willowmere" board** on login: what is ready, today's surprises, festival or birthday, a small daily gift. | Daily return habit. |
| 7 | **Generations (later):** Pip grows up; play the next generation, inherit the farm and the album. | A rare hook among cozy games. |

## 4. Land you plan cell by cell

Today the farm, pen, pond and buildings sit at fixed places. The next step turns the land into a grid of cells that the
player plans, with a few rules and a required build order so a new player cannot make a mess.

### 4.1 The grid
- **Cells of 2 × 2 m** over the player's land (the homestead first, more parcels later). Each cell is *grass*, *path*,
  *tilled*, *water*, *fence edge* or *occupied* by a placed thing.
- **Things take a footprint of cells:** a crop bed 1 × 1, a fruit tree 1 × 1, a flower bed 1 × 1, a fence segment along a cell
  edge, a gate, a path tile, a coop 2 × 2, a barn 4 × 3, a rental cottage 4 × 4, a shop stall 3 × 2, a pond 4 × 3 and up.
- **Placing** works like house decorating does today: pick from a catalogue, a ghost follows the cursor or finger, green where
  it fits and red where it does not, ↻ rotate, ✔ place, ✕ cancel, 📦 pack away. Moving something is free; removing a tree
  costs a little, as now.
- **Rules checked on every placement:** inside your land; not on another footprint; every building's door reaches a path
  that connects to the road (an unreachable building is refused with the reason); crops only on tilled cells; animals only
  inside a closed fence with a gate.

### 4.2 Building for rent
- **Rental cottages:** build one, furnish it at a basic, cozy or deluxe level, and a new family moves in. They pay rent
  each morning, more for a better cottage and for nearby flowers, trees and paths (a simple "charm" score from the
  surrounding cells).
- **Tenants are people:** each new family brings named villagers with lines, needs and a small Town tale of their own.
  Happy tenants stay; neglected ones (no path, no charm) complain first and leave later. Never harsh, always explained.
- **Shops you own:** a stall or a small shop sells your produce while you farm, and gives a share of the takings.

### 4.3 A required build order, so the village grows in sense
Village projects unlock in steps. Each step needs the one before and a few things you can see on screen:

| Step | Project | Needs |
|------|---------|-------|
| 1 | Clear the land, lay a path to the road | Start of the game |
| 2 | Farm plot: 6 beds and a fence | Step 1 |
| 3 | Coop and pen | Step 2, 1 day of harvests |
| 4 | First rental cottage | Step 3, 500 coins |
| 5 | **School** | 2 families with children |
| 6 | **Clinic** | 4 households |
| 7 | Market square and shops | 6 households, 1,000 coins of sales |
| 8 | **Police station** | 8 households |
| 9 | **Company office** | Market square, 10 households |
| 10 | Festival stage, bakery, workshop barns | Each with its own small requirement |

The next project is always shown on the "Today" board and in the album, with a ghost outline on the land where it can go.
Players keep free choice about *where* and *how* to build, but not about skipping the order. Existing saves keep their
village: buildings already standing count as finished projects.

### 4.4 How it fits the code
- **Data:** `state.land = { cells, placed: [{ id, kind, x, z, rot }] }` saved like `state.decor`. The grid module is pure
  (no Three.js): footprints, rules, charm, path connectivity and rent, with unit tests.
- **Reuse:** placement follows `decor-view.mjs` and `home-plan.mjs` (catalogue, ghost, rotate, collisions). Drawing reuses
  the instanced and baked scenery (`smooth-dense-scenes` rules: one draw call per kind). Pathfinding already uses an
  obstacle list, so placed footprints join it.
- **Phases:** (a) grid + crops, trees, fences and paths on the homestead; (b) placeable farm buildings; (c) rental cottages
  and tenants; (d) village projects across the town, replacing the fixed civic layout with built ones.

## 5. Testing every facility (available now)

**Settings → Test mode:** enter the test key, then press **🔓 Unlock everything**:
- **Money:** +1,000,000 coins.
- **Farm and home:** every upgrade at its top tier, all 30 garden beds, the motorcycle.
- **Wardrobe:** every outfit, look, piece of gear and furniture set.
- **People:** every villager met and at full friendship.
- **Supplies:** 25 of every item and 20 of every seed.

The other test controls remain: instant crops and fruit, free tree clearing, game speed 1×/5×/20×, +10,000 coins and
"Sleep to next day". Story chapters and Town tales are left as they are, so they can still be played through.

Note for later: the key is checked in the browser, so anyone reading the page code can find it. That is fine for testing,
not for anything valuable. A build flag that removes test mode from public builds is the safer long-term option.

## 6. The game as a standard for future games

Willowmere now holds a large, tested kit. To start future games from it instead of from scratch:

**Reusable pieces (keep them content-free)**
- **Look:** toon shading and lights (`toon.mjs`), the vertex-coloured ground (`fields.mjs`), the HUD and menu kit
  (`hud-reference.css`, `menus-reference.css`, `shop-view.mjs` rows, try-on).
- **Places:** room and dollhouse interiors with decorate mode (`interior.mjs`, `home-plan.mjs`, `decor-view.mjs`,
  `room-view.mjs`), walk-in buildings (`facility-*.mjs`), Town tales (`tales.mjs`).
- **Life:** villager timetables, birds, fish schools, pen animals, model icons and portraits rendered at runtime.
- **Systems:** saves with profiles and validation, test mode, English/Vietnamese translation with the coverage check
  (`i18n.mjs`, `scripts/vi-coverage.mjs`).
- **Shipping:** the build with its first-load budget, the stale-file guard and `scripts/keep-chunks.mjs` deploy step, the
  GitHub Pages workflow, browser test suites with `window.willowmere` hooks.
- **Art:** the Blender generators (`art/blender/*.py` with `style.py`) for houses, civic buildings and the rural kit.

**How to make it a real starting point**
1. Separate *engine* from *content*: everything Willowmere-specific (names, tales, prices, layout) lives in data files;
   systems read data and never mention Willowmere.
2. Give each system a short README with its data shape, hooks and an example.
3. Create a **template repository** from the kit with one tiny example scene, the test hooks and the deploy workflow ready.
   A new game forks the template, not Willowmere.
4. Keep one compatibility rule: a kit change must keep the template's tests green.

## 7. Release discipline

- One integration branch; a daily browser-suite run before shipping to `main` (the per-push browser sweep was too slow on
  software WebGL and is now nightly).
- Keep 50 KB or more of first-load headroom; move code that is only needed later behind `import()`.
- When a feature changes a building, layout or flow, update its browser test in the same change.

## 8. Suggested next steps

1. Guided first session (roadmap 1).
2. Land grid, phase (a): homestead cells with crops, trees, fences and paths.
3. Village projects with the required build order, starting from the school.
4. One festival mini-game (the fishing derby reuses the most).
5. The "Today in Willowmere" board.
6. Kit extraction into a template repository, alongside the above.
