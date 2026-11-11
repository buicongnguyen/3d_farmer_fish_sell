// The daily jobs board (Phase 2): the paid activities (the running prize, a shift or patrol, a day of lessons) share
// JOBS_PER_DAY paid slots, so the day is a choice and not a checklist. A job over the limit still happens, it just pays nothing.
export const JOBS_PER_DAY = 2;

/** Use one paid slot for today. Test mode never runs out. Returns whether the job pays. */
export function takeJob(s) {
  if (s.jobs.day !== s.day) s.jobs = { day: s.day, n: 0 };
  if (s.settings?.test) return true;
  if (s.jobs.n >= JOBS_PER_DAY) return false;
  s.jobs.n++;
  return true;
}

/** Paid slots still free today. */
export const jobsLeft = s => Math.max(0, JOBS_PER_DAY - (s.jobs?.day === s.day ? s.jobs.n : 0));

export const parseJobs = (raw, day) => ({
  day,
  n: raw && raw.day === day && Number.isInteger(raw.n) ? Math.max(0, Math.min(JOBS_PER_DAY, raw.n)) : 0,
});
