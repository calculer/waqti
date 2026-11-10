import React, { useState } from 'react';
import {
  Bell,
  Check,
  Download,
  RotateCcw,
  Trash2,
  Upload,
} from 'lucide-react';
import { useWaqtiStore } from '../store/useWaqtiStore';
import { useTranslation } from '../hooks/useTranslation';
import { getOrderedWeekdays } from '../lib/dates';
import type { AccentTheme, Language, ThemeMode, WeekDay } from '../types';

const COMMON_TIMEZONES = [
  'UTC',
  'Africa/Cairo',
  'Africa/Casablanca',
  'Africa/Algiers',
  'Africa/Tunis',
  'Asia/Riyadh',
  'Asia/Dubai',
  'Europe/Paris',
  'Europe/London',
  'America/New_York',
  'America/Los_Angeles',
  'Asia/Tokyo',
];

export const SettingsView: React.FC = () => {
  const { t, lang } = useTranslation();
  const settings = useWaqtiStore((s) => s.settings);
  const setLanguage = useWaqtiStore((s) => s.setLanguage);
  const updateSettings = useWaqtiStore((s) => s.updateSettings);
  const loadDemoWorkspace = useWaqtiStore((s) => s.loadDemoWorkspace);
  const clearAllData = useWaqtiStore((s) => s.clearAllData);
  const importWorkspaceJson = useWaqtiStore((s) => s.importWorkspaceJson);

  const [confirmReset, setConfirmReset] = useState(false);

  const weekdays = getOrderedWeekdays(lang, 0, 'EEEE');

  const handleExportJson = () => {
    const fullState = useWaqtiStore.getState();
    const blob = new Blob([JSON.stringify(fullState, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `waqti-backup-${fullState.todayStr}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        importWorkspaceJson(reader.result);
      }
    };
    reader.readAsText(file);
  };

  const requestNotifications = async () => {
    if (typeof Notification === 'undefined') return;
    const perm = await Notification.requestPermission();
    updateSettings({ notificationsEnabled: perm === 'granted' });
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold font-display text-[var(--text-primary)]">
          {t('settings.title')}
        </h1>
        <p className="text-sm text-[var(--text-secondary)]">{t('settings.subtitle')}</p>
      </div>

      {/* Language & Appearance */}
      <div className="rounded-3xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 space-y-6">
        <div>
          <label className="block text-xs font-bold text-[var(--text-secondary)] mb-2.5">
            {t('settings.language')}
          </label>
          <div className="grid grid-cols-3 gap-3">
            {(
              [
                { code: 'ar', label: 'العربية' },
                { code: 'fr', label: 'Français' },
                { code: 'en', label: 'English' },
              ] as { code: Language; label: string }[]
            ).map((item) => (
              <button
                key={item.code}
                type="button"
                onClick={() => setLanguage(item.code)}
                className={`rounded-2xl border py-3 px-4 text-sm font-semibold flex items-center justify-between transition ${
                  settings.language === item.code
                    ? 'border-[var(--accent-primary)] bg-[var(--accent-soft)] text-[var(--accent-primary)]'
                    : 'border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-primary)]'
                }`}
              >
                <span>{item.label}</span>
                {settings.language === item.code && <Check className="h-4 w-4" />}
              </button>
            ))}
          </div>
        </div>

        {/* Theme Mode */}
        <div>
          <label className="block text-xs font-bold text-[var(--text-secondary)] mb-2.5">
            {t('settings.theme')}
          </label>
          <div className="grid grid-cols-3 gap-3">
            {(['light', 'dark', 'auto'] as ThemeMode[]).map((tm) => (
              <button
                key={tm}
                type="button"
                onClick={() => updateSettings({ theme: tm })}
                className={`rounded-2xl border py-2.5 px-4 text-xs font-semibold transition ${
                  settings.theme === tm
                    ? 'border-[var(--accent-primary)] bg-[var(--accent-soft)] text-[var(--accent-primary)]'
                    : 'border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-primary)]'
                }`}
              >
                {t(`settings.theme.${tm}`)}
              </button>
            ))}
          </div>
        </div>

        {/* 5 Signature Accent Themes */}
        <div>
          <label className="block text-xs font-bold text-[var(--text-secondary)] mb-2.5">
            {t('settings.accent')}
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
            {(
              [
                { id: 'violet', hex: '#8B5CF6', label: 'Violet' },
                { id: 'ocean', hex: '#0284C7', label: 'Ocean' },
                { id: 'emerald', hex: '#10B981', label: 'Emerald' },
                { id: 'rose', hex: '#F43F5E', label: 'Rose' },
                { id: 'amber', hex: '#F59E0B', label: 'Amber' },
              ] as { id: AccentTheme; hex: string; label: string }[]
            ).map((ac) => (
              <button
                key={ac.id}
                type="button"
                onClick={() => updateSettings({ accent: ac.id })}
                className={`flex items-center gap-2.5 rounded-2xl border py-2.5 px-3 text-xs font-semibold transition ${
                  settings.accent === ac.id
                    ? 'border-[var(--text-primary)] bg-[var(--bg-elevated)]'
                    : 'border-[var(--border-subtle)]'
                }`}
              >
                <span
                  className="h-4 w-4 rounded-full shrink-0"
                  style={{ backgroundColor: ac.hex }}
                />
                <span>{ac.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Calendar, Digits & Regional Time Rules */}
      <div className="rounded-3xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-[var(--text-secondary)] mb-2">
              {t('settings.weekStart')}
            </label>
            <select
              value={settings.weekStart}
              onChange={(e) => updateSettings({ weekStart: Number(e.target.value) as WeekDay })}
              className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3.5 py-2.5 text-sm text-[var(--text-primary)]"
            >
              {weekdays.map((w) => (
                <option key={w.dayIndex} value={w.dayIndex}>
                  {w.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-[var(--text-secondary)] mb-2">
              {t('settings.timezone')}
            </label>
            <select
              value={settings.timezone}
              onChange={(e) => updateSettings({ timezone: e.target.value })}
              className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3.5 py-2.5 text-sm font-mono-tabular text-[var(--text-primary)]"
            >
              {!COMMON_TIMEZONES.includes(settings.timezone) && (
                <option value={settings.timezone}>{settings.timezone}</option>
              )}
              {COMMON_TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold text-[var(--text-secondary)] mb-2">
              {t('settings.timeFormat')}
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(['24h', '12h'] as const).map((fmt) => (
                <button
                  key={fmt}
                  type="button"
                  onClick={() => updateSettings({ timeFormat: fmt })}
                  className={`rounded-xl border py-2 text-xs font-semibold ${
                    settings.timeFormat === fmt
                      ? 'border-[var(--accent-primary)] bg-[var(--accent-soft)] text-[var(--accent-primary)]'
                      : 'border-[var(--border-subtle)] bg-[var(--bg-elevated)]'
                  }`}
                >
                  {fmt}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-[var(--text-secondary)] mb-2">
              {t('settings.digitsStyle')}
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => updateSettings({ digitsStyle: 'western' })}
                className={`rounded-xl border py-2 text-xs font-semibold ${
                  settings.digitsStyle === 'western'
                    ? 'border-[var(--accent-primary)] bg-[var(--accent-soft)] text-[var(--accent-primary)]'
                    : 'border-[var(--border-subtle)] bg-[var(--bg-elevated)]'
                }`}
              >
                {t('settings.digits.western')}
              </button>
              <button
                type="button"
                onClick={() => updateSettings({ digitsStyle: 'arabic-indic' })}
                className={`rounded-xl border py-2 text-xs font-semibold ${
                  settings.digitsStyle === 'arabic-indic'
                    ? 'border-[var(--accent-primary)] bg-[var(--accent-soft)] text-[var(--accent-primary)]'
                    : 'border-[var(--border-subtle)] bg-[var(--bg-elevated)]'
                }`}
              >
                {t('settings.digits.arabic')}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-[var(--text-secondary)] mb-2">
              {t('settings.hijri')}
            </label>
            <button
              type="button"
              onClick={() => updateSettings({ showHijri: !settings.showHijri })}
              className={`w-full rounded-xl border py-2 px-3 text-xs font-semibold transition ${
                settings.showHijri
                  ? 'border-[var(--accent-primary)] bg-[var(--accent-soft)] text-[var(--accent-primary)]'
                  : 'border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-secondary)]'
              }`}
            >
              {settings.showHijri ? 'ON' : 'OFF'}
            </button>
          </div>
        </div>
      </div>

      {/* Pomodoro & Notifications */}
      <div className="rounded-3xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 space-y-4">
        <label className="block text-xs font-bold text-[var(--text-secondary)]">
          {t('settings.pomodoro')}
        </label>
        <div className="grid grid-cols-3 gap-3">
          <input
            type="number"
            min={5}
            max={120}
            aria-label="Focus minutes"
            value={settings.pomodoroFocusMinutes}
            onChange={(e) =>
              updateSettings({ pomodoroFocusMinutes: Math.max(5, Number(e.target.value)) })
            }
            className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3.5 py-2 text-sm font-mono-tabular text-[var(--text-primary)]"
          />
          <input
            type="number"
            min={1}
            max={30}
            aria-label="Short break minutes"
            value={settings.pomodoroShortBreakMinutes}
            onChange={(e) =>
              updateSettings({ pomodoroShortBreakMinutes: Math.max(1, Number(e.target.value)) })
            }
            className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3.5 py-2 text-sm font-mono-tabular text-[var(--text-primary)]"
          />
          <input
            type="number"
            min={5}
            max={60}
            aria-label="Long break minutes"
            value={settings.pomodoroLongBreakMinutes}
            onChange={(e) =>
              updateSettings({ pomodoroLongBreakMinutes: Math.max(5, Number(e.target.value)) })
            }
            className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3.5 py-2 text-sm font-mono-tabular text-[var(--text-primary)]"
          />
        </div>

        <div className="pt-3 border-t border-[var(--border-subtle)] flex items-center justify-between">
          <span className="text-xs font-medium text-[var(--text-secondary)]">
            {t('settings.notifications')}
          </span>
          <button
            type="button"
            onClick={requestNotifications}
            className="flex items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3.5 py-2 text-xs font-semibold text-[var(--text-primary)] hover:border-[var(--accent-primary)]"
          >
            <Bell className="h-3.5 w-3.5" />
            <span>{t('settings.enableNotifications')}</span>
          </button>
        </div>
      </div>

      {/* Data Backup, Demo Restore & Reset */}
      <div className="rounded-3xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleExportJson}
            className="flex items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-4 py-2.5 text-xs font-semibold text-[var(--text-primary)] hover:border-[var(--accent-primary)]"
          >
            <Download className="h-4 w-4" />
            <span>{t('settings.exportJson')}</span>
          </button>

          <label className="flex items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-4 py-2.5 text-xs font-semibold text-[var(--text-primary)] hover:border-[var(--accent-primary)] cursor-pointer">
            <Upload className="h-4 w-4" />
            <span>{t('settings.importJson')}</span>
            <input
              type="file"
              accept="application/json"
              onChange={handleImportJson}
              className="hidden"
            />
          </label>

          <button
            type="button"
            onClick={() => loadDemoWorkspace(lang)}
            className="flex items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-4 py-2.5 text-xs font-semibold text-[var(--accent-primary)] hover:border-[var(--accent-primary)]"
          >
            <RotateCcw className="h-4 w-4" />
            <span>{t('settings.loadDemo')}</span>
          </button>
        </div>

        {!confirmReset ? (
          <button
            type="button"
            onClick={() => setConfirmReset(true)}
            className="flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2.5 text-xs font-semibold text-rose-500"
          >
            <Trash2 className="h-4 w-4" />
            <span>{t('settings.resetAll')}</span>
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-xs text-rose-500 font-medium">
              {t('settings.resetConfirm')}
            </span>
            <button
              type="button"
              onClick={() => {
                clearAllData();
                setConfirmReset(false);
              }}
              className="rounded-xl bg-rose-600 px-3.5 py-2 text-xs font-semibold text-white"
            >
              {t('common.delete')}
            </button>
            <button
              type="button"
              onClick={() => setConfirmReset(false)}
              className="rounded-xl border border-[var(--border-subtle)] px-3 py-2 text-xs"
            >
              {t('common.cancel')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
