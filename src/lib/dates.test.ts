import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateHabitStreak,
  computeExamCountdown,
  computeRemainingTimerMs,
  detectSlotOverlaps,
  getLocalDateString,
  getWeekDates,
  isValidTimeOrder,
  parseLocalDateTime,
  shiftDateString,
} from './dates';
import type { ActiveTimerState, TimetableSlot } from '../types';

test('parseLocalDateTime parses YYYY-MM-DD in local time without UTC day shift', () => {
  const d = parseLocalDateTime('2026-11-10', '08:30');
  assert.equal(d.getFullYear(), 2026);
  assert.equal(d.getMonth(), 10); // November is 10 (0-indexed)
  assert.equal(d.getDate(), 10);
  assert.equal(d.getHours(), 8);
  assert.equal(d.getMinutes(), 30);
});

test('shiftDateString handles leap years, month/year boundaries, and DST transitions safely', () => {
  // Leap year 2028
  assert.equal(shiftDateString('2028-02-28', 1), '2028-02-29');
  assert.equal(shiftDateString('2028-02-29', 1), '2028-03-01');
  // Non-leap year 2026
  assert.equal(shiftDateString('2026-02-28', 1), '2026-03-01');
  // Year boundary
  assert.equal(shiftDateString('2026-12-31', 1), '2027-01-01');
  // DST transition day (March & November)
  assert.equal(shiftDateString('2026-03-08', 1), '2026-03-09');
  assert.equal(shiftDateString('2026-11-01', 1), '2026-11-02');
});

test('getWeekDates respects locale weekStart (Saturday=6, Monday=1, Sunday=0)', () => {
  // 2026-11-10 is Tuesday
  const satWeek = getWeekDates('2026-11-10', 6);
  assert.equal(satWeek[0], '2026-11-07'); // Saturday
  assert.equal(satWeek[6], '2026-11-13'); // Friday

  const monWeek = getWeekDates('2026-11-10', 1);
  assert.equal(monWeek[0], '2026-11-09'); // Monday
  assert.equal(monWeek[6], '2026-11-15'); // Sunday

  const sunWeek = getWeekDates('2026-11-10', 0);
  assert.equal(sunWeek[0], '2026-11-08'); // Sunday
  assert.equal(sunWeek[6], '2026-11-14'); // Saturday
});

test('isValidTimeOrder and detectSlotOverlaps catch invalid times and schedule conflicts', () => {
  assert.equal(isValidTimeOrder('08:00', '09:30'), true);
  assert.equal(isValidTimeOrder('10:00', '10:00'), false);
  assert.equal(isValidTimeOrder('11:00', '09:30'), false);

  const existing: TimetableSlot[] = [
    {
      id: 'slot-1',
      subjectId: 'math',
      dayOfWeek: 1,
      startTime: '09:00',
      endTime: '10:30',
      room: 'A101',
      teacher: 'Dr. Rami',
      recurrence: 'weekly',
    },
  ];

  // Overlapping slot on Monday (day 1)
  const conflicts = detectSlotOverlaps(
    { dayOfWeek: 1, startTime: '10:00', endTime: '11:30' },
    existing
  );
  assert.equal(conflicts.length, 1);

  // Adjacent non-overlapping slot (starts right at 10:30)
  const adjacent = detectSlotOverlaps(
    { dayOfWeek: 1, startTime: '10:30', endTime: '12:00' },
    existing
  );
  assert.equal(adjacent.length, 0);
});

test('computeExamCountdown calculates Passed, Today at HH:mm, Tomorrow, and in Xd Yh accurately', () => {
  const now = parseLocalDateTime('2026-11-10', '09:00');

  // Passed
  const passed = computeExamCountdown('2026-11-09', '14:00', now, 'en', '24h');
  assert.equal(passed.status, 'passed');
  assert.equal(passed.label, 'Passed');

  // Today at 14:00
  const today = computeExamCountdown('2026-11-10', '14:00', now, 'en', '24h');
  assert.equal(today.status, 'today');
  assert.equal(today.label, 'Today at 14:00');

  // Tomorrow
  const tomorrow = computeExamCountdown('2026-11-11', '10:00', now, 'en', '24h');
  assert.equal(tomorrow.status, 'tomorrow');
  assert.equal(tomorrow.label, 'Tomorrow at 10:00');

  // In 3 days 4h
  const future = computeExamCountdown('2026-11-13', '13:00', now, 'en', '24h');
  assert.equal(future.status, 'days_hours');
  assert.equal(future.days, 3);
  assert.equal(future.hours, 4);
  assert.equal(future.label, 'in 3d 4h');
});

test('getLocalDateString supports explicit timezone conversion', () => {
  const sampleUtc = new Date('2026-11-10T23:30:00Z');
  const tokyoDate = getLocalDateString(sampleUtc, 'Asia/Tokyo');
  const nyDate = getLocalDateString(sampleUtc, 'America/New_York');
  assert.equal(tokyoDate, '2026-11-11');
  assert.equal(nyDate, '2026-11-10');
});

test('computeRemainingTimerMs is timestamp-based and immune to background tab throttling', () => {
  const startMs = 1_700_000_000_000;
  const timer: ActiveTimerState = {
    isRunning: true,
    mode: 'focus',
    subjectId: 'math',
    startedAtTimestamp: startMs,
    accumulatedElapsedMs: 60_000, // 1 min already elapsed
    targetDurationMs: 25 * 60_000, // 25 min total
    completedCycles: 0,
    ambientSound: 'none',
  };

  // 4 minutes after startMs -> total elapsed = 5 min -> 20 min remaining
  const rem = computeRemainingTimerMs(timer, startMs + 4 * 60_000);
  assert.equal(rem, 20 * 60_000);
});

test('calculateHabitStreak computes consecutive day streaks accurately', () => {
  const dates = ['2026-11-08', '2026-11-09', '2026-11-10'];
  assert.equal(calculateHabitStreak(dates, '2026-11-10'), 3);
  assert.equal(calculateHabitStreak(dates, '2026-11-11'), 3); // Still valid before today ends
  assert.equal(calculateHabitStreak(dates, '2026-11-12'), 0); // Broken streak
});
