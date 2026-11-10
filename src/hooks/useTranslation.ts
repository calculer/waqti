import { useCallback } from 'react';
import { useWaqtiStore } from '../store/useWaqtiStore';
import {
  formatDigits,
  formatPlural,
  formatTimeDisplay,
  formatTimeRange,
  getDirection,
  t as translateRaw,
} from '../lib/i18n';

export function useTranslation() {
  const lang = useWaqtiStore((s) => s.settings.language);
  const digitsStyle = useWaqtiStore((s) => s.settings.digitsStyle);
  const timeFormat = useWaqtiStore((s) => s.settings.timeFormat);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>): string => {
      return translateRaw(lang, key, params, digitsStyle);
    },
    [lang, digitsStyle]
  );

  const digits = useCallback(
    (value: string | number): string => {
      return formatDigits(value, lang, digitsStyle);
    },
    [lang, digitsStyle]
  );

  const formatTime = useCallback(
    (timeStr: string): string => {
      return formatTimeDisplay(timeStr, timeFormat, lang, digitsStyle);
    },
    [timeFormat, lang, digitsStyle]
  );

  const formatRange = useCallback(
    (startTime: string, endTime: string): string => {
      return formatTimeRange(startTime, endTime, timeFormat, lang, digitsStyle);
    },
    [timeFormat, lang, digitsStyle]
  );

  const plural = useCallback(
    (category: 'days' | 'hours' | 'tasks' | 'alarms', count: number): string => {
      return formatPlural(lang, category, count, digitsStyle);
    },
    [lang, digitsStyle]
  );

  const dir = getDirection(lang);

  return {
    t,
    lang,
    language: lang,
    dir,
    isRTL: dir === 'rtl',
    digitsStyle,
    timeFormat,
    digits,
    formatTime,
    formatRange,
    plural,
  };
}
