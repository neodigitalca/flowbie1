/** Anchor start date: first future UTC month/day at scheduleStartDay (combined with startTime downstream). */
export function postCreatorRunStartDate(startDay: number, startTime = "09:00"): Date {
  const [h, m] = startTime.split(":").map(Number);
  const hour = Number.isFinite(h) ? h : 9;
  const minute = Number.isFinite(m) ? m : 0;
  const graceMs = 30_000;
  const now = Date.now();

  let y = new Date().getUTCFullYear();
  let mo = new Date().getUTCMonth();

  for (let attempt = 0; attempt < 24; attempt++) {
    const dim = new Date(Date.UTC(y, mo + 1, 0)).getUTCDate();
    const day = Math.min(startDay, dim);
    const candidateMs = Date.UTC(y, mo, day, hour, minute, 0, 0);
    if (candidateMs > now + graceMs) {
      return new Date(Date.UTC(y, mo, day));
    }
    mo += 1;
    if (mo > 11) {
      mo = 0;
      y += 1;
    }
  }

  const tomorrow = new Date();
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  return new Date(Date.UTC(tomorrow.getUTCFullYear(), tomorrow.getUTCMonth(), tomorrow.getUTCDate()));
}
