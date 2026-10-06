// What the box's first opening fetches (the split build, scripts/build.mjs): the drawing halves of the creatures, the fight
// effects and the fight HUD, in one chunk so the three arrive together and share one download. Each class's load() imports this
// and puts its own half onto its prototype; nothing here runs before that.
export { install as installView } from './wilds-draw.mjs';
import { install as installFxBase } from './combat-fx-draw.mjs';
import { install as installSpecial, specialOf } from './skills-special.mjs';
import { install as installLooks } from './skill-looks.mjs';
import { Combat } from './combat.mjs';
import { install as installKits } from './disguise-skills.mjs';
/** The fight effects, with the fourth skill (skills-special.mjs: Combat's special, skill-looks.mjs: its looks and the hero's cast) put on beside them. */
export function installFx(CombatFx) { installFxBase(CombatFx); installSpecial(Combat); installKits(); installLooks(CombatFx, specialOf); }
export { install as installHud } from './combat-hud-draw.mjs';
