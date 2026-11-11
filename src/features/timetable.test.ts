import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  computeTimetableBlockMetrics,
  computeTimetableGridHours,
  computeWeeklyTimetableSummary,
  formatShiftPillLabel,
  isSlotActiveOnDate,
  packOverlappingEvents,
  shouldShowCompactTimeOnly,
  snapMinutesToStep,
} from '../lib/dates';
import { formatTimeRange } from '../lib/i18n';
import type { TimetableSlot } from '../types';

test('overlapping-class column packing assigns side-by-side columns without overlapping text', () => {
  const slots: TimetableSlot[] = [
    {
      id: 'slot-1',
      subjectId: 'math',
      dayOfWeek: 1,
      startTime: '09:00',
      endTime: '10:30',
      room: 'Amphi 2',
      teacher: 'Dr. Tariq',
      recurrence: 'weekly',
    },
    {
      id: 'slot-2',
      subjectId: 'phys',
      dayOfWeek: 1,
      startTime: '09:30',
      endTime: '11:00',
      room: 'Lab 104',
      teacher: 'Dr. Salma',
      recurrence: 'weekly',
    },
    {
      id: 'slot-3',
      subjectId: 'cs',
      dayOfWeek: 1,
      startTime: '11:00',
      endTime: '12:30',
      room: 'Salle 301',
      teacher: 'Prof. Karim',
      recurrence: 'weekly',
    },
  ];

  const packed = packOverlappingEvents(slots);
  const s1 = packed.find((s) => s.id === 'slot-1')!;
  const s2 = packed.find((s) => s.id === 'slot-2')!;
  const s3 = packed.find((s) => s.id === 'slot-3')!;

  // slot-1 and slot-2 overlap -> packed into 2 side-by-side columns (50% width each)
  assert.equal(s1.totalCols, 2);
  assert.equal(s2.totalCols, 2);
  assert.equal(s1.colIndex, 0);
  assert.equal(s2.colIndex, 1);

  // slot-3 starts exactly when slot-2 ends (11:00) -> full width (1 column)
  assert.equal(s3.totalCols, 1);
  assert.equal(s3.colIndex, 0);
});

test('narrow-width adaptation and text clamping rules prevent truncation bugs and multi-line time wrapping', () => {
  // Below 116px block width, only compact start time is shown on surface (full range in tooltip)
  assert.equal(shouldShowCompactTimeOnly(85), true);
  assert.equal(shouldShowCompactTimeOnly(110), true);
  assert.equal(shouldShowCompactTimeOnly(116), false);
  assert.equal(shouldShowCompactTimeOnly(180), false);

  // Block height is proportional to duration and never smaller than 40px
  const shortBlock = computeTimetableBlockMetrics('09:00', '09:20', 7, 68, 40);
  assert.equal(shortBlock.heightPx, 40);

  const ninetyMinBlock = computeTimetableBlockMetrics('09:00', '10:30', 7, 68, 40);
  assert.equal(ninetyMinBlock.topPx, 2 * 68);
  assert.equal(ninetyMinBlock.heightPx, Math.round(1.5 * 68));
  assert.equal(ninetyMinBlock.durationMinutes, 90);

  // Verify container query & line-clamp classes in TimetableView and index.css
  const timetableCode = fs.readFileSync('src/features/TimetableView.tsx', 'utf8');
  const cssCode = fs.readFileSync('src/index.css', 'utf8');

  assert.ok(timetableCode.includes('waqti-slot-container'));
  assert.ok(timetableCode.includes('line-clamp-2'));
  assert.ok(timetableCode.includes('[overflow-wrap:anywhere]'));
  assert.ok(timetableCode.includes('whitespace-nowrap'));
  assert.ok(cssCode.includes('@container slotblock (min-width: 116px)'));
});

test('RTL time-range ordering and shift pills keep start -> end order and Western numerals with localized unit', () => {
  // Arabic RTL time range never reverses start and end
  const arRange = formatTimeRange('09:00', '10:30', '24h', 'ar', 'western');
  assert.equal(arRange, '09:00 – 10:30');

  const arRange12 = formatTimeRange('09:00', '10:30', '12h', 'ar', 'western');
  assert.equal(arRange12, '9:00 ص – 10:30 ص');

  // Shift pills always use Western digits + localized unit ("min" / "د" / "min") in one token
  assert.equal(formatShiftPillLabel(-30, 'ar'), '-30 د');
  assert.equal(formatShiftPillLabel(15, 'ar'), '+15 د');
  assert.equal(formatShiftPillLabel(-15, 'fr'), '-15 min');
  assert.equal(formatShiftPillLabel(30, 'en'), '+30 min');
});

test('5-minute snapping, auto-fit grid hours, occurrence filtering, and weekly summary work accurately', () => {
  assert.equal(snapMinutesToStep(9 * 60 + 3, 5), 9 * 60 + 5);
  assert.equal(snapMinutesToStep(9 * 60 + 2, 5), 9 * 60);

  const slots: TimetableSlot[] = [
    {
      id: 's1',
      subjectId: 'math',
      dayOfWeek: 2, // Tuesday
      startTime: '08:30',
      endTime: '10:00',
      room: 'B2',
      teacher: 'Dr. Tariq',
      recurrence: 'weekly',
      excludedDates: ['2026-11-17'],
    },
  ];

  const gridHours = computeTimetableGridHours(slots, true);
  assert.equal(gridHours.startHour, 7);
  assert.ok(gridHours.endHour >= 18);

  // Active on 2026-11-10 (Tuesday), excluded on 2026-11-17
  assert.equal(isSlotActiveOnDate(slots[0], '2026-11-10', 2), true);
  assert.equal(isSlotActiveOnDate(slots[0], '2026-11-17', 2), false);

  const summary = computeWeeklyTimetableSummary(slots, [
    '2026-11-07',
    '2026-11-08',
    '2026-11-09',
    '2026-11-10',
    '2026-11-11',
    '2026-11-12',
    '2026-11-13',
  ]);
  assert.equal(summary.totalHours, 1.5);
  assert.equal(summary.busiestDayIndex, 2);
});
