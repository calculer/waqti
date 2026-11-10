import React, { useMemo, useState } from 'react';
import {
  Archive,
  BookOpen,
  Edit3,
  Plus,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import { useWaqtiStore } from '../store/useWaqtiStore';
import { useTranslation } from '../hooks/useTranslation';
import { SUBJECT_COLOR_LIST, SUBJECT_COLORS } from '../lib/colors';
import { EmptyHourglassIllustration } from '../components/WaqtiLogo';
import type { Subject, SubjectColorId } from '../types';

export const SubjectsView: React.FC<{
  onPushUndo: (labelKey: string, restore: () => void) => void;
}> = ({ onPushUndo }) => {
  const { t, digits } = useTranslation();
  const subjects = useWaqtiStore((s) => s.subjects);
  const selectedSubjectId = useWaqtiStore((s) => s.selectedSubjectId);
  const setActiveNav = useWaqtiStore((s) => s.setActiveNav);
  const exams = useWaqtiStore((s) => s.exams);
  const tasks = useWaqtiStore((s) => s.tasks);
  const lessons = useWaqtiStore((s) => s.lessons);
  const focusSessions = useWaqtiStore((s) => s.focusSessions);

  const addSubject = useWaqtiStore((s) => s.addSubject);
  const updateSubject = useWaqtiStore((s) => s.updateSubject);
  const deleteSubject = useWaqtiStore((s) => s.deleteSubject);

  const [showArchived, setShowArchived] = useState(false);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);

  const [name, setName] = useState('');
  const [teacher, setTeacher] = useState('');
  const [room, setRoom] = useState('');
  const [coefficient, setCoefficient] = useState(4);
  const [weeklyGoalHours, setWeeklyGoalHours] = useState(6);
  const [color, setColor] = useState<SubjectColorId>('violet');
  const [errorMsg, setErrorMsg] = useState('');

  const visibleSubjects = useMemo(
    () => subjects.filter((s) => (showArchived ? true : !s.archived)),
    [subjects, showArchived]
  );

  const openNewForm = () => {
    setEditingSubject(null);
    setName('');
    setTeacher('');
    setRoom('');
    setCoefficient(4);
    setWeeklyGoalHours(6);
    setColor('violet');
    setErrorMsg('');
    setIsFormOpen(true);
  };

  const openEditForm = (subj: Subject) => {
    setEditingSubject(subj);
    setName(subj.name);
    setTeacher(subj.teacher);
    setRoom(subj.room);
    setCoefficient(subj.coefficient);
    setWeeklyGoalHours(subj.weeklyGoalHours);
    setColor(subj.color);
    setErrorMsg('');
    setIsFormOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg(t('error.required'));
      return;
    }

    if (editingSubject) {
      updateSubject(editingSubject.id, {
        name: name.trim(),
        teacher: teacher.trim(),
        room: room.trim(),
        coefficient: Math.max(1, coefficient),
        weeklyGoalHours: Math.max(1, weeklyGoalHours),
        color,
      });
    } else {
      addSubject({
        name: name.trim(),
        teacher: teacher.trim(),
        room: room.trim(),
        coefficient: Math.max(1, coefficient),
        weeklyGoalHours: Math.max(1, weeklyGoalHours),
        color,
        icon: 'BookOpen',
      });
    }
    setIsFormOpen(false);
  };

  const handleDelete = (subj: Subject) => {
    const removed = deleteSubject(subj.id);
    if (removed) {
      onPushUndo('common.deletedToast', () => {
        useWaqtiStore.setState((st) => ({
          subjects: [...st.subjects, removed],
        }));
      });
    }
  };

  const activeDetailSubject = subjects.find((s) => s.id === selectedSubjectId) ?? null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-display text-[var(--text-primary)]">
            {t('subjects.title')}
          </h1>
          <p className="text-sm text-[var(--text-secondary)]">{t('subjects.subtitle')}</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowArchived((v) => !v)}
            className={`rounded-xl border px-3.5 py-2 text-xs font-medium transition ${
              showArchived
                ? 'border-[var(--accent-primary)] bg-[var(--accent-soft)] text-[var(--accent-primary)]'
                : 'border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-secondary)]'
            }`}
          >
            {t('subjects.showArchived')}
          </button>
          <button
            type="button"
            onClick={openNewForm}
            className="flex items-center gap-2 rounded-xl bg-[var(--accent-primary)] px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:opacity-95 transition whitespace-nowrap"
          >
            <Plus className="h-4 w-4" />
            <span>{t('subjects.add')}</span>
          </button>
        </div>
      </div>

      {/* Add / Edit Inline Drawer */}
      {isFormOpen && (
        <form
          onSubmit={handleSave}
          className="rounded-3xl border border-[var(--border-strong)] bg-[var(--bg-surface)] p-6 space-y-4"
        >
          <h2 className="text-base font-bold text-[var(--text-primary)]">
            {editingSubject ? t('subjects.edit') : t('subjects.add')}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                {t('subjects.name')}
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
                {t('subjects.room')}
              </label>
              <input
                type="text"
                value={room}
                onChange={(e) => setRoom(e.target.value)}
                className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3.5 py-2.5 text-sm text-[var(--text-primary)]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                {t('subjects.coefficient')}
              </label>
              <input
                type="number"
                min={1}
                max={20}
                value={coefficient}
                onChange={(e) => setCoefficient(Number(e.target.value))}
                className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3.5 py-2.5 text-sm font-mono-tabular text-[var(--text-primary)]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                {t('subjects.weeklyGoal')}
              </label>
              <input
                type="number"
                min={1}
                max={40}
                value={weeklyGoalHours}
                onChange={(e) => setWeeklyGoalHours(Number(e.target.value))}
                className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3.5 py-2.5 text-sm font-mono-tabular text-[var(--text-primary)]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-2">
                {t('subjects.color')}
              </label>
              <div className="flex items-center gap-2">
                {SUBJECT_COLOR_LIST.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-label={c}
                    onClick={() => setColor(c)}
                    className={`h-7 w-7 rounded-full ${SUBJECT_COLORS[c].dot} transition ${
                      color === c
                        ? 'ring-2 ring-offset-2 ring-[var(--text-primary)] scale-110'
                        : 'opacity-60 hover:opacity-100'
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>

          {errorMsg && (
            <p className="text-xs font-medium text-rose-500" role="alert">
              {errorMsg}
            </p>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsFormOpen(false)}
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

      {/* Subject Portfolio Detail Drawer if a Subject is Selected */}
      {activeDetailSubject && (
        <div className="rounded-3xl border border-[var(--accent-primary)] bg-[var(--bg-surface)] p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span
                className={`h-4 w-4 rounded-full ${
                  SUBJECT_COLORS[activeDetailSubject.color].dot
                }`}
              />
              <h2 className="text-lg font-bold text-[var(--text-primary)]">
                {activeDetailSubject.name}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setActiveNav('subjects', null)}
              className="text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            >
              {t('common.cancel')}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4">
              <div className="font-semibold text-[var(--text-primary)] mb-2">
                {t('nav.exams')}
              </div>
              {exams
                .filter((e) => e.subjectId === activeDetailSubject.id)
                .map((e) => (
                  <div key={e.id} className="py-1 flex justify-between text-[var(--text-secondary)]">
                    <span className="truncate">{e.title}</span>
                    <span dir="ltr" className="font-mono-tabular ms-2">
                      {e.grade !== undefined ? `${e.grade}/${e.outOf ?? 20}` : e.date}
                    </span>
                  </div>
                ))}
            </div>
            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4">
              <div className="font-semibold text-[var(--text-primary)] mb-2">
                {t('lessons.tab.tasks')}
              </div>
              {tasks
                .filter((tk) => tk.subjectId === activeDetailSubject.id)
                .map((tk) => (
                  <div key={tk.id} className="py-1 flex justify-between text-[var(--text-secondary)]">
                    <span className="truncate">{tk.title}</span>
                    <span className="ms-2">{t(`lessons.status.${tk.status}`)}</span>
                  </div>
                ))}
            </div>
            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4">
              <div className="font-semibold text-[var(--text-primary)] mb-2">
                {t('lessons.tab.lessons')}
              </div>
              {lessons
                .filter((l) => l.subjectId === activeDetailSubject.id)
                .map((l) => (
                  <div key={l.id} className="py-1 text-[var(--text-secondary)] truncate">
                    {l.title}
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* Subjects Grid */}
      {visibleSubjects.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-[var(--border-strong)] bg-[var(--bg-surface)] p-12 text-center flex flex-col items-center">
          <EmptyHourglassIllustration />
          <p className="mt-4 text-sm text-[var(--text-secondary)] max-w-md">
            {t('subjects.empty')}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {visibleSubjects.map((subj) => {
            const colorStyle = SUBJECT_COLORS[subj.color];
            const subjMinutes = focusSessions
              .filter((f) => f.subjectId === subj.id && f.mode === 'focus')
              .reduce((acc, cur) => acc + cur.durationMinutes, 0);
            const studiedHours = (subjMinutes / 60).toFixed(1);
            const goalPercent = Math.min(
              100,
              Math.round((subjMinutes / (subj.weeklyGoalHours * 60)) * 100)
            );

            const gradedExams = exams.filter(
              (e) => e.subjectId === subj.id && e.grade !== undefined
            );
            const avgScore =
              gradedExams.length > 0
                ? (
                    gradedExams.reduce(
                      (acc, cur) => acc + ((cur.grade ?? 0) / (cur.outOf ?? 20)) * 20,
                      0
                    ) / gradedExams.length
                  ).toFixed(2)
                : null;

            return (
              <div
                key={subj.id}
                className="rounded-3xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 flex flex-col justify-between hover:border-[var(--border-strong)] transition"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => setActiveNav('subjects', subj.id)}
                      className="flex items-center gap-3 text-start min-w-0"
                    >
                      <div
                        className={`h-10 w-10 rounded-2xl flex items-center justify-center shrink-0 ${colorStyle.softBg} ${colorStyle.text}`}
                      >
                        <BookOpen className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-base font-bold text-[var(--text-primary)] truncate">
                          {subj.name}
                        </h3>
                        <p className="text-xs text-[var(--text-muted)] truncate">
                          {subj.teacher} · {subj.room}
                        </p>
                      </div>
                    </button>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => openEditForm(subj)}
                        aria-label={`${t('subjects.edit')} ${subj.name}`}
                        className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"
                      >
                        <Edit3 className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => updateSubject(subj.id, { archived: !subj.archived })}
                        aria-label={`${
                          subj.archived ? t('subjects.unarchive') : t('subjects.archive')
                        } ${subj.name}`}
                        className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"
                      >
                        {subj.archived ? (
                          <RotateCcw className="h-4 w-4" />
                        ) : (
                          <Archive className="h-4 w-4" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(subj)}
                        aria-label={`${t('common.delete')} ${subj.name}`}
                        className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-rose-500/10 hover:text-rose-500"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Unboxed Metadata Line */}
                  <div className="mt-4 flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                    <span>
                      {t('subjects.coefficient')}:{' '}
                      <strong className="font-mono-tabular text-[var(--text-primary)]">
                        {digits(subj.coefficient)}
                      </strong>
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>
                      {t('subjects.averageGrade')}:{' '}
                      <strong className="font-mono-tabular text-[var(--text-primary)]">
                        {avgScore ? `${digits(avgScore)}/20` : t('subjects.noGrades')}
                      </strong>
                    </span>
                  </div>
                </div>

                {/* Study Hours Progress Bar */}
                <div className="mt-5 pt-4 border-t border-[var(--border-subtle)]">
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="text-[var(--text-muted)]">
                      {t('subjects.studiedThisWeek')}
                    </span>
                    <span dir="ltr" className="font-mono-tabular font-semibold text-[var(--text-primary)]">
                      {digits(studiedHours)}h / {digits(subj.weeklyGoalHours)}h
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-[var(--bg-elevated)] overflow-hidden">
                    <div
                      className={`h-full rounded-full ${colorStyle.dot} transition-all duration-300`}
                      style={{ width: `${goalPercent}%` }}
                    />
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
