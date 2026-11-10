import React, { useMemo, useState } from 'react';
import {
  Calculator,
  CheckCircle2,
  Circle,
  GraduationCap,
  Plus,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { useWaqtiStore } from '../store/useWaqtiStore';
import { useTranslation } from '../hooks/useTranslation';
import {
  computeExamCountdown,
  computeTargetExamGrade,
  formatLocalizedDate,
  isBefore,
  parseLocalDateTime,
  shiftDateString,
} from '../lib/dates';
import { getSubjectColor } from '../lib/colors';
import { EmptyHourglassIllustration } from '../components/WaqtiLogo';
import type { Exam, ExamType, PriorityLevel } from '../types';

export const ExamsView: React.FC<{
  onPushUndo: (labelKey: string, restore: () => void) => void;
}> = ({ onPushUndo }) => {
  const { t, lang, digitsStyle, timeFormat, digits, formatTime, formatRange } = useTranslation();
  const subjects = useWaqtiStore((s) => s.subjects);
  const exams = useWaqtiStore((s) => s.exams);
  const revisionSessions = useWaqtiStore((s) => s.revisionSessions);
  const todayStr = useWaqtiStore((s) => s.todayStr);

  const addExam = useWaqtiStore((s) => s.addExam);
  const updateExam = useWaqtiStore((s) => s.updateExam);
  const deleteExam = useWaqtiStore((s) => s.deleteExam);
  const generateExamRevisions = useWaqtiStore((s) => s.generateExamRevisions);
  const toggleRevisionSession = useWaqtiStore((s) => s.toggleRevisionSession);

  const [filter, setFilter] = useState<'upcoming' | 'past' | 'all'>('upcoming');
  const [subjectFilter, setSubjectFilter] = useState<string>('all');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [targetAvgInput, setTargetAvgInput] = useState<number>(16);

  const [title, setTitle] = useState('');
  const [subjectId, setSubjectId] = useState(subjects[0]?.id ?? '');
  const [type, setType] = useState<ExamType>('examen');
  const [date, setDate] = useState(() => shiftDateString(todayStr, 5));
  const [startTime, setStartTime] = useState('09:00');
  const [durationMinutes, setDurationMinutes] = useState(120);
  const [room, setRoom] = useState('');
  const [coefficient, setCoefficient] = useState(5);
  const [topicsInput, setTopicsInput] = useState('');
  const [priority, setPriority] = useState<PriorityLevel>('high');
  const [confirmPastExam, setConfirmPastExam] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Grade entry modal state
  const [gradingExamId, setGradingExamId] = useState<string | null>(null);
  const [scoreInput, setScoreInput] = useState('17');
  const [outOfInput, setOutOfInput] = useState('20');

  const now = useMemo(() => new Date(), []);

  const enrichedExams = useMemo(() => {
    return exams
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
      .filter((item) => {
        if (subjectFilter !== 'all' && item.exam.subjectId !== subjectFilter) return false;
        if (filter === 'upcoming') return item.countdown.status !== 'passed';
        if (filter === 'past') return item.countdown.status === 'passed';
        return true;
      })
      .sort((a, b) => a.countdown.totalMinutesRemaining - b.countdown.totalMinutesRemaining);
  }, [exams, now, lang, timeFormat, digitsStyle, filter, subjectFilter]);

  const gradeStats = useMemo(() => {
    const graded = exams.filter((e) => e.grade !== undefined && (e.outOf ?? 20) > 0);
    if (graded.length === 0) return { avg: 15, totalCoeff: 0, avgFormatted: null };
    let weightedSum = 0;
    let totalCoeff = 0;
    for (const g of graded) {
      const normalized20 = ((g.grade ?? 0) / (g.outOf ?? 20)) * 20;
      weightedSum += normalized20 * g.coefficient;
      totalCoeff += g.coefficient;
    }
    const avg = totalCoeff > 0 ? weightedSum / totalCoeff : 0;
    return {
      avg,
      totalCoeff,
      avgFormatted: totalCoeff > 0 ? avg.toFixed(2) : null,
    };
  }, [exams]);

  const nextUpcomingExam = useMemo(() => {
    return enrichedExams.find((item) => item.countdown.status !== 'passed')?.exam ?? null;
  }, [enrichedExams]);

  const targetSimResult = useMemo(() => {
    const nextCoeff = nextUpcomingExam?.coefficient ?? 5;
    return computeTargetExamGrade(
      gradeStats.avg,
      gradeStats.totalCoeff,
      targetAvgInput,
      nextCoeff,
      20
    );
  }, [gradeStats.avg, gradeStats.totalCoeff, targetAvgInput, nextUpcomingExam]);

  const handleAddExam = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (!title.trim()) {
      setErrorMsg(t('error.required'));
      return;
    }

    const targetDate = parseLocalDateTime(date, startTime);
    if (isBefore(targetDate, new Date()) && !confirmPastExam) {
      setConfirmPastExam(true);
      setErrorMsg(t('exams.pastWarning'));
      return;
    }

    const activeSubjId = subjectId || subjects[0]?.id || '';
    const subj = subjects.find((s) => s.id === activeSubjId);
    const parsedTopics = topicsInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    addExam({
      title: title.trim(),
      subjectId: activeSubjId,
      type,
      date,
      startTime,
      durationMinutes,
      room: room.trim() || subj?.room || 'Hall A',
      coefficient,
      topics: parsedTopics,
      priority,
      reminderOffsetsMinutes: [1440, 10080],
      readinessScore: 60,
    });

    setTitle('');
    setRoom('');
    setTopicsInput('');
    setConfirmPastExam(false);
    setIsAddOpen(false);
  };

  const handleSaveGrade = (examId: string) => {
    const sc = parseFloat(scoreInput);
    const mx = parseFloat(outOfInput);
    if (Number.isNaN(sc) || Number.isNaN(mx) || mx <= 0 || sc < 0 || sc > mx) {
      return;
    }
    updateExam(examId, { grade: sc, outOf: mx, readinessScore: 100 });
    setGradingExamId(null);
  };

  const handleDeleteExam = (ex: Exam) => {
    const removed = deleteExam(ex.id);
    if (removed) {
      onPushUndo('common.deletedToast', () => {
        useWaqtiStore.setState((st) => ({
          exams: [...st.exams, removed],
        }));
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Overall Weighted Average */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-display text-[var(--text-primary)]">
            {t('exams.title')}
          </h1>
          <p className="text-sm text-[var(--text-secondary)]">{t('exams.subtitle')}</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {gradeStats.avgFormatted && (
            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-2 text-xs">
              <span className="text-[var(--text-muted)] me-2">{t('exams.overallAverage')}:</span>
              <strong dir="ltr" className="font-mono-tabular text-sm text-[var(--accent-primary)]">
                {digits(gradeStats.avgFormatted)}/20
              </strong>
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              setErrorMsg('');
              setConfirmPastExam(false);
              setIsAddOpen((v) => !v);
            }}
            className="flex items-center gap-2 rounded-xl btn-primary-waqti px-4 py-2.5 text-xs font-semibold shadow-sm transition whitespace-nowrap"
          >
            <Plus className="h-4 w-4" />
            <span>{t('exams.add')}</span>
          </button>
        </div>
      </div>

      {/* Exam Target Grade Simulator Card */}
      <div className="rounded-3xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="rounded-2xl bg-[var(--accent-soft)] p-3 text-[var(--accent-primary)] shrink-0">
            <Calculator className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold font-display text-[var(--text-primary)]">
              {t('exams.simulatorTitle')}
            </h2>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
              {t('exams.simulatorDesc')}
              {nextUpcomingExam ? ` (${nextUpcomingExam.title})` : ''}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 w-full md:w-auto justify-between md:justify-end">
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-[var(--text-secondary)]">
              {t('exams.targetAverage')}:
            </label>
            <input
              type="number"
              min={10}
              max={20}
              step={0.25}
              value={targetAvgInput}
              onChange={(e) => setTargetAvgInput(parseFloat(e.target.value || '16'))}
              className="w-20 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-elevated)] px-2.5 py-1.5 text-xs font-mono tabular-nums font-bold text-[var(--text-primary)]"
            />
          </div>

          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-4 py-2 flex items-center gap-2.5">
            <span className="text-xs text-[var(--text-muted)]">{t('exams.neededGrade')}:</span>
            <span
              dir="ltr"
              className={`text-sm font-bold font-mono tabular-nums ${
                targetSimResult.achievable
                  ? 'text-[var(--accent-primary)]'
                  : 'text-amber-600 dark:text-amber-400'
              }`}
            >
              {digits(targetSimResult.neededGrade)}/20
            </span>
            <span className="text-[11px] font-semibold text-[var(--text-secondary)]">
              · {targetSimResult.achievable ? t('exams.achievable') : t('exams.unachievable')}
            </span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center rounded-xl bg-[var(--bg-elevated)] p-1">
          {(['upcoming', 'past', 'all'] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`rounded-lg px-3.5 py-1.5 text-xs font-medium transition ${
                filter === f
                  ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm'
                  : 'text-[var(--text-secondary)]'
              }`}
            >
              {t(`exams.filter.${f}`)}
            </button>
          ))}
        </div>

        <select
          value={subjectFilter}
          onChange={(e) => setSubjectFilter(e.target.value)}
          aria-label={t('timetable.subject')}
          className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3.5 py-2 text-xs font-medium text-[var(--text-primary)]"
        >
          <option value="all">{t('exams.filter.all')}</option>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      {/* Add Exam Form */}
      {isAddOpen && (
        <form
          onSubmit={handleAddExam}
          className="rounded-3xl border border-[var(--border-strong)] bg-[var(--bg-surface)] p-6 space-y-4"
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                {t('lessons.lessonTitle')}
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

            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                {t('exams.typeLabel')}
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as ExamType)}
                className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2.5 text-sm text-[var(--text-primary)]"
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
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                {t('exams.date')}
              </label>
              <input
                type="date"
                dir="ltr"
                value={date}
                onChange={(e) => {
                  setDate(e.target.value);
                  setConfirmPastExam(false);
                }}
                className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2.5 text-sm font-mono-tabular text-[var(--text-primary)]"
              />
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
                {t('exams.duration')}
              </label>
              <input
                type="number"
                min={15}
                max={360}
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Number(e.target.value))}
                className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2.5 text-sm font-mono-tabular text-[var(--text-primary)]"
              />
            </div>

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
                className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2.5 text-sm font-mono-tabular text-[var(--text-primary)]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                {t('exams.topics')}
              </label>
              <input
                type="text"
                value={topicsInput}
                onChange={(e) => setTopicsInput(e.target.value)}
                placeholder="Fourier Series, Laplace Transform, Boundary Problems"
                className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3.5 py-2.5 text-sm text-[var(--text-primary)]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                {t('lessons.priorityLabel')}
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as PriorityLevel)}
                className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2.5 text-sm text-[var(--text-primary)]"
              >
                {(['low', 'medium', 'high', 'critical'] as PriorityLevel[]).map((p) => (
                  <option key={p} value={p}>
                    {t(`exams.priority.${p}`)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {errorMsg && (
            <div
              role="alert"
              className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-2.5 text-xs font-medium text-amber-700 dark:text-amber-300"
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
              className="rounded-xl btn-primary-waqti px-5 py-2 text-xs font-semibold"
            >
              {t('common.save')}
            </button>
          </div>
        </form>
      )}

      {/* Exams Cards List */}
      {enrichedExams.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-[var(--border-strong)] bg-[var(--bg-surface)] p-12 text-center flex flex-col items-center">
          <EmptyHourglassIllustration />
          <p className="mt-4 text-sm text-[var(--text-secondary)] max-w-md">
            {t('exams.empty')}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {enrichedExams.map(({ exam, countdown }) => {
            const subj = subjects.find((s) => s.id === exam.subjectId);
            const colorStyle = getSubjectColor(subj?.color);
            const examRevisions = revisionSessions.filter((r) => r.examId === exam.id);

            const urgencyBorder =
              countdown.urgency === 'critical'
                ? 'border-rose-500/40'
                : countdown.urgency === 'warning'
                  ? 'border-amber-500/40'
                  : 'border-[var(--border-subtle)]';

            const urgencyText =
              countdown.urgency === 'critical'
                ? 'text-rose-500'
                : countdown.urgency === 'warning'
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-[var(--accent-primary)]';

            return (
              <div
                key={exam.id}
                className={`rounded-3xl border ${urgencyBorder} bg-[var(--bg-surface)] p-6 flex flex-col justify-between`}
              >
                <div>
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                        <span className={`font-semibold ${colorStyle.text}`}>
                          {subj?.name}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{t(`exams.type.${exam.type}`)}</span>
                        <span aria-hidden="true">·</span>
                        <span>
                          {t('subjects.coefficient')} {digits(exam.coefficient)}
                        </span>
                      </div>

                      <h3 className="mt-1.5 text-lg font-bold text-[var(--text-primary)]">
                        {exam.title}
                      </h3>

                      <div className="mt-1 text-xs text-[var(--text-muted)]">
                        {formatLocalizedDate(exam.date, lang, 'EEEE, d MMMM yyyy', digitsStyle)} ·{' '}
                        <span dir="ltr" className="font-mono-tabular">
                          {formatTime(exam.startTime)}
                        </span>{' '}
                        · {exam.room}
                      </div>
                    </div>

                    <div className="flex flex-col items-end shrink-0">
                      <div
                        className={`text-sm font-bold font-mono-tabular ${urgencyText}`}
                      >
                        {countdown.label}
                      </div>
                      {exam.grade !== undefined && (
                        <div
                          dir="ltr"
                          className="mt-1 text-base font-bold font-mono-tabular text-emerald-600 dark:text-emerald-400"
                        >
                          {digits(exam.grade)}/{digits(exam.outOf ?? 20)}
                        </div>
                      )}
                    </div>
                  </div>

                  {exam.topics.length > 0 && (
                    <div className="mt-3 text-xs text-[var(--text-secondary)]">
                      {exam.topics.join(' · ')}
                    </div>
                  )}

                  {/* Revision Readiness Slider */}
                  <div className="mt-4 pt-4 border-t border-[var(--border-subtle)]">
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="text-[var(--text-muted)]">{t('exams.readiness')}</span>
                      <span className="font-mono-tabular font-semibold text-[var(--text-primary)]">
                        {digits(exam.readinessScore)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      aria-label={`${t('exams.readiness')} ${exam.title}`}
                      value={exam.readinessScore}
                      onChange={(e) =>
                        updateExam(exam.id, { readinessScore: Number(e.target.value) })
                      }
                      className="w-full accent-[var(--accent-primary)] h-1.5 rounded-lg cursor-pointer"
                    />
                  </div>

                  {/* Suggested Revision Sessions */}
                  {examRevisions.length > 0 && (
                    <div className="mt-4 space-y-1.5">
                      <div className="text-xs font-semibold text-[var(--text-secondary)]">
                        {t('exams.revisionSessions')}
                      </div>
                      {examRevisions.map((rev) => (
                        <button
                          key={rev.id}
                          type="button"
                          onClick={() => toggleRevisionSession(rev.id)}
                          className="flex w-full items-center justify-between rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 text-xs text-start"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            {rev.completed ? (
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                            ) : (
                              <Circle className="h-3.5 w-3.5 text-[var(--text-muted)] shrink-0" />
                            )}
                            <span
                              className={`truncate ${
                                rev.completed
                                  ? 'line-through text-[var(--text-muted)]'
                                  : 'text-[var(--text-primary)]'
                              }`}
                            >
                              {rev.topic}
                            </span>
                          </div>
                          <span dir="ltr" className="font-mono-tabular text-[11px] text-[var(--text-muted)] shrink-0 ms-2">
                            {rev.date} · {formatRange(rev.startTime, rev.endTime)}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Actions Footer */}
                <div className="mt-5 pt-4 border-t border-[var(--border-subtle)] flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => generateExamRevisions(exam.id)}
                      className="flex items-center gap-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-1.5 text-xs font-medium text-[var(--text-primary)] hover:border-[var(--accent-primary)] transition"
                    >
                      <Sparkles className="h-3.5 w-3.5 text-[var(--accent-primary)]" />
                      <span>{t('exams.generatePlan')}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setGradingExamId(gradingExamId === exam.id ? null : exam.id);
                        setScoreInput(String(exam.grade ?? 17));
                        setOutOfInput(String(exam.outOf ?? 20));
                      }}
                      className="flex items-center gap-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-1.5 text-xs font-medium text-[var(--text-primary)] hover:border-[var(--accent-primary)] transition"
                    >
                      <GraduationCap className="h-3.5 w-3.5" />
                      <span>{t('exams.enterGrade')}</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDeleteExam(exam)}
                    aria-label={`${t('common.delete')} ${exam.title}`}
                    className="rounded-lg p-1.5 text-[var(--text-muted)] hover:text-rose-500"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                {/* Inline Grade Entry */}
                {gradingExamId === exam.id && (
                  <div className="mt-3 pt-3 border-t border-[var(--border-subtle)] flex items-center gap-2">
                    <input
                      type="number"
                      step="0.25"
                      value={scoreInput}
                      onChange={(e) => setScoreInput(e.target.value)}
                      className="w-20 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2.5 py-1.5 text-xs font-mono-tabular text-[var(--text-primary)]"
                      aria-label={t('exams.grade')}
                    />
                    <span className="text-xs text-[var(--text-muted)]">/</span>
                    <input
                      type="number"
                      value={outOfInput}
                      onChange={(e) => setOutOfInput(e.target.value)}
                      className="w-20 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2.5 py-1.5 text-xs font-mono-tabular text-[var(--text-primary)]"
                      aria-label={t('exams.outOf')}
                    />
                    <button
                      type="button"
                      onClick={() => handleSaveGrade(exam.id)}
                      className="rounded-xl btn-primary-waqti px-3.5 py-1.5 text-xs font-semibold"
                    >
                      {t('common.save')}
                    </button>
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
