# Waqti (وقتي) — Luxury Student Time, Study & Habit Companion

**Waqti (وقتي — "My Time")** is a production-grade, offline-first single-page web application designed for university and high-school students across the Arab world, Francophone regions, and global universities.

## ✨ Key Highlights

### 1. Muted Yellow Luxury Design System & Curated Typography
- **Warm Honey & Parchment Palette**:
  - **Light Mode**: Background `#FBF7EC`, Surface `#FFFDF6`, Elevated `#FFFFFF`, Border `#EDE4CC`, Ink `#2B2416`, Primary `#D9B44A` / `#B8902A`.
  - **Dark Mode**: Warm Obsidian `#14110A`, Surface `#1D1910`, Elevated `#262115`, Border `#3A3220`, Text `#F5EEDC`, Primary `#E6C65C`.
  - **5 Accent Themes**: Honey (default), Sand, Olive, Terracotta, and Slate-blue.
  - **12 Curated Subject Colors**: Harmonious soft backgrounds + vivid foreground variants with strong contrast on warm yellow surfaces.
- **Typography**:
  - Latin Display & Big Numerals: **Fraunces** (optical-size serif)
  - Latin UI & Body: **Manrope**
  - Arabic Display & Logo Lockup: **Aref Ruqaa** (`وقتي`)
  - Arabic UI & Body: **Readex Pro**
  - Clocks, Timers & Countdowns: **JetBrains Mono** (`tabular-nums`)

### 2. First-Class Trilingual & RTL Architecture (العربية · Français · English)
- Instant language switching without reload, persisted in `localStorage`.
- Complete RTL mirroring using CSS logical properties (`ms-`, `me-`, `ps-`, `pe-`, `start-`, `end-`) across all views.
- Full pluralization support (including Arabic 6-form plural rules: `zero`, `one`, `two`, `few`, `many`, `other`) and Western (`0-9`) vs Eastern (`٠-٩`) numeral formatting.

### 3. Redesigned Calendar & Zero-Overflow Month Grid
- **Month View**: Fixed-height cells with `overflow-hidden` showing only the day number (filled honey circle for today) + up to 3 color-coded event dots (`6px`, with a rotated diamond for exams) + a compact `+N` overflow badge.
- **Interactive Day Agenda**: Clicking any day opens its chronological schedule in the side panel (desktop) or bottom panel (mobile) with exact countdowns and a `+ Add on this day` shortcut.
- **Week & Day Views**: Automatic side-by-side column packing (`packOverlappingEvents`) so overlapping classes/tasks never collide, a live glowing `Now` line, filter chips (`Classes`, `Exams`, `Tasks`, `Habits`, `Alarms`), and a Busy-ness Heat Tint toggle.

### 4. In-App Alarms & Smart Reminders Engine
- Dedicated **Alarms & Reminders** view grouped into *Today*, *Repeating*, and *Upcoming*.
- **5 Synthesized Web Audio Alarm Tones** (`Soft Bell`, `Morning Chime`, `Marimba`, `Gentle Rise`, `Digital Beep`) with gradual volume ramp—zero external audio files required.
- **Full-Screen Ringing Overlay**: Pulsing honey rings, Snooze (`5m`, `10m`, `15m`), Dismiss, and Mark Done.
- **Missed Alarms Detection**: Timestamp-based evaluation detects any alarms that were due while the browser tab was closed or asleep.

### 5. 10 Student Power Features
1. **Smart "Plan My Day" Generator**: Builds a time-blocked study schedule into today's free gaps, weighting subjects by exam urgency, coefficient, and pending tasks.
2. **Exam Target Grade Simulator**: Calculates the exact score needed on the next exam to reach a target weighted average (with achievable / stretch / out-of-reach indicator).
3. **Gentle Gamification**: Earn XP and level up for focus minutes, completed tasks, and habit check-ins (toggleable in Settings).
4. **Weekly Review Card**: Summarizes weekly study hours, task completion rate, strongest subject, and next week's focus recommendation.
5. **Leitner Spaced-Repetition Flashcards (Boxes 1–5)** & **Markdown Notes** in Lessons & Homework.
6. **Daily Mood & Energy Check-in**: 1-tap mood and energy logging on the Today Dashboard.
7. **Natural-Language Quick Capture (`N`)**: Type `Math exam 25/05 09:00` or `Remind me 18:30 review physics` in Arabic, French, or English.
8. **`.ics` Calendar Export & Print-Friendly Timetable PDF**.
9. **PWA Home-Screen Shortcuts** (`Start Focus`, `Add Task`, `Today's Schedule`) & full maskable icon suite.
10. **Automatic Local Backups**: Keeps the last 7 automatic snapshots in `localStorage` with 1-tap restore.

## 🚀 Getting Started

```bash
npm install
npm run dev
```

Run the unit test suite (date math, overlap packing, month cell overflow, alarm matching, target grade simulator, natural language parser, and i18n parity):

```bash
npx tsx --test src/lib/dates.test.ts src/lib/i18n.test.ts
```
