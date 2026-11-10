import React, { useEffect, useState } from 'react';
import {
  BarChart3,
  Bell,
  BookOpen,
  Calendar,
  CheckSquare,
  Clock,
  Flame,
  GraduationCap,
  LayoutDashboard,
  Moon,
  Plus,
  Search,
  Settings,
  Sun,
  Timer,
  Undo2,
} from 'lucide-react';
import { useWaqtiStore } from './store/useWaqtiStore';
import { useTranslation } from './hooks/useTranslation';
import { WaqtiLogo } from './components/WaqtiLogo';
import { PWAInstallButton, OfflineIndicator } from './components/PWAInstallButton';
import { CommandPalette } from './components/CommandPalette';
import { QuickAddModal } from './components/QuickAddModal';
import { OnboardingModal } from './components/OnboardingModal';
import { DashboardView } from './features/DashboardView';
import { SubjectsView } from './features/SubjectsView';
import { TimetableView } from './features/TimetableView';
import { ExamsView } from './features/ExamsView';
import { LessonsTasksView } from './features/LessonsTasksView';
import { CalendarView } from './features/CalendarView';
import { FocusView } from './features/FocusView';
import { HabitsView } from './features/HabitsView';
import { StatsView } from './features/StatsView';
import { SettingsView } from './features/SettingsView';
import type { Language, NavSection, UndoEntry } from './types';

export default function App() {
  const { t, lang, dir } = useTranslation();
  const activeNav = useWaqtiStore((s) => s.activeNav);
  const setActiveNav = useWaqtiStore((s) => s.setActiveNav);
  const settings = useWaqtiStore((s) => s.settings);
  const setLanguage = useWaqtiStore((s) => s.setLanguage);
  const updateSettings = useWaqtiStore((s) => s.updateSettings);
  const notifications = useWaqtiStore((s) => s.notifications);
  const markAllNotificationsRead = useWaqtiStore((s) => s.markAllNotificationsRead);
  const snoozeNotification = useWaqtiStore((s) => s.snoozeNotification);
  const refreshTodayIfNeeded = useWaqtiStore((s) => s.refreshTodayIfNeeded);

  const [isCommandOpen, setIsCommandOpen] = useState(false);
  const [quickAddState, setQuickAddState] = useState<{
    open: boolean;
    tab: 'task' | 'exam' | 'slot' | 'habit';
  }>({ open: false, tab: 'task' });
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [undoEntry, setUndoEntry] = useState<UndoEntry | null>(null);

  // Sync <html lang dir class data-accent> and meta theme-color dynamically
  useEffect(() => {
    const html = document.documentElement;
    html.lang = lang;
    html.dir = dir;
    html.setAttribute('data-accent', settings.accent);

    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark =
      settings.theme === 'dark' || (settings.theme === 'auto' && prefersDark);
    html.classList.toggle('dark', isDark);

    const metaTheme = document.getElementById('theme-color-meta');
    if (metaTheme) {
      metaTheme.setAttribute('content', isDark ? '#090B14' : '#FAF8F5');
    }
  }, [lang, dir, settings.theme, settings.accent]);

  // Refresh date at midnight / when tab regains focus, and wire Ctrl/Cmd+K shortcut
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        refreshTodayIfNeeded();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandOpen((v) => !v);
      }
    };
    window.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', refreshTodayIfNeeded);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', refreshTodayIfNeeded);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [refreshTodayIfNeeded]);

  const handlePushUndo = (labelKey: string, restore: () => void) => {
    setUndoEntry({ id: String(Date.now()), labelKey, restore });
  };

  const navItems: { id: NavSection; label: string; icon: React.ReactNode }[] = [
    { id: 'dashboard', label: t('nav.dashboard'), icon: <LayoutDashboard className="h-4 w-4" /> },
    { id: 'subjects', label: t('nav.subjects'), icon: <BookOpen className="h-4 w-4" /> },
    { id: 'timetable', label: t('nav.timetable'), icon: <Clock className="h-4 w-4" /> },
    { id: 'exams', label: t('nav.exams'), icon: <GraduationCap className="h-4 w-4" /> },
    { id: 'lessons', label: t('nav.lessons'), icon: <CheckSquare className="h-4 w-4" /> },
    { id: 'calendar', label: t('nav.calendar'), icon: <Calendar className="h-4 w-4" /> },
    { id: 'focus', label: t('nav.focus'), icon: <Timer className="h-4 w-4" /> },
    { id: 'habits', label: t('nav.habits'), icon: <Flame className="h-4 w-4" /> },
    { id: 'stats', label: t('nav.stats'), icon: <BarChart3 className="h-4 w-4" /> },
    { id: 'settings', label: t('nav.settings'), icon: <Settings className="h-4 w-4" /> },
  ];

  const unreadNotifCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="min-h-screen flex bg-[var(--bg-canvas)] text-[var(--text-primary)] waqti-aurora">
      {/* Desktop Sidebar Navigation (Automatically mirrors side in RTL/LTR via flex flow) */}
      <aside className="hidden md:flex md:w-64 lg:w-68 flex-col justify-between border-e border-[var(--border-subtle)] bg-[var(--bg-surface)]/90 backdrop-blur-md p-5 shrink-0 sticky top-0 h-screen">
        <div className="space-y-6">
          {/* Brand Lockup */}
          <div className="flex items-center justify-between px-2">
            <button
              type="button"
              onClick={() => setActiveNav('dashboard')}
              className="flex items-center gap-3 text-start"
            >
              <WaqtiLogo size={36} />
              <div>
                <div className="text-lg font-bold font-display tracking-tight text-[var(--text-primary)] leading-none">
                  {t('app.name')}
                </div>
                <div className="text-[11px] text-[var(--text-muted)] mt-1">
                  وقتي · Waqti
                </div>
              </div>
            </button>
          </div>

          {/* Primary Nav List */}
          <nav className="space-y-1" aria-label="Main Navigation">
            {navItems.map((item) => {
              const isActive = activeNav === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveNav(item.id)}
                  className={`flex w-full items-center gap-3 rounded-2xl px-3.5 py-2.5 text-xs font-semibold transition ${
                    isActive
                      ? 'bg-[var(--accent-soft)] text-[var(--accent-primary)]'
                      : 'text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  {item.icon}
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer Quick Add CTA */}
        <div className="space-y-2.5 pt-4 border-t border-[var(--border-subtle)]">
          <PWAInstallButton />
          <button
            type="button"
            onClick={() => setQuickAddState({ open: true, tab: 'task' })}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--accent-primary)] py-3 px-4 text-xs font-semibold text-white shadow-sm hover:opacity-95 transition"
          >
            <Plus className="h-4 w-4" />
            <span>{t('dashboard.quickAdd')}</span>
          </button>
        </div>
      </aside>

      {/* Main Viewport Column */}
      <div className="flex-1 flex flex-col min-w-0 pb-20 md:pb-8">
        {/* Top Bar */}
        <header className="sticky top-0 z-30 flex items-center justify-between gap-4 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)]/80 backdrop-blur-md px-4 md:px-8 py-3.5">
          {/* Mobile Brand / Desktop Search Trigger */}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="md:hidden flex items-center gap-2 shrink-0">
              <WaqtiLogo size={30} />
              <span className="font-bold font-display text-sm">{t('app.name')}</span>
            </div>

            <button
              type="button"
              onClick={() => setIsCommandOpen(true)}
              aria-label={t('common.searchPlaceholder')}
              className="flex items-center gap-2.5 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)]/70 px-3 sm:px-3.5 py-2 text-xs text-[var(--text-muted)] hover:border-[var(--border-strong)] transition sm:w-full max-w-md"
            >
              <Search className="h-3.5 w-3.5 shrink-0" />
              <span className="hidden sm:inline truncate">{t('common.searchPlaceholder')}</span>
            </button>
          </div>

          {/* Right/End Controls: Language Switcher, Theme Toggle, Notifications */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Instant Language Switcher (العربية, Français, English) */}
            <div
              className="flex items-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-0.5"
              role="group"
              aria-label={t('settings.language')}
            >
              {(
                [
                  { code: 'ar', label: 'العربية' },
                  { code: 'fr', label: 'FR' },
                  { code: 'en', label: 'EN' },
                ] as { code: Language; label: string }[]
              ).map((l) => (
                <button
                  key={l.code}
                  type="button"
                  onClick={() => setLanguage(l.code)}
                  className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition whitespace-nowrap ${
                    lang === l.code
                      ? 'bg-[var(--bg-surface)] text-[var(--accent-primary)] shadow-sm'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  {l.label}
                </button>
              ))}
            </div>

            {/* Light / Dark Toggle */}
            <button
              type="button"
              onClick={() =>
                updateSettings({
                  theme: settings.theme === 'dark' ? 'light' : 'dark',
                })
              }
              aria-label={t('settings.theme')}
              className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition"
            >
              {settings.theme === 'dark' ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </button>

            {/* Notifications Center Button */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsNotifOpen((v) => !v)}
                aria-label={t('common.notifications')}
                className="relative rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition"
              >
                <Bell className="h-4 w-4" />
                {unreadNotifCount > 0 && (
                  <span className="absolute -top-1 -end-1 h-4 w-4 rounded-full bg-[var(--accent-primary)] text-[10px] font-bold text-white flex items-center justify-center">
                    {unreadNotifCount}
                  </span>
                )}
              </button>

              {isNotifOpen && (
                <div className="absolute end-0 mt-2 w-80 rounded-2xl border border-[var(--border-strong)] bg-[var(--bg-surface)] p-4 shadow-2xl z-50">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold text-[var(--text-primary)]">
                      {t('common.notifications')}
                    </span>
                    <button
                      type="button"
                      onClick={markAllNotificationsRead}
                      className="text-[11px] font-medium text-[var(--accent-primary)] hover:underline"
                    >
                      {t('common.markAllRead')}
                    </button>
                  </div>
                  {notifications.length === 0 ? (
                    <p className="text-xs text-[var(--text-muted)] py-4 text-center">
                      {t('common.noNotifications')}
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {notifications.map((n) => (
                        <div
                          key={n.id}
                          className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3 text-xs space-y-1.5"
                        >
                          <div className="font-semibold text-[var(--text-primary)]">
                            {t(n.titleKey as Parameters<typeof t>[0])}
                          </div>
                          <p className="text-[var(--text-secondary)]">
                            {t(n.bodyKey as Parameters<typeof t>[0])}
                          </p>
                          <button
                            type="button"
                            onClick={() => snoozeNotification(n.id)}
                            className="text-[11px] font-semibold text-[var(--accent-primary)]"
                          >
                            {t('common.snooze')}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Main Screen Container */}
        <main className="flex-1 px-4 md:px-8 py-6 max-w-7xl w-full mx-auto">
          {activeNav === 'dashboard' && (
            <DashboardView
              onOpenQuickAdd={(tab = 'task') => setQuickAddState({ open: true, tab })}
              onOpenOnboarding={() => setIsOnboardingOpen(true)}
            />
          )}
          {activeNav === 'subjects' && <SubjectsView onPushUndo={handlePushUndo} />}
          {activeNav === 'timetable' && <TimetableView onPushUndo={handlePushUndo} />}
          {activeNav === 'exams' && <ExamsView onPushUndo={handlePushUndo} />}
          {activeNav === 'lessons' && <LessonsTasksView onPushUndo={handlePushUndo} />}
          {activeNav === 'calendar' && <CalendarView />}
          {activeNav === 'focus' && <FocusView />}
          {activeNav === 'habits' && <HabitsView onPushUndo={handlePushUndo} />}
          {activeNav === 'stats' && <StatsView />}
          {activeNav === 'settings' && <SettingsView />}
        </main>
      </div>

      {/* Mobile Floating Glass Bottom Tab Bar with Center "+" Quick-Add */}
      <nav
        aria-label="Mobile Navigation"
        className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-[var(--border-subtle)] bg-[var(--bg-surface)] backdrop-blur-md px-2 h-16 grid grid-cols-5 items-center"
      >
        <button
          type="button"
          onClick={() => setActiveNav('dashboard')}
          className={`flex flex-col items-center justify-center min-h-[44px] text-[10px] font-medium ${
            activeNav === 'dashboard'
              ? 'text-[var(--accent-primary)]'
              : 'text-[var(--text-muted)]'
          }`}
        >
          <LayoutDashboard className="h-5 w-5" />
          <span className="mt-0.5 truncate">{t('nav.dashboard')}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveNav('timetable')}
          className={`flex flex-col items-center justify-center min-h-[44px] text-[10px] font-medium ${
            activeNav === 'timetable'
              ? 'text-[var(--accent-primary)]'
              : 'text-[var(--text-muted)]'
          }`}
        >
          <Clock className="h-5 w-5" />
          <span className="mt-0.5 truncate">{t('nav.timetable')}</span>
        </button>

        {/* Center "+" Action Button */}
        <div className="flex items-center justify-center">
          <button
            type="button"
            onClick={() => setQuickAddState({ open: true, tab: 'task' })}
            aria-label={t('dashboard.quickAdd')}
            className="h-11 w-11 rounded-2xl bg-[var(--accent-primary)] text-white shadow-lg flex items-center justify-center"
          >
            <Plus className="h-5 w-5" />
          </button>
        </div>

        <button
          type="button"
          onClick={() => setActiveNav('exams')}
          className={`flex flex-col items-center justify-center min-h-[44px] text-[10px] font-medium ${
            activeNav === 'exams'
              ? 'text-[var(--accent-primary)]'
              : 'text-[var(--text-muted)]'
          }`}
        >
          <GraduationCap className="h-5 w-5" />
          <span className="mt-0.5 truncate">{t('nav.exams')}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveNav('focus')}
          className={`flex flex-col items-center justify-center min-h-[44px] text-[10px] font-medium ${
            activeNav === 'focus'
              ? 'text-[var(--accent-primary)]'
              : 'text-[var(--text-muted)]'
          }`}
        >
          <Timer className="h-5 w-5" />
          <span className="mt-0.5 truncate">{t('nav.focus')}</span>
        </button>
      </nav>

      {/* Undo Deletion Toast */}
      {undoEntry && (
        <div className="fixed bottom-20 md:bottom-6 end-6 z-50 flex items-center gap-3 rounded-2xl border border-[var(--border-strong)] bg-[var(--bg-surface)] px-4 py-3 text-xs shadow-2xl">
          <span className="font-medium text-[var(--text-primary)]">
            {t(undoEntry.labelKey as Parameters<typeof t>[0])}
          </span>
          <button
            type="button"
            onClick={() => {
              undoEntry.restore();
              setUndoEntry(null);
            }}
            className="flex items-center gap-1 rounded-lg bg-[var(--accent-soft)] px-2.5 py-1 font-semibold text-[var(--accent-primary)]"
          >
            <Undo2 className="h-3.5 w-3.5" />
            <span>{t('common.undo')}</span>
          </button>
        </div>
      )}

      <OfflineIndicator />

      <CommandPalette
        isOpen={isCommandOpen}
        onClose={() => setIsCommandOpen(false)}
        onOpenQuickAdd={(tab = 'task') => setQuickAddState({ open: true, tab })}
      />

      <QuickAddModal
        isOpen={quickAddState.open}
        initialTab={quickAddState.tab}
        onClose={() => setQuickAddState((s) => ({ ...s, open: false }))}
      />

      <OnboardingModal
        isOpen={isOnboardingOpen}
        onClose={() => setIsOnboardingOpen(false)}
      />
    </div>
  );
}
