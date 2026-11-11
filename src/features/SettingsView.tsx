import React, { useState } from 'react';
import {
  Bell,
  Check,
  Database,
  Download,
  History,
  RotateCcw,
  Trash2,
  Upload,
  Volume2,
} from 'lucide-react';
import { useWaqtiStore } from '../store/useWaqtiStore';
import { useTranslation } from '../hooks/useTranslation';
import { getOrderedWeekdays } from '../lib/dates';
import { ACCENT_THEMES } from '../lib/colors';
import { soundEngine } from '../lib/sound';
import type { AlarmTone, Language, ThemeMode, WeekDay } from '../types';

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
  const { t, lang, digits } = useTranslation();
  const settings = useWaqtiStore((s) => s.settings);
  const snapshots = useWaqtiStore((s) => s.snapshots);
  const setLanguage = useWaqtiStore((s) => s.setLanguage);
  const updateSettings = useWaqtiStore((s) => s.updateSettings);
  const loadDemoWorkspace = useWaqtiStore((s) => s.loadDemoWorkspace);
  const clearAllData = useWaqtiStore((s) => s.clearAllData);
  const importWorkspaceJson = useWaqtiStore((s) => s.importWorkspaceJson);
  const createSnapshot = useWaqtiStore((s) => s.createSnapshot);
  const restoreSnapshot = useWaqtiStore((s) => s.restoreSnapshot);

  const [confirmReset, setConfirmReset] = useState(false);

  const weekdays = getOrderedWeekdays(lang, 1, 'EEEE');

  const accentLabelKeyMap: Record<string, string> = {
    honey: 'settings.accent.honey',
    sand: 'settings.accent.sand',
    olive: 'settings.accent.olive',
    terracotta: 'settings.accent.terracotta',
    slate: 'settings.accent.slate',
  };

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
    try {
      const perm = await Notification.requestPermission();
      updateSettings({ notificationsEnabled: perm === 'granted' });
    } catch {
      // Ignore in restricted iframe
    }
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

        {/* 5 Signature Warm Accent Themes */}
        <div>
          <label className="block text-xs font-bold text-[var(--text-secondary)] mb-2.5">
            {t('settings.accent')}
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
            {ACCENT_THEMES.map((ac) => (
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
                <span className="truncate">{t(accentLabelKeyMap[ac.id] || ac.id)}</span>
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

      {/* Class Duration & Smart Reminder Lead Time Defaults */}
      <div className="rounded-3xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 space-y-4">
        <h2 className="text-sm font-bold font-display text-[var(--text-primary)]">
          {t('settings.classDefaultsTitle')}
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
              {t('settings.defaultClassDuration')}
            </label>
            <input
              type="number"
              min={30}
              max={240}
              step={15}
              value={settings.defaultClassDurationMinutes ?? 90}
              onChange={(e) =>
                updateSettings({
                  defaultClassDurationMinutes: Math.max(30, Number(e.target.value)),
                })
              }
              className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3.5 py-2 text-sm font-mono-tabular text-[var(--text-primary)]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
              {t('settings.defaultTravelLead')}
            </label>
            <input
              type="number"
              min={5}
              max={120}
              step={5}
              value={settings.defaultTravelLeadMinutes ?? 30}
              onChange={(e) =>
                updateSettings({
                  defaultTravelLeadMinutes: Math.max(5, Number(e.target.value)),
                })
              }
              className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3.5 py-2 text-sm font-mono-tabular text-[var(--text-primary)]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
              {t('settings.defaultJoinLead')}
            </label>
            <input
              type="number"
              min={1}
              max={60}
              step={1}
              value={settings.defaultJoinLeadMinutes ?? 10}
              onChange={(e) =>
                updateSettings({
                  defaultJoinLeadMinutes: Math.max(1, Number(e.target.value)),
                })
              }
              className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3.5 py-2 text-sm font-mono-tabular text-[var(--text-primary)]"
            />
          </div>
        </div>
      </div>

      {/* Alarm Defaults, Quiet Hours & Gamification */}
      <div className="rounded-3xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 space-y-5">
        <h2 className="text-sm font-bold font-display text-[var(--text-primary)]">
          {t('settings.alarmDefaults')}
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
              {t('alarms.sound')}
            </label>
            <div className="flex items-center gap-1.5">
              <select
                value={settings.defaultAlarmSound}
                onChange={(e) =>
                  updateSettings({ defaultAlarmSound: e.target.value as AlarmTone })
                }
                className="flex-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 text-xs font-medium text-[var(--text-primary)]"
              >
                {(
                  [
                    'soft_bell',
                    'morning_chime',
                    'marimba',
                    'gentle_rise',
                    'digital',
                  ] as AlarmTone[]
                ).map((tn) => (
                  <option key={tn} value={tn}>
                    {t(`alarms.tones.${tn}`)}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() =>
                  soundEngine.playAlarmPreview(
                    settings.defaultAlarmSound,
                    settings.alarmVolume
                  )
                }
                aria-label={t('alarms.previewSound')}
                className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-2 text-[var(--accent-primary)] hover:border-[var(--accent-primary)]"
              >
                <Volume2 className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
              {t('settings.alarmVolume')} ({digits(Math.round(settings.alarmVolume * 100))}%)
            </label>
            <input
              type="range"
              min={0.1}
              max={1}
              step={0.05}
              value={settings.alarmVolume}
              onChange={(e) => updateSettings({ alarmVolume: parseFloat(e.target.value) })}
              className="w-full accent-[var(--accent-primary)] h-2 rounded-lg cursor-pointer"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
              {t('settings.gamification')}
            </label>
            <button
              type="button"
              onClick={() =>
                updateSettings({ gamificationEnabled: !settings.gamificationEnabled })
              }
              className={`w-full rounded-xl border py-2 px-3 text-xs font-semibold transition ${
                settings.gamificationEnabled
                  ? 'border-[var(--accent-primary)] bg-[var(--accent-soft)] text-[var(--accent-primary)]'
                  : 'border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-secondary)]'
              }`}
            >
              {settings.gamificationEnabled ? 'ON' : 'OFF'}
            </button>
          </div>
        </div>

        {/* Quiet Hours */}
        <div className="pt-3 border-t border-[var(--border-subtle)] grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
          <div>
            <button
              type="button"
              onClick={() =>
                updateSettings({ quietHoursEnabled: !settings.quietHoursEnabled })
              }
              className={`w-full rounded-xl border py-2 px-3 text-xs font-semibold transition ${
                settings.quietHoursEnabled
                  ? 'border-[var(--accent-primary)] bg-[var(--accent-soft)] text-[var(--accent-primary)]'
                  : 'border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-secondary)]'
              }`}
            >
              {t('alarms.quietHours')}: {settings.quietHoursEnabled ? 'ON' : 'OFF'}
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--text-muted)]">
              {t('alarms.quietHoursStart')}:
            </span>
            <input
              type="time"
              dir="ltr"
              value={settings.quietHoursStart}
              onChange={(e) => updateSettings({ quietHoursStart: e.target.value })}
              className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2.5 py-1.5 text-xs font-mono tabular-nums"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--text-muted)]">
              {t('alarms.quietHoursEnd')}:
            </span>
            <input
              type="time"
              dir="ltr"
              value={settings.quietHoursEnd}
              onChange={(e) => updateSettings({ quietHoursEnd: e.target.value })}
              className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2.5 py-1.5 text-xs font-mono tabular-nums"
            />
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

      {/* Automatic Local Snapshots (Last 7) */}
      <div className="rounded-3xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-[var(--accent-primary)]" />
              <h2 className="text-sm font-bold font-display text-[var(--text-primary)]">
                {t('settings.snapshotsTitle')}
              </h2>
            </div>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
              {t('settings.snapshotsDesc')}
            </p>
          </div>
          <button
            type="button"
            onClick={() => createSnapshot()}
            className="rounded-xl btn-primary-waqti px-3.5 py-2 text-xs font-semibold"
          >
            {t('settings.createSnapshot')}
          </button>
        </div>

        {snapshots.length > 0 && (
          <div className="space-y-2 pt-2">
            {snapshots.map((snap) => (
              <div
                key={snap.id}
                className="flex items-center justify-between rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3.5 py-2.5 text-xs"
              >
                <div className="flex items-center gap-2">
                  <History className="h-3.5 w-3.5 text-[var(--accent-primary)]" />
                  <span className="font-semibold text-[var(--text-primary)]">
                    {snap.label}
                  </span>
                  <span dir="ltr" className="text-[11px] font-mono text-[var(--text-muted)]">
                    {snap.createdAt.slice(0, 16).replace('T', ' ')}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => restoreSnapshot(snap.id)}
                  className="rounded-lg border border-[var(--accent-primary)] bg-[var(--accent-soft)] px-2.5 py-1 text-[11px] font-bold text-[var(--accent-primary)]"
                >
                  {t('settings.restoreSnapshot')}
                </button>
              </div>
            ))}
          </div>
        )}
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
