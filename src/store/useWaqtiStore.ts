import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type {
  AccentTheme,
  ActiveTimerState,
  AlarmReminder,
  AppNotification,
  BackupSnapshot,
  DayPlanBlock,
  Exam,
  Flashcard,
  FocusSessionLog,
  Habit,
  Language,
  LessonLog,
  MissedAlarmItem,
  MoodCheckIn,
  NavSection,
  RevisionSession,
  StudyTask,
  Subject,
  SubjectColorId,
  TimetableSlot,
  UserSettings,
} from '../types';
import {
  calculateHabitStreak,
  detectSlotOverlaps,
  detectTimezone,
  findMissedAlarms,
  generateRevisionPlanForExam,
  getLocalDateString,
  getLocalTimeString,
  getWeekDayIndex,
  isAlarmDueNow,
  shiftDateString,
} from '../lib/dates';
import {
  detectBrowserLanguage,
  getDefaultWeekendDays,
  getDefaultWeekStart,
} from '../lib/i18n';
import { buildSeedDemoData } from '../lib/demoData';
import { SUBJECT_COLORS } from '../lib/colors';
import type { ParsedTimetableRow } from '../lib/timetableParser';
import { fuzzyMatchSubject } from '../lib/timetableParser';

export const STORAGE_SCHEMA_VERSION = 4;

export interface SmartPasteInitialPayload {
  plainText?: string;
  htmlText?: string;
}

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

  // New v3/v4 state slices
  alarms: AlarmReminder[];
  activeRingingAlarm: AlarmReminder | null;
  missedAlarms: MissedAlarmItem[];
  lastAlarmCheckMs: number;
  flashcards: Flashcard[];
  dayPlan: DayPlanBlock[];
  moodCheckIns: MoodCheckIn[];
  snapshots: BackupSnapshot[];
  xp: number;
  level: number;
  isSmartPasteOpen: boolean;
  smartPasteInitialPayload: SmartPasteInitialPayload | null;
  recentlyImportedSlotIds: string[];

  // Navigation & Clock Rollover
  setActiveNav: (nav: NavSection, subjectId?: string | null) => void;
  refreshTodayIfNeeded: () => void;
  openSmartPaste: (payload?: SmartPasteInitialPayload | null) => void;
  closeSmartPaste: () => void;
  clearRecentlyImportedSlots: () => void;

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

  // Timetable CRUD & Smart Import
  addTimetableSlot: (slot: Omit<TimetableSlot, 'id'>) => string;
  updateTimetableSlot: (id: string, partial: Partial<TimetableSlot>) => void;
  deleteTimetableSlot: (id: string) => TimetableSlot | null;
  duplicateDaySlots: (fromDay: number, toDay: number) => void;
  batchImportTimetable: (options: {
    rows: ParsedTimetableRow[];
    importMode: 'add' | 'replace';
    duplicateHandling: 'skip' | 'replace' | 'keep';
  }) => { importedCount: number; createdSubjectsCount: number; snapshotId: string };

  // Exams & Revision CRUD
  addExam: (exam: Omit<Exam, 'id'>) => string;
  updateExam: (id: string, partial: Partial<Exam>) => void;
  deleteExam: (id: string) => Exam | null;
  generateExamRevisions: (examId: string) => RevisionSession[];
  setCustomRevisionSessions: (examId: string, sessions: RevisionSession[]) => void;
  toggleRevisionSession: (id: string) => void;

  // Lessons, Tasks & Flashcards CRUD
  addLesson: (lesson: Omit<LessonLog, 'id'>) => string;
  deleteLesson: (id: string) => void;
  addTask: (task: Omit<StudyTask, 'id'>) => string;
  updateTask: (id: string, partial: Partial<StudyTask>) => void;
  deleteTask: (id: string) => StudyTask | null;
  toggleSubtask: (taskId: string, subtaskId: string) => void;
  addFlashcard: (fc: Omit<Flashcard, 'id' | 'box' | 'nextReviewDate'>) => string;
  reviewFlashcard: (id: string, promoted: boolean) => void;
  deleteFlashcard: (id: string) => void;

  // Habits CRUD
  addHabit: (habit: Omit<Habit, 'id' | 'completedDates' | 'bestStreak' | 'createdAt'>) => string;
  toggleHabitDate: (habitId: string, dateStr: string) => void;
  deleteHabit: (id: string) => Habit | null;

  // Alarms & Reminders CRUD + Engine
  addAlarm: (alarm: Omit<AlarmReminder, 'id' | 'createdAt' | 'updatedAt'>) => string;
  updateAlarm: (id: string, partial: Partial<AlarmReminder>) => void;
  deleteAlarm: (id: string) => AlarmReminder | null;
  toggleAlarm: (id: string) => void;
  evaluateDueAlarms: (nowMs?: number) => void;
  triggerTestAlarm: () => void;
  dismissRingingAlarm: () => void;
  snoozeRingingAlarm: (minutes?: number) => void;
  completeRingingAlarmLinkedItem: () => void;
  dismissMissedAlarms: () => void;

  // Smart Day Plan, Mood Check-in & Snapshots
  generateSmartDayPlan: (shuffleOffset?: number) => void;
  toggleDayPlanBlock: (id: string) => void;
  clearDayPlan: () => void;
  setMoodCheckIn: (mood: MoodCheckIn['mood'], energy: MoodCheckIn['energy']) => void;
  createSnapshot: (label?: string) => void;
  restoreSnapshot: (id: string) => boolean;

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
  accent: 'honey',
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
  defaultAlarmSound: 'soft_bell',
  defaultSnoozeMinutes: 10,
  alarmVolume: 0.8,
  alarmVibration: true,
  quietHoursEnabled: false,
  quietHoursStart: '23:00',
  quietHoursEnd: '06:30',
  gamificationEnabled: true,
  streakFreezeAvailable: true,
  hasCompletedOnboarding: false,
  isDemoData: true,
  defaultClassDurationMinutes: 90,
  defaultTravelLeadMinutes: 30,
  defaultJoinLeadMinutes: 10,
  customGeminiApiKey: '',
};

function normalizeColor(c: unknown): SubjectColorId {
  if (typeof c === 'string' && c in SUBJECT_COLORS) {
    return c as SubjectColorId;
  }
  if (c === 'emerald') return 'sage';
  if (c === 'fuchsia') return 'plum';
  if (c === 'orange') return 'terracotta';
  return 'honey';
}

function normalizeAccent(a: unknown): AccentTheme {
  const valid: AccentTheme[] = ['honey', 'sand', 'olive', 'terracotta', 'slate'];
  if (typeof a === 'string' && valid.includes(a as AccentTheme)) {
    return a as AccentTheme;
  }
  return 'honey';
}

/**
 * Versioned storage migration function to safely upgrade older schemas or repair corrupted fields.
 */
export function migrateWaqtiState(persistedState: unknown, _version: number): Partial<WaqtiState> {
  if (!persistedState || typeof persistedState !== 'object') {
    return {};
  }
  const raw = persistedState as Record<string, unknown>;
  const rawSettings =
    typeof raw.settings === 'object' && raw.settings !== null
      ? (raw.settings as Record<string, unknown>)
      : {};

  const settings: UserSettings = {
    ...defaultSettings,
    ...(rawSettings as Partial<UserSettings>),
    accent: normalizeAccent(rawSettings.accent),
    defaultClassDurationMinutes:
      typeof rawSettings.defaultClassDurationMinutes === 'number'
        ? rawSettings.defaultClassDurationMinutes
        : 90,
    defaultTravelLeadMinutes:
      typeof rawSettings.defaultTravelLeadMinutes === 'number'
        ? rawSettings.defaultTravelLeadMinutes
        : 30,
    defaultJoinLeadMinutes:
      typeof rawSettings.defaultJoinLeadMinutes === 'number'
        ? rawSettings.defaultJoinLeadMinutes
        : 10,
  };

  const rawSubjects = Array.isArray(raw.subjects)
    ? (raw.subjects as Subject[]).map((s) => ({
        ...s,
        color: normalizeColor(s.color),
        defaultMode: s.defaultMode ?? 'in_person',
      }))
    : initialDemo.subjects;

  const rawTimetable = Array.isArray(raw.timetable)
    ? (raw.timetable as TimetableSlot[]).map((sl) => ({
        ...sl,
        type: sl.type ?? 'lecture',
        mode: sl.mode ?? 'in_person',
      }))
    : initialDemo.timetable;

  const rawHabits = Array.isArray(raw.habits)
    ? (raw.habits as Habit[]).map((h) => ({
        ...h,
        color: normalizeColor(h.color),
      }))
    : initialDemo.habits;

  return {
    ...raw,
    schemaVersion: STORAGE_SCHEMA_VERSION,
    settings,
    subjects: rawSubjects,
    timetable: rawTimetable,
    exams: Array.isArray(raw.exams) ? raw.exams : initialDemo.exams,
    revisionSessions: Array.isArray(raw.revisionSessions)
      ? raw.revisionSessions
      : initialDemo.revisionSessions,
    lessons: Array.isArray(raw.lessons) ? raw.lessons : initialDemo.lessons,
    tasks: Array.isArray(raw.tasks) ? raw.tasks : initialDemo.tasks,
    habits: rawHabits,
    focusSessions: Array.isArray(raw.focusSessions)
      ? raw.focusSessions
      : initialDemo.focusSessions,
    alarms: Array.isArray(raw.alarms) ? raw.alarms : initialDemo.alarms,
    flashcards: Array.isArray(raw.flashcards) ? raw.flashcards : initialDemo.flashcards,
    dayPlan: Array.isArray(raw.dayPlan) ? raw.dayPlan : [],
    moodCheckIns: Array.isArray(raw.moodCheckIns) ? raw.moodCheckIns : [],
    snapshots: Array.isArray(raw.snapshots) ? raw.snapshots : [],
    xp: typeof raw.xp === 'number' ? raw.xp : 340,
    level: typeof raw.level === 'number' ? raw.level : 4,
  };
}

function computeLevelFromXp(xp: number): number {
  return Math.max(1, Math.floor(xp / 100) + 1);
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
      alarms: initialDemo.alarms,
      activeRingingAlarm: null,
      missedAlarms: [],
      lastAlarmCheckMs: Date.now(),
      flashcards: initialDemo.flashcards,
      dayPlan: [],
      moodCheckIns: [],
      snapshots: [],
      xp: 340,
      level: 4,
      isSmartPasteOpen: false,
      smartPasteInitialPayload: null,
      recentlyImportedSlotIds: [],
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

      openSmartPaste: (payload = null) =>
        set({
          isSmartPasteOpen: true,
          smartPasteInitialPayload: payload,
        }),

      closeSmartPaste: () =>
        set({
          isSmartPasteOpen: false,
          smartPasteInitialPayload: null,
        }),

      clearRecentlyImportedSlots: () =>
        set({ recentlyImportedSlotIds: [] }),

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
              alarms: localizedDemo.alarms,
              flashcards: localizedDemo.flashcards,
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
          alarms: [],
          flashcards: [],
          dayPlan: [],
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
          get().createSnapshot('Pre-Import Auto Backup');
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

      batchImportTimetable: ({ rows, importMode, duplicateHandling }) => {
        const state = get();
        // Always save an automatic backup snapshot before importing
        state.createSnapshot(
          importMode === 'replace'
            ? 'Pre-Smart Paste Replace Backup'
            : 'Pre-Smart Paste Import Backup'
        );
        const latestSnapshotId = get().snapshots[0]?.id ?? '';

        const includedRows = rows.filter((r) => r.include && r.dayOfWeek !== null);
        const nextSubjects = [...state.subjects];
        let nextTimetable = importMode === 'replace' ? [] : [...state.timetable];
        const importedSlotIds: string[] = [];
        let createdSubjectsCount = 0;

        for (let i = 0; i < includedRows.length; i++) {
          const r = includedRows[i];
          if (r.dayOfWeek === null) continue;

          // Handle duplicates if adding to existing timetable
          if (importMode === 'add' && r.duplicateOfSlotId) {
            if (duplicateHandling === 'skip') {
              continue;
            }
            if (duplicateHandling === 'replace') {
              nextTimetable = nextTimetable.filter((sl) => sl.id !== r.duplicateOfSlotId);
            }
          }

          // Resolve or create subject
          let subjectId = r.matchedSubjectId;
          if (!subjectId || !nextSubjects.some((s) => s.id === subjectId)) {
            const { matchedSubject } = fuzzyMatchSubject(r.subjectName, nextSubjects, 0.72);
            if (matchedSubject) {
              subjectId = matchedSubject.id;
            } else {
              const newSubjId = `subj-imp-${Date.now()}-${i}`;
              const newSubj: Subject = {
                id: newSubjId,
                name: r.subjectName.trim() || 'Untitled Course',
                color: r.proposedColor || 'honey',
                icon: 'BookOpen',
                teacher: r.teacher || '',
                room: r.room || '',
                coefficient: 3,
                weeklyGoalHours: 4,
                defaultMode: r.mode || 'in_person',
                archived: false,
                createdAt: new Date().toISOString(),
              };
              nextSubjects.push(newSubj);
              subjectId = newSubjId;
              createdSubjectsCount++;
            }
          }

          const newSlotId = `slot-imp-${Date.now()}-${i}`;
          const newSlot: TimetableSlot = {
            id: newSlotId,
            subjectId,
            dayOfWeek: r.dayOfWeek,
            startTime: r.startTime,
            endTime: r.endTime,
            type: r.sessionType === 'unknown' ? 'lecture' : r.sessionType,
            section: r.section || undefined,
            group: r.group || undefined,
            room: r.room || '',
            teacher: r.teacher || '',
            mode: r.mode || 'in_person',
            meetingUrl: r.meetingUrl || undefined,
            platform: r.platform,
            recurrence: r.recurrence || 'weekly',
            weekParity: r.weekParity && r.weekParity !== 'all' ? r.weekParity : undefined,
            semesterStart: r.semesterStart || undefined,
            semesterEnd: r.semesterEnd || undefined,
          };

          nextTimetable.push(newSlot);
          importedSlotIds.push(newSlotId);
        }

        set({
          subjects: nextSubjects,
          timetable: nextTimetable,
          recentlyImportedSlotIds: importedSlotIds,
          isSmartPasteOpen: false,
          smartPasteInitialPayload: null,
          settings: {
            ...state.settings,
            isDemoData: false,
          },
        });

        return {
          importedCount: importedSlotIds.length,
          createdSubjectsCount,
          snapshotId: latestSnapshotId,
        };
      },

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
        set((state) => {
          const gainedXp = partial.status === 'done' ? 20 : 0;
          const nextXp = state.xp + gainedXp;
          return {
            xp: nextXp,
            level: computeLevelFromXp(nextXp),
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
          };
        }),

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

      addFlashcard: (fc) => {
        const id = `fc-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
        set((state) => ({
          flashcards: [
            {
              ...fc,
              id,
              box: 1,
              nextReviewDate: state.todayStr,
            },
            ...state.flashcards,
          ],
          settings: { ...state.settings, isDemoData: false },
        }));
        return id;
      },

      reviewFlashcard: (id, promoted) =>
        set((state) => {
          const intervals: Record<number, number> = { 1: 1, 2: 2, 3: 4, 4: 7, 5: 14 };
          const nextXp = state.xp + (promoted ? 10 : 5);
          return {
            xp: nextXp,
            level: computeLevelFromXp(nextXp),
            flashcards: state.flashcards.map((fc) => {
              if (fc.id !== id) return fc;
              const nextBox = (promoted ? Math.min(5, fc.box + 1) : 1) as Flashcard['box'];
              const nextReviewDate = shiftDateString(state.todayStr, intervals[nextBox] ?? 1);
              return { ...fc, box: nextBox, nextReviewDate };
            }),
          };
        }),

      deleteFlashcard: (id) =>
        set((state) => ({
          flashcards: state.flashcards.filter((fc) => fc.id !== id),
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
        set((state) => {
          let xpDelta = 0;
          const nextHabits = state.habits.map((h) => {
            if (h.id !== habitId) return h;
            const exists = h.completedDates.includes(dateStr);
            xpDelta = exists ? -15 : 15;
            const nextDates = exists
              ? h.completedDates.filter((d) => d !== dateStr)
              : [...h.completedDates, dateStr];
            const currentStreak = calculateHabitStreak(nextDates, state.todayStr);
            return {
              ...h,
              completedDates: nextDates,
              bestStreak: Math.max(h.bestStreak, currentStreak),
            };
          });
          const nextXp = Math.max(0, state.xp + xpDelta);
          return {
            habits: nextHabits,
            xp: nextXp,
            level: computeLevelFromXp(nextXp),
          };
        }),

      deleteHabit: (id) => {
        const target = get().habits.find((h) => h.id === id) ?? null;
        if (!target) return null;
        set((state) => ({
          habits: state.habits.filter((h) => h.id !== id),
        }));
        return target;
      },

      addAlarm: (alarm) => {
        const id = `alarm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        const nowIso = new Date().toISOString();
        set((state) => ({
          alarms: [
            {
              ...alarm,
              id,
              createdAt: nowIso,
              updatedAt: nowIso,
            },
            ...state.alarms,
          ],
          settings: { ...state.settings, isDemoData: false },
        }));
        return id;
      },

      updateAlarm: (id, partial) =>
        set((state) => ({
          alarms: state.alarms.map((a) =>
            a.id === id ? { ...a, ...partial, updatedAt: new Date().toISOString() } : a
          ),
        })),

      deleteAlarm: (id) => {
        const target = get().alarms.find((a) => a.id === id) ?? null;
        if (!target) return null;
        set((state) => ({
          alarms: state.alarms.filter((a) => a.id !== id),
        }));
        return target;
      },

      toggleAlarm: (id) =>
        set((state) => ({
          alarms: state.alarms.map((a) =>
            a.id === id
              ? {
                  ...a,
                  enabled: !a.enabled,
                  snoozedUntilMs: undefined,
                  updatedAt: new Date().toISOString(),
                }
              : a
          ),
        })),

      evaluateDueAlarms: (nowMs = Date.now()) => {
        const state = get();
        const tz = state.settings.timezone;
        const nowDate = new Date(nowMs);
        const nowDateStr = getLocalDateString(nowDate, tz);
        const nowTimeStr = getLocalTimeString(nowDate, tz);

        // 1. Check missed alarms if there was a sleep/offline gap (> 90 seconds)
        let newlyMissed: MissedAlarmItem[] = [];
        if (nowMs - state.lastAlarmCheckMs > 90_000) {
          newlyMissed = findMissedAlarms(state.alarms, state.lastAlarmCheckMs, nowMs, tz);
        }

        // 2. Check if any alarm is due right now
        const quietCfg = {
          enabled: state.settings.quietHoursEnabled,
          start: state.settings.quietHoursStart,
          end: state.settings.quietHoursEnd,
        };

        let dueAlarm: AlarmReminder | null = null;
        if (!state.activeRingingAlarm) {
          for (const alarm of state.alarms) {
            if (isAlarmDueNow(alarm, nowDateStr, nowTimeStr, nowMs, quietCfg)) {
              dueAlarm = alarm;
              break;
            }
          }
        }

        if (!dueAlarm && newlyMissed.length === 0) {
          set({ lastAlarmCheckMs: nowMs });
          return;
        }

        const fireKey = `${nowDateStr}T${nowTimeStr}`;
        set((prev) => ({
          lastAlarmCheckMs: nowMs,
          activeRingingAlarm: dueAlarm ?? prev.activeRingingAlarm,
          missedAlarms:
            newlyMissed.length > 0 ? [...prev.missedAlarms, ...newlyMissed] : prev.missedAlarms,
          alarms: dueAlarm
            ? prev.alarms.map((a) =>
                a.id === dueAlarm.id
                  ? {
                      ...a,
                      lastFiredDateKey: fireKey,
                      snoozedUntilMs: undefined,
                      enabled: a.recurrence === 'once' ? false : a.enabled,
                    }
                  : a
              )
            : prev.alarms,
        }));
      },

      triggerTestAlarm: () => {
        const state = get();
        const now = new Date();
        const testAlarm: AlarmReminder = {
          id: 'alarm-test-live',
          title:
            state.settings.language === 'ar'
              ? 'اختبار منبه وقتي الذكي'
              : state.settings.language === 'fr'
                ? 'Test d’alarme Waqti'
                : 'Waqti Smart Alarm Live Test',
          note:
            state.settings.language === 'ar'
              ? 'تجربة الصوت المتدرج وشاشة التنبيه الكاملة'
              : state.settings.language === 'fr'
                ? 'Aperçu de la sonnerie progressive et de l’écran d’alarme'
                : 'Previewing progressive Web Audio chime & full-screen overlay',
          date: state.todayStr,
          time: getLocalTimeString(now, state.settings.timezone),
          recurrence: 'once',
          daysOfWeek: [],
          linkedType: 'habit',
          linkedId: state.habits[0]?.id,
          sound: state.settings.defaultAlarmSound,
          vibrate: state.settings.alarmVibration,
          snoozeMinutes: state.settings.defaultSnoozeMinutes,
          leadMinutes: 0,
          enabled: true,
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
        };
        set({ activeRingingAlarm: testAlarm });
      },

      dismissRingingAlarm: () => set({ activeRingingAlarm: null }),

      snoozeRingingAlarm: (minutes) =>
        set((state) => {
          const active = state.activeRingingAlarm;
          if (!active) return { activeRingingAlarm: null };
          const snoozeMins = minutes ?? active.snoozeMinutes ?? 10;
          const snoozedUntilMs = Date.now() + snoozeMins * 60_000;
          return {
            activeRingingAlarm: null,
            alarms: state.alarms.map((a) =>
              a.id === active.id ? { ...a, enabled: true, snoozedUntilMs } : a
            ),
          };
        }),

      completeRingingAlarmLinkedItem: () => {
        const state = get();
        const active = state.activeRingingAlarm;
        if (!active) return;
        if (active.linkedType === 'habit' && active.linkedId) {
          const h = state.habits.find((item) => item.id === active.linkedId);
          if (h && !h.completedDates.includes(state.todayStr)) {
            state.toggleHabitDate(h.id, state.todayStr);
          }
        } else if (active.linkedType === 'task' && active.linkedId) {
          state.updateTask(active.linkedId, { status: 'done' });
        }
        set({ activeRingingAlarm: null });
      },

      dismissMissedAlarms: () => set({ missedAlarms: [] }),

      generateSmartDayPlan: (shuffleOffset = 0) =>
        set((state) => {
          const todayDow = getWeekDayIndex(state.todayStr);
          const todaySlots = state.timetable
            .filter((s) => s.dayOfWeek === todayDow)
            .sort((a, b) => a.startTime.localeCompare(b.startTime));

          const blocks: DayPlanBlock[] = todaySlots.map((sl) => {
            const subj = state.subjects.find((s) => s.id === sl.subjectId);
            return {
              id: `dp-class-${sl.id}`,
              date: state.todayStr,
              startTime: sl.startTime,
              endTime: sl.endTime,
              title: subj?.name ?? 'Class',
              category: 'class',
              subjectId: sl.subjectId,
              completed: false,
            };
          });

          const candidateWindows = [
            { startTime: '07:30', endTime: '08:15' },
            { startTime: '12:30', endTime: '13:30' },
            { startTime: '16:00', endTime: '17:15' },
            { startTime: '17:45', endTime: '19:00' },
            { startTime: '19:30', endTime: '20:45' },
            { startTime: '21:00', endTime: '22:00' },
          ];

          const freeWindows = candidateWindows.filter((win) => {
            const overlaps = detectSlotOverlaps(
              { dayOfWeek: todayDow, startTime: win.startTime, endTime: win.endTime },
              todaySlots
            );
            return overlaps.length === 0;
          });

          const pendingTasks = state.tasks.filter((t) => t.status !== 'done');
          const upcomingExams = state.exams.filter((e) => e.date >= state.todayStr);
          const pendingHabits = state.habits.filter(
            (h) => !h.completedDates.includes(state.todayStr)
          );

          const pool: Array<{
            title: string;
            category: DayPlanBlock['category'];
            subjectId?: string;
          }> = [
            ...pendingTasks.map((tk) => ({
              title: tk.title,
              category: 'task' as const,
              subjectId: tk.subjectId,
            })),
            ...upcomingExams.map((ex) => ({
              title: `${ex.title} — Revision`,
              category: 'exam_prep' as const,
              subjectId: ex.subjectId,
            })),
            ...pendingHabits.map((hb) => ({
              title: hb.name,
              category: 'habit' as const,
            })),
          ];

          if (pool.length > 0 && freeWindows.length > 0) {
            freeWindows.slice(0, Math.min(4, pool.length)).forEach((win, i) => {
              const item = pool[(i + shuffleOffset) % pool.length];
              blocks.push({
                id: `dp-gen-${Date.now()}-${i}`,
                date: state.todayStr,
                startTime: win.startTime,
                endTime: win.endTime,
                title: item.title,
                category: item.category,
                subjectId: item.subjectId,
                completed: false,
              });
            });
          }

          blocks.sort((a, b) => a.startTime.localeCompare(b.startTime));
          return { dayPlan: blocks };
        }),

      toggleDayPlanBlock: (id) =>
        set((state) => ({
          dayPlan: state.dayPlan.map((b) =>
            b.id === id ? { ...b, completed: !b.completed } : b
          ),
        })),

      clearDayPlan: () => set({ dayPlan: [] }),

      setMoodCheckIn: (mood, energy) =>
        set((state) => ({
          moodCheckIns: [
            ...state.moodCheckIns.filter((m) => m.date !== state.todayStr),
            { date: state.todayStr, mood, energy },
          ],
        })),

      createSnapshot: (label) =>
        set((state) => {
          const payload = JSON.stringify({
            subjects: state.subjects,
            timetable: state.timetable,
            exams: state.exams,
            revisionSessions: state.revisionSessions,
            lessons: state.lessons,
            tasks: state.tasks,
            habits: state.habits,
            alarms: state.alarms,
            flashcards: state.flashcards,
            focusSessions: state.focusSessions,
          });
          const snap: BackupSnapshot = {
            id: `snap-${Date.now()}`,
            createdAt: new Date().toISOString(),
            label: label || `Snapshot ${state.todayStr}`,
            payloadJson: payload,
          };
          return {
            snapshots: [snap, ...state.snapshots].slice(0, 7),
          };
        }),

      restoreSnapshot: (id) => {
        const snap = get().snapshots.find((s) => s.id === id);
        if (!snap) return false;
        try {
          const data = JSON.parse(snap.payloadJson) as Partial<WaqtiState>;
          set((state) => ({
            ...state,
            subjects: Array.isArray(data.subjects) ? data.subjects : state.subjects,
            timetable: Array.isArray(data.timetable) ? data.timetable : state.timetable,
            exams: Array.isArray(data.exams) ? data.exams : state.exams,
            revisionSessions: Array.isArray(data.revisionSessions)
              ? data.revisionSessions
              : state.revisionSessions,
            lessons: Array.isArray(data.lessons) ? data.lessons : state.lessons,
            tasks: Array.isArray(data.tasks) ? data.tasks : state.tasks,
            habits: Array.isArray(data.habits) ? data.habits : state.habits,
            alarms: Array.isArray(data.alarms) ? data.alarms : state.alarms,
            flashcards: Array.isArray(data.flashcards) ? data.flashcards : state.flashcards,
            focusSessions: Array.isArray(data.focusSessions)
              ? data.focusSessions
              : state.focusSessions,
          }));
          return true;
        } catch {
          return false;
        }
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

          const nextXp = state.timer.mode === 'focus' ? state.xp + 30 : state.xp;

          return {
            xp: nextXp,
            level: computeLevelFromXp(nextXp),
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
