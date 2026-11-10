# Wiring the story into the UI (for main.mjs)

Nothing in `main.mjs` has been touched. The rules are done; the UI plays what the rules queue.

## 1. Load the prose once, after the first frame

```js
import { loadStory } from './story-rules.mjs'; // small, already in the first-frame bundle (game.mjs imports it)
loadStory(); // fetches story.mjs, family.mjs, villager-lines.mjs (+ story-text.mjs, scene-view.mjs deps) with import()
```

Until it resolves, `talk` falls back to each person's one line and a refused gift to a generic message, so calling it right after the first frame is enough. `await loadStory()` before showing a scene (it returns `hooks`, `{story, family, lines}`). The prose is not in the first-frame bundle (checked with `npm run build`).

Add `src/story.css` to the stylesheet list, and import `sceneHtml` from `./scene-view.mjs` lazily the same way (`const { sceneHtml } = await import('./scene-view.mjs')`).

## 2. Show pending scenes

`state.pendingScenes` is a queue. `act()` only queues; the UI plays. After every `act()` result (and on load) check:

```js
async function showPendingScene() {
  if (!state.pendingScenes.length) return closeSceneCard();
  const { story } = await loadStory();
  const { sceneHtml } = await import('./scene-view.mjs');
  const v = story.viewPending(state); // {beat, index, total, kind: 'chapter'|'heart', entry}
  openSceneCard(sceneHtml(v.beat, v.index, v.total, { you: state.name ?? 'You' }));
}
```

- `viewPending(state)` returns the first pending scene's current beat, already in the player's language, or `null`.
- `sceneHtml(beat, index, total, names)` returns the HTML for one beat: portrait circle (resident colour), name, text, dots, and a **Next** button (`data-action="do" data-type="sceneNext"`), **Close** on the last beat. On the final-choice beat (`beat.choices`) it shows two buttons `data-action="do" data-type="choose" data-id="stay"|"share"` instead.
- Re-render the card after every `sceneNext` / `choose` by calling `showPendingScene()` again. Do it when the player claims a chapter (`claim`), after `talk` / `gift` (heart scenes), and after loading a save. Show it over the world like a dialogue (it is a card, not a full modal), and do not show it while another modal is open.
- The existing `do` handler already forwards `data-type` and `data-id` to `act(state, type, {id})`.

## 3. The actions

| act | arg | result |
|---|---|---|
| `sceneNext` | none | moves the first pending scene on one beat. On its last beat the scene is removed, and a heart scene pays its one-off perk (coins or items) and is marked in `state.heartScenes[id]` (bitmask 1/2/4 for 2/5/8 hearts); the message names what was given. Refused on the final-choice beat until a choice is made. |
| `choose` | `{id: 'stay'\|'share'}` | the final choice, once, only after chapter 8 is claimed. Sets `state.ending`; the pending last scene then has 8 beats and continues from the same index with the ending's beats. |

Everything else that changed:

- `claim` queues the chapter scene (`{k:'c', i, b}`). Its toast message is still the old `memory` text; you may prefer to show the scene instead and keep the memory for the album.
- `talk` returns the villager's rotating line (`residentLine`), and for June and Pip `familyLine`. `gift` returns a refusal message with `ok: false` for disliked items (show it as the villager's line).
- A friendship that crosses 2, 5 or 8 hearts for one of the eight key villagers queues a heart scene after any ok action.
- A save that finished chapter 8 before the choice existed is offered the choice (a pending scene starting at the choice beat) after its first action.

## 4. Other reading helpers (lazy `story.mjs`)

- `story.sceneFor(state, chapterIndex)` the beats of a chapter scene (for a replay in the album).
- `story.endingFor(state)` `{id, title, closing}` or `null`: show `closing` on the album's last page and `title` as the heading.
- `ENDINGS[id].pick` is the label of each choice, if the album wants it.
- `family.familyLine(state, 'june'|'pip')` / `lines.residentLine(state, resident)`: the same text `talk` returns, for a speech bubble.

## 5. Gift taste in the UI (optional)

`giftTaste(id, item)` from `story-rules.mjs` returns `'loved' | 'liked' | 'disliked'` for the eight key villagers (`liked` for everyone else). The gift list could show a heart on loved items once a villager has been met.

## 6. Language

Every line is `'English|Tiếng Việt'`, resolved with the current language when a function is called. After a language change call `showPendingScene()` again.
