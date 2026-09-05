import {
  MONTH_END_SCHEDULING_BUFFER_DAYS,
  clampTimesPerMonth,
} from "@/lib/wordpress-scheduler";

export function lastAllowedPublishDay(year: number, monthIndex: number): number {
  const dim = new Date(year, monthIndex + 1, 0).getDate();
  return Math.max(1, dim - MONTH_END_SCHEDULING_BUFFER_DAYS);
}

export function lastAllowedPublishDayUtc(year: number, monthIndex: number): number {
  const dim = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  return Math.max(1, dim - MONTH_END_SCHEDULING_BUFFER_DAYS);
}

export function evenSpreadPublishDays(
  count: number,
  lastAllowed: number,
  startDay = 1,
): number[] {
  const n = clampTimesPerMonth(count);
  const cap = Math.min(n, Math.max(1, lastAllowed));
  const start = Math.min(Math.max(1, Math.floor(startDay) || 1), lastAllowed);
  const span = Math.max(1, lastAllowed - start + 1);
  if (cap <= 1) return [start];
  if (span <= 1) return Array.from({ length: cap }, () => start);
  const days: number[] = [];
  const seen = new Set<number>();
  for (let i = 0; i < cap; i += 1) {
    let day = start + Math.floor((i / (cap - 1)) * (span - 1));
    day = Math.min(lastAllowed, Math.max(start, day));
    while (seen.has(day) && day < lastAllowed) day += 1;
    while (seen.has(day) && day > start) day -= 1;
    seen.add(day);
    days.push(day);
  }
  return days;
}

export function shufflePublishDays(count: number, lastAllowed: number): number[] {
  const cap = Math.min(clampTimesPerMonth(count), Math.max(1, lastAllowed));
  const pool = Array.from({ length: Math.max(1, lastAllowed) }, (_, i) => i + 1);
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const current = pool[i]!;
    pool[i] = pool[j]!;
    pool[j] = current;
  }
  return pool.slice(0, cap).sort((a, b) => a - b);
}

export function normalizePublishDays(
  days: unknown,
  count: number,
  lastAllowed: number,
): number[] | null {
  if (!Array.isArray(days) || days.length === 0) return null;
  const n = clampTimesPerMonth(count);
  const unique: number[] = [];
  const seen = new Set<number>();
  for (const raw of days) {
    const day = Math.floor(Number(raw));
    if (!Number.isFinite(day) || day < 1 || day > lastAllowed || seen.has(day)) continue;
    seen.add(day);
    unique.push(day);
  }
  unique.sort((a, b) => a - b);
  if (unique.length !== n) return null;
  return unique;
}
