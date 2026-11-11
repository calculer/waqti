import {
  addDays,
  addMinutes,
  addMonths,
  differenceInCalendarDays,
  differenceInMinutes,
  endOfMonth,
  format,
  getDate,
  getISOWeek,
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
  AttendanceRecord,
  DeliveryMode,
  DigitsStyle,
  Exam,
  Habit,
  IsoWeekday,
  Language,
  MeetingPlatform,
  MissedAlarmItem,
  RevisionSession,
  SessionType,
  StudyTask,
  Subject,
  TimeFormat,
  TimetableSlot,
  WeekDay,
} from '../types';
import { formatDigits, formatTimeDisplay, t } from './i18n';
import {
  fromDate,
  getOrderedWeekdays,
  labelFor,
  toDateFnsWeekStartsOn,
  toIsoWeekday,
} from './weekdays';

export { fromDate, getOrderedWeekdays, labelFor, toDateFnsWeekStartsOn, toIsoWeekday };
export const getOrderedWeekDays = getOrderedWeekdays;

const DATE_FNS_LOCALES = {
  ar: arSA,
  fr: fr,
  en: enUS,
} as const;

/**
 * Detects browser timezone safely, falling back to Europe/Paris or Africa/Algiers if UTC/unavailable.
 */
export function detectTimezone(): string {
  try {
    const resolved = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (resolved && resolved !== 'UTC' && resolved !== 'Etc/UTC') {
      return resolved;
    }
    // Compute offset from local Date.getTimezoneOffset() if browser reports UTC despite offset
    const offsetMins = -new Date().getTimezoneOffset();
    if (offsetMins === 60) return 'Africa/Algiers';
    if (offsetMins === 120) return 'Africa/Cairo';
    if (offsetMins === 180) return 'Asia/Riyadh';
    return 'Africa/Algiers';
  } catch {
    return 'Africa/Algiers';
  }
}

/**
 * Formats the GMT offset for a specific "YYYY-MM-DD" date in the user's real timezone
 * (e.g. "GMT+1", "GMT+2", "GMT-8", "GMT") so DST transitions are reflected accurately per date.
 */
export function formatGmtOffsetForDate(dateStr: string, timeZone?: string): string {
  const effectiveTz =
    timeZone && timeZone !== 'UTC' ? timeZone : detectTimezone();
  const targetDate = parseLocalDateTime(dateStr, '12:00');

  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: effectiveTz,
      timeZoneName: 'shortOffset',
    }).formatToParts(targetDate);
    const tzPart = parts.find((p) => p.type === 'timeZoneName')?.value;
    if (tzPart) {
      // Normalize "GMT+01:00" -> "GMT+1", "GMT-05:00" -> "GMT-5", "GMT+05:30" -> "GMT+5:30"
      const normalized = tzPart
        .replace(/^UTC/, 'GMT')
        .replace(/([+-])0(\d)/, '$1$2')
        .replace(/:00$/, '');
      return normalized === 'GMT+0' || normalized === 'GMT-0' ? 'GMT' : normalized;
    }
  } catch {
    // Fallback to local Date offset
  }

  const offsetMinutes = -targetDate.getTimezoneOffset();
  if (offsetMinutes === 0) return 'GMT';
  const sign = offsetMinutes > 0 ? '+' : '-';
  const absMins = Math.abs(offsetMinutes);
  const hrs = Math.floor(absMins / 60);
  const mins = absMins % 60;
  return mins > 0
    ? `GMT${sign}${hrs}:${String(mins).padStart(2, '0')}`
    : `GMT${sign}${hrs}`;
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
  const cleanDate = dateStr.trim().slice(0, 10);
  const safeTime = /^\d{2}:\d{2}$/.test(timeStr) ? timeStr : '00:00';
  return parseISO(`${cleanDate}T${safeTime}:00`);
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
 * Detects overlapping timetable slots on the same canonical ISO day of the week (1..7).
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
  const candDay = toIsoWeekday(candidate.dayOfWeek);
  return existingSlots.filter((slot) => {
    if (candidate.id && slot.id === candidate.id) return false;
    if (toIsoWeekday(slot.dayOfWeek) !== candDay) return false;
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
    Math.min(
      100,
      Math.round(((windowMinutes - Math.min(windowMinutes, totalMinutes)) / windowMinutes) * 100)
    )
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
 * `weekStart` only controls display column ordering.
 */
export function getWeekDates(referenceDateStr: string, weekStart: WeekDay): string[] {
  const ref = parseLocalDateTime(referenceDateStr, '12:00');
  const start = startOfWeek(ref, { weekStartsOn: toDateFnsWeekStartsOn(weekStart) });
  return Array.from({ length: 7 }, (_, i) => format(addDays(start, i), 'yyyy-MM-dd'));
}

/**
 * Returns a 42-cell (6 weeks) calendar grid of "YYYY-MM-DD" strings for a month view.
 * `weekStart` only controls display column ordering.
 */
export function getMonthCalendarGrid(referenceDateStr: string, weekStart: WeekDay): string[] {
  const ref = parseLocalDateTime(referenceDateStr, '12:00');
  const monthStart = startOfMonth(ref);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: toDateFnsWeekStartsOn(weekStart) });
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
 * Gets the canonical ISO day of the week (1..7, Monday=1 .. Sunday=7) for a "YYYY-MM-DD" string.
 */
export function getWeekDayIndex(dateStr: string): IsoWeekday {
  return fromDate(dateStr);
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
  if (lang === 'ar' && pattern === 'EEE d') {
    const dayLbl = labelFor(fromDate(dateStr), 'ar', 'short');
    const dayNum = format(date, 'd', { locale: DATE_FNS_LOCALES.ar });
    return formatDigits(`${dayLbl} ${dayNum}`, lang, digitsStyle);
  }
  const raw = format(date, pattern, { locale: DATE_FNS_LOCALES[lang] });
  return formatDigits(raw, lang, digitsStyle);
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
export function computeRemainingTimerMs(
  timer: ActiveTimerState,
  nowMs: number = Date.now()
): number {
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

  for (
    let offset = 0;
    offset < daysBetween && sessions.length < Math.max(3, topics.length);
    offset++
  ) {
    const currentDate = addDays(start, offset);
    const dateStr = format(currentDate, 'yyyy-MM-dd');
    const dayOfWeek = fromDate(currentDate);
    const daySlots = getOccurrencesForDate(dateStr, existingSlots).map((occ) => occ.slot);

    const freeWindow = candidateWindows.find((win) => {
      const overlaps = detectSlotOverlaps(
        { dayOfWeek, startTime: win.startTime, endTime: win.endTime },
        daySlots
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
  const dayOfWeek = fromDate(dateStr);
  const normalizedDays = (alarm.daysOfWeek || []).map((d) => toIsoWeekday(d));
  if (alarm.recurrence === 'weekdays') {
    return normalizedDays.includes(dayOfWeek);
  }
  if (alarm.recurrence === 'weekly') {
    if (normalizedDays.length > 0) {
      return normalizedDays.includes(dayOfWeek);
    }
    const anchorDay = fromDate(alarm.date);
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

  // Detect relative date or canonical ISO weekday (1..7)
  let date = todayStr;
  if (/\b(tomorrow|demain)\b|غدا|غداً/i.test(text)) {
    date = shiftDateString(todayStr, 1);
  } else {
    const weekdayPatterns: { day: IsoWeekday; regex: RegExp }[] = [
      { day: 7, regex: /\b(sunday|dimanche)\b|الأحد|الاحد/i },
      { day: 1, regex: /\b(monday|lundi)\b|الاثنين|الإثنين/i },
      { day: 2, regex: /\b(tuesday|mardi)\b|الثلاثاء/i },
      { day: 3, regex: /\b(wednesday|mercredi)\b|الأربعاء|الاربعاء/i },
      { day: 4, regex: /\b(thursday|jeudi)\b|الخميس/i },
      { day: 5, regex: /\b(friday|vendredi)\b|الجمعة/i },
      { day: 6, regex: /\b(saturday|samedi)\b|السبت/i },
    ];
    for (const wp of weekdayPatterns) {
      if (wp.regex.test(text)) {
        const currentDow = fromDate(todayStr);
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
 * Checks whether a timetable slot occurs on a given "YYYY-MM-DD" date.
 * Always derives the canonical ISO weekday (1..7) directly from `dateStr` using `parseISO`/`date-fns`,
 * so `weekStart` settings can NEVER leak into occurrence matching.
 *
 * Handles:
 * - Single-occurrence `specificDate` and `excludedDates`
 * - Inclusive `semesterStart` and `semesterEnd`
 * - `weekly` and `biweekly` (every-2-weeks) recurrence anchored to `semesterStart` when present
 * - `weekParity` (`odd` / `even`)
 */
export function isSlotActiveOnDate(
  slot: TimetableSlot,
  dateStr: string,
  _legacyIgnoredDay?: number
): boolean {
  if (slot.excludedDates && slot.excludedDates.includes(dateStr)) {
    return false;
  }

  // Single-occurrence override/addition
  if (slot.specificDate) {
    return slot.specificDate === dateStr;
  }

  const targetIsoDay = fromDate(dateStr);
  const slotIsoDay = toIsoWeekday(slot.dayOfWeek);
  if (slotIsoDay !== targetIsoDay) {
    return false;
  }

  // Inclusive series start / end boundaries
  if (slot.semesterStart && dateStr < slot.semesterStart) {
    return false;
  }
  if (slot.semesterEnd && dateStr > slot.semesterEnd) {
    return false;
  }

  const targetDate = parseLocalDateTime(dateStr, '12:00');

  // Odd / Even week parity check
  if (slot.weekParity && slot.weekParity !== 'all') {
    if (slot.semesterStart) {
      const anchorMonday = startOfWeek(parseLocalDateTime(slot.semesterStart, '12:00'), {
        weekStartsOn: 1,
      });
      const targetMonday = startOfWeek(targetDate, { weekStartsOn: 1 });
      const weekNumberFromStart =
        Math.floor(differenceInCalendarDays(targetMonday, anchorMonday) / 7) + 1;
      const isOdd = Math.abs(weekNumberFromStart) % 2 === 1;
      if (slot.weekParity === 'odd' && !isOdd) return false;
      if (slot.weekParity === 'even' && isOdd) return false;
    } else {
      const isoWk = getISOWeek(targetDate);
      const isOdd = isoWk % 2 === 1;
      if (slot.weekParity === 'odd' && !isOdd) return false;
      if (slot.weekParity === 'even' && isOdd) return false;
    }
    return true;
  }

  // Biweekly (every-2-weeks) recurrence anchored to semesterStart (or ISO week if no semesterStart)
  if (slot.recurrence === 'biweekly') {
    if (slot.semesterStart) {
      const anchorMonday = startOfWeek(parseLocalDateTime(slot.semesterStart, '12:00'), {
        weekStartsOn: 1,
      });
      const targetMonday = startOfWeek(targetDate, { weekStartsOn: 1 });
      const weeksElapsed = Math.floor(differenceInCalendarDays(targetMonday, anchorMonday) / 7);
      if (Math.abs(weeksElapsed) % 2 !== 0) return false;
    } else {
      const isoWk = getISOWeek(targetDate);
      if (isoWk % 2 !== 0) return false;
    }
  }

  return true;
}

export interface OccurrenceItem {
  id: string;
  kind: 'class' | 'exam' | 'task' | 'habit' | 'alarm';
  date: string; // "YYYY-MM-DD"
  dayOfWeek: IsoWeekday;
  title: string;
  startTime: string;
  endTime: string;
  subjectId?: string;
  colorId: string;
  room?: string;
  teacher?: string;
  countdownLabel?: string;
  sessionType?: SessionType;
  type: SessionType;
  deliveryMode?: DeliveryMode;
  mode: DeliveryMode;
  section?: string;
  group?: string;
  meetingUrl?: string;
  platform?: MeetingPlatform;
  slotId?: string;
  slot: TimetableSlot;
  doneOnDay?: boolean;
}

export interface OccurrencesSourceOptions {
  timetable?: TimetableSlot[];
  subjects?: Subject[];
  exams?: Exam[];
  tasks?: StudyTask[];
  habits?: Habit[];
  alarms?: AlarmReminder[];
  weekStart?: WeekDay;
  filters?: {
    classes?: boolean;
    exams?: boolean;
    tasks?: boolean;
    habits?: boolean;
    alarms?: boolean;
  };
  filterSessionType?: 'all' | SessionType;
  filterDeliveryMode?: 'all' | DeliveryMode;
  includeAllEvents?: boolean;
  lang?: Language;
  timeFormat?: TimeFormat;
  digitsStyle?: DigitsStyle;
  now?: Date;
}

export type OccurrencesResultArray = OccurrenceItem[] & {
  classes: OccurrenceItem[];
  exams: OccurrenceItem[];
  tasks: OccurrenceItem[];
  habits: OccurrenceItem[];
  alarms: OccurrenceItem[];
  all: OccurrenceItem[];
};

let defaultOccurrenceSourceGetter: (() => OccurrencesSourceOptions) | null = null;

/**
 * Registers a default state getter from the store so `getOccurrencesForDate(dateString)`
 * can also be called with a single argument anywhere in the app or tests.
 */
export function registerDefaultOccurrenceSource(
  getter: () => OccurrencesSourceOptions
): void {
  defaultOccurrenceSourceGetter = getter;
}

/**
 * Single source of truth for all occurrences on a given "YYYY-MM-DD" date.
 * Used across Month view, Week view, Day view, Agenda, Weekly Timetable, Dashboard, Alarms, Statistics, and .ics export.
 *
 * `weekStart` (if passed in options) NEVER affects which classes or events match `dateString`.
 */
export function getOccurrencesForDate(
  dateString: string,
  source?: TimetableSlot[] | OccurrencesSourceOptions
): OccurrencesResultArray {
  const resolvedSource: OccurrencesSourceOptions = Array.isArray(source)
    ? { timetable: source }
    : source ?? (defaultOccurrenceSourceGetter ? defaultOccurrenceSourceGetter() : {});

  const timetable = resolvedSource.timetable ?? [];
  const subjects = resolvedSource.subjects ?? [];
  const exams = resolvedSource.exams ?? [];
  const tasks = resolvedSource.tasks ?? [];
  const habits = resolvedSource.habits ?? [];
  const alarms = resolvedSource.alarms ?? [];
  const filters = resolvedSource.filters ?? {
    classes: true,
    exams: true,
    tasks: true,
    habits: true,
    alarms: true,
  };
  const filterSessionType = resolvedSource.filterSessionType ?? 'all';
  const filterDeliveryMode = resolvedSource.filterDeliveryMode ?? 'all';
  const lang = resolvedSource.lang ?? 'en';
  const timeFormat = resolvedSource.timeFormat ?? '24h';
  const digitsStyle = resolvedSource.digitsStyle ?? 'western';
  const now = resolvedSource.now ?? new Date();

  const dow = fromDate(dateString);

  // 1. Classes
  const classItems: OccurrenceItem[] = [];
  if (filters.classes !== false) {
    for (const sl of timetable) {
      if (!isSlotActiveOnDate(sl, dateString)) continue;
      const slType: SessionType = sl.type ?? 'lecture';
      const slMode: DeliveryMode = sl.mode ?? 'in_person';
      if (filterSessionType !== 'all' && slType !== filterSessionType) continue;
      if (filterDeliveryMode !== 'all' && slMode !== filterDeliveryMode) continue;

      const subj = subjects.find((s) => s.id === sl.subjectId);
      classItems.push({
        id: `class-${sl.id}-${dateString}`,
        kind: 'class',
        date: dateString,
        dayOfWeek: dow,
        title: subj?.name ?? 'Class',
        startTime: sl.startTime,
        endTime: sl.endTime,
        subjectId: sl.subjectId,
        colorId: sl.customColor ?? subj?.color ?? 'honey',
        room: sl.room,
        teacher: sl.teacher,
        sessionType: slType,
        type: slType,
        deliveryMode: slMode,
        mode: slMode,
        section: sl.section,
        group: sl.group,
        meetingUrl: sl.meetingUrl,
        platform: sl.platform,
        slotId: sl.id,
        slot: {
          ...sl,
          dayOfWeek: toIsoWeekday(sl.dayOfWeek),
          type: slType,
          mode: slMode,
        },
      });
    }
    classItems.sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
  }

  // 2. Exams
  const examItems: OccurrenceItem[] = [];
  if (filters.exams !== false) {
    for (const ex of exams) {
      if (ex.date !== dateString) continue;
      const subj = subjects.find((s) => s.id === ex.subjectId);
      const endMins = timeToMinutes(ex.startTime) + (ex.durationMinutes || 90);
      const endH = String(Math.min(23, Math.floor(endMins / 60))).padStart(2, '0');
      const endM = String(endMins % 60).padStart(2, '0');
      const cd = computeExamCountdown(
        ex.date,
        ex.startTime,
        now,
        lang,
        timeFormat,
        digitsStyle
      );
      const exMode: DeliveryMode = ex.mode ?? 'in_person';
      const exType: SessionType = ex.sessionType ?? 'other';
      examItems.push({
        id: `exam-${ex.id}`,
        kind: 'exam',
        date: dateString,
        dayOfWeek: dow,
        title: ex.title,
        startTime: ex.startTime,
        endTime: `${endH}:${endM}`,
        subjectId: ex.subjectId,
        colorId: subj?.color ?? 'terracotta',
        room: ex.room,
        countdownLabel: cd.label,
        sessionType: exType,
        type: exType,
        deliveryMode: exMode,
        mode: exMode,
        meetingUrl: ex.meetingUrl,
        platform: ex.platform,
        slot: {
          id: ex.id,
          subjectId: ex.subjectId,
          dayOfWeek: dow,
          startTime: ex.startTime,
          endTime: `${endH}:${endM}`,
          room: ex.room,
          teacher: '',
          recurrence: 'custom',
          specificDate: dateString,
        },
      });
    }
  }

  // 3. Tasks
  const taskItems: OccurrenceItem[] = [];
  if (filters.tasks !== false) {
    for (const tk of tasks) {
      if (tk.dueDate !== dateString) continue;
      const subj = subjects.find((s) => s.id === tk.subjectId);
      const startMins = timeToMinutes(tk.dueTime || '18:00');
      const endMins = Math.min(23 * 60 + 59, startMins + 45);
      const endT = `${String(Math.floor(endMins / 60)).padStart(2, '0')}:${String(
        endMins % 60
      ).padStart(2, '0')}`;
      taskItems.push({
        id: `task-${tk.id}`,
        kind: 'task',
        date: dateString,
        dayOfWeek: dow,
        title: tk.title,
        startTime: tk.dueTime || '18:00',
        endTime: endT,
        subjectId: tk.subjectId,
        colorId: subj?.color ?? 'amber',
        type: 'other',
        mode: 'in_person',
        slot: {
          id: tk.id,
          subjectId: tk.subjectId,
          dayOfWeek: dow,
          startTime: tk.dueTime || '18:00',
          endTime: endT,
          room: '',
          teacher: '',
          recurrence: 'custom',
          specificDate: dateString,
        },
      });
    }
  }

  // 4. Habits
  const habitItems: OccurrenceItem[] = [];
  if (filters.habits !== false) {
    for (const hb of habits) {
      const targetIsoDays = (hb.targetDays || []).map((d) => toIsoWeekday(d));
      const matchesDay =
        hb.frequencyType === 'daily' ||
        targetIsoDays.length === 0 ||
        targetIsoDays.includes(dow);
      if (!matchesDay) continue;
      const startT = hb.reminderTimes?.[0] || '20:00';
      const startMins = timeToMinutes(startT);
      const endMins = Math.min(23 * 60 + 59, startMins + 30);
      const endT = `${String(Math.floor(endMins / 60)).padStart(2, '0')}:${String(
        endMins % 60
      ).padStart(2, '0')}`;
      habitItems.push({
        id: `habit-${hb.id}-${dateString}`,
        kind: 'habit',
        date: dateString,
        dayOfWeek: dow,
        title: hb.name,
        startTime: startT,
        endTime: endT,
        colorId: hb.color ?? 'sage',
        type: 'other',
        mode: 'in_person',
        doneOnDay: hb.completedDates.includes(dateString),
        slot: {
          id: hb.id,
          subjectId: '',
          dayOfWeek: dow,
          startTime: startT,
          endTime: endT,
          room: '',
          teacher: '',
          recurrence: 'weekly',
        },
      });
    }
  }

  // 5. Alarms
  const alarmItems: OccurrenceItem[] = [];
  if (filters.alarms !== false) {
    for (const al of alarms) {
      if (!doesAlarmMatchDate(al, dateString)) continue;
      const startMins = timeToMinutes(al.time);
      const endMins = Math.min(23 * 60 + 59, startMins + 30);
      const endT = `${String(Math.floor(endMins / 60)).padStart(2, '0')}:${String(
        endMins % 60
      ).padStart(2, '0')}`;
      alarmItems.push({
        id: `alarm-${al.id}-${dateString}`,
        kind: 'alarm',
        date: dateString,
        dayOfWeek: dow,
        title: al.title,
        startTime: al.time,
        endTime: endT,
        colorId: 'honey',
        type: al.sessionType ?? 'other',
        mode: al.mode ?? 'in_person',
        meetingUrl: al.meetingUrl,
        platform: al.platform,
        slot: {
          id: al.id,
          subjectId: '',
          dayOfWeek: dow,
          startTime: al.time,
          endTime: endT,
          room: '',
          teacher: '',
          recurrence: 'custom',
          specificDate: dateString,
        },
      });
    }
  }

  const allItems = [
    ...examItems,
    ...classItems,
    ...taskItems,
    ...alarmItems,
    ...habitItems,
  ].sort((a, b) => a.startTime.localeCompare(b.startTime));

  const baseArray = resolvedSource.includeAllEvents ? [...allItems] : [...classItems];
  return Object.assign(baseArray, {
    classes: classItems,
    exams: examItems,
    tasks: taskItems,
    habits: habitItems,
    alarms: alarmItems,
    all: allItems,
  });
}

/**
 * Generates an RFC 5545 `.ics` iCalendar string for classes, exams, and tasks using `getOccurrencesForDate`.
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

  // Export current week's classes using getOccurrencesForDate as the single source of truth
  const weekDates = getWeekDates(todayStr, 1);
  for (const dStr of weekDates) {
    const dayOccurrences = getOccurrencesForDate(dStr, { timetable, subjects }).classes;
    for (const occ of dayOccurrences) {
      const slot = occ.slot;
      const subj = subjects.find((s) => s.id === slot.subjectId);
      const typeTag = (slot.type || 'lecture').toUpperCase();
      const modeTag = slot.mode || 'in_person';
      const locationStr =
        modeTag === 'remote'
          ? slot.meetingUrl || 'Online'
          : modeTag === 'hybrid'
            ? [slot.room, slot.meetingUrl].filter(Boolean).join(' / ') || 'Hybrid'
            : slot.room || '';
      const descParts = [
        `Type: ${typeTag}`,
        `Mode: ${modeTag}`,
        slot.section ? `Section: ${slot.section}` : '',
        slot.group ? `Group: ${slot.group}` : '',
        slot.teacher ? `Teacher: ${slot.teacher}` : '',
        slot.room ? `Room: ${slot.room}` : '',
        slot.meetingUrl ? `Meeting Link: ${slot.meetingUrl}` : '',
      ].filter(Boolean);

      lines.push(
        'BEGIN:VEVENT',
        `UID:waqti-slot-${slot.id}-${dStr}@waqti.app`,
        `DTSTART:${toIcsDateTime(dStr, slot.startTime)}`,
        `DTEND:${toIcsDateTime(dStr, slot.endTime)}`,
        `SUMMARY:[${typeTag}] ${subj?.name ?? 'Class'}${slot.group ? ` (G${slot.group})` : ''}`,
        `LOCATION:${locationStr}`,
        `DESCRIPTION:${descParts.join('\\n')}`,
        'END:VEVENT'
      );
    }
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

/**
 * Computes the start and end hour for the Weekly Timetable vertical time axis.
 */
export function computeTimetableGridHours(
  slots: TimetableSlot[],
  autoFit: boolean = true,
  customStartHour: number = 7,
  customEndHour: number = 20
): { startHour: number; endHour: number; hours: number[] } {
  if (!autoFit || slots.length === 0) {
    const s = Math.max(0, Math.min(21, customStartHour));
    const e = Math.max(s + 4, Math.min(24, customEndHour));
    const hours = Array.from({ length: e - s + 1 }, (_, i) => s + i);
    return { startHour: s, endHour: e, hours };
  }

  let minMin = 24 * 60;
  let maxMin = 0;
  for (const slot of slots) {
    const s = timeToMinutes(slot.startTime);
    const e = timeToMinutes(slot.endTime);
    if (s < minMin) minMin = s;
    if (e > maxMin) maxMin = e;
  }

  let startHour = Math.max(5, Math.min(8, Math.floor(minMin / 60) - 1));
  let endHour = Math.min(23, Math.max(18, Math.ceil(maxMin / 60) + 1));
  if (endHour - startHour < 10) {
    endHour = Math.min(23, startHour + 10);
  }

  const hours = Array.from({ length: endHour - startHour + 1 }, (_, i) => startHour + i);
  return { startHour, endHour, hours };
}

/**
 * Computes exact vertical offset (`topPx`), proportional block height (`heightPx`, minimum `minHeightPx`),
 * and duration in minutes for a class block inside the time grid.
 */
export function computeTimetableBlockMetrics(
  startTime: string,
  endTime: string,
  gridStartHour: number,
  pixelsPerHour: number = 68,
  minHeightPx: number = 40
): { topPx: number; heightPx: number; durationMinutes: number } {
  const startMin = timeToMinutes(startTime);
  const endMin = timeToMinutes(endTime);
  const durationMinutes = Math.max(15, endMin - startMin);
  const offsetMinutes = Math.max(0, startMin - gridStartHour * 60);
  const pxPerMin = pixelsPerHour / 60;
  const topPx = Math.round(offsetMinutes * pxPerMin);
  const heightPx = Math.max(minHeightPx, Math.round(durationMinutes * pxPerMin));
  return { topPx, heightPx, durationMinutes };
}

/**
 * Snaps a raw minute count to the nearest `step` (default 5 minutes) and clamps within `[minMins, maxMins]`.
 */
export function snapMinutesToStep(
  rawMinutes: number,
  step: number = 5,
  minMins: number = 0,
  maxMins: number = 24 * 60 - 5
): number {
  const snapped = Math.round(rawMinutes / step) * step;
  return Math.max(minMins, Math.min(maxMins, snapped));
}

/**
 * Formats a time-shift pill label using Western numerals (`0-9`) and localized short unit
 * ("min" / "د" / "min") in a single nowrap string (e.g. "-15 min", "+30 د").
 */
export function formatShiftPillLabel(deltaMinutes: number, lang: Language): string {
  const sign = deltaMinutes > 0 ? '+' : '';
  const unit = lang === 'ar' ? 'د' : 'min';
  return `${sign}${deltaMinutes} ${unit}`;
}

/**
 * Determines whether a timetable block at `blockWidthPx` is too narrow for the full
 * "HH:mm – HH:mm" range and should display only the start time on the surface (with full range in tooltip).
 */
export function shouldShowCompactTimeOnly(blockWidthPx: number): boolean {
  return blockWidthPx < 116;
}

/**
 * Computes weekly summary statistics for the active 7-day week using `getOccurrencesForDate`:
 * - Total class hours
 * - Busiest day index & hours
 * - Count of available 90-minute daytime study windows (08:00–20:00)
 */
export function computeWeeklyTimetableSummary(
  slots: TimetableSlot[],
  weekDates: string[]
): {
  totalHours: number;
  busiestDayIndex: WeekDay | null;
  busiestDayHours: number;
  freeSlotsCount: number;
} {
  let totalMinutes = 0;
  let busiestDayIndex: WeekDay | null = null;
  let busiestDayMinutes = 0;
  let freeSlotsCount = 0;

  const candidateStudyWindows = [
    { start: 8 * 60 + 30, end: 10 * 60 },
    { start: 10 * 60 + 30, end: 12 * 60 },
    { start: 14 * 60, end: 15 * 60 + 30 },
    { start: 16 * 60, end: 17 * 60 + 30 },
    { start: 18 * 60, end: 19 * 60 + 30 },
  ];

  for (const dStr of weekDates) {
    const dow = fromDate(dStr);
    const activeDaySlots = getOccurrencesForDate(dStr, slots).map((o) => o.slot);

    let dayMins = 0;
    for (const s of activeDaySlots) {
      const dur = Math.max(0, timeToMinutes(s.endTime) - timeToMinutes(s.startTime));
      dayMins += dur;
    }

    totalMinutes += dayMins;
    if (dayMins > busiestDayMinutes) {
      busiestDayMinutes = dayMins;
      busiestDayIndex = dow;
    }

    for (const win of candidateStudyWindows) {
      const hasConflict = activeDaySlots.some((s) => {
        const sMin = timeToMinutes(s.startTime);
        const eMin = timeToMinutes(s.endTime);
        return win.start < eMin && sMin < win.end;
      });
      if (!hasConflict) {
        freeSlotsCount += 1;
      }
    }
  }

  return {
    totalHours: Number((totalMinutes / 60).toFixed(1)),
    busiestDayIndex,
    busiestDayHours: Number((busiestDayMinutes / 60).toFixed(1)),
    freeSlotsCount,
  };
}

/**
 * Computes weekly class hours and attendance rates split by SessionType (lecture/td/tp/other)
 * and DeliveryMode (in_person/remote/hybrid).
 */
export function computeStatsByTypeAndMode(
  slots: TimetableSlot[],
  attendance: AttendanceRecord[],
  referenceWeekDates?: string[]
): {
  hoursByType: Record<SessionType, number>;
  hoursByMode: Record<DeliveryMode, number>;
  attendanceByType: Record<SessionType, { attended: number; total: number; rate: number | null }>;
  attendanceByMode: Record<DeliveryMode, { attended: number; total: number; rate: number | null }>;
} {
  const minsByType: Record<SessionType, number> = {
    lecture: 0,
    td: 0,
    tp: 0,
    other: 0,
  };
  const minsByMode: Record<DeliveryMode, number> = {
    in_person: 0,
    remote: 0,
    hybrid: 0,
  };

  const slotMap = new Map<string, TimetableSlot>();
  for (const s of slots) {
    slotMap.set(s.id, s);
  }

  const effectiveSlots =
    referenceWeekDates && referenceWeekDates.length === 7
      ? referenceWeekDates.flatMap((dStr) =>
          getOccurrencesForDate(dStr, slots).map((o) => o.slot)
        )
      : slots;

  for (const s of effectiveSlots) {
    const dur = Math.max(0, timeToMinutes(s.endTime) - timeToMinutes(s.startTime));
    const st: SessionType = s.type || 'lecture';
    const md: DeliveryMode = s.mode || 'in_person';
    minsByType[st] = (minsByType[st] || 0) + dur;
    minsByMode[md] = (minsByMode[md] || 0) + dur;
  }

  const attByType: Record<SessionType, { attended: number; total: number; rate: number | null }> = {
    lecture: { attended: 0, total: 0, rate: null },
    td: { attended: 0, total: 0, rate: null },
    tp: { attended: 0, total: 0, rate: null },
    other: { attended: 0, total: 0, rate: null },
  };
  const attByMode: Record<DeliveryMode, { attended: number; total: number; rate: number | null }> = {
    in_person: { attended: 0, total: 0, rate: null },
    remote: { attended: 0, total: 0, rate: null },
    hybrid: { attended: 0, total: 0, rate: null },
  };

  for (const rec of attendance) {
    if (rec.status === 'cancelled') continue;
    const slot = slotMap.get(rec.slotId);
    const st: SessionType = slot?.type || 'lecture';
    const md: DeliveryMode = slot?.mode || 'in_person';

    attByType[st].total += 1;
    attByMode[md].total += 1;
    if (rec.status === 'attended') {
      attByType[st].attended += 1;
      attByMode[md].attended += 1;
    }
  }

  for (const k of ['lecture', 'td', 'tp', 'other'] as const) {
    if (attByType[k].total > 0) {
      attByType[k].rate = Math.round((attByType[k].attended / attByType[k].total) * 100);
    }
  }
  for (const m of ['in_person', 'remote', 'hybrid'] as const) {
    if (attByMode[m].total > 0) {
      attByMode[m].rate = Math.round((attByMode[m].attended / attByMode[m].total) * 100);
    }
  }

  return {
    hoursByType: {
      lecture: Number((minsByType.lecture / 60).toFixed(1)),
      td: Number((minsByType.td / 60).toFixed(1)),
      tp: Number((minsByType.tp / 60).toFixed(1)),
      other: Number((minsByType.other / 60).toFixed(1)),
    },
    hoursByMode: {
      in_person: Number((minsByMode.in_person / 60).toFixed(1)),
      remote: Number((minsByMode.remote / 60).toFixed(1)),
      hybrid: Number((minsByMode.hybrid / 60).toFixed(1)),
    },
    attendanceByType: attByType,
    attendanceByMode: attByMode,
  };
}

export { endOfMonth, isAfter, isBefore, isSameDay, subMinutes };
