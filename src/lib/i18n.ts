import en from '../locales/en.json';
import fr from '../locales/fr.json';
import ar from '../locales/ar.json';
import type { DigitsStyle, Language, TimeFormat, WeekDay } from '../types';

export type TranslationSchema = typeof en;

export const dictionaries: Record<Language, TranslationSchema> = {
  en,
  fr,
  ar,
};

export const LANGUAGE_META: Record<
  Language,
  { nativeName: string; dir: 'ltr' | 'rtl'; localeCode: string }
> = {
  ar: { nativeName: 'العربية', dir: 'rtl', localeCode: 'ar-SA' },
  fr: { nativeName: 'Français', dir: 'ltr', localeCode: 'fr-FR' },
  en: { nativeName: 'English', dir: 'ltr', localeCode: 'en-US' },
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

export function detectBrowserLanguage(): Language {
  if (typeof navigator === 'undefined') return 'ar';
  const lang = (navigator.language || '').toLowerCase();
  if (lang.startsWith('ar')) return 'ar';
  if (lang.startsWith('fr')) return 'fr';
  if (lang.startsWith('en')) return 'en';
  return 'ar';
}

export function getDirection(lang: Language): 'ltr' | 'rtl' {
  return lang === 'ar' ? 'rtl' : 'ltr';
}

export function getDefaultWeekStart(lang: Language): WeekDay {
  if (lang === 'ar') return 6; // Saturday (ISO 6)
  if (lang === 'fr') return 1; // Monday (ISO 1)
  return 7; // Sunday (ISO 7)
}

export function getDefaultWeekendDays(lang: Language): WeekDay[] {
  if (lang === 'ar') return [5, 6]; // Friday (5), Saturday (6)
  return [6, 7]; // Saturday (6), Sunday (7)
}

export function formatDigits(
  input: string | number,
  lang: Language,
  digitsStyle: DigitsStyle = 'western'
): string {
  const str = String(input);
  if (lang !== 'ar' || digitsStyle !== 'arabic-indic') {
    return str;
  }
  return str.replace(/[0-9]/g, (d) => WESTERN_TO_ARABIC_INDIC[d] ?? d);
}

export function formatTimeDisplay(
  timeStr: string,
  timeFormat: TimeFormat = '24h',
  lang: Language = 'en',
  digitsStyle: DigitsStyle = 'western'
): string {
  const [hRaw, mRaw] = timeStr.split(':');
  const h = parseInt(hRaw ?? '0', 10);
  const m = parseInt(mRaw ?? '0', 10);
  if (Number.isNaN(h) || Number.isNaN(m)) return timeStr;

  const padM = String(m).padStart(2, '0');
  if (timeFormat === '24h') {
    const out = `${String(h).padStart(2, '0')}:${padM}`;
    return formatDigits(out, lang, digitsStyle);
  }

  const period =
    h >= 12
      ? lang === 'ar'
        ? 'م'
        : 'PM'
      : lang === 'ar'
        ? 'ص'
        : 'AM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  const out = `${hour12}:${padM} ${period}`;
  return formatDigits(out, lang, digitsStyle);
}

export function formatTimeRange(
  startTime: string,
  endTime: string,
  timeFormat: TimeFormat = '24h',
  lang: Language = 'en',
  digitsStyle: DigitsStyle = 'western'
): string {
  const start = formatTimeDisplay(startTime, timeFormat, lang, digitsStyle);
  const end = formatTimeDisplay(endTime, timeFormat, lang, digitsStyle);
  return `${start} – ${end}`;
}

export function getNestedTranslation(
  dict: Record<string, unknown>,
  path: string,
  params?: Record<string, string | number>,
  lang: Language = 'en',
  digitsStyle: DigitsStyle = 'western'
): string {
  let current: unknown;

  if (path in dict) {
    current = dict[path];
  } else {
    const keys = path.split('.');
    current = dict;
    for (const key of keys) {
      if (current && typeof current === 'object' && key in (current as Record<string, unknown>)) {
        current = (current as Record<string, unknown>)[key];
      } else {
        return path;
      }
    }
  }

  if (typeof current !== 'string') {
    return path;
  }

  let output = current;
  if (params) {
    output = Object.entries(params).reduce((acc, [k, v]) => {
      return acc.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
    }, output);
  }

  return formatDigits(output, lang, digitsStyle);
}

export function t(
  lang: Language,
  key: string,
  params?: Record<string, string | number>,
  digitsStyle: DigitsStyle = 'western'
): string {
  const dict = dictionaries[lang] as unknown as Record<string, unknown>;
  return getNestedTranslation(dict, key, params, lang, digitsStyle);
}

/**
 * Formats pluralized strings properly for Arabic (zero, one, two, few 3-10, many 11-99, other),
 * French, and English using Intl.PluralRules.
 */
export function formatPlural(
  lang: Language,
  category: 'days' | 'hours' | 'tasks' | 'alarms',
  count: number,
  digitsStyle: DigitsStyle = 'western'
): string {
  const dict = dictionaries[lang] as unknown as Record<string, string>;
  const rules = new Intl.PluralRules(lang);
  const pluralCategory = count === 0 ? 'zero' : rules.select(count);
  const formattedNumber = formatDigits(count, lang, digitsStyle);

  const targetKey = `plural.${category}.${pluralCategory}`;
  const fallbackKey = `plural.${category}.other`;
  const template = dict[targetKey] ?? dict[fallbackKey] ?? '{count}';

  return formatDigits(template.replace('{count}', formattedNumber), lang, digitsStyle);
}

function collectLeafPaths(obj: Record<string, unknown>, prefix = ''): string[] {
  const keys: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    const full = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      keys.push(...collectLeafPaths(v as Record<string, unknown>, full));
    } else {
      keys.push(full);
    }
  }
  return keys;
}

export function validateTranslationKeys(): { valid: boolean; missing: string[] } {
  const enKeys = collectLeafPaths(en as unknown as Record<string, unknown>);
  const frKeys = new Set(collectLeafPaths(fr as unknown as Record<string, unknown>));
  const arKeys = new Set(collectLeafPaths(ar as unknown as Record<string, unknown>));

  const missing: string[] = [];
  for (const k of enKeys) {
    if (!frKeys.has(k)) missing.push(`fr:${k}`);
    if (!arKeys.has(k)) missing.push(`ar:${k}`);
  }
  return { valid: missing.length === 0, missing };
}
