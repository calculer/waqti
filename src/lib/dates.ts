import {
  addDays,
  addMonths,
  differenceInCalendarDays,
  differenceInMinutes,
  endOfMonth,
  format,
  getDay,
  isAfter,
  isBefore,
  isSameDay,
  parseISO,
  startOfMonth,
  startOfWeek,
  subDays,
} from 'date-fns';
import { arSA, enUS, fr } from 'date-fns/locale';
import type {
  ActiveTimerState,
  DigitsStyle,
  Exam,
  Language,
  RevisionSession,
  TimeFormat,
  TimetableSlot,
  WeekDay,
} from '../types';
import { formatDigits, formatTimeDisplay, t } from './i18n';

const DATE_FNS_LOCALES = {
  ar: arSA,
  fr: fr,
  en: enUS,
} as const;

/**
 * Detects browser timezone safely, falling back to UTC if unavailable.
 */
export function detectTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

/**
 * Converts a Date object into a local "YYYY-MM-DD" string in the specified timezone.
 */
export function getLocalDateString(date: Date = new Date(), timeZone?: string): string {
  if (timeZone) {
    try {
      const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).formatToParts(date);
      const y = parts.find((p) => p.type === 'year')?.value;
      const m = parts.find((p) => p.type === 'month')?.value;
      const d = parts.find((p) => p.type === 'day')?.value;
      if (y && m && d) return `${y}-${m}-${d}`;
    } catch {
      // Fallback to local system format
    }
  }
  return format(date, 'yyyy-MM-dd');
}

/**
 * Converts a Date object into a local "HH:mm" string in the specified timezone.
 */
export function getLocalTimeString(date: Date = new Date(), timeZone?: string): string {
  if (timeZone) {
    try {
      const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).formatToParts(date);
      const h = parts.find((p) => p.type === 'hour')?.value;
      const m = parts.find((p) => p.type === 'minute')?.value;
      if (h && m) {
        const normalizedH = h === '24' ? '00' : h.padStart(2, '0');
        return `${normalizedH}:${m.padStart(2, '0')}`;
      }
    } catch {
      // Fallback to local
    }
  }
  return format(date, 'HH:mm');
}

/**
 * Parses a "YYYY-MM-DD" string and optional "HH:mm" time string in the local zone using date-fns parseISO.
 * NEVER uses `new Date("YYYY-MM-DD")` (which parses as UTC and shifts the calendar day).
 */
export function parseLocalDateTime(dateStr: string, timeStr: string = '00:00'): Date {
  const safeTime = /^\d{2}:\d{2}$/.test(timeStr) ? timeStr : '00:00';
  return parseISO(`${dateStr}T${safeTime}:00`);
}

/**
 * Converts "HH:mm" into minutes from midnight (0 - 1439).
 */
export function timeToMinutes(timeStr: string): number {
  const [hStr, mStr] = timeStr.split(':');
  const h = parseInt(hStr ?? '0', 10);
  const m = parseInt(mStr ?? '0', 10);
  if (Number.isNaN(h) || Number.isNaN(m)) return 0;
  return h * 60 + m;
}

/**
 * Converts minutes from midnight into "HH:mm" clamped to [00:00, 23:45].
 */
export function minutesToTime(totalMinutes: number): string {
  const clamped = Math.max(0, Math.min(23 * 60 + 59, Math.round(totalMinutes)));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Validates that endTime is strictly after startTime.
 */
export function isValidTimeOrder(startTime: string, endTime: string): boolean {
  return timeToMinutes(endTime) > timeToMinutes(startTime);
}

/**
 * Checks whether two time intervals [startA, endA) and [startB, endB) overlap.
 */
export function doTimeRangesOverlap(
  startA: string,
  endA: string,
  startB: string,
  endB: string
): boolean {
  const sA = timeToMinutes(startA);
  const eA = timeToMinutes(endA);
  const sB = timeToMinutes(startB);
  const eB = timeToMinutes(endB);
  return sA < eB && sB < eA;
}

/**
 * Detects overlapping timetable slots on the same day of the week.
 */
export function detectSlotOverlaps(
  candidate: {
    id?: string;
    dayOfWeek: WeekDay;
    startTime: string;
    endTime: string;
  },
  existingSlots: TimetableSlot[]
): TimetableSlot[] {
  return existingSlots.filter((slot) => {
    if (candidate.id && slot.id === candidate.id) return false;
    if (slot.dayOfWeek !== candidate.dayOfWeek) return false;
    return doTimeRangesOverlap(
      candidate.startTime,
      candidate.endTime,
      slot.startTime,
      slot.endTime
    );
  });
}

export interface ExamCountdownResult {
  status: 'passed' | 'today' | 'tomorrow' | 'days_hours' | 'hours_minutes' | 'minutes';
  days: number;
  hours: number;
  minutes: number;
  totalMinutesRemaining: number;
  urgency: 'passed' | 'calm' | 'warning' | 'critical';
  label: string;
  progressPercent: number;
}

/**
 * Computes exact countdown from `now` to `exam.date` + `exam.startTime`.
 * Handles DST transitions, midnight rollovers, and localization cleanly.
 */
export function computeExamCountdown(
  examDate: string,
  examStartTime: string,
  now: Date = new Date(),
  lang: Language = 'en',
  timeFormat: TimeFormat = '24h',
  digitsStyle: DigitsStyle = 'western'
): ExamCountdownResult {
  const target = parseLocalDateTime(examDate, examStartTime);
  const totalMinutes = differenceInMinutes(target, now);

  if (totalMinutes <= 0 || isBefore(target, now)) {
    return {
      status: 'passed',
      days: 0,
      hours: 0,
      minutes: 0,
      totalMinutesRemaining: 0,
      urgency: 'passed',
      label: t(lang, 'countdown.passed', undefined, digitsStyle),
      progressPercent: 100,
    };
  }

  const calDays = differenceInCalendarDays(target, now);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  let urgency: 'calm' | 'warning' | 'critical' = 'calm';
  if (totalMinutes <= 48 * 60) {
    urgency = 'critical';
  } else if (totalMinutes <= 7 * 24 * 60) {
    urgency = 'warning';
  }

  const formattedTime = formatTimeDisplay(examStartTime, timeFormat, lang, digitsStyle);
  let status: ExamCountdownResult['status'] = 'days_hours';
  let label = '';

  if (isSameDay(target, now) && totalMinutes >= 120) {
    status = 'today';
    label = t(lang, 'countdown.todayAt', { time: formattedTime }, digitsStyle);
  } else if (totalMinutes < 60) {
    status = 'minutes';
    label = t(lang, 'countdown.inMinutes', { minutes: Math.max(1, minutes) }, digitsStyle);
  } else if (totalMinutes < 24 * 60 && isSameDay(target, now)) {
    status = 'hours_minutes';
    label = t(lang, 'countdown.inHoursMinutes', { hours, minutes }, digitsStyle);
  } else if (calDays === 1) {
    status = 'tomorrow';
    label = t(lang, 'countdown.tomorrowAt', { time: formattedTime }, digitsStyle);
  } else {
    status = 'days_hours';
    label = t(
      lang,
      'countdown.inDaysHours',
      { days: Math.max(1, days), hours },
      digitsStyle
    );
  }

  // Progress ring percentage relative to a 14-day window
  const windowMinutes = 14 * 24 * 60;
  const progressPercent = Math.max(
    8,
    Math.min(100, Math.round(((windowMinutes - Math.min(windowMinutes, totalMinutes)) / windowMinutes) * 100))
  );

  return {
    status,
    days,
    hours,
    minutes,
    totalMinutesRemaining: totalMinutes,
    urgency,
    label,
    progressPercent,
  };
}

/**
 * Returns 7 "YYYY-MM-DD" strings for the week containing `referenceDateStr` starting on `weekStart`.
 */
export function getWeekDates(referenceDateStr: string, weekStart: WeekDay): string[] {
  const ref = parseLocalDateTime(referenceDateStr, '12:00');
  const start = startOfWeek(ref, { weekStartsOn: weekStart });
  return Array.from({ length: 7 }, (_, i) => format(addDays(start, i), 'yyyy-MM-dd'));
}

/**
 * Returns a 42-cell (6 weeks) calendar grid of "YYYY-MM-DD" strings for a month view.
 */
export function getMonthCalendarGrid(referenceDateStr: string, weekStart: WeekDay): string[] {
  const ref = parseLocalDateTime(referenceDateStr, '12:00');
  const monthStart = startOfMonth(ref);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: weekStart });
  return Array.from({ length: 42 }, (_, i) => format(addDays(gridStart, i), 'yyyy-MM-dd'));
}

/**
 * Shifts a "YYYY-MM-DD" date by `days` using date-fns (safe across DST, leap years, and month/year boundaries).
 */
export function shiftDateString(dateStr: string, days: number): string {
  const parsed = parseLocalDateTime(dateStr, '12:00');
  return format(addDays(parsed, days), 'yyyy-MM-dd');
}

/**
 * Shifts a "YYYY-MM-DD" date by `months` using date-fns.
 */
export function shiftMonthString(dateStr: string, months: number): string {
  const parsed = parseLocalDateTime(dateStr, '12:00');
  return format(addMonths(parsed, months), 'yyyy-MM-dd');
}

/**
 * Gets the day of the week (0-6) for a "YYYY-MM-DD" string.
 */
export function getWeekDayIndex(dateStr: string): WeekDay {
  return getDay(parseLocalDateTime(dateStr, '12:00')) as WeekDay;
}

/**
 * Formats a "YYYY-MM-DD" string in the given locale using date-fns locale + digit conversion.
 */
export function formatLocalizedDate(
  dateStr: string,
  lang: Language,
  pattern: string = 'EEEE, d MMMM yyyy',
  digitsStyle: DigitsStyle = 'western'
): string {
  const date = parseLocalDateTime(dateStr, '12:00');
  const raw = format(date, pattern, { locale: DATE_FNS_LOCALES[lang] });
  return formatDigits(raw, lang, digitsStyle);
}

/**
 * Returns localized weekday names ordered by `weekStart`.
 */
export function getOrderedWeekdays(
  lang: Language,
  weekStart: WeekDay,
  formatPattern: 'EEEE' | 'EEE' | 'ccccc' = 'EEE'
): { dayIndex: WeekDay; label: string }[] {
  // 2026-11-08 is a Sunday (dayIndex 0)
  const baseSunday = parseLocalDateTime('2026-11-08', '12:00');
  return Array.from({ length: 7 }, (_, idx) => {
    const dayIndex = ((weekStart + idx) % 7) as WeekDay;
    const d = addDays(baseSunday, dayIndex);
    const label = format(d, formatPattern, { locale: DATE_FNS_LOCALES[lang] });
    return { dayIndex, label };
  });
}

/**
 * Formats an optional Hijri secondary date string using Intl.DateTimeFormat with Islamic Umm al-Qura calendar.
 */
export function formatHijriDate(
  dateStr: string,
  lang: Language = 'ar',
  digitsStyle: DigitsStyle = 'western'
): string {
  try {
    const date = parseLocalDateTime(dateStr, '12:00');
    const localeCode =
      lang === 'ar'
        ? 'ar-SA-u-ca-islamic-umalqura'
        : lang === 'fr'
          ? 'fr-FR-u-ca-islamic-umalqura'
          : 'en-US-u-ca-islamic-umalqura';
    const formatted = new Intl.DateTimeFormat(localeCode, {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(date);
    return formatDigits(formatted, lang, digitsStyle);
  } catch {
    return '';
  }
}

/**
 * Computes current streak for a habit given its completed "YYYY-MM-DD" dates and today's date string.
 */
export function calculateHabitStreak(completedDates: string[], todayStr: string): number {
  if (completedDates.length === 0) return 0;
  const set = new Set(completedDates);
  let cursor = parseLocalDateTime(todayStr, '12:00');
  if (!set.has(todayStr)) {
    const yesterdayStr = format(subDays(cursor, 1), 'yyyy-MM-dd');
    if (!set.has(yesterdayStr)) return 0;
    cursor = subDays(cursor, 1);
  }

  let streak = 0;
  while (set.has(format(cursor, 'yyyy-MM-dd'))) {
    streak += 1;
    cursor = subDays(cursor, 1);
  }
  return streak;
}

/**
 * Timestamp-based Pomodoro calculation so background tabs and sleep/wake never drift.
 */
export function computeRemainingTimerMs(timer: ActiveTimerState, nowMs: number = Date.now()): number {
  const runningDelta =
    timer.isRunning && timer.startedAtTimestamp !== null
      ? Math.max(0, nowMs - timer.startedAtTimestamp)
      : 0;
  const totalElapsed = timer.accumulatedElapsedMs + runningDelta;
  return Math.max(0, timer.targetDurationMs - totalElapsed);
}

/**
 * Auto-generates suggested revision sessions in free timetable slots before an exam date.
 */
export function generateRevisionPlanForExam(
  exam: Exam,
  existingSlots: TimetableSlot[],
  fromDateStr: string
): RevisionSession[] {
  const start = parseLocalDateTime(fromDateStr, '12:00');
  const examDay = parseLocalDateTime(exam.date, '12:00');
  const daysBetween = Math.max(1, Math.min(14, differenceInCalendarDays(examDay, start)));

  const candidateWindows = [
    { startTime: '16:30', endTime: '18:00' },
    { startTime: '18:30', endTime: '20:00' },
    { startTime: '10:00', endTime: '11:30' },
    { startTime: '14:00', endTime: '15:30' },
  ];

  const topics =
    exam.topics.length > 0
      ? exam.topics
      : [exam.title, `${exam.title} — Practice Problems`, `${exam.title} — Final Review`];

  const sessions: RevisionSession[] = [];
  let topicIndex = 0;

  for (let offset = 0; offset < daysBetween && sessions.length < Math.max(3, topics.length); offset++) {
    const currentDate = addDays(start, offset);
    const dateStr = format(currentDate, 'yyyy-MM-dd');
    const dayOfWeek = getDay(currentDate) as WeekDay;

    const freeWindow = candidateWindows.find((win) => {
      const overlaps = detectSlotOverlaps(
        { dayOfWeek, startTime: win.startTime, endTime: win.endTime },
        existingSlots
      );
      return overlaps.length === 0;
    });

    if (freeWindow) {
      sessions.push({
        id: `rev-${exam.id}-${dateStr}`,
        examId: exam.id,
        subjectId: exam.subjectId,
        date: dateStr,
        startTime: freeWindow.startTime,
        endTime: freeWindow.endTime,
        topic: topics[topicIndex % topics.length],
        completed: false,
      });
      topicIndex += 1;
    }
  }

  return sessions;
}

export { endOfMonth, isAfter, isBefore, isSameDay };
