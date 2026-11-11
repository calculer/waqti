import React, { useMemo, useState } from 'react';
import {
  BellRing,
  BookOpen,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Flame,
  GraduationCap,
  Layers,
  Plus,
} from 'lucide-react';
import { useWaqtiStore } from '../store/useWaqtiStore';
import { useTranslation } from '../hooks/useTranslation';
import {
  formatGmtOffsetForDate,
  formatHijriDate,
  formatLocalizedDate,
  getLocalTimeString,
  getMonthCalendarGrid,
  getOccurrencesForDate,
  getOrderedWeekdays,
  getWeekDates,
  getWeekDayIndex,
  packOverlappingEvents,
  shiftDateString,
  shiftMonthString,
  summarizeMonthCellEvents,
  timeToMinutes,
} from '../lib/dates';
import { getSubjectColor } from '../lib/colors';
import { SessionMetaBadges } from '../components/SessionMetaBadges';
import type { QuickAddTab } from '../components/QuickAddModal';
import type { DeliveryMode, MeetingPlatform, SessionType } from '../types';

type CalendarMode = 'month' | 'week' | 'day' | 'agenda';
type EventFilterKey = 'classes' | 'exams' | 'tasks' | 'habits' | 'alarms';

interface CalendarEventItem {
  id: string;
  kind: 'class' | 'exam' | 'task' | 'alarm';
  title: string;
  startTime: string;
  endTime: string;
  subjectId?: string;
  colorId: string;
  room?: string;
  countdownLabel?: string;
  sessionType?: SessionType;
  deliveryMode?: DeliveryMode;
  section?: string;
  group?: string;
  meetingUrl?: string;
  platform?: MeetingPlatform;
}

export const CalendarView: React.FC<{
  onOpenQuickAdd?: (tab?: QuickAddTab, dateStr?: string) => void;
}> = ({ onOpenQuickAdd }) => {
  const { t, lang, dir, digitsStyle, timeFormat, digits, formatRange, formatTime } =
    useTranslation();

  const todayStr = useWaqtiStore((s) => s.todayStr);
  const settings = useWaqtiStore((s) => s.settings);
  const subjects = useWaqtiStore((s) => s.subjects);
  const timetable = useWaqtiStore((s) => s.timetable);
  const exams = useWaqtiStore((s) => s.exams);
  const tasks = useWaqtiStore((s) => s.tasks);
  const habits = useWaqtiStore((s) => s.habits);
  const alarms = useWaqtiStore((s) => s.alarms);

  const [mode, setMode] = useState<CalendarMode>('month');
  const [cursorDate, setCursorDate] = useState<string>(todayStr);
  const [selectedDay, setSelectedDay] = useState<string>(todayStr);
  const [heatTintEnabled, setHeatTintEnabled] = useState<boolean>(false);
  const [filters, setFilters] = useState<Record<EventFilterKey, boolean>>({
    classes: true,
    exams: true,
    tasks: true,
    habits: true,
    alarms: true,
  });
  const [filterSessionType, setFilterSessionType] = useState<'all' | SessionType>('all');
  const [filterDeliveryMode, setFilterDeliveryMode] = useState<'all' | DeliveryMode>('all');

  const toggleFilter = (key: EventFilterKey) => {
    setFilters((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const orderedWeekdays = useMemo(
    () => getOrderedWeekdays(lang, settings.weekStart, 'EEE'),
    [lang, settings.weekStart]
  );

  const monthGrid = useMemo(
    () => getMonthCalendarGrid(cursorDate, settings.weekStart),
    [cursorDate, settings.weekStart]
  );

  const weekDates = useMemo(
    () => getWeekDates(cursorDate, settings.weekStart),
    [cursorDate, settings.weekStart]
  );

  const currentMonthPrefix = cursorDate.slice(0, 7);

  // Single source of truth via getOccurrencesForDate for all views (Month, Week, Day, Agenda, Side Panel)
  const getOccurrencesBundleForDate = (dateStr: string) =>
    getOccurrencesForDate(dateStr, {
      timetable,
      subjects,
      exams,
      tasks,
      habits,
      alarms,
      filters,
      filterSessionType,
      filterDeliveryMode,
      includeAllEvents: true,
      lang,
      timeFormat,
      digitsStyle,
    });

  const getEventsForDate = (dateStr: string): CalendarEventItem[] => {
    const occ = getOccurrencesBundleForDate(dateStr);
    return occ.all
      .filter(
        (item): item is typeof item & { kind: 'class' | 'exam' | 'task' | 'alarm' } =>
          item.kind !== 'habit'
      )
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
  };

  const handlePrev = () => {
    if (mode === 'month') {
      setCursorDate((d) => shiftMonthString(d, -1));
    } else if (mode === 'week') {
      setCursorDate((d) => shiftDateString(d, -7));
    } else {
      const next = shiftDateString(cursorDate, -1);
      setCursorDate(next);
      setSelectedDay(next);
    }
  };

  const handleNext = () => {
    if (mode === 'month') {
      setCursorDate((d) => shiftMonthString(d, 1));
    } else if (mode === 'week') {
      setCursorDate((d) => shiftDateString(d, 7));
    } else {
      const next = shiftDateString(cursorDate, 1);
      setCursorDate(next);
      setSelectedDay(next);
    }
  };

  const selectedDayEvents = useMemo(
    () => getEventsForDate(selectedDay),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      selectedDay,
      exams,
      timetable,
      tasks,
      habits,
      alarms,
      subjects,
      filters,
      filterSessionType,
      filterDeliveryMode,
      lang,
      timeFormat,
      digitsStyle,
    ]
  );

  const selectedDayHabits = useMemo(() => {
    if (!filters.habits) return [];
    return habits.map((h) => ({
      ...h,
      doneOnDay: h.completedDates.includes(selectedDay),
    }));
  }, [habits, selectedDay, filters.habits]);

  const nowTimeStr = getLocalTimeString(new Date(), settings.timezone);
  const nowMinutes = timeToMinutes(nowTimeStr);
  const gridStartHour = 7;
  const gridEndHour = 22;
  const totalGridMinutes = (gridEndHour - gridStartHour) * 60;
  const nowTopPercent = Math.max(
    0,
    Math.min(100, ((nowMinutes - gridStartHour * 60) / totalGridMinutes) * 100)
  );

  return (
    <div className="space-y-5">
      {/* Top Header: Title, Navigation Controls, View Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-display text-[var(--text-primary)]">
            {formatLocalizedDate(cursorDate, lang, 'MMMM yyyy', digitsStyle)}
          </h1>
          <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
            <span>{t('calendar.title')}</span>
            {settings.showHijri && (
              <span className="text-[var(--accent-primary)] font-medium">
                · {formatHijriDate(selectedDay, lang, digitsStyle)}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Prev / Today / Next */}
          <div className="flex items-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-1">
            <button
              type="button"
              onClick={handlePrev}
              aria-label="Previous"
              className="rounded-lg p-1.5 text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"
            >
              {dir === 'rtl' ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronLeft className="h-4 w-4" />
              )}
            </button>
            <button
              type="button"
              onClick={() => {
                setCursorDate(todayStr);
                setSelectedDay(todayStr);
              }}
              className="px-3 py-1 text-xs font-semibold text-[var(--text-primary)] hover:text-[var(--accent-primary)]"
            >
              {t('calendar.today')}
            </button>
            <button
              type="button"
              onClick={handleNext}
              aria-label="Next"
              className="rounded-lg p-1.5 text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"
            >
              {dir === 'rtl' ? (
                <ChevronLeft className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </button>
          </div>

          {/* Mode Tabs */}
          <div className="flex items-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-1">
            {(
              [
                { id: 'month', label: t('calendar.month') },
                { id: 'week', label: t('calendar.week') },
                { id: 'day', label: t('calendar.day') },
                { id: 'agenda', label: t('calendar.agenda') },
              ] as const
            ).map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setMode(m.id)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  mode === m.id
                    ? 'bg-[var(--accent-soft)] text-[var(--accent-primary)]'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Filter Chips + Class Type/Mode Sub-Filters + Heat-Tint Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-2.5">
        <div className="flex flex-wrap items-center gap-2">
          {(
            [
              {
                key: 'classes' as const,
                label: t('calendar.filterClasses'),
                icon: <BookOpen className="h-3.5 w-3.5" />,
              },
              {
                key: 'exams' as const,
                label: t('calendar.filterExams'),
                icon: <GraduationCap className="h-3.5 w-3.5" />,
              },
              {
                key: 'tasks' as const,
                label: t('calendar.filterTasks'),
                icon: <CheckSquare className="h-3.5 w-3.5" />,
              },
              {
                key: 'habits' as const,
                label: t('calendar.filterHabits'),
                icon: <Flame className="h-3.5 w-3.5" />,
              },
              {
                key: 'alarms' as const,
                label: t('calendar.filterAlarms'),
                icon: <BellRing className="h-3.5 w-3.5" />,
              },
            ]
          ).map((f) => {
            const active = filters[f.key];
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => toggleFilter(f.key)}
                className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
                  active
                    ? 'border-[var(--accent-primary)] bg-[var(--accent-soft)] text-[var(--accent-primary)]'
                    : 'border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-muted)]'
                }`}
              >
                {f.icon}
                <span>{f.label}</span>
              </button>
            );
          })}

          {filters.classes && (
            <>
              <select
                value={filterSessionType}
                onChange={(e) => setFilterSessionType(e.target.value as 'all' | SessionType)}
                aria-label={t('classMode.filterByType')}
                className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2.5 py-1.5 text-xs font-semibold text-[var(--text-primary)]"
              >
                <option value="all">{t('classMode.allTypes')}</option>
                <option value="lecture">{t('classMode.type.lecture')}</option>
                <option value="td">{t('classMode.type.td')}</option>
                <option value="tp">{t('classMode.type.tp')}</option>
                <option value="other">{t('classMode.type.other')}</option>
              </select>

              <select
                value={filterDeliveryMode}
                onChange={(e) => setFilterDeliveryMode(e.target.value as 'all' | DeliveryMode)}
                aria-label={t('classMode.filterByMode')}
                className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2.5 py-1.5 text-xs font-semibold text-[var(--text-primary)]"
              >
                <option value="all">{t('classMode.allModes')}</option>
                <option value="in_person">{t('classMode.mode.in_person')}</option>
                <option value="remote">{t('classMode.mode.remote')}</option>
                <option value="hybrid">{t('classMode.mode.hybrid')}</option>
              </select>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={() => setHeatTintEnabled((v) => !v)}
          className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
            heatTintEnabled
              ? 'border-[var(--accent-primary)] bg-[var(--accent-soft)] text-[var(--accent-primary)]'
              : 'border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-secondary)]'
          }`}
        >
          <Layers className="h-3.5 w-3.5" />
          <span>{t('calendar.heatTint')}</span>
        </button>
      </div>

      {/* MONTH VIEW + SIDE AGENDA PANEL (Strictly Zero-Overflow Day Cells) */}
      {mode === 'month' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* 7-Column Calendar Grid */}
          <div className="lg:col-span-8 rounded-3xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 md:p-5 shadow-sm">
            {/* Weekday Headers: Full weekday names on sm+ screens, clean unclipped labels on narrow screens */}
            <div className="grid grid-cols-7 gap-1.5 mb-2">
              {orderedWeekdays.map((w) => {
                const isWeekend = settings.weekendDays.includes(w.dayIndex);
                return (
                  <div
                    key={w.dayIndex}
                    data-testid="calendar-weekday-header"
                    className={`text-center text-[11px] font-bold py-1.5 px-1 rounded-lg truncate ${
                      isWeekend
                        ? 'text-[var(--accent-primary)] bg-[var(--accent-soft)]/50'
                        : 'text-[var(--text-muted)]'
                    }`}
                  >
                    <span className="hidden sm:inline">{w.fullLabel}</span>
                    <span className="sm:hidden">{w.shortLabel}</span>
                  </div>
                );
              })}
            </div>

            {/* 42 Day Cells: Fixed Height + Overflow Hidden + Max 3 Dots + +N Badge */}
            <div className="grid grid-cols-7 gap-1.5">
              {monthGrid.map((dStr) => {
                const isCurrentMonth = dStr.startsWith(currentMonthPrefix);
                const isToday = dStr === todayStr;
                const isSelected = dStr === selectedDay;
                const dow = getWeekDayIndex(dStr);
                const isWeekend = settings.weekendDays.includes(dow);
                const dayNumber = parseInt(dStr.slice(8, 10), 10);

                const dayOccurrenceBundle = getOccurrencesBundleForDate(dStr);
                const dayEvents = dayOccurrenceBundle.all;
                const { visibleDots, overflowCount } = summarizeMonthCellEvents(dayEvents, 3);
                const hasExam = dayOccurrenceBundle.exams.length > 0;

                // Subtle heat tint when busyness toggle is enabled
                const heatClass =
                  heatTintEnabled && dayEvents.length >= 4
                    ? 'bg-[var(--accent-soft)]'
                    : heatTintEnabled && dayEvents.length >= 2
                      ? 'bg-[var(--accent-soft)]/50'
                      : isWeekend
                        ? 'bg-[var(--bg-elevated)]/65'
                        : 'bg-[var(--bg-elevated)]';

                return (
                  <button
                    key={dStr}
                    type="button"
                    data-calendar-date={dStr}
                    data-calendar-dow={dow}
                    data-event-count={dayEvents.length}
                    data-class-count={dayOccurrenceBundle.classes.length}
                    onClick={() => setSelectedDay(dStr)}
                    className={`group relative min-h-[64px] sm:min-h-[82px] lg:min-h-[96px] rounded-2xl border p-2.5 flex flex-col justify-between text-start overflow-hidden transition ${heatClass} ${
                      isSelected
                        ? 'border-[var(--accent-primary)] ring-2 ring-[var(--accent-primary)]/30'
                        : hasExam
                          ? 'border-amber-500/50'
                          : 'border-[var(--border-subtle)] hover:border-[var(--border-strong)]'
                    } ${!isCurrentMonth ? 'opacity-40' : ''}`}
                  >
                    {/* Top Row: Day Number (Filled Honey Circle for Today) + Exam Badge Icon */}
                    <div className="flex items-center justify-between w-full shrink-0">
                      <span
                        className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold tabular-nums ${
                          isToday
                            ? 'btn-primary-waqti shadow-sm'
                            : isSelected
                              ? 'text-[var(--accent-strong)] font-extrabold'
                              : 'text-[var(--text-primary)]'
                        }`}
                      >
                        {digits(dayNumber)}
                      </span>

                      {hasExam && (
                        <span
                          title={t('nav.exams')}
                          className="h-2 w-2 rotate-45 bg-amber-500 ring-2 ring-amber-500/30 shrink-0"
                        />
                      )}
                    </div>

                    {/* Bottom Row: Non-wrapping 6px Event Dots (Max 3) + "+N" Overflow Chip */}
                    <div className="flex items-center justify-between gap-1 w-full shrink-0 pt-0.5">
                      <div className="flex items-center gap-1 shrink-0">
                        {visibleDots.map((ev) => {
                          const cStyle = getSubjectColor(ev.colorId);
                          const isEx = ev.kind === 'exam';
                          return (
                            <span
                              key={ev.id}
                              className={`h-1.5 w-1.5 shrink-0 ${
                                isEx ? 'rotate-45 rounded-[1px]' : 'rounded-full'
                              } ${cStyle.dot}`}
                            />
                          );
                        })}
                      </div>

                      {overflowCount > 0 && (
                        <span
                          dir="ltr"
                          className="rounded-md bg-[var(--bg-surface)] border border-[var(--border-subtle)] px-1 py-0.2 text-[9px] font-bold font-mono tabular-nums text-[var(--accent-primary)] leading-none shrink-0"
                        >
                          +{digits(overflowCount)}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selected Day Agenda Popover / Side Panel */}
          <div className="lg:col-span-4 rounded-3xl border border-[var(--border-strong)] bg-[var(--bg-surface)] p-5 space-y-4 shadow-sm lg:sticky lg:top-24">
            <div className="flex items-start justify-between gap-3 border-b border-[var(--border-subtle)] pb-3.5">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--accent-primary)]">
                  {t('calendar.selectedDayAgenda')}
                </div>
                <h2 className="text-base font-bold font-display text-[var(--text-primary)] mt-0.5">
                  {formatLocalizedDate(selectedDay, lang, 'EEEE, d MMMM', digitsStyle)}
                </h2>
                {settings.showHijri && (
                  <div className="text-xs text-[var(--text-muted)] mt-0.5">
                    {formatHijriDate(selectedDay, lang, digitsStyle)}
                  </div>
                )}
              </div>

              {onOpenQuickAdd && (
                <button
                  type="button"
                  onClick={() => onOpenQuickAdd('task', selectedDay)}
                  className="inline-flex items-center gap-1.5 rounded-xl btn-primary-waqti px-3 py-2 text-xs font-semibold shrink-0"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>{t('calendar.addEventOnDay')}</span>
                </button>
              )}
            </div>

            {selectedDayEvents.length === 0 && selectedDayHabits.length === 0 ? (
              <p className="text-xs text-[var(--text-muted)] py-8 text-center">
                {t('calendar.noEventsDay')}
              </p>
            ) : (
              <div className="space-y-2.5 max-h-[460px] overflow-y-auto pe-1">
                {selectedDayEvents.map((ev) => {
                  const cStyle = getSubjectColor(ev.colorId);
                  return (
                    <div
                      key={ev.id}
                      className={`rounded-2xl border p-3.5 transition ${cStyle.softBg} ${cStyle.border}`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span
                          dir="ltr"
                          className="text-xs font-mono tabular-nums font-bold text-[var(--text-primary)]"
                        >
                          {ev.kind === 'alarm' || ev.kind === 'task'
                            ? formatTime(ev.startTime)
                            : formatRange(ev.startTime, ev.endTime)}
                        </span>

                        <span
                          className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md bg-[var(--bg-surface)] ${cStyle.text}`}
                        >
                          {ev.kind === 'exam'
                            ? t('nav.exams')
                            : ev.kind === 'class'
                              ? t('nav.timetable')
                              : ev.kind === 'alarm'
                                ? t('nav.alarms')
                                : t('nav.lessons')}
                        </span>
                      </div>

                      <div className="text-sm font-bold text-[var(--text-primary)]">
                        {ev.title}
                      </div>

                      {(ev.sessionType || ev.deliveryMode) && (
                        <div className="mt-1.5">
                          <SessionMetaBadges
                            type={ev.sessionType}
                            mode={ev.deliveryMode}
                            section={ev.section}
                            group={ev.group}
                            platform={ev.platform}
                            compact
                          />
                        </div>
                      )}

                      <div className="flex flex-wrap items-center justify-between gap-2 mt-2 text-xs text-[var(--text-secondary)]">
                        {ev.room && <span>{ev.room}</span>}
                        {ev.countdownLabel && (
                          <span className="font-semibold text-[var(--accent-primary)]">
                            {ev.countdownLabel}
                          </span>
                        )}
                        {ev.meetingUrl &&
                          (ev.deliveryMode === 'remote' || ev.deliveryMode === 'hybrid') && (
                            <a
                              href={ev.meetingUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 rounded-lg bg-sky-600 hover:bg-sky-500 text-white px-2.5 py-1 text-[11px] font-bold transition"
                            >
                              <ExternalLink className="h-3 w-3" />
                              <span>{t('classMode.joinCall')}</span>
                            </a>
                          )}
                      </div>
                    </div>
                  );
                })}

                {selectedDayHabits.length > 0 && (
                  <div className="pt-2 border-t border-[var(--border-subtle)] space-y-2">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                      {t('nav.habits')}
                    </div>
                    {selectedDayHabits.map((h) => (
                      <div
                        key={h.id}
                        className="flex items-center justify-between rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 text-xs"
                      >
                        <span className="font-medium text-[var(--text-primary)] truncate">
                          {h.name}
                        </span>
                        <span
                          className={`font-bold ${
                            h.doneOnDay ? 'text-emerald-600 dark:text-emerald-400' : 'text-[var(--text-muted)]'
                          }`}
                        >
                          {h.doneOnDay ? '✓' : '○'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* WEEK & DAY TIME-GRID VIEWS (With Side-By-Side Column Packing for Overlapping Events) */}
      {(mode === 'week' || mode === 'day') && (
        <div className="rounded-3xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <div className="min-w-[680px]">
              {/* Sticky Day Column Headers */}
              <div
                className={`grid border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)] ${
                  mode === 'week' ? 'grid-cols-8' : 'grid-cols-2'
                }`}
              >
                <div
                  dir="ltr"
                  data-testid="calendar-tz-gutter"
                  className="p-3 text-center text-xs font-mono text-[var(--text-muted)] border-e border-[var(--border-subtle)]"
                >
                  {formatGmtOffsetForDate(cursorDate, settings.timezone)}
                </div>
                {(mode === 'week' ? weekDates : [selectedDay]).map((dStr) => {
                  const isToday = dStr === todayStr;
                  return (
                    <button
                      key={dStr}
                      type="button"
                      onClick={() => setSelectedDay(dStr)}
                      className={`p-3 text-center border-e last:border-e-0 border-[var(--border-subtle)] transition ${
                        isToday ? 'bg-[var(--accent-soft)]' : ''
                      }`}
                    >
                      <div className="text-xs font-bold text-[var(--text-primary)]">
                        {formatLocalizedDate(dStr, lang, 'EEE d', digitsStyle)}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* 07:00 - 22:00 Time Grid */}
              <div
                className={`relative grid ${
                  mode === 'week' ? 'grid-cols-8' : 'grid-cols-2'
                }`}
                style={{ height: '720px' }}
              >
                {/* Time Labels Column */}
                <div className="border-e border-[var(--border-subtle)] bg-[var(--bg-elevated)]/40 flex flex-col justify-between py-2 px-2 text-end">
                  {Array.from({ length: gridEndHour - gridStartHour + 1 }, (_, i) => {
                    const hr = gridStartHour + i;
                    const tStr = `${String(hr).padStart(2, '0')}:00`;
                    return (
                      <div
                        key={hr}
                        dir="ltr"
                        className="text-[10px] font-mono tabular-nums text-[var(--text-muted)] leading-none"
                      >
                        {formatTime(tStr)}
                      </div>
                    );
                  })}
                </div>

                {/* Day Columns with Packed Events */}
                {(mode === 'week' ? weekDates : [selectedDay]).map((dStr) => {
                  const rawEvents = getEventsForDate(dStr);
                  const packedEvents = packOverlappingEvents(rawEvents);
                  const isToday = dStr === todayStr;

                  return (
                    <div
                      key={dStr}
                      className="relative border-e last:border-e-0 border-[var(--border-subtle)]"
                    >
                      {/* Horizontal Hour Guide Lines */}
                      {Array.from({ length: gridEndHour - gridStartHour }, (_, i) => (
                        <div
                          key={i}
                          className="border-b border-[var(--border-subtle)]/50 w-full"
                          style={{ height: `${100 / (gridEndHour - gridStartHour)}%` }}
                        />
                      ))}

                      {/* Glowing "Now" Line */}
                      {isToday &&
                        nowMinutes >= gridStartHour * 60 &&
                        nowMinutes <= gridEndHour * 60 && (
                          <div
                            className="absolute inset-x-0 z-20 flex items-center pointer-events-none"
                            style={{ top: `${nowTopPercent}%` }}
                          >
                            <span className="h-2.5 w-2.5 rounded-full bg-[var(--accent-primary)] -ms-1 shadow" />
                            <div className="h-0.5 w-full bg-[var(--accent-primary)]" />
                          </div>
                        )}

                      {/* Side-by-side Packed Event Blocks */}
                      {packedEvents.map((ev) => {
                        const sMin = Math.max(gridStartHour * 60, timeToMinutes(ev.startTime));
                        const eMin = Math.min(
                          gridEndHour * 60,
                          Math.max(sMin + 30, timeToMinutes(ev.endTime))
                        );
                        const topPct = ((sMin - gridStartHour * 60) / totalGridMinutes) * 100;
                        const heightPct = Math.max(
                          5,
                          ((eMin - sMin) / totalGridMinutes) * 100
                        );
                        const widthPct = 100 / ev.totalCols;
                        const startPct = ev.colIndex * widthPct;
                        const cStyle = getSubjectColor(ev.colorId);

                        return (
                          <div
                            key={ev.id}
                            style={{
                              top: `${topPct}%`,
                              height: `${heightPct}%`,
                              width: `calc(${widthPct}% - 4px)`,
                              insetInlineStart: `calc(${startPct}% + 2px)`,
                            }}
                            className={`absolute z-10 rounded-xl border p-1.5 overflow-hidden shadow-xs ${cStyle.softBg} ${cStyle.border}`}
                          >
                            <div
                              dir="ltr"
                              className="text-[10px] font-mono tabular-nums font-bold text-[var(--text-primary)] truncate"
                            >
                              {formatTime(ev.startTime)}
                            </div>
                            <div className={`text-xs font-bold truncate ${cStyle.text}`}>
                              {ev.title}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CHRONOLOGICAL AGENDA VIEW */}
      {mode === 'agenda' && (
        <div className="rounded-3xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 space-y-4">
          {weekDates.map((dStr) => {
            const evs = getEventsForDate(dStr);
            return (
              <div
                key={dStr}
                className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold font-display text-[var(--text-primary)]">
                    {formatLocalizedDate(dStr, lang, 'EEEE, d MMMM', digitsStyle)}
                  </span>
                  {dStr === todayStr && (
                    <span className="rounded-lg bg-[var(--accent-soft)] px-2.5 py-0.5 text-xs font-bold text-[var(--accent-primary)]">
                      {t('calendar.today')}
                    </span>
                  )}
                </div>

                {evs.length === 0 ? (
                  <p className="text-xs text-[var(--text-muted)]">{t('calendar.noEventsDay')}</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {evs.map((ev) => {
                      const cStyle = getSubjectColor(ev.colorId);
                      return (
                        <div
                          key={ev.id}
                          className={`rounded-xl border p-3 flex items-center justify-between gap-3 ${cStyle.softBg} ${cStyle.border}`}
                        >
                          <div className="min-w-0 space-y-1">
                            <div className="text-xs font-bold text-[var(--text-primary)] truncate">
                              {ev.title}
                            </div>
                            {(ev.sessionType || ev.deliveryMode) && (
                              <SessionMetaBadges
                                type={ev.sessionType}
                                mode={ev.deliveryMode}
                                section={ev.section}
                                group={ev.group}
                                compact
                              />
                            )}
                            {ev.room && (
                              <div className="text-[11px] text-[var(--text-secondary)] truncate">
                                {ev.room}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {ev.meetingUrl &&
                              (ev.deliveryMode === 'remote' || ev.deliveryMode === 'hybrid') && (
                                <a
                                  href={ev.meetingUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 rounded-lg bg-sky-600 hover:bg-sky-500 text-white px-2 py-1 text-[10px] font-bold transition"
                                >
                                  <ExternalLink className="h-3 w-3" />
                                  <span>{t('classMode.joinCall')}</span>
                                </a>
                              )}
                            <span
                              dir="ltr"
                              className="text-xs font-mono tabular-nums font-bold text-[var(--text-primary)]"
                            >
                              {formatTime(ev.startTime)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
