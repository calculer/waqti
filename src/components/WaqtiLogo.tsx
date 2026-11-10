import React, { useEffect, useState } from 'react';
import { useWaqtiStore } from '../store/useWaqtiStore';

export interface LogoProps {
  size?: number;
  variant?: 'icon' | 'full';
  animateIntro?: boolean;
  className?: string;
}

/**
 * Original luxury Waqti logo mark:
 * A rounded-square (squircle) badge with a warm honey gradient, subtle inner highlight,
 * minimal hourglass-meets-clock glyph, and a signature gold sparkle/check detail.
 * Includes full wordmark lockup ("Waqti" in Fraunces / "وقتي" in Aref Ruqaa).
 */
export const Logo: React.FC<LogoProps> = ({
  size = 36,
  variant = 'icon',
  animateIntro = false,
  className = '',
}) => {
  const lang = useWaqtiStore((s) => s.settings.language);
  const isAr = lang === 'ar';
  const [entered, setEntered] = useState(!animateIntro);

  useEffect(() => {
    if (animateIntro) {
      const id = window.requestAnimationFrame(() => setEntered(true));
      return () => window.cancelAnimationFrame(id);
    }
  }, [animateIntro]);

  const badgeSvg = (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="shrink-0"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="waqtiHoneySquircle" x1="8" y1="6" x2="56" y2="58" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="var(--bg-surface)" />
          <stop offset="100%" stopColor="var(--accent-soft)" />
        </linearGradient>
        <linearGradient id="waqtiGoldStroke" x1="12" y1="10" x2="52" y2="54" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#F3DC86" />
          <stop offset="50%" stopColor="var(--accent-primary)" />
          <stop offset="100%" stopColor="var(--accent-secondary)" />
        </linearGradient>
      </defs>

      {/* Squircle Badge */}
      <rect
        x="4"
        y="4"
        width="56"
        height="56"
        rx="17"
        fill="url(#waqtiHoneySquircle)"
        stroke="url(#waqtiGoldStroke)"
        strokeWidth="1.75"
      />
      {/* Subtle Inner Highlight */}
      <rect
        x="6.5"
        y="6.5"
        width="51"
        height="51"
        rx="14.5"
        stroke="var(--accent-primary)"
        strokeOpacity="0.16"
        strokeWidth="1"
      />

      {/* Minimal Clock Rim */}
      <circle
        cx="32"
        cy="33"
        r="17.5"
        stroke="var(--accent-primary)"
        strokeOpacity="0.24"
        strokeWidth="1.4"
        strokeDasharray="2.5 3"
      />

      {/* Hourglass-Meets-Clock Glyph */}
      <path
        d="M22 19H42L34.6 30.2C33.4 31.9 33.4 33.1 34.6 34.8L42 46H22L29.4 34.8C30.6 33.1 30.6 31.9 29.4 30.2L22 19Z"
        fill="var(--accent-soft)"
        stroke="url(#waqtiGoldStroke)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Clock Hands inside Hourglass Center */}
      <path
        d="M32 32.5V25.5M32 32.5L36.5 35"
        stroke="var(--text-primary)"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="32" cy="32.5" r="2.2" fill="var(--accent-primary)" />

      {/* Settled Honey Sand Base */}
      <path d="M26.5 42.5H37.5" stroke="var(--accent-primary)" strokeWidth="2.2" strokeLinecap="round" />

      {/* Signature 4-Point Sparkle Detail */}
      <path
        d="M46.5 13.5L47.7 16.8L51 18L47.7 19.2L46.5 22.5L45.3 19.2L42 18L45.3 16.8L46.5 13.5Z"
        fill="var(--accent-primary)"
      />
    </svg>
  );

  const wrappedBadge = animateIntro ? (
    <div
      className={`transition-all duration-500 ease-out ${
        entered ? 'scale-100 opacity-100 rotate-0' : 'scale-90 opacity-0 -rotate-6'
      }`}
    >
      {badgeSvg}
    </div>
  ) : (
    badgeSvg
  );

  if (variant === 'icon') {
    return <span className={`inline-flex items-center ${className}`}>{wrappedBadge}</span>;
  }

  return (
    <div className={`inline-flex items-center gap-3 text-start ${className}`}>
      {wrappedBadge}
      <div className="leading-none">
        {isAr ? (
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-bold font-arabic-logo text-[var(--text-primary)] tracking-normal">
              وقتي
            </span>
            <span className="text-xs font-medium font-display text-[var(--text-muted)]">
              Waqti
            </span>
          </div>
        ) : (
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-bold font-display tracking-tight text-[var(--text-primary)]">
              Waqti
            </span>
            <span className="text-xs font-arabic-logo text-[var(--text-muted)]">
              وقتي
            </span>
          </div>
        )}
        <div className="text-[10px] font-medium text-[var(--text-muted)] mt-1">
          {isAr ? 'رفيق الدراسة والوقت' : lang === 'fr' ? 'Études & Temps' : 'Study & Time Sanctuary'}
        </div>
      </div>
    </div>
  );
};

export const WaqtiLogo: React.FC<{ size?: number; className?: string; animateIntro?: boolean }> = ({
  size = 36,
  className = '',
  animateIntro = false,
}) => <Logo size={size} variant="icon" animateIntro={animateIntro} className={className} />;

export const EmptyHourglassIllustration: React.FC<{ className?: string }> = ({
  className = 'w-20 h-20',
}) => (
  <svg
    viewBox="0 0 120 120"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    <circle
      cx="60"
      cy="60"
      r="48"
      stroke="var(--border-strong)"
      strokeWidth="1.5"
      strokeDasharray="4 4"
    />
    <circle cx="60" cy="60" r="36" fill="var(--accent-soft)" />
    <path
      d="M42 36H78L64 57C62.5 59.2 62.5 60.8 64 63L78 84H42L56 63C57.5 60.8 57.5 59.2 56 57L42 36Z"
      stroke="var(--accent-primary)"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path d="M50 78H70" stroke="var(--accent-primary)" strokeWidth="3" strokeLinecap="round" />
    <circle cx="60" cy="60" r="3" fill="var(--accent-primary)" />
    <path
      d="M84 30L86 35L91 37L86 39L84 44L82 39L77 37L82 35L84 30Z"
      fill="var(--accent-primary)"
    />
  </svg>
);
