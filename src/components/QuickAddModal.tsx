import React, { useState } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import { useWaqtiStore } from '../store/useWaqtiStore';
import { useTranslation } from '../hooks/useTranslation';
import {
  detectSlotOverlaps,
  getOrderedWeekdays,
  isValidTimeOrder,
  shiftDateString,
} from '../lib/dates';
import type { ExamType, PriorityLevel, WeekDay } from '../types';

interface QuickAddModalProps {
  isOpen: boolean;
  initialTab?: 'task' | 'exam' | 'slot' | 'habit';
  onClose: () => void;
}

export const QuickAddModal: React.FC<QuickAddModalProps> = ({
  isOpen,
  initialTab = 'task',
  onClose,
}) => {
  const { t, lang, formatRange } = useTranslation();
  const subjects = useWaqtiStore((s) => s.subjects);
  const timetable = useWaqtiStore((s) => s.timetable);
  const todayStr = useWaqtiStore((s) => s.todayStr);
  const weekStart = useWaqtiStore((s) => s.settings.weekStart);
  const addTask = useWaqtiStore((s) => s.addTask);
  const addExam = useWaqtiStore((s) => s.addExam);
  const addTimetableSlot = useWaqtiStore((s) => s.addTimetableSlot);
  const addHabit = useWaqtiStore((s) => s.addHabit);

  const [tab, setTab] = useState<'task' | 'exam' | 'slot' | 'habit'>(initialTab);
  const [title, setTitle] = useState('');
  const [subjectId, setSubjectId] = useState(subjects[0]?.id ?? '');
  const [date, setDate] = useState(shiftDateString(todayStr, 1));
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:30');
  const [dayOfWeek, setDayOfWeek] = useState<WeekDay>(1);
  const [priority, setPriority] = useState<PriorityLevel>('high');
  const [examType, setExamType] = useState<ExamType>('controle');
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const activeSubjectId = subjectId || subjects[0]?.id || '';
  const weekdays = getOrderedWeekdays(lang, weekStart, 'EEEE');

  const slotConflicts =
    tab === 'slot' && isValidTimeOrder(startTime, endTime)
      ? detectSlotOverlaps({ dayOfWeek, startTime, endTime }, timetable)
      : [];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (tab !== 'slot' && !title.trim()) {
      setErrorMsg(t('error.required'));
      return;
    }

    if (tab === 'slot') {
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
        room: subj?.room ?? 'Room 101',
        teacher: subj?.teacher ?? '',
        recurrence: 'weekly',
      });
    } else if (tab === 'task') {
      addTask({
        title: title.trim(),
        subjectId: activeSubjectId,
        dueDate: date,
        dueTime: startTime,
        priority,
        status: 'todo',
        subtasks: [],
        recurrence: 'none',
      });
    } else if (tab === 'exam') {
      const subj = subjects.find((s) => s.id === activeSubjectId);
      addExam({
        title: title.trim(),
        subjectId: activeSubjectId,
        type: examType,
        date,
        startTime,
        durationMinutes: 90,
        room: subj?.room ?? 'Hall A',
        coefficient: subj?.coefficient ?? 4,
        topics: [],
        priority,
        reminderOffsetsMinutes: [1440],
        readinessScore: 50,
      });
    } else if (tab === 'habit') {
      addHabit({
        name: title.trim(),
        icon: 'Sparkles',
        color: 'violet',
        frequencyType: 'daily',
        targetDays: [0, 1, 2, 3, 4, 5, 6],
        timesPerWeek: 7,
      });
    }

    setTitle('');
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/60 backdrop-blur-sm p-0 md:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={t('dashboard.quickAdd')}
    >
      <div
        className="w-full max-w-lg rounded-t-3xl md:rounded-2xl border border-[var(--border-strong)] bg-[var(--bg-surface)] p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1.5 bg-[var(--border-strong)] rounded-full mx-auto mb-4 md:hidden" />
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-[var(--text-primary)]">{t('dashboard.quickAdd')}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.cancel')}
            className="rounded-xl p-2 text-[var(--text-muted)] hover:bg-[var(--bg-elevated)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Segmented Control */}
        <div className="grid grid-cols-4 gap-1 rounded-xl bg-[var(--bg-elevated)] p-1 mb-5">
          {(
            [
              { id: 'task', label: t('lessons.addTask') },
              { id: 'exam', label: t('exams.add') },
              { id: 'slot', label: t('timetable.addSlot') },
              { id: 'habit', label: t('habits.add') },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setTab(item.id);
                setErrorMsg('');
              }}
              className={`rounded-lg py-2 px-2 text-xs font-medium transition truncate ${
                tab === item.id
                  ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {tab !== 'slot' && (
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                {tab === 'habit' ? t('habits.name') : t('lessons.lessonTitle')}
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3.5 py-2.5 text-sm text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:outline-none"
                placeholder="..."
              />
            </div>
          )}

          {tab !== 'habit' && subjects.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                {t('timetable.subject')}
              </label>
              <select
                value={activeSubjectId}
                onChange={(e) => setSubjectId(e.target.value)}
                className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3.5 py-2.5 text-sm text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:outline-none"
              >
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {tab === 'slot' ? (
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                  {t('timetable.day')}
                </label>
                <select
                  value={dayOfWeek}
                  onChange={(e) => setDayOfWeek(Number(e.target.value) as WeekDay)}
                  className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2.5 text-sm text-[var(--text-primary)]"
                >
                  {weekdays.map((w) => (
                    <option key={w.dayIndex} value={w.dayIndex}>
                      {w.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
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
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
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
          ) : tab !== 'habit' ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                  {t('lessons.dueDate')}
                </label>
                <input
                  type="date"
                  dir="ltr"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2.5 text-sm font-mono-tabular text-[var(--text-primary)]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                  {t('lessons.dueTime')}
                </label>
                <input
                  type="time"
                  dir="ltr"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2.5 text-sm font-mono-tabular text-[var(--text-primary)]"
                />
              </div>
            </div>
          ) : null}

          {tab === 'exam' && (
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                Type
              </label>
              <select
                value={examType}
                onChange={(e) => setExamType(e.target.value as ExamType)}
                className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3.5 py-2.5 text-sm text-[var(--text-primary)]"
              >
                {(
                  ['controle', 'examen', 'devoir_surveille', 'test', 'quiz', 'oral'] as ExamType[]
                ).map((et) => (
                  <option key={et} value={et}>
                    {t(`exams.type.${et}`)}
                  </option>
                ))}
              </select>
            </div>
          )}

          {slotConflicts.length > 0 && (
            <div className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-2.5 text-xs text-amber-600 dark:text-amber-300">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>
                {t('timetable.conflictWarning', {
                  subject:
                    subjects.find((s) => s.id === slotConflicts[0].subjectId)?.name ?? '',
                  time: formatRange(slotConflicts[0].startTime, slotConflicts[0].endTime),
                })}
              </span>
            </div>
          )}

          {errorMsg && (
            <div
              role="alert"
              className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3.5 py-2.5 text-xs font-medium text-rose-600 dark:text-rose-300"
            >
              {errorMsg}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-[var(--border-subtle)] px-4 py-2.5 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              className="rounded-xl bg-[var(--accent-primary)] px-5 py-2.5 text-xs font-semibold text-white shadow-sm hover:opacity-95 transition"
            >
              {t('common.save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
