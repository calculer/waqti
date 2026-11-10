import React, { useMemo, useState } from 'react';
import {
  Check,
  Flame,
  Plus,
  Trash2,
  Trophy,
} from 'lucide-react';
import { useWaqtiStore } from '../store/useWaqtiStore';
import { useTranslation } from '../hooks/useTranslation';
import {
  calculateHabitStreak,
  formatLocalizedDate,
  getWeekDates,
  shiftDateString,
} from '../lib/dates';
import { SUBJECT_COLOR_LIST, SUBJECT_COLORS } from '../lib/colors';
import { EmptyHourglassIllustration } from '../components/WaqtiLogo';
import type { Habit, HabitFrequencyType, SubjectColorId } from '../types';

export const HabitsView: React.FC<{
  onPushUndo: (labelKey: string, restore: () => void) => void;
}> = ({ onPushUndo }) => {
  const { t, lang, digitsStyle, digits } = useTranslation();
  const habits = useWaqtiStore((s) => s.habits);
  const todayStr = useWaqtiStore((s) => s.todayStr);
  const weekStart = useWaqtiStore((s) => s.settings.weekStart);

  const addHabit = useWaqtiStore((s) => s.addHabit);
  const toggleHabitDate = useWaqtiStore((s) => s.toggleHabitDate);
  const deleteHabit = useWaqtiStore((s) => s.deleteHabit);

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [name, setName] = useState('');
  const [frequencyType, setFrequencyType] = useState<HabitFrequencyType>('daily');
  const [timesPerWeek, setTimesPerWeek] = useState(5);
  const [color, setColor] = useState<SubjectColorId>('violet');
  const [errorMsg, setErrorMsg] = useState('');

  const currentWeekDates = useMemo(
    () => getWeekDates(todayStr, weekStart),
    [todayStr, weekStart]
  );

  const last28Dates = useMemo(
    () => Array.from({ length: 28 }, (_, i) => shiftDateString(todayStr, -(27 - i))),
    [todayStr]
  );

  const handleAddHabit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg(t('error.required'));
      return;
    }
    addHabit({
      name: name.trim(),
      icon: 'Flame',
      color,
      frequencyType,
      targetDays: [0, 1, 2, 3, 4, 5, 6],
      timesPerWeek,
    });
    setName('');
    setErrorMsg('');
    setIsAddOpen(false);
  };

  const handleDelete = (h: Habit) => {
    const removed = deleteHabit(h.id);
    if (removed) {
      onPushUndo('common.deletedToast', () => {
        useWaqtiStore.setState((st) => ({
          habits: [...st.habits, removed],
        }));
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-display text-[var(--text-primary)]">
            {t('habits.title')}
          </h1>
          <p className="text-sm text-[var(--text-secondary)]">{t('habits.subtitle')}</p>
        </div>

        <button
          type="button"
          onClick={() => setIsAddOpen((v) => !v)}
          className="flex items-center gap-2 rounded-xl bg-[var(--accent-primary)] px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:opacity-95 transition whitespace-nowrap"
        >
          <Plus className="h-4 w-4" />
          <span>{t('habits.add')}</span>
        </button>
      </div>

      {isAddOpen && (
        <form
          onSubmit={handleAddHabit}
          className="rounded-3xl border border-[var(--border-strong)] bg-[var(--bg-surface)] p-6 space-y-4"
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                {t('habits.name')}
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3.5 py-2.5 text-sm text-[var(--text-primary)]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                {t('habits.frequency')}
              </label>
              <select
                value={frequencyType}
                onChange={(e) => setFrequencyType(e.target.value as HabitFrequencyType)}
                className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2.5 text-sm text-[var(--text-primary)]"
              >
                <option value="daily">{t('habits.freq.daily')}</option>
                <option value="weekdays">{t('habits.freq.weekdays')}</option>
                <option value="times_per_week">{t('habits.freq.times_per_week')}</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-2">
                {t('subjects.color')}
              </label>
              <div className="flex items-center gap-2">
                {SUBJECT_COLOR_LIST.slice(0, 6).map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-label={c}
                    onClick={() => setColor(c)}
                    className={`h-7 w-7 rounded-full ${SUBJECT_COLORS[c].dot} ${
                      color === c
                        ? 'ring-2 ring-offset-2 ring-[var(--text-primary)]'
                        : 'opacity-60'
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>

          {frequencyType === 'times_per_week' && (
            <div className="max-w-xs">
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                {t('habits.freq.times_per_week')}
              </label>
              <input
                type="number"
                min={1}
                max={7}
                value={timesPerWeek}
                onChange={(e) => setTimesPerWeek(Number(e.target.value))}
                className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 text-sm font-mono-tabular text-[var(--text-primary)]"
              />
            </div>
          )}

          {errorMsg && (
            <p className="text-xs font-medium text-rose-500" role="alert">
              {errorMsg}
            </p>
          )}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsAddOpen(false)}
              className="rounded-xl border border-[var(--border-subtle)] px-4 py-2 text-xs font-medium text-[var(--text-secondary)]"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              className="rounded-xl bg-[var(--accent-primary)] px-5 py-2 text-xs font-semibold text-white"
            >
              {t('common.save')}
            </button>
          </div>
        </form>
      )}

      {habits.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-[var(--border-strong)] bg-[var(--bg-surface)] p-12 text-center flex flex-col items-center">
          <EmptyHourglassIllustration />
          <p className="mt-4 text-sm text-[var(--text-secondary)]">{t('habits.empty')}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {habits.map((h) => {
            const colorStyle = SUBJECT_COLORS[h.color];
            const currentStreak = calculateHabitStreak(h.completedDates, todayStr);
            const completedThisWeek = currentWeekDates.filter((d) =>
              h.completedDates.includes(d)
            ).length;
            const targetCount = h.frequencyType === 'times_per_week' ? h.timesPerWeek : 7;
            const weeklyRate = Math.min(
              100,
              Math.round((completedThisWeek / Math.max(1, targetCount)) * 100)
            );

            return (
              <div
                key={h.id}
                className="rounded-3xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 space-y-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2.5">
                      <span className={`h-3 w-3 rounded-full ${colorStyle.dot}`} />
                      <h3 className="text-base font-bold text-[var(--text-primary)]">
                        {h.name}
                      </h3>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-[var(--text-secondary)]">
                      <span className="flex items-center gap-1 font-semibold text-amber-500">
                        <Flame className="h-3.5 w-3.5" />
                        {t('habits.currentStreak')}:{' '}
                        <strong className="font-mono-tabular">{digits(currentStreak)}</strong>
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="flex items-center gap-1">
                        <Trophy className="h-3.5 w-3.5 text-[var(--accent-primary)]" />
                        {t('habits.bestStreak')}:{' '}
                        <strong className="font-mono-tabular text-[var(--text-primary)]">
                          {digits(Math.max(h.bestStreak, currentStreak))}
                        </strong>
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>
                        {t('habits.weeklyRate')}:{' '}
                        <strong className="font-mono-tabular text-[var(--text-primary)]">
                          {digits(weeklyRate)}%
                        </strong>
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDelete(h)}
                    aria-label={`${t('common.delete')} ${h.name}`}
                    className="rounded-lg p-1.5 text-[var(--text-muted)] hover:text-rose-500"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                {/* Current Week Interactive Day Check-in Buttons */}
                <div className="grid grid-cols-7 gap-2">
                  {currentWeekDates.map((dStr) => {
                    const checked = h.completedDates.includes(dStr);
                    const isToday = dStr === todayStr;
                    const dayShort = formatLocalizedDate(dStr, lang, 'EEE', digitsStyle);
                    const dayNum = parseInt(dStr.slice(8, 10), 10);

                    return (
                      <button
                        key={dStr}
                        type="button"
                        onClick={() => toggleHabitDate(h.id, dStr)}
                        className={`rounded-2xl border py-2.5 px-2 flex flex-col items-center justify-center gap-1 transition min-h-[58px] ${
                          checked
                            ? `${colorStyle.softBg} ${colorStyle.border} ${colorStyle.text}`
                            : isToday
                              ? 'border-[var(--accent-primary)] bg-[var(--bg-elevated)] text-[var(--text-primary)]'
                              : 'border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-muted)]'
                        }`}
                      >
                        <span className="text-[10px] font-medium truncate">{dayShort}</span>
                        <div className="flex items-center gap-1">
                          <span className="text-xs font-bold font-mono-tabular">
                            {digits(dayNum)}
                          </span>
                          {checked && <Check className="h-3.5 w-3.5 stroke-[2.5]" />}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* 28-Day Rounded-Cell Heatmap */}
                <div className="pt-3 border-t border-[var(--border-subtle)] flex flex-wrap items-center justify-between gap-3">
                  <span className="text-xs text-[var(--text-muted)]">{t('habits.heatmap')}</span>
                  <div className="flex items-center gap-1 flex-wrap">
                    {last28Dates.map((dStr) => {
                      const active = h.completedDates.includes(dStr);
                      return (
                        <button
                          key={dStr}
                          type="button"
                          onClick={() => toggleHabitDate(h.id, dStr)}
                          title={dStr}
                          aria-label={`${h.name} ${dStr}`}
                          className={`h-3.5 w-3.5 rounded-[4px] transition ${
                            active
                              ? colorStyle.dot
                              : 'bg-[var(--bg-elevated)] hover:bg-[var(--border-strong)]'
                          }`}
                        />
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
