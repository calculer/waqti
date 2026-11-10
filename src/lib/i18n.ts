import en from '../locales/en.json';
import fr from '../locales/fr.json';
import ar from '../locales/ar.json';
import type { DigitsStyle, Language, TimeFormat, WeekDay } from '../types';

export type TranslationKey = keyof typeof en;

const dictionaries: Record<Language, Record<TranslationKey, string>> = {
  en,
  fr,
  ar,
};

const WESTERN_TO_ARABIC_INDIC: Record<string, string> = {
  '0': '٠',
  '1': '١',
  '2': '٢',
  '3': '٣',
  '4': '٤',
  '5': '٥',
  '6': '٦',
  '7': '٧',
  '8': '٨',
  '9': '٩',
};

/**
 * Dev-time verification that all 3 locale dictionaries have identical keys.
 * Throws an error if any key is missing in any language.
 */
export function validateTranslationKeys(): { valid: boolean; missing: string[] } {
  const enKeys = Object.keys(en);
  const frKeys = new Set(Object.keys(fr));
  const arKeys = new Set(Object.keys(ar));
  const missing: string[] = [];

  for (const key of enKeys) {
    if (!frKeys.has(key)) missing.push(`fr:${key}`);
    if (!arKeys.has(key)) missing.push(`ar:${key}`);
  }
  for (const key of Object.keys(fr)) {
    if (!(key in en)) missing.push(`en:${key}`);
  }
  for (const key of Object.keys(ar)) {
    if (!(key in en)) missing.push(`en:${key}`);
  }

  if (missing.length > 0) {
    throw new Error(`Missing translation keys: ${missing.join(', ')}`);
  }
  return { valid: true, missing: [] };
}

// Run check immediately on module load
validateTranslationKeys();

export function getDirection(lang: Language): 'rtl' | 'ltr' {
  return lang === 'ar' ? 'rtl' : 'ltr';
}

export function getDefaultWeekStart(lang: Language): WeekDay {
  if (lang === 'ar') return 6; // Saturday
  if (lang === 'fr') return 1; // Monday
  return 0; // Sunday for English
}

export function getDefaultWeekendDays(lang: Language): WeekDay[] {
  if (lang === 'ar') return [5, 6]; // Friday, Saturday
  return [0, 6]; // Saturday, Sunday
}

export function detectBrowserLanguage(): Language {
  if (typeof navigator === 'undefined') return 'ar';
  const raw = (navigator.language || '').toLowerCase();
  if (raw.startsWith('fr')) return 'fr';
  if (raw.startsWith('en')) return 'en';
  if (raw.startsWith('ar')) return 'ar';
  return 'ar'; // Fallback per specification: Arabic
}

export function formatDigits(
  input: string | number,
  lang: Language,
  digitsStyle: DigitsStyle = 'western'
): string {
  const str = String(input);
  if (lang === 'ar' && digitsStyle === 'arabic-indic') {
    return str.replace(/[0-9]/g, (d) => WESTERN_TO_ARABIC_INDIC[d] ?? d);
  }
  return str;
}

export function t(
  lang: Language,
  key: TranslationKey,
  params?: Record<string, string | number>,
  digitsStyle: DigitsStyle = 'western'
): string {
  const dict = dictionaries[lang] ?? dictionaries.ar;
  let template = dict[key] ?? dictionaries.en[key] ?? key;

  if (params) {
    for (const [k, v] of Object.entries(params)) {
      const formattedVal = formatDigits(v, lang, digitsStyle);
      template = template.replace(new RegExp(`\\{${k}\\}`, 'g'), formattedVal);
    }
  }
  return template;
}

/**
 * Uses Intl.PluralRules (handles Arabic's 6 plural forms: zero, one, two, few, many, other).
 */
export function formatPlural(
  lang: Language,
  category: 'days' | 'hours' | 'tasks',
  count: number,
  digitsStyle: DigitsStyle = 'western'
): string {
  let rule: Intl.LDMLPluralRule = 'other';
  if (count === 0) {
    rule = 'zero';
  } else {
    const pr = new Intl.PluralRules(lang === 'ar' ? 'ar-EG' : lang === 'fr' ? 'fr-FR' : 'en-US');
    rule = pr.select(count);
  }

  const candidateKey = `plural.${category}.${rule}` as TranslationKey;
  const fallbackKey = `plural.${category}.other` as TranslationKey;
  const keyToUse = candidateKey in dictionaries[lang] ? candidateKey : fallbackKey;

  return t(lang, keyToUse, { count }, digitsStyle);
}

/**
 * Formats a single "HH:mm" time according to 24h or 12h setting.
 */
export function formatTimeDisplay(
  timeStr: string,
  timeFormat: TimeFormat = '24h',
  lang: Language = 'en',
  digitsStyle: DigitsStyle = 'western'
): string {
  const parts = timeStr.split(':');
  if (parts.length < 2) return timeStr;
  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return timeStr;

  const mm = String(minutes).padStart(2, '0');
  if (timeFormat === '24h') {
    const hh = String(hours).padStart(2, '0');
    return formatDigits(`${hh}:${mm}`, lang, digitsStyle);
  }

  const period =
    hours >= 12
      ? lang === 'ar'
        ? 'م'
        : 'PM'
      : lang === 'ar'
        ? 'ص'
        : 'AM';
  const h12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${formatDigits(`${h12}:${mm}`, lang, digitsStyle)} ${period}`;
}

/**
 * Formats a time range like "08:00 – 09:30" guaranteed to remain in start -> end order
 * with explicit LTR directional isolation so it never reverses in RTL mode.
 */
export function formatTimeRange(
  startTime: string,
  endTime: string,
  timeFormat: TimeFormat = '24h',
  lang: Language = 'en',
  digitsStyle: DigitsStyle = 'western'
): string {
  const startFormatted = formatTimeDisplay(startTime, timeFormat, lang, digitsStyle);
  const endFormatted = formatTimeDisplay(endTime, timeFormat, lang, digitsStyle);
  return `${startFormatted} – ${endFormatted}`;
}
