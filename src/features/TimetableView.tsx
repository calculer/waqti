import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Copy,
  Plus,
  Trash2,
} from 'lucide-react';
import { useWaqtiStore } from '../store/useWaqtiStore';
import { useTranslation } from '../hooks/useTranslation';
import {
  detectSlotOverlaps,
  getOrderedWeekdays,
  getWeekDayIndex,
  isValidTimeOrder,
  minutesToTime,
  timeToMinutes,
} from '../lib/dates';
import { SUBJECT_COLORS } from '../lib/colors';
import type { RecurrenceType, TimetableSlot, WeekDay } from '../types';

export const TimetableView: React.FC<{
  onPushUndo: (labelKey: string, restore: () => void) => void;
}> = ({ onPushUndo }) => {
  const { t, lang, formatRange } = useTranslation();
  const subjects = useWaqtiStore((s) => s.subjects);
  const timetable = useWaqtiStore((s) => s.timetable);
  const weekStart = useWaqtiStore((s) => s.settings.weekStart);
  const todayStr = useWaqtiStore((s) => s.todayStr);

  const addTimetableSlot = useWaqtiStore((s) => s.addTimetableSlot);
  const updateTimetableSlot = useWaqtiStore((s) => s.updateTimetableSlot);
  const deleteTimetableSlot = useWaqtiStore((s) => s.deleteTimetableSlot);
  const duplicateDaySlots = useWaqtiStore((s) => s.duplicateDaySlots);

  const [viewMode, setViewMode] = useState<'week' | 'day'>('week');
  const [selectedDay, setSelectedDay] = useState<WeekDay>(() => getWeekDayIndex(todayStr));
  const [isAddOpen, setIsAddOpen] = useState(false);

  const [subjectId, setSubjectId] = useState(subjects[0]?.id ?? '');
  const [dayOfWeek, setDayOfWeek] = useState<WeekDay>(() => getWeekDayIndex(todayStr));
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:30');
  const [room, setRoom] = useState('');
  const [teacher, setTeacher] = useState('');
  const [recurrence, setRecurrence] = useState<RecurrenceType>('weekly');
  const [errorMsg, setErrorMsg] = useState('');

  const orderedDays = useMemo(
    () => getOrderedWeekdays(lang, weekStart, 'EEEE'),
    [lang, weekStart]
  );

  const activeSubjectId = subjectId || subjects[0]?.id || '';

  const formConflicts = useMemo(() => {
    if (!isValidTimeOrder(startTime, endTime)) return [];
    return detectSlotOverlaps({ dayOfWeek, startTime, endTime }, timetable);
  }, [dayOfWeek, startTime, endTime, timetable]);

  const handleAddSlot = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (!isValidTimeOrder(startTime, endTime)) {
      setErrorMsg(t('error.endBeforeStart'));
      return;
    }
    const subj = subjects.find((s) => s.id === activeSubjectId);
    addTimetableSlot({
      subjectId: activeSubjectId,
      dayOfWeek,
      startTime,
      endTime,
      room: room.trim() || subj?.room || 'Room 101',
      teacher: teacher.trim() || subj?.teacher || '',
      recurrence,
    });
    setIsAddOpen(false);
  };

  const nudgeSlotTime = (slot: TimetableSlot, deltaStartMins: number, deltaEndMins: number) => {
    const newStart = minutesToTime(timeToMinutes(slot.startTime) + deltaStartMins);
    const newEnd = minutesToTime(timeToMinutes(slot.endTime) + deltaEndMins);
    if (isValidTimeOrder(newStart, newEnd)) {
      updateTimetableSlot(slot.id, { startTime: newStart, endTime: newEnd });
    }
  };

  const handleDeleteSlot = (slot: TimetableSlot) => {
    const removed = deleteTimetableSlot(slot.id);
    if (removed) {
      onPushUndo('common.deletedToast', () => {
        useWaqtiStore.setState((st) => ({
          timetable: [...st.timetable, removed],
        }));
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-display text-[var(--text-primary)]">
            {t('timetable.title')}
          </h1>
          <p className="text-sm text-[var(--text-secondary)]">{t('timetable.subtitle')}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* View Mode Segmented Control */}
          <div className="flex items-center rounded-xl bg-[var(--bg-elevated)] p-1">
            <button
              type="button"
              onClick={() => setViewMode('week')}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                viewMode === 'week'
                  ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm'
                  : 'text-[var(--text-secondary)]'
              }`}
            >
              {t('timetable.weekView')}
            </button>
            <button
              type="button"
              onClick={() => setViewMode('day')}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                viewMode === 'day'
                  ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm'
                  : 'text-[var(--text-secondary)]'
              }`}
            >
              {t('timetable.dayView')}
            </button>
          </div>

          <button
            type="button"
            onClick={() => duplicateDaySlots(selectedDay, (selectedDay + 1) % 7)}
            className="flex items-center gap-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3.5 py-2 text-xs font-medium text-[var(--text-primary)] hover:border-[var(--accent-primary)] transition whitespace-nowrap"
          >
            <Copy className="h-3.5 w-3.5" />
            <span>{t('timetable.duplicateDay')}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setErrorMsg('');
              setIsAddOpen((v) => !v);
            }}
            className="flex items-center gap-1.5 rounded-xl bg-[var(--accent-primary)] px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:opacity-95 transition whitespace-nowrap"
          >
            <Plus className="h-4 w-4" />
            <span>{t('timetable.addSlot')}</span>
          </button>
        </div>
      </div>

      {/* Add Class Slot Form */}
      {isAddOpen && (
        <form
          onSubmit={handleAddSlot}
          className="rounded-3xl border border-[var(--border-strong)] bg-[var(--bg-surface)] p-6 space-y-4"
        >
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                {t('timetable.subject')}
              </label>
              <select
                value={activeSubjectId}
                onChange={(e) => setSubjectId(e.target.value)}
                className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2.5 text-sm text-[var(--text-primary)]"
              >
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                {t('timetable.day')}
              </label>
              <select
                value={dayOfWeek}
                onChange={(e) => setDayOfWeek(Number(e.target.value) as WeekDay)}
                className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2.5 text-sm text-[var(--text-primary)]"
              >
                {orderedDays.map((d) => (
                  <option key={d.dayIndex} value={d.dayIndex}>
                    {d.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                {t('timetable.startTime')}
              </label>
              <input
                type="time"
                dir="ltr"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2.5 text-sm font-mono-tabular text-[var(--text-primary)]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                {t('timetable.endTime')}
              </label>
              <input
                type="time"
                dir="ltr"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2.5 text-sm font-mono-tabular text-[var(--text-primary)]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                {t('subjects.room')}
              </label>
              <input
                type="text"
                value={room}
                onChange={(e) => setRoom(e.target.value)}
                placeholder="Amphi B2"
                className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3.5 py-2.5 text-sm text-[var(--text-primary)]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                {t('subjects.teacher')}
              </label>
              <input
                type="text"
                value={teacher}
                onChange={(e) => setTeacher(e.target.value)}
                className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3.5 py-2.5 text-sm text-[var(--text-primary)]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                {t('timetable.recurrence')}
              </label>
              <select
                value={recurrence}
                onChange={(e) => setRecurrence(e.target.value as RecurrenceType)}
                className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2.5 text-sm text-[var(--text-primary)]"
              >
                <option value="weekly">{t('timetable.recurrence.weekly')}</option>
                <option value="biweekly">{t('timetable.recurrence.biweekly')}</option>
                <option value="custom">{t('timetable.recurrence.custom')}</option>
              </select>
            </div>
          </div>

          {formConflicts.length > 0 && (
            <div className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-2.5 text-xs text-amber-600 dark:text-amber-300">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>
                {t('timetable.conflictWarning', {
                  subject:
                    subjects.find((s) => s.id === formConflicts[0].subjectId)?.name ?? '',
                  time: formatRange(formConflicts[0].startTime, formConflicts[0].endTime),
                })}
              </span>
            </div>
          )}

          {errorMsg && (
            <div
              role="alert"
              className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3.5 py-2.5 text-xs font-medium text-rose-500"
            >
              {errorMsg}
            </div>
          )}

          <div className="flex items-center justify-end gap-2">
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

      {/* Day Filter Tabs for Day List View */}
      {viewMode === 'day' && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {orderedDays.map((d) => (
            <button
              key={d.dayIndex}
              type="button"
              onClick={() => setSelectedDay(d.dayIndex)}
              className={`rounded-xl px-4 py-2 text-xs font-semibold transition whitespace-nowrap ${
                selectedDay === d.dayIndex
                  ? 'bg-[var(--accent-primary)] text-white'
                  : 'border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-secondary)]'
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>
      )}

      {/* Week Grid or Day List */}
      <div
        className={
          viewMode === 'week'
            ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-4'
            : 'space-y-3'
        }
      >
        {(viewMode === 'week'
          ? orderedDays
          : orderedDays.filter((d) => d.dayIndex === selectedDay)
        ).map((dayObj) => {
          const daySlots = timetable
            .filter((s) => s.dayOfWeek === dayObj.dayIndex)
            .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));

          return (
            <div
              key={dayObj.dayIndex}
              onClick={() => setSelectedDay(dayObj.dayIndex)}
              className={`rounded-3xl border p-4 transition ${
                selectedDay === dayObj.dayIndex
                  ? 'border-[var(--accent-primary)]/50 bg-[var(--bg-surface)]'
                  : 'border-[var(--border-subtle)] bg-[var(--bg-surface)]'
              }`}
            >
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-[var(--border-subtle)]">
                <span className="text-xs font-bold text-[var(--text-primary)]">
                  {dayObj.label}
                </span>
                <span className="text-[11px] font-mono-tabular text-[var(--text-muted)]">
                  {daySlots.length}
                </span>
              </div>

              {daySlots.length === 0 ? (
                <p className="py-6 text-center text-xs text-[var(--text-muted)]">
                  {t('timetable.emptyDay')}
                </p>
              ) : (
                <div className="space-y-2.5">
                  {daySlots.map((slot) => {
                    const subj = subjects.find((s) => s.id === slot.subjectId);
                    const colorStyle = SUBJECT_COLORS[subj?.color ?? 'violet'];
                    const conflicts = detectSlotOverlaps(slot, timetable);

                    return (
                      <div
                        key={slot.id}
                        className={`rounded-2xl border p-3 ${colorStyle.softBg} ${colorStyle.border}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-[var(--text-primary)] truncate">
                              {subj?.name}
                            </div>
                            <div
                              dir="ltr"
                              className="mt-0.5 text-[11px] font-mono-tabular font-semibold text-[var(--text-secondary)]"
                            >
                              {formatRange(slot.startTime, slot.endTime)}
                            </div>
                            <div className="mt-1 text-[11px] text-[var(--text-muted)] truncate">
                              {slot.room}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteSlot(slot);
                            }}
                            aria-label={`${t('common.delete')} ${subj?.name}`}
                            className="rounded-lg p-1 text-[var(--text-muted)] hover:text-rose-500"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        {conflicts.length > 0 && (
                          <div className="mt-2 flex items-center gap-1 text-[10px] font-semibold text-amber-600 dark:text-amber-300">
                            <AlertTriangle className="h-3 w-3 shrink-0" />
                            <span className="truncate">Conflict</span>
                          </div>
                        )}

                        {/* Interactive Move & Resize Controls */}
                        <div className="mt-2.5 pt-2 border-t border-[var(--border-subtle)] flex items-center justify-between gap-1">
                          <button
                            type="button"
                            onClick={() => nudgeSlotTime(slot, -15, -15)}
                            className="rounded px-1.5 py-0.5 text-[10px] font-mono-tabular bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                          >
                            {t('timetable.nudgeEarlier')}
                          </button>
                          <button
                            type="button"
                            onClick={() => nudgeSlotTime(slot, 15, 15)}
                            className="rounded px-1.5 py-0.5 text-[10px] font-mono-tabular bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                          >
                            {t('timetable.nudgeLater')}
                          </button>
                          <button
                            type="button"
                            onClick={() => nudgeSlotTime(slot, 0, 30)}
                            className="rounded px-1.5 py-0.5 text-[10px] font-mono-tabular bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                          >
                            {t('timetable.extendDuration')}
                          </button>
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
    </div>
  );
};
