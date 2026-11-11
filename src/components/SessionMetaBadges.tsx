import React from 'react';
import {
  BookOpen,
  Building2,
  ExternalLink,
  FlaskConical,
  GraduationCap,
  Layers,
  Sparkles,
  Video,
} from 'lucide-react';
import type { DeliveryMode, Language, MeetingPlatform, SessionType } from '../types';
import { useWaqtiStore } from '../store/useWaqtiStore';
import { t } from '../lib/i18n';

export const SESSION_TYPE_STYLE: Record<
  SessionType,
  {
    bg: string;
    text: string;
    border: string;
    Icon: React.ComponentType<{ className?: string }>;
  }
> = {
  lecture: {
    bg: 'bg-amber-500/15',
    text: 'text-amber-700 dark:text-amber-300',
    border: 'border-amber-500/30',
    Icon: GraduationCap,
  },
  td: {
    bg: 'bg-sky-500/15',
    text: 'text-sky-700 dark:text-sky-300',
    border: 'border-sky-500/30',
    Icon: BookOpen,
  },
  tp: {
    bg: 'bg-emerald-500/15',
    text: 'text-emerald-700 dark:text-emerald-300',
    border: 'border-emerald-500/30',
    Icon: FlaskConical,
  },
  other: {
    bg: 'bg-purple-500/15',
    text: 'text-purple-700 dark:text-purple-300',
    border: 'border-purple-500/30',
    Icon: Sparkles,
  },
};

export const DELIVERY_MODE_STYLE: Record<
  DeliveryMode,
  {
    bg: string;
    text: string;
    border: string;
    Icon: React.ComponentType<{ className?: string }>;
  }
> = {
  in_person: {
    bg: 'bg-[var(--bg-canvas)]',
    text: 'text-[var(--text-secondary)]',
    border: 'border-[var(--border-subtle)]',
    Icon: Building2,
  },
  remote: {
    bg: 'bg-sky-500/15',
    text: 'text-sky-700 dark:text-sky-300',
    border: 'border-sky-500/30',
    Icon: Video,
  },
  hybrid: {
    bg: 'bg-amber-500/15',
    text: 'text-amber-700 dark:text-amber-300',
    border: 'border-amber-500/30',
    Icon: Layers,
  },
};

export interface SessionMetaBadgesProps {
  lang?: Language;
  type?: SessionType;
  mode?: DeliveryMode;
  section?: string;
  group?: string;
  meetingUrl?: string;
  platform?: MeetingPlatform;
  compact?: boolean;
  compactForGrid?: boolean;
  showModeLabel?: boolean;
  showJoinButton?: boolean;
}

export const SessionMetaBadges: React.FC<SessionMetaBadgesProps> = ({
  lang: propLang,
  type,
  mode,
  section,
  group,
  meetingUrl,
  compact = false,
  compactForGrid = false,
  showModeLabel = false,
  showJoinButton = false,
}) => {
  const storeLang = useWaqtiStore((s) => s.settings.language);
  const lang = propLang ?? storeLang;

  const hasExplicitType = type !== undefined;
  const hasExplicitMode = mode !== undefined;
  const resolvedType: SessionType = type ?? 'lecture';
  const resolvedMode: DeliveryMode = mode ?? 'in_person';

  const typeMeta = SESSION_TYPE_STYLE[resolvedType] ?? SESSION_TYPE_STYLE.lecture;
  const modeMeta = DELIVERY_MODE_STYLE[resolvedMode] ?? DELIVERY_MODE_STYLE.in_person;
  const TypeIcon = typeMeta.Icon;
  const ModeIcon = modeMeta.Icon;

  const shortTypeLabel = t(lang, `timetable.typeShort.${resolvedType}`);
  const fullTypeLabel = t(lang, `timetable.type.${resolvedType}`);
  const modeLabel = t(lang, `timetable.mode.${resolvedMode}`);

  const secGroupText = [
    section ? `S${section}` : '',
    group ? `G${group}` : '',
  ]
    .filter(Boolean)
    .join('·');

  if (compactForGrid) {
    return (
      <span className="inline-flex items-center gap-1 shrink-0 min-w-0">
        <span
          className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold border ${typeMeta.bg} ${typeMeta.text} ${typeMeta.border} whitespace-nowrap`}
          title={fullTypeLabel}
        >
          <TypeIcon className="w-2.5 h-2.5 shrink-0" />
          <span className="waqti-slot-badge-text">{shortTypeLabel}</span>
        </span>
        <span
          className={`inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[9px] font-semibold border ${modeMeta.bg} ${modeMeta.text} ${modeMeta.border} whitespace-nowrap`}
          title={modeLabel}
        >
          <ModeIcon className="w-2.5 h-2.5 shrink-0" />
        </span>
        {secGroupText && (
          <span
            dir="ltr"
            className="waqti-slot-badge-text px-1 py-0.5 rounded bg-[var(--bg-canvas)]/80 text-[9px] font-bold text-[var(--text-secondary)] border border-[var(--border-subtle)] whitespace-nowrap tabular-nums"
          >
            {secGroupText}
          </span>
        )}
      </span>
    );
  }

  return (
    <div className="inline-flex flex-wrap items-center gap-1.5 min-w-0">
      {(hasExplicitType || !hasExplicitMode) && (
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${typeMeta.bg} ${typeMeta.text} ${typeMeta.border} whitespace-nowrap`}
        >
          <TypeIcon className="w-3 h-3 shrink-0" />
          <span>{compact ? shortTypeLabel : fullTypeLabel}</span>
        </span>
      )}

      {(hasExplicitMode || !hasExplicitType) && (
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold border ${modeMeta.bg} ${modeMeta.text} ${modeMeta.border} whitespace-nowrap`}
          title={modeLabel}
        >
          <ModeIcon className="w-3 h-3 shrink-0" />
          {(!compact || showModeLabel) && <span>{modeLabel}</span>}
        </span>
      )}

      {secGroupText && (
        <span
          dir="ltr"
          className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-[10px] font-bold text-[var(--text-secondary)] whitespace-nowrap tabular-nums"
        >
          {secGroupText}
        </span>
      )}

      {showJoinButton &&
        (resolvedMode === 'remote' || resolvedMode === 'hybrid') &&
        meetingUrl && (
          <a
            href={meetingUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-sky-500 text-white hover:bg-sky-600 text-[10px] font-bold shadow-xs transition-colors whitespace-nowrap"
          >
            <Video className="w-3 h-3 shrink-0" />
            <span>{t(lang, 'timetable.joinClass')}</span>
            <ExternalLink className="w-2.5 h-2.5 shrink-0" />
          </a>
        )}
    </div>
  );
};

export const DeliveryModeSegmentedControl: React.FC<{
  lang?: Language;
  value: DeliveryMode;
  onChange: (mode: DeliveryMode) => void;
  size?: 'sm' | 'md';
}> = ({ lang: propLang, value, onChange, size = 'md' }) => {
  const storeLang = useWaqtiStore((s) => s.settings.language);
  const lang = propLang ?? storeLang;
  const options: DeliveryMode[] = ['in_person', 'remote', 'hybrid'];
  return (
    <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-subtle)]">
      {options.map((m) => {
        const active = value === m;
        const { Icon } = DELIVERY_MODE_STYLE[m];
        return (
          <button
            key={m}
            type="button"
            onClick={() => onChange(m)}
            className={`flex items-center justify-center gap-1.5 rounded-lg font-bold transition-all cursor-pointer whitespace-nowrap ${
              size === 'sm' ? 'px-2 py-1 text-[11px]' : 'px-2.5 py-1.5 text-xs'
            } ${
              active
                ? 'btn-primary-waqti shadow-xs'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Icon className={size === 'sm' ? 'w-3 h-3 shrink-0' : 'w-3.5 h-3.5 shrink-0'} />
            <span className="truncate">{t(lang, `timetable.mode.${m}`)}</span>
          </button>
        );
      })}
    </div>
  );
};

export const SessionTypeSegmentedControl: React.FC<{
  lang?: Language;
  value: SessionType;
  onChange: (type: SessionType) => void;
}> = ({ lang: propLang, value, onChange }) => {
  const storeLang = useWaqtiStore((s) => s.settings.language);
  const lang = propLang ?? storeLang;
  const options: SessionType[] = ['lecture', 'td', 'tp', 'other'];
  return (
    <div className="grid grid-cols-4 gap-1 p-1 rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-subtle)]">
      {options.map((st) => {
        const active = value === st;
        const { Icon } = SESSION_TYPE_STYLE[st];
        return (
          <button
            key={st}
            type="button"
            onClick={() => onChange(st)}
            className={`flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              active
                ? 'btn-primary-waqti shadow-xs'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Icon className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{t(lang, `timetable.type.${st}`)}</span>
          </button>
        );
      })}
    </div>
  );
};
