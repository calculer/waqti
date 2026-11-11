import React, { useState } from 'react';
import { Check, ClipboardPaste, Sparkles, X } from 'lucide-react';
import { useWaqtiStore } from '../store/useWaqtiStore';
import { useTranslation } from '../hooks/useTranslation';
import { Logo } from './WaqtiLogo';
import { ACCENT_THEMES, SUBJECT_COLOR_LIST, SUBJECT_COLORS } from '../lib/colors';
import type { Language, SubjectColorId } from '../types';

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({ isOpen, onClose }) => {
  const { t, lang } = useTranslation();
  const setLanguage = useWaqtiStore((s) => s.setLanguage);
  const updateSettings = useWaqtiStore((s) => s.updateSettings);
  const settings = useWaqtiStore((s) => s.settings);
  const subjects = useWaqtiStore((s) => s.subjects);
  const addSubject = useWaqtiStore((s) => s.addSubject);
  const loadDemoWorkspace = useWaqtiStore((s) => s.loadDemoWorkspace);
  const openSmartPaste = useWaqtiStore((s) => s.openSmartPaste);

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [newSubjName, setNewSubjName] = useState('');
  const [newSubjColor, setNewSubjColor] = useState<SubjectColorId>('honey');

  if (!isOpen) return null;

  const handleAddQuickSubject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubjName.trim()) return;
    addSubject({
      name: newSubjName.trim(),
      color: newSubjColor,
      icon: 'BookOpen',
      teacher: '',
      room: '',
      coefficient: 4,
      weeklyGoalHours: 5,
    });
    setNewSubjName('');
  };

  const accentLabelKeyMap: Record<string, string> = {
    honey: 'settings.accentHoney',
    sand: 'settings.accentSand',
    olive: 'settings.accentOlive',
    terracotta: 'settings.accentTerracotta',
    slate: 'settings.accentSlate',
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4"
      role="dialog"
      aria-modal="true"
      aria-label={t('onboarding.welcome')}
    >
      <div className="w-full max-w-xl rounded-3xl border border-[var(--border-strong)] bg-[var(--bg-surface)] p-6 md:p-8 shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Logo size={40} variant="icon" animateIntro />
            <div>
              <h2 className="text-lg font-bold font-display text-[var(--text-primary)]">
                {t('onboarding.welcome')}
              </h2>
              <p className="text-xs text-[var(--text-muted)]">{t('app.tagline')}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              updateSettings({ hasCompletedOnboarding: true });
              onClose();
            }}
            aria-label={t('common.cancel')}
            className="rounded-xl p-2 text-[var(--text-muted)] hover:bg-[var(--bg-elevated)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* 3-Step Indicator */}
        <div className="grid grid-cols-3 gap-2 mb-6">
          {([1, 2, 3] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStep(s)}
              className={`rounded-xl py-2 px-3 text-xs font-semibold text-start transition border ${
                step === s
                  ? 'border-[var(--accent-primary)] bg-[var(--accent-soft)] text-[var(--accent-primary)]'
                  : 'border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-muted)]'
              }`}
            >
              {t(`onboarding.step${s}`)}
            </button>
          ))}
        </div>

        {step === 1 && (
          <div className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-2">
                {t('settings.language')}
              </label>
              <div className="grid grid-cols-3 gap-3">
                {(
                  [
                    { code: 'ar', label: 'العربية' },
                    { code: 'fr', label: 'Français' },
                    { code: 'en', label: 'English' },
                  ] as { code: Language; label: string }[]
                ).map((item) => (
                  <button
                    key={item.code}
                    type="button"
                    onClick={() => setLanguage(item.code)}
                    className={`rounded-2xl border py-3.5 px-4 text-sm font-semibold transition flex items-center justify-between ${
                      lang === item.code
                        ? 'border-[var(--accent-primary)] bg-[var(--accent-soft)] text-[var(--accent-primary)]'
                        : 'border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-primary)]'
                    }`}
                  >
                    <span>{item.label}</span>
                    {lang === item.code && <Check className="h-4 w-4" />}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-2">
                {t('settings.accent')}
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {ACCENT_THEMES.map((ac) => (
                  <button
                    key={ac.id}
                    type="button"
                    onClick={() => updateSettings({ accent: ac.id })}
                    className={`flex items-center justify-center gap-2 rounded-xl border py-2.5 px-2 text-xs font-medium ${
                      settings.accent === ac.id
                        ? 'border-[var(--text-primary)] bg-[var(--bg-elevated)]'
                        : 'border-[var(--border-subtle)]'
                    }`}
                  >
                    <span
                      className="h-3.5 w-3.5 rounded-full shrink-0"
                      style={{ backgroundColor: ac.hex }}
                    />
                    <span className="truncate">{t(accentLabelKeyMap[ac.id] || ac.id)}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <form onSubmit={handleAddQuickSubject} className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                value={newSubjName}
                onChange={(e) => setNewSubjName(e.target.value)}
                placeholder={t('subjects.name')}
                className="flex-1 min-w-[160px] rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3.5 py-2.5 text-sm text-[var(--text-primary)]"
              />
              <div className="flex items-center gap-1.5">
                {SUBJECT_COLOR_LIST.slice(0, 6).map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setNewSubjColor(c)}
                    aria-label={c}
                    className={`h-6 w-6 rounded-full ${SUBJECT_COLORS[c].dot} ${
                      newSubjColor === c ? 'ring-2 ring-offset-2 ring-[var(--accent-primary)]' : 'opacity-60'
                    }`}
                  />
                ))}
              </div>
              <button
                type="submit"
                className="rounded-xl btn-primary-waqti px-4 py-2.5 text-xs font-semibold whitespace-nowrap"
              >
                + {t('subjects.add')}
              </button>
            </form>

            <div className="max-h-48 overflow-y-auto space-y-2">
              {subjects.map((subj) => (
                <div
                  key={subj.id}
                  className="flex items-center justify-between rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3.5 py-2.5 text-sm"
                >
                  <div className="flex items-center gap-2.5">
                    <span className={`h-3 w-3 rounded-full ${SUBJECT_COLORS[subj.color]?.dot ?? SUBJECT_COLORS.honey.dot}`} />
                    <span className="font-medium text-[var(--text-primary)]">{subj.name}</span>
                  </div>
                  <span className="text-xs text-[var(--text-muted)]">
                    {t('subjects.coefficient')}: {subj.coefficient}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                  {t('settings.timeFormat')}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(['24h', '12h'] as const).map((fmt) => (
                    <button
                      key={fmt}
                      type="button"
                      onClick={() => updateSettings({ timeFormat: fmt })}
                      className={`rounded-xl border py-2.5 text-xs font-semibold ${
                        settings.timeFormat === fmt
                          ? 'border-[var(--accent-primary)] bg-[var(--accent-soft)] text-[var(--accent-primary)]'
                          : 'border-[var(--border-subtle)] bg-[var(--bg-elevated)]'
                      }`}
                    >
                      {fmt}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                  {t('settings.digitsStyle')}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(
                    [
                      { id: 'western', label: '0-9' },
                      { id: 'arabic-indic', label: '٠-٩' },
                    ] as const
                  ).map((dg) => (
                    <button
                      key={dg.id}
                      type="button"
                      onClick={() => updateSettings({ digitsStyle: dg.id })}
                      className={`rounded-xl border py-2.5 text-xs font-semibold ${
                        settings.digitsStyle === dg.id
                          ? 'border-[var(--accent-primary)] bg-[var(--accent-soft)] text-[var(--accent-primary)]'
                          : 'border-[var(--border-subtle)] bg-[var(--bg-elevated)]'
                      }`}
                    >
                      {dg.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => {
                  updateSettings({ hasCompletedOnboarding: true });
                  onClose();
                  openSmartPaste();
                }}
                className="flex w-full items-center justify-center gap-2 rounded-2xl btn-primary-waqti py-3 px-4 text-xs font-semibold shadow-sm hover:opacity-95 transition"
              >
                <ClipboardPaste className="h-4 w-4" />
                <span>{t('smartPaste.button')}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  loadDemoWorkspace(lang);
                  onClose();
                }}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border border-[var(--accent-primary)] bg-[var(--accent-soft)] py-3 px-4 text-xs font-semibold text-[var(--accent-primary)] hover:opacity-90 transition"
              >
                <Sparkles className="h-4 w-4" />
                <span>{t('onboarding.useDemo')}</span>
              </button>
            </div>
          </div>
        )}

        <div className="mt-7 flex items-center justify-between border-t border-[var(--border-subtle)] pt-4">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => setStep((s) => (s - 1) as 1 | 2 | 3)}
              className="rounded-xl border border-[var(--border-subtle)] px-4 py-2.5 text-xs font-medium text-[var(--text-secondary)]"
            >
              {t('onboarding.back')}
            </button>
          ) : (
            <div />
          )}

          {step < 3 ? (
            <button
              type="button"
              onClick={() => setStep((s) => (s + 1) as 1 | 2 | 3)}
              className="rounded-xl btn-primary-waqti px-5 py-2.5 text-xs font-semibold"
            >
              {t('onboarding.next')}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                updateSettings({ hasCompletedOnboarding: true });
                onClose();
              }}
              className="rounded-xl btn-primary-waqti px-6 py-2.5 text-xs font-semibold"
            >
              {t('onboarding.finish')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
