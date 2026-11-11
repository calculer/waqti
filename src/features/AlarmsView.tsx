import React, { useMemo, useState } from 'react';
import {
  Bell,
  BellRing,
  CheckCircle2,
  Clock,
  Play,
  Plus,
  ShieldCheck,
  Sparkles,
  Trash2,
  Volume2,
} from 'lucide-react';
import { useWaqtiStore } from '../store/useWaqtiStore';
import { useTranslation } from '../hooks/useTranslation';
import { doesAlarmMatchDate, getOrderedWeekdays } from '../lib/dates';
import { soundEngine } from '../lib/sound';
import { EmptyHourglassIllustration } from '../components/WaqtiLogo';
import type {
  AlarmLinkedType,
  AlarmRecurrence,
  AlarmReminder,
  AlarmTone,
  WeekDay,
} from '../types';

export const AlarmsView: React.FC<{
  onPushUndo: (labelKey: string, restore: () => void) => void;
}> = ({ onPushUndo }) => {
  const { t, lang, formatTime, digits } = useTranslation();

  const alarms = useWaqtiStore((s) => s.alarms);
  const todayStr = useWaqtiStore((s) => s.todayStr);
  const settings = useWaqtiStore((s) => s.settings);
  const habits = useWaqtiStore((s) => s.habits);
  const tasks = useWaqtiStore((s) => s.tasks);
  const exams = useWaqtiStore((s) => s.exams);

  const addAlarm = useWaqtiStore((s) => s.addAlarm);
  const toggleAlarm = useWaqtiStore((s) => s.toggleAlarm);
  const deleteAlarm = useWaqtiStore((s) => s.deleteAlarm);
  const triggerTestAlarm = useWaqtiStore((s) => s.triggerTestAlarm);
  const updateSettings = useWaqtiStore((s) => s.updateSettings);

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(todayStr);
  const [hour, setHour] = useState(19);
  const [minute, setMinute] = useState(0);
  const [recurrence, setRecurrence] = useState<AlarmRecurrence>('daily');
  const [daysOfWeek, setDaysOfWeek] = useState<WeekDay[]>([1, 2, 3, 4, 5]);
  const [linkedType, setLinkedType] = useState<AlarmLinkedType>('none');
  const [linkedId, setLinkedId] = useState('');
  const [sound, setSound] = useState<AlarmTone>(settings.defaultAlarmSound);
  const [snoozeMinutes, setSnoozeMinutes] = useState<number>(settings.defaultSnoozeMinutes);
  const [leadMinutes, setLeadMinutes] = useState<number>(0);
  const [vibrate, setVibrate] = useState<boolean>(settings.alarmVibration);
  const [errorMsg, setErrorMsg] = useState('');
  const [notifPerm, setNotifPerm] = useState<NotificationPermission>(
    typeof window !== 'undefined' && 'Notification' in window
      ? Notification.permission
      : 'default'
  );

  const orderedWeekdays = useMemo(
    () => getOrderedWeekdays(lang, settings.weekStart, 'EEE'),
    [lang, settings.weekStart]
  );

  const formattedWheelTime = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;

  const handleRequestNotifications = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    try {
      const res = await Notification.requestPermission();
      setNotifPerm(res);
      if (res === 'granted') {
        updateSettings({ notificationsEnabled: true });
      }
    } catch {
      // Ignore in restricted iframe
    }
  };

  const handleToggleDay = (d: WeekDay) => {
    setDaysOfWeek((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]
    );
  };

  const handleApplyTemplate = (tpl: {
    title: string;
    h: number;
    m: number;
    rec: AlarmRecurrence;
    tone: AlarmTone;
  }) => {
    setTitle(tpl.title);
    setHour(tpl.h);
    setMinute(tpl.m);
    setRecurrence(tpl.rec);
    setSound(tpl.tone);
    setIsAddOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrorMsg(t('error.required'));
      return;
    }

    addAlarm({
      title: title.trim(),
      note: note.trim() || undefined,
      date,
      time: formattedWheelTime,
      recurrence,
      daysOfWeek:
        recurrence === 'weekdays' || recurrence === 'weekly'
          ? daysOfWeek
          : [1, 2, 3, 4, 5, 6, 7],
      linkedType,
      linkedId: linkedId || undefined,
      sound,
      vibrate,
      snoozeMinutes,
      leadMinutes,
      enabled: true,
    });

    setTitle('');
    setNote('');
    setErrorMsg('');
    setIsAddOpen(false);
  };

  const handleDelete = (alarm: AlarmReminder) => {
    const removed = deleteAlarm(alarm.id);
    if (removed) {
      onPushUndo('common.deletedToast', () => {
        useWaqtiStore.setState((st) => ({
          alarms: [removed, ...st.alarms],
        }));
      });
    }
  };

  const groupedAlarms = useMemo(() => {
    const todayList: AlarmReminder[] = [];
    const repeatingList: AlarmReminder[] = [];
    const upcomingList: AlarmReminder[] = [];

    const sorted = [...alarms].sort((a, b) => a.time.localeCompare(b.time));
    for (const al of sorted) {
      if (doesAlarmMatchDate(al, todayStr) || (al.recurrence === 'once' && al.date === todayStr)) {
        todayList.push(al);
      } else if (al.recurrence !== 'once') {
        repeatingList.push(al);
      } else {
        upcomingList.push(al);
      }
    }

    return { todayList, repeatingList, upcomingList };
  }, [alarms, todayStr]);

  const templates = [
    {
      id: 'morning',
      label: t('alarms.tplMorningStudy'),
      h: 7,
      m: 30,
      rec: 'weekdays' as AlarmRecurrence,
      tone: 'morning_chime' as AlarmTone,
    },
    {
      id: 'evening',
      label: t('alarms.tplEveningReview'),
      h: 19,
      m: 0,
      rec: 'daily' as AlarmRecurrence,
      tone: 'soft_bell' as AlarmTone,
    },
    {
      id: 'hydration',
      label: t('alarms.tplHydration'),
      h: 15,
      m: 30,
      rec: 'daily' as AlarmRecurrence,
      tone: 'gentle_rise' as AlarmTone,
    },
    {
      id: 'examprep',
      label: t('alarms.tplExamPrep'),
      h: 17,
      m: 30,
      rec: 'weekdays' as AlarmRecurrence,
      tone: 'marimba' as AlarmTone,
    },
    {
      id: 'sleep',
      label: t('alarms.tplSleepWindDown'),
      h: 22,
      m: 30,
      rec: 'daily' as AlarmRecurrence,
      tone: 'soft_bell' as AlarmTone,
    },
  ];

  const renderAlarmCard = (al: AlarmReminder) => {
    const leadLabelKey: Record<number, string> = {
      0: 'alarms.leadExact',
      10: 'alarms.lead10m',
      30: 'alarms.lead30m',
      60: 'alarms.lead1h',
      1440: 'alarms.lead1d',
    };

    return (
      <div
        key={al.id}
        className={`rounded-2xl border p-4 transition flex items-center justify-between gap-4 ${
          al.enabled
            ? 'border-[var(--border-strong)] bg-[var(--bg-surface)] shadow-sm'
            : 'border-[var(--border-subtle)] bg-[var(--bg-elevated)] opacity-65'
        }`}
      >
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-baseline gap-3">
            <span
              dir="ltr"
              className="text-2xl md:text-3xl font-bold font-display tabular-nums tracking-tight text-[var(--text-primary)]"
            >
              {formatTime(al.time)}
            </span>
            <span className="text-xs font-semibold rounded-lg bg-[var(--accent-soft)] text-[var(--accent-primary)] px-2.5 py-0.5">
              {t(`alarms.rec.${al.recurrence}`)}
            </span>
            {al.leadMinutes > 0 && (
              <span className="text-[11px] font-medium text-[var(--text-muted)]">
                · {t(leadLabelKey[al.leadMinutes] || 'alarms.leadExact')}
              </span>
            )}
          </div>

          <div className="text-sm font-bold text-[var(--text-primary)] truncate">
            {al.title}
          </div>

          {al.note && (
            <p className="text-xs text-[var(--text-secondary)] truncate">{al.note}</p>
          )}

          <div className="flex flex-wrap items-center gap-2 pt-0.5 text-[11px] text-[var(--text-muted)]">
            <span className="inline-flex items-center gap-1 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2 py-0.5">
              <Volume2 className="h-3 w-3 text-[var(--accent-primary)]" />
              {t(`alarms.tones.${al.sound}`)}
            </span>
            <button
              type="button"
              onClick={() => soundEngine.playAlarmPreview(al.sound, settings.alarmVolume)}
              className="inline-flex items-center gap-1 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2 py-0.5 text-[var(--accent-primary)] hover:border-[var(--accent-primary)] transition"
            >
              <Play className="h-2.5 w-2.5" />
              {t('alarms.previewSound')}
            </button>
          </div>
        </div>

        {/* Toggle Switch + Delete */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            role="switch"
            aria-checked={al.enabled}
            aria-label={al.title}
            onClick={() => toggleAlarm(al.id)}
            className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
              al.enabled ? 'bg-[var(--accent-primary)]' : 'bg-[var(--border-strong)]'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-md transition duration-200 ease-in-out ${
                al.enabled ? 'translate-x-5 rtl:-translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>

          <button
            type="button"
            onClick={() => handleDelete(al)}
            aria-label={t('common.delete')}
            className="rounded-xl p-2 text-[var(--text-muted)] hover:bg-rose-500/10 hover:text-rose-500 transition"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-display text-[var(--text-primary)]">
            {t('alarms.title')}
          </h1>
          <p className="text-sm text-[var(--text-secondary)]">{t('alarms.subtitle')}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={triggerTestAlarm}
            className="flex items-center gap-2 rounded-xl border border-[var(--accent-primary)] bg-[var(--accent-soft)] px-3.5 py-2.5 text-xs font-semibold text-[var(--accent-primary)] hover:opacity-90 transition whitespace-nowrap"
          >
            <BellRing className="h-4 w-4" />
            <span>{t('alarms.testAlarm')}</span>
          </button>

          <button
            type="button"
            onClick={() => setIsAddOpen((v) => !v)}
            className="flex items-center gap-2 rounded-xl btn-primary-waqti px-4 py-2.5 text-xs font-semibold shadow-sm transition whitespace-nowrap"
          >
            <Plus className="h-4 w-4" />
            <span>{t('alarms.add')}</span>
          </button>
        </div>
      </div>

      {/* Quick Templates Bar */}
      <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 space-y-2.5">
        <div className="flex items-center gap-2 text-xs font-bold text-[var(--text-secondary)]">
          <Sparkles className="h-3.5 w-3.5 text-[var(--accent-primary)]" />
          <span>{t('alarms.templates')}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {templates.map((tpl) => (
            <button
              key={tpl.id}
              type="button"
              onClick={() =>
                handleApplyTemplate({
                  title: tpl.label,
                  h: tpl.h,
                  m: tpl.m,
                  rec: tpl.rec,
                  tone: tpl.tone,
                })
              }
              className="flex items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 text-xs font-medium text-[var(--text-primary)] hover:border-[var(--accent-primary)] transition"
            >
              <Clock className="h-3.5 w-3.5 text-[var(--accent-primary)]" />
              <span>{tpl.label}</span>
              <span
                dir="ltr"
                className="text-[11px] font-mono tabular-nums text-[var(--text-muted)]"
              >
                {formatTime(
                  `${String(tpl.h).padStart(2, '0')}:${String(tpl.m).padStart(2, '0')}`
                )}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Add Alarm Form */}
      {isAddOpen && (
        <form
          onSubmit={handleSubmit}
          className="rounded-3xl border border-[var(--border-strong)] bg-[var(--bg-surface)] p-6 space-y-5 shadow-lg"
        >
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Structured Time Wheel Selector (Always LTR & Tabular) */}
            <div className="lg:col-span-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4 flex flex-col items-center justify-center space-y-3">
              <span className="text-xs font-semibold text-[var(--text-secondary)]">
                {t('alarms.time')}
              </span>
              <div dir="ltr" className="flex items-center gap-3">
                {/* Hours */}
                <div className="flex flex-col items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setHour((h) => (h + 1) % 24)}
                    className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-1 text-xs font-bold hover:border-[var(--accent-primary)]"
                  >
                    ▲
                  </button>
                  <input
                    type="number"
                    min={0}
                    max={23}
                    value={String(hour).padStart(2, '0')}
                    onChange={(e) =>
                      setHour(Math.max(0, Math.min(23, parseInt(e.target.value || '0', 10))))
                    }
                    className="w-16 text-center rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)] py-2 text-2xl font-bold font-display tabular-nums text-[var(--text-primary)]"
                  />
                  <button
                    type="button"
                    onClick={() => setHour((h) => (h + 23) % 24)}
                    className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-1 text-xs font-bold hover:border-[var(--accent-primary)]"
                  >
                    ▼
                  </button>
                </div>

                <span className="text-2xl font-bold font-display text-[var(--accent-primary)]">
                  :
                </span>

                {/* Minutes */}
                <div className="flex flex-col items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setMinute((m) => (m + 5) % 60)}
                    className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-1 text-xs font-bold hover:border-[var(--accent-primary)]"
                  >
                    ▲
                  </button>
                  <input
                    type="number"
                    min={0}
                    max={59}
                    value={String(minute).padStart(2, '0')}
                    onChange={(e) =>
                      setMinute(Math.max(0, Math.min(59, parseInt(e.target.value || '0', 10))))
                    }
                    className="w-16 text-center rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)] py-2 text-2xl font-bold font-display tabular-nums text-[var(--text-primary)]"
                  />
                  <button
                    type="button"
                    onClick={() => setMinute((m) => (m + 55) % 60)}
                    className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-1 text-xs font-bold hover:border-[var(--accent-primary)]"
                  >
                    ▼
                  </button>
                </div>
              </div>
              <div dir="ltr" className="text-xs font-mono tabular-nums text-[var(--accent-primary)]">
                {formatTime(formattedWheelTime)}
              </div>
            </div>

            {/* Form Details */}
            <div className="lg:col-span-8 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                    {t('alarms.alarmTitle')}
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder={t('alarms.tplEveningReview')}
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3.5 py-2.5 text-sm text-[var(--text-primary)]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                    {t('alarms.note')}
                  </label>
                  <input
                    type="text"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="..."
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3.5 py-2.5 text-sm text-[var(--text-primary)]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                    {t('alarms.recurrence')}
                  </label>
                  <select
                    value={recurrence}
                    onChange={(e) => setRecurrence(e.target.value as AlarmRecurrence)}
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2.5 text-sm text-[var(--text-primary)]"
                  >
                    {(['once', 'daily', 'weekdays', 'weekly', 'monthly'] as AlarmRecurrence[]).map(
                      (rec) => (
                        <option key={rec} value={rec}>
                          {t(`alarms.rec.${rec}`)}
                        </option>
                      )
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                    {t('alarms.sound')}
                  </label>
                  <div className="flex items-center gap-1.5">
                    <select
                      value={sound}
                      onChange={(e) => setSound(e.target.value as AlarmTone)}
                      className="flex-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2.5 text-sm text-[var(--text-primary)]"
                    >
                      {(
                        [
                          'soft_bell',
                          'morning_chime',
                          'marimba',
                          'gentle_rise',
                          'digital',
                        ] as AlarmTone[]
                      ).map((tn) => (
                        <option key={tn} value={tn}>
                          {t(`alarms.tones.${tn}`)}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => soundEngine.playAlarmPreview(sound, settings.alarmVolume)}
                      title={t('alarms.previewSound')}
                      className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-2.5 text-[var(--accent-primary)] hover:border-[var(--accent-primary)]"
                    >
                      <Volume2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                    {t('alarms.leadTime')}
                  </label>
                  <select
                    value={leadMinutes}
                    onChange={(e) => setLeadMinutes(Number(e.target.value))}
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2.5 text-sm text-[var(--text-primary)]"
                  >
                    <option value={0}>{t('alarms.leadExact')}</option>
                    <option value={10}>{t('alarms.lead10m')}</option>
                    <option value={30}>{t('alarms.lead30m')}</option>
                    <option value={60}>{t('alarms.lead1h')}</option>
                    <option value={1440}>{t('alarms.lead1d')}</option>
                  </select>
                </div>
              </div>

              {/* Weekday Selector Chips ordered by locale weekStart */}
              {(recurrence === 'weekdays' || recurrence === 'weekly') && (
                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                    {t('timetable.day')}
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {orderedWeekdays.map((w) => {
                      const active = daysOfWeek.includes(w.dayIndex);
                      return (
                        <button
                          key={w.dayIndex}
                          type="button"
                          onClick={() => handleToggleDay(w.dayIndex)}
                          className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
                            active
                              ? 'border-[var(--accent-primary)] bg-[var(--accent-soft)] text-[var(--accent-primary)]'
                              : 'border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-muted)]'
                          }`}
                        >
                          {w.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Link to Habit / Task / Exam */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                    {t('alarms.linkedTo')}
                  </label>
                  <select
                    value={linkedType}
                    onChange={(e) => {
                      setLinkedType(e.target.value as AlarmLinkedType);
                      setLinkedId('');
                    }}
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2.5 text-sm text-[var(--text-primary)]"
                  >
                    <option value="none">{t('alarms.linkNone')}</option>
                    <option value="habit">{t('alarms.linkHabit')}</option>
                    <option value="task">{t('alarms.linkTask')}</option>
                    <option value="exam">{t('alarms.linkExam')}</option>
                  </select>
                </div>

                {linkedType !== 'none' && (
                  <div>
                    <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                      {t('timetable.subject')}
                    </label>
                    <select
                      value={linkedId}
                      onChange={(e) => setLinkedId(e.target.value)}
                      className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2.5 text-sm text-[var(--text-primary)]"
                    >
                      <option value="">—</option>
                      {linkedType === 'habit' &&
                        habits.map((h) => (
                          <option key={h.id} value={h.id}>
                            {h.name}
                          </option>
                        ))}
                      {linkedType === 'task' &&
                        tasks.map((tk) => (
                          <option key={tk.id} value={tk.id}>
                            {tk.title}
                          </option>
                        ))}
                      {linkedType === 'exam' &&
                        exams.map((ex) => (
                          <option key={ex.id} value={ex.id}>
                            {ex.title}
                          </option>
                        ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                    {t('alarms.snoozeDuration')}
                  </label>
                  <div className="flex items-center gap-2">
                    {[5, 10, 15].map((mins) => (
                      <button
                        key={mins}
                        type="button"
                        onClick={() => setSnoozeMinutes(mins)}
                        className={`flex-1 rounded-xl border py-2 text-xs font-semibold tabular-nums ${
                          snoozeMinutes === mins
                            ? 'border-[var(--accent-primary)] bg-[var(--accent-soft)] text-[var(--accent-primary)]'
                            : 'border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-secondary)]'
                        }`}
                      >
                        {digits(mins)} {t('common.minutesShort')}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {recurrence === 'once' && (
                <div className="max-w-xs">
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                    {t('lessons.dueDate')}
                  </label>
                  <input
                    type="date"
                    dir="ltr"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 text-sm font-mono-tabular text-[var(--text-primary)]"
                  />
                </div>
              )}

              {errorMsg && (
                <div
                  role="alert"
                  className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3.5 py-2 text-xs font-medium text-rose-600 dark:text-rose-300"
                >
                  {errorMsg}
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="rounded-xl border border-[var(--border-subtle)] px-4 py-2.5 text-xs font-medium text-[var(--text-secondary)]"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  className="rounded-xl btn-primary-waqti px-5 py-2.5 text-xs font-semibold"
                >
                  {t('common.save')}
                </button>
              </div>
            </div>
          </div>
        </form>
      )}

      {/* Grouped Alarms Lists */}
      {alarms.length === 0 ? (
        <div className="rounded-3xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-12 flex flex-col items-center text-center">
          <EmptyHourglassIllustration className="w-20 h-20 mb-4" />
          <p className="text-sm text-[var(--text-muted)] max-w-md">{t('alarms.empty')}</p>
        </div>
      ) : (
        <div className="space-y-6">
          {groupedAlarms.todayList.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--accent-primary)] flex items-center gap-2">
                <Bell className="h-3.5 w-3.5" />
                <span>
                  {t('alarms.groupToday')} ({digits(groupedAlarms.todayList.length)})
                </span>
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {groupedAlarms.todayList.map(renderAlarmCard)}
              </div>
            </section>
          )}

          {groupedAlarms.repeatingList.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                {t('alarms.groupRepeating')} ({digits(groupedAlarms.repeatingList.length)})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {groupedAlarms.repeatingList.map(renderAlarmCard)}
              </div>
            </section>
          )}

          {groupedAlarms.upcomingList.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                {t('alarms.groupUpcoming')} ({digits(groupedAlarms.upcomingList.length)})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {groupedAlarms.upcomingList.map(renderAlarmCard)}
              </div>
            </section>
          )}
        </div>
      )}

      {/* Honest Browser Notification & Background Health Check Card */}
      <div className="rounded-3xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="rounded-2xl bg-[var(--accent-soft)] p-3 text-[var(--accent-primary)] shrink-0">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-[var(--text-primary)]">
                {t('alarms.healthCheckTitle')}
              </h3>
              <span
                className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold ${
                  notifPerm === 'granted'
                    ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                    : 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                }`}
              >
                <CheckCircle2 className="h-3 w-3" />
                {notifPerm === 'granted'
                  ? t('alarms.permGranted')
                  : t('alarms.permNotGranted')}
              </span>
            </div>
            <p className="text-xs text-[var(--text-secondary)] max-w-2xl leading-relaxed">
              {t('alarms.browserLimitNotice')}
            </p>
          </div>
        </div>

        {notifPerm !== 'granted' && (
          <button
            type="button"
            onClick={handleRequestNotifications}
            className="rounded-xl border border-[var(--accent-primary)] bg-[var(--accent-soft)] px-4 py-2.5 text-xs font-semibold text-[var(--accent-primary)] hover:opacity-90 transition shrink-0"
          >
            {t('settings.enableNotifications')}
          </button>
        )}
      </div>
    </div>
  );
};
