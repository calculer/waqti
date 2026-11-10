export type Language = 'ar' | 'fr' | 'en';
export type ThemeMode = 'light' | 'dark' | 'auto';
export type AccentTheme = 'violet' | 'ocean' | 'emerald' | 'rose' | 'amber';
export type DigitsStyle = 'western' | 'arabic-indic';
export type TimeFormat = '24h' | '12h';
export type WeekDay = 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = Sunday, 1 = Monday, ..., 6 = Saturday

export type SubjectColorId =
  | 'violet'
  | 'indigo'
  | 'sky'
  | 'emerald'
  | 'teal'
  | 'amber'
  | 'rose'
  | 'fuchsia';

export interface Subject {
  id: string;
  name: string;
  color: SubjectColorId;
  icon: string;
  teacher: string;
  room: string;
  coefficient: number;
  weeklyGoalHours: number;
  archived: boolean;
  createdAt: string; // ISO string
}

export type RecurrenceType = 'weekly' | 'biweekly' | 'custom';

export interface TimetableSlot {
  id: string;
  subjectId: string;
  dayOfWeek: WeekDay;
  startTime: string; // "HH:mm"
  endTime: string; // "HH:mm"
  room: string;
  teacher: string;
  recurrence: RecurrenceType;
  customColor?: SubjectColorId;
  notes?: string;
  excludedDates?: string[]; // "YYYY-MM-DD" for single-occurrence edits/deletions
}

export type ExamType =
  | 'controle'
  | 'examen'
  | 'devoir_surveille'
  | 'test'
  | 'quiz'
  | 'oral';

export type PriorityLevel = 'low' | 'medium' | 'high' | 'critical';

export interface Exam {
  id: string;
  subjectId: string;
  title: string;
  type: ExamType;
  date: string; // "YYYY-MM-DD"
  startTime: string; // "HH:mm"
  durationMinutes: number;
  room: string;
  coefficient: number;
  topics: string[];
  priority: PriorityLevel;
  reminderOffsetsMinutes: number[]; // e.g., [1440, 10080] for 1 day, 1 week
  grade?: number;
  outOf?: number;
  readinessScore: number; // 0 - 100
  notes?: string;
}

export interface RevisionSession {
  id: string;
  examId: string;
  subjectId: string;
  date: string; // "YYYY-MM-DD"
  startTime: string; // "HH:mm"
  endTime: string; // "HH:mm"
  topic: string;
  completed: boolean;
}

export interface LessonLog {
  id: string;
  subjectId: string;
  date: string; // "YYYY-MM-DD"
  title: string;
  notes: string;
  links: string[];
}

export type TaskStatus = 'todo' | 'doing' | 'done';

export interface Subtask {
  id: string;
  title: string;
  done: boolean;
}

export interface StudyTask {
  id: string;
  title: string;
  subjectId: string;
  dueDate: string; // "YYYY-MM-DD"
  dueTime: string; // "HH:mm"
  priority: PriorityLevel;
  status: TaskStatus;
  subtasks: Subtask[];
  recurrence: 'none' | 'daily' | 'weekly';
  completedAt?: string; // ISO string
}

export type HabitFrequencyType = 'daily' | 'weekdays' | 'times_per_week';

export interface Habit {
  id: string;
  name: string;
  icon: string;
  color: SubjectColorId;
  frequencyType: HabitFrequencyType;
  targetDays: WeekDay[]; // used if 'weekdays'
  timesPerWeek: number; // used if 'times_per_week'
  reminderTime?: string; // "HH:mm"
  completedDates: string[]; // array of "YYYY-MM-DD"
  bestStreak: number;
  createdAt: string;
}

export interface FocusSessionLog {
  id: string;
  subjectId: string;
  startedAt: string; // ISO string
  endedAt: string; // ISO string
  durationMinutes: number;
  date: string; // "YYYY-MM-DD" local date
  mode: 'focus' | 'shortBreak' | 'longBreak';
}

export interface ActiveTimerState {
  isRunning: boolean;
  mode: 'focus' | 'shortBreak' | 'longBreak';
  subjectId: string;
  startedAtTimestamp: number | null; // Date.now() ms when started
  accumulatedElapsedMs: number; // elapsed ms before current run
  targetDurationMs: number;
  completedCycles: number;
  ambientSound: 'none' | 'rain' | 'whitenoise' | 'tones';
}

export interface AppNotification {
  id: string;
  titleKey: string;
  titleParams?: Record<string, string | number>;
  bodyKey: string;
  bodyParams?: Record<string, string | number>;
  createdAt: string; // ISO string
  read: boolean;
  snoozedUntil?: string; // ISO string
  category: 'class' | 'exam' | 'task' | 'habit' | 'focus';
}

export interface UserSettings {
  language: Language;
  theme: ThemeMode;
  accent: AccentTheme;
  weekStart: WeekDay;
  weekendDays: WeekDay[];
  timeFormat: TimeFormat;
  timezone: string;
  digitsStyle: DigitsStyle;
  showHijri: boolean;
  pomodoroFocusMinutes: number;
  pomodoroShortBreakMinutes: number;
  pomodoroLongBreakMinutes: number;
  notificationsEnabled: boolean;
  hasCompletedOnboarding: boolean;
  isDemoData: boolean;
}

export type NavSection =
  | 'dashboard'
  | 'subjects'
  | 'timetable'
  | 'exams'
  | 'lessons'
  | 'calendar'
  | 'focus'
  | 'habits'
  | 'stats'
  | 'settings';

export interface UndoEntry {
  id: string;
  labelKey: string;
  restore: () => void;
}
