import {
  buildDayWindow,
  dateToTimeString,
  formatDayLabel,
  formatFullDate,
  formatMonthYear,
  formatTime,
  formatTimeString,
  isSameDay,
  rangesOverlap,
  timeStringToDate,
  toDateKey,
  toLocalIsoString,
} from './dateHelpers';

describe('isSameDay', () => {
  it('is true for the same calendar day at different times', () => {
    expect(isSameDay(new Date(2026, 6, 15, 9, 0), new Date(2026, 6, 15, 23, 59))).toBe(true);
  });

  it('is false across a day boundary', () => {
    expect(isSameDay(new Date(2026, 6, 15, 23, 59), new Date(2026, 6, 16, 0, 0))).toBe(false);
  });

  it('is false across a month or year boundary even if the date number matches', () => {
    expect(isSameDay(new Date(2026, 6, 15), new Date(2026, 7, 15))).toBe(false);
    expect(isSameDay(new Date(2026, 6, 15), new Date(2027, 6, 15))).toBe(false);
  });
});

describe('buildDayWindow', () => {
  it('returns `length` consecutive days starting at midnight of startDate', () => {
    const start = new Date(2026, 6, 15, 17, 30);
    const days = buildDayWindow(start, 5);

    expect(days).toHaveLength(5);
    days.forEach((day) => {
      expect(day.getHours()).toBe(0);
      expect(day.getMinutes()).toBe(0);
    });
    expect(days[0].getDate()).toBe(15);
    expect(days[4].getDate()).toBe(19);
  });

  it('defaults to a 30-day window', () => {
    expect(buildDayWindow(new Date(2026, 6, 15))).toHaveLength(30);
  });

  it('rolls over month boundaries correctly', () => {
    const days = buildDayWindow(new Date(2026, 6, 30), 3);
    expect(days.map((d) => d.getDate())).toEqual([30, 31, 1]);
    expect(days[2].getMonth()).toBe(7); // August
  });
});

describe('toDateKey', () => {
  it('formats as YYYY-MM-DD with zero-padding', () => {
    expect(toDateKey(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(toDateKey(new Date(2026, 10, 20))).toBe('2026-11-20');
  });
});

describe('timeStringToDate / dateToTimeString', () => {
  it('round-trips an HH:mm string through a Date', () => {
    const base = new Date(2026, 6, 15);
    const result = timeStringToDate(base, '09:05');
    expect(result.getHours()).toBe(9);
    expect(result.getMinutes()).toBe(5);
    expect(result.getSeconds()).toBe(0);
    expect(dateToTimeString(result)).toBe('09:05');
  });

  it('preserves the base date while only changing the time', () => {
    const base = new Date(2026, 6, 15);
    const result = timeStringToDate(base, '23:45');
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(6);
    expect(result.getDate()).toBe(15);
  });

  it('dateToTimeString zero-pads single-digit hours and minutes', () => {
    expect(dateToTimeString(new Date(2026, 6, 15, 5, 3))).toBe('05:03');
  });
});

describe('rangesOverlap', () => {
  it('detects a clear overlap', () => {
    const start = new Date(2026, 6, 15, 9, 0);
    const end = new Date(2026, 6, 15, 10, 0);
    const otherStart = new Date(2026, 6, 15, 9, 30);
    const otherEnd = new Date(2026, 6, 15, 10, 30);
    expect(rangesOverlap(start, end, otherStart, otherEnd)).toBe(true);
  });

  it('is false for back-to-back ranges that only touch at the boundary', () => {
    const aStart = new Date(2026, 6, 15, 9, 0);
    const aEnd = new Date(2026, 6, 15, 10, 0);
    const bStart = new Date(2026, 6, 15, 10, 0);
    const bEnd = new Date(2026, 6, 15, 11, 0);
    expect(rangesOverlap(aStart, aEnd, bStart, bEnd)).toBe(false);
  });

  it('is false for ranges on different days', () => {
    const aStart = new Date(2026, 6, 15, 9, 0);
    const aEnd = new Date(2026, 6, 15, 10, 0);
    const bStart = new Date(2026, 6, 16, 9, 0);
    const bEnd = new Date(2026, 6, 16, 10, 0);
    expect(rangesOverlap(aStart, aEnd, bStart, bEnd)).toBe(false);
  });

  it('detects when one range fully contains the other', () => {
    const outerStart = new Date(2026, 6, 15, 8, 0);
    const outerEnd = new Date(2026, 6, 15, 12, 0);
    const innerStart = new Date(2026, 6, 15, 9, 0);
    const innerEnd = new Date(2026, 6, 15, 10, 0);
    expect(rangesOverlap(outerStart, outerEnd, innerStart, innerEnd)).toBe(true);
  });
});

describe('toLocalIsoString', () => {
  it('formats without a timezone offset, matching the local wall-clock time', () => {
    const date = new Date(2026, 6, 5, 9, 5, 30);
    expect(toLocalIsoString(date)).toBe('2026-07-05T09:05:00');
  });

  it('zero-pads month, day, hour and minute', () => {
    const date = new Date(2026, 0, 1, 0, 0);
    expect(toLocalIsoString(date)).toBe('2026-01-01T00:00:00');
  });
});

describe('locale-formatted labels', () => {
  it('formatDayLabel returns an uppercase weekday abbreviation without a trailing dot', () => {
    const label = formatDayLabel(new Date(2026, 6, 15)); // Wednesday
    expect(label).toBe(label.toUpperCase());
    expect(label).not.toContain('.');
    expect(label.length).toBeGreaterThan(0);
  });

  it('formatMonthYear capitalizes the first letter and includes the year', () => {
    const label = formatMonthYear(new Date(2026, 6, 15));
    expect(label[0]).toBe(label[0].toUpperCase());
    expect(label).toContain('2026');
  });

  it('formatFullDate capitalizes the first letter and includes the day number', () => {
    const label = formatFullDate(new Date(2026, 6, 15));
    expect(label[0]).toBe(label[0].toUpperCase());
    expect(label).toContain('15');
  });

  it('formatTime and formatTimeString agree on the same instant', () => {
    const iso = '2026-07-15T09:05:00';
    expect(formatTime(iso)).toBe(formatTimeString('09:05'));
  });
});
