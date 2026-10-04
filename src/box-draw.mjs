// What the box's first opening fetches (the split build, scripts/build.mjs): the drawing halves of the creatures, the fight
// effects and the fight HUD, in one chunk so the three arrive together and share one download. Each class's load() imports this
// and puts its own half onto its prototype; nothing here runs before that.
export { install as installView } from './wilds-draw.mjs';
export { install as installFx } from './combat-fx-draw.mjs';
export { install as installHud } from './combat-hud-draw.mjs';
