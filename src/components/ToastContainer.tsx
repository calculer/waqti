import React, { useEffect, useState } from 'react';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X, RotateCcw } from 'lucide-react';
import type { ToastItem } from '../types';
import { useTranslation } from '../hooks/useTranslation';
import {
  computeToastProgressPercent,
  computeToastRemainingMs,
} from '../lib/toastTimer';

interface ToastContainerProps {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
  onPause: (id: string, nowMs: number) => void;
  onResume: (id: string, nowMs: number) => void;
  closeAriaLabel?: string;
}

const SingleToast: React.FC<{
  toast: ToastItem;
  onDismiss: (id: string) => void;
  onPause: (id: string, nowMs: number) => void;
  onResume: (id: string, nowMs: number) => void;
  closeAriaLabel: string;
  defaultUndoLabel: string;
}> = ({ toast, onDismiss, onPause, onResume, closeAriaLabel, defaultUndoLabel }) => {
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    const raf = window.requestAnimationFrame(() => setEntered(true));
    return () => window.cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    if (toast.paused) return;
    const remaining = computeToastRemainingMs(toast, Date.now());
    if (remaining <= 0) {
      onDismiss(toast.id);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      onDismiss(toast.id);
    }, remaining);

    const intervalId = window.setInterval(() => {
      const current = Date.now();
      setNowMs(current);
      if (computeToastRemainingMs(toast, current) <= 0) {
        onDismiss(toast.id);
      }
    }, 60);

    return () => {
      window.clearTimeout(timeoutId);
      window.clearInterval(intervalId);
    };
  }, [toast, onDismiss]);

  const progressPct = computeToastProgressPercent(toast, nowMs);
  const undoFn = toast.onUndo ?? toast.undoAction;

  const icon =
    toast.variant === 'error' ? (
      <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
    ) : toast.variant === 'warning' ? (
      <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
    ) : toast.variant === 'success' ? (
      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
    ) : (
      <Info className="w-4 h-4 text-[var(--accent-primary)] shrink-0" />
    );

  const progressColor =
    toast.variant === 'error'
      ? 'bg-rose-500'
      : toast.variant === 'warning'
        ? 'bg-amber-500'
        : toast.variant === 'success'
          ? 'bg-emerald-500'
          : 'bg-[var(--accent-primary)]';

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="toast-item"
      data-toast-variant={toast.variant}
      onMouseEnter={() => onPause(toast.id, Date.now())}
      onMouseLeave={() => onResume(toast.id, Date.now())}
      onFocus={() => onPause(toast.id, Date.now())}
      onBlur={() => onResume(toast.id, Date.now())}
      onTouchStart={() => onPause(toast.id, Date.now())}
      onTouchEnd={() => onResume(toast.id, Date.now())}
      className={`pointer-events-auto relative overflow-hidden rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-strong)] shadow-2xl px-4 py-3 flex items-center gap-3 min-w-[260px] max-w-[92vw] sm:max-w-md transition-all duration-200 motion-reduce:transition-none ${
        entered ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-2 scale-95'
      }`}
    >
      {icon}
      <span className="text-xs font-semibold text-[var(--text-primary)] flex-1 min-w-0 leading-snug">
        {toast.message}
      </span>

      {undoFn && (
        <button
          type="button"
          onClick={() => {
            undoFn();
            onDismiss(toast.id);
          }}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[var(--accent-soft)] text-[var(--accent-strong)] text-xs font-bold hover:brightness-95 transition-all shrink-0 cursor-pointer"
        >
          <RotateCcw className="w-3 h-3" />
          <span>{toast.undoLabel || defaultUndoLabel}</span>
        </button>
      )}

      {toast.onAction && toast.actionLabel && (
        <button
          type="button"
          onClick={() => {
            toast.onAction?.();
            onDismiss(toast.id);
          }}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg btn-primary-waqti text-xs font-bold hover:brightness-95 transition-all shrink-0 cursor-pointer"
        >
          <span>{toast.actionLabel}</span>
        </button>
      )}

      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label={closeAriaLabel}
        className="p-1 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors shrink-0 cursor-pointer"
      >
        <X className="w-3.5 h-3.5" />
      </button>

      {/* Thin countdown progress bar */}
      <div className="absolute inset-x-0 bottom-0 h-0.5 bg-[var(--border-subtle)] overflow-hidden">
        <div
          className={`h-full ${progressColor} transition-[width] duration-75 ease-linear`}
          style={{ width: `${progressPct}%` }}
        />
      </div>
    </div>
  );
};

export const ToastContainer: React.FC<ToastContainerProps> = ({
  toasts,
  onDismiss,
  onPause,
  onResume,
  closeAriaLabel,
}) => {
  const { t } = useTranslation();
  const resolvedCloseLabel = closeAriaLabel || t('common.close');
  const defaultUndoLabel = t('common.undo');

  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="fixed bottom-20 md:bottom-6 end-4 sm:end-6 z-50 flex flex-col gap-2 items-end pointer-events-none"
    >
      {toasts.map((toast) => (
        <SingleToast
          key={toast.id}
          toast={toast}
          onDismiss={onDismiss}
          onPause={onPause}
          onResume={onResume}
          closeAriaLabel={resolvedCloseLabel}
          defaultUndoLabel={defaultUndoLabel}
        />
      ))}
    </div>
  );
};
