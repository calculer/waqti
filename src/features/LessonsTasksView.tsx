import React, { useState } from 'react';
import {
  CheckCircle2,
  Circle,
  ExternalLink,
  Layers,
  Plus,
  RotateCcw,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { useWaqtiStore } from '../store/useWaqtiStore';
import { useTranslation } from '../hooks/useTranslation';
import { isBefore, parseLocalDateTime } from '../lib/dates';
import { getSubjectColor } from '../lib/colors';
import { EmptyHourglassIllustration } from '../components/WaqtiLogo';
import type { PriorityLevel, StudyTask, TaskStatus } from '../types';

export const LessonsTasksView: React.FC<{
  onPushUndo: (labelKey: string, restore: () => void) => void;
}> = ({ onPushUndo }) => {
  const { t, formatTime, digits } = useTranslation();
  const subjects = useWaqtiStore((s) => s.subjects);
  const tasks = useWaqtiStore((s) => s.tasks);
  const lessons = useWaqtiStore((s) => s.lessons);
  const flashcards = useWaqtiStore((s) => s.flashcards);
  const todayStr = useWaqtiStore((s) => s.todayStr);

  const addTask = useWaqtiStore((s) => s.addTask);
  const updateTask = useWaqtiStore((s) => s.updateTask);
  const deleteTask = useWaqtiStore((s) => s.deleteTask);
  const toggleSubtask = useWaqtiStore((s) => s.toggleSubtask);
  const addLesson = useWaqtiStore((s) => s.addLesson);
  const deleteLesson = useWaqtiStore((s) => s.deleteLesson);
  const addFlashcard = useWaqtiStore((s) => s.addFlashcard);
  const reviewFlashcard = useWaqtiStore((s) => s.reviewFlashcard);
  const deleteFlashcard = useWaqtiStore((s) => s.deleteFlashcard);

  const [activeTab, setActiveTab] = useState<'tasks' | 'lessons' | 'flashcards'>('tasks');
  const [taskViewMode, setTaskViewMode] = useState<'kanban' | 'list'>('kanban');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [flippedIds, setFlippedIds] = useState<Record<string, boolean>>({});

  const [title, setTitle] = useState('');
  const [subjectId, setSubjectId] = useState(subjects[0]?.id ?? '');
  const [dueDate, setDueDate] = useState(todayStr);
  const [dueTime, setDueTime] = useState('18:00');
  const [priority, setPriority] = useState<PriorityLevel>('high');
  const [notes, setNotes] = useState('');
  const [linkInput, setLinkInput] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrorMsg(t('error.required'));
      return;
    }
    const activeSubj = subjectId || subjects[0]?.id || '';
    if (activeTab === 'tasks') {
      addTask({
        title: title.trim(),
        subjectId: activeSubj,
        dueDate,
        dueTime,
        priority,
        status: 'todo',
        subtasks: notes.trim()
          ? notes
              .split(',')
              .map((s, idx) => ({ id: `st-${Date.now()}-${idx}`, title: s.trim(), done: false }))
          : [],
        recurrence: 'none',
      });
    } else if (activeTab === 'lessons') {
      addLesson({
        title: title.trim(),
        subjectId: activeSubj,
        date: dueDate,
        notes: notes.trim(),
        links: linkInput.trim() ? [linkInput.trim()] : [],
      });
    } else {
      addFlashcard({
        subjectId: activeSubj,
        front: title.trim(),
        back: notes.trim() || '—',
      });
    }
    setTitle('');
    setNotes('');
    setLinkInput('');
    setErrorMsg('');
    setIsAddOpen(false);
  };

  const handleDeleteTask = (tk: StudyTask) => {
    const removed = deleteTask(tk.id);
    if (removed) {
      onPushUndo('common.deletedToast', () => {
        useWaqtiStore.setState((st) => ({
          tasks: [removed, ...st.tasks],
        }));
      });
    }
  };

  const renderTaskCard = (tk: StudyTask) => {
    const subj = subjects.find((s) => s.id === tk.subjectId);
    const colorStyle = getSubjectColor(subj?.color);
    const isOverdue =
      tk.status !== 'done' &&
      isBefore(parseLocalDateTime(tk.dueDate, tk.dueTime), new Date());

    return (
      <div
        key={tk.id}
        className={`rounded-2xl border p-4 transition ${
          isOverdue
            ? 'border-rose-500/40 bg-rose-500/5'
            : 'border-[var(--border-subtle)] bg-[var(--bg-surface)]'
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[11px] text-[var(--text-muted)]">
              <span className={`font-semibold ${colorStyle.text}`}>{subj?.name}</span>
              <span aria-hidden="true">·</span>
              <span dir="ltr" className="font-mono-tabular">
                {tk.dueDate} {formatTime(tk.dueTime)}
              </span>
              {isOverdue && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-bold text-rose-500">{t('lessons.overdue')}</span>
                </>
              )}
            </div>
            <h4
              className={`mt-1 text-sm font-semibold ${
                tk.status === 'done'
                  ? 'line-through text-[var(--text-muted)]'
                  : 'text-[var(--text-primary)]'
              }`}
            >
              {tk.title}
            </h4>
          </div>

          <button
            type="button"
            onClick={() => handleDeleteTask(tk)}
            aria-label={`${t('common.delete')} ${tk.title}`}
            className="rounded-lg p-1 text-[var(--text-muted)] hover:text-rose-500"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Subtasks */}
        {tk.subtasks.length > 0 && (
          <div className="mt-3 space-y-1.5 border-t border-[var(--border-subtle)] pt-2.5">
            {tk.subtasks.map((st) => (
              <button
                key={st.id}
                type="button"
                onClick={() => toggleSubtask(tk.id, st.id)}
                className="flex w-full items-center gap-2 text-xs text-start text-[var(--text-secondary)]"
              >
                {st.done ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                ) : (
                  <Circle className="h-3.5 w-3.5 text-[var(--text-muted)] shrink-0" />
                )}
                <span className={st.done ? 'line-through text-[var(--text-muted)]' : ''}>
                  {st.title}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Status Transition Segmented Buttons */}
        <div className="mt-3 pt-2.5 border-t border-[var(--border-subtle)] flex items-center gap-1">
          {(['todo', 'doing', 'done'] as TaskStatus[]).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => updateTask(tk.id, { status: st })}
              className={`flex-1 rounded-lg py-1 text-[11px] font-medium transition ${
                tk.status === st
                  ? 'bg-[var(--accent-soft)] text-[var(--accent-primary)] font-semibold'
                  : 'text-[var(--text-muted)] hover:bg-[var(--bg-elevated)]'
              }`}
            >
              {t(`lessons.status.${st}`)}
            </button>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-display text-[var(--text-primary)]">
            {t('lessons.title')}
          </h1>
          <p className="text-sm text-[var(--text-secondary)]">{t('lessons.subtitle')}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center rounded-xl bg-[var(--bg-elevated)] p-1">
            {(
              [
                { id: 'tasks', label: t('lessons.tab.tasks') },
                { id: 'lessons', label: t('lessons.tab.lessons') },
                { id: 'flashcards', label: t('lessons.tab.flashcards') },
              ] as const
            ).map((tb) => (
              <button
                key={tb.id}
                type="button"
                onClick={() => setActiveTab(tb.id)}
                className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
                  activeTab === tb.id
                    ? 'bg-[var(--bg-surface)] text-[var(--accent-primary)] shadow-sm'
                    : 'text-[var(--text-secondary)]'
                }`}
              >
                {tb.label}
              </button>
            ))}
          </div>

          {activeTab === 'tasks' && (
            <div className="flex items-center rounded-xl bg-[var(--bg-elevated)] p-1">
              <button
                type="button"
                onClick={() => setTaskViewMode('kanban')}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                  taskViewMode === 'kanban'
                    ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm'
                    : 'text-[var(--text-secondary)]'
                }`}
              >
                {t('lessons.view.kanban')}
              </button>
              <button
                type="button"
                onClick={() => setTaskViewMode('list')}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                  taskViewMode === 'list'
                    ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm'
                    : 'text-[var(--text-secondary)]'
                }`}
              >
                {t('lessons.view.list')}
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={() => setIsAddOpen((v) => !v)}
            className="flex items-center gap-1.5 rounded-xl btn-primary-waqti px-4 py-2.5 text-xs font-semibold shadow-sm transition whitespace-nowrap"
          >
            <Plus className="h-4 w-4" />
            <span>
              {activeTab === 'tasks'
                ? t('lessons.addTask')
                : activeTab === 'lessons'
                  ? t('lessons.addLesson')
                  : t('lessons.addFlashcard')}
            </span>
          </button>
        </div>
      </div>

      {/* Add Form */}
      {isAddOpen && (
        <form
          onSubmit={handleCreate}
          className="rounded-3xl border border-[var(--border-strong)] bg-[var(--bg-surface)] p-6 space-y-4"
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                {activeTab === 'flashcards'
                  ? t('lessons.frontPrompt')
                  : t('lessons.lessonTitle')}
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3.5 py-2.5 text-sm text-[var(--text-primary)]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                {t('timetable.subject')}
              </label>
              <select
                value={subjectId || subjects[0]?.id || ''}
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

            {activeTab !== 'flashcards' && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                    {t('lessons.dueDate')}
                  </label>
                  <input
                    type="date"
                    dir="ltr"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2.5 py-2.5 text-xs font-mono-tabular text-[var(--text-primary)]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                    {t('lessons.dueTime')}
                  </label>
                  <input
                    type="time"
                    dir="ltr"
                    value={dueTime}
                    onChange={(e) => setDueTime(e.target.value)}
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2.5 py-2.5 text-xs font-mono-tabular text-[var(--text-primary)]"
                  />
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
              {activeTab === 'tasks'
                ? t('lessons.subtasks')
                : activeTab === 'flashcards'
                  ? t('lessons.backAnswer')
                  : t('lessons.lessonNotes')}
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3.5 py-2.5 text-sm text-[var(--text-primary)]"
            />
          </div>

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
              className="rounded-xl btn-primary-waqti px-5 py-2 text-xs font-semibold"
            >
              {t('common.save')}
            </button>
          </div>
        </form>
      )}

      {/* TASKS TAB */}
      {activeTab === 'tasks' &&
        (tasks.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-[var(--border-strong)] bg-[var(--bg-surface)] p-12 text-center flex flex-col items-center">
            <EmptyHourglassIllustration />
            <p className="mt-4 text-sm text-[var(--text-secondary)]">{t('lessons.emptyTasks')}</p>
          </div>
        ) : taskViewMode === 'kanban' ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {(['todo', 'doing', 'done'] as TaskStatus[]).map((statusCol) => {
              const colTasks = tasks.filter((tk) => tk.status === statusCol);
              return (
                <div
                  key={statusCol}
                  className="rounded-3xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4 space-y-3"
                >
                  <div className="flex items-center justify-between px-1">
                    <h3 className="text-xs font-bold text-[var(--text-primary)]">
                      {t(`lessons.status.${statusCol}`)}
                    </h3>
                    <span className="text-xs font-mono-tabular text-[var(--text-muted)]">
                      {digits(colTasks.length)}
                    </span>
                  </div>
                  <div className="space-y-3">{colTasks.map(renderTaskCard)}</div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="space-y-3">{tasks.map(renderTaskCard)}</div>
        ))}

      {/* LESSONS TAB */}
      {activeTab === 'lessons' &&
        (lessons.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-[var(--border-strong)] bg-[var(--bg-surface)] p-12 text-center flex flex-col items-center">
            <EmptyHourglassIllustration />
            <p className="mt-4 text-sm text-[var(--text-secondary)]">{t('lessons.emptyLessons')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {lessons.map((les) => {
              const subj = subjects.find((s) => s.id === les.subjectId);
              const colorStyle = getSubjectColor(subj?.color);
              return (
                <div
                  key={les.id}
                  className="rounded-3xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
                      <span className={`font-semibold ${colorStyle.text}`}>{subj?.name}</span>
                      <span dir="ltr" className="font-mono-tabular">
                        {les.date}
                      </span>
                    </div>
                    <h3 className="mt-2 text-base font-bold text-[var(--text-primary)]">
                      {les.title}
                    </h3>
                    <p className="mt-2 text-xs text-[var(--text-secondary)] leading-relaxed whitespace-pre-line">
                      {les.notes}
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-[var(--border-subtle)] flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {les.links.map((lnk, idx) => (
                        <a
                          key={idx}
                          href={lnk}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1 text-xs text-[var(--accent-primary)] hover:underline"
                        >
                          <ExternalLink className="h-3 w-3" />
                          <span>Link</span>
                        </a>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => deleteLesson(les.id)}
                      aria-label={`${t('common.delete')} ${les.title}`}
                      className="rounded-lg p-1 text-[var(--text-muted)] hover:text-rose-500"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ))}

      {/* FLASHCARDS (LEITNER SYSTEM) TAB */}
      {activeTab === 'flashcards' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {flashcards.map((fc) => {
            const subj = subjects.find((s) => s.id === fc.subjectId);
            const cStyle = getSubjectColor(subj?.color);
            const isFlipped = !!flippedIds[fc.id];

            return (
              <div
                key={fc.id}
                className="rounded-3xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 flex flex-col justify-between space-y-4 shadow-xs"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className={`text-xs font-bold ${cStyle.text}`}>
                    {subj?.name}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-lg bg-[var(--accent-soft)] px-2.5 py-0.5 text-[11px] font-bold text-[var(--accent-primary)]">
                      <Layers className="h-3 w-3" />
                      {t('lessons.boxLevel', { box: digits(fc.box) })}
                    </span>
                    <button
                      type="button"
                      onClick={() => deleteFlashcard(fc.id)}
                      aria-label={t('common.delete')}
                      className="rounded-lg p-1 text-[var(--text-muted)] hover:text-rose-500"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setFlippedIds((prev) => ({ ...prev, [fc.id]: !prev[fc.id] }))
                  }
                  className="w-full min-h-[120px] rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4 flex flex-col items-center justify-center text-center transition hover:border-[var(--accent-primary)]"
                >
                  <p className="text-sm font-bold text-[var(--text-primary)]">
                    {isFlipped ? fc.back : fc.front}
                  </p>
                  <span className="mt-3 inline-flex items-center gap-1 text-[11px] font-medium text-[var(--accent-primary)]">
                    <RotateCcw className="h-3 w-3" />
                    {t('lessons.flipCard')}
                  </span>
                </button>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => reviewFlashcard(fc.id, false)}
                    className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] py-2 px-3 text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  >
                    {t('lessons.demoteCard')}
                  </button>
                  <button
                    type="button"
                    onClick={() => reviewFlashcard(fc.id, true)}
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl btn-primary-waqti py-2 px-3 text-xs font-semibold"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>{t('lessons.promoteCard')}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
