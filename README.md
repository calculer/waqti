# Waqti (وقتي) — Luxury Student Study & Time OS

**Waqti (وقتي)** is an offline-first, trilingual (Arabic RTL, French, English) academic time, timetable, exam countdown, focus studio, and habit management web application built for students.

## Highlights
- **Bulletproof Date & Time Engine (`src/lib/dates.ts`)**: Local `YYYY-MM-DD` and `HH:mm` storage, `date-fns` local parsing (zero UTC day-shift bugs), DST/leap-year safe math, overlap conflict detection, exact exam countdowns, and timestamp-based Pomodoro timers.
- **First-Class Trilingual & RTL/LTR Architecture (`src/lib/i18n.ts`)**: Instant switching between **العربية (ar)**, **Français (fr)**, and **English (en)** with dynamic `<html lang dir>`, logical Tailwind CSS properties (`ms-`, `me-`, `ps-`, `pe-`, `start-`, `end-`), `Intl.PluralRules` (supporting Arabic's 6 plural forms), Western (`0-9`) vs. Arabic-Indic (`٠-٩`) numeral formatting, and optional Hijri secondary dates.
- **Offline PWA Ready**: Configured with `vite-plugin-pwa`, Web App Manifest, service worker asset/font caching, and in-app installation support.

## Quick Start
```bash
npm install
npm run dev
```

## Running Unit Tests
```bash
npx --yes tsx --test src/lib/dates.test.ts src/lib/i18n.test.ts
```
