import React, { useEffect } from 'react';
import { BellRing, CheckCircle2, Clock, Volume2, X } from 'lucide-react';
import { useWaqtiStore } from '../store/useWaqtiStore';
import { useTranslation } from '../hooks/useTranslation';
import { Logo } from './WaqtiLogo';
import { soundEngine } from '../lib/sound';

export const AlarmRingingModal: React.FC = () => {
  const { t, formatTime, digits } = useTranslation();
  const activeRingingAlarm = useWaqtiStore((s) => s.activeRingingAlarm);
  const missedAlarms = useWaqtiStore((s) => s.missedAlarms);
  const settings = useWaqtiStore((s) => s.settings);
  const dismissRingingAlarm = useWaqtiStore((s) => s.dismissRingingAlarm);
  const snoozeRingingAlarm = useWaqtiStore((s) => s.snoozeRingingAlarm);
  const completeRingingAlarmLinkedItem = useWaqtiStore((s) => s.completeRingingAlarmLinkedItem);
  const dismissMissedAlarms = useWaqtiStore((s) => s.dismissMissedAlarms);

  // Trigger procedural Web Audio alarm loop + browser Notification when activeRingingAlarm fires
  useEffect(() => {
    if (!activeRingingAlarm) {
      soundEngine.stopAlarmRinging();
      return;
    }

    soundEngine.startAlarmRinging(
      activeRingingAlarm.sound || settings.defaultAlarmSound,
      settings.alarmVolume,
      activeRingingAlarm.vibrate
    );

    if (
      typeof window !== 'undefined' &&
      'Notification' in window &&
      Notification.permission === 'granted'
    ) {
      try {
        const notif = new Notification(activeRingingAlarm.title, {
          body: activeRingingAlarm.note || formatTime(activeRingingAlarm.time),
          icon: '/favicon.svg',
          tag: `waqti-alarm-${activeRingingAlarm.id}`,
        });
        notif.onclick = () => {
          window.focus();
          notif.close();
        };
      } catch {
        // Ignore browser notification errors in restricted iframes
      }
    }

    return () => {
      soundEngine.stopAlarmRinging();
    };
  }, [
    activeRingingAlarm,
    settings.defaultAlarmSound,
    settings.alarmVolume,
    formatTime,
  ]);

  if (!activeRingingAlarm && missedAlarms.length === 0) {
    return null;
  }

  return (
    <>
      {/* Full-Screen Ringing Overlay */}
      {activeRingingAlarm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4"
          role="dialog"
          aria-modal="true"
          aria-label={t('alarms.ringingTitle')}
        >
          <div className="relative w-full max-w-md rounded-3xl border-2 border-[var(--accent-primary)] bg-[var(--bg-surface)] p-7 text-center shadow-2xl space-y-6 overflow-hidden">
            {/* Soft honey ambient glow */}
            <div className="pointer-events-none absolute -top-24 inset-x-0 mx-auto h-48 w-48 rounded-full bg-[var(--accent-primary)]/20 blur-3xl" />

            <div className="flex flex-col items-center gap-3 relative">
              <div className="relative flex items-center justify-center">
                <span className="absolute h-20 w-20 rounded-full bg-[var(--accent-primary)]/25 animate-ping" />
                <div className="relative rounded-2xl bg-[var(--accent-soft)] p-3.5 border border-[var(--accent-primary)]/40">
                  <Logo size={42} variant="icon" />
                </div>
              </div>

              <span className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent-soft)] px-3 py-1 text-xs font-bold text-[var(--accent-primary)]">
                <Volume2 className="h-3.5 w-3.5 animate-bounce" />
                {t('alarms.ringingTitle')}
              </span>
            </div>

            {/* Big Tabular Time Display */}
            <div
              dir="ltr"
              className="text-5xl font-bold font-display tabular-nums tracking-tight text-[var(--text-primary)]"
            >
              {formatTime(activeRingingAlarm.time)}
            </div>

            <div className="space-y-1.5">
              <h2 className="text-xl font-bold text-[var(--text-primary)]">
                {activeRingingAlarm.title}
              </h2>
              {activeRingingAlarm.note && (
                <p className="text-sm text-[var(--text-secondary)]">
                  {activeRingingAlarm.note}
                </p>
              )}
            </div>

            {/* Snooze Options (5 / 10 / 15 min) */}
            <div className="space-y-2">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                {t('alarms.snooze')}
              </div>
              <div className="grid grid-cols-3 gap-2.5">
                {[5, 10, 15].map((mins) => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => snoozeRingingAlarm(mins)}
                    className="flex items-center justify-center gap-1.5 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-elevated)] py-2.5 px-3 text-xs font-semibold text-[var(--text-primary)] hover:border-[var(--accent-primary)] transition"
                  >
                    <Clock className="h-3.5 w-3.5 text-[var(--accent-primary)]" />
                    <span className="tabular-nums">
                      +{digits(mins)} {t('common.minutesShort')}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Primary Actions: Mark Linked Item Done + Dismiss */}
            <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
              {(activeRingingAlarm.linkedType === 'habit' ||
                activeRingingAlarm.linkedType === 'task') &&
                activeRingingAlarm.linkedId && (
                  <button
                    type="button"
                    onClick={completeRingingAlarmLinkedItem}
                    className="flex-1 flex items-center justify-center gap-2 rounded-2xl border border-emerald-500/40 bg-emerald-500/15 py-3.5 px-4 text-xs font-bold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/25 transition"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    <span>{t('alarms.markDone')}</span>
                  </button>
                )}

              <button
                type="button"
                onClick={dismissRingingAlarm}
                className="flex-1 flex items-center justify-center gap-2 rounded-2xl btn-primary-waqti py-3.5 px-5 text-xs font-bold shadow-md transition"
              >
                <BellRing className="h-4 w-4" />
                <span>{t('alarms.dismiss')}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Missed Reminders Floating Card (when app reopens after being closed) */}
      {!activeRingingAlarm && missedAlarms.length > 0 && (
        <div className="fixed bottom-20 md:bottom-6 start-6 z-40 w-full max-w-sm rounded-2xl border border-[var(--border-strong)] bg-[var(--bg-surface)] p-4 shadow-2xl space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <BellRing className="h-4 w-4 text-[var(--accent-primary)] shrink-0" />
              <div>
                <h3 className="text-xs font-bold text-[var(--text-primary)]">
                  {t('alarms.missedTitle')} ({digits(missedAlarms.length)})
                </h3>
                <p className="text-[11px] text-[var(--text-secondary)]">
                  {t('alarms.missedDesc')}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={dismissMissedAlarms}
              aria-label={t('common.close')}
              className="rounded-lg p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="max-h-40 overflow-y-auto space-y-1.5">
            {missedAlarms.map((m, idx) => (
              <div
                key={`${m.alarmId}-${idx}`}
                className="flex items-center justify-between rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 text-xs"
              >
                <span className="font-semibold text-[var(--text-primary)] truncate pe-2">
                  {m.title}
                </span>
                <span
                  dir="ltr"
                  className="text-[11px] font-mono tabular-nums text-[var(--accent-primary)] shrink-0"
                >
                  {formatTime(m.scheduledTime)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
};
