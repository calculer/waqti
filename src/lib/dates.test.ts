import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateHabitStreak,
  computeExamCountdown,
  computeRemainingTimerMs,
  computeTargetExamGrade,
  detectSlotOverlaps,
  doesAlarmMatchDate,
  findMissedAlarms,
  getLocalDateString,
  getMonthCalendarGrid,
  getOccurrencesForDate,
  getOrderedWeekdays,
  getWeekDates,
  isAlarmDueNow,
  isValidTimeOrder,
  packOverlappingEvents,
  parseLocalDateTime,
  parseQuickCaptureInput,
  shiftDateString,
  summarizeMonthCellEvents,
} from './dates';
import {
  computeToastRemainingMs,
  createToastItem,
  pauseToast,
  pruneExpiredToasts,
  pushToastToStack,
  resumeToast,
} from './toastTimer';
import type { ActiveTimerState, AlarmReminder, Subject, TimetableSlot } from '../types';

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

test('getWeekDates respects locale weekStart (Saturday=6, Monday=1, Sunday=7)', () => {
  // 2026-11-10 is Tuesday
  const satWeek = getWeekDates('2026-11-10', 6);
  assert.equal(satWeek[0], '2026-11-07'); // Saturday
  assert.equal(satWeek[6], '2026-11-13'); // Friday

  const monWeek = getWeekDates('2026-11-10', 1);
  assert.equal(monWeek[0], '2026-11-09'); // Monday
  assert.equal(monWeek[6], '2026-11-15'); // Sunday

  const sunWeek = getWeekDates('2026-11-10', 7);
  assert.equal(sunWeek[0], '2026-11-08'); // Sunday
  assert.equal(sunWeek[6], '2026-11-14'); // Saturday
});

test('getOccurrencesForDate matches all 7 ISO weekdays identically regardless of weekStart (Saturday=6, Sunday=7, Monday=1)', () => {
  const subjects: Subject[] = [
    {
      id: 'subj-math',
      name: 'Mathematics',
      color: 'honey',
      icon: 'Sigma',
      teacher: 'Dr. Tariq',
      room: 'Amphi A',
      coefficient: 5,
      weeklyGoalHours: 6,
      archived: false,
      createdAt: '2026-09-01T00:00:00.000Z',
    },
  ];

  // Create one class on every canonical ISO weekday 1..7
  const slotsAll7Days: TimetableSlot[] = ([1, 2, 3, 4, 5, 6, 7] as const).map((isoDay) => ({
    id: `slot-day-${isoDay}`,
    subjectId: 'subj-math',
    dayOfWeek: isoDay,
    startTime: '09:00',
    endTime: '10:30',
    room: `Room ${isoDay}`,
    teacher: 'Dr. Tariq',
    recurrence: 'weekly',
    type: 'lecture',
    mode: isoDay === 7 ? 'remote' : isoDay === 6 ? 'hybrid' : 'in_person',
  }));

  // Test across all 3 weekStart configurations: Saturday (6), Sunday (7), Monday (1)
  for (const weekStart of [6, 7, 1] as const) {
    const orderedCols = getOrderedWeekdays('ar', weekStart, 'EEEE');
    assert.equal(orderedCols[0].dayIndex, weekStart);
    assert.equal(orderedCols.length, 7);

    const weekDates = getWeekDates('2026-11-10', weekStart);
    for (let i = 0; i < 7; i++) {
      const dStr = weekDates[i];
      const expectedIsoDay = orderedCols[i].dayIndex;
      const occ = getOccurrencesForDate(dStr, {
        timetable: slotsAll7Days,
        subjects,
        exams: [],
        tasks: [],
        habits: [],
        alarms: [],
      });
      assert.equal(occ.classes.length, 1, `Expected 1 class on ${dStr} (ISO day ${expectedIsoDay})`);
      assert.equal(occ.classes[0].slotId, `slot-day-${expectedIsoDay}`);
    }
  }
});

test('Month calendar grid shows event dots on all weekdays (not only Saturday), across month boundaries, leap-year Feb 29, and DST changes', () => {
  const subjects: Subject[] = [
    {
      id: 'subj-1',
      name: 'Physics',
      color: 'sage',
      icon: 'Atom',
      teacher: 'Dr. Salma',
      room: 'Lab 1',
      coefficient: 4,
      weeklyGoalHours: 4,
      archived: false,
      createdAt: '2026-09-01T00:00:00.000Z',
    },
  ];

  // Classes on Saturday (6), Sunday (7), Monday (1), Tuesday (2), Wednesday (3), Thursday (4)
  const slots: TimetableSlot[] = ([6, 7, 1, 2, 3, 4] as const).map((dow) => ({
    id: `slot-${dow}`,
    subjectId: 'subj-1',
    dayOfWeek: dow,
    startTime: '10:00',
    endTime: '11:30',
    room: 'Hall 1',
    teacher: 'Dr. Salma',
    recurrence: 'weekly',
  }));

  // November 2026 grid with Saturday weekStart (6)
  const novGrid = getMonthCalendarGrid('2026-11-11', 6);
  assert.ok(novGrid.includes('2026-10-31')); // Saturday Oct 31 boundary
  assert.ok(novGrid.includes('2026-11-01')); // Sunday Nov 1 (DST transition day)
  assert.ok(novGrid.includes('2026-11-02')); // Monday Nov 2

  for (const dateStr of ['2026-10-31', '2026-11-01', '2026-11-02', '2026-11-08', '2026-11-09', '2026-11-10']) {
    const occ = getOccurrencesForDate(dateStr, { timetable: slots, subjects });
    const summary = summarizeMonthCellEvents(
      occ.map((e) => ({ id: e.id, type: e.type, title: e.title })),
      3
    );
    assert.equal(summary.visibleDots.length, 1, `Expected event dot on ${dateStr}`);
  }

  // Leap year Feb 29, 2028 (Tuesday = ISO 2)
  const leapOcc = getOccurrencesForDate('2028-02-29', { timetable: slots, subjects });
  assert.equal(leapOcc.classes.length, 1);
  assert.equal(leapOcc.classes[0].slotId, 'slot-2');

  // Spring DST transition day March 8, 2026 (Sunday = ISO 7)
  const dstOcc = getOccurrencesForDate('2026-03-08', { timetable: slots, subjects });
  assert.equal(dstOcc.classes.length, 1);
  assert.equal(dstOcc.classes[0].slotId, 'slot-7');
});

test('Toast timer system auto-dismisses at 5s (8s for error), pauses on hover, caps stack at 3, and omits Undo when nothing changed', () => {
  const t0 = 1_700_000_000_000;

  // Normal toast = 5000ms, error toast = 8000ms
  const normalToast = createToastItem({
    message: '4 classes imported',
    variant: 'success',
    nowMs: t0,
    importedCount: 4,
    onUndo: () => {},
  });
  assert.equal(normalToast.durationMs, 5000);
  assert.ok(typeof normalToast.onUndo === 'function');

  const errorToast = createToastItem({
    message: 'Import error',
    variant: 'error',
    nowMs: t0,
  });
  assert.equal(errorToast.durationMs, 8000);

  // When nothingChanged or importedCount === 0, onUndo is stripped even if passed
  const zeroImportToast = createToastItem({
    message: '0 added · 3 duplicates skipped',
    variant: 'warning',
    nowMs: t0,
    nothingChanged: true,
    importedCount: 0,
    onUndo: () => {},
  });
  assert.equal(zeroImportToast.onUndo, undefined);

  // Pause after 2s elapsed -> 3s remaining even 10s later while paused
  const paused = pauseToast(normalToast, t0 + 2000);
  assert.equal(computeToastRemainingMs(paused, t0 + 12000), 3000);

  // Resume at t0 + 12000 -> expires at t0 + 15000
  const resumed = resumeToast(paused, t0 + 12000);
  assert.equal(computeToastRemainingMs(resumed, t0 + 14000), 1000);
  assert.equal(computeToastRemainingMs(resumed, t0 + 15000), 0);

  // Stack capped at 3 toasts
  let stack = pushToastToStack([], normalToast, 3);
  stack = pushToastToStack(stack, errorToast, 3);
  stack = pushToastToStack(stack, zeroImportToast, 3);
  const fourthToast = createToastItem({ message: 'Fourth', nowMs: t0 });
  stack = pushToastToStack(stack, fourthToast, 3);
  assert.equal(stack.length, 3);
  assert.equal(stack[2].message, 'Fourth');

  // Prune expired after 6s (5s toasts expire, 8s error toast remains)
  const after6s = pruneExpiredToasts([normalToast, errorToast], t0 + 6000);
  assert.equal(after6s.length, 1);
  assert.equal(after6s[0].id, errorToast.id);
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

test('summarizeMonthCellEvents caps visible dots to 3 and computes +N overflow accurately', () => {
  const fiveEvents = [
    { id: '1', type: 'exam', title: 'Exam 1' },
    { id: '2', type: 'class', title: 'Class 1' },
    { id: '3', type: 'task', title: 'Task 1' },
    { id: '4', type: 'alarm', title: 'Alarm 1' },
    { id: '5', type: 'habit', title: 'Habit 1' },
  ];
  const summary = summarizeMonthCellEvents(fiveEvents, 3);
  assert.equal(summary.visibleDots.length, 3);
  assert.equal(summary.overflowCount, 2);
});

test('packOverlappingEvents packs overlapping time blocks side-by-side without collisions', () => {
  const events = [
    { id: 'a', startTime: '09:00', endTime: '10:30' },
    { id: 'b', startTime: '09:30', endTime: '11:00' },
    { id: 'c', startTime: '11:00', endTime: '12:00' }, // Adjacent to b, should start new group
  ];
  const packed = packOverlappingEvents(events);
  const a = packed.find((x) => x.id === 'a')!;
  const b = packed.find((x) => x.id === 'b')!;
  const c = packed.find((x) => x.id === 'c')!;

  assert.equal(a.totalCols, 2);
  assert.equal(b.totalCols, 2);
  assert.notEqual(a.colIndex, b.colIndex);
  assert.equal(c.totalCols, 1);
  assert.equal(c.colIndex, 0);
});

test('doesAlarmMatchDate, isAlarmDueNow, and findMissedAlarms handle alarms and snooze accurately', () => {
  const alarm: AlarmReminder = {
    id: 'alm-1',
    title: 'Morning Review',
    date: '2026-11-10',
    time: '08:00',
    recurrence: 'weekdays',
    daysOfWeek: [1, 2, 3, 4, 5],
    leadMinutes: 0,
    sound: 'soft_bell',
    vibrate: true,
    snoozeMinutes: 10,
    enabled: true,
    linkedType: 'custom',
    createdAt: '2026-11-01T00:00:00.000Z',
    updatedAt: '2026-11-01T00:00:00.000Z',
  };

  // 2026-11-10 is Tuesday (weekday) -> matches
  assert.equal(doesAlarmMatchDate(alarm, '2026-11-10'), true);
  // 2026-11-08 is Sunday -> does not match weekdays
  assert.equal(doesAlarmMatchDate(alarm, '2026-11-08'), false);

  // Exact due check at 08:00 on 2026-11-10
  const dueCheck = isAlarmDueNow(alarm, '2026-11-10', '08:00', Date.now());
  assert.equal(dueCheck, true);

  // Already fired -> not due again
  const alreadyFiredAlarm: AlarmReminder = {
    ...alarm,
    lastFiredDateKey: '2026-11-10T08:00',
  };
  assert.equal(isAlarmDueNow(alreadyFiredAlarm, '2026-11-10', '08:00', Date.now()), false);

  // Missed alarm when checked between 07:50 and 08:15 on 2026-11-10
  const startWindowMs = parseLocalDateTime('2026-11-10', '07:50').getTime();
  const endWindowMs = parseLocalDateTime('2026-11-10', '08:15').getTime();
  const missed = findMissedAlarms([alarm], startWindowMs, endWindowMs);
  assert.equal(missed.length, 1);
  assert.equal(missed[0].alarmId, 'alm-1');
});

test('computeTargetExamGrade calculates required score on next exam accurately', () => {
  const res = computeTargetExamGrade(14.5, 4, 16, 2, 20);
  // Current points = 14.5 * 4 = 58. Target points = 16 * 6 = 96. Needed = (96 - 58) / 2 = 19/20
  assert.equal(res.neededGrade, 19);
  assert.equal(res.achievable, true);
});

test('parseQuickCaptureInput parses English, French, and Arabic natural language inputs', () => {
  const mockSubjects: Subject[] = [
    {
      id: 'subj-math',
      name: 'Mathematics',
      color: 'honey',
      icon: 'BookOpen',
      teacher: 'Dr. Rami',
      room: 'B201',
      coefficient: 5,
      weeklyGoalHours: 6,
      archived: false,
      createdAt: '2026-11-01T00:00:00.000Z',
    },
  ];
  const examRes = parseQuickCaptureInput('Mathematics exam tomorrow 09:30', 'en', '2026-11-10', mockSubjects);
  assert.equal(examRes.kind, 'exam');
  assert.equal(examRes.date, '2026-11-11');
  assert.equal(examRes.time, '09:30');
  assert.equal(examRes.subjectId, 'subj-math');

  const alarmRes = parseQuickCaptureInput('Remind me 18:30 review flashcards', 'en', '2026-11-10', mockSubjects);
  assert.equal(alarmRes.kind, 'alarm');
  assert.equal(alarmRes.time, '18:30');

  const arExam = parseQuickCaptureInput('امتحان فيزياء غداً 10:00', 'ar', '2026-11-10', mockSubjects);
  assert.equal(arExam.kind, 'exam');
  assert.equal(arExam.date, '2026-11-11');
  assert.equal(arExam.time, '10:00');
});
