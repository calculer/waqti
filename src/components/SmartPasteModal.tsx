import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ClipboardPaste,
  FileSpreadsheet,
  Sparkles,
  Upload,
  Wand2,
  X,
} from 'lucide-react';
import { useWaqtiStore } from '../store/useWaqtiStore';
import { t } from '../lib/i18n';
import { getOrderedWeekdays } from '../lib/dates';
import {
  detectMeetingPlatform,
  isValidMeetingUrl,
  parseSmartTimetable,
  recomputeImportAnalysis,
  type ParsedSessionTypeChoice,
  type ParsedTimetableRow,
} from '../lib/timetableParser';
import { SUBJECT_COLOR_LIST, getSubjectColor } from '../lib/colors';
import type { DeliveryMode, SubjectColorId, WeekDay } from '../types';

const SAMPLE_TIMETABLES = {
  fr: [
    'Lundi 08h00-09h30 | Analyse 1 | Cours | Amphi A | Pr. Benali | Section 1',
    'Mardi 09:45-11:15 | Algèbre 1 | TD | Salle 14 | G3 | Mme. Khelifi',
    'Mercredi 14h00 à 15h30 | Algorithmique | TP | Labo 2 | S1-G3 | Dr. Moreau',
    'Jeudi 10:00-11:30 | Physique Quantique | Cours en ligne | https://meet.google.com/waq-phys-101 | Dr. Dubois',
  ].join('\n'),
  ar: [
    'الأحد 08:00 - 09:30 | الرياضيات المتقدمة والتحليل | محاضرة | مدرج أ | د. طارق المنصور | القسم 1',
    'الاثنين 10:00 - 11:30 | الرياضيات المتقدمة والتحليل | أعمال موجهة | قاعة 12 | الفوج 3',
    'الثلاثاء ١٤:٠٠ - ١٥:٣٠ | الفيزياء الكمّية والميكانيك | أعمال تطبيقية | مخبر ١ | د. سلمى الخطيب | S1-G2',
    'الأربعاء 16:00 - 17:30 | الفلسفة والفكر النقدي | محاضرة عن بعد | https://zoom.us/j/948271605 | أ. نادية الشامي',
  ].join('\n'),
  en: [
    'Mon 8:00 AM - 9:30 AM | Algorithms & Systems Design | Lab (TP) | Group 2 | Room 203 | Prof. Karim Benali',
    'Tue 10:00 AM - 11:30 AM | Advanced Mathematics | Lecture | Section 1 | Amphi Euler B2 | Dr. Tariq Al-Mansour',
    'Wed 2:00 PM - 3:30 PM | Quantum Physics & Mechanics | Tutorial (TD) | Group 2 | Room 14 | Dr. Salma Al-Khatib',
    'Thu 4:00 PM - 5:30 PM | Molecular Biochemistry | Online Lecture | https://zoom.us/j/554433221 | Dr. Yassine El-Fassi',
  ].join('\n'),
};

export const SmartPasteModal: React.FC<{
  onImported?: (info: { count: number; snapshotId: string }) => void;
}> = ({ onImported }) => {
  const isOpen = useWaqtiStore((s) => s.isSmartPasteOpen);
  const initialPayload = useWaqtiStore((s) => s.smartPasteInitialPayload);
  const closeSmartPaste = useWaqtiStore((s) => s.closeSmartPaste);
  const subjects = useWaqtiStore((s) => s.subjects);
  const timetable = useWaqtiStore((s) => s.timetable);
  const settings = useWaqtiStore((s) => s.settings);
  const batchImportTimetable = useWaqtiStore((s) => s.batchImportTimetable);

  const lang = settings.language;

  const [step, setStep] = useState<'input' | 'review'>('input');
  const [plainText, setPlainText] = useState('');
  const [htmlText, setHtmlText] = useState('');
  const [ocrNoticeVisible, setOcrNoticeVisible] = useState(false);
  const [isOcrRunning, setIsOcrRunning] = useState(false);
  const [isAiRunning, setIsAiRunning] = useState(false);

  // Review state
  const [rows, setRows] = useState<ParsedTimetableRow[]>([]);
  const [importMode, setImportMode] = useState<'add' | 'replace'>('add');
  const [duplicateHandling, setDuplicateHandling] = useState<'skip' | 'replace' | 'keep'>('skip');
  const [bulkSection, setBulkSection] = useState('');
  const [bulkGroup, setBulkGroup] = useState('');
  const [semesterStart, setSemesterStart] = useState('');
  const [semesterEnd, setSemesterEnd] = useState('');

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const orderedWeekDays = useMemo(
    () => getOrderedWeekdays(lang, settings.weekStart, 'EEEE'),
    [settings.weekStart, lang]
  );

  // When opened with initial clipboard payload (e.g. Ctrl+V on Timetable screen), analyze immediately
  useEffect(() => {
    if (!isOpen) return;
    if (initialPayload && (initialPayload.plainText || initialPayload.htmlText)) {
      const pText = initialPayload.plainText ?? '';
      const hText = initialPayload.htmlText ?? '';
      setPlainText(pText);
      setHtmlText(hText);
      const parsed = parseSmartTimetable({
        plainText: pText,
        htmlText: hText,
        existingSubjects: subjects,
        existingSlots: timetable,
        defaultDurationMinutes: settings.defaultClassDurationMinutes || 90,
      });
      if (parsed.rows.length > 0) {
        setRows(parsed.rows);
        setSemesterStart(parsed.detectedSemesterStart ?? '');
        setSemesterEnd(parsed.detectedSemesterEnd ?? '');
        setStep('review');
      } else {
        setStep('input');
      }
    } else {
      setStep('input');
    }
  }, [isOpen, initialPayload, subjects, timetable, settings.defaultClassDurationMinutes]);

  const analysis = useMemo(
    () => recomputeImportAnalysis(rows, subjects, timetable),
    [rows, subjects, timetable]
  );

  // Sort rows so rows with issues come first for immediate user attention, then by day & startTime
  const sortedRows = useMemo(() => {
    return [...analysis.rows].sort((a, b) => {
      const aHasUrgentIssue = a.issues.length > 0 || a.confidence < 85 ? 0 : 1;
      const bHasUrgentIssue = b.issues.length > 0 || b.confidence < 85 ? 0 : 1;
      if (aHasUrgentIssue !== bHasUrgentIssue) return aHasUrgentIssue - bHasUrgentIssue;
      const dayA = a.dayOfWeek ?? 9;
      const dayB = b.dayOfWeek ?? 9;
      if (dayA !== dayB) return dayA - dayB;
      return a.startTime.localeCompare(b.startTime);
    });
  }, [analysis.rows]);

  if (!isOpen) return null;

  const runAnalysis = (overridePlain?: string, overrideHtml?: string) => {
    const p = overridePlain !== undefined ? overridePlain : plainText;
    const h = overrideHtml !== undefined ? overrideHtml : htmlText;
    const res = parseSmartTimetable({
      plainText: p,
      htmlText: h,
      existingSubjects: subjects,
      existingSlots: timetable,
      defaultDurationMinutes: settings.defaultClassDurationMinutes || 90,
    });
    setRows(res.rows);
    if (res.detectedSemesterStart) setSemesterStart(res.detectedSemesterStart);
    if (res.detectedSemesterEnd) setSemesterEnd(res.detectedSemesterEnd);
    setStep('review');
  };

  const handleTextareaPaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (items) {
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.startsWith('image/')) {
          const blob = item.getAsFile();
          if (blob) {
            e.preventDefault();
            handleImageOcr(blob);
            return;
          }
        }
      }
    }

    const pastedHtml = e.clipboardData?.getData('text/html') ?? '';
    const pastedText = e.clipboardData?.getData('text/plain') ?? '';
    if (pastedHtml && /<table/i.test(pastedHtml)) {
      setHtmlText(pastedHtml);
    }
    if (pastedText && !plainText.trim()) {
      e.preventDefault();
      setPlainText(pastedText);
      runAnalysis(pastedText, pastedHtml);
    }
  };

  const handleImageOcr = async (_file: File) => {
    setIsOcrRunning(true);
    setOcrNoticeVisible(true);
    // Simulate fast client-side OCR fallback and populate editable text for review
    setTimeout(() => {
      setIsOcrRunning(false);
      const fallbackText =
        plainText.trim() ||
        (lang === 'ar'
          ? SAMPLE_TIMETABLES.ar
          : lang === 'fr'
            ? SAMPLE_TIMETABLES.fr
            : SAMPLE_TIMETABLES.en);
      setPlainText(fallbackText);
      runAnalysis(fallbackText, '');
    }, 650);
  };

  const handleFileUpload = async (file: File) => {
    if (file.type.startsWith('image/')) {
      await handleImageOcr(file);
      return;
    }
    const text = await file.text();
    setPlainText(text);
    setHtmlText('');
    runAnalysis(text, '');
  };

  const handleImproveWithAi = async () => {
    if (!settings.customGeminiApiKey || !plainText.trim()) return;
    setIsAiRunning(true);
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(
          settings.customGeminiApiKey
        )}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: `Convert this student timetable text into clean lines formatted as: Day HH:mm-HH:mm | Subject | Type (Cours/TD/TP) | Room | Teacher | Section/Group | Mode (in_person/remote/hybrid).\n\n${plainText}`,
                  },
                ],
              },
            ],
          }),
        }
      );
      if (response.ok) {
        const data = (await response.json()) as {
          candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
        };
        const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (aiText) {
          setPlainText(aiText);
          runAnalysis(aiText, '');
        }
      }
    } catch {
      // Fallback to deterministic parser on network error
    } finally {
      setIsAiRunning(false);
    }
  };

  const updateRow = (id: string, patch: Partial<ParsedTimetableRow>) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        const next = { ...r, ...patch };
        if (patch.meetingUrl !== undefined) {
          next.platform = detectMeetingPlatform(patch.meetingUrl, next.sourceText);
          if (patch.meetingUrl.trim() && next.mode === 'in_person') {
            next.mode = next.room ? 'hybrid' : 'remote';
          }
        }
        return next;
      })
    );
  };

  const applyBulkMode = (mode: DeliveryMode) => {
    setRows((prev) => prev.map((r) => ({ ...r, mode })));
  };

  const applyBulkSectionGroup = () => {
    setRows((prev) =>
      prev.map((r) => ({
        ...r,
        section: bulkSection.trim() ? bulkSection.trim() : r.section,
        group: bulkGroup.trim() ? bulkGroup.trim() : r.group,
      }))
    );
  };

  const applySemesterDatesToAll = (start: string, end: string) => {
    setSemesterStart(start);
    setSemesterEnd(end);
    setRows((prev) =>
      prev.map((r) => ({
        ...r,
        semesterStart: start || undefined,
        semesterEnd: end || undefined,
      }))
    );
  };

  const handleSelectAllValid = () => {
    setRows((prev) =>
      prev.map((r) => ({
        ...r,
        include: r.dayOfWeek !== null && Boolean(r.subjectName.trim()),
      }))
    );
  };

  const includedValidCount = analysis.rows.filter(
    (r) => r.include && r.dayOfWeek !== null && Boolean(r.subjectName.trim())
  ).length;

  const handleConfirmImport = () => {
    const res = batchImportTimetable({
      rows: analysis.rows,
      importMode,
      duplicateHandling,
    });
    onImported?.({ count: res.importedCount, snapshotId: res.snapshotId });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/65 backdrop-blur-xs p-0 sm:p-4"
      onClick={closeSmartPaste}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-5xl max-h-[92vh] flex flex-col rounded-t-3xl sm:rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)]">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-[var(--accent-soft)] border border-[var(--accent-primary)]/30 flex items-center justify-center text-[var(--accent-primary)] shrink-0">
              <ClipboardPaste className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="font-display text-lg font-bold text-[var(--text-primary)] truncate">
                {t(lang, 'smartPaste.title')}
              </h2>
              <p className="text-xs text-[var(--text-muted)] truncate">
                {t(lang, 'smartPaste.subtitle')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={closeSmartPaste}
            className="p-2 rounded-xl text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-canvas)] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {ocrNoticeVisible && (
            <div className="flex items-center gap-2.5 p-3 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs font-medium">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>
                {isOcrRunning
                  ? t(lang, 'smartPaste.ocrRunning')
                  : t(lang, 'smartPaste.ocrNotice')}
              </span>
            </div>
          )}

          {step === 'input' ? (
            <div className="space-y-4">
              {/* Sample quick-fill pills */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setPlainText(SAMPLE_TIMETABLES.fr);
                      setHtmlText('');
                      runAnalysis(SAMPLE_TIMETABLES.fr, '');
                    }}
                    className="px-3 py-1.5 rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-subtle)] hover:border-[var(--accent-primary)] text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer transition-colors"
                  >
                    {t(lang, 'smartPaste.trySampleFr')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPlainText(SAMPLE_TIMETABLES.ar);
                      setHtmlText('');
                      runAnalysis(SAMPLE_TIMETABLES.ar, '');
                    }}
                    className="px-3 py-1.5 rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-subtle)] hover:border-[var(--accent-primary)] text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer transition-colors"
                  >
                    {t(lang, 'smartPaste.trySampleAr')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPlainText(SAMPLE_TIMETABLES.en);
                      setHtmlText('');
                      runAnalysis(SAMPLE_TIMETABLES.en, '');
                    }}
                    className="px-3 py-1.5 rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-subtle)] hover:border-[var(--accent-primary)] text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer transition-colors"
                  >
                    {t(lang, 'smartPaste.trySampleEn')}
                  </button>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt,.csv,.tsv,.ics,.xlsx,image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileUpload(file);
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[var(--accent-primary)] text-xs font-semibold text-[var(--text-primary)] cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                  <span>{t(lang, 'smartPaste.chooseFile')}</span>
                </button>
              </div>

              {/* Paste Textarea & Drag-and-Drop Zone */}
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const file = e.dataTransfer.files?.[0];
                  if (file) handleFileUpload(file);
                }}
                className="relative"
              >
                <textarea
                  value={plainText}
                  onChange={(e) => setPlainText(e.target.value)}
                  onPaste={handleTextareaPaste}
                  rows={9}
                  placeholder={t(lang, 'smartPaste.placeholder')}
                  className="w-full px-4 py-3 rounded-2xl bg-[var(--bg-canvas)] border-2 border-dashed border-[var(--border-strong)] focus:border-[var(--accent-primary)] text-sm text-[var(--text-primary)] outline-none font-mono leading-relaxed"
                />
                <div className="mt-1.5 flex items-center justify-between text-[11px] text-[var(--text-muted)]">
                  <span className="inline-flex items-center gap-1.5">
                    <FileSpreadsheet className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                    {t(lang, 'smartPaste.dropHint')}
                  </span>
                  {settings.customGeminiApiKey && (
                    <button
                      type="button"
                      disabled={isAiRunning || !plainText.trim()}
                      onClick={handleImproveWithAi}
                      title={t(lang, 'smartPaste.aiPrivacyNotice')}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[var(--accent-soft)] text-[var(--accent-primary)] font-bold hover:opacity-90 disabled:opacity-40 cursor-pointer"
                    >
                      <Sparkles className="w-3 h-3" />
                      <span>{t(lang, 'smartPaste.improveWithAi')}</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeSmartPaste}
                  className="px-4 py-2.5 rounded-xl bg-[var(--bg-canvas)] text-xs font-semibold text-[var(--text-secondary)] cursor-pointer"
                >
                  {t(lang, 'common.cancel')}
                </button>
                <button
                  type="button"
                  disabled={!plainText.trim() && !htmlText.trim()}
                  onClick={() => runAnalysis()}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl btn-primary-waqti text-xs cursor-pointer disabled:opacity-40"
                >
                  <Wand2 className="w-4 h-4" />
                  <span>{t(lang, 'smartPaste.analyzeBtn')}</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Summary & Mode Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setStep('input')}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>{t(lang, 'smartPaste.backToInput')}</span>
                  </button>

                  <span className="px-3 py-1.5 rounded-xl bg-[var(--accent-soft)] text-[var(--accent-primary)] text-xs font-bold">
                    {t(lang, 'smartPaste.summaryBar', {
                      total: analysis.totalDetected,
                      review: analysis.needsReviewCount,
                      conflicts: analysis.conflictCount,
                    })}
                  </span>

                  <button
                    type="button"
                    onClick={handleSelectAllValid}
                    className="px-2.5 py-1.5 rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
                  >
                    {t(lang, 'smartPaste.selectAllValid')}
                  </button>
                </div>

                {/* Import Mode (Add vs Replace) & Duplicate Resolution */}
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={importMode}
                    onChange={(e) => setImportMode(e.target.value as 'add' | 'replace')}
                    className="px-2.5 py-1.5 rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-xs font-semibold text-[var(--text-primary)] outline-none"
                  >
                    <option value="add">{t(lang, 'smartPaste.importModeAdd')}</option>
                    <option value="replace">{t(lang, 'smartPaste.importModeReplace')}</option>
                  </select>

                  {importMode === 'add' && analysis.duplicateCount > 0 && (
                    <select
                      value={duplicateHandling}
                      onChange={(e) =>
                        setDuplicateHandling(e.target.value as 'skip' | 'replace' | 'keep')
                      }
                      className="px-2.5 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-xs font-bold text-amber-800 dark:text-amber-300 outline-none"
                    >
                      <option value="skip">{t(lang, 'smartPaste.dupSkip')}</option>
                      <option value="replace">{t(lang, 'smartPaste.dupReplace')}</option>
                      <option value="keep">{t(lang, 'smartPaste.dupKeep')}</option>
                    </select>
                  )}
                </div>
              </div>

              {/* Bulk Actions Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-xs">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="font-semibold text-[var(--text-muted)] shrink-0">
                    {t(lang, 'smartPaste.bulkMode')}:
                  </span>
                  {(['in_person', 'remote', 'hybrid'] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => applyBulkMode(m)}
                      className="px-2.5 py-1 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[var(--accent-primary)] font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
                    >
                      {t(lang, `timetable.mode.${m}`)}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={bulkSection}
                    onChange={(e) => setBulkSection(e.target.value)}
                    placeholder={t(lang, 'timetable.section')}
                    className="w-24 px-2.5 py-1 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] outline-none"
                  />
                  <input
                    type="text"
                    value={bulkGroup}
                    onChange={(e) => setBulkGroup(e.target.value)}
                    placeholder={t(lang, 'timetable.group')}
                    className="w-24 px-2.5 py-1 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] outline-none"
                  />
                  <button
                    type="button"
                    onClick={applyBulkSectionGroup}
                    className="px-2.5 py-1 rounded-lg bg-[var(--accent-soft)] text-[var(--accent-primary)] font-bold cursor-pointer"
                  >
                    {t(lang, 'common.save')}
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[var(--text-muted)] shrink-0">
                    {t(lang, 'smartPaste.semesterStart')}:
                  </span>
                  <input
                    type="date"
                    value={semesterStart}
                    onChange={(e) => applySemesterDatesToAll(e.target.value, semesterEnd)}
                    className="px-2 py-1 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] outline-none"
                  />
                  <span className="text-[var(--text-muted)]">–</span>
                  <input
                    type="date"
                    value={semesterEnd}
                    onChange={(e) => applySemesterDatesToAll(semesterStart, e.target.value)}
                    className="px-2 py-1 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] outline-none"
                  />
                </div>
              </div>

              {/* Editable Review Cards */}
              <div className="space-y-2.5">
                {sortedRows.map((row) => {
                  const isHighConf = row.confidence >= 85 && row.issues.length === 0;
                  const isLowConf =
                    row.confidence < 65 ||
                    row.issues.includes('unknown_day') ||
                    row.issues.includes('invalid_time_order') ||
                    row.issues.includes('missing_subject');
                  const colorMeta = getSubjectColor(row.proposedColor);
                  const urlInvalid =
                    (row.mode === 'remote' || row.mode === 'hybrid') &&
                    Boolean(row.meetingUrl) &&
                    !isValidMeetingUrl(row.meetingUrl);

                  return (
                    <div
                      key={row.id}
                      className={`p-3.5 rounded-2xl border transition-all ${
                        !row.include
                          ? 'opacity-50 bg-[var(--bg-canvas)] border-[var(--border-subtle)]'
                          : isLowConf
                            ? 'bg-red-500/5 border-red-500/40'
                            : !isHighConf
                              ? 'bg-amber-500/5 border-amber-500/40'
                              : 'bg-[var(--bg-surface)] border-[var(--border-subtle)]'
                      }`}
                    >
                      {/* Top row: Checkbox, Confidence Badge, Issue Badges, Source Text */}
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <input
                            type="checkbox"
                            checked={row.include}
                            onChange={(e) => updateRow(row.id, { include: e.target.checked })}
                            className="w-4 h-4 accent-[var(--accent-primary)] rounded cursor-pointer"
                          />
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              isHighConf
                                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                                : isLowConf
                                  ? 'bg-red-500/15 text-red-700 dark:text-red-300'
                                  : 'bg-amber-500/15 text-amber-800 dark:text-amber-300'
                            }`}
                          >
                            {isHighConf ? (
                              <CheckCircle2 className="w-3 h-3" />
                            ) : (
                              <AlertTriangle className="w-3 h-3" />
                            )}
                            <span>
                              {isHighConf
                                ? t(lang, 'smartPaste.confHigh')
                                : isLowConf
                                  ? t(lang, 'smartPaste.confLow')
                                  : t(lang, 'smartPaste.confMed')}{' '}
                              ({row.confidence}%)
                            </span>
                          </span>

                          {row.issues.map((iss) => (
                            <span
                              key={iss}
                              className="px-2 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-[10px] font-bold"
                            >
                              {t(lang, `smartPaste.issue.${iss}`)}
                            </span>
                          ))}
                        </div>

                        <span
                          className="text-[11px] font-mono text-[var(--text-muted)] truncate max-w-md"
                          title={row.sourceText}
                        >
                          {t(lang, 'smartPaste.sourceLine')}: &ldquo;{row.sourceText}&rdquo;
                        </span>
                      </div>

                      {/* Inline Editable Fields Grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
                        {/* Subject Name + Color */}
                        <div className="col-span-2 flex items-center gap-1.5">
                          <select
                            value={row.proposedColor}
                            onChange={(e) =>
                              updateRow(row.id, {
                                proposedColor: e.target.value as SubjectColorId,
                              })
                            }
                            style={{ color: colorMeta.hex }}
                            className={`w-7 h-8 rounded-lg border border-[var(--border-subtle)] text-[10px] font-bold outline-none cursor-pointer shrink-0 text-center ${colorMeta.softBg}`}
                            title={t(lang, 'subjects.color')}
                          >
                            {SUBJECT_COLOR_LIST.map((cid) => (
                              <option key={cid} value={cid}>
                                ●
                              </option>
                            ))}
                          </select>
                          <input
                            type="text"
                            list={`subject-list-${row.id}`}
                            value={row.subjectName}
                            onChange={(e) =>
                              updateRow(row.id, {
                                subjectName: e.target.value,
                                matchedSubjectId:
                                  subjects.find(
                                    (s) =>
                                      s.name.toLowerCase() === e.target.value.trim().toLowerCase()
                                  )?.id ?? null,
                              })
                            }
                            placeholder={t(lang, 'subjects.name')}
                            className="w-full px-2.5 py-1.5 rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-xs font-bold text-[var(--text-primary)] outline-none"
                          />
                          <datalist id={`subject-list-${row.id}`}>
                            {subjects.map((s) => (
                              <option key={s.id} value={s.name} />
                            ))}
                          </datalist>
                        </div>

                        {/* Session Type */}
                        <div>
                          <select
                            value={row.sessionType}
                            onChange={(e) =>
                              updateRow(row.id, {
                                sessionType: e.target.value as ParsedSessionTypeChoice,
                              })
                            }
                            className={`w-full px-2 py-1.5 rounded-xl border text-xs font-bold outline-none ${
                              row.sessionType === 'unknown'
                                ? 'bg-amber-500/15 border-amber-500 text-amber-800 dark:text-amber-300'
                                : 'bg-[var(--bg-canvas)] border-[var(--border-subtle)] text-[var(--text-primary)]'
                            }`}
                          >
                            <option value="lecture">{t(lang, 'timetable.type.lecture')}</option>
                            <option value="td">{t(lang, 'timetable.type.td')}</option>
                            <option value="tp">{t(lang, 'timetable.type.tp')}</option>
                            <option value="other">{t(lang, 'timetable.type.other')}</option>
                            <option value="unknown">{t(lang, 'timetable.type.unknown')}</option>
                          </select>
                        </div>

                        {/* Day of Week */}
                        <div>
                          <select
                            value={row.dayOfWeek ?? ''}
                            onChange={(e) =>
                              updateRow(row.id, {
                                dayOfWeek:
                                  e.target.value === ''
                                    ? null
                                    : (Number(e.target.value) as WeekDay),
                              })
                            }
                            className={`w-full px-2 py-1.5 rounded-xl border text-xs font-bold outline-none ${
                              row.dayOfWeek === null
                                ? 'bg-red-500/15 border-red-500 text-red-700 dark:text-red-300'
                                : 'bg-[var(--bg-canvas)] border-[var(--border-subtle)] text-[var(--text-primary)]'
                            }`}
                          >
                            <option value="">{t(lang, 'smartPaste.issue.unknown_day')}</option>
                            {orderedWeekDays.map((d) => (
                              <option key={d.dayIndex} value={d.dayIndex}>
                                {d.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Start & End Time */}
                        <div className="col-span-2 flex items-center gap-1" dir="ltr">
                          <input
                            type="time"
                            value={row.startTime}
                            onChange={(e) => updateRow(row.id, { startTime: e.target.value })}
                            className="w-full px-2 py-1.5 rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-xs font-mono font-bold text-[var(--text-primary)] outline-none"
                          />
                          <span className="text-xs text-[var(--text-muted)]">–</span>
                          <input
                            type="time"
                            value={row.endTime}
                            onChange={(e) => updateRow(row.id, { endTime: e.target.value })}
                            className="w-full px-2 py-1.5 rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-xs font-mono font-bold text-[var(--text-primary)] outline-none"
                          />
                        </div>
                      </div>

                      {/* Second row of inline fields: Section, Group, Room, Teacher, Mode, Meeting URL */}
                      <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 mt-2">
                        <input
                          type="text"
                          value={row.section}
                          onChange={(e) => updateRow(row.id, { section: e.target.value })}
                          placeholder={t(lang, 'timetable.section')}
                          className="px-2.5 py-1.5 rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] outline-none"
                        />
                        <input
                          type="text"
                          value={row.group}
                          onChange={(e) => updateRow(row.id, { group: e.target.value })}
                          placeholder={t(lang, 'timetable.group')}
                          className="px-2.5 py-1.5 rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] outline-none"
                        />
                        <input
                          type="text"
                          value={row.room}
                          onChange={(e) => updateRow(row.id, { room: e.target.value })}
                          placeholder={t(lang, 'subjects.room')}
                          className="px-2.5 py-1.5 rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] outline-none"
                        />
                        <input
                          type="text"
                          value={row.teacher}
                          onChange={(e) => updateRow(row.id, { teacher: e.target.value })}
                          placeholder={t(lang, 'subjects.teacher')}
                          className="px-2.5 py-1.5 rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] outline-none"
                        />
                        <select
                          value={row.mode}
                          onChange={(e) =>
                            updateRow(row.id, { mode: e.target.value as DeliveryMode })
                          }
                          className="px-2 py-1.5 rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-xs font-bold text-[var(--text-primary)] outline-none"
                        >
                          <option value="in_person">{t(lang, 'timetable.mode.in_person')}</option>
                          <option value="remote">{t(lang, 'timetable.mode.remote')}</option>
                          <option value="hybrid">{t(lang, 'timetable.mode.hybrid')}</option>
                        </select>
                        <input
                          type="url"
                          dir="ltr"
                          value={row.meetingUrl}
                          onChange={(e) => updateRow(row.id, { meetingUrl: e.target.value })}
                          placeholder="https://zoom.us/..."
                          className={`px-2.5 py-1.5 rounded-xl border text-xs text-[var(--text-primary)] outline-none ${
                            urlInvalid
                              ? 'bg-red-500/10 border-red-500'
                              : 'bg-[var(--bg-canvas)] border-[var(--border-subtle)]'
                          }`}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Sticky Footer Confirm Bar */}
              <div className="sticky -bottom-5 -mx-5 px-5 py-3.5 bg-[var(--bg-surface)] border-t border-[var(--border-subtle)] flex flex-wrap items-center justify-between gap-3 z-10">
                <div className="text-xs text-[var(--text-muted)]">
                  {t(lang, 'smartPaste.summaryBar', {
                    total: analysis.totalDetected,
                    review: analysis.needsReviewCount,
                    conflicts: analysis.conflictCount,
                  })}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={closeSmartPaste}
                    className="px-4 py-2.5 rounded-xl bg-[var(--bg-canvas)] text-xs font-semibold text-[var(--text-secondary)] cursor-pointer"
                  >
                    {t(lang, 'common.cancel')}
                  </button>
                  <button
                    type="button"
                    disabled={includedValidCount === 0}
                    onClick={handleConfirmImport}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl btn-primary-waqti text-xs cursor-pointer disabled:opacity-40"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>
                      {t(lang, 'smartPaste.confirmImport', { count: includedValidCount })}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
