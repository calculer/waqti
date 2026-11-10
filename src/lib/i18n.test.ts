import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatDigits,
  formatPlural,
  formatTimeRange,
  getDefaultWeekStart,
  getDirection,
  validateTranslationKeys,
} from './i18n';
import { formatLocalizedDate } from './dates';

test('validateTranslationKeys ensures ar, fr, and en have 100% identical keys', () => {
  const result = validateTranslationKeys();
  assert.equal(result.valid, true);
  assert.equal(result.missing.length, 0);
});

test('getDirection and getDefaultWeekStart return correct values per locale', () => {
  assert.equal(getDirection('ar'), 'rtl');
  assert.equal(getDirection('fr'), 'ltr');
  assert.equal(getDirection('en'), 'ltr');

  assert.equal(getDefaultWeekStart('ar'), 6); // Saturday
  assert.equal(getDefaultWeekStart('fr'), 1); // Monday
  assert.equal(getDefaultWeekStart('en'), 0); // Sunday
});

test('formatPlural handles Arabic 6 plural categories and French/English plurals', () => {
  assert.ok(formatPlural('ar', 'days', 0, 'western').includes('0'));
  assert.ok(formatPlural('ar', 'days', 1, 'western').includes('يوم واحد'));
  assert.ok(formatPlural('ar', 'days', 2, 'western').includes('يومان'));
  assert.ok(formatPlural('ar', 'days', 5, 'western').includes('أيام'));
  assert.ok(formatPlural('ar', 'days', 15, 'western').includes('يوماً'));
  assert.ok(formatPlural('ar', 'days', 100, 'western').includes('يوم'));

  assert.equal(formatPlural('en', 'tasks', 1, 'western'), '1 task');
  assert.equal(formatPlural('en', 'tasks', 4, 'western'), '4 tasks');
  assert.equal(formatPlural('fr', 'tasks', 1, 'western'), '1 tâche');
  assert.equal(formatPlural('fr', 'tasks', 3, 'western'), '3 tâches');
});

test('formatDigits converts Western to Arabic-Indic numerals only when configured in Arabic', () => {
  assert.equal(formatDigits('2026', 'ar', 'arabic-indic'), '٢٠٢٦');
  assert.equal(formatDigits('2026', 'ar', 'western'), '2026');
  assert.equal(formatDigits('2026', 'fr', 'arabic-indic'), '2026');
});

test('formatTimeRange preserves start -> end order in all locales and digit styles', () => {
  const rangeWestern = formatTimeRange('08:00', '09:30', '24h', 'ar', 'western');
  assert.equal(rangeWestern, '08:00 – 09:30');

  const rangeIndic = formatTimeRange('08:00', '09:30', '24h', 'ar', 'arabic-indic');
  assert.equal(rangeIndic, '٠٨:٠٠ – ٠٩:٣٠');
});

test('formatLocalizedDate formats dates cleanly in ar, fr, and en', () => {
  const arDate = formatLocalizedDate('2026-11-10', 'ar', 'EEEE d MMMM yyyy', 'western');
  const frDate = formatLocalizedDate('2026-11-10', 'fr', 'EEEE d MMMM yyyy', 'western');
  const enDate = formatLocalizedDate('2026-11-10', 'en', 'EEEE d MMMM yyyy', 'western');

  assert.ok(arDate.length > 5);
  assert.ok(frDate.toLowerCase().includes('novembre'));
  assert.ok(enDate.includes('November'));
});
