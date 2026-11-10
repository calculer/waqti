import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useWaqtiStore } from '../store/useWaqtiStore';
import { useTranslation } from '../hooks/useTranslation';
import {
  formatLocalizedDate,
  getMonthCalendarGrid,
  getOrderedWeekdays,
  getWeekDates,
  getWeekDayIndex,
  shiftDateString,
  shiftMonthString,
} from '../lib/dates';
import { SUBJECT_COLORS } from '../lib/colors';

export const CalendarView: React.FC = () => {
  const { t, lang, dir, digitsStyle, digits, formatRange, formatTime } = useTranslation();
  const todayStr = useWaqtiStore((s) => s.todayStr);
  const weekStart = useWaqtiStore((s) => s.settings.weekStart);
  const subjects = useWaqtiStore((s) => s.subjects);
  const timetable = useWaqtiStore((s) => s.timetable);
  const exams = useWaqtiStore((s) => s.exams);
  const tasks = useWaqtiStore((s) => s.tasks);
  const habits = useWaqtiStore((s) => s.habits);

  const [viewMode, setViewMode] = useState<'month' | 'week' | 'day' | 'agenda'>('month');
  const [cursorDate, setCursorDate] = useState(todayStr);

  const orderedWeekdays = useMemo(
    () => getOrderedWeekdays(lang, weekStart, 'EEE'),
    [lang, weekStart]
  );

  const monthGrid = useMemo(
    () => getMonthCalendarGrid(cursorDate, weekStart),
    [cursorDate, weekStart]
  );

  const weekDates = useMemo(
    () => getWeekDates(cursorDate, weekStart),
    [cursorDate, weekStart]
  );

  const handlePrev = () => {
    if (viewMode === 'month') setCursorDate((d) => shiftMonthString(d, -1));
    else if (viewMode === 'week') setCursorDate((d) => shiftDateString(d, -7));
    else setCursorDate((d) => shiftDateString(d, -1));
  };

  const handleNext = () => {
    if (viewMode === 'month') setCursorDate((d) => shiftMonthString(d, 1));
    else if (viewMode === 'week') setCursorDate((d) => shiftDateString(d, 7));
    else setCursorDate((d) => shiftDateString(d, 1));
  };

  const getEventsForDate = (dateStr: string) => {
    const dow = getWeekDayIndex(dateStr);
    const dayClasses = timetable.filter((s) => s.dayOfWeek === dow);
    const dayExams = exams.filter((e) => e.date === dateStr);
    const dayTasks = tasks.filter((tk) => tk.dueDate === dateStr);
    const dayHabits = habits.filter((h) => h.completedDates.includes(dateStr));
    return { dayClasses, dayExams, dayTasks, dayHabits };
  };

  const selectedDayEvents = useMemo(
    () => getEventsForDate(cursorDate),
    [cursorDate, timetable, exams, tasks, habits]
  );

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-display text-[var(--text-primary)]">
            {t('calendar.title')}
          </h1>
          <p className="text-sm text-[var(--text-secondary)]">{t('calendar.subtitle')}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Today Jump + Prev/Next */}
          <div className="flex items-center gap-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-1">
            <button
              type="button"
              onClick={handlePrev}
              aria-label="Previous"
              className="rounded-lg p-1.5 text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]"
            >
              {dir === 'rtl' ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronLeft className="h-4 w-4" />
              )}
            </button>
            <button
              type="button"
              onClick={() => setCursorDate(todayStr)}
              className="rounded-lg px-3 py-1 text-xs font-semibold text-[var(--accent-primary)] hover:bg-[var(--accent-soft)]"
            >
              {t('calendar.today')}
            </button>
            <button
              type="button"
              onClick={handleNext}
              aria-label="Next"
              className="rounded-lg p-1.5 text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]"
            >
              {dir === 'rtl' ? (
                <ChevronLeft className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </button>
          </div>

          <div className="flex items-center rounded-xl bg-[var(--bg-elevated)] p-1">
            {(['month', 'week', 'day', 'agenda'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setViewMode(m)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                  viewMode === m
                    ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm'
                    : 'text-[var(--text-secondary)]'
                }`}
              >
                {t(`calendar.${m}`)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Current Month/Date Heading */}
      <div className="text-base font-bold text-[var(--text-primary)]">
        {formatLocalizedDate(cursorDate, lang, 'MMMM yyyy', digitsStyle)}
      </div>

      {viewMode === 'month' || viewMode === 'week' ? (
        <div className="rounded-3xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 md:p-6">
          {/* Weekday Headers */}
          <div className="grid grid-cols-7 gap-2 mb-3 text-center">
            {orderedWeekdays.map((w) => (
              <div
                key={w.dayIndex}
                className="text-xs font-semibold text-[var(--text-muted)] py-1"
              >
                {w.label}
              </div>
            ))}
          </div>

          {/* Calendar Cells */}
          <div className="grid grid-cols-7 gap-2">
            {(viewMode === 'month' ? monthGrid : weekDates).map((dStr) => {
              const isToday = dStr === todayStr;
              const isSelected = dStr === cursorDate;
              const isCurrentMonth = dStr.slice(0, 7) === cursorDate.slice(0, 7);
              const dayNumber = parseInt(dStr.slice(8, 10), 10);
              const { dayClasses, dayExams, dayTasks, dayHabits } = getEventsForDate(dStr);

              return (
                <button
                  key={dStr}
                  type="button"
                  onClick={() => setCursorDate(dStr)}
                  className={`min-h-[76px] md:min-h-[96px] rounded-2xl border p-2.5 flex flex-col justify-between text-start transition ${
                    isSelected
                      ? 'border-[var(--accent-primary)] bg-[var(--accent-soft)]'
                      : isToday
                        ? 'border-[var(--accent-primary)] bg-[var(--bg-elevated)]'
                        : 'border-[var(--border-subtle)] bg-[var(--bg-elevated)] hover:border-[var(--border-strong)]'
                  } ${!isCurrentMonth && viewMode === 'month' ? 'opacity-45' : ''}`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span
                      className={`text-xs font-bold font-mono-tabular ${
                        isToday ? 'text-[var(--accent-primary)]' : 'text-[var(--text-primary)]'
                      }`}
                    >
                      {digits(dayNumber)}
                    </span>
                    {dayExams.length > 0 && (
                      <span className="h-2 w-2 rounded-full bg-rose-500" />
                    )}
                  </div>

                  {/* Colored Event Dots & Mini Preview */}
                  <div className="space-y-1 w-full overflow-hidden">
                    {dayExams.slice(0, 1).map((ex) => (
                      <div
                        key={ex.id}
                        className="truncate text-[10px] font-semibold text-rose-500"
                      >
                        {ex.title}
                      </div>
                    ))}
                    <div className="flex items-center gap-1 flex-wrap">
                      {dayClasses.slice(0, 3).map((cl) => {
                        const subj = subjects.find((s) => s.id === cl.subjectId);
                        return (
                          <span
                            key={cl.id}
                            className={`h-1.5 w-1.5 rounded-full ${
                              SUBJECT_COLORS[subj?.color ?? 'violet'].dot
                            }`}
                          />
                        );
                      })}
                      {dayTasks.length > 0 && (
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                      )}
                      {dayHabits.length > 0 && (
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* Selected Day / Agenda Detail Panel */}
      <div className="rounded-3xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 space-y-4">
        <h2 className="text-base font-bold text-[var(--text-primary)]">
          {formatLocalizedDate(cursorDate, lang, 'EEEE, d MMMM yyyy', digitsStyle)}
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Classes */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-[var(--text-muted)]">
              {t('nav.timetable')}
            </h3>
            {selectedDayEvents.dayClasses.map((cl) => {
              const subj = subjects.find((s) => s.id === cl.subjectId);
              return (
                <div
                  key={cl.id}
                  className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3 text-xs flex justify-between"
                >
                  <span className="font-semibold text-[var(--text-primary)] truncate">
                    {subj?.name}
                  </span>
                  <span dir="ltr" className="font-mono-tabular text-[var(--text-secondary)] ms-2">
                    {formatRange(cl.startTime, cl.endTime)}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Exams */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-[var(--text-muted)]">{t('nav.exams')}</h3>
            {selectedDayEvents.dayExams.map((ex) => (
              <div
                key={ex.id}
                className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs flex justify-between"
              >
                <span className="font-semibold text-[var(--text-primary)] truncate">
                  {ex.title}
                </span>
                <span dir="ltr" className="font-mono-tabular text-rose-500 ms-2">
                  {formatTime(ex.startTime)}
                </span>
              </div>
            ))}
          </div>

          {/* Tasks */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-[var(--text-muted)]">
              {t('lessons.tab.tasks')}
            </h3>
            {selectedDayEvents.dayTasks.map((tk) => (
              <div
                key={tk.id}
                className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3 text-xs flex justify-between"
              >
                <span className="font-semibold text-[var(--text-primary)] truncate">
                  {tk.title}
                </span>
                <span dir="ltr" className="font-mono-tabular text-[var(--text-secondary)] ms-2">
                  {formatTime(tk.dueTime)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
