import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type {
  ActiveTimerState,
  AppNotification,
  Exam,
  FocusSessionLog,
  Habit,
  Language,
  LessonLog,
  NavSection,
  RevisionSession,
  StudyTask,
  Subject,
  TimetableSlot,
  UserSettings,
} from '../types';
import {
  calculateHabitStreak,
  detectTimezone,
  generateRevisionPlanForExam,
  getLocalDateString,
} from '../lib/dates';
import {
  detectBrowserLanguage,
  getDefaultWeekendDays,
  getDefaultWeekStart,
} from '../lib/i18n';
import { buildSeedDemoData } from '../lib/demoData';

export const STORAGE_SCHEMA_VERSION = 2;

export interface WaqtiState {
  schemaVersion: number;
  activeNav: NavSection;
  selectedSubjectId: string | null;
  todayStr: string;
  settings: UserSettings;
  subjects: Subject[];
  timetable: TimetableSlot[];
  exams: Exam[];
  revisionSessions: RevisionSession[];
  lessons: LessonLog[];
  tasks: StudyTask[];
  habits: Habit[];
  focusSessions: FocusSessionLog[];
  notifications: AppNotification[];
  timer: ActiveTimerState;

  // Navigation & Clock Rollover
  setActiveNav: (nav: NavSection, subjectId?: string | null) => void;
  refreshTodayIfNeeded: () => void;

  // Settings & Language
  setLanguage: (lang: Language) => void;
  updateSettings: (partial: Partial<UserSettings>) => void;
  loadDemoWorkspace: (lang?: Language) => void;
  clearAllData: () => void;
  importWorkspaceJson: (rawJson: string) => boolean;

  // Subjects CRUD
  addSubject: (subj: Omit<Subject, 'id' | 'createdAt' | 'archived'>) => string;
  updateSubject: (id: string, partial: Partial<Subject>) => void;
  deleteSubject: (id: string) => Subject | null;

  // Timetable CRUD
  addTimetableSlot: (slot: Omit<TimetableSlot, 'id'>) => string;
  updateTimetableSlot: (id: string, partial: Partial<TimetableSlot>) => void;
  deleteTimetableSlot: (id: string) => TimetableSlot | null;
  duplicateDaySlots: (fromDay: number, toDay: number) => void;

  // Exams & Revision CRUD
  addExam: (exam: Omit<Exam, 'id'>) => string;
  updateExam: (id: string, partial: Partial<Exam>) => void;
  deleteExam: (id: string) => Exam | null;
  generateExamRevisions: (examId: string) => RevisionSession[];
  setCustomRevisionSessions: (examId: string, sessions: RevisionSession[]) => void;
  toggleRevisionSession: (id: string) => void;

  // Lessons & Tasks CRUD
  addLesson: (lesson: Omit<LessonLog, 'id'>) => string;
  deleteLesson: (id: string) => void;
  addTask: (task: Omit<StudyTask, 'id'>) => string;
  updateTask: (id: string, partial: Partial<StudyTask>) => void;
  deleteTask: (id: string) => StudyTask | null;
  toggleSubtask: (taskId: string, subtaskId: string) => void;

  // Habits CRUD
  addHabit: (habit: Omit<Habit, 'id' | 'completedDates' | 'bestStreak' | 'createdAt'>) => string;
  toggleHabitDate: (habitId: string, dateStr: string) => void;
  deleteHabit: (id: string) => Habit | null;

  // Focus Timer (Timestamp-based)
  startTimer: () => void;
  pauseTimer: () => void;
  resetTimer: (mode?: ActiveTimerState['mode']) => void;
  setTimerSubject: (subjectId: string) => void;
  setTimerAmbientSound: (sound: ActiveTimerState['ambientSound']) => void;
  completeTimerSession: () => void;

  // Notifications
  markAllNotificationsRead: () => void;
  snoozeNotification: (id: string) => void;
}

const initialLang = detectBrowserLanguage();
const initialTz = detectTimezone();
const initialToday = getLocalDateString(new Date(), initialTz);
const initialDemo = buildSeedDemoData(initialLang, initialToday);

const defaultSettings: UserSettings = {
  language: initialLang,
  theme: 'dark',
  accent: 'violet',
  weekStart: getDefaultWeekStart(initialLang),
  weekendDays: getDefaultWeekendDays(initialLang),
  timeFormat: '24h',
  timezone: initialTz,
  digitsStyle: 'western',
  showHijri: false,
  pomodoroFocusMinutes: 25,
  pomodoroShortBreakMinutes: 5,
  pomodoroLongBreakMinutes: 15,
  notificationsEnabled: false,
  hasCompletedOnboarding: false,
  isDemoData: true,
};

/**
 * Versioned storage migration function to safely upgrade older schemas or repair corrupted fields.
 */
export function migrateWaqtiState(persistedState: unknown, version: number): Partial<WaqtiState> {
  if (!persistedState || typeof persistedState !== 'object') {
    return {};
  }
  const raw = persistedState as Record<string, unknown>;
  const settings = {
    ...defaultSettings,
    ...(typeof raw.settings === 'object' && raw.settings !== null ? raw.settings : {}),
  } as UserSettings;

  return {
    ...raw,
    schemaVersion: STORAGE_SCHEMA_VERSION,
    settings,
    subjects: Array.isArray(raw.subjects) ? raw.subjects : initialDemo.subjects,
    timetable: Array.isArray(raw.timetable) ? raw.timetable : initialDemo.timetable,
    exams: Array.isArray(raw.exams) ? raw.exams : initialDemo.exams,
    revisionSessions: Array.isArray(raw.revisionSessions)
      ? raw.revisionSessions
      : initialDemo.revisionSessions,
    lessons: Array.isArray(raw.lessons) ? raw.lessons : initialDemo.lessons,
    tasks: Array.isArray(raw.tasks) ? raw.tasks : initialDemo.tasks,
    habits: Array.isArray(raw.habits) ? raw.habits : initialDemo.habits,
    focusSessions: Array.isArray(raw.focusSessions)
      ? raw.focusSessions
      : initialDemo.focusSessions,
  };
}

export const useWaqtiStore = create<WaqtiState>()(
  persist(
    (set, get) => ({
      schemaVersion: STORAGE_SCHEMA_VERSION,
      activeNav: 'dashboard',
      selectedSubjectId: null,
      todayStr: initialToday,
      settings: defaultSettings,
      subjects: initialDemo.subjects,
      timetable: initialDemo.timetable,
      exams: initialDemo.exams,
      revisionSessions: initialDemo.revisionSessions,
      lessons: initialDemo.lessons,
      tasks: initialDemo.tasks,
      habits: initialDemo.habits,
      focusSessions: initialDemo.focusSessions,
      notifications: [
        {
          id: 'notif-welcome',
          titleKey: 'dashboard.nextExam',
          bodyKey: 'dashboard.tipBody',
          createdAt: new Date().toISOString(),
          read: false,
          category: 'exam',
        },
      ],
      timer: {
        isRunning: false,
        mode: 'focus',
        subjectId: initialDemo.subjects[0]?.id ?? '',
        startedAtTimestamp: null,
        accumulatedElapsedMs: 0,
        targetDurationMs: 25 * 60_000,
        completedCycles: 0,
        ambientSound: 'none',
      },

      setActiveNav: (nav, subjectId = null) =>
        set({ activeNav: nav, selectedSubjectId: subjectId }),

      refreshTodayIfNeeded: () => {
        const tz = get().settings.timezone;
        const currentToday = getLocalDateString(new Date(), tz);
        if (currentToday !== get().todayStr) {
          set({ todayStr: currentToday });
        }
      },

      setLanguage: (lang) =>
        set((state) => {
          const updatedSettings: UserSettings = {
            ...state.settings,
            language: lang,
            weekStart: getDefaultWeekStart(lang),
            weekendDays: getDefaultWeekendDays(lang),
          };
          // If still using untouched demo workspace, localize demo items seamlessly
          if (state.settings.isDemoData) {
            const localizedDemo = buildSeedDemoData(lang, state.todayStr);
            return {
              settings: updatedSettings,
              subjects: localizedDemo.subjects,
              timetable: localizedDemo.timetable,
              exams: localizedDemo.exams,
              revisionSessions: localizedDemo.revisionSessions,
              lessons: localizedDemo.lessons,
              tasks: localizedDemo.tasks,
              habits: localizedDemo.habits,
            };
          }
          return { settings: updatedSettings };
        }),

      updateSettings: (partial) =>
        set((state) => {
          const nextSettings = { ...state.settings, ...partial };
          const nextToday = getLocalDateString(new Date(), nextSettings.timezone);
          let nextTimer = state.timer;
          if (
            !state.timer.isRunning &&
            state.timer.accumulatedElapsedMs === 0 &&
            (partial.pomodoroFocusMinutes ||
              partial.pomodoroShortBreakMinutes ||
              partial.pomodoroLongBreakMinutes)
          ) {
            const mins =
              state.timer.mode === 'focus'
                ? nextSettings.pomodoroFocusMinutes
                : state.timer.mode === 'shortBreak'
                  ? nextSettings.pomodoroShortBreakMinutes
                  : nextSettings.pomodoroLongBreakMinutes;
            nextTimer = { ...state.timer, targetDurationMs: mins * 60_000 };
          }
          return {
            settings: nextSettings,
            todayStr: nextToday,
            timer: nextTimer,
          };
        }),

      loadDemoWorkspace: (lang) =>
        set((state) => {
          const targetLang = lang ?? state.settings.language;
          const demo = buildSeedDemoData(targetLang, state.todayStr);
          return {
            ...demo,
            settings: {
              ...state.settings,
              language: targetLang,
              isDemoData: true,
              hasCompletedOnboarding: true,
            },
            timer: {
              ...state.timer,
              subjectId: demo.subjects[0]?.id ?? '',
            },
          };
        }),

      clearAllData: () =>
        set((state) => ({
          subjects: [],
          timetable: [],
          exams: [],
          revisionSessions: [],
          lessons: [],
          tasks: [],
          habits: [],
          focusSessions: [],
          notifications: [],
          settings: {
            ...state.settings,
            isDemoData: false,
          },
        })),

      importWorkspaceJson: (rawJson) => {
        try {
          const parsed = JSON.parse(rawJson) as Partial<WaqtiState>;
          if (!parsed || typeof parsed !== 'object') return false;
          set((state) => ({
            ...state,
            ...migrateWaqtiState(parsed, STORAGE_SCHEMA_VERSION),
          }));
          return true;
        } catch {
          return false;
        }
      },

      addSubject: (subj) => {
        const id = `subj-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        const newSubject: Subject = {
          ...subj,
          id,
          archived: false,
          createdAt: new Date().toISOString(),
        };
        set((state) => ({
          subjects: [...state.subjects, newSubject],
          settings: { ...state.settings, isDemoData: false },
        }));
        return id;
      },

      updateSubject: (id, partial) =>
        set((state) => ({
          subjects: state.subjects.map((s) => (s.id === id ? { ...s, ...partial } : s)),
        })),

      deleteSubject: (id) => {
        const target = get().subjects.find((s) => s.id === id) ?? null;
        if (!target) return null;
        set((state) => ({
          subjects: state.subjects.filter((s) => s.id !== id),
          timetable: state.timetable.filter((t) => t.subjectId !== id),
          exams: state.exams.filter((e) => e.subjectId !== id),
          tasks: state.tasks.filter((tk) => tk.subjectId !== id),
        }));
        return target;
      },

      addTimetableSlot: (slot) => {
        const id = `slot-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        set((state) => ({
          timetable: [...state.timetable, { ...slot, id }],
          settings: { ...state.settings, isDemoData: false },
        }));
        return id;
      },

      updateTimetableSlot: (id, partial) =>
        set((state) => ({
          timetable: state.timetable.map((sl) => (sl.id === id ? { ...sl, ...partial } : sl)),
        })),

      deleteTimetableSlot: (id) => {
        const target = get().timetable.find((sl) => sl.id === id) ?? null;
        if (!target) return null;
        set((state) => ({
          timetable: state.timetable.filter((sl) => sl.id !== id),
        }));
        return target;
      },

      duplicateDaySlots: (fromDay, toDay) =>
        set((state) => {
          const sourceSlots = state.timetable.filter((s) => s.dayOfWeek === fromDay);
          const cloned: TimetableSlot[] = sourceSlots.map((s, idx) => ({
            ...s,
            id: `slot-dup-${Date.now()}-${idx}`,
            dayOfWeek: toDay as TimetableSlot['dayOfWeek'],
          }));
          return {
            timetable: [...state.timetable, ...cloned],
          };
        }),

      addExam: (exam) => {
        const id = `exam-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        set((state) => ({
          exams: [...state.exams, { ...exam, id }],
          settings: { ...state.settings, isDemoData: false },
        }));
        return id;
      },

      updateExam: (id, partial) =>
        set((state) => ({
          exams: state.exams.map((ex) => (ex.id === id ? { ...ex, ...partial } : ex)),
        })),

      deleteExam: (id) => {
        const target = get().exams.find((e) => e.id === id) ?? null;
        if (!target) return null;
        set((state) => ({
          exams: state.exams.filter((e) => e.id !== id),
          revisionSessions: state.revisionSessions.filter((r) => r.examId !== id),
        }));
        return target;
      },

      generateExamRevisions: (examId) => {
        const state = get();
        const exam = state.exams.find((e) => e.id === examId);
        if (!exam) return [];
        const generated = generateRevisionPlanForExam(exam, state.timetable, state.todayStr);
        set((prev) => ({
          revisionSessions: [
            ...prev.revisionSessions.filter((r) => r.examId !== examId),
            ...generated,
          ],
        }));
        return generated;
      },

      setCustomRevisionSessions: (examId, sessions) =>
        set((state) => ({
          revisionSessions: [
            ...state.revisionSessions.filter((r) => r.examId !== examId),
            ...sessions,
          ],
        })),

      toggleRevisionSession: (id) =>
        set((state) => ({
          revisionSessions: state.revisionSessions.map((r) =>
            r.id === id ? { ...r, completed: !r.completed } : r
          ),
        })),

      addLesson: (lesson) => {
        const id = `les-${Date.now()}`;
        set((state) => ({
          lessons: [{ ...lesson, id }, ...state.lessons],
          settings: { ...state.settings, isDemoData: false },
        }));
        return id;
      },

      deleteLesson: (id) =>
        set((state) => ({
          lessons: state.lessons.filter((l) => l.id !== id),
        })),

      addTask: (task) => {
        const id = `task-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        set((state) => ({
          tasks: [{ ...task, id }, ...state.tasks],
          settings: { ...state.settings, isDemoData: false },
        }));
        return id;
      },

      updateTask: (id, partial) =>
        set((state) => ({
          tasks: state.tasks.map((tk) =>
            tk.id === id
              ? {
                  ...tk,
                  ...partial,
                  completedAt:
                    partial.status === 'done'
                      ? new Date().toISOString()
                      : partial.status
                        ? undefined
                        : tk.completedAt,
                }
              : tk
          ),
        })),

      deleteTask: (id) => {
        const target = get().tasks.find((t) => t.id === id) ?? null;
        if (!target) return null;
        set((state) => ({
          tasks: state.tasks.filter((t) => t.id !== id),
        }));
        return target;
      },

      toggleSubtask: (taskId, subtaskId) =>
        set((state) => ({
          tasks: state.tasks.map((tk) =>
            tk.id === taskId
              ? {
                  ...tk,
                  subtasks: tk.subtasks.map((st) =>
                    st.id === subtaskId ? { ...st, done: !st.done } : st
                  ),
                }
              : tk
          ),
        })),

      addHabit: (habit) => {
        const id = `hab-${Date.now()}`;
        set((state) => ({
          habits: [
            ...state.habits,
            {
              ...habit,
              id,
              completedDates: [],
              bestStreak: 0,
              createdAt: new Date().toISOString(),
            },
          ],
          settings: { ...state.settings, isDemoData: false },
        }));
        return id;
      },

      toggleHabitDate: (habitId, dateStr) =>
        set((state) => ({
          habits: state.habits.map((h) => {
            if (h.id !== habitId) return h;
            const exists = h.completedDates.includes(dateStr);
            const nextDates = exists
              ? h.completedDates.filter((d) => d !== dateStr)
              : [...h.completedDates, dateStr];
            const currentStreak = calculateHabitStreak(nextDates, state.todayStr);
            return {
              ...h,
              completedDates: nextDates,
              bestStreak: Math.max(h.bestStreak, currentStreak),
            };
          }),
        })),

      deleteHabit: (id) => {
        const target = get().habits.find((h) => h.id === id) ?? null;
        if (!target) return null;
        set((state) => ({
          habits: state.habits.filter((h) => h.id !== id),
        }));
        return target;
      },

      startTimer: () =>
        set((state) => {
          if (state.timer.isRunning) return state;
          return {
            timer: {
              ...state.timer,
              isRunning: true,
              startedAtTimestamp: Date.now(),
            },
          };
        }),

      pauseTimer: () =>
        set((state) => {
          if (!state.timer.isRunning || state.timer.startedAtTimestamp === null) return state;
          const delta = Math.max(0, Date.now() - state.timer.startedAtTimestamp);
          return {
            timer: {
              ...state.timer,
              isRunning: false,
              startedAtTimestamp: null,
              accumulatedElapsedMs: state.timer.accumulatedElapsedMs + delta,
            },
          };
        }),

      resetTimer: (mode) =>
        set((state) => {
          const nextMode = mode ?? state.timer.mode;
          const mins =
            nextMode === 'focus'
              ? state.settings.pomodoroFocusMinutes
              : nextMode === 'shortBreak'
                ? state.settings.pomodoroShortBreakMinutes
                : state.settings.pomodoroLongBreakMinutes;
          return {
            timer: {
              ...state.timer,
              isRunning: false,
              mode: nextMode,
              startedAtTimestamp: null,
              accumulatedElapsedMs: 0,
              targetDurationMs: mins * 60_000,
            },
          };
        }),

      setTimerSubject: (subjectId) =>
        set((state) => ({
          timer: { ...state.timer, subjectId },
        })),

      setTimerAmbientSound: (ambientSound) =>
        set((state) => ({
          timer: { ...state.timer, ambientSound },
        })),

      completeTimerSession: () =>
        set((state) => {
          const now = new Date();
          const durationMinutes = Math.max(
            1,
            Math.round(state.timer.targetDurationMs / 60_000)
          );
          const newLog: FocusSessionLog = {
            id: `foc-${Date.now()}`,
            subjectId: state.timer.subjectId || (state.subjects[0]?.id ?? 'general'),
            startedAt: new Date(now.getTime() - durationMinutes * 60_000).toISOString(),
            endedAt: now.toISOString(),
            durationMinutes,
            date: state.todayStr,
            mode: state.timer.mode,
          };

          const nextCycles =
            state.timer.mode === 'focus'
              ? state.timer.completedCycles + 1
              : state.timer.completedCycles;
          const nextMode: ActiveTimerState['mode'] =
            state.timer.mode === 'focus'
              ? nextCycles % 4 === 0
                ? 'longBreak'
                : 'shortBreak'
              : 'focus';
          const nextMins =
            nextMode === 'focus'
              ? state.settings.pomodoroFocusMinutes
              : nextMode === 'shortBreak'
                ? state.settings.pomodoroShortBreakMinutes
                : state.settings.pomodoroLongBreakMinutes;

          return {
            focusSessions:
              state.timer.mode === 'focus'
                ? [newLog, ...state.focusSessions]
                : state.focusSessions,
            timer: {
              ...state.timer,
              isRunning: false,
              mode: nextMode,
              startedAtTimestamp: null,
              accumulatedElapsedMs: 0,
              targetDurationMs: nextMins * 60_000,
              completedCycles: nextCycles,
            },
          };
        }),

      markAllNotificationsRead: () =>
        set((state) => ({
          notifications: state.notifications.map((n) => ({ ...n, read: true })),
        })),

      snoozeNotification: (id) =>
        set((state) => ({
          notifications: state.notifications.map((n) =>
            n.id === id
              ? {
                  ...n,
                  read: true,
                  snoozedUntil: new Date(Date.now() + 15 * 60_000).toISOString(),
                }
              : n
          ),
        })),
    }),
    {
      name: 'waqti-storage-v2',
      version: STORAGE_SCHEMA_VERSION,
      storage: createJSONStorage(() => localStorage),
      migrate: (persistedState, version) =>
        migrateWaqtiState(persistedState, version) as WaqtiState,
    }
  )
);
