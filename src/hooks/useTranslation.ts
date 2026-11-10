import { useCallback } from 'react';
import { useWaqtiStore } from '../store/useWaqtiStore';
import {
  formatDigits,
  formatPlural,
  formatTimeDisplay,
  formatTimeRange,
  getDirection,
  t as translate,
  type TranslationKey,
} from '../lib/i18n';

export function useTranslation() {
  const language = useWaqtiStore((s) => s.settings.language);
  const digitsStyle = useWaqtiStore((s) => s.settings.digitsStyle);
  const timeFormat = useWaqtiStore((s) => s.settings.timeFormat);
  const dir = getDirection(language);

  const t = useCallback(
    (key: TranslationKey, params?: Record<string, string | number>) =>
      translate(language, key, params, digitsStyle),
    [language, digitsStyle]
  );

  const digits = useCallback(
    (val: string | number) => formatDigits(val, language, digitsStyle),
    [language, digitsStyle]
  );

  const plural = useCallback(
    (category: 'days' | 'hours' | 'tasks', count: number) =>
      formatPlural(language, category, count, digitsStyle),
    [language, digitsStyle]
  );

  const formatTime = useCallback(
    (timeStr: string) => formatTimeDisplay(timeStr, timeFormat, language, digitsStyle),
    [timeFormat, language, digitsStyle]
  );

  const formatRange = useCallback(
    (startTime: string, endTime: string) =>
      formatTimeRange(startTime, endTime, timeFormat, language, digitsStyle),
    [timeFormat, language, digitsStyle]
  );

  return {
    t,
    lang: language,
    dir,
    digitsStyle,
    timeFormat,
    digits,
    plural,
    formatTime,
    formatRange,
  };
}
