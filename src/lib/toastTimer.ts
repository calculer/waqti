import type { ToastItem, ToastVariant } from '../types';

export const DEFAULT_TOAST_DURATION_MS = 5000;
export const ERROR_TOAST_DURATION_MS = 8000;
export const MAX_TOAST_STACK = 3;
export const UNDO_SHORTCUT_WINDOW_MS = 60_000;

export interface CreateToastOptions {
  id?: string;
  message: string;
  variant?: ToastVariant;
  durationMs?: number;
  nowMs?: number;
  undoLabel?: string;
  undoAction?: () => void;
  onUndo?: () => void;
  actionLabel?: string;
  onAction?: () => void;
  nothingChanged?: boolean;
  importedCount?: number;
}

/**
 * Pure factory for a ToastItem using timestamp-based timers.
 * Never attaches an Undo action when nothingChanged === true or importedCount === 0.
 */
export function createToastItem(options: CreateToastOptions): ToastItem {
  const variant: ToastVariant = options.variant ?? 'info';
  const durationMs =
    options.durationMs ??
    (variant === 'error' ? ERROR_TOAST_DURATION_MS : DEFAULT_TOAST_DURATION_MS);
  const nowMs = options.nowMs ?? Date.now();

  const shouldSuppressUndo =
    options.nothingChanged === true ||
    (typeof options.importedCount === 'number' && options.importedCount === 0);

  const fnUndo = options.onUndo ?? options.undoAction;

  return {
    id: options.id ?? `toast-${nowMs}-${Math.random().toString(36).slice(2, 8)}`,
    message: options.message,
    variant,
    durationMs,
    createdAtMs: nowMs,
    remainingMs: durationMs,
    lastResumedAtMs: nowMs,
    paused: false,
    undoLabel: shouldSuppressUndo ? undefined : options.undoLabel,
    undoAction: shouldSuppressUndo ? undefined : fnUndo,
    onUndo: shouldSuppressUndo ? undefined : fnUndo,
    actionLabel: options.actionLabel,
    onAction: options.onAction,
  };
}

/**
 * Computes exact remaining time in milliseconds based on Date.now() (or injected nowMs).
 */
export function computeToastRemainingMs(toast: ToastItem, nowMs: number = Date.now()): number {
  if (toast.paused) {
    return Math.max(0, toast.remainingMs);
  }
  const elapsed = Math.max(0, nowMs - toast.lastResumedAtMs);
  return Math.max(0, toast.remainingMs - elapsed);
}

/**
 * Computes the remaining progress percentage (0..100) for the countdown bar.
 */
export function computeToastProgressPercent(toast: ToastItem, nowMs: number = Date.now()): number {
  if (toast.durationMs <= 0) return 0;
  const remaining = computeToastRemainingMs(toast, nowMs);
  return Math.max(0, Math.min(100, (remaining / toast.durationMs) * 100));
}

/**
 * Pauses the toast countdown at nowMs, freezing remainingMs.
 */
export function pauseToast(toast: ToastItem, nowMs: number = Date.now()): ToastItem {
  if (toast.paused) return toast;
  const remainingMs = computeToastRemainingMs(toast, nowMs);
  return {
    ...toast,
    remainingMs,
    paused: true,
  };
}

/**
 * Resumes the toast countdown from nowMs.
 */
export function resumeToast(toast: ToastItem, nowMs: number = Date.now()): ToastItem {
  if (!toast.paused) return toast;
  return {
    ...toast,
    lastResumedAtMs: nowMs,
    paused: false,
  };
}

/**
 * Pushes a toast onto the stack, keeping at most MAX_TOAST_STACK (3) newest items.
 */
export function pushToastToStack(
  stack: ToastItem[],
  newToast: ToastItem,
  maxStack: number = MAX_TOAST_STACK
): ToastItem[] {
  const filtered = stack.filter((t) => t.id !== newToast.id);
  const combined = [...filtered, newToast];
  if (combined.length <= maxStack) return combined;
  return combined.slice(combined.length - maxStack);
}

/**
 * Prunes expired toasts from the stack at nowMs.
 */
export function pruneExpiredToasts(
  stack: ToastItem[],
  nowMs: number = Date.now()
): ToastItem[] {
  return stack.filter((t) => computeToastRemainingMs(t, nowMs) > 0);
}
