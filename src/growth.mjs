// Crops grow overnight (Phase 2 of docs/REVIEW-2026-11-10.md). A bed is {crop, grown, watered}:
//   grown   whole days of growth so far;
//   watered whether it has had its water today (rain counts).
// Sleeping is the commit point: every bed that was watered grows one day, then the new day starts dry unless it rains.
// A crop is ripe once it has grown `days` days. Fruit trees already work in days (game.mjs treeWait).
// Pure functions: no state of the game is read except what is passed in.

/** Days of growth a crop needs. A crop may set `days` itself; otherwise it follows its old real-time `grow` (seconds). */
export const cropDays = crop => crop.days ?? Math.max(1, Math.ceil(crop.grow / 40));

/** A new bed. A rainy day waters it at once. */
export const newBed = (cropId, rain = false) => ({ crop: cropId, grown: 0, watered: !!rain });

/** Ripe: grown for all its days (test mode ripens at once, as it always did). */
export const bedRipe = (bed, crops, test = false) => !!bed && (test || bed.grown >= cropDays(crops[bed.crop]));

/** 0..1 for the progress bar: the days grown, with half a day for water given today. */
export const bedProgress = (bed, crops, test = false) => {
  if (!bed) return 0;
  if (test) return 1;
  const days = cropDays(crops[bed.crop]);
  return Math.min(1, (bed.grown + (bed.watered && bed.grown < days ? 0.5 : 0)) / days);
};

/** Days still to wait, counting today if it is watered: 0 when ripe. */
export const daysLeft = (bed, crops) => (bed ? Math.max(0, cropDays(crops[bed.crop]) - bed.grown) : 0);

/** The night: watered beds grow a day; the morning is dry unless it rains. Returns the new bed (or null). Never mutates. */
export const overnight = (bed, rainTomorrow) =>
  bed ? { ...bed, grown: bed.grown + (bed.watered ? 1 : 0), watered: !!rainTomorrow } : null;

/**
 * A version-1 bed ({crop, planted, watered}, grown by real seconds) as a version-2 bed. A crop that was ripe stays ripe; one part
 * grown keeps its share of the days (rounded down); one never watered starts again from nothing.
 */
export function bedFromSeconds(old, crops, elapsed) {
  const crop = crops[old.crop];
  if (!crop) return null;
  const days = cropDays(crop);
  const share = old.watered ? Math.min(1, Math.max(0, (elapsed - old.planted) / crop.grow)) : 0;
  return { crop: old.crop, grown: share >= 1 ? days : Math.floor(share * days), watered: !!old.watered };
}
