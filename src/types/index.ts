export type Language = 'ar' | 'fr' | 'en';
export type ThemeMode = 'light' | 'dark' | 'auto';
export type AccentTheme = 'honey' | 'sand' | 'olive' | 'terracotta' | 'slate';
export type DigitsStyle = 'western' | 'arabic-indic';
export type TimeFormat = '24h' | '12h';
export type WeekDay = 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = Sunday, 1 = Monday, ..., 6 = Saturday

export type SubjectColorId =
  | 'honey'
  | 'amber'
  | 'terracotta'
  | 'rose'
  | 'plum'
  | 'violet'
  | 'indigo'
  | 'slate'
  | 'sky'
  | 'teal'
  | 'sage'
  | 'olive';

export type SessionType = 'lecture' | 'td' | 'tp' | 'other';
export type DeliveryMode = 'in_person' | 'remote' | 'hybrid';
export type MeetingPlatform = 'zoom' | 'meet' | 'teams' | 'moodle' | 'other';
export type WeekParity = 'all' | 'odd' | 'even';

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
  defaultMode?: DeliveryMode;
  modeByType?: Partial<Record<SessionType, DeliveryMode>>;
  defaultMeetingUrl?: string;
}

export type RecurrenceType = 'weekly' | 'biweekly' | 'custom';

export interface TimetableSlot {
  id: string;
  subjectId: string;
  dayOfWeek: WeekDay;
  startTime: string; // "HH:mm"
  endTime: string; // "HH:mm"
  type?: SessionType;
  section?: string;
  group?: string;
  room: string;
  teacher: string;
  mode?: DeliveryMode;
  meetingUrl?: string;
  platform?: MeetingPlatform;
  recurrence: RecurrenceType;
  weekParity?: WeekParity;
  semesterStart?: string; // "YYYY-MM-DD"
  semesterEnd?: string; // "YYYY-MM-DD"
  reminderLeadMinutes?: number; // Travel time (in-person) or Join lead time (remote)
  customColor?: SubjectColorId;
  notes?: string;
  excludedDates?: string[]; // "YYYY-MM-DD"
  specificDate?: string; // "YYYY-MM-DD" when edited as a single occurrence
  attendanceByDate?: Record<string, 'attended' | 'absent'>;
}

export interface AttendanceRecord {
  id: string;
  slotId: string;
  subjectId: string;
  date: string; // "YYYY-MM-DD"
  status: 'attended' | 'absent' | 'cancelled';
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
  mode?: DeliveryMode;
  meetingUrl?: string;
  platform?: MeetingPlatform;
  sessionType?: SessionType;
  coefficient: number;
  topics: string[];
  priority: PriorityLevel;
  reminderOffsetsMinutes: number[];
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

export interface Flashcard {
  id: string;
  subjectId: string;
  front: string;
  back: string;
  box: 1 | 2 | 3 | 4 | 5; // Leitner box 1..5
  nextReviewDate: string; // "YYYY-MM-DD"
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
  targetDays: WeekDay[];
  timesPerWeek: number;
  reminderTimes?: string[]; // ["08:00", "20:00"]
  completedDates: string[]; // "YYYY-MM-DD"
  bestStreak: number;
  createdAt: string;
}

export type AlarmRecurrence = 'once' | 'daily' | 'weekdays' | 'weekly' | 'monthly';
export type AlarmTone = 'soft_bell' | 'morning_chime' | 'marimba' | 'gentle_rise' | 'digital';
export type AlarmLinkedType = 'none' | 'habit' | 'task' | 'exam' | 'class' | 'custom';

export interface AlarmReminder {
  id: string;
  title: string;
  note?: string;
  date: string; // "YYYY-MM-DD" for 'once' or anchor date
  time: string; // "HH:mm"
  recurrence: AlarmRecurrence;
  daysOfWeek: WeekDay[]; // used when recurrence === 'weekdays'
  linkedType: AlarmLinkedType;
  linkedId?: string;
  mode?: DeliveryMode;
  meetingUrl?: string;
  platform?: MeetingPlatform;
  sessionType?: SessionType;
  sound: AlarmTone;
  vibrate: boolean;
  snoozeMinutes: number; // default 5, 10, or 15
  leadMinutes: number; // 0, 10, 30, 60, 1440
  enabled: boolean;
  lastFiredDateKey?: string; // e.g. "2026-11-10T08:00" idempotency guard
  snoozedUntilMs?: number; // timestamp ms if currently snoozed
  createdAt: string;
  updatedAt: string;
}

export interface MissedAlarmItem {
  alarmId: string;
  title: string;
  scheduledDate: string;
  scheduledTime: string;
  linkedType: AlarmLinkedType;
  linkedId?: string;
}

export interface DayPlanBlock {
  id: string;
  date: string; // "YYYY-MM-DD"
  startTime: string; // "HH:mm"
  endTime: string; // "HH:mm"
  title: string;
  category: 'class' | 'task' | 'exam_prep' | 'habit';
  subjectId?: string;
  completed: boolean;
}

export interface MoodCheckIn {
  date: string; // "YYYY-MM-DD"
  mood: 'calm' | 'focused' | 'energized' | 'tired';
  energy: 1 | 2 | 3 | 4 | 5;
}

export interface BackupSnapshot {
  id: string;
  createdAt: string; // ISO string
  label: string;
  payloadJson: string;
}

export interface FocusSessionLog {
  id: string;
  subjectId: string;
  startedAt: string; // ISO string
  endedAt: string; // ISO string
  durationMinutes: number;
  date: string; // "YYYY-MM-DD"
  mode: 'focus' | 'shortBreak' | 'longBreak';
}

export interface ActiveTimerState {
  isRunning: boolean;
  mode: 'focus' | 'shortBreak' | 'longBreak';
  subjectId: string;
  startedAtTimestamp: number | null;
  accumulatedElapsedMs: number;
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
  createdAt: string;
  read: boolean;
  snoozedUntil?: string;
  category: 'class' | 'exam' | 'task' | 'habit' | 'focus' | 'alarm';
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
  defaultClassDurationMinutes: number;
  defaultTravelLeadMinutes: number;
  defaultJoinLeadMinutes: number;
  customGeminiApiKey?: string;
  notificationsEnabled: boolean;
  defaultAlarmSound: AlarmTone;
  defaultSnoozeMinutes: number;
  alarmVolume: number; // 0.1 - 1.0
  alarmVibration: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart: string; // "23:00"
  quietHoursEnd: string; // "06:30"
  gamificationEnabled: boolean;
  streakFreezeAvailable: boolean;
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
  | 'alarms'
  | 'focus'
  | 'habits'
  | 'stats'
  | 'settings';

export interface UndoEntry {
  id: string;
  labelKey: string;
  restore: () => void;
}
