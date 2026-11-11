import { addDays, getISODay, parseISO } from 'date-fns';
import type { IsoWeekday, Language, WeekDay } from '../types';

const LOCALE_CODES: Record<Language, string> = {
  ar: 'ar-SA',
  fr: 'fr-FR',
  en: 'en-US',
};

/**
 * Unclipped short Arabic weekday names (without the "ال" article so they fit compactly on mobile
 * without ever clipping to 3-letter fragments like "ثلا", "أرب", "خمي").
 */
const ARABIC_SHORT_WEEKDAYS: Record<IsoWeekday, string> = {
  1: 'اثنين',
  2: 'ثلاثاء',
  3: 'أربعاء',
  4: 'خميس',
  5: 'جمعة',
  6: 'سبت',
  7: 'أحد',
};

const ARABIC_FULL_WEEKDAYS: Record<IsoWeekday, string> = {
  1: 'الاثنين',
  2: 'الثلاثاء',
  3: 'الأربعاء',
  4: 'الخميس',
  5: 'الجمعة',
  6: 'السبت',
  7: 'الأحد',
};

/**
 * Parses a "YYYY-MM-DD" date string safely at local noon using date-fns parseISO.
 * NEVER uses `new Date("YYYY-MM-DD")`.
 */
function parseLocalNoon(dateStr: string): Date {
  const clean = dateStr.trim().slice(0, 10);
  return parseISO(`${clean}T12:00:00`);
}

/**
 * Converts a Date or "YYYY-MM-DD" string into canonical ISO weekday (1..7, Monday=1, Sunday=7).
 */
export function fromDate(dateOrStr: Date | string): IsoWeekday {
  const d = typeof dateOrStr === 'string' ? parseLocalNoon(dateOrStr) : dateOrStr;
  const iso = getISODay(d);
  if (iso >= 1 && iso <= 7) {
    return iso as IsoWeekday;
  }
  return 1;
}

/**
 * Normalizes any weekday input (ISO 1..7, legacy JS getDay 0..6 where 0=Sunday, Date, or "YYYY-MM-DD")
 * into canonical ISO weekday (1..7, Monday=1 .. Sunday=7).
 */
export function toIsoWeekday(value: number | string | Date | null | undefined): IsoWeekday {
  if (value instanceof Date) {
    return fromDate(value);
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
      return fromDate(trimmed);
    }
    const asNum = Number(trimmed);
    if (!Number.isNaN(asNum)) {
      return toIsoWeekday(asNum);
    }
    return 1;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    const rounded = Math.round(value);
    // Legacy JS Sunday = 0 -> ISO Sunday = 7
    if (rounded === 0 || rounded === 7) return 7;
    if (rounded >= 1 && rounded <= 6) return rounded as IsoWeekday;
    const mod = ((rounded % 7) + 7) % 7;
    return (mod === 0 ? 7 : mod) as IsoWeekday;
  }
  return 1;
}

/**
 * Converts canonical ISO weekday (1..7) to date-fns / JS `weekStartsOn` index (0..6, Sunday=0)
 * strictly for date-fns `startOfWeek` grid boundary calculation.
 */
export function toDateFnsWeekStartsOn(isoDay: number): 0 | 1 | 2 | 3 | 4 | 5 | 6 {
  const canonical = toIsoWeekday(isoDay);
  return (canonical === 7 ? 0 : canonical) as 0 | 1 | 2 | 3 | 4 | 5 | 6;
}

/**
 * Returns the localized weekday label for a canonical ISO weekday (1..7) using Intl.DateTimeFormat,
 * ensuring Arabic weekday names are never truncated into awkward 3-letter fragments.
 */
export function labelFor(
  day: number,
  lang: Language = 'en',
  style: 'long' | 'short' | 'narrow' = 'long'
): string {
  const isoDay = toIsoWeekday(day);

  if (lang === 'ar') {
    if (style === 'short' || style === 'narrow') {
      return ARABIC_SHORT_WEEKDAYS[isoDay];
    }
    return ARABIC_FULL_WEEKDAYS[isoDay];
  }

  // Reference Monday: 2026-11-02 at 12:00 local time
  const refMonday = parseLocalNoon('2026-11-02');
  const targetDate = addDays(refMonday, isoDay - 1);

  try {
    const formatted = new Intl.DateTimeFormat(LOCALE_CODES[lang], {
      weekday: style,
    }).format(targetDate);
    // Strip trailing period in French short labels (e.g. "lun." -> "lun") for clean header pills
    return style === 'short' ? formatted.replace(/\.$/, '') : formatted;
  } catch {
    return ARABIC_FULL_WEEKDAYS[isoDay];
  }
}

/**
 * Returns the 7 canonical ISO weekdays (1..7) ordered for display according to `weekStart`.
 * `weekStart` ONLY affects the display order of this array, never stored data.
 */
export function getOrderedWeekdays(
  lang: Language,
  weekStart: WeekDay,
  formatPattern: 'EEEE' | 'EEE' | 'ccccc' | 'long' | 'short' | 'narrow' = 'EEE'
): {
  dayIndex: IsoWeekday;
  label: string;
  fullLabel: string;
  shortLabel: string;
}[] {
  const startIso = toIsoWeekday(weekStart);
  const style: 'long' | 'short' | 'narrow' =
    formatPattern === 'EEEE' || formatPattern === 'long'
      ? 'long'
      : formatPattern === 'ccccc' || formatPattern === 'narrow'
        ? 'narrow'
        : 'short';

  return Array.from({ length: 7 }, (_, offset) => {
    const dayIndex = (((startIso - 1 + offset) % 7) + 1) as IsoWeekday;
    const fullLabel = labelFor(dayIndex, lang, 'long');
    const shortLabel = labelFor(dayIndex, lang, 'short');
    const label = style === 'long' ? fullLabel : shortLabel;
    return {
      dayIndex,
      label,
      fullLabel,
      shortLabel,
    };
  });
}
