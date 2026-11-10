import type { SubjectColorId } from '../types';

export interface SubjectColorStyle {
  id: SubjectColorId;
  hex: string;
  softBg: string;
  text: string;
  border: string;
  dot: string;
}

export const SUBJECT_COLORS: Record<SubjectColorId, SubjectColorStyle> = {
  violet: {
    id: 'violet',
    hex: '#8B5CF6',
    softBg: 'bg-violet-500/12 dark:bg-violet-500/18',
    text: 'text-violet-700 dark:text-violet-300',
    border: 'border-violet-500/25 dark:border-violet-400/30',
    dot: 'bg-violet-500',
  },
  indigo: {
    id: 'indigo',
    hex: '#6366F1',
    softBg: 'bg-indigo-500/12 dark:bg-indigo-500/18',
    text: 'text-indigo-700 dark:text-indigo-300',
    border: 'border-indigo-500/25 dark:border-indigo-400/30',
    dot: 'bg-indigo-500',
  },
  sky: {
    id: 'sky',
    hex: '#0EA5E9',
    softBg: 'bg-sky-500/12 dark:bg-sky-500/18',
    text: 'text-sky-700 dark:text-sky-300',
    border: 'border-sky-500/25 dark:border-sky-400/30',
    dot: 'bg-sky-500',
  },
  emerald: {
    id: 'emerald',
    hex: '#10B981',
    softBg: 'bg-emerald-500/12 dark:bg-emerald-500/18',
    text: 'text-emerald-700 dark:text-emerald-300',
    border: 'border-emerald-500/25 dark:border-emerald-400/30',
    dot: 'bg-emerald-500',
  },
  teal: {
    id: 'teal',
    hex: '#14B8A6',
    softBg: 'bg-teal-500/12 dark:bg-teal-500/18',
    text: 'text-teal-700 dark:text-teal-300',
    border: 'border-teal-500/25 dark:border-teal-400/30',
    dot: 'bg-teal-500',
  },
  amber: {
    id: 'amber',
    hex: '#F59E0B',
    softBg: 'bg-amber-500/12 dark:bg-amber-500/18',
    text: 'text-amber-800 dark:text-amber-300',
    border: 'border-amber-500/25 dark:border-amber-400/30',
    dot: 'bg-amber-500',
  },
  rose: {
    id: 'rose',
    hex: '#F43F5E',
    softBg: 'bg-rose-500/12 dark:bg-rose-500/18',
    text: 'text-rose-700 dark:text-rose-300',
    border: 'border-rose-500/25 dark:border-rose-400/30',
    dot: 'bg-rose-500',
  },
  fuchsia: {
    id: 'fuchsia',
    hex: '#D946EF',
    softBg: 'bg-fuchsia-500/12 dark:bg-fuchsia-500/18',
    text: 'text-fuchsia-700 dark:text-fuchsia-300',
    border: 'border-fuchsia-500/25 dark:border-fuchsia-400/30',
    dot: 'bg-fuchsia-500',
  },
};

export const SUBJECT_COLOR_LIST: SubjectColorId[] = [
  'violet',
  'indigo',
  'sky',
  'emerald',
  'teal',
  'amber',
  'rose',
  'fuchsia',
];
