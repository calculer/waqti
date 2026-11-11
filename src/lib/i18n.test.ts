import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  formatDigits,
  formatPlural,
  formatTimeRange,
  getDefaultWeekStart,
  getDirection,
  t,
  validateTranslationKeys,
} from './i18n';
import { formatLocalizedDate } from './dates';

test('validateTranslationKeys ensures ar, fr, and en have 100% identical keys', () => {
  const result = validateTranslationKeys();
  assert.equal(result.valid, true, `Missing keys: ${result.missing.join(', ')}`);
  assert.equal(result.missing.length, 0);
});

test('all static t(...) keys used in src/ exist in ar, fr, and en and never render a raw key matching /^[a-z]+(\\.[A-Za-z0-9_]+)+$/', () => {
  const rawKeyRegex = /^[a-z]+(\.[A-Za-z0-9_]+)+$/;
  const filesToScan: string[] = [];

  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (
        (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) &&
        !entry.name.endsWith('.test.ts')
      ) {
        filesToScan.push(full);
      }
    }
  };
  walk('src');

  const keyCallRegex = /\bt\(\s*(?:lang\s*,\s*)?['"]([a-zA-Z0-9_.]+)['"]/g;
  const discoveredKeys = new Set<string>();

  for (const file of filesToScan) {
    const code = fs.readFileSync(file, 'utf8');
    let match: RegExpExecArray | null;
    while ((match = keyCallRegex.exec(code)) !== null) {
      discoveredKeys.add(match[1]);
    }
  }

  // Also include dynamic keys used via template literals
  const dynamicFamilies = [
    'classMode.inPerson',
    'classMode.remote',
    'classMode.hybrid',
    'classMode.filterAll',
    'timetable.mode.in_person',
    'timetable.mode.remote',
    'timetable.mode.hybrid',
    'timetable.type.lecture',
    'timetable.type.td',
    'timetable.type.tp',
    'timetable.type.other',
    'timetable.type.unknown',
    'settings.accent.honey',
    'settings.accent.sand',
    'settings.accent.olive',
    'settings.accent.terracotta',
    'settings.accent.slate',
    'smartPaste.issue.unknown_day',
    'smartPaste.issue.missing_end_time',
    'smartPaste.issue.invalid_time_order',
    'smartPaste.issue.missing_subject',
    'smartPaste.issue.unknown_type',
    'smartPaste.issue.invalid_url',
    'smartPaste.issue.duplicate_existing',
    'smartPaste.issue.conflict_existing',
    'smartPaste.issue.conflict_batch',
  ];
  for (const k of dynamicFamilies) {
    discoveredKeys.add(k);
  }

  for (const key of discoveredKeys) {
    for (const lang of ['ar', 'fr', 'en'] as const) {
      const rendered = t(lang, key);
      assert.equal(
        rawKeyRegex.test(rendered),
        false,
        `Locale "${lang}" rendered raw key "${rendered}" for key "${key}"`
      );
    }
  }
});

test('getDirection and getDefaultWeekStart return correct canonical ISO values per locale', () => {
  assert.equal(getDirection('ar'), 'rtl');
  assert.equal(getDirection('fr'), 'ltr');
  assert.equal(getDirection('en'), 'ltr');

  assert.equal(getDefaultWeekStart('ar'), 6); // Saturday (ISO 6)
  assert.equal(getDefaultWeekStart('fr'), 1); // Monday (ISO 1)
  assert.equal(getDefaultWeekStart('en'), 7); // Sunday (ISO 7)
});

test('formatPlural handles Arabic 6 plural categories and French/English plurals including alarms', () => {
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

  assert.equal(formatPlural('en', 'alarms', 2, 'western'), '2 active alarms');
  assert.ok(formatPlural('fr', 'alarms', 2, 'western').includes('2'));
  assert.ok(formatPlural('ar', 'alarms', 3, 'western').includes('3'));
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
