import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  Calendar as CalendarIcon,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardPaste,
  Clock,
  Copy,
  Download,
  Edit3,
  ExternalLink,
  LayoutGrid,
  List,
  MapPin,
  MoreHorizontal,
  Plus,
  Printer,
  Sparkles,
  Trash2,
  User,
  UserCheck,
  UserX,
  Video,
  X,
} from 'lucide-react';
import { useWaqtiStore } from '../store/useWaqtiStore';
import { useTranslation } from '../hooks/useTranslation';
import {
  computeTimetableBlockMetrics,
  computeTimetableGridHours,
  computeWeeklyTimetableSummary,
  detectSlotOverlaps,
  formatGmtOffsetForDate,
  formatLocalizedDate,
  formatShiftPillLabel,
  generateIcsContent,
  getLocalTimeString,
  getOccurrencesForDate,
  getOrderedWeekdays,
  getWeekDates,
  getWeekDayIndex,
  isValidTimeOrder,
  minutesToTime,
  packOverlappingEvents,
  shiftDateString,
  snapMinutesToStep,
  timeToMinutes,
} from '../lib/dates';
import { toIsoWeekday } from '../lib/weekdays';
import { getSubjectColor } from '../lib/colors';
import { EmptyHourglassIllustration } from '../components/WaqtiLogo';
import {
  DeliveryModeSegmentedControl,
  SessionMetaBadges,
  SessionTypeSegmentedControl,
} from '../components/SessionMetaBadges';
import { detectMeetingPlatform, isValidMeetingUrl } from '../lib/timetableParser';
import type {
  DeliveryMode,
  RecurrenceType,
  SessionType,
  TimetableSlot,
  WeekDay,
  WeekParity,
} from '../types';

const PIXELS_PER_HOUR = 68;
const SHIFT_DELTAS = [-30, -15, -5, 5, 15, 30] as const;

interface DragPreviewState {
  slotId: string;
  mode: 'move' | 'resize';
  initialPointerY: number;
  origStartMin: number;
  origEndMin: number;
  currentStartMin: number;
  currentEndMin: number;
  hasMoved: boolean;
}

export const TimetableView: React.FC<{
  onPushUndo: (labelKey: string, restore: () => void) => void;
}> = ({ onPushUndo }) => {
  const { t, lang, dir, digits, digitsStyle, formatTime, formatRange } = useTranslation();
  const subjects = useWaqtiStore((s) => s.subjects);
  const timetable = useWaqtiStore((s) => s.timetable);
  const exams = useWaqtiStore((s) => s.exams);
  const tasks = useWaqtiStore((s) => s.tasks);
  const settings = useWaqtiStore((s) => s.settings);
  const weekStart = settings.weekStart;
  const todayStr = useWaqtiStore((s) => s.todayStr);

  const addTimetableSlot = useWaqtiStore((s) => s.addTimetableSlot);
  const updateTimetableSlot = useWaqtiStore((s) => s.updateTimetableSlot);
  const deleteTimetableSlot = useWaqtiStore((s) => s.deleteTimetableSlot);
  const duplicateDaySlots = useWaqtiStore((s) => s.duplicateDaySlots);
  const addAlarm = useWaqtiStore((s) => s.addAlarm);
  const openSmartPaste = useWaqtiStore((s) => s.openSmartPaste);
  const isSmartPasteOpen = useWaqtiStore((s) => s.isSmartPasteOpen);
  const recentlyImportedSlotIds = useWaqtiStore((s) => s.recentlyImportedSlotIds);
  const clearRecentlyImportedSlots = useWaqtiStore((s) => s.clearRecentlyImportedSlots);

  // Responsive viewport tracking (<768px defaults to List view on initial load)
  const [viewportWidth, setViewportWidth] = useState<number>(() =>
    typeof window !== 'undefined' ? window.innerWidth : 1440
  );
  const [viewMode, setViewMode] = useState<'week' | 'day'>(() =>
    typeof window !== 'undefined' && window.innerWidth < 768 ? 'day' : 'week'
  );

  // Active week anchor date & selected day of week
  const [weekAnchorDate, setWeekAnchorDate] = useState<string>(todayStr);
  const [selectedDay, setSelectedDay] = useState<WeekDay>(() => getWeekDayIndex(todayStr));

  // Filter by SessionType and DeliveryMode
  const [filterType, setFilterType] = useState<'all' | SessionType>('all');
  const [filterMode, setFilterMode] = useState<'all' | DeliveryMode>('all');

  // Configurable Hour Axis Range (Auto-fit vs Custom)
  const [autoFitHours, setAutoFitHours] = useState<boolean>(true);
  const [customStartHour, setCustomStartHour] = useState<number>(7);
  const [customEndHour, setCustomEndHour] = useState<number>(20);

  // Toolbar overflow menu ("⋯")
  const [isOverflowMenuOpen, setIsOverflowMenuOpen] = useState<boolean>(false);
  const overflowMenuRef = useRef<HTMLDivElement | null>(null);

  // Add / Edit Drawer state
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
  const [editingSlotId, setEditingSlotId] = useState<string | null>(null);
  const [subjectId, setSubjectId] = useState<string>(subjects[0]?.id ?? '');
  const [dayOfWeek, setDayOfWeek] = useState<WeekDay>(() => getWeekDayIndex(todayStr));
  const [startTime, setStartTime] = useState<string>('09:00');
  const [endTime, setEndTime] = useState<string>('10:30');
  const [sessionType, setSessionType] = useState<SessionType>('lecture');
  const [section, setSection] = useState<string>('');
  const [group, setGroup] = useState<string>('');
  const [room, setRoom] = useState<string>('');
  const [teacher, setTeacher] = useState<string>('');
  const [mode, setMode] = useState<DeliveryMode>('in_person');
  const [meetingUrl, setMeetingUrl] = useState<string>('');
  const [recurrence, setRecurrence] = useState<RecurrenceType>('weekly');
  const [weekParity, setWeekParity] = useState<WeekParity>('all');
  const [errorMsg, setErrorMsg] = useState<string>('');

  // Selected class block for Popover (desktop) / Bottom Sheet (mobile)
  const [selectedSlotState, setSelectedSlotState] = useState<{
    slotId: string;
    dateStr: string;
    editScope: 'series' | 'occurrence';
  } | null>(null);

  // Pointer drag-to-move / bottom-edge-resize state (5-minute snapping)
  const [dragState, setDragState] = useState<DragPreviewState | null>(null);
  const longPressTimerRef = useRef<number | null>(null);

  // Live "now" time string for Today's glowing line
  const [nowTimeStr, setNowTimeStr] = useState<string>(() =>
    getLocalTimeString(new Date(), settings.timezone)
  );

  useEffect(() => {
    const handleResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    const timer = window.setInterval(() => {
      setNowTimeStr(getLocalTimeString(new Date(), settings.timezone));
    }, 30_000);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.clearInterval(timer);
    };
  }, [settings.timezone]);

  // Global paste listener on the Timetable screen (Ctrl/Cmd+V anywhere opens Smart Paste with content analyzed)
  useEffect(() => {
    const handleGlobalPaste = (e: ClipboardEvent) => {
      if (isSmartPasteOpen) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }
      const htmlText = e.clipboardData?.getData('text/html') ?? '';
      const plainText = e.clipboardData?.getData('text/plain') ?? '';
      if (plainText.trim() || htmlText.trim()) {
        e.preventDefault();
        openSmartPaste({ plainText, htmlText });
      }
    };
    window.addEventListener('paste', handleGlobalPaste);
    return () => window.removeEventListener('paste', handleGlobalPaste);
  }, [isSmartPasteOpen, openSmartPaste]);

  // Clear recently imported slot highlight after 5 seconds
  useEffect(() => {
    if (recentlyImportedSlotIds.length === 0) return;
    const tId = window.setTimeout(() => {
      clearRecentlyImportedSlots();
    }, 5000);
    return () => window.clearTimeout(tId);
  }, [recentlyImportedSlotIds, clearRecentlyImportedSlots]);

  // Close toolbar overflow menu when clicking outside
  useEffect(() => {
    if (!isOverflowMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (overflowMenuRef.current && !overflowMenuRef.current.contains(e.target as Node)) {
        setIsOverflowMenuOpen(false);
      }
    };
    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, [isOverflowMenuOpen]);

  // Global pointer move / up handlers for 5-minute snapped drag & resize
  useEffect(() => {
    if (!dragState) return;

    const handlePointerMove = (e: PointerEvent) => {
      const deltaY = e.clientY - dragState.initialPointerY;
      if (Math.abs(deltaY) < 4 && !dragState.hasMoved) return;

      const deltaMinutesRaw = (deltaY / PIXELS_PER_HOUR) * 60;
      const duration = dragState.origEndMin - dragState.origStartMin;

      if (dragState.mode === 'move') {
        const nextStart = snapMinutesToStep(
          dragState.origStartMin + deltaMinutesRaw,
          5,
          6 * 60,
          23 * 60 - duration
        );
        const nextEnd = nextStart + duration;
        setDragState((prev) =>
          prev
            ? {
                ...prev,
                currentStartMin: nextStart,
                currentEndMin: nextEnd,
                hasMoved: true,
              }
            : null
        );
      } else {
        const nextEnd = snapMinutesToStep(
          dragState.origEndMin + deltaMinutesRaw,
          5,
          dragState.origStartMin + 20,
          23 * 60 + 30
        );
        setDragState((prev) =>
          prev
            ? {
                ...prev,
                currentEndMin: nextEnd,
                hasMoved: true,
              }
            : null
        );
      }
    };

    const handlePointerUp = () => {
      if (dragState.hasMoved) {
        const newStart = minutesToTime(dragState.currentStartMin);
        const newEnd = minutesToTime(dragState.currentEndMin);
        if (isValidTimeOrder(newStart, newEnd)) {
          updateTimetableSlot(dragState.slotId, {
            startTime: newStart,
            endTime: newEnd,
          });
        }
      }
      setDragState(null);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [dragState, updateTimetableSlot]);

  // Ordered weekdays & corresponding YYYY-MM-DD dates for the active week
  const orderedDaysFull = useMemo(
    () => getOrderedWeekdays(lang, weekStart, 'EEEE'),
    [lang, weekStart]
  );
  const orderedDaysShort = useMemo(
    () => getOrderedWeekdays(lang, weekStart, 'EEE'),
    [lang, weekStart]
  );
  const weekDates = useMemo(
    () => getWeekDates(weekAnchorDate, weekStart),
    [weekAnchorDate, weekStart]
  );

  // Map each ordered weekday to its exact date in the currently viewed week
  const weekDayColumns = useMemo(() => {
    return orderedDaysFull.map((dFull, idx) => {
      const dateStr = weekDates[idx] ?? todayStr;
      const dShort = orderedDaysShort[idx]?.label ?? dFull.label;
      const dayNum = parseInt(dateStr.slice(8, 10), 10);
      const isToday = dateStr === todayStr;
      const isWeekend = settings.weekendDays.includes(dFull.dayIndex);
      return {
        dayIndex: dFull.dayIndex,
        fullLabel: dFull.label,
        shortLabel: dShort,
        dateStr,
        dayNum,
        isToday,
        isWeekend,
      };
    });
  }, [orderedDaysFull, orderedDaysShort, weekDates, todayStr, settings.weekendDays]);

  // Filtered timetable based on active SessionType and DeliveryMode filters
  const filteredTimetable = useMemo(() => {
    return timetable.filter((sl) => {
      if (filterType !== 'all' && (sl.type || 'lecture') !== filterType) return false;
      if (filterMode !== 'all' && (sl.mode || 'in_person') !== filterMode) return false;
      return true;
    });
  }, [timetable, filterType, filterMode]);

  // Weekly Summary Metrics (Total Hours, Busiest Day, Free Study Windows)
  const weeklySummary = useMemo(
    () => computeWeeklyTimetableSummary(filteredTimetable, weekDates),
    [filteredTimetable, weekDates]
  );

  const busiestDayLabel = useMemo(() => {
    if (weeklySummary.busiestDayIndex === null) return '—';
    const found = orderedDaysFull.find((d) => d.dayIndex === weeklySummary.busiestDayIndex);
    return found ? `${found.label} (${digits(weeklySummary.busiestDayHours)}h)` : '—';
  }, [weeklySummary, orderedDaysFull, digits]);

  // Hour Axis Computation (Auto-fit to user's classes or custom range)
  const { startHour, endHour, hours } = useMemo(
    () => computeTimetableGridHours(filteredTimetable, autoFitHours, customStartHour, customEndHour),
    [filteredTimetable, autoFitHours, customStartHour, customEndHour]
  );

  const gridTotalHeightPx = (endHour - startHour) * PIXELS_PER_HOUR;

  // Count total active slots in the viewed week for whole-week empty state
  const totalWeekActiveSlots = useMemo(() => {
    return weekDayColumns.reduce((acc, col) => {
      const count = getOccurrencesForDate(col.dateStr, {
        timetable: filteredTimetable,
        subjects,
      }).length;
      return acc + count;
    }, 0);
  }, [weekDayColumns, filteredTimetable, subjects]);

  const activeSubjectId = subjectId || subjects[0]?.id || '';

  const formConflicts = useMemo(() => {
    if (!isValidTimeOrder(startTime, endTime)) return [];
    return detectSlotOverlaps(
      { dayOfWeek, startTime, endTime, id: editingSlotId ?? undefined },
      timetable
    );
  }, [dayOfWeek, startTime, endTime, editingSlotId, timetable]);

  // Open Add Form pre-filled with a specific day, start time, and subject's default delivery mode
  const openAddSlotModal = (targetDay: WeekDay, targetStart: string = '09:00') => {
    setEditingSlotId(null);
    const defaultSubj = subjects[0];
    const defaultDuration = settings.defaultClassDurationMinutes || 90;
    const defaultType: SessionType = 'lecture';
    const resolvedMode: DeliveryMode =
      defaultSubj?.modeByType?.[defaultType] ?? defaultSubj?.defaultMode ?? 'in_person';
    setSubjectId(defaultSubj?.id ?? '');
    setDayOfWeek(targetDay);
    setStartTime(targetStart);
    const endMins = Math.min(23 * 60 + 30, timeToMinutes(targetStart) + defaultDuration);
    setEndTime(minutesToTime(endMins));
    setSessionType(defaultType);
    setSection('');
    setGroup('');
    setRoom(resolvedMode === 'remote' ? '' : (defaultSubj?.room ?? ''));
    setTeacher(defaultSubj?.teacher ?? '');
    setMode(resolvedMode);
    setMeetingUrl('');
    setRecurrence('weekly');
    setWeekParity('all');
    setErrorMsg('');
    setIsFormOpen(true);
  };

  // Open Edit Form pre-filled from an existing slot
  const openEditSlotModal = (slot: TimetableSlot) => {
    setEditingSlotId(slot.id);
    setSubjectId(slot.subjectId);
    setDayOfWeek(slot.dayOfWeek);
    setStartTime(slot.startTime);
    setEndTime(slot.endTime);
    setSessionType(slot.type ?? 'lecture');
    setSection(slot.section ?? '');
    setGroup(slot.group ?? '');
    setRoom(slot.room);
    setTeacher(slot.teacher);
    setMode(slot.mode ?? 'in_person');
    setMeetingUrl(slot.meetingUrl ?? '');
    setRecurrence(slot.recurrence);
    setWeekParity(slot.weekParity ?? 'all');
    setErrorMsg('');
    setSelectedSlotState(null);
    setIsFormOpen(true);
  };

  const handleSaveSlot = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (!isValidTimeOrder(startTime, endTime)) {
      setErrorMsg(t('error.endBeforeStart'));
      return;
    }
    if ((mode === 'remote' || mode === 'hybrid') && meetingUrl.trim() && !isValidMeetingUrl(meetingUrl)) {
      setErrorMsg(t('timetable.invalidUrl'));
      return;
    }
    const subj = subjects.find((s) => s.id === activeSubjectId);
    const cleanUrl = meetingUrl.trim();
    const detectedPlatform = detectMeetingPlatform(cleanUrl);
    const resolvedRoom =
      mode === 'remote'
        ? room.trim()
        : room.trim() || subj?.room || 'Room 101';

    const payload = {
      subjectId: activeSubjectId,
      dayOfWeek,
      startTime,
      endTime,
      type: sessionType,
      section: section.trim() || undefined,
      group: group.trim() || undefined,
      room: resolvedRoom,
      teacher: teacher.trim() || subj?.teacher || '',
      mode,
      meetingUrl: cleanUrl || undefined,
      platform: detectedPlatform,
      recurrence,
      weekParity: weekParity !== 'all' ? weekParity : undefined,
    };

    if (editingSlotId) {
      updateTimetableSlot(editingSlotId, payload);
    } else {
      addTimetableSlot(payload);
    }
    setIsFormOpen(false);
    setEditingSlotId(null);
  };

  const handleExportIcs = () => {
    const ics = generateIcsContent(timetable, exams, tasks, subjects, todayStr);
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `waqti-schedule-${todayStr}.ics`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setIsOverflowMenuOpen(false);
  };

  // Apply a change either to the whole weekly series or to this single date occurrence
  const applySlotChangeWithScope = (
    slot: TimetableSlot,
    dateStr: string,
    scope: 'series' | 'occurrence',
    patch: Partial<TimetableSlot>
  ) => {
    if (scope === 'series' || slot.specificDate) {
      updateTimetableSlot(slot.id, patch);
      return;
    }
    // Single-occurrence edit: exclude `dateStr` from the recurring series and spawn a custom occurrence
    const prevExcluded = slot.excludedDates ?? [];
    if (!prevExcluded.includes(dateStr)) {
      updateTimetableSlot(slot.id, {
        excludedDates: [...prevExcluded, dateStr],
      });
    }
    const newId = addTimetableSlot({
      subjectId: patch.subjectId ?? slot.subjectId,
      dayOfWeek: patch.dayOfWeek ?? slot.dayOfWeek,
      startTime: patch.startTime ?? slot.startTime,
      endTime: patch.endTime ?? slot.endTime,
      room: patch.room ?? slot.room,
      teacher: patch.teacher ?? slot.teacher,
      recurrence: 'custom',
      specificDate: dateStr,
      attendanceByDate: patch.attendanceByDate ?? slot.attendanceByDate,
    });
    setSelectedSlotState({
      slotId: newId,
      dateStr,
      editScope: 'occurrence',
    });
  };

  const handleShiftSlotMinutes = (
    slot: TimetableSlot,
    dateStr: string,
    scope: 'series' | 'occurrence',
    deltaMins: number
  ) => {
    const newStartMin = Math.max(0, timeToMinutes(slot.startTime) + deltaMins);
    const duration = Math.max(15, timeToMinutes(slot.endTime) - timeToMinutes(slot.startTime));
    const newEndMin = Math.min(23 * 60 + 55, newStartMin + duration);
    const newStart = minutesToTime(newStartMin);
    const newEnd = minutesToTime(newEndMin);
    if (isValidTimeOrder(newStart, newEnd)) {
      applySlotChangeWithScope(slot, dateStr, scope, {
        startTime: newStart,
        endTime: newEnd,
      });
    }
  };

  const handleMoveSlotToDay = (
    slot: TimetableSlot,
    dateStr: string,
    scope: 'series' | 'occurrence',
    targetDay: WeekDay
  ) => {
    const targetCol = weekDayColumns.find((c) => c.dayIndex === targetDay);
    const targetDateStr = targetCol?.dateStr ?? dateStr;
    if (scope === 'series' || slot.specificDate) {
      updateTimetableSlot(slot.id, {
        dayOfWeek: targetDay,
        specificDate: slot.specificDate ? targetDateStr : undefined,
      });
      setSelectedSlotState((prev) =>
        prev ? { ...prev, dateStr: targetDateStr } : null
      );
    } else {
      applySlotChangeWithScope(slot, dateStr, 'occurrence', {
        dayOfWeek: targetDay,
        specificDate: targetDateStr,
      });
    }
  };

  const handleToggleAttendance = (
    slot: TimetableSlot,
    dateStr: string,
    status: 'attended' | 'absent' | 'none'
  ) => {
    const nextMap = { ...(slot.attendanceByDate ?? {}) };
    if (status === 'none') {
      delete nextMap[dateStr];
    } else {
      nextMap[dateStr] = status;
    }
    updateTimetableSlot(slot.id, { attendanceByDate: nextMap });
  };

  const handleDuplicateSlot = (slot: TimetableSlot) => {
    const nextStartMin = Math.min(22 * 60, timeToMinutes(slot.endTime) + 15);
    const duration = Math.max(30, timeToMinutes(slot.endTime) - timeToMinutes(slot.startTime));
    const nextEndMin = Math.min(23 * 60 + 45, nextStartMin + duration);
    addTimetableSlot({
      subjectId: slot.subjectId,
      dayOfWeek: slot.dayOfWeek,
      startTime: minutesToTime(nextStartMin),
      endTime: minutesToTime(nextEndMin),
      room: slot.room,
      teacher: slot.teacher,
      recurrence: slot.recurrence,
    });
    setSelectedSlotState(null);
  };

  const handleDeleteSlot = (slot: TimetableSlot) => {
    const removed = deleteTimetableSlot(slot.id);
    setSelectedSlotState(null);
    if (removed) {
      onPushUndo('common.deletedToast', () => {
        useWaqtiStore.setState((st) => ({
          timetable: [...st.timetable, removed],
        }));
      });
    }
  };

  const activePopoverSlot = useMemo(() => {
    if (!selectedSlotState) return null;
    return timetable.find((s) => s.id === selectedSlotState.slotId) ?? null;
  }, [selectedSlotState, timetable]);

  // Visible columns for Grid View:
  // - <768px: single selected day column (with swipeable 7-day strip above)
  // - >=768px: all 7 days (5 visible + snap scroll on 768-1279px, all 7 in viewport on >=1280px)
  const isMobileViewport = viewportWidth < 768;
  const isTabletViewport = viewportWidth >= 768 && viewportWidth < 1280;

  const gridColumnsToRender = useMemo(() => {
    if (isMobileViewport) {
      return weekDayColumns.filter((c) => c.dayIndex === selectedDay);
    }
    return weekDayColumns;
  }, [isMobileViewport, weekDayColumns, selectedDay]);

  const weekRangeLabel = useMemo(() => {
    const first = weekDates[0] ?? todayStr;
    const last = weekDates[6] ?? todayStr;
    const fStr = formatLocalizedDate(first, lang, 'd MMM', digitsStyle);
    const lStr = formatLocalizedDate(last, lang, 'd MMM yyyy', digitsStyle);
    return `${fStr} – ${lStr}`;
  }, [weekDates, todayStr, lang, digitsStyle]);

  // Current time "Now" position in pixels inside the grid
  const nowMinutes = timeToMinutes(nowTimeStr);
  const showNowLine =
    nowMinutes >= startHour * 60 && nowMinutes <= endHour * 60;
  const nowLineTopPx = Math.round(
    ((nowMinutes - startHour * 60) / 60) * PIXELS_PER_HOUR
  );

  return (
    <div className="space-y-5 min-w-0 max-w-full overflow-x-hidden">
      {/* ═══════════ 1. HEADER & CLEAN TOOLBAR ═══════════ */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold font-display text-[var(--text-primary)] truncate">
            {t('timetable.title')}
          </h1>
          <p className="text-sm text-[var(--text-secondary)]">
            {t('timetable.subtitle')}
          </p>
        </div>

        {/* Grouped Controls: Segmented Grid/List + Overflow "⋯" + Primary "Add class" */}
        <div className="flex flex-wrap items-center gap-2 no-print">
          {/* Segmented Grid / List Toggle */}
          <div
            className="inline-flex items-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-1"
            role="group"
            aria-label="Timetable View Mode"
          >
            <button
              type="button"
              onClick={() => setViewMode('week')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition whitespace-nowrap ${
                viewMode === 'week'
                  ? 'bg-[var(--accent-soft)] text-[var(--accent-strong)] shadow-xs'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5 shrink-0" />
              <span>{t('timetable.gridView')}</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('day')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition whitespace-nowrap ${
                viewMode === 'day'
                  ? 'bg-[var(--accent-soft)] text-[var(--accent-strong)] shadow-xs'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <List className="h-3.5 w-3.5 shrink-0" />
              <span>{t('timetable.listView')}</span>
            </button>
          </div>

          {/* Overflow Menu "⋯" (Export .ics, Print/PDF, Copy Today's Classes, Hour Range) */}
          <div className="relative" ref={overflowMenuRef}>
            <button
              type="button"
              onClick={() => setIsOverflowMenuOpen((v) => !v)}
              aria-label={t('timetable.moreActions')}
              aria-expanded={isOverflowMenuOpen}
              className="inline-flex items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-2.5 text-xs font-semibold text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)] transition"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>

            {isOverflowMenuOpen && (
              <div className="absolute end-0 mt-2 w-64 rounded-2xl border border-[var(--border-strong)] bg-[var(--bg-surface)] p-2 shadow-2xl z-40 space-y-1">
                <button
                  type="button"
                  onClick={handleExportIcs}
                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition text-start"
                >
                  <Download className="h-3.5 w-3.5 text-[var(--accent-strong)] shrink-0" />
                  <span className="truncate">{t('timetable.exportIcs')}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsOverflowMenuOpen(false);
                    window.print();
                  }}
                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition text-start"
                >
                  <Printer className="h-3.5 w-3.5 text-[var(--accent-strong)] shrink-0" />
                  <span className="truncate">{t('timetable.printPdf')}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    duplicateDaySlots(selectedDay, toIsoWeekday((selectedDay % 7) + 1));
                    setIsOverflowMenuOpen(false);
                  }}
                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition text-start"
                >
                  <Copy className="h-3.5 w-3.5 text-[var(--accent-strong)] shrink-0" />
                  <span className="truncate">{t('timetable.copyTodayClasses')}</span>
                </button>

                <div className="border-t border-[var(--border-subtle)] my-1 pt-2 px-2 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-[var(--text-secondary)]">
                      {t('timetable.autoFitHours')}
                    </span>
                    <button
                      type="button"
                      onClick={() => setAutoFitHours((v) => !v)}
                      className={`h-5 w-9 rounded-full p-0.5 transition ${
                        autoFitHours
                          ? 'bg-[var(--accent-primary)]'
                          : 'bg-[var(--border-strong)]'
                      }`}
                    >
                      <span
                        className={`block h-4 w-4 rounded-full bg-white transition-transform ${
                          autoFitHours
                            ? dir === 'rtl'
                              ? '-translate-x-4'
                              : 'translate-x-4'
                            : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  {!autoFitHours && (
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <div>
                        <label className="block text-[10px] text-[var(--text-muted)] mb-0.5">
                          {t('timetable.startTime')}
                        </label>
                        <select
                          dir="ltr"
                          value={customStartHour}
                          onChange={(e) => setCustomStartHour(Number(e.target.value))}
                          className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2 py-1 text-xs font-mono-tabular text-[var(--text-primary)]"
                        >
                          {[5, 6, 7, 8, 9].map((h) => (
                            <option key={h} value={h}>
                              {String(h).padStart(2, '0')}:00
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] text-[var(--text-muted)] mb-0.5">
                          {t('timetable.endTime')}
                        </label>
                        <select
                          dir="ltr"
                          value={customEndHour}
                          onChange={(e) => setCustomEndHour(Number(e.target.value))}
                          className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2 py-1 text-xs font-mono-tabular text-[var(--text-primary)]"
                        >
                          {[17, 18, 19, 20, 21, 22, 23].map((h) => (
                            <option key={h} value={h}>
                              {String(h).padStart(2, '0')}:00
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Prominent Smart Paste Timetable Button */}
          <button
            type="button"
            data-testid="paste-timetable-btn"
            onClick={() => openSmartPaste(null)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--accent-primary)]/45 bg-[var(--accent-soft)] px-3.5 py-2.5 text-xs font-bold text-[var(--accent-strong)] hover:bg-[var(--accent-primary)] hover:text-[var(--accent-ink)] shadow-2xs transition whitespace-nowrap cursor-pointer"
          >
            <ClipboardPaste className="h-4 w-4 shrink-0" />
            <span>{t('timetable.pasteTimetable')}</span>
          </button>

          {/* Primary Add Class CTA */}
          <button
            type="button"
            onClick={() => openAddSlotModal(selectedDay, '09:00')}
            className="inline-flex items-center gap-1.5 rounded-xl btn-primary-waqti px-4 py-2.5 text-xs font-semibold shadow-sm transition whitespace-nowrap cursor-pointer"
          >
            <Plus className="h-4 w-4 shrink-0" />
            <span>{t('timetable.addSlot')}</span>
          </button>
        </div>
      </div>

      {/* ═══════════ 1B. SESSION TYPE & DELIVERY MODE FILTER BAR ═══════════ */}
      <div className="flex flex-wrap items-center justify-between gap-2 no-print">
        <div className="flex flex-wrap items-center gap-1.5">
          {(['all', 'lecture', 'td', 'tp', 'other'] as const).map((tp) => {
            const active = filterType === tp;
            return (
              <button
                key={tp}
                type="button"
                onClick={() => setFilterType(tp)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                  active
                    ? 'btn-primary-waqti shadow-2xs'
                    : 'bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                {tp === 'all' ? t('timetable.filterAllTypes') : t(`timetable.type.${tp}`)}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {(['all', 'in_person', 'remote', 'hybrid'] as const).map((md) => {
            const active = filterMode === md;
            return (
              <button
                key={md}
                type="button"
                onClick={() => setFilterMode(md)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                  active
                    ? 'btn-primary-waqti shadow-2xs'
                    : 'bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                {md === 'all' ? t('timetable.filterAllModes') : t(`timetable.mode.${md}`)}
              </button>
            );
          })}
        </div>
      </div>

      {/* ═══════════ 2. WEEK NAVIGATOR & MINI SUMMARY BAR ═══════════ */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-3 shadow-2xs">
        {/* Week Date Range Navigator */}
        <div className="flex items-center gap-2">
          <div className="inline-flex items-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-0.5">
            <button
              type="button"
              onClick={() => setWeekAnchorDate((d) => shiftDateString(d, -7))}
              aria-label="Previous week"
              className="rounded-lg p-1.5 text-[var(--text-secondary)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)] transition"
            >
              {dir === 'rtl' ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronLeft className="h-4 w-4" />
              )}
            </button>
            <button
              type="button"
              onClick={() => {
                setWeekAnchorDate(todayStr);
                setSelectedDay(getWeekDayIndex(todayStr));
              }}
              className="px-3 py-1 text-xs font-semibold text-[var(--text-primary)] hover:text-[var(--accent-strong)] transition whitespace-nowrap"
            >
              {t('calendar.today')}
            </button>
            <button
              type="button"
              onClick={() => setWeekAnchorDate((d) => shiftDateString(d, 7))}
              aria-label="Next week"
              className="rounded-lg p-1.5 text-[var(--text-secondary)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)] transition"
            >
              {dir === 'rtl' ? (
                <ChevronLeft className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </button>
          </div>

          <span className="text-xs font-bold text-[var(--text-primary)] whitespace-nowrap">
            {weekRangeLabel}
          </span>
        </div>

        {/* Mini Summary Bar: Total Class Hours · Busiest Day · Free Study Windows */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs">
          <div className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-[var(--accent-strong)] shrink-0" />
            <span className="text-[var(--text-muted)]">{t('timetable.summaryTotalHours')}:</span>
            <strong dir="ltr" className="font-mono-tabular text-[var(--text-primary)]">
              {digits(weeklySummary.totalHours)}h
            </strong>
          </div>

          <span className="hidden sm:inline text-[var(--border-strong)]" aria-hidden="true">
            ·
          </span>

          <div className="flex items-center gap-1.5">
            <CalendarIcon className="h-3.5 w-3.5 text-[var(--accent-strong)] shrink-0" />
            <span className="text-[var(--text-muted)]">{t('timetable.summaryBusiestDay')}:</span>
            <strong className="text-[var(--text-primary)] whitespace-nowrap">
              {busiestDayLabel}
            </strong>
          </div>

          <span className="hidden sm:inline text-[var(--border-strong)]" aria-hidden="true">
            ·
          </span>

          <div className="flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-[var(--accent-strong)] shrink-0" />
            <span className="text-[var(--text-muted)]">{t('timetable.summaryFreeSlots')}:</span>
            <strong dir="ltr" className="font-mono-tabular text-[var(--text-primary)]">
              {digits(weeklySummary.freeSlotsCount)}
            </strong>
          </div>
        </div>
      </div>

      {/* ═══════════ 3. ADD / EDIT CLASS DRAWER ═══════════ */}
      {isFormOpen && (
        <form
          onSubmit={handleSaveSlot}
          className="rounded-3xl border border-[var(--border-strong)] bg-[var(--bg-surface)] p-5 sm:p-6 space-y-4 shadow-lg no-print"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-[var(--text-primary)]">
              {editingSlotId ? t('timetable.editSlot') : t('timetable.addSlot')}
            </h2>
            <button
              type="button"
              onClick={() => {
                setIsFormOpen(false);
                setEditingSlotId(null);
              }}
              aria-label={t('common.close')}
              className="rounded-lg p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                {t('timetable.subject')}
              </label>
              <select
                value={activeSubjectId}
                onChange={(e) => {
                  const nextId = e.target.value;
                  setSubjectId(nextId);
                  const subj = subjects.find((s) => s.id === nextId);
                  if (subj && !editingSlotId) {
                    const nextMode =
                      subj.modeByType?.[sessionType] ?? subj.defaultMode ?? 'in_person';
                    setMode(nextMode);
                    setRoom(nextMode === 'remote' ? '' : subj.room);
                    setTeacher(subj.teacher);
                  }
                }}
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
                {t('timetable.day')}
              </label>
              <select
                value={dayOfWeek}
                onChange={(e) => setDayOfWeek(Number(e.target.value) as WeekDay)}
                className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2.5 text-sm text-[var(--text-primary)]"
              >
                {orderedDaysFull.map((d) => (
                  <option key={d.dayIndex} value={d.dayIndex}>
                    {d.label}
                  </option>
                ))}
              </select>
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
                {t('timetable.endTime')}
              </label>
              <input
                type="time"
                dir="ltr"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2.5 text-sm font-mono-tabular text-[var(--text-primary)]"
              />
            </div>
          </div>

          {/* Session Type & Delivery Mode Segmented Controls */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                {t('timetable.sessionType')}
              </label>
              <SessionTypeSegmentedControl
                lang={lang}
                value={sessionType}
                onChange={(nextType) => {
                  setSessionType(nextType);
                  const subj = subjects.find((s) => s.id === activeSubjectId);
                  if (subj && !editingSlotId) {
                    const nextMode =
                      subj.modeByType?.[nextType] ?? subj.defaultMode ?? mode;
                    setMode(nextMode);
                  }
                }}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                {t('timetable.mode')}
              </label>
              <DeliveryModeSegmentedControl
                lang={lang}
                value={mode}
                onChange={setMode}
              />
            </div>
          </div>

          {/* Section, Group, Room, Teacher, Recurrence, Week Parity */}
          <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                {t('timetable.section')}
              </label>
              <input
                type="text"
                value={section}
                onChange={(e) => setSection(e.target.value)}
                placeholder="1"
                className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-primary)]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                {t('timetable.group')}
              </label>
              <input
                type="text"
                value={group}
                onChange={(e) => setGroup(e.target.value)}
                placeholder="3"
                className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-primary)]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                {t('subjects.room')}{' '}
                {mode === 'remote' ? `(${t('common.cancel')})` : ''}
              </label>
              <input
                type="text"
                value={room}
                onChange={(e) => setRoom(e.target.value)}
                placeholder={mode === 'remote' ? 'Online' : 'Amphi B2'}
                className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-primary)]"
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
                className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-primary)]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                {t('timetable.recurrence')}
              </label>
              <select
                value={recurrence}
                onChange={(e) => setRecurrence(e.target.value as RecurrenceType)}
                className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-primary)]"
              >
                <option value="weekly">{t('timetable.recurrence.weekly')}</option>
                <option value="biweekly">{t('timetable.recurrence.biweekly')}</option>
                <option value="custom">{t('timetable.recurrence.custom')}</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                {t('timetable.weekParity')}
              </label>
              <select
                value={weekParity}
                onChange={(e) => setWeekParity(e.target.value as WeekParity)}
                className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-primary)]"
              >
                <option value="all">{t('timetable.parity.all')}</option>
                <option value="odd">{t('timetable.parity.odd')}</option>
                <option value="even">{t('timetable.parity.even')}</option>
              </select>
            </div>
          </div>

          {/* Meeting Link field when Remote or Hybrid is selected */}
          {(mode === 'remote' || mode === 'hybrid') && (
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                {t('timetable.meetingUrl')}
              </label>
              <input
                type="url"
                dir="ltr"
                value={meetingUrl}
                onChange={(e) => setMeetingUrl(e.target.value)}
                placeholder="https://meet.google.com/... or https://zoom.us/j/..."
                className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3.5 py-2.5 text-sm text-[var(--text-primary)]"
              />
            </div>
          )}

          {formConflicts.length > 0 && (
            <div className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-2.5 text-xs text-amber-700 dark:text-amber-300">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>
                {t('timetable.conflictWarning', {
                  subject:
                    subjects.find((s) => s.id === formConflicts[0].subjectId)?.name ?? '',
                  time: formatRange(formConflicts[0].startTime, formConflicts[0].endTime),
                })}
              </span>
            </div>
          )}

          {errorMsg && (
            <div
              role="alert"
              className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3.5 py-2.5 text-xs font-medium text-rose-500"
            >
              {errorMsg}
            </div>
          )}

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setIsFormOpen(false);
                setEditingSlotId(null);
              }}
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

      {/* ═══════════ 4. SWIPEABLE DAY SELECTOR STRIP (For List View OR <768px Grid View) ═══════════ */}
      {(viewMode === 'day' || isMobileViewport) && (
        <div
          className="grid grid-cols-7 gap-1.5 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-1.5 min-w-0 overflow-hidden"
          role="tablist"
          aria-label={t('timetable.day')}
        >
          {weekDayColumns.map((col) => {
            const isSelected = selectedDay === col.dayIndex;
            const daySlotCount = getOccurrencesForDate(col.dateStr, {
              timetable,
              subjects,
            }).length;
            return (
              <button
                key={col.dayIndex}
                type="button"
                role="tab"
                aria-selected={isSelected}
                onClick={() => setSelectedDay(col.dayIndex)}
                className={`flex flex-col items-center justify-center rounded-xl py-2 px-1 transition min-w-0 overflow-hidden ${
                  isSelected
                    ? 'btn-primary-waqti shadow-xs'
                    : col.isToday
                      ? 'border border-[var(--accent-primary)] bg-[var(--accent-soft)]/50 text-[var(--text-primary)]'
                      : 'text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]'
                }`}
              >
                <span className="text-[10px] font-semibold truncate max-w-full">
                  {col.shortLabel}
                </span>
                <span className="mt-0.5 text-xs font-bold font-mono-tabular leading-none">
                  {digits(col.dayNum)}
                </span>
                <span
                  className={`mt-1 h-1.5 w-1.5 rounded-full ${
                    daySlotCount > 0
                      ? isSelected
                        ? 'bg-current'
                        : 'bg-[var(--accent-primary)]'
                      : 'bg-transparent'
                  }`}
                />
              </button>
            );
          })}
        </div>
      )}

      {/* ═══════════ 5. SINGLE WHOLE-WEEK FRIENDLY EMPTY STATE ═══════════ */}
      {totalWeekActiveSlots === 0 && (
        <div className="rounded-3xl border border-dashed border-[var(--border-strong)] bg-[var(--bg-surface)] p-8 text-center flex flex-col items-center justify-center gap-3">
          <EmptyHourglassIllustration className="w-16 h-16" />
          <div className="max-w-md space-y-1">
            <h2 className="text-base font-bold text-[var(--text-primary)]">
              {t('timetable.emptyWeekTitle')}
            </h2>
            <p className="text-xs text-[var(--text-secondary)]">
              {t('timetable.emptyWeekSubtitle')}
            </p>
          </div>
          <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => openSmartPaste(null)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--accent-primary)]/45 bg-[var(--accent-soft)] px-4 py-2 text-xs font-bold text-[var(--accent-strong)] shadow-xs cursor-pointer"
            >
              <ClipboardPaste className="h-4 w-4" />
              <span>{t('timetable.pasteTimetable')}</span>
            </button>
            <button
              type="button"
              onClick={() => openAddSlotModal(selectedDay, '09:00')}
              className="inline-flex items-center gap-1.5 rounded-xl btn-primary-waqti px-4 py-2 text-xs font-semibold shadow-xs cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>{t('timetable.addSlot')}</span>
            </button>
          </div>
        </div>
      )}

      {/* ═══════════ 6. PROFESSIONAL TIME-GRID VIEW ═══════════ */}
      {viewMode === 'week' && (
        <div
          data-testid="timetable-grid-wrapper"
          className="rounded-3xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-xs overflow-hidden min-w-0 max-w-full"
        >
          {/* Horizontal Snap Scroll Container for Tablet (768–1279px shows 5 days in viewport, >=1280px shows all 7 days) */}
          <div
            className={
              isTabletViewport
                ? 'overflow-x-auto snap-x snap-mandatory min-w-0'
                : 'overflow-hidden min-w-0'
            }
          >
            <div
              className="min-w-0"
              style={
                isTabletViewport
                  ? { width: '140%' } // 7 columns over 140% width => exactly 5 columns visible per 100% viewport
                  : { width: '100%' }
              }
            >
              {/* Sticky Day Headers Row */}
              <div className="sticky top-0 z-20 flex border-b border-[var(--border-subtle)] bg-[var(--bg-surface)]/95 backdrop-blur-md min-w-0">
                {/* Top-Start Corner Hour Gutter Header (Active Timezone GMT Offset) */}
                <div
                  dir="ltr"
                  data-testid="timetable-tz-gutter"
                  title={settings.timezone}
                  className="w-14 sm:w-16 shrink-0 border-e border-[var(--border-subtle)] flex items-center justify-center py-3 text-[10px] font-mono-tabular font-semibold text-[var(--text-muted)]"
                >
                  {formatGmtOffsetForDate(weekAnchorDate, settings.timezone)}
                </div>

                {/* Day Column Headers */}
                <div
                  className="flex-1 grid min-w-0"
                  style={{
                    gridTemplateColumns: `repeat(${gridColumnsToRender.length}, minmax(0, 1fr))`,
                  }}
                >
                  {gridColumnsToRender.map((col) => {
                    const isSelected = selectedDay === col.dayIndex;
                    return (
                      <button
                        key={col.dayIndex}
                        type="button"
                        onClick={() => setSelectedDay(col.dayIndex)}
                        className={`snap-start flex items-center justify-between gap-1.5 px-2.5 py-2.5 border-e last:border-e-0 border-[var(--border-subtle)] min-w-0 overflow-hidden transition ${
                          col.isToday
                            ? 'bg-[var(--accent-soft)]/45'
                            : col.isWeekend
                              ? 'bg-[var(--bg-elevated)]/60'
                              : isSelected
                                ? 'bg-[var(--bg-elevated)]'
                                : ''
                        }`}
                      >
                        <span className="text-xs font-bold text-[var(--text-primary)] truncate min-w-0">
                          <span className="hidden xl:inline">{col.fullLabel}</span>
                          <span className="xl:hidden">{col.shortLabel}</span>
                        </span>
                        <span
                          className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold font-mono-tabular ${
                            col.isToday
                              ? 'btn-primary-waqti shadow-xs'
                              : 'text-[var(--text-secondary)] bg-[var(--bg-elevated)]'
                          }`}
                        >
                          {digits(col.dayNum)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Time-Grid Body: Sticky Hour Gutter + Day Columns */}
              <div
                className="relative flex min-w-0 overflow-hidden"
                style={{ height: `${gridTotalHeightPx}px` }}
              >
                {/* Sticky Hour Gutter */}
                <div
                  dir="ltr"
                  className="w-14 sm:w-16 shrink-0 border-e border-[var(--border-subtle)] bg-[var(--bg-surface)] select-none relative z-10"
                >
                  {hours.slice(0, -1).map((h, idx) => {
                    const labelStr = `${String(h).padStart(2, '0')}:00`;
                    return (
                      <div
                        key={h}
                        style={{
                          top: `${idx * PIXELS_PER_HOUR}px`,
                          height: `${PIXELS_PER_HOUR}px`,
                        }}
                        className="absolute inset-x-0 px-1.5 pt-1 text-end"
                      >
                        <span className="text-[11px] font-mono-tabular font-semibold text-[var(--text-muted)] whitespace-nowrap">
                          {formatTime(labelStr)}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Day Columns CSS Grid (`minmax(0, 1fr)`) */}
                <div
                  data-testid="timetable-day-columns-grid"
                  className="flex-1 grid relative min-w-0 overflow-hidden"
                  style={{
                    gridTemplateColumns: `repeat(${gridColumnsToRender.length}, minmax(0, 1fr))`,
                  }}
                >
                  {/* Horizontal Full-Hour & Half-Hour Grid Lines */}
                  <div className="pointer-events-none absolute inset-0 z-0">
                    {hours.slice(0, -1).map((h, idx) => (
                      <div
                        key={h}
                        style={{
                          top: `${idx * PIXELS_PER_HOUR}px`,
                          height: `${PIXELS_PER_HOUR}px`,
                        }}
                        className="w-full border-t border-[var(--border-subtle)]/80 relative"
                      >
                        {/* Half-hour subtle hairline */}
                        <div
                          style={{ top: `${PIXELS_PER_HOUR / 2}px` }}
                          className="w-full border-t border-dashed border-[var(--border-subtle)]/45 absolute inset-x-0"
                        />
                      </div>
                    ))}
                  </div>

                  {/* Individual Day Columns */}
                  {gridColumnsToRender.map((col) => {
                    const rawDaySlots = getOccurrencesForDate(col.dateStr, {
                      timetable: filteredTimetable,
                      subjects,
                    }).classes.map((c) => c.slot);
                    const packedSlots = packOverlappingEvents(rawDaySlots);
                    const isEmptyDay = packedSlots.length === 0;

                    return (
                      <div
                        key={col.dayIndex}
                        data-testid={`timetable-col-${col.dayIndex}`}
                        className={`group/daycol relative h-full border-e last:border-e-0 border-[var(--border-subtle)] min-w-0 overflow-hidden ${
                          col.isWeekend ? 'bg-[var(--bg-elevated)]/30' : ''
                        }`}
                      >
                        {/* Interactive Hour Click Targets (Also shows faint dashed zone + hover "+" on empty days) */}
                        <div className="absolute inset-0 z-0 flex flex-col">
                          {hours.slice(0, -1).map((h) => {
                            const slotStartStr = `${String(h).padStart(2, '0')}:00`;
                            return (
                              <button
                                key={h}
                                type="button"
                                onClick={() => openAddSlotModal(col.dayIndex, slotStartStr)}
                                aria-label={`${t('timetable.addSlot')} ${col.fullLabel} ${slotStartStr}`}
                                style={{ height: `${PIXELS_PER_HOUR}px` }}
                                className="group/hourcell w-full flex items-center justify-center hover:bg-[var(--accent-soft)]/30 transition focus:outline-none"
                              >
                                <span className="opacity-0 group-hover/hourcell:opacity-100 inline-flex h-6 w-6 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent-strong)] shadow-2xs transition">
                                  <Plus className="h-3.5 w-3.5" />
                                </span>
                              </button>
                            );
                          })}
                        </div>

                        {/* Faint Dashed Empty-Day Zone Indicator (No repeated text paragraphs!) */}
                        {isEmptyDay && (
                          <div className="pointer-events-none absolute inset-x-2 inset-y-4 rounded-2xl border border-dashed border-[var(--border-subtle)]/70 group-hover/daycol:border-[var(--accent-primary)]/50 transition" />
                        )}

                        {/* Glowing "Now" Indicator Line on Today's Column */}
                        {col.isToday && showNowLine && (
                          <div
                            style={{ top: `${nowLineTopPx}px` }}
                            className="pointer-events-none absolute inset-x-0 z-20 flex items-center"
                          >
                            <span className="h-2.5 w-2.5 rounded-full bg-[var(--accent-primary)] ring-4 ring-[var(--accent-glow)] shrink-0" />
                            <div className="h-[2px] flex-1 bg-[var(--accent-primary)] shadow-[0_0_8px_var(--accent-glow)]" />
                          </div>
                        )}

                        {/* Absolutely Positioned Class Blocks (Side-by-Side Column Packing + @container) */}
                        {packedSlots.map((slot) => {
                          const subj = subjects.find((s) => s.id === slot.subjectId);
                          const colorStyle = getSubjectColor(slot.customColor ?? subj?.color);
                          const isBeingDragged = dragState?.slotId === slot.id;
                          const displayStart = isBeingDragged
                            ? minutesToTime(dragState.currentStartMin)
                            : slot.startTime;
                          const displayEnd = isBeingDragged
                            ? minutesToTime(dragState.currentEndMin)
                            : slot.endTime;

                          const { topPx, heightPx, durationMinutes } =
                            computeTimetableBlockMetrics(
                              displayStart,
                              displayEnd,
                              startHour,
                              PIXELS_PER_HOUR,
                              40
                            );

                          const widthPct = 100 / Math.max(1, slot.totalCols);
                          const startPct = slot.colIndex * widthPct;
                          const hasCollision = slot.totalCols > 1;
                          const attendanceStatus = slot.attendanceByDate?.[col.dateStr];
                          const isSelectedBlock =
                            selectedSlotState?.slotId === slot.id &&
                            selectedSlotState?.dateStr === col.dateStr;
                          const isRecentlyImported = recentlyImportedSlotIds.includes(slot.id);

                          const fullRangeStr = formatRange(displayStart, displayEnd);
                          const compactStartStr = formatTime(displayStart);
                          const tooltipText = `${subj?.name ?? ''} · ${fullRangeStr}${
                            slot.room ? ` · ${slot.room}` : ''
                          }${slot.teacher ? ` · ${slot.teacher}` : ''}`;

                          return (
                            <div
                              key={`${slot.id}-${col.dateStr}`}
                              data-testid="timetable-class-block"
                              role="button"
                              tabIndex={0}
                              title={tooltipText}
                              aria-label={tooltipText}
                              style={{
                                top: `${topPx}px`,
                                height: `${heightPx}px`,
                                insetInlineStart: `calc(${startPct}% + 2px)`,
                                width: `calc(${widthPct}% - 4px)`,
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (dragState?.hasMoved) return;
                                setSelectedSlotState({
                                  slotId: slot.id,
                                  dateStr: col.dateStr,
                                  editScope: slot.specificDate ? 'occurrence' : 'series',
                                });
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  setSelectedSlotState({
                                    slotId: slot.id,
                                    dateStr: col.dateStr,
                                    editScope: slot.specificDate ? 'occurrence' : 'series',
                                  });
                                }
                              }}
                              onContextMenu={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setSelectedSlotState({
                                  slotId: slot.id,
                                  dateStr: col.dateStr,
                                  editScope: slot.specificDate ? 'occurrence' : 'series',
                                });
                              }}
                              onPointerDown={(e) => {
                                if (e.button !== 0) return;
                                e.stopPropagation();
                                if (e.pointerType === 'touch') {
                                  if (longPressTimerRef.current) {
                                    window.clearTimeout(longPressTimerRef.current);
                                  }
                                  longPressTimerRef.current = window.setTimeout(() => {
                                    setSelectedSlotState({
                                      slotId: slot.id,
                                      dateStr: col.dateStr,
                                      editScope: slot.specificDate ? 'occurrence' : 'series',
                                    });
                                  }, 500);
                                  return;
                                }
                                setDragState({
                                  slotId: slot.id,
                                  mode: 'move',
                                  initialPointerY: e.clientY,
                                  origStartMin: timeToMinutes(slot.startTime),
                                  origEndMin: timeToMinutes(slot.endTime),
                                  currentStartMin: timeToMinutes(slot.startTime),
                                  currentEndMin: timeToMinutes(slot.endTime),
                                  hasMoved: false,
                                });
                              }}
                              onPointerUp={() => {
                                if (longPressTimerRef.current) {
                                  window.clearTimeout(longPressTimerRef.current);
                                  longPressTimerRef.current = null;
                                }
                              }}
                              className={`waqti-slot-container group/block absolute z-10 rounded-[12px] border ${
                                colorStyle.softBg
                              } ${
                                isSelectedBlock
                                  ? 'border-[var(--accent-primary)] ring-2 ring-[var(--accent-primary)]/40 shadow-md z-30'
                                  : colorStyle.border
                              } ${
                                isRecentlyImported ? 'waqti-slot-highlight' : ''
                              } ps-2.5 pe-1.5 py-1.5 flex flex-col justify-between text-start cursor-pointer select-none transition-shadow hover:shadow-md overflow-hidden min-w-0`}
                            >
                              {/* Inline-Start Subject Color Bar */}
                              <span
                                aria-hidden="true"
                                className={`pointer-events-none absolute inset-y-0 start-0 w-1 ${colorStyle.dot}`}
                              />

                              {/* Live Drag/Resize Floating Time Pill */}
                              {isBeingDragged && dragState.hasMoved && (
                                <div
                                  dir="ltr"
                                  className="pointer-events-none absolute top-1 end-1 z-30 rounded-md bg-[var(--text-primary)] px-1.5 py-0.5 text-[10px] font-mono-tabular font-bold text-[var(--bg-surface)] whitespace-nowrap shadow-sm"
                                >
                                  {fullRangeStr}
                                </div>
                              )}

                              {/* Top Section: One-Line Time Range + Conflict/Attendance */}
                              <div className="min-w-0 overflow-hidden">
                                <div className="flex items-center justify-between gap-1 min-w-0">
                                  <div
                                    dir="ltr"
                                    data-testid="timetable-block-time"
                                    className="text-[10px] font-mono-tabular font-semibold text-[var(--text-secondary)] whitespace-nowrap leading-none truncate min-w-0"
                                  >
                                    <span className="waqti-slot-time-full">
                                      {fullRangeStr}
                                    </span>
                                    <span className="waqti-slot-time-compact">
                                      {compactStartStr}
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-0.5 shrink-0">
                                    {/* Inline Type Badge for short blocks (< 64px height) via container query */}
                                    <span className="waqti-slot-inline-badge items-center rounded px-1 py-0.2 text-[9px] font-extrabold uppercase tracking-tight bg-[var(--bg-surface)]/85 text-[var(--text-secondary)] border border-[var(--border-subtle)] leading-none">
                                      {t(`timetable.typeShort.${slot.type ?? 'lecture'}`)}
                                    </span>
                                    {hasCollision && (
                                      <span
                                        title={t('timetable.conflictBadge')}
                                        className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300"
                                      >
                                        <AlertTriangle className="h-2.5 w-2.5" />
                                      </span>
                                    )}
                                    {attendanceStatus === 'attended' && (
                                      <span
                                        title={t('timetable.attended')}
                                        className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300"
                                      >
                                        <Check className="h-2.5 w-2.5" />
                                      </span>
                                    )}
                                    {attendanceStatus === 'absent' && (
                                      <span
                                        title={t('timetable.absent')}
                                        className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-rose-500/20 text-rose-600 dark:text-rose-300"
                                      >
                                        <X className="h-2.5 w-2.5" />
                                      </span>
                                    )}
                                    {/* Hover "⋯" Action Trigger */}
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedSlotState({
                                          slotId: slot.id,
                                          dateStr: col.dateStr,
                                          editScope: slot.specificDate
                                            ? 'occurrence'
                                            : 'series',
                                        });
                                      }}
                                      aria-label={`${t('timetable.moreActions')} ${subj?.name ?? ''}`}
                                      className="opacity-0 group-hover/block:opacity-100 focus:opacity-100 inline-flex h-4 w-4 items-center justify-center rounded text-[var(--text-secondary)] hover:bg-[var(--bg-surface)]/80 hover:text-[var(--text-primary)] transition"
                                    >
                                      <MoreHorizontal className="h-3 w-3" />
                                    </button>
                                  </div>
                                </div>

                                {/* Subject Title: line-clamp-2, min-w-0, overflow-wrap:anywhere */}
                                <div
                                  data-testid="timetable-block-title"
                                  className={`mt-1 text-xs font-bold text-[var(--text-primary)] ${
                                    durationMinutes < 55 ? 'line-clamp-1' : 'line-clamp-2'
                                  } min-w-0 [overflow-wrap:anywhere] leading-tight ${
                                    attendanceStatus === 'absent' ? 'line-through opacity-65' : ''
                                  }`}
                                >
                                  {subj?.name}
                                </div>

                                {/* Dedicated Type + Mode + Group Badge Row (Only shown when block height >= 64px via @container) */}
                                <div className="waqti-slot-row-badges mt-1 min-w-0 overflow-hidden">
                                  <SessionMetaBadges
                                    lang={lang}
                                    type={slot.type}
                                    mode={slot.mode}
                                    section={slot.section}
                                    group={slot.group}
                                    compactForGrid
                                  />
                                </div>
                              </div>

                              {/* Bottom Metadata: Room & Teacher (Shown ONLY when container >= 126px wide and >= 82px tall) */}
                              <div className="waqti-slot-meta items-center gap-1 text-[10px] text-[var(--text-muted)] min-w-0 overflow-hidden pt-0.5">
                                  <span className="truncate min-w-0">
                                    {slot.mode === 'remote'
                                      ? t('timetable.mode.remote')
                                      : slot.room}
                                  </span>
                                  {slot.teacher && durationMinutes >= 75 && (
                                    <>
                                      <span aria-hidden="true" className="shrink-0">
                                        ·
                                      </span>
                                      <span className="truncate min-w-0">{slot.teacher}</span>
                                    </>
                                  )}
                                </div>

                              {/* Bottom-Edge Resize Handle (5-minute snapping) */}
                              <div
                                role="separator"
                                aria-orientation="horizontal"
                                onPointerDown={(e) => {
                                  if (e.button !== 0) return;
                                  e.stopPropagation();
                                  setDragState({
                                    slotId: slot.id,
                                    mode: 'resize',
                                    initialPointerY: e.clientY,
                                    origStartMin: timeToMinutes(slot.startTime),
                                    origEndMin: timeToMinutes(slot.endTime),
                                    currentStartMin: timeToMinutes(slot.startTime),
                                    currentEndMin: timeToMinutes(slot.endTime),
                                    hasMoved: false,
                                  });
                                }}
                                className="absolute inset-x-2 bottom-0 h-2 cursor-ns-resize flex items-center justify-center opacity-0 group-hover/block:opacity-100 transition"
                              >
                                <span className="h-0.5 w-6 rounded-full bg-[var(--text-muted)]/60" />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Subtle Footer Hint for Drag & Resize */}
          <div className="border-t border-[var(--border-subtle)] bg-[var(--bg-elevated)]/50 px-4 py-2 flex items-center justify-between text-[11px] text-[var(--text-muted)] no-print">
            <span className="truncate">{t('timetable.dragResizeHint')}</span>
            <span dir="ltr" className="font-mono-tabular shrink-0">
              {String(startHour).padStart(2, '0')}:00 – {String(endHour).padStart(2, '0')}:00
            </span>
          </div>
        </div>
      )}

      {/* ═══════════ 7. CLEAN LIST VIEW (Default on <768px Mobile) ═══════════ */}
      {viewMode === 'day' && (
        <div className="space-y-3 min-w-0">
          {(() => {
            const activeCol =
              weekDayColumns.find((c) => c.dayIndex === selectedDay) ?? weekDayColumns[0];
            const daySlots = getOccurrencesForDate(activeCol.dateStr, {
              timetable: filteredTimetable,
              subjects,
            }).classes.map((c) => c.slot);

            if (daySlots.length === 0) {
              return (
                <div className="rounded-3xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-surface)] p-8 text-center flex flex-col items-center justify-center gap-3">
                  <p className="text-xs text-[var(--text-muted)]">
                    {activeCol.fullLabel} ·{' '}
                    {formatLocalizedDate(activeCol.dateStr, lang, 'd MMM', digitsStyle)}
                  </p>
                  <button
                    type="button"
                    onClick={() => openAddSlotModal(activeCol.dayIndex, '09:00')}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-elevated)] px-3.5 py-2 text-xs font-semibold text-[var(--text-primary)] hover:border-[var(--accent-primary)] transition"
                  >
                    <Plus className="h-3.5 w-3.5 text-[var(--accent-strong)]" />
                    <span>{t('timetable.addSlot')}</span>
                  </button>
                </div>
              );
            }

            return daySlots.map((slot) => {
              const subj = subjects.find((s) => s.id === slot.subjectId);
              const colorStyle = getSubjectColor(slot.customColor ?? subj?.color);
              const conflicts = detectSlotOverlaps(slot, rawSlotsForDay(filteredTimetable, activeCol.dateStr, activeCol.dayIndex));
              const attendanceStatus = slot.attendanceByDate?.[activeCol.dateStr];

              return (
                <div
                  key={`${slot.id}-${activeCol.dateStr}`}
                  onClick={() =>
                    setSelectedSlotState({
                      slotId: slot.id,
                      dateStr: activeCol.dateStr,
                      editScope: slot.specificDate ? 'occurrence' : 'series',
                    })
                  }
                  className={`relative rounded-2xl border ${colorStyle.softBg} ${colorStyle.border} p-4 ps-5 flex items-center justify-between gap-4 cursor-pointer hover:shadow-sm transition overflow-hidden min-w-0`}
                >
                  <span
                    aria-hidden="true"
                    className={`absolute inset-y-0 start-0 w-1.5 ${colorStyle.dot}`}
                  />

                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        dir="ltr"
                        className="text-xs font-mono-tabular font-bold text-[var(--text-secondary)] whitespace-nowrap"
                      >
                        {formatRange(slot.startTime, slot.endTime)}
                      </span>
                      <SessionMetaBadges
                        lang={lang}
                        type={slot.type}
                        mode={slot.mode}
                        section={slot.section}
                        group={slot.group}
                        meetingUrl={slot.meetingUrl}
                        platform={slot.platform}
                        showJoinButton
                      />
                      {conflicts.length > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300">
                          <AlertTriangle className="h-3 w-3" />
                          <span>{t('timetable.conflictBadge')}</span>
                        </span>
                      )}
                      {attendanceStatus && (
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            attendanceStatus === 'attended'
                              ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                              : 'bg-rose-500/15 text-rose-600 dark:text-rose-300'
                          }`}
                        >
                          {attendanceStatus === 'attended'
                            ? t('timetable.attended')
                            : t('timetable.absent')}
                        </span>
                      )}
                    </div>

                    <h3
                      className={`text-sm font-bold text-[var(--text-primary)] line-clamp-2 [overflow-wrap:anywhere] ${
                        attendanceStatus === 'absent' ? 'line-through opacity-65' : ''
                      }`}
                    >
                      {subj?.name}
                    </h3>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--text-muted)]">
                      {slot.room && (
                        <span className="inline-flex items-center gap-1 truncate">
                          <MapPin className="h-3 w-3 shrink-0" />
                          <span>{slot.room}</span>
                        </span>
                      )}
                      {slot.teacher && (
                        <span className="inline-flex items-center gap-1 truncate">
                          <User className="h-3 w-3 shrink-0" />
                          <span>{slot.teacher}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedSlotState({
                        slotId: slot.id,
                        dateStr: activeCol.dateStr,
                        editScope: slot.specificDate ? 'occurrence' : 'series',
                      });
                    }}
                    aria-label={t('timetable.moreActions')}
                    className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)]/80 p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] shrink-0"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </button>
                </div>
              );
            });
          })()}
        </div>
      )}

      {/* ═══════════ 8. CLASS INSPECTOR POPOVER (Desktop) / BOTTOM SHEET (Mobile) ═══════════ */}
      {activePopoverSlot && selectedSlotState && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-xs p-0 sm:p-4 no-print"
          onClick={() => setSelectedSlotState(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            data-testid="timetable-slot-popover"
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl border border-[var(--border-strong)] bg-[var(--bg-surface)] p-5 sm:p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto"
          >
            {(() => {
              const subj = subjects.find((s) => s.id === activePopoverSlot.subjectId);
              const colorStyle = getSubjectColor(
                activePopoverSlot.customColor ?? subj?.color
              );
              const currentAttendance =
                activePopoverSlot.attendanceByDate?.[selectedSlotState.dateStr];
              const formattedDateLabel = formatLocalizedDate(
                selectedSlotState.dateStr,
                lang,
                'EEE d MMM',
                digitsStyle
              );
              const isRemoteOrHybrid =
                activePopoverSlot.mode === 'remote' || activePopoverSlot.mode === 'hybrid';
              const leadMins = isRemoteOrHybrid
                ? settings.defaultJoinLeadMinutes || 10
                : settings.defaultTravelLeadMinutes || 30;

              return (
                <>
                  {/* Popover Header: Subject Title + One-Line Time Range + Close */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <span
                        className={`mt-1 h-3.5 w-3.5 rounded-full shrink-0 ${colorStyle.dot}`}
                      />
                      <div className="min-w-0 space-y-1.5">
                        <h3 className="text-base font-bold text-[var(--text-primary)] [overflow-wrap:anywhere]">
                          {subj?.name}
                        </h3>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--text-secondary)]">
                          <span
                            dir="ltr"
                            className="font-mono-tabular font-bold text-[var(--accent-strong)] whitespace-nowrap"
                          >
                            {formatRange(
                              activePopoverSlot.startTime,
                              activePopoverSlot.endTime
                            )}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>{formattedDateLabel}</span>
                        </div>
                        <SessionMetaBadges
                          lang={lang}
                          type={activePopoverSlot.type}
                          mode={activePopoverSlot.mode}
                          section={activePopoverSlot.section}
                          group={activePopoverSlot.group}
                          meetingUrl={activePopoverSlot.meetingUrl}
                          platform={activePopoverSlot.platform}
                        />
                        {(activePopoverSlot.room || activePopoverSlot.teacher) && (
                          <p className="text-xs text-[var(--text-muted)]">
                            {[activePopoverSlot.room, activePopoverSlot.teacher]
                              .filter(Boolean)
                              .join(' · ')}
                          </p>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setSelectedSlotState(null)}
                      aria-label={t('common.close')}
                      className="rounded-xl p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)] shrink-0"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  {/* One-tap Join Online Button + Smart Leave/Join Reminder */}
                  <div className="flex flex-wrap items-center gap-2">
                    {isRemoteOrHybrid && activePopoverSlot.meetingUrl && (
                      <a
                        href={activePopoverSlot.meetingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-sky-500 hover:bg-sky-600 text-white px-3.5 py-2.5 text-xs font-bold shadow-xs transition whitespace-nowrap"
                      >
                        <Video className="h-4 w-4 shrink-0" />
                        <span>{t('timetable.joinClass')}</span>
                        <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        addAlarm({
                          title: `${subj?.name ?? 'Class'} — ${
                            isRemoteOrHybrid
                              ? t('timetable.joinClass')
                              : activePopoverSlot.room || ''
                          }`,
                          note: isRemoteOrHybrid
                            ? activePopoverSlot.meetingUrl || ''
                            : activePopoverSlot.room || '',
                          date: selectedSlotState.dateStr,
                          time: activePopoverSlot.startTime,
                          recurrence: 'weekly',
                          daysOfWeek: [activePopoverSlot.dayOfWeek],
                          linkedType: 'class',
                          linkedId: activePopoverSlot.id,
                          sound: settings.defaultAlarmSound,
                          vibrate: settings.alarmVibration,
                          snoozeMinutes: settings.defaultSnoozeMinutes,
                          leadMinutes: leadMins,
                          enabled: true,
                        });
                        onPushUndo('timetable.reminderCreated', () => {});
                      }}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] hover:border-[var(--accent-primary)] px-3 py-2.5 text-xs font-semibold text-[var(--text-primary)] transition whitespace-nowrap cursor-pointer"
                    >
                      <Bell className="h-3.5 w-3.5 text-[var(--accent-strong)] shrink-0" />
                      <span>
                        {t(
                          isRemoteOrHybrid
                            ? 'timetable.joinReminder'
                            : 'timetable.leaveReminder',
                          { minutes: leadMins }
                        )}
                      </span>
                    </button>
                  </div>

                  {/* Occurrence vs Whole Series Scope Toggle */}
                  {!activePopoverSlot.specificDate && (
                    <div className="space-y-1.5">
                      <label className="block text-[11px] font-semibold text-[var(--text-muted)]">
                        {t('timetable.editScope')}
                      </label>
                      <div className="grid grid-cols-2 gap-1.5 rounded-xl bg-[var(--bg-elevated)] p-1">
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedSlotState((prev) =>
                              prev ? { ...prev, editScope: 'series' } : null
                            )
                          }
                          className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition truncate ${
                            selectedSlotState.editScope === 'series'
                              ? 'bg-[var(--bg-surface)] text-[var(--accent-strong)] shadow-2xs'
                              : 'text-[var(--text-secondary)]'
                          }`}
                        >
                          {t('timetable.scopeSeries')}
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedSlotState((prev) =>
                              prev ? { ...prev, editScope: 'occurrence' } : null
                            )
                          }
                          className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition truncate ${
                            selectedSlotState.editScope === 'occurrence'
                              ? 'bg-[var(--bg-surface)] text-[var(--accent-strong)] shadow-2xs'
                              : 'text-[var(--text-secondary)]'
                          }`}
                        >
                          {t('timetable.scopeOccurrence', { date: formattedDateLabel })}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Live "Shift Time" Segmented Control (-30, -15, -5, +5, +15, +30 min) */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-[var(--text-muted)]">
                        {t('timetable.shiftTime')}
                      </span>
                      <span
                        dir="ltr"
                        className="text-xs font-mono-tabular font-bold text-[var(--text-primary)] whitespace-nowrap"
                      >
                        {formatRange(
                          activePopoverSlot.startTime,
                          activePopoverSlot.endTime
                        )}
                      </span>
                    </div>
                    <div className="grid grid-cols-6 gap-1.5">
                      {SHIFT_DELTAS.map((delta) => (
                        <button
                          key={delta}
                          type="button"
                          dir="ltr"
                          onClick={() =>
                            handleShiftSlotMinutes(
                              activePopoverSlot,
                              selectedSlotState.dateStr,
                              selectedSlotState.editScope,
                              delta
                            )
                          }
                          className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] py-2 px-1 text-center text-[11px] font-mono-tabular font-semibold text-[var(--text-primary)] hover:border-[var(--accent-primary)] hover:bg-[var(--accent-soft)] transition whitespace-nowrap"
                        >
                          {formatShiftPillLabel(delta, lang)}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Move to Another Day (7 Day Pills) */}
                  <div className="space-y-1.5">
                    <span className="block text-[11px] font-semibold text-[var(--text-muted)]">
                      {t('timetable.moveToDay')}
                    </span>
                    <div className="grid grid-cols-7 gap-1">
                      {weekDayColumns.map((col) => {
                        const isCurrentDay =
                          activePopoverSlot.dayOfWeek === col.dayIndex;
                        return (
                          <button
                            key={col.dayIndex}
                            type="button"
                            onClick={() =>
                              handleMoveSlotToDay(
                                activePopoverSlot,
                                selectedSlotState.dateStr,
                                selectedSlotState.editScope,
                                col.dayIndex
                              )
                            }
                            className={`rounded-xl py-1.5 px-1 text-center text-[11px] font-semibold transition truncate ${
                              isCurrentDay
                                ? 'btn-primary-waqti'
                                : 'border border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                            }`}
                          >
                            {col.shortLabel}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Mark as Attended / Absent */}
                  <div className="space-y-1.5">
                    <span className="block text-[11px] font-semibold text-[var(--text-muted)]">
                      {t('timetable.attendance')} ({formattedDateLabel})
                    </span>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          handleToggleAttendance(
                            activePopoverSlot,
                            selectedSlotState.dateStr,
                            'attended'
                          )
                        }
                        className={`inline-flex items-center justify-center gap-1.5 rounded-xl border py-2 px-2.5 text-xs font-semibold transition whitespace-nowrap ${
                          currentAttendance === 'attended'
                            ? 'border-emerald-500 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                            : 'border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-secondary)]'
                        }`}
                      >
                        <UserCheck className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{t('timetable.attended')}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          handleToggleAttendance(
                            activePopoverSlot,
                            selectedSlotState.dateStr,
                            'absent'
                          )
                        }
                        className={`inline-flex items-center justify-center gap-1.5 rounded-xl border py-2 px-2.5 text-xs font-semibold transition whitespace-nowrap ${
                          currentAttendance === 'absent'
                            ? 'border-rose-500 bg-rose-500/15 text-rose-600 dark:text-rose-300'
                            : 'border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-secondary)]'
                        }`}
                      >
                        <UserX className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{t('timetable.absent')}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          handleToggleAttendance(
                            activePopoverSlot,
                            selectedSlotState.dateStr,
                            'none'
                          )
                        }
                        className={`inline-flex items-center justify-center gap-1.5 rounded-xl border py-2 px-2.5 text-xs font-semibold transition whitespace-nowrap ${
                          !currentAttendance
                            ? 'border-[var(--accent-primary)] bg-[var(--accent-soft)] text-[var(--accent-strong)]'
                            : 'border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-secondary)]'
                        }`}
                      >
                        <span className="truncate">{t('timetable.clearAttendance')}</span>
                      </button>
                    </div>
                  </div>

                  {/* Primary Card Actions: Edit Details, Duplicate, Delete */}
                  <div className="pt-3 border-t border-[var(--border-subtle)] flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openEditSlotModal(activePopoverSlot)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3.5 py-2 text-xs font-semibold text-[var(--text-primary)] hover:border-[var(--accent-primary)] transition whitespace-nowrap"
                      >
                        <Edit3 className="h-3.5 w-3.5 text-[var(--accent-strong)]" />
                        <span>{t('timetable.editSlot')}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDuplicateSlot(activePopoverSlot)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3.5 py-2 text-xs font-semibold text-[var(--text-primary)] hover:border-[var(--accent-primary)] transition whitespace-nowrap"
                      >
                        <Copy className="h-3.5 w-3.5 text-[var(--accent-strong)]" />
                        <span>{t('timetable.duplicateSlot')}</span>
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDeleteSlot(activePopoverSlot)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3.5 py-2 text-xs font-semibold text-rose-600 dark:text-rose-300 hover:bg-rose-500/20 transition whitespace-nowrap"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>{t('common.delete')}</span>
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
};

function rawSlotsForDay(
  timetable: TimetableSlot[],
  dateStr: string,
  _dayIndex: WeekDay
): TimetableSlot[] {
  return getOccurrencesForDate(dateStr, { timetable }).classes.map((c) => c.slot);
}

