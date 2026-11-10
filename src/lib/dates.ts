import {
  addDays,
  addMinutes,
  addMonths,
  differenceInCalendarDays,
  differenceInMinutes,
  endOfMonth,
  format,
  getDate,
  getDay,
  isAfter,
  isBefore,
  isSameDay,
  parseISO,
  startOfMonth,
  startOfWeek,
  subDays,
  subMinutes,
} from 'date-fns';
import { arSA, enUS, fr } from 'date-fns/locale';
import type {
  ActiveTimerState,
  AlarmReminder,
  DigitsStyle,
  Exam,
  Language,
  MissedAlarmItem,
  RevisionSession,
  StudyTask,
  Subject,
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
 * Converts minutes from midnight into "HH:mm" clamped to [00:00, 23:59].
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

/**
 * Calendar Month Cell Overflow Summarizer:
 * Returns at most `maxDots` (default 3) items for the dot row and an exact `+N` overflow count.
 */
export function summarizeMonthCellEvents<T>(
  events: T[],
  maxDots: number = 3
): { visibleDots: T[]; overflowCount: number } {
  const safeMax = Math.max(1, maxDots);
  const visibleDots = events.slice(0, safeMax);
  const overflowCount = Math.max(0, events.length - safeMax);
  return { visibleDots, overflowCount };
}

/**
 * Calendar Week/Day View Column Packing:
 * Packs overlapping time-ranged events into side-by-side columns (`colIndex`, `totalCols`)
 * so overlapping events never render on top of each other's text.
 */
export function packOverlappingEvents<
  T extends { id: string; startTime: string; endTime: string }
>(events: T[]): Array<T & { colIndex: number; totalCols: number }> {
  if (events.length === 0) return [];

  const sorted = [...events].sort((a, b) => {
    const diffStart = timeToMinutes(a.startTime) - timeToMinutes(b.startTime);
    if (diffStart !== 0) return diffStart;
    return timeToMinutes(b.endTime) - timeToMinutes(a.endTime);
  });

  // Partition into connected overlap clusters
  const clusters: T[][] = [];
  let currentCluster: T[] = [];
  let clusterMaxEnd = -1;

  for (const ev of sorted) {
    const s = timeToMinutes(ev.startTime);
    const e = Math.max(s + 15, timeToMinutes(ev.endTime));
    if (currentCluster.length === 0 || s < clusterMaxEnd) {
      currentCluster.push(ev);
      clusterMaxEnd = Math.max(clusterMaxEnd, e);
    } else {
      clusters.push(currentCluster);
      currentCluster = [ev];
      clusterMaxEnd = e;
    }
  }
  if (currentCluster.length > 0) {
    clusters.push(currentCluster);
  }

  const packedResult: Array<T & { colIndex: number; totalCols: number }> = [];

  for (const cluster of clusters) {
    const colEndTimes: number[] = [];
    const assignedCols: { ev: T; colIndex: number }[] = [];

    for (const ev of cluster) {
      const s = timeToMinutes(ev.startTime);
      const e = Math.max(s + 15, timeToMinutes(ev.endTime));
      let placedCol = -1;

      for (let c = 0; c < colEndTimes.length; c++) {
        if (colEndTimes[c] <= s) {
          placedCol = c;
          colEndTimes[c] = e;
          break;
        }
      }

      if (placedCol === -1) {
        placedCol = colEndTimes.length;
        colEndTimes.push(e);
      }

      assignedCols.push({ ev, colIndex: placedCol });
    }

    const totalCols = Math.max(1, colEndTimes.length);
    for (const item of assignedCols) {
      packedResult.push({
        ...item.ev,
        colIndex: item.colIndex,
        totalCols,
      });
    }
  }

  return packedResult;
}

/**
 * Checks whether an alarm is scheduled to occur on a given "YYYY-MM-DD" date (before applying leadMinutes).
 */
export function doesAlarmMatchDate(alarm: AlarmReminder, dateStr: string): boolean {
  if (!alarm.enabled) return false;

  if (alarm.recurrence === 'once') {
    return alarm.date === dateStr;
  }
  if (alarm.recurrence === 'daily') {
    return true;
  }
  const dayOfWeek = getWeekDayIndex(dateStr);
  if (alarm.recurrence === 'weekdays') {
    return alarm.daysOfWeek.includes(dayOfWeek);
  }
  if (alarm.recurrence === 'weekly') {
    if (alarm.daysOfWeek.length > 0) {
      return alarm.daysOfWeek.includes(dayOfWeek);
    }
    const anchorDay = getWeekDayIndex(alarm.date);
    return dayOfWeek === anchorDay;
  }
  if (alarm.recurrence === 'monthly') {
    const d1 = getDate(parseLocalDateTime(alarm.date, '12:00'));
    const d2 = getDate(parseLocalDateTime(dateStr, '12:00'));
    return d1 === d2;
  }
  return false;
}

/**
 * Checks if a given "HH:mm" time falls inside quiet hours (which may cross midnight, e.g., 23:00 -> 06:30).
 */
export function isInQuietHours(
  timeStr: string,
  quietStart: string,
  quietEnd: string
): boolean {
  const tMin = timeToMinutes(timeStr);
  const sMin = timeToMinutes(quietStart);
  const eMin = timeToMinutes(quietEnd);
  if (sMin === eMin) return false;
  if (sMin < eMin) {
    return tMin >= sMin && tMin < eMin;
  }
  // Crosses midnight
  return tMin >= sMin || tMin < eMin;
}

/**
 * Evaluates whether an alarm should fire at the exact current local date+time or via active snooze.
 */
export function isAlarmDueNow(
  alarm: AlarmReminder,
  nowDateStr: string,
  nowTimeStr: string,
  nowMs: number,
  quietHours?: { enabled: boolean; start: string; end: string }
): boolean {
  if (!alarm.enabled) return false;

  if (quietHours?.enabled && isInQuietHours(nowTimeStr, quietHours.start, quietHours.end)) {
    return false;
  }

  // Check if snoozed and snooze timer reached
  if (typeof alarm.snoozedUntilMs === 'number' && nowMs >= alarm.snoozedUntilMs) {
    return true;
  }

  // Compute effective trigger date/time considering leadMinutes (e.g. 10m before, 1440m = 1d before)
  const targetNow = parseLocalDateTime(nowDateStr, nowTimeStr);
  const eventMoment = addMinutes(targetNow, alarm.leadMinutes || 0);
  const eventDateStr = format(eventMoment, 'yyyy-MM-dd');
  const eventTimeStr = format(eventMoment, 'HH:mm');

  if (eventTimeStr !== alarm.time) return false;
  if (!doesAlarmMatchDate(alarm, eventDateStr)) return false;

  const fireKey = `${nowDateStr}T${nowTimeStr}`;
  if (alarm.lastFiredDateKey === fireKey) return false;

  return true;
}

/**
 * Finds alarms that were missed while the app/device was closed between `lastCheckedMs` and `nowMs`.
 * Evaluates up to the last 24 hours in 1-minute steps so DST and date rollovers are respected.
 */
export function findMissedAlarms(
  alarms: AlarmReminder[],
  lastCheckedMs: number,
  nowMs: number,
  timezone?: string
): MissedAlarmItem[] {
  if (nowMs <= lastCheckedMs) return [];
  const enabledAlarms = alarms.filter((a) => a.enabled);
  if (enabledAlarms.length === 0) return [];

  // Clamp lookback window to at most 12 hours to stay fast
  const maxLookbackMs = 12 * 60 * 60 * 1000;
  const startMs = Math.max(lastCheckedMs + 60_000, nowMs - maxLookbackMs);
  const missedMap = new Map<string, MissedAlarmItem>();

  // Step minute-by-minute up to 1 minute before nowMs (current minute is handled by live ringing)
  for (let ts = startMs; ts < nowMs - 30_000; ts += 60_000) {
    const d = new Date(ts);
    const dateStr = getLocalDateString(d, timezone);
    const timeStr = getLocalTimeString(d, timezone);

    for (const alarm of enabledAlarms) {
      if (missedMap.has(alarm.id)) continue;
      if (isAlarmDueNow(alarm, dateStr, timeStr, ts)) {
        missedMap.set(alarm.id, {
          alarmId: alarm.id,
          title: alarm.title,
          scheduledDate: dateStr,
          scheduledTime: timeStr,
          linkedType: alarm.linkedType,
          linkedId: alarm.linkedId,
        });
      }
    }
  }

  return Array.from(missedMap.values());
}

/**
 * Computes the grade needed on the next exam to reach a desired target average.
 */
export function computeTargetExamGrade(
  currentAverage: number,
  currentTotalCoeff: number,
  targetAverage: number,
  nextExamCoeff: number,
  scaleOutOf: number = 20
): { neededGrade: number; achievable: boolean; alreadyReached: boolean } {
  const safeNextCoeff = Math.max(0.5, nextExamCoeff);
  const safeCurrentCoeff = Math.max(0, currentTotalCoeff);
  const totalPointsNeeded = targetAverage * (safeCurrentCoeff + safeNextCoeff);
  const currentPoints = currentAverage * safeCurrentCoeff;
  const rawNeeded = (totalPointsNeeded - currentPoints) / safeNextCoeff;
  const neededGrade = Math.max(0, Number(rawNeeded.toFixed(2)));
  return {
    neededGrade,
    achievable: neededGrade <= scaleOutOf,
    alreadyReached: rawNeeded <= 0,
  };
}

/**
 * Parses natural-language quick-capture input in English, French, or Arabic.
 * Examples:
 * - "Math exam Friday 09:00"
 * - "امتحان فيزياء غدا 10:00"
 * - "devoir de français demain 18:00"
 */
export function parseQuickCaptureInput(
  rawText: string,
  _lang: Language,
  todayStr: string,
  subjects: Subject[]
): {
  kind: 'exam' | 'task' | 'alarm';
  title: string;
  date: string;
  time: string;
  subjectId: string;
} {
  const text = rawText.trim();
  const lower = text.toLowerCase();

  // Detect kind (exam vs alarm vs task)
  const isExam = /\b(exam|examen|contrôle|controle|test|quiz|ds)\b|امتحان|اختبار|فرض/i.test(text);
  const isAlarm = /\b(alarm|remind|reminder|rappel|alarme)\b|منبه|تذكير/i.test(text);
  const kind: 'exam' | 'task' | 'alarm' = isExam ? 'exam' : isAlarm ? 'alarm' : 'task';

  // Extract HH:mm time if present
  const timeMatch = text.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  const time = timeMatch
    ? `${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}`
    : isExam
      ? '09:00'
      : '18:00';

  // Detect relative date or weekday
  let date = todayStr;
  if (/\b(tomorrow|demain)\b|غدا|غداً/i.test(text)) {
    date = shiftDateString(todayStr, 1);
  } else {
    const weekdayPatterns: { day: WeekDay; regex: RegExp }[] = [
      { day: 0, regex: /\b(sunday|dimanche)\b|الأحد|الاحد/i },
      { day: 1, regex: /\b(monday|lundi)\b|الاثنين|الإثنين/i },
      { day: 2, regex: /\b(tuesday|mardi)\b|الثلاثاء/i },
      { day: 3, regex: /\b(wednesday|mercredi)\b|الأربعاء|الاربعاء/i },
      { day: 4, regex: /\b(thursday|jeudi)\b|الخميس/i },
      { day: 5, regex: /\b(friday|vendredi)\b|الجمعة/i },
      { day: 6, regex: /\b(saturday|samedi)\b|السبت/i },
    ];
    for (const wp of weekdayPatterns) {
      if (wp.regex.test(text)) {
        const currentDow = getWeekDayIndex(todayStr);
        let delta = (wp.day - currentDow + 7) % 7;
        if (delta === 0) delta = 7;
        date = shiftDateString(todayStr, delta);
        break;
      }
    }
  }

  // Match subject by name substring
  let matchedSubjectId = subjects[0]?.id ?? '';
  for (const subj of subjects) {
    const sLower = subj.name.toLowerCase();
    const firstWord = sLower.split(/\s+/)[0] ?? '';
    if ((firstWord.length >= 3 && lower.includes(firstWord)) || lower.includes(sLower)) {
      matchedSubjectId = subj.id;
      break;
    }
  }

  return {
    kind,
    title: text,
    date,
    time,
    subjectId: matchedSubjectId,
  };
}

/**
 * Generates an RFC 5545 `.ics` iCalendar string for classes, exams, and tasks.
 */
export function generateIcsContent(
  timetable: TimetableSlot[],
  exams: Exam[],
  tasks: StudyTask[],
  subjects: Subject[],
  todayStr: string
): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Waqti Study Planner//NONSGML v2.0//EN',
    'CALSCALE:GREGORIAN',
  ];

  const toIcsDateTime = (dStr: string, tStr: string): string => {
    const cleanD = dStr.replace(/-/g, '');
    const cleanT = (tStr || '09:00').replace(':', '') + '00';
    return `${cleanD}T${cleanT}`;
  };

  for (const ex of exams) {
    const subj = subjects.find((s) => s.id === ex.subjectId);
    const startDt = parseLocalDateTime(ex.date, ex.startTime);
    const endDt = addMinutes(startDt, ex.durationMinutes || 90);
    const endTimeStr = format(endDt, 'HH:mm');

    lines.push(
      'BEGIN:VEVENT',
      `UID:waqti-exam-${ex.id}@waqti.app`,
      `DTSTART:${toIcsDateTime(ex.date, ex.startTime)}`,
      `DTEND:${toIcsDateTime(ex.date, endTimeStr)}`,
      `SUMMARY:[Exam] ${ex.title} (${subj?.name ?? ''})`,
      `LOCATION:${ex.room || ''}`,
      'END:VEVENT'
    );
  }

  for (const tk of tasks) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:waqti-task-${tk.id}@waqti.app`,
      `DTSTART:${toIcsDateTime(tk.dueDate, tk.dueTime)}`,
      `DTEND:${toIcsDateTime(tk.dueDate, tk.dueTime)}`,
      `SUMMARY:[Task] ${tk.title}`,
      'END:VEVENT'
    );
  }

  // Export current week's classes
  const weekDates = getWeekDates(todayStr, 1);
  for (const dStr of weekDates) {
    const dow = getWeekDayIndex(dStr);
    const daySlots = timetable.filter((s) => s.dayOfWeek === dow);
    for (const slot of daySlots) {
      const subj = subjects.find((s) => s.id === slot.subjectId);
      lines.push(
        'BEGIN:VEVENT',
        `UID:waqti-slot-${slot.id}-${dStr}@waqti.app`,
        `DTSTART:${toIcsDateTime(dStr, slot.startTime)}`,
        `DTEND:${toIcsDateTime(dStr, slot.endTime)}`,
        `SUMMARY:${subj?.name ?? 'Class'}`,
        `LOCATION:${slot.room || ''}`,
        'END:VEVENT'
      );
    }
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

export { endOfMonth, isAfter, isBefore, isSameDay, subMinutes };
