import React, { useMemo } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Award, CalendarCheck, Shield, Sparkles } from 'lucide-react';
import { useWaqtiStore } from '../store/useWaqtiStore';
import { useTranslation } from '../hooks/useTranslation';
import {
  computeStatsByTypeAndMode,
  formatLocalizedDate,
  shiftDateString,
} from '../lib/dates';
import { getSubjectColor } from '../lib/colors';
import { SessionMetaBadges } from '../components/SessionMetaBadges';
import type { AttendanceRecord, DeliveryMode, SessionType } from '../types';

export const StatsView: React.FC = () => {
  const { t, lang, digitsStyle, digits } = useTranslation();
  const subjects = useWaqtiStore((s) => s.subjects);
  const timetable = useWaqtiStore((s) => s.timetable);
  const focusSessions = useWaqtiStore((s) => s.focusSessions);
  const tasks = useWaqtiStore((s) => s.tasks);
  const habits = useWaqtiStore((s) => s.habits);
  const exams = useWaqtiStore((s) => s.exams);
  const todayStr = useWaqtiStore((s) => s.todayStr);
  const xp = useWaqtiStore((s) => s.xp);
  const level = useWaqtiStore((s) => s.level);
  const settings = useWaqtiStore((s) => s.settings);

  const studyBySubjectData = useMemo(() => {
    return subjects.map((subj) => {
      const mins = focusSessions
        .filter((f) => f.subjectId === subj.id && f.mode === 'focus')
        .reduce((acc, cur) => acc + cur.durationMinutes, 0);
      return {
        name: subj.name.slice(0, 18),
        hours: Number((mins / 60).toFixed(1)),
        goal: subj.weeklyGoalHours,
        fill: getSubjectColor(subj.color).hex,
      };
    });
  }, [subjects, focusSessions]);

  const dailyRhythmData = useMemo(() => {
    return Array.from({ length: 7 }, (_, idx) => {
      const dStr = shiftDateString(todayStr, -(6 - idx));
      const mins = focusSessions
        .filter((f) => f.date === dStr && f.mode === 'focus')
        .reduce((acc, cur) => acc + cur.durationMinutes, 0);
      return {
        day: formatLocalizedDate(dStr, lang, 'EEE', digitsStyle),
        hours: Number((mins / 60).toFixed(2)),
      };
    });
  }, [todayStr, focusSessions, lang, digitsStyle]);

  const totalFocusMinutes = useMemo(
    () =>
      focusSessions
        .filter((f) => f.mode === 'focus')
        .reduce((acc, cur) => acc + cur.durationMinutes, 0),
    [focusSessions]
  );

  const taskCompletionRate = useMemo(() => {
    if (tasks.length === 0) return 100;
    const doneCount = tasks.filter((tk) => tk.status === 'done').length;
    return Math.round((doneCount / tasks.length) * 100);
  }, [tasks]);

  const habitConsistency = useMemo(() => {
    if (habits.length === 0) return 100;
    const last7 = Array.from({ length: 7 }, (_, i) => shiftDateString(todayStr, -i));
    let checks = 0;
    for (const h of habits) {
      checks += last7.filter((d) => h.completedDates.includes(d)).length;
    }
    return Math.min(100, Math.round((checks / (habits.length * 7)) * 100));
  }, [habits, todayStr]);

  // Convert timetable attendanceByDate maps into AttendanceRecord[] and compute breakdown by type & mode
  const typeAndModeStats = useMemo(() => {
    const records: AttendanceRecord[] = [];
    for (const sl of timetable) {
      if (sl.attendanceByDate) {
        for (const [dateStr, st] of Object.entries(sl.attendanceByDate)) {
          records.push({
            id: `${sl.id}-${dateStr}`,
            slotId: sl.id,
            subjectId: sl.subjectId,
            date: dateStr,
            status: st === 'attended' ? 'attended' : 'absent',
          });
        }
      }
    }
    return computeStatsByTypeAndMode(timetable, records);
  }, [timetable]);

  const totalWeeklyScheduledHours = useMemo(() => {
    return Object.values(typeAndModeStats.hoursByType).reduce((a, b) => a + b, 0);
  }, [typeAndModeStats]);

  const narrativeSummary = useMemo(() => {
    const hrs = (totalFocusMinutes / 60).toFixed(1);
    const topSubj =
      [...studyBySubjectData].sort((a, b) => b.hours - a.hours)[0]?.name ?? '';
    if (lang === 'ar') {
      return `لقد أتممت ${digits(hrs)} ساعة من التركيز العميق هذا الأسبوع، وكانت مادة "${topSubj}" في صدارة اهتمامك. نسبة إنجاز مهامك بلغت ${digits(taskCompletionRate)}% وثبات عاداتك اليومية ${digits(habitConsistency)}%. استمر على هذا الإيقاع المتوازن!`;
    }
    if (lang === 'fr') {
      return `Vous avez cumulé ${hrs} heures de concentration cette semaine, avec une priorité donnée à « ${topSubj} ». Votre taux de complétion des devoirs atteint ${taskCompletionRate}% et votre régularité d'habitudes est de ${habitConsistency}%.`;
    }
    return `You logged ${hrs} hours of deep focus this week, led by "${topSubj}". Your task completion stands at ${taskCompletionRate}% with ${habitConsistency}% habit consistency. Keep riding this calm momentum.`;
  }, [totalFocusMinutes, studyBySubjectData, lang, digits, taskCompletionRate, habitConsistency]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-display text-[var(--text-primary)]">
          {t('stats.title')}
        </h1>
        <p className="text-sm text-[var(--text-secondary)]">{t('stats.subtitle')}</p>
      </div>

      {/* Gamification XP / Level + Sunday Weekly Review Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {settings.gamificationEnabled && (
          <div className="lg:col-span-5 rounded-3xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="h-12 w-12 rounded-2xl bg-[var(--accent-soft)] text-[var(--accent-primary)] flex items-center justify-center font-bold font-display text-lg">
                <Award className="h-6 w-6" />
              </div>
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-[var(--accent-primary)]">
                  {t('stats.level', { level: digits(level) })}
                </div>
                <div className="text-lg font-bold font-display tabular-nums text-[var(--text-primary)]">
                  {t('stats.xp', { xp: digits(xp) })}
                </div>
              </div>
            </div>

            {settings.streakFreezeAvailable && (
              <div className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                <Shield className="h-3.5 w-3.5" />
                <span>{t('stats.streakFreeze')}</span>
              </div>
            )}
          </div>
        )}

        <div
          className={`${
            settings.gamificationEnabled ? 'lg:col-span-7' : 'lg:col-span-12'
          } rounded-3xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 flex items-start gap-3.5`}
        >
          <div className="rounded-2xl bg-[var(--accent-soft)] p-3 text-[var(--accent-primary)] shrink-0">
            <CalendarCheck className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold font-display text-[var(--text-primary)]">
              {t('stats.weeklyReviewTitle')}
            </h2>
            <p className="mt-1 text-xs text-[var(--text-secondary)] leading-relaxed">
              {t('stats.weeklyReviewDesc')}
            </p>
          </div>
        </div>
      </div>

      {/* Friendly Weekly Narrative Report */}
      <div className="rounded-3xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 flex items-start gap-3.5">
        <Sparkles className="h-5 w-5 text-[var(--accent-primary)] shrink-0 mt-0.5" />
        <div>
          <h2 className="text-sm font-bold text-[var(--text-primary)]">
            {t('stats.weeklySummaryTitle')}
          </h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)] leading-relaxed">
            {narrativeSummary}
          </p>
        </div>
      </div>

      {/* KPI Summary Strip */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-3xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5">
          <div className="text-xs text-[var(--text-muted)]">{t('stats.taskCompletionRate')}</div>
          <div className="mt-2 text-2xl font-bold font-display tabular-nums text-[var(--text-primary)]">
            {digits(taskCompletionRate)}%
          </div>
        </div>
        <div className="rounded-3xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5">
          <div className="text-xs text-[var(--text-muted)]">{t('stats.habitConsistency')}</div>
          <div className="mt-2 text-2xl font-bold font-display tabular-nums text-emerald-600 dark:text-emerald-400">
            {digits(habitConsistency)}%
          </div>
        </div>
        <div className="rounded-3xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5">
          <div className="text-xs text-[var(--text-muted)]">{t('stats.bestHours')}</div>
          <div
            dir="ltr"
            className="mt-2 text-2xl font-bold font-display tabular-nums text-[var(--accent-primary)]"
          >
            {t('stats.bestHoursValue')}
          </div>
        </div>
      </div>

      {/* NEW: Weekly Class Hours & Attendance Split by Session Type and Delivery Mode */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Weekly Hours by Session Type + Attendance Rate per Type */}
        <div className="rounded-3xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-[var(--text-primary)]">
              {t('stats.hoursByTypeTitle')}
            </h3>
            <span className="text-xs text-[var(--text-muted)] shrink-0">
              {t('stats.attendanceByType')}
            </span>
          </div>

          <div className="space-y-3">
            {(['lecture', 'td', 'tp', 'other'] as SessionType[]).map((st) => {
              const hrs = typeAndModeStats.hoursByType[st];
              const pct =
                totalWeeklyScheduledHours > 0
                  ? Math.round((hrs / totalWeeklyScheduledHours) * 100)
                  : 0;
              const attRate = typeAndModeStats.attendanceByType[st].rate ?? 100;

              return (
                <div key={st} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <SessionMetaBadges type={st} compact />
                      <span
                        dir="ltr"
                        className="font-mono-tabular font-semibold text-[var(--text-primary)]"
                      >
                        {digits(hrs)}h
                      </span>
                    </div>
                    <span
                      dir="ltr"
                      className="font-mono-tabular text-[11px] font-bold text-emerald-600 dark:text-emerald-400"
                    >
                      {digits(attRate)}%
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-[var(--bg-elevated)] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[var(--accent-primary)] transition-all duration-300"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Weekly Hours by Delivery Mode + Attendance Rate per Mode */}
        <div className="rounded-3xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-[var(--text-primary)]">
              {t('stats.hoursByModeTitle')}
            </h3>
            <span className="text-xs text-[var(--text-muted)] shrink-0">
              {t('stats.attendanceByType')}
            </span>
          </div>

          <div className="space-y-3">
            {(['in_person', 'remote', 'hybrid'] as DeliveryMode[]).map((md) => {
              const hrs = typeAndModeStats.hoursByMode[md];
              const pct =
                totalWeeklyScheduledHours > 0
                  ? Math.round((hrs / totalWeeklyScheduledHours) * 100)
                  : 0;
              const attRate = typeAndModeStats.attendanceByMode[md].rate ?? 100;

              return (
                <div key={md} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <SessionMetaBadges mode={md} showModeLabel compact />
                      <span
                        dir="ltr"
                        className="font-mono-tabular font-semibold text-[var(--text-primary)]"
                      >
                        {digits(hrs)}h
                      </span>
                    </div>
                    <span
                      dir="ltr"
                      className="font-mono-tabular text-[11px] font-bold text-emerald-600 dark:text-emerald-400"
                    >
                      {digits(attRate)}%
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-[var(--bg-elevated)] overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        md === 'remote'
                          ? 'bg-sky-500'
                          : md === 'hybrid'
                            ? 'bg-purple-500'
                            : 'bg-emerald-500'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Study Rhythm AreaChart */}
        <div className="rounded-3xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6">
          <h3 className="text-sm font-bold text-[var(--text-primary)] mb-4">
            {t('stats.dailyStudyHours')}
          </h3>
          <div className="h-64 w-full" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dailyRhythmData}>
                <defs>
                  <linearGradient id="focusAreaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#D9B44A" stopOpacity={0.45} />
                    <stop offset="95%" stopColor="#D9B44A" stopOpacity={0.03} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(168,156,127,0.18)" />
                <XAxis dataKey="day" stroke="#A89C7F" fontSize={11} />
                <YAxis stroke="#A89C7F" fontSize={11} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--bg-surface)',
                    borderColor: 'var(--border-strong)',
                    borderRadius: '12px',
                    fontSize: '12px',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="hours"
                  stroke="#D9B44A"
                  strokeWidth={2.5}
                  fill="url(#focusAreaGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Study Hours per Subject BarChart */}
        <div className="rounded-3xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6">
          <h3 className="text-sm font-bold text-[var(--text-primary)] mb-4">
            {t('stats.studyBySubject')}
          </h3>
          <div className="h-64 w-full" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={studyBySubjectData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(168,156,127,0.18)" />
                <XAxis dataKey="name" stroke="#A89C7F" fontSize={11} />
                <YAxis stroke="#A89C7F" fontSize={11} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--bg-surface)',
                    borderColor: 'var(--border-strong)',
                    borderRadius: '12px',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="hours" fill="#D9B44A" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Graded Exams Summary Table */}
      <div className="rounded-3xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6">
        <h3 className="text-sm font-bold text-[var(--text-primary)] mb-4">
          {t('stats.gradeEvolution')}
        </h3>
        <div className="divide-y divide-[var(--border-subtle)]">
          {exams
            .filter((e) => e.grade !== undefined)
            .map((e) => {
              const subj = subjects.find((s) => s.id === e.subjectId);
              return (
                <div
                  key={e.id}
                  className="py-3 flex items-center justify-between text-xs"
                >
                  <div>
                    <div className="font-semibold text-[var(--text-primary)]">{e.title}</div>
                    <div className="text-[var(--text-muted)]">{subj?.name}</div>
                  </div>
                  <div
                    dir="ltr"
                    className="font-mono-tabular text-sm font-bold text-emerald-600 dark:text-emerald-400"
                  >
                    {digits(e.grade ?? 0)}/{digits(e.outOf ?? 20)}
                  </div>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
};
