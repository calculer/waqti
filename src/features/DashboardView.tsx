import React, { useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  CheckCircle2,
  Circle,
  Clock,
  Flame,
  GraduationCap,
  Plus,
  Sparkles,
  Timer,
  Trash2,
} from 'lucide-react';
import { useWaqtiStore } from '../store/useWaqtiStore';
import { useTranslation } from '../hooks/useTranslation';
import {
  calculateHabitStreak,
  computeExamCountdown,
  formatHijriDate,
  formatLocalizedDate,
  getLocalTimeString,
  getWeekDayIndex,
  timeToMinutes,
} from '../lib/dates';
import { SUBJECT_COLORS } from '../lib/colors';

interface DashboardViewProps {
  onOpenQuickAdd: (tab?: 'task' | 'exam' | 'slot' | 'habit') => void;
  onOpenOnboarding: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onOpenQuickAdd,
  onOpenOnboarding,
}) => {
  const { t, lang, digitsStyle, timeFormat, digits, formatTime, formatRange, plural } =
    useTranslation();

  const todayStr = useWaqtiStore((s) => s.todayStr);
  const settings = useWaqtiStore((s) => s.settings);
  const subjects = useWaqtiStore((s) => s.subjects);
  const timetable = useWaqtiStore((s) => s.timetable);
  const exams = useWaqtiStore((s) => s.exams);
  const tasks = useWaqtiStore((s) => s.tasks);
  const habits = useWaqtiStore((s) => s.habits);
  const focusSessions = useWaqtiStore((s) => s.focusSessions);
  const updateTask = useWaqtiStore((s) => s.updateTask);
  const toggleHabitDate = useWaqtiStore((s) => s.toggleHabitDate);
  const setActiveNav = useWaqtiStore((s) => s.setActiveNav);
  const clearAllData = useWaqtiStore((s) => s.clearAllData);
  const refreshTodayIfNeeded = useWaqtiStore((s) => s.refreshTodayIfNeeded);

  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(new Date());
      refreshTodayIfNeeded();
    }, 1000);
    return () => clearInterval(interval);
  }, [refreshTodayIfNeeded]);

  const currentHHmm = getLocalTimeString(now, settings.timezone);
  const currentSeconds = String(now.getSeconds()).padStart(2, '0');
  const currentMinutesFromMidnight = timeToMinutes(currentHHmm);

  const greetingKey = useMemo(() => {
    const h = parseInt(currentHHmm.split(':')[0] ?? '12', 10);
    if (h >= 5 && h < 12) return 'greeting.morning';
    if (h >= 12 && h < 17) return 'greeting.afternoon';
    if (h >= 17 && h < 22) return 'greeting.evening';
    return 'greeting.night';
  }, [currentHHmm]);

  const todayDow = getWeekDayIndex(todayStr);

  const todaySlots = useMemo(() => {
    return timetable
      .filter((s) => s.dayOfWeek === todayDow)
      .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
  }, [timetable, todayDow]);

  const nextClassSlot = useMemo(() => {
    return (
      todaySlots.find((s) => timeToMinutes(s.endTime) > currentMinutesFromMidnight) ?? null
    );
  }, [todaySlots, currentMinutesFromMidnight]);

  const nextExam = useMemo(() => {
    const upcoming = exams
      .map((ex) => ({
        exam: ex,
        countdown: computeExamCountdown(
          ex.date,
          ex.startTime,
          now,
          lang,
          timeFormat,
          digitsStyle
        ),
      }))
      .filter((item) => item.countdown.status !== 'passed')
      .sort((a, b) => a.countdown.totalMinutesRemaining - b.countdown.totalMinutesRemaining);
    return upcoming[0] ?? null;
  }, [exams, now, lang, timeFormat, digitsStyle]);

  const todayFocusMinutes = useMemo(() => {
    return focusSessions
      .filter((f) => f.date === todayStr && f.mode === 'focus')
      .reduce((acc, cur) => acc + cur.durationMinutes, 0);
  }, [focusSessions, todayStr]);

  const completedTasksCount = tasks.filter((tk) => tk.status === 'done').length;
  const totalTasksCount = tasks.length;
  const checkedHabitsCount = habits.filter((h) => h.completedDates.includes(todayStr)).length;

  const dailyMomentumPercent = useMemo(() => {
    const totalItems = totalTasksCount + habits.length;
    if (totalItems === 0) return todayFocusMinutes > 0 ? 100 : 0;
    return Math.round(((completedTasksCount + checkedHabitsCount) / totalItems) * 100);
  }, [totalTasksCount, habits.length, completedTasksCount, checkedHabitsCount, todayFocusMinutes]);

  const formattedGregorianDate = formatLocalizedDate(
    todayStr,
    lang,
    'EEEE, d MMMM yyyy',
    digitsStyle
  );
  const formattedHijri = settings.showHijri
    ? formatHijriDate(todayStr, lang, digitsStyle)
    : '';

  return (
    <div className="space-y-6">
      {/* Demo Workspace Bar */}
      {settings.isDemoData && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-3">
          <div className="flex items-center gap-2.5 text-xs text-[var(--text-secondary)]">
            <Sparkles className="h-4 w-4 text-[var(--accent-primary)] shrink-0" />
            <span>{t('dashboard.demoBanner')}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onOpenOnboarding}
              className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-1.5 text-xs font-medium text-[var(--text-primary)] hover:border-[var(--accent-primary)] transition whitespace-nowrap"
            >
              {t('dashboard.launchOnboarding')}
            </button>
            <button
              type="button"
              onClick={clearAllData}
              className="flex items-center gap-1.5 rounded-xl border border-rose-500/25 bg-rose-500/10 px-3 py-1.5 text-xs font-medium text-rose-600 dark:text-rose-300 hover:bg-rose-500/20 transition whitespace-nowrap"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>{t('dashboard.clearDemo')}</span>
            </button>
          </div>
        </div>
      )}

      {/* Hero Section: Time-of-day Greeting, Live Expressive Clock, Next Event & Daily Momentum */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        <div className="lg:col-span-7 rounded-3xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 md:p-7 flex flex-col justify-between relative overflow-hidden">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-medium text-[var(--accent-primary)] mb-1">
                { formattedGregorianDate }
                {formattedHijri ? ` · ${formattedHijri}` : ''}
              </p>
              <h1 className="text-2xl md:text-3xl font-bold font-display text-[var(--text-primary)] tracking-tight">
                {t(greetingKey)}
              </h1>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                {t('dashboard.subtitle')}
              </p>
            </div>

            {/* Expressive Live Clock (Always LTR tabular-nums) */}
            <div
              dir="ltr"
              className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-4 py-3 text-end"
            >
              <div className="text-2xl md:text-3xl font-bold font-mono-tabular tracking-tight text-[var(--text-primary)]">
                {formatTime(currentHHmm)}
                <span className="text-sm text-[var(--text-muted)] ms-1">
                  :{digits(currentSeconds)}
                </span>
              </div>
              <div className="text-[11px] text-[var(--text-muted)] font-mono-tabular">
                {settings.timezone}
              </div>
            </div>
          </div>

          {/* 3 KPI Strip */}
          <div className="mt-6 grid grid-cols-3 gap-3 pt-5 border-t border-[var(--border-subtle)]">
            <div>
              <div className="text-xs text-[var(--text-muted)]">{t('dashboard.tasksCompleted')}</div>
              <div className="mt-1 text-xl font-bold font-mono-tabular text-[var(--text-primary)]">
                {digits(completedTasksCount)}/{digits(totalTasksCount)}
              </div>
            </div>
            <div>
              <div className="text-xs text-[var(--text-muted)]">{t('dashboard.habitsChecked')}</div>
              <div className="mt-1 text-xl font-bold font-mono-tabular text-[var(--text-primary)]">
                {digits(checkedHabitsCount)}/{digits(habits.length)}
              </div>
            </div>
            <div>
              <div className="text-xs text-[var(--text-muted)]">{t('dashboard.focusMinutes')}</div>
              <div className="mt-1 text-xl font-bold font-mono-tabular text-[var(--accent-primary)]">
                {digits(todayFocusMinutes)}m
              </div>
            </div>
          </div>
        </div>

        {/* Next Exam & Daily Progress Ring Card */}
        <div className="lg:col-span-5 rounded-3xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 flex flex-col justify-between">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="text-xs font-medium text-[var(--text-muted)]">
                {t('dashboard.nextExam')}
              </div>
              {nextExam ? (
                <>
                  <h2 className="mt-1 text-base font-bold text-[var(--text-primary)] truncate">
                    {nextExam.exam.title}
                  </h2>
                  <p className="mt-1 text-xs text-[var(--text-secondary)]">
                    {subjects.find((s) => s.id === nextExam.exam.subjectId)?.name} ·{' '}
                    <span className="font-semibold text-[var(--accent-primary)] font-mono-tabular">
                      {nextExam.countdown.label}
                    </span>
                  </p>
                </>
              ) : (
                <p className="mt-2 text-sm text-[var(--text-secondary)]">
                  {t('dashboard.noUpcomingExam')}
                </p>
              )}
            </div>

            {/* Circular Progress Ring */}
            <div className="relative h-20 w-20 shrink-0 flex items-center justify-center">
              <svg className="h-20 w-20 -rotate-90" viewBox="0 0 80 80">
                <circle
                  cx="40"
                  cy="40"
                  r="32"
                  fill="none"
                  stroke="var(--border-strong)"
                  strokeWidth="6"
                />
                <circle
                  cx="40"
                  cy="40"
                  r="32"
                  fill="none"
                  stroke="var(--accent-primary)"
                  strokeWidth="6"
                  strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 32}
                  strokeDashoffset={
                    2 * Math.PI * 32 * (1 - dailyMomentumPercent / 100)
                  }
                />
              </svg>
              <span className="absolute text-xs font-bold font-mono-tabular text-[var(--text-primary)]">
                {digits(dailyMomentumPercent)}%
              </span>
            </div>
          </div>

          {/* Next Class Mini Summary */}
          <div className="mt-5 pt-4 border-t border-[var(--border-subtle)] flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="text-xs text-[var(--text-muted)]">{t('dashboard.nextClass')}</div>
              {nextClassSlot ? (
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span className="text-sm font-semibold text-[var(--text-primary)] truncate">
                    {subjects.find((s) => s.id === nextClassSlot.subjectId)?.name}
                  </span>
                  <span
                    dir="ltr"
                    className="font-mono-tabular text-xs font-semibold text-[var(--accent-primary)] shrink-0"
                  >
                    {formatRange(nextClassSlot.startTime, nextClassSlot.endTime)}
                  </span>
                </div>
              ) : (
                <div className="mt-0.5 text-xs text-[var(--text-secondary)]">
                  {t('dashboard.noUpcomingClass')}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => setActiveNav('focus')}
              className="flex items-center gap-1.5 rounded-xl bg-[var(--accent-primary)] px-3.5 py-2 text-xs font-semibold text-white hover:opacity-95 transition whitespace-nowrap shrink-0"
            >
              <Timer className="h-3.5 w-3.5" />
              <span>{t('nav.focus')}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main 2-Column Content: Today's Academic Timeline + Tasks & Habits */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left/Start 7 Cols: Today's Timeline with Glowing NOW Line */}
        <div className="lg:col-span-7 rounded-3xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2.5">
              <Clock className="h-4 w-4 text-[var(--accent-primary)]" />
              <h2 className="text-base font-bold text-[var(--text-primary)]">
                {t('dashboard.todayTimeline')}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => onOpenQuickAdd('slot')}
              className="flex items-center gap-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-1.5 text-xs font-medium text-[var(--text-primary)] hover:border-[var(--accent-primary)] transition whitespace-nowrap"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>{t('timetable.addSlot')}</span>
            </button>
          </div>

          {/* Glowing NOW indicator bar */}
          <div className="flex items-center gap-3 mb-4">
            <span className="text-[11px] font-bold font-mono-tabular text-[var(--accent-primary)] px-2 py-0.5 rounded-md bg-[var(--accent-soft)]">
              {t('dashboard.nowIndicator')} ·{' '}
              <span dir="ltr">{formatTime(currentHHmm)}</span>
            </span>
            <div className="h-[2px] flex-1 bg-gradient-to-r rtl:bg-gradient-to-l from-[var(--accent-primary)] to-transparent opacity-60" />
          </div>

          {todaySlots.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[var(--border-strong)] p-8 text-center">
              <p className="text-sm text-[var(--text-secondary)]">{t('timetable.emptyDay')}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {todaySlots.map((slot) => {
                const subj = subjects.find((s) => s.id === slot.subjectId);
                const colorStyle = SUBJECT_COLORS[subj?.color ?? 'violet'];
                const startM = timeToMinutes(slot.startTime);
                const endM = timeToMinutes(slot.endTime);
                const isCurrent =
                  currentMinutesFromMidnight >= startM && currentMinutesFromMidnight < endM;

                return (
                  <div
                    key={slot.id}
                    className={`flex items-center justify-between gap-4 rounded-2xl border p-4 transition ${
                      isCurrent
                        ? 'border-[var(--accent-primary)] bg-[var(--accent-soft)]'
                        : 'border-[var(--border-subtle)] bg-[var(--bg-elevated)]'
                    }`}
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <span className={`h-3 w-3 rounded-full shrink-0 ${colorStyle.dot}`} />
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-[var(--text-primary)] truncate">
                          {subj?.name}
                        </div>
                        <div className="text-xs text-[var(--text-secondary)] truncate">
                          {slot.room} · {slot.teacher}
                        </div>
                      </div>
                    </div>
                    <div
                      dir="ltr"
                      className="text-xs font-semibold font-mono-tabular text-[var(--text-primary)] whitespace-nowrap shrink-0"
                    >
                      {formatRange(slot.startTime, slot.endTime)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Subtle Study Tip */}
          <div className="mt-6 pt-5 border-t border-[var(--border-subtle)] flex items-start gap-3">
            <BookOpen className="h-4 w-4 text-[var(--accent-primary)] shrink-0 mt-0.5" />
            <div>
              <div className="text-xs font-semibold text-[var(--text-primary)]">
                {t('dashboard.tipTitle')}
              </div>
              <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                {t('dashboard.tipBody')}
              </p>
            </div>
          </div>
        </div>

        {/* Right/End 5 Cols: Priority Tasks & Habit Streaks */}
        <div className="lg:col-span-5 space-y-6">
          {/* Tasks Card */}
          <div className="rounded-3xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-bold text-[var(--text-primary)]">
                  {t('lessons.tab.tasks')}
                </h2>
                <p className="text-xs text-[var(--text-muted)]">
                  {plural('tasks', tasks.filter((tk) => tk.status !== 'done').length)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onOpenQuickAdd('task')}
                className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-1.5 text-xs font-medium text-[var(--text-primary)] hover:border-[var(--accent-primary)] transition"
              >
                + {t('lessons.addTask')}
              </button>
            </div>

            <div className="space-y-2.5">
              {tasks.slice(0, 4).map((tk) => {
                const subj = subjects.find((s) => s.id === tk.subjectId);
                const isDone = tk.status === 'done';
                return (
                  <button
                    key={tk.id}
                    type="button"
                    onClick={() =>
                      updateTask(tk.id, { status: isDone ? 'todo' : 'done' })
                    }
                    className="flex w-full items-center justify-between gap-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3.5 py-3 text-start hover:border-[var(--accent-primary)] transition"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {isDone ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                      ) : (
                        <Circle className="h-4 w-4 text-[var(--text-muted)] shrink-0" />
                      )}
                      <div className="min-w-0">
                        <div
                          className={`text-xs font-semibold truncate ${
                            isDone
                              ? 'line-through text-[var(--text-muted)]'
                              : 'text-[var(--text-primary)]'
                          }`}
                        >
                          {tk.title}
                        </div>
                        <div className="text-[11px] text-[var(--text-muted)] truncate">
                          {subj?.name} · <span dir="ltr">{tk.dueDate}</span>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Habits Card */}
          <div className="rounded-3xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Flame className="h-4 w-4 text-amber-500" />
                <h2 className="text-base font-bold text-[var(--text-primary)]">
                  {t('nav.habits')}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setActiveNav('habits')}
                className="text-xs font-medium text-[var(--accent-primary)] hover:underline"
              >
                {t('habits.title')} {lang === 'ar' ? '←' : '→'}
              </button>
            </div>

            <div className="space-y-2.5">
              {habits.map((h) => {
                const checked = h.completedDates.includes(todayStr);
                const streak = calculateHabitStreak(h.completedDates, todayStr);
                return (
                  <button
                    key={h.id}
                    type="button"
                    onClick={() => toggleHabitDate(h.id, todayStr)}
                    className={`flex w-full items-center justify-between gap-3 rounded-2xl border px-3.5 py-3 text-start transition ${
                      checked
                        ? 'border-emerald-500/30 bg-emerald-500/10'
                        : 'border-[var(--border-subtle)] bg-[var(--bg-elevated)]'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {checked ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                      ) : (
                        <Circle className="h-4 w-4 text-[var(--text-muted)] shrink-0" />
                      )}
                      <span className="text-xs font-semibold text-[var(--text-primary)] truncate">
                        {h.name}
                      </span>
                    </div>
                    <span className="flex items-center gap-1 text-xs font-mono-tabular text-amber-500 shrink-0">
                      <Flame className="h-3.5 w-3.5" />
                      {digits(streak)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
