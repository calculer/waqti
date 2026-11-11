import React, { useEffect, useMemo, useState } from 'react';
import {
  BellRing,
  BookOpen,
  Calendar,
  CheckSquare,
  ClipboardPaste,
  Clock,
  Flame,
  GraduationCap,
  LayoutDashboard,
  Search,
  Settings,
  Timer,
  X,
} from 'lucide-react';
import { useWaqtiStore } from '../store/useWaqtiStore';
import { useTranslation } from '../hooks/useTranslation';
import type { NavSection } from '../types';
import type { QuickAddTab } from './QuickAddModal';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenQuickAdd: (tab?: QuickAddTab) => void;
  lastUndoAction?: { label: string; onUndo: () => void } | null;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  onOpenQuickAdd,
  lastUndoAction,
}) => {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const setActiveNav = useWaqtiStore((s) => s.setActiveNav);
  const openSmartPaste = useWaqtiStore((s) => s.openSmartPaste);
  const subjects = useWaqtiStore((s) => s.subjects);
  const exams = useWaqtiStore((s) => s.exams);
  const tasks = useWaqtiStore((s) => s.tasks);
  const alarms = useWaqtiStore((s) => s.alarms);

  useEffect(() => {
    if (isOpen) setQuery('');
  }, [isOpen]);

  const navItems: { id: NavSection; label: string; icon: React.ReactNode }[] = useMemo(
    () => [
      { id: 'dashboard', label: t('nav.dashboard'), icon: <LayoutDashboard className="w-4 h-4" /> },
      { id: 'subjects', label: t('nav.subjects'), icon: <BookOpen className="w-4 h-4" /> },
      { id: 'timetable', label: t('nav.timetable'), icon: <Clock className="w-4 h-4" /> },
      { id: 'exams', label: t('nav.exams'), icon: <GraduationCap className="w-4 h-4" /> },
      { id: 'lessons', label: t('nav.lessons'), icon: <CheckSquare className="w-4 h-4" /> },
      { id: 'calendar', label: t('nav.calendar'), icon: <Calendar className="w-4 h-4" /> },
      { id: 'alarms', label: t('nav.alarms'), icon: <BellRing className="w-4 h-4" /> },
      { id: 'focus', label: t('nav.focus'), icon: <Timer className="w-4 h-4" /> },
      { id: 'habits', label: t('nav.habits'), icon: <Flame className="w-4 h-4" /> },
      { id: 'settings', label: t('nav.settings'), icon: <Settings className="w-4 h-4" /> },
    ],
    [t]
  );

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list: {
      id: string;
      title: string;
      subtitle: string;
      action: () => void;
    }[] = [];

    if (lastUndoAction) {
      const undoTitle = t('common.undoLastAction');
      if (
        !q ||
        undoTitle.toLowerCase().includes(q) ||
        lastUndoAction.label.toLowerCase().includes(q) ||
        'undo'.includes(q) ||
        'annuler'.includes(q) ||
        'تراجع'.includes(q)
      ) {
        list.push({
          id: 'cmd-undo-last',
          title: undoTitle,
          subtitle: lastUndoAction.label,
          action: () => {
            onClose();
            lastUndoAction.onUndo();
          },
        });
      }
    }

    const pasteLabel = t('smartPaste.button');
    if (
      !q ||
      pasteLabel.toLowerCase().includes(q) ||
      'paste'.includes(q) ||
      'coller'.includes(q) ||
      'لصق'.includes(q) ||
      'import'.includes(q)
    ) {
      list.push({
        id: 'cmd-smart-paste',
        title: pasteLabel,
        subtitle: t('smartPaste.title'),
        action: () => {
          onClose();
          openSmartPaste();
        },
      });
    }

    for (const item of navItems) {
      if (!q || item.label.toLowerCase().includes(q)) {
        list.push({
          id: `nav-${item.id}`,
          title: item.label,
          subtitle: t('common.commandPalette'),
          action: () => {
            setActiveNav(item.id);
            onClose();
          },
        });
      }
    }

    for (const subj of subjects) {
      if (!q || subj.name.toLowerCase().includes(q) || subj.teacher.toLowerCase().includes(q)) {
        list.push({
          id: `subj-${subj.id}`,
          title: subj.name,
          subtitle: `${t('nav.subjects')} · ${subj.teacher}`,
          action: () => {
            setActiveNav('subjects', subj.id);
            onClose();
          },
        });
      }
    }

    for (const exam of exams) {
      if (!q || exam.title.toLowerCase().includes(q)) {
        list.push({
          id: `exam-${exam.id}`,
          title: exam.title,
          subtitle: `${t('nav.exams')} · ${exam.date}`,
          action: () => {
            setActiveNav('exams');
            onClose();
          },
        });
      }
    }

    for (const tk of tasks) {
      if (!q || tk.title.toLowerCase().includes(q)) {
        list.push({
          id: `task-${tk.id}`,
          title: tk.title,
          subtitle: `${t('nav.lessons')} · ${tk.dueDate}`,
          action: () => {
            setActiveNav('lessons');
            onClose();
          },
        });
      }
    }

    for (const al of alarms) {
      if (!q || al.title.toLowerCase().includes(q)) {
        list.push({
          id: `alarm-${al.id}`,
          title: al.title,
          subtitle: `${t('nav.alarms')} · ${al.time}`,
          action: () => {
            setActiveNav('alarms');
            onClose();
          },
        });
      }
    }

    return list.slice(0, 12);
  }, [
    query,
    navItems,
    subjects,
    exams,
    tasks,
    alarms,
    setActiveNav,
    openSmartPaste,
    onClose,
    lastUndoAction,
    t,
  ]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 backdrop-blur-sm pt-20 px-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={t('common.commandPalette')}
    >
      <div
        className="w-full max-w-xl rounded-2xl border border-[var(--border-strong)] bg-[var(--bg-surface)] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-[var(--border-subtle)] px-4 py-3.5">
          <Search className="h-4 w-4 text-[var(--text-muted)] shrink-0" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('common.searchPlaceholder')}
            className="w-full bg-transparent text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none"
          />
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.cancel')}
            className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-4 py-2.5">
          <button
            type="button"
            onClick={() => {
              onClose();
              openSmartPaste();
            }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent-soft)] border border-[var(--accent-primary)] px-2.5 py-1 text-xs font-semibold text-[var(--accent-strong)] hover:opacity-90 transition whitespace-nowrap"
          >
            <ClipboardPaste className="h-3.5 w-3.5" />
            <span>{t('smartPaste.button')}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenQuickAdd('task');
            }}
            className="rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] px-2.5 py-1 text-xs font-medium text-[var(--text-primary)] hover:border-[var(--accent-primary)] transition whitespace-nowrap"
          >
            + {t('lessons.addTask')}
          </button>
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenQuickAdd('exam');
            }}
            className="rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] px-2.5 py-1 text-xs font-medium text-[var(--text-primary)] hover:border-[var(--accent-primary)] transition whitespace-nowrap"
          >
            + {t('exams.add')}
          </button>
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenQuickAdd('slot');
            }}
            className="rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] px-2.5 py-1 text-xs font-medium text-[var(--text-primary)] hover:border-[var(--accent-primary)] transition whitespace-nowrap"
          >
            + {t('timetable.addSlot')}
          </button>
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenQuickAdd('alarm');
            }}
            className="rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] px-2.5 py-1 text-xs font-medium text-[var(--text-primary)] hover:border-[var(--accent-primary)] transition whitespace-nowrap"
          >
            + {t('alarms.add')}
          </button>
        </div>

        <div className="max-h-80 overflow-y-auto divide-y divide-[var(--border-subtle)]">
          {results.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={item.action}
              className="flex w-full items-center justify-between px-4 py-3 text-start hover:bg-[var(--bg-elevated)] transition"
            >
              <div>
                <div className="text-sm font-medium text-[var(--text-primary)]">{item.title}</div>
                <div className="text-xs text-[var(--text-muted)]">{item.subtitle}</div>
              </div>
              <span className="text-xs text-[var(--accent-primary)] font-mono-tabular">&rarr;</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
