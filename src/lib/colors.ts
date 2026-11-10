import { SubjectColorId, AccentTheme } from '../types';

export interface SubjectColorStyle {
  id: SubjectColorId;
  name: string;
  hex: string;
  dot: string;
  softBg: string;
  border: string;
  text: string;
  // Aliases
  bgSoft: string;
  borderSoft: string;
  textStrong: string;
  dotBg: string;
}

function makeStyle(
  id: SubjectColorId,
  name: string,
  hex: string,
  dot: string,
  softBg: string,
  border: string,
  text: string
): SubjectColorStyle {
  return {
    id,
    name,
    hex,
    dot,
    softBg,
    border,
    text,
    bgSoft: softBg,
    borderSoft: border,
    textStrong: text,
    dotBg: dot,
  };
}

export const SUBJECT_COLORS: Record<SubjectColorId, SubjectColorStyle> = {
  honey: makeStyle(
    'honey',
    'Honey',
    '#D9B44A',
    'bg-[#D9B44A] dark:bg-[#E6C65C]',
    'bg-[#D9B44A]/15 dark:bg-[#E6C65C]/20',
    'border-[#D9B44A]/35 dark:border-[#E6C65C]/40',
    'text-[#8C6D14] dark:text-[#F3DC86]'
  ),
  amber: makeStyle(
    'amber',
    'Ochre Amber',
    '#D97706',
    'bg-amber-600 dark:bg-amber-400',
    'bg-amber-500/14 dark:bg-amber-400/20',
    'border-amber-500/35 dark:border-amber-400/35',
    'text-amber-800 dark:text-amber-300'
  ),
  terracotta: makeStyle(
    'terracotta',
    'Terracotta',
    '#C86D51',
    'bg-[#C86D51] dark:bg-[#E08266]',
    'bg-[#C86D51]/14 dark:bg-[#E08266]/20',
    'border-[#C86D51]/35 dark:border-[#E08266]/35',
    'text-[#964229] dark:text-[#F4A68E]'
  ),
  rose: makeStyle(
    'rose',
    'Dusty Rose',
    '#C95B73',
    'bg-rose-600 dark:bg-rose-400',
    'bg-rose-500/14 dark:bg-rose-400/20',
    'border-rose-500/30 dark:border-rose-400/35',
    'text-rose-800 dark:text-rose-300'
  ),
  plum: makeStyle(
    'plum',
    'Warm Plum',
    '#9356A0',
    'bg-purple-600 dark:bg-purple-400',
    'bg-purple-500/14 dark:bg-purple-400/20',
    'border-purple-500/30 dark:border-purple-400/35',
    'text-purple-800 dark:text-purple-300'
  ),
  violet: makeStyle(
    'violet',
    'Muted Violet',
    '#7C65B8',
    'bg-violet-600 dark:bg-violet-400',
    'bg-violet-500/14 dark:bg-violet-400/20',
    'border-violet-500/30 dark:border-violet-400/35',
    'text-violet-800 dark:text-violet-300'
  ),
  indigo: makeStyle(
    'indigo',
    'Deep Indigo',
    '#5768B2',
    'bg-indigo-600 dark:bg-indigo-400',
    'bg-indigo-500/14 dark:bg-indigo-400/20',
    'border-indigo-500/30 dark:border-indigo-400/35',
    'text-indigo-800 dark:text-indigo-300'
  ),
  slate: makeStyle(
    'slate',
    'Slate Blue',
    '#5E7C99',
    'bg-[#5E7C99] dark:bg-[#7A9BB8]',
    'bg-[#5E7C99]/15 dark:bg-[#7A9BB8]/20',
    'border-[#5E7C99]/35 dark:border-[#7A9BB8]/35',
    'text-[#395570] dark:text-[#A9C6DF]'
  ),
  sky: makeStyle(
    'sky',
    'Cerulean Sky',
    '#2B8CBE',
    'bg-sky-600 dark:bg-sky-400',
    'bg-sky-500/14 dark:bg-sky-400/20',
    'border-sky-500/30 dark:border-sky-400/35',
    'text-sky-800 dark:text-sky-300'
  ),
  teal: makeStyle(
    'teal',
    'Mineral Teal',
    '#2F8F83',
    'bg-teal-600 dark:bg-teal-400',
    'bg-teal-500/14 dark:bg-teal-400/20',
    'border-teal-500/30 dark:border-teal-400/35',
    'text-teal-800 dark:text-teal-300'
  ),
  sage: makeStyle(
    'sage',
    'Sage Green',
    '#4A8B5B',
    'bg-emerald-600 dark:bg-emerald-400',
    'bg-emerald-600/14 dark:bg-emerald-400/20',
    'border-emerald-600/30 dark:border-emerald-400/35',
    'text-emerald-800 dark:text-emerald-300'
  ),
  olive: makeStyle(
    'olive',
    'Warm Olive',
    '#7C8F4A',
    'bg-[#7C8F4A] dark:bg-[#97AD5E]',
    'bg-[#7C8F4A]/15 dark:bg-[#97AD5E]/20',
    'border-[#7C8F4A]/35 dark:border-[#97AD5E]/35',
    'text-[#4F5E27] dark:text-[#C2D68A]'
  ),
};

export const SUBJECT_COLOR_LIST: SubjectColorId[] = [
  'honey',
  'amber',
  'terracotta',
  'rose',
  'plum',
  'violet',
  'indigo',
  'slate',
  'sky',
  'teal',
  'sage',
  'olive',
];

export function getSubjectColor(id?: SubjectColorId | string): SubjectColorStyle {
  if (!id) return SUBJECT_COLORS.honey;
  return SUBJECT_COLORS[id as SubjectColorId] ?? SUBJECT_COLORS.honey;
}

export const ACCENT_THEMES: { id: AccentTheme; hex: string }[] = [
  { id: 'honey', hex: '#D9B44A' },
  { id: 'sand', hex: '#C49A5A' },
  { id: 'olive', hex: '#7C8F4A' },
  { id: 'terracotta', hex: '#C86D51' },
  { id: 'slate', hex: '#5E7C99' },
];
