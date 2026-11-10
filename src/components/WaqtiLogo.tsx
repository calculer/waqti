import React from 'react';

export const WaqtiLogo: React.FC<{ size?: number; className?: string }> = ({
  size = 34,
  className = '',
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 64 64"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    <defs>
      <linearGradient id="waqtiMarkGrad" x1="6" y1="6" x2="58" y2="58" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="var(--accent-primary)" />
        <stop offset="100%" stopColor="var(--accent-secondary)" />
      </linearGradient>
    </defs>
    <rect
      x="4"
      y="4"
      width="56"
      height="56"
      rx="16"
      fill="var(--accent-soft)"
      stroke="url(#waqtiMarkGrad)"
      strokeWidth="1.5"
    />
    {/* Signature Hourglass + Clock Hands */}
    <path
      d="M21 17H43L35 30C33.8 31.8 33.8 32.2 35 34L43 47H21L29 34C30.2 32.2 30.2 31.8 29 30L21 17Z"
      stroke="url(#waqtiMarkGrad)"
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="var(--accent-soft)"
    />
    <circle cx="32" cy="32" r="2.2" fill="var(--accent-primary)" />
    <path d="M26 43H38" stroke="var(--accent-primary)" strokeWidth="2.2" strokeLinecap="round" />
  </svg>
);

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
  </svg>
);
