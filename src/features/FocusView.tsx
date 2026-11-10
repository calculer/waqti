import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  RotateCcw,
  SkipForward,
  Volume2,
} from 'lucide-react';
import { useWaqtiStore } from '../store/useWaqtiStore';
import { useTranslation } from '../hooks/useTranslation';
import { computeRemainingTimerMs } from '../lib/dates';
import { soundEngine } from '../lib/sound';

export const FocusView: React.FC = () => {
  const { t, digits } = useTranslation();
  const subjects = useWaqtiStore((s) => s.subjects);
  const timer = useWaqtiStore((s) => s.timer);
  const startTimer = useWaqtiStore((s) => s.startTimer);
  const pauseTimer = useWaqtiStore((s) => s.pauseTimer);
  const resetTimer = useWaqtiStore((s) => s.resetTimer);
  const setTimerSubject = useWaqtiStore((s) => s.setTimerSubject);
  const setTimerAmbientSound = useWaqtiStore((s) => s.setTimerAmbientSound);
  const completeTimerSession = useWaqtiStore((s) => s.completeTimerSession);

  const [nowMs, setNowMs] = useState(() => Date.now());
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [celebrationBanner, setCelebrationBanner] = useState(false);

  const remainingMs = computeRemainingTimerMs(timer, nowMs);

  useEffect(() => {
    if (!timer.isRunning) return;
    const id = setInterval(() => {
      const current = Date.now();
      setNowMs(current);
      const rem = computeRemainingTimerMs(useWaqtiStore.getState().timer, current);
      if (rem <= 0) {
        soundEngine.playCompletionChime();
        completeTimerSession();
        setCelebrationBanner(true);
      }
    }, 250);
    return () => clearInterval(id);
  }, [timer.isRunning, completeTimerSession]);

  useEffect(() => {
    if (timer.isRunning && timer.ambientSound !== 'none') {
      soundEngine.startAmbient(timer.ambientSound);
    } else {
      soundEngine.stopAmbient();
    }
    return () => {
      soundEngine.stopAmbient();
    };
  }, [timer.isRunning, timer.ambientSound]);

  const totalSeconds = Math.ceil(remainingMs / 1000);
  const mm = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const ss = String(totalSeconds % 60).padStart(2, '0');
  const progressRatio =
    timer.targetDurationMs > 0
      ? Math.max(0, Math.min(1, 1 - remainingMs / timer.targetDurationMs))
      : 0;

  const radius = 128;
  const circumference = 2 * Math.PI * radius;

  return (
    <div
      className={
        isFullscreen
          ? 'fixed inset-0 z-50 flex flex-col justify-between bg-[var(--bg-canvas)] waqti-aurora p-6 md:p-12 overflow-y-auto'
          : 'space-y-6'
      }
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-display text-[var(--text-primary)]">
            {t('focus.title')}
          </h1>
          <p className="text-sm text-[var(--text-secondary)]">{t('focus.subtitle')}</p>
        </div>

        <button
          type="button"
          onClick={() => setIsFullscreen((v) => !v)}
          className="flex items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-2 text-xs font-medium text-[var(--text-primary)] hover:border-[var(--accent-primary)] transition"
        >
          {isFullscreen ? (
            <>
              <Minimize2 className="h-4 w-4" />
              <span>{t('focus.exitFullscreen')}</span>
            </>
          ) : (
            <>
              <Maximize2 className="h-4 w-4" />
              <span>{t('focus.fullscreen')}</span>
            </>
          )}
        </button>
      </div>

      {celebrationBanner && (
        <div className="flex items-center justify-between rounded-2xl border border-emerald-500/40 bg-emerald-500/15 px-4 py-3 text-xs font-semibold text-emerald-600 dark:text-emerald-300">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            <span>{t('focus.sessionLogged')}</span>
          </div>
          <button
            type="button"
            onClick={() => setCelebrationBanner(false)}
            className="underline text-xs"
          >
            OK
          </button>
        </div>
      )}

      {/* Main Studio Card */}
      <div className="rounded-3xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-8 md:p-12 flex flex-col items-center text-center">
        {/* Mode Selector */}
        <div className="flex items-center gap-1.5 rounded-2xl bg-[var(--bg-elevated)] p-1.5 mb-8">
          {(['focus', 'shortBreak', 'longBreak'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => resetTimer(m)}
              className={`rounded-xl px-4 py-2 text-xs font-semibold transition ${
                timer.mode === m
                  ? 'bg-[var(--bg-surface)] text-[var(--accent-primary)] shadow-sm'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {t(`focus.mode.${m}`)}
            </button>
          ))}
        </div>

        {/* Subject Picker */}
        <div className="mb-8 w-full max-w-xs">
          <select
            value={timer.subjectId || subjects[0]?.id || ''}
            onChange={(e) => setTimerSubject(e.target.value)}
            aria-label={t('timetable.subject')}
            className="w-full rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-4 py-2.5 text-sm font-medium text-[var(--text-primary)] text-center"
          >
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        {/* Breathing Animated Ring & Giant Tabular Countdown */}
        <div className="relative h-72 w-72 flex items-center justify-center mb-8">
          <svg className="h-72 w-72 -rotate-90" viewBox="0 0 288 288">
            <circle
              cx="144"
              cy="144"
              r={radius}
              fill="none"
              stroke="var(--border-strong)"
              strokeWidth="8"
            />
            <circle
              cx="144"
              cy="144"
              r={radius}
              fill="none"
              stroke="var(--accent-primary)"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - progressRatio)}
              className="transition-all duration-300"
            />
          </svg>
          <div className="absolute flex flex-col items-center">
            <div
              dir="ltr"
              className="text-5xl md:text-6xl font-bold font-mono-tabular tracking-tight text-[var(--text-primary)]"
            >
              {digits(mm)}:{digits(ss)}
            </div>
            <div className="mt-2 text-xs font-medium text-[var(--text-muted)]">
              {t('focus.cyclesCompleted')}: {digits(timer.completedCycles)}
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3 mb-8">
          <button
            type="button"
            onClick={() => resetTimer()}
            aria-label={t('focus.reset')}
            className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition"
          >
            <RotateCcw className="h-5 w-5" />
          </button>

          {timer.isRunning ? (
            <button
              type="button"
              onClick={() => {
                setNowMs(Date.now());
                pauseTimer();
              }}
              className="flex items-center gap-2.5 rounded-2xl bg-amber-500 px-8 py-4 text-sm font-bold text-white shadow-lg transition hover:opacity-95"
            >
              <Pause className="h-5 w-5" />
              <span>{t('focus.pause')}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setNowMs(Date.now());
                startTimer();
              }}
              className="flex items-center gap-2.5 rounded-2xl bg-[var(--accent-primary)] px-8 py-4 text-sm font-bold text-white shadow-lg transition hover:opacity-95"
            >
              <Play className="h-5 w-5" />
              <span>{t('focus.start')}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              soundEngine.playCompletionChime();
              completeTimerSession();
              setCelebrationBanner(true);
            }}
            aria-label={t('focus.skip')}
            className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition"
          >
            <SkipForward className="h-5 w-5" />
          </button>
        </div>

        {/* Procedural Web Audio Soundscape Selector */}
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Volume2 className="h-4 w-4 text-[var(--text-muted)] me-1" />
          {(['none', 'rain', 'whitenoise', 'tones'] as const).map((snd) => (
            <button
              key={snd}
              type="button"
              onClick={() => setTimerAmbientSound(snd)}
              className={`rounded-xl border px-3.5 py-1.5 text-xs font-medium transition ${
                timer.ambientSound === snd
                  ? 'border-[var(--accent-primary)] bg-[var(--accent-soft)] text-[var(--accent-primary)]'
                  : 'border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-secondary)]'
              }`}
            >
              {t(`focus.sound.${snd}`)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
