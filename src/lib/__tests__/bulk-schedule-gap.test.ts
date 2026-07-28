import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildScheduleOccupancy,
  calculateGapScheduledDate,
  markScheduleOccupancyFromDate,
  resolveGapScheduledDates,
  utcDayKey,
} from '../bulk-schedule-gap';

describe('buildScheduleOccupancy', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-15T08:00:00Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('ignores empty or invalid date_gmt values', () => {
    const occ = buildScheduleOccupancy(['', 'not-a-date', '2026-06-15T09:00:00Z']);
    expect(occ.occupiedUtcDays.has('2026-06-15')).toBe(true);
    expect(occ.occupiedUtcDays.size).toBe(1);
  });
});

describe('calculateGapScheduledDate daily', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-15T08:00:00Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const baseOpts = {
    frequency: 'daily' as const,
    startTime: '09:00',
  };

  it('skips occupied UTC days', () => {
    const occ = buildScheduleOccupancy([
      '2026-06-15T09:00:00Z',
      '2026-06-16T09:00:00Z',
      '2026-06-17T09:00:00Z',
    ]);

    const d0 = calculateGapScheduledDate(0, baseOpts, occ, []);
    const d1 = calculateGapScheduledDate(1, baseOpts, occ, [d0]);

    expect(utcDayKey(d0)).toBe('2026-06-18');
    expect(utcDayKey(d1)).toBe('2026-06-19');
  });

  it('keeps in-batch rows on distinct days', () => {
    const occ = buildScheduleOccupancy([]);
    const dates = resolveGapScheduledDates(2, baseOpts, occ);
    expect(utcDayKey(dates[0]!)).not.toBe(utcDayKey(dates[1]!));
  });
});

describe('calculateGapScheduledDate weekly', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-15T08:00:00Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('skips weeks that already have a post', () => {
    const occ = buildScheduleOccupancy(['2026-06-10T12:00:00Z']);
    const d0 = calculateGapScheduledDate(
      0,
      { frequency: 'weekly', startTime: '09:00', dayOfWeek: 1 },
      occ,
      [],
    );
    expect(d0.getUTCDay()).toBe(1);
    const weekStart = new Date(Date.UTC(d0.getUTCFullYear(), d0.getUTCMonth(), d0.getUTCDate()));
    weekStart.setUTCDate(weekStart.getUTCDate() - weekStart.getUTCDay());
    expect(weekStart.getTime()).toBeGreaterThan(new Date('2026-06-08T00:00:00Z').getTime());
  });
});

describe('calculateGapScheduledDate monthly and custom', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-15T08:00:00Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('uses the first empty UTC month when June is occupied', () => {
    const occ = buildScheduleOccupancy(['2026-06-05T09:00:00Z']);
    const d0 = calculateGapScheduledDate(
      0,
      { frequency: 'monthly', startTime: '09:00' },
      occ,
      [],
    );
    expect(d0.getUTCMonth()).toBe(6);
    expect(d0.getUTCFullYear()).toBe(2026);
  });

  it('places all times-per-month slots in the first empty month', () => {
    const occ = buildScheduleOccupancy(['2026-06-01T09:00:00Z']);
    const opts = {
      frequency: 'custom' as const,
      startTime: '09:00',
      customInterval: 3,
      customStaggerOptimized: false,
    };
    const dates = resolveGapScheduledDates(3, opts, occ);
    expect(dates[0]!.getUTCMonth()).toBe(6);
    expect(dates[1]!.getUTCMonth()).toBe(6);
    expect(dates[2]!.getUTCMonth()).toBe(6);
    expect(dates[0]!.getUTCDate()).not.toBe(dates[1]!.getUTCDate());
  });

  it('places custom times-per-month slots in empty months', () => {
    const occ = buildScheduleOccupancy(['2026-06-01T09:00:00Z']);
    const d0 = calculateGapScheduledDate(
      0,
      { frequency: 'custom', startTime: '09:00', customInterval: 2, customStaggerOptimized: false },
      occ,
      [],
    );
    expect(d0.getUTCMonth()).toBe(6);
  });
});

describe('markScheduleOccupancyFromDate', () => {
  it('marks day week and month buckets', () => {
    const occ = buildScheduleOccupancy([]);
    markScheduleOccupancyFromDate(occ, new Date('2026-07-04T09:00:00Z'));
    expect(occ.occupiedUtcDays.has('2026-07-04')).toBe(true);
    expect(occ.occupiedUtcMonths.has('2026-07')).toBe(true);
    expect(occ.occupiedUtcWeeks.size).toBe(1);
  });
});
