import type {
  DeliveryMode,
  MeetingPlatform,
  RecurrenceType,
  SessionType,
  Subject,
  SubjectColorId,
  TimetableSlot,
  WeekDay,
  WeekParity,
} from '../types';
import { SUBJECT_COLOR_LIST } from './colors';
import { doTimeRangesOverlap, isValidTimeOrder, minutesToTime, timeToMinutes } from './dates';

export type ParsedSessionTypeChoice = SessionType | 'unknown';

export type ParseIssueCode =
  | 'missing_time'
  | 'inferred_end_time'
  | 'invalid_time_order'
  | 'unknown_day'
  | 'unknown_type'
  | 'missing_subject'
  | 'conflict_existing'
  | 'conflict_imported'
  | 'duplicate_existing';

export interface ParsedTimetableRow {
  id: string;
  include: boolean;
  sourceText: string;
  subjectName: string;
  matchedSubjectId: string | null;
  matchedSimilarity: number;
  proposedColor: SubjectColorId;
  sessionType: ParsedSessionTypeChoice;
  dayOfWeek: WeekDay | null;
  startTime: string; // "HH:mm"
  endTime: string; // "HH:mm"
  section: string;
  group: string;
  teacher: string;
  room: string;
  mode: DeliveryMode;
  meetingUrl: string;
  platform?: MeetingPlatform;
  recurrence: RecurrenceType;
  weekParity: WeekParity;
  semesterStart?: string; // "YYYY-MM-DD"
  semesterEnd?: string; // "YYYY-MM-DD"
  confidence: number; // 0 - 100
  issues: ParseIssueCode[];
  duplicateOfSlotId?: string;
  conflictWithSlotIds: string[];
  conflictWithRowIds: string[];
}

export interface ParsedTimetableResult {
  rows: ParsedTimetableRow[];
  detectedSemesterStart?: string;
  detectedSemesterEnd?: string;
  totalDetected: number;
  needsReviewCount: number;
  conflictCount: number;
  duplicateCount: number;
}

const ARABIC_INDIC_MAP: Record<string, string> = {
  '٠': '0',
  '١': '1',
  '٢': '2',
  '٣': '3',
  '٤': '4',
  '٥': '5',
  '٦': '6',
  '٧': '7',
  '٨': '8',
  '٩': '9',
  '۰': '0',
  '۱': '1',
  '۲': '2',
  '۳': '3',
  '۴': '4',
  '۵': '5',
  '۶': '6',
  '۷': '7',
  '۸': '8',
  '۹': '9',
};

/**
 * Converts Arabic-Indic (٠-٩) and Eastern Arabic/Persian (۰-۹) digits to Western (0-9).
 */
export function normalizeDigitsToWestern(input: string): string {
  return input.replace(/[٠-٩۰-۹]/g, (ch) => ARABIC_INDIC_MAP[ch] ?? ch);
}

/**
 * Normalizes text for fuzzy comparison across Arabic, French, and English:
 * - Lowercases
 * - Strips Latin accents/diacritics
 * - Strips Arabic tashkeel/harakat & tatweel
 * - Normalizes Arabic alef variants (أ إ آ ٱ -> ا), teh marbuta (ة -> ه), alef maqsura (ى -> ي)
 */
export function normalizeForComparison(input: string): string {
  return normalizeDigitsToWestern(input)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Computes Levenshtein edit distance between two strings.
 */
export function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  const curr = new Array<number>(b.length + 1).fill(0);

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        curr[j - 1] + 1,
        prev[j] + 1,
        prev[j - 1] + cost
      );
    }
    for (let j = 0; j <= b.length; j++) {
      prev[j] = curr[j];
    }
  }
  return prev[b.length];
}

function getTrigrams(s: string): Set<string> {
  const padded = `  ${s} `;
  const set = new Set<string>();
  for (let i = 0; i < padded.length - 2; i++) {
    set.add(padded.slice(i, i + 3));
  }
  return set;
}

/**
 * Computes combined similarity (0..1) using normalized Levenshtein, trigram Dice coefficient,
 * and token containment for multi-word subject titles.
 */
export function computeStringSimilarity(rawA: string, rawB: string): number {
  const a = normalizeForComparison(rawA);
  const b = normalizeForComparison(rawB);
  if (!a || !b) return 0;
  if (a === b) return 1;

  const maxLen = Math.max(a.length, b.length);
  const levSim = maxLen > 0 ? 1 - levenshteinDistance(a, b) / maxLen : 0;

  const triA = getTrigrams(a);
  const triB = getTrigrams(b);
  let intersection = 0;
  for (const t of triA) {
    if (triB.has(t)) intersection++;
  }
  const diceSim =
    triA.size + triB.size > 0 ? (2 * intersection) / (triA.size + triB.size) : 0;

  // Check if significant word tokens (>2 chars) of the shorter string appear in the longer string
  const tokensA = a.split(' ').filter((w) => w.length >= 3);
  const tokensB = b.split(' ').filter((w) => w.length >= 3);
  let tokenBoost = 0;
  if (tokensA.length > 0 && tokensB.length > 0) {
    const shorter = tokensA.length <= tokensB.length ? tokensA : tokensB;
    const longerStr = tokensA.length <= tokensB.length ? b : a;
    const matchedTokens = shorter.filter((tok) => {
      const stem = tok.length >= 5 ? tok.slice(0, 5) : tok;
      return longerStr.includes(stem);
    });
    if (matchedTokens.length > 0) {
      tokenBoost = (matchedTokens.length / shorter.length) * 0.78;
    }
  }

  return Math.max(levSim * 0.55 + diceSim * 0.45, tokenBoost);
}

/**
 * Fuzzy-matches a candidate subject name against existing subjects.
 */
export function fuzzyMatchSubject(
  candidateName: string,
  existingSubjects: Subject[],
  threshold: number = 0.62
): { matchedSubject: Subject | null; similarity: number } {
  const cleanCandidate = normalizeForComparison(candidateName);
  if (!cleanCandidate || existingSubjects.length === 0) {
    return { matchedSubject: null, similarity: 0 };
  }

  let bestSubject: Subject | null = null;
  let bestScore = 0;

  for (const subj of existingSubjects) {
    const score = computeStringSimilarity(candidateName, subj.name);
    if (score > bestScore) {
      bestScore = score;
      bestSubject = subj;
    }
  }

  if (bestSubject && bestScore >= threshold) {
    return { matchedSubject: bestSubject, similarity: Number(bestScore.toFixed(2)) };
  }
  return { matchedSubject: null, similarity: Number(bestScore.toFixed(2)) };
}

/**
 * Detects meeting platform from a URL or text keywords.
 */
export function detectMeetingPlatform(
  url?: string,
  rawText?: string
): MeetingPlatform | undefined {
  const combined = `${url ?? ''} ${rawText ?? ''}`.toLowerCase();
  if (/zoom\.us|zoom\b/.test(combined)) return 'zoom';
  if (/meet\.google\.com|\bgoogle\s*meet\b|\bgmeet\b/.test(combined)) return 'meet';
  if (/teams\.microsoft\.com|teams\.live\.com|\bteams\b/.test(combined)) return 'teams';
  if (/moodle/.test(combined)) return 'moodle';
  if (url && /^https?:\/\//i.test(url.trim())) return 'other';
  return undefined;
}

/**
 * Validates a meeting link URL.
 */
export function isValidMeetingUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) return true;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

const DAY_DICTIONARY: Array<{ day: WeekDay; terms: string[] }> = [
  {
    day: 6,
    terms: ['السبت', 'سبت', 'samedi', 'sam', 'saturday', 'sat'],
  },
  {
    day: 0,
    terms: ['الاحد', 'احد', 'dimanche', 'dim', 'sunday', 'sun'],
  },
  {
    day: 1,
    terms: ['الاثنين', 'اثنين', 'lundi', 'lun', 'monday', 'mon'],
  },
  {
    day: 2,
    terms: ['الثلاثاء', 'ثلاثاء', 'ثلثاء', 'mardi', 'mar', 'tuesday', 'tue', 'tues'],
  },
  {
    day: 3,
    terms: ['الاربعاء', 'اربعاء', 'mercredi', 'mer', 'wednesday', 'wed', 'weds'],
  },
  {
    day: 4,
    terms: ['الخميس', 'خميس', 'jeudi', 'jeu', 'thursday', 'thu', 'thur', 'thurs'],
  },
  {
    day: 5,
    terms: ['الجمعه', 'جمعه', 'vendredi', 'ven', 'friday', 'fri'],
  },
];

/**
 * Detects a day of week from a token or line, tolerating accents, Arabic alef/teh variants, and 1-edit typos on full day names.
 */
export function detectDayOfWeekInText(rawText: string): {
  day: WeekDay | null;
  cleanedText: string;
} {
  const normalizedDigits = normalizeDigitsToWestern(rawText);

  // Check exact / boundary matches first
  const patterns: Array<{ day: WeekDay; regex: RegExp }> = [
    {
      day: 6,
      regex: /(?:^|[\s|,;:/\-()[\]])(السبت|سبت|samedi|sam\.?|saturday|sat\.?)(?=$|[\s|,;:/\-()[\]])/i,
    },
    {
      day: 0,
      regex: /(?:^|[\s|,;:/\-()[\]])(الأحد|الاحد|أحد|احد|dimanche|dim\.?|sunday|sun\.?)(?=$|[\s|,;:/\-()[\]])/i,
    },
    {
      day: 1,
      regex: /(?:^|[\s|,;:/\-()[\]])(الاثنين|الإثنين|اثنين|إثنين|lundi|lun\.?|monday|mon\.?)(?=$|[\s|,;:/\-()[\]])/i,
    },
    {
      day: 2,
      regex: /(?:^|[\s|,;:/\-()[\]])(الثلاثاء|ثلاثاء|ثلثاء|mardi|mar\.?|tuesday|tues\.?|tue\.?)(?=$|[\s|,;:/\-()[\]])/i,
    },
    {
      day: 3,
      regex: /(?:^|[\s|,;:/\-()[\]])(الأربعاء|الاربعاء|أربعاء|اربعاء|mercredi|mer\.?|wednesday|weds\.?|wed\.?)(?=$|[\s|,;:/\-()[\]])/i,
    },
    {
      day: 4,
      regex: /(?:^|[\s|,;:/\-()[\]])(الخميس|خميس|jeudi|jeu\.?|thursday|thurs\.?|thur\.?|thu\.?)(?=$|[\s|,;:/\-()[\]])/i,
    },
    {
      day: 5,
      regex: /(?:^|[\s|,;:/\-()[\]])(الجمعة|الجمعه|جمعة|جمعه|vendredi|ven\.?|friday|fri\.?)(?=$|[\s|,;:/\-()[\]])/i,
    },
  ];

  for (const p of patterns) {
    const match = normalizedDigits.match(p.regex);
    if (match && match[1]) {
      const cleaned = normalizedDigits.replace(match[1], ' ').replace(/\s+/g, ' ').trim();
      return { day: p.day, cleanedText: cleaned };
    }
  }

  // Tolerate 1-edit typos on words of length >= 5 (e.g. "Mercredy", "Wenesday", "Vendredy")
  const rawWords = normalizedDigits.split(/[\s|,;:/\-()[\]]+/).filter(Boolean);
  for (const w of rawWords) {
    const normW = normalizeForComparison(w);
    if (normW.length < 5) continue;
    for (const entry of DAY_DICTIONARY) {
      for (const term of entry.terms) {
        if (term.length >= 5 && levenshteinDistance(normW, term) <= 1) {
          const cleaned = normalizedDigits.replace(w, ' ').replace(/\s+/g, ' ').trim();
          return { day: entry.day, cleanedText: cleaned };
        }
      }
    }
  }

  return { day: null, cleanedText: normalizedDigits };
}

/**
 * Checks if a cell string is purely a weekday name header.
 */
export function matchPureDayHeader(cellText: string): WeekDay | null {
  const trimmed = cellText.trim().replace(/^[:\-–—•*]+|[:\-–—•*]+$/g, '').trim();
  if (!trimmed || trimmed.length > 22) return null;
  const { day, cleanedText } = detectDayOfWeekInText(trimmed);
  if (day !== null && cleanedText.replace(/[:\-–—.\s]/g, '').length === 0) {
    return day;
  }
  return null;
}

function to24HourHHmm(
  hourStr: string,
  minStr: string | undefined,
  meridiem?: string
): string | null {
  let h = parseInt(hourStr, 10);
  const m = minStr ? parseInt(minStr, 10) : 0;
  if (Number.isNaN(h) || Number.isNaN(m) || m < 0 || m > 59 || h < 0 || h > 24) {
    return null;
  }
  if (meridiem) {
    const mer = meridiem.toLowerCase().trim();
    const isPm = mer === 'pm' || mer === 'p.m.' || mer === 'م' || mer === 'مساء';
    const isAm = mer === 'am' || mer === 'a.m.' || mer === 'ص' || mer === 'صباحا';
    if (isPm && h < 12) h += 12;
    if (isAm && h === 12) h = 0;
  }
  if (h === 24) h = 0;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Extracts fixed slot definitions from the full pasted text, e.g.:
 * "S1 = 08:00-09:30", "S2: 09:45 - 11:15", "Séance 1 : 08h00-09h30"
 */
export function extractFixedSlotDefinitions(
  fullText: string
): Record<string, { startTime: string; endTime: string }> {
  const normalized = normalizeDigitsToWestern(fullText);
  const map: Record<string, { startTime: string; endTime: string }> = {
    s1: { startTime: '08:00', endTime: '09:30' },
    s2: { startTime: '09:45', endTime: '11:15' },
    s3: { startTime: '11:30', endTime: '13:00' },
    s4: { startTime: '14:00', endTime: '15:30' },
    s5: { startTime: '15:45', endTime: '17:15' },
    s6: { startTime: '17:30', endTime: '19:00' },
  };

  const defRegex =
    /\b(s\d|seance\s*\d|séance\s*\d|p\d|حصة\s*\d)\s*[=:–\-]\s*([0-2]?\d)[h:.]?([0-5]\d)?\s*(?:[-–—àa]|إلى|الى|to)\s*([0-2]?\d)[h:.]?([0-5]\d)?/gi;
  let m: RegExpExecArray | null;
  while ((m = defRegex.exec(normalized)) !== null) {
    const key = m[1].toLowerCase().replace(/\s+/g, '');
    const start = to24HourHHmm(m[2], m[3]);
    const end = to24HourHHmm(m[4], m[5]);
    if (start && end && isValidTimeOrder(start, end)) {
      map[key] = { startTime: start, endTime: end };
      const numMatch = key.match(/\d/);
      if (numMatch) {
        map[`s${numMatch[0]}`] = { startTime: start, endTime: end };
      }
    }
  }
  return map;
}

/**
 * Extracts a time range ("HH:mm", "HH:mm") from a text line or header cell.
 * Supports:
 * - "08:00-09:30", "8h00 - 9h30", "8h-9h30", "08.00 à 09.30"
 * - "٠٨:٠٠ - ٠٩:٣٠" (Arabic-Indic and Persian digits)
 * - "8:00 AM – 9:30 AM", "1:30 PM - 3:00 PM"
 * - "من 8 إلى 9:30", "de 8h à 9h30", "from 8:00 to 9:30"
 * - Single start time + "(1h30)" or "(90 min)" duration, or fallback to `defaultDurationMinutes`.
 */
export function extractTimeRangeFromText(
  rawText: string,
  defaultDurationMinutes: number = 90
): {
  startTime: string | null;
  endTime: string | null;
  inferredEnd: boolean;
  cleanedText: string;
} {
  let text = normalizeDigitsToWestern(rawText);

  // 1. Explicit range pattern
  const rangeRegex =
    /(?:(?:de|من|from)\s+)?\b([0-2]?\d)(?:\s*[:hH.]\s*([0-5]\d))?\s*(am|pm|a\.m\.|p\.m\.|ص|م|صباحا|مساء)?\s*(?:[-–—~]|à|a|au|to|إلى|الى)\s*([0-2]?\d)(?:\s*[:hH.]\s*([0-5]\d))?\s*(am|pm|a\.m\.|p\.m\.|ص|م|صباحا|مساء)?\b/i;

  const rangeMatch = text.match(rangeRegex);
  if (rangeMatch) {
    const rawH1 = rangeMatch[1];
    const rawM1 = rangeMatch[2];
    const mer1 = rangeMatch[3];
    const rawH2 = rangeMatch[4];
    const rawM2 = rangeMatch[5];
    const mer2 = rangeMatch[6];

    // Guard against matching dates like "05/10 - 25/01" or group ranges like "G1-G2"
    const hasTimeIndicator =
      rawText.includes(':') ||
      /[hH]/i.test(rangeMatch[0]) ||
      Boolean(rawM1) ||
      Boolean(rawM2) ||
      Boolean(mer1) ||
      Boolean(mer2) ||
      /(?:de|من|from|à|إلى|الى)/i.test(rangeMatch[0]);

    if (hasTimeIndicator) {
      let start = to24HourHHmm(rawH1, rawM1, mer1);
      let end = to24HourHHmm(rawH2, rawM2, mer2 || mer1);

      if (start && end) {
        // Handle afternoon 12h shorthand like "11:00 - 01:00" or "01:30 - 03:00" in daytime schedules
        const sMin = timeToMinutes(start);
        const eMin = timeToMinutes(end);
        if (!mer1 && !mer2) {
          const h1 = parseInt(rawH1, 10);
          const h2 = parseInt(rawH2, 10);
          if (h1 >= 1 && h1 <= 6 && h2 >= h1 && h2 <= 7) {
            start = minutesToTime(sMin + 12 * 60);
            end = minutesToTime(eMin + 12 * 60);
          } else if (eMin <= sMin && h2 >= 1 && h2 <= 7) {
            end = minutesToTime(eMin + 12 * 60);
          }
        }

        const cleaned = text.replace(rangeMatch[0], ' ').replace(/\s+/g, ' ').trim();
        return {
          startTime: start,
          endTime: end,
          inferredEnd: false,
          cleanedText: cleaned,
        };
      }
    }
  }

  // 2. Single start time with optional duration "(1h30)" or "(90 min)"
  const singleTimeRegex =
    /\b([0-2]?\d)\s*(?:[:hH]\s*([0-5]\d)|[hH])\s*(am|pm|ص|م)?\b/i;
  const singleMatch = text.match(singleTimeRegex);
  if (singleMatch) {
    const start = to24HourHHmm(singleMatch[1], singleMatch[2], singleMatch[3]);
    if (start) {
      let cleaned = text.replace(singleMatch[0], ' ');
      let durationMins = defaultDurationMinutes;
      let explicitDuration = false;

      // Check for "(1h30)", "1h30", "(90 min)", "(2h)"
      const durHMatch = cleaned.match(/\(\s*(\d)\s*h\s*([0-5]\d)?\s*\)/i);
      const durMinMatch = cleaned.match(/\(\s*(\d{2,3})\s*(?:min|m|د|دقيقة)\s*\)/i);
      if (durHMatch) {
        durationMins = parseInt(durHMatch[1], 10) * 60 + (durHMatch[2] ? parseInt(durHMatch[2], 10) : 0);
        explicitDuration = true;
        cleaned = cleaned.replace(durHMatch[0], ' ');
      } else if (durMinMatch) {
        durationMins = parseInt(durMinMatch[1], 10);
        explicitDuration = true;
        cleaned = cleaned.replace(durMinMatch[0], ' ');
      }

      const endMin = Math.min(23 * 60 + 55, timeToMinutes(start) + durationMins);
      return {
        startTime: start,
        endTime: minutesToTime(endMin),
        inferredEnd: !explicitDuration,
        cleanedText: cleaned.replace(/\s+/g, ' ').trim(),
      };
    }
  }

  return {
    startTime: null,
    endTime: null,
    inferredEnd: false,
    cleanedText: text,
  };
}

/**
 * Extracts section and group as SEPARATE fields.
 * Supports:
 * - Combined: "S1-G3", "Sec1/Gr3", "S2 G4", "Section A - Groupe 2"
 * - Section: "Section 1", "Sect. A", "Sec 2", "القسم 1", "قسم أ", "قسم 2"
 * - Group: "Groupe 3", "G3", "الفوج 3", "فوج 2", "Group 4", "Gr 5", "مجموعة 2"
 */
export function extractSectionAndGroup(rawText: string): {
  section: string;
  group: string;
  cleanedText: string;
} {
  let text = normalizeDigitsToWestern(rawText);
  let section = '';
  let group = '';

  // 1. Combined shorthand like "S1-G3", "Sec1/Gr3", "S2/G4", "S1 G2"
  const combinedRegex =
    /\b(?:sec(?:tion)?\.?|sect\.?|s)\s*([0-9a-zA-Z]+)\s*[-/·,\s]\s*(?:gr(?:oupe|oup)?\.?|grp\.?|g)\s*([0-9a-zA-Z]+)\b/i;
  const combMatch = text.match(combinedRegex);
  if (combMatch) {
    section = combMatch[1].toUpperCase();
    group = combMatch[2].toUpperCase();
    text = text.replace(combMatch[0], ' ');
  }

  // 2. Explicit Section in FR / EN / AR
  if (!section) {
    const secRegex =
      /(?:^|[\s|,;:/\-()[\]])(?:section|sect\.?|sec\.?|القسم|قسم|فصل)\s*[:#-]?\s*([0-9a-zA-Zأ-ي]+)(?=$|[\s|,;:/\-()[\]])/i;
    const secMatch = text.match(secRegex);
    if (secMatch && secMatch[1]) {
      section = secMatch[1].toUpperCase();
      text = text.replace(secMatch[0], ' ');
    }
  }

  // 3. Explicit Group in FR / EN / AR
  if (!group) {
    const grpRegex =
      /(?:^|[\s|,;:/\-()[\]])(?:groupe|group|grp\.?|gr\.?|الفوج|فوج|المجموعة|مجموعة)\s*[:#-]?\s*([0-9a-zA-Zأ-ي]+)(?=$|[\s|,;:/\-()[\]])/i;
    const grpMatch = text.match(grpRegex);
    if (grpMatch && grpMatch[1]) {
      group = grpMatch[1].toUpperCase();
      text = text.replace(grpMatch[0], ' ');
    } else {
      // Shorthand "G3", "G02"
      const shortGrpRegex = /(?:^|[\s|,;:/\-()[\]])[gG]\s*0*([1-9]\d?)(?=$|[\s|,;:/\-()[\]])/;
      const shortGrpMatch = text.match(shortGrpRegex);
      if (shortGrpMatch && shortGrpMatch[1]) {
        group = shortGrpMatch[1];
        text = text.replace(shortGrpMatch[0], ' ');
      }
    }
  }

  return {
    section,
    group,
    cleanedText: text.replace(/\s+/g, ' ').trim(),
  };
}

/**
 * Extracts teacher name with honorific title.
 * Supports: "Pr.", "Dr.", "Mme", "M.", "Mr", "Prof", "الأستاذ", "الأستاذة", "د.", "أ.د", " م.", "Enseignant:"
 */
export function extractTeacher(rawText: string): {
  teacher: string;
  cleanedText: string;
} {
  let text = rawText;

  const patterns: RegExp[] = [
    // Explicit label: "Enseignant: ...", "Professeur: ...", "Teacher: ..."
    /(?:enseignant(?:e)?|professeur|teacher|instructor|الأستاذ(?:ة)?)\s*:\s*([^|,;\n()]+)/i,
    // Arabic titles: "أ.د. بن علي", "د. بن علي", "الأستاذ كريم", "الأستاذة نادية"
    /(?:^|[\s|,;(/])((?:أ\.?\s*د\.?|د\.|أ\.|م\.|الأستاذة|الأستاذ|الدكتور(?:ة)?)\s+[\p{L}\s.'-]{2,28}?)(?=$|[|,;\n)]|\s+(?:القسم|قسم|الفوج|فوج|قاعة|مدرج|مخبر|مختبر|عن بعد|حضوري|section|groupe|group|salle|amphi|room|lab))/iu,
    // Latin titles: "Pr. Benali", "Dr. Smith", "Prof. Laurent Moreau", "Mme. Chami", "M. Karim"
    /(?:^|[\s|,;(/])((?:pr\.?|prof\.?|dr\.?|mme\.?|mlle\.?|mr\.?|m\.)\s+[A-ZÀ-ÖØ-Ýa-zà-öø-ÿ][A-ZÀ-ÖØ-Ýa-zà-öø-ÿ\s.'-]{1,28}?)(?=$|[|,;\n)]|\s+(?:section|sect|sec|groupe|group|gr|G\d|salle|amphi|room|lab|labo|bloc|online|en ligne|présentiel))/i,
  ];

  for (const reg of patterns) {
    const m = text.match(reg);
    if (m && m[1]) {
      const teacher = m[1].trim().replace(/[|,;-]+$/, '').trim();
      const cleaned = text.replace(m[1], ' ').replace(/\s+/g, ' ').trim();
      return { teacher, cleanedText: cleaned };
    }
  }

  return { teacher: '', cleanedText: text };
}

/**
 * Extracts room / hall / lab identifier.
 * Supports: "Salle 12", "Amphi A", "Bloc 3 S5", "Lab 2", "مدرج 4", "مدرج أ", "قاعة 7", "مخبر 1", "Room 203"
 */
export function extractRoom(rawText: string): {
  room: string;
  cleanedText: string;
} {
  let text = normalizeDigitsToWestern(rawText);

  const roomPatterns: RegExp[] = [
    // "Bloc 3 S5" or "Bâtiment A Salle 12"
    /\b((?:bloc|bâtiment|batiment|bât|bat)\s*[0-9a-zA-Z]+\s*(?:salle|s|amphi|labo?)?\s*[0-9a-zA-Z-]+)\b/i,
    // "Amphi A", "Amphithéâtre 3", "Salle 12", "Room 203", "Hall B"
    /\b((?:amphithéâtre|amphitheatre|amphi\.?|salle|room|hall|auditorium)\s+[0-9a-zA-ZÀ-ÖØ-öø-ÿ-]+(?:\s+[0-9]+)?)(?=$|[\s|,;:/\-()[\]]|\s+(?:pr\.?|dr\.?|prof\.?|mme\.?|section|groupe|group|gr\.?))/i,
    // "Labo 2", "Lab 104", "Laboratoire B1" (must have a room number/code)
    /\b((?:labo(?:ratoire)?|lab\.?)\s+[0-9a-zA-Z-]+)(?=$|[\s|,;:/\-()[\]]|\s+(?:pr\.?|dr\.?|prof\.?|mme\.?|section|groupe|group|gr\.?))/i,
    // Arabic rooms: "مدرج أ", "مدرج 4", "قاعة 12", "مخبر 1", "مختبر 2"
    /(?:^|[\s|,;(/])((?:مدرج|قاعة|قاعه|مخبر|مختبر|معمل)\s+[\p{L}\p{N}-]+(?:\s+[\p{N}a-zA-Z-]+)?)(?=$|[\s|,;)/]|\s+(?:د\.|أ\.|الأستاذ|القسم|قسم|الفوج|فوج))/iu,
  ];

  for (const reg of roomPatterns) {
    const m = text.match(reg);
    if (m && m[1]) {
      // Stop before teacher or section/group tokens if accidentally captured
      const rawRoom = m[1]
        .replace(/\b(?:pr\.?|prof\.?|dr\.?|mme\.?|mr\.?|section|groupe|group|القسم|الفوج).*$/i, '')
        .trim();
      if (rawRoom) {
        const cleaned = text.replace(rawRoom, ' ').replace(/\s+/g, ' ').trim();
        return { room: rawRoom, cleanedText: cleaned };
      }
    }
  }

  return { room: '', cleanedText: text };
}

/**
 * Extracts session type (lecture, td, tp, other, or unknown) using explicit keywords in AR/FR/EN
 * and contextual hints (room / group).
 */
export function detectSessionType(
  rawText: string,
  room: string,
  group: string
): {
  sessionType: ParsedSessionTypeChoice;
  cleanedText: string;
} {
  let text = rawText;

  // Explicit keyword patterns
  const rules: Array<{ type: SessionType; regex: RegExp }> = [
    {
      type: 'tp',
      regex:
        /(?:^|[\s|,;:/\-()[\]])(lab\s*\(tp\)|travaux\s+pratiques|\(tp\)|t\.?p\.?|أعمال\s+تطبيقية|اعمال\s+تطبيقية|حصة\s+تطبيقية|تطبيقي|practical|lab\s+session|\(lab\))(?=$|[\s|,;:/\-()[\]])/i,
    },
    {
      type: 'td',
      regex:
        /(?:^|[\s|,;:/\-()[\]])(travaux\s+dirig[ée]s|\(td\)|t\.?d\.?|أعمال\s+موجهة|اعمال\s+موجهة|حصة\s+توجيهية|ورشة|tutorial|recitation)(?=$|[\s|,;:/\-()[\]])/i,
    },
    {
      type: 'lecture',
      regex:
        /(?:^|[\s|,;:/\-()[\]])(cours\s+magistral|\(cours\)|\(cm\)|cours|c\.?m\.?|محاضرة|محاضره|درس\s+نظري|lecture)(?=$|[\s|,;:/\-()[\]])/i,
    },
    {
      type: 'other',
      regex:
        /(?:^|[\s|,;:/\-()[\]])(soutenance|stage|s[ée]minaire|rattrapage|examen|exam|امتحان|مناقشة|ندوة|تعويض)(?=$|[\s|,;:/\-()[\]])/i,
    },
  ];

  for (const r of rules) {
    const m = text.match(r.regex);
    if (m && m[1]) {
      const cleaned = text
        .replace(m[1], ' ')
        .replace(/(?:^|[\s|,;(/])(lab|practical|tutorial)(?=$|[\s|,;)/])/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      return { sessionType: r.type, cleanedText: cleaned };
    }
  }

  // Standalone "Lab" when not part of "Room Lab 2" (already extracted into `room`)
  const standaloneLab = text.match(/(?:^|[\s|,;(/])(lab|مخبر|مختبر)(?=$|[\s|,;)/])/i);
  if (standaloneLab && standaloneLab[1]) {
    const cleaned = text.replace(standaloneLab[1], ' ').replace(/\s+/g, ' ').trim();
    return { sessionType: 'tp', cleanedText: cleaned };
  }

  // Contextual inference from extracted room or group
  const normRoom = room.toLowerCase();
  if (/amphi|مدرج|auditorium/.test(normRoom)) {
    return { sessionType: 'lecture', cleanedText: text };
  }
  if (/labo|lab|مخبر|مختبر|معمل/.test(normRoom)) {
    return { sessionType: 'tp', cleanedText: text };
  }
  if (group && !normRoom.includes('amphi')) {
    if (/\btd\d*\b/i.test(text)) return { sessionType: 'td', cleanedText: text };
    if (/\btp\d*\b/i.test(text)) return { sessionType: 'tp', cleanedText: text };
  }

  return { sessionType: 'unknown', cleanedText: text };
}

/**
 * Extracts the first HTTP/HTTPS URL from text if present.
 */
export function extractUrl(rawText: string): { url?: string; cleanedText: string } {
  const m = rawText.match(/https?:\/\/[^\s|,;)"'>]+/i);
  if (!m) return { cleanedText: rawText };
  return {
    url: m[0],
    cleanedText: rawText.replace(m[0], ' ').replace(/\s+/g, ' ').trim(),
  };
}

/**
 * Extracts delivery mode (in_person, remote, hybrid), meeting link URL, and platform.
 */
export function extractDeliveryModeAndLink(
  rawText: string,
  extractedRoom: string
): {
  mode: DeliveryMode;
  meetingUrl: string;
  platform?: MeetingPlatform;
  cleanedText: string;
} {
  let text = rawText;
  let meetingUrl = '';

  const urlMatch = text.match(/https?:\/\/[^\s|,;)"'>]+/i);
  if (urlMatch) {
    meetingUrl = urlMatch[0];
    text = text.replace(urlMatch[0], ' ');
  }

  const isHybridKeyword =
    /(?:^|[\s|,;(/])(hybride|hybrid|blended|مختلط|مدمج)(?=$|[\s|,;)/])/i.test(text);
  const remoteRegex =
    /(?:^|[\s|,;(/])(en\s+ligne|à\s+distance|a\s+distance|distanciel|online|remote|virtual|zoom|google\s+meet|teams|moodle|عن\s+بعد|أونلاين|اونلاين)(?=$|[\s|,;)/])/i;
  const inPersonRegex =
    /(?:^|[\s|,;(/])(pr[ée]sentiel|on-site|in\s+person|حضوري)(?=$|[\s|,;)/])/i;

  const isRemoteKeyword = remoteRegex.test(text) || Boolean(meetingUrl);

  text = text
    .replace(remoteRegex, ' ')
    .replace(inPersonRegex, ' ')
    .replace(/(?:^|[\s|,;(/])(hybride|hybrid|blended|مختلط|مدمج)(?=$|[\s|,;)/])/gi, ' ');

  let mode: DeliveryMode = 'in_person';
  if (isHybridKeyword || (isRemoteKeyword && Boolean(extractedRoom))) {
    mode = isHybridKeyword ? 'hybrid' : meetingUrl && extractedRoom ? 'hybrid' : 'remote';
  } else if (isRemoteKeyword) {
    mode = 'remote';
  }

  const platform = detectMeetingPlatform(meetingUrl, rawText);

  return {
    mode,
    meetingUrl,
    platform,
    cleanedText: text.replace(/\s+/g, ' ').trim(),
  };
}

/**
 * Extracts recurrence & odd/even week parity ("semaine A/B", "chaque quinzaine", "أسبوع فردي/زوجي").
 */
export function extractRecurrenceAndParity(rawText: string): {
  recurrence: RecurrenceType;
  weekParity: WeekParity;
  cleanedText: string;
} {
  let text = normalizeDigitsToWestern(rawText);
  let recurrence: RecurrenceType = 'weekly';
  let weekParity: WeekParity = 'all';

  const oddRegex =
    /(?:^|[\s|,;(/])(semaine\s*a|sem\.?\s*a|semaine\s+impaire|أسبوع\s+فردي|اسبوع\s+فردي|odd\s+week(?:s)?|week\s*a)(?=$|[\s|,;)/])/i;
  const evenRegex =
    /(?:^|[\s|,;(/])(semaine\s*b|sem\.?\s*b|semaine\s+paire|أسبوع\s+زوجي|اسبوع\s+زوجي|even\s+week(?:s)?|week\s*b)(?=$|[\s|,;)/])/i;
  const biweeklyRegex =
    /(?:^|[\s|,;(/])(chaque\s+quinzaine|1\s*sem(?:aine)?\s*\/\s*2|bi-?weekly|كل\s+أسبوعين|كل\s+اسبوعين)(?=$|[\s|,;)/])/i;

  if (oddRegex.test(text)) {
    recurrence = 'biweekly';
    weekParity = 'odd';
    text = text.replace(oddRegex, ' ');
  } else if (evenRegex.test(text)) {
    recurrence = 'biweekly';
    weekParity = 'even';
    text = text.replace(evenRegex, ' ');
  } else if (biweeklyRegex.test(text)) {
    recurrence = 'biweekly';
    text = text.replace(biweeklyRegex, ' ');
  }

  return {
    recurrence,
    weekParity,
    cleanedText: text.replace(/\s+/g, ' ').trim(),
  };
}

/**
 * Extracts semester start and end dates ("du 05/10/2026 au 25/01/2027", "من 2026-09-15 إلى 2027-01-20").
 */
export function extractSemesterDateRange(fullText: string): {
  semesterStart?: string;
  semesterEnd?: string;
} {
  const norm = normalizeDigitsToWestern(fullText);

  // ISO range: 2026-09-15 .. 2027-01-20
  const isoMatch = norm.match(
    /\b(20\d{2}-\d{2}-\d{2})\s*(?:[-–—]|au|to|إلى|الى)\s*(20\d{2}-\d{2}-\d{2})\b/i
  );
  if (isoMatch) {
    return { semesterStart: isoMatch[1], semesterEnd: isoMatch[2] };
  }

  // DD/MM/YYYY or DD/MM range: "du 05/10/2026 au 25/01/2027" or "du 05/10 au 25/01"
  const dmyMatch = norm.match(
    /(?:du|from|من)?\s*\b([0-3]?\d)[/-]([01]?\d)(?:[/-](20\d{2}))?\s*(?:au|to|إلى|الى|[-–—])\s*([0-3]?\d)[/-]([01]?\d)(?:[/-](20\d{2}))?\b/i
  );
  if (dmyMatch) {
    const d1 = dmyMatch[1].padStart(2, '0');
    const m1 = dmyMatch[2].padStart(2, '0');
    const y1 = dmyMatch[3] || '2026';
    const d2 = dmyMatch[4].padStart(2, '0');
    const m2 = dmyMatch[5].padStart(2, '0');
    const defaultY2 =
      !dmyMatch[6] && parseInt(m2, 10) < parseInt(m1, 10)
        ? String(parseInt(y1, 10) + 1)
        : y1;
    const y2 = dmyMatch[6] || defaultY2;
    return {
      semesterStart: `${y1}-${m1}-${d1}`,
      semesterEnd: `${y2}-${m2}-${d2}`,
    };
  }

  return {};
}

/**
 * Determines if a line is header/footer/legend noise that should be ignored.
 */
export function isNoiseLine(rawLine: string): boolean {
  const trimmed = rawLine.trim();
  if (!trimmed) return true;
  if (/^[-=_*•#~─━│|+]+$/.test(trimmed)) return true;
  if (/^page\s*\d+(\s*\/\s*\d+)?$/i.test(trimmed)) return true;

  // Standalone semester date range header line
  const semRange = extractSemesterDateRange(trimmed);
  if (semRange.semesterStart && semRange.semesterEnd && detectDayOfWeekInText(trimmed).day === null) {
    return true;
  }

  const norm = normalizeForComparison(trimmed);
  if (!norm) return true;

  // Common university document headers/footers without any time or weekday
  const hasDay = detectDayOfWeekInText(trimmed).day !== null;
  const hasTime = extractTimeRangeFromText(trimmed).startTime !== null;

  if (!hasDay && !hasTime) {
    const noiseHeaderRegex =
      /^(universite|faculte|departement|emploi du temps|annee universitaire|semestre|schedule|timetable|faculty of|university of|جدول الحصص|الجدول الزمني|جامعة|كلية|قسم|السنة الجامعية|السداسي)/i;
    if (noiseHeaderRegex.test(norm)) return true;
  }

  return false;
}

/**
 * Sanitizes clipboard HTML (strips scripts/styles) and extracts `<table>` rows & cells,
 * expanding `colspan` and `rowspan` so merged cells align accurately with their day/time axes.
 */
export function sanitizeClipboardHtmlToGrid(html: string): string[][] {
  if (!html || !/<table/i.test(html)) return [];

  // Strip script, style, comments
  const safeHtml = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '');

  const trMatches = safeHtml.match(/<tr[\s\S]*?<\/tr>/gi);
  if (!trMatches || trMatches.length === 0) return [];

  const grid: string[][] = [];
  const spanCarry: Map<string, string> = new Map(); // key "r,c" -> text

  for (let r = 0; r < trMatches.length; r++) {
    const rowHtml = trMatches[r];
    const cellRegex = /<(td|th)([^>]*)>([\s\S]*?)<\/\1>/gi;
    const rowCells: string[] = [];
    let c = 0;

    while (spanCarry.has(`${r},${c}`)) {
      rowCells.push(spanCarry.get(`${r},${c}`) ?? '');
      c++;
    }

    let cellMatch: RegExpExecArray | null;
    while ((cellMatch = cellRegex.exec(rowHtml)) !== null) {
      while (spanCarry.has(`${r},${c}`)) {
        rowCells.push(spanCarry.get(`${r},${c}`) ?? '');
        c++;
      }

      const attrs = cellMatch[2] || '';
      const rawInner = cellMatch[3] || '';

      // Preserve line breaks inside cells (<br>, </p>, </div>)
      const cellText = rawInner
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/(p|div|li)>/gi, '\n')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&quot;/gi, '"')
        .replace(/[ \t]+/g, ' ')
        .trim();

      const colspanMatch = attrs.match(/colspan\s*=\s*["']?(\d+)/i);
      const rowspanMatch = attrs.match(/rowspan\s*=\s*["']?(\d+)/i);
      const colspan = Math.max(1, Math.min(14, colspanMatch ? parseInt(colspanMatch[1], 10) : 1));
      const rowspan = Math.max(1, Math.min(14, rowspanMatch ? parseInt(rowspanMatch[1], 10) : 1));

      for (let dr = 0; dr < rowspan; dr++) {
        for (let dc = 0; dc < colspan; dc++) {
          if (dr === 0 && dc === 0) continue;
          spanCarry.set(`${r + dr},${c + dc}`, cellText);
        }
      }

      rowCells.push(cellText);
      c++;
      for (let dc = 1; dc < colspan; dc++) {
        rowCells.push(cellText);
        c++;
      }
    }

    while (spanCarry.has(`${r},${c}`)) {
      rowCells.push(spanCarry.get(`${r},${c}`) ?? '');
      c++;
    }

    if (rowCells.some((cell) => cell.trim().length > 0)) {
      grid.push(rowCells);
    }
  }

  return grid;
}

/**
 * Parses tab-separated (TSV) or CSV/semicolon-separated text into a 2D grid if it looks like a table.
 */
export function parseDelimitedTextToGrid(rawText: string): string[][] {
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !/^[-=_*•#~─━│|+]+$/.test(l));

  if (lines.length < 2) return [];

  // Prefer tab-separated if at least 2 lines have >= 2 tabs
  const tabLines = lines.filter((l) => (l.match(/\t/g) || []).length >= 2);
  if (tabLines.length >= 2) {
    return lines.map((l) => l.split('\t').map((c) => c.trim()));
  }

  // Check if first line is a header of multiple days or time slots separated by ; or | or ,
  for (const sep of [';', '|', ',']) {
    const firstParts = lines[0].split(sep).map((c) => c.trim());
    if (firstParts.length >= 3) {
      const dayMatches = firstParts.filter((p) => matchPureDayHeader(p) !== null).length;
      const timeMatches = firstParts.filter(
        (p) => extractTimeRangeFromText(p).startTime !== null
      ).length;
      if (dayMatches >= 2 || timeMatches >= 2) {
        return lines.map((l) => l.split(sep).map((c) => c.trim()));
      }
    }
  }

  return [];
}

/**
 * Cleans up leftover noise tokens from a subject name.
 */
function cleanSubjectName(raw: string): string {
  return raw
    .replace(/(?:^|[\s|,;:/\-()[\]])(حصة|ساعة|مادة|module|matière|matiere|course|subject)(?=$|[\s|,;:/\-()[\]])/gi, ' ')
    .replace(/^[\s|,;:/\-–—•*()[\]]+|[\s|,;:/\-–—•*()[\]]+$/g, '')
    .replace(/\s*[|,;•]\s*/g, ' ')
    .replace(/\(\s*\)/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Parses a single class chunk with optional inherited day, time range, or fallback subject name.
 */
function parseClassChunk(
  chunkText: string,
  context: {
    inheritedDay: WeekDay | null;
    inheritedStartTime: string | null;
    inheritedEndTime: string | null;
    inferredTimeFromSlot: boolean;
    lastSubjectName: string;
    existingSubjects: Subject[];
    defaultDurationMinutes: number;
    colorCounter: number;
    semesterStart?: string;
    semesterEnd?: string;
  }
): ParsedTimetableRow | null {
  const sourceText = chunkText.trim();
  if (!sourceText) return null;

  let working = normalizeDigitsToWestern(sourceText);

  // 1. Delivery mode & meeting URL first (so URLs don't interfere with room/time regexes)
  const modeInitial = extractDeliveryModeAndLink(working, '');
  working = modeInitial.cleanedText;

  // 2. Day of week
  const dayRes = detectDayOfWeekInText(working);
  const dayOfWeek = dayRes.day !== null ? dayRes.day : context.inheritedDay;
  if (dayRes.day !== null) {
    working = dayRes.cleanedText;
  }

  // 3. Time range
  const timeRes = extractTimeRangeFromText(working, context.defaultDurationMinutes);
  const startTime = timeRes.startTime ?? context.inheritedStartTime ?? '08:00';
  const endTime =
    timeRes.endTime ??
    context.inheritedEndTime ??
    minutesToTime(timeToMinutes(startTime) + context.defaultDurationMinutes);
  const hasExplicitTime =
    timeRes.startTime !== null || context.inheritedStartTime !== null;
  const inferredEnd =
    (timeRes.startTime !== null && timeRes.inferredEnd) || context.inferredTimeFromSlot;
  if (timeRes.startTime !== null) {
    working = timeRes.cleanedText;
  }

  // 4. Recurrence & Odd/Even parity
  const recRes = extractRecurrenceAndParity(working);
  working = recRes.cleanedText;

  // 5. Section & Group (separated!)
  const secGrpRes = extractSectionAndGroup(working);
  working = secGrpRes.cleanedText;

  // 6. Teacher
  const teacherRes = extractTeacher(working);
  working = teacherRes.cleanedText;

  // 7. Room
  const roomRes = extractRoom(working);
  working = roomRes.cleanedText;

  // Re-evaluate delivery mode now that we know `roomRes.room`
  const modeFinal = extractDeliveryModeAndLink(sourceText, roomRes.room);

  // 8. Session Type (Lecture / TD / TP / Other / Unknown)
  const typeRes = detectSessionType(working, roomRes.room, secGrpRes.group);
  working = typeRes.cleanedText;

  // 9. Remaining text -> Subject Name
  let subjectName = cleanSubjectName(working);
  if (!subjectName && context.lastSubjectName) {
    subjectName = context.lastSubjectName;
  }

  // If the line had neither a subject nor any class attributes, skip it
  if (
    !subjectName &&
    typeRes.sessionType === 'unknown' &&
    !roomRes.room &&
    !teacherRes.teacher &&
    !secGrpRes.group &&
    !secGrpRes.section
  ) {
    return null;
  }

  // Fuzzy match subject against existing subjects
  const { matchedSubject, similarity } = fuzzyMatchSubject(
    subjectName,
    context.existingSubjects
  );
  const finalSubjectName = matchedSubject ? matchedSubject.name : subjectName;
  const proposedColor: SubjectColorId = matchedSubject
    ? matchedSubject.color
    : SUBJECT_COLOR_LIST[context.colorCounter % SUBJECT_COLOR_LIST.length];

  // Build issues & confidence score (0 - 100)
  const issues: ParseIssueCode[] = [];
  let confidence = 96;

  if (!hasExplicitTime) {
    issues.push('missing_time');
    confidence -= 30;
  } else if (inferredEnd) {
    issues.push('inferred_end_time');
    confidence -= 12;
  }

  if (!isValidTimeOrder(startTime, endTime)) {
    issues.push('invalid_time_order');
    confidence -= 35;
  }

  if (dayOfWeek === null) {
    issues.push('unknown_day');
    confidence -= 28;
  }

  if (typeRes.sessionType === 'unknown') {
    issues.push('unknown_type');
    confidence -= 16;
  }

  if (!finalSubjectName) {
    issues.push('missing_subject');
    confidence -= 30;
  }

  confidence = Math.max(15, Math.min(100, confidence));

  return {
    id: `parsed-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    include: true,
    sourceText,
    subjectName: finalSubjectName,
    matchedSubjectId: matchedSubject?.id ?? null,
    matchedSimilarity: similarity,
    proposedColor,
    sessionType: typeRes.sessionType,
    dayOfWeek,
    startTime,
    endTime,
    section: secGrpRes.section,
    group: secGrpRes.group,
    teacher: teacherRes.teacher,
    room: roomRes.room,
    mode: modeFinal.mode,
    meetingUrl: modeFinal.meetingUrl,
    platform: modeFinal.platform,
    recurrence: recRes.recurrence,
    weekParity: recRes.weekParity,
    semesterStart: context.semesterStart,
    semesterEnd: context.semesterEnd,
    confidence,
    issues,
    conflictWithSlotIds: [],
    conflictWithRowIds: [],
  };
}

/**
 * Recomputes conflicts and duplicates across all parsed rows and existing timetable slots.
 */
export function recomputeImportAnalysis(
  rows: ParsedTimetableRow[],
  existingSubjects: Subject[],
  existingSlots: TimetableSlot[]
): ParsedTimetableResult {
  const updatedRows: ParsedTimetableRow[] = rows.map((row) => {
    // Re-evaluate fuzzy match if user edited subjectName
    const { matchedSubject, similarity } = fuzzyMatchSubject(
      row.subjectName,
      existingSubjects
    );

    const baseIssues: ParseIssueCode[] = row.issues.filter(
      (iss) =>
        iss !== 'conflict_existing' &&
        iss !== 'conflict_imported' &&
        iss !== 'duplicate_existing' &&
        iss !== 'invalid_time_order' &&
        iss !== 'unknown_day' &&
        iss !== 'unknown_type' &&
        iss !== 'missing_subject'
    );

    if (!isValidTimeOrder(row.startTime, row.endTime)) {
      baseIssues.push('invalid_time_order');
    }
    if (row.dayOfWeek === null) {
      baseIssues.push('unknown_day');
    }
    if (row.sessionType === 'unknown') {
      baseIssues.push('unknown_type');
    }
    if (!row.subjectName.trim()) {
      baseIssues.push('missing_subject');
    }

    return {
      ...row,
      matchedSubjectId: row.matchedSubjectId ?? matchedSubject?.id ?? null,
      matchedSimilarity: similarity,
      issues: baseIssues,
      duplicateOfSlotId: undefined,
      conflictWithSlotIds: [],
      conflictWithRowIds: [],
    };
  });

  // Check duplicates and overlaps against existingSlots and between included rows
  for (let i = 0; i < updatedRows.length; i++) {
    const r = updatedRows[i];
    if (r.dayOfWeek === null || !isValidTimeOrder(r.startTime, r.endTime)) continue;

    for (const slot of existingSlots) {
      if (slot.dayOfWeek !== r.dayOfWeek) continue;
      if (!doTimeRangesOverlap(r.startTime, r.endTime, slot.startTime, slot.endTime)) continue;

      const existingSubj = existingSubjects.find((s) => s.id === slot.subjectId);
      const sameTime = slot.startTime === r.startTime && slot.endTime === r.endTime;
      const sameSubject =
        r.matchedSubjectId === slot.subjectId ||
        (existingSubj &&
          computeStringSimilarity(r.subjectName, existingSubj.name) >= 0.72);
      const sameType =
        !slot.type || r.sessionType === 'unknown' || slot.type === r.sessionType;
      const sameGroup = (slot.group || '') === (r.group || '');

      if (sameTime && sameSubject && sameType && sameGroup) {
        r.duplicateOfSlotId = slot.id;
        if (!r.issues.includes('duplicate_existing')) {
          r.issues.push('duplicate_existing');
        }
      } else {
        r.conflictWithSlotIds.push(slot.id);
        if (!r.issues.includes('conflict_existing')) {
          r.issues.push('conflict_existing');
        }
      }
    }

    // Check overlaps between included imported rows
    for (let j = 0; j < updatedRows.length; j++) {
      if (i === j) continue;
      const other = updatedRows[j];
      if (!r.include || !other.include) continue;
      if (other.dayOfWeek !== r.dayOfWeek) continue;
      if (!isValidTimeOrder(other.startTime, other.endTime)) continue;

      if (doTimeRangesOverlap(r.startTime, r.endTime, other.startTime, other.endTime)) {
        // Allow odd/even week alternation on the same slot without conflict
        if (
          (r.weekParity === 'odd' && other.weekParity === 'even') ||
          (r.weekParity === 'even' && other.weekParity === 'odd')
        ) {
          continue;
        }
        r.conflictWithRowIds.push(other.id);
        if (!r.issues.includes('conflict_imported')) {
          r.issues.push('conflict_imported');
        }
      }
    }

    // Recompute confidence
    let score = 96;
    if (r.issues.includes('missing_time')) score -= 30;
    if (r.issues.includes('inferred_end_time')) score -= 12;
    if (r.issues.includes('invalid_time_order')) score -= 35;
    if (r.issues.includes('unknown_day')) score -= 28;
    if (r.issues.includes('unknown_type')) score -= 16;
    if (r.issues.includes('missing_subject')) score -= 30;
    if (r.issues.includes('conflict_existing') || r.issues.includes('conflict_imported')) {
      score -= 10;
    }
    r.confidence = Math.max(15, Math.min(100, score));
  }

  const activeRows = updatedRows.filter((r) => r.include);
  const needsReviewCount = activeRows.filter(
    (r) =>
      r.confidence < 85 ||
      r.issues.some((iss) =>
        [
          'missing_time',
          'inferred_end_time',
          'invalid_time_order',
          'unknown_day',
          'unknown_type',
          'missing_subject',
        ].includes(iss)
      )
  ).length;
  const conflictCount = activeRows.filter(
    (r) =>
      r.issues.includes('conflict_existing') || r.issues.includes('conflict_imported')
  ).length;
  const duplicateCount = activeRows.filter((r) =>
    r.issues.includes('duplicate_existing')
  ).length;

  return {
    rows: updatedRows,
    totalDetected: updatedRows.length,
    needsReviewCount,
    conflictCount,
    duplicateCount,
  };
}

/**
 * Parses a 2D table grid (where days are columns and time slots are rows, OR days are rows and time slots are columns).
 */
function parseGridTable(
  grid: string[][],
  slotDefs: Record<string, { startTime: string; endTime: string }>,
  existingSubjects: Subject[],
  defaultDurationMinutes: number,
  semesterStart?: string,
  semesterEnd?: string
): ParsedTimetableRow[] {
  if (grid.length < 2) return [];

  const resolveHeaderTime = (
    cell: string
  ): { startTime: string; endTime: string } | null => {
    const tRes = extractTimeRangeFromText(cell, defaultDurationMinutes);
    if (tRes.startTime && tRes.endTime) {
      return { startTime: tRes.startTime, endTime: tRes.endTime };
    }
    const normKey = normalizeDigitsToWestern(cell).toLowerCase().replace(/\s+/g, '');
    if (normKey in slotDefs) {
      return slotDefs[normKey];
    }
    return null;
  };

  // Detect if Row 0 has Day headers (days as columns) or Time headers (times as columns)
  const colDays: Map<number, WeekDay> = new Map();
  const colTimes: Map<number, { startTime: string; endTime: string }> = new Map();

  for (let c = 0; c < grid[0].length; c++) {
    const headerCell = grid[0][c];
    const day = matchPureDayHeader(headerCell) ?? detectDayOfWeekInText(headerCell).day;
    if (day !== null) {
      colDays.set(c, day);
    }
    const timeSlot = resolveHeaderTime(headerCell);
    if (timeSlot) {
      colTimes.set(c, timeSlot);
    }
  }

  const parsedRows: ParsedTimetableRow[] = [];
  let colorCounter = 0;
  let lastSubjectName = '';

  const daysAreColumns = colDays.size >= 2;
  const timesAreColumns = !daysAreColumns && colTimes.size >= 2;

  if (!daysAreColumns && !timesAreColumns) {
    return [];
  }

  const seenMergedSignature = new Set<string>();

  for (let r = 1; r < grid.length; r++) {
    const row = grid[r];
    if (!row || row.length === 0) continue;

    const firstCell = row[0] ?? '';
    const rowTime = daysAreColumns ? resolveHeaderTime(firstCell) : null;
    const rowDay = timesAreColumns
      ? matchPureDayHeader(firstCell) ?? detectDayOfWeekInText(firstCell).day
      : null;

    for (let c = 1; c < row.length; c++) {
      const cellText = (row[c] ?? '').trim();
      if (!cellText || /^[-—–/]+$/.test(cellText)) continue;

      const day = daysAreColumns ? (colDays.get(c) ?? null) : rowDay;
      const timeSlot = daysAreColumns ? rowTime : (colTimes.get(c) ?? null);

      if (day === null && !timeSlot) continue;

      // Avoid duplicating identical merged cell across two time slots on the same day if it already has an explicit time range
      const explicitCellTime = extractTimeRangeFromText(cellText, defaultDurationMinutes);
      const effStart = explicitCellTime.startTime ?? timeSlot?.startTime ?? '08:00';
      const effEnd = explicitCellTime.endTime ?? timeSlot?.endTime ?? '09:30';
      const sig = `${day}-${effStart}-${effEnd}-${cellText}`;
      if (seenMergedSignature.has(sig)) continue;
      seenMergedSignature.add(sig);

      // A single table cell might contain 2 classes separated by a blank line or "//"
      const subBlocks = cellText.split(/\n\s*\n|\s+\/\/\s+/).filter(Boolean);
      for (const block of subBlocks) {
        const singleLineBlock = block.replace(/\r?\n/g, ' | ');
        const parsed = parseClassChunk(singleLineBlock, {
          inheritedDay: day,
          inheritedStartTime: timeSlot?.startTime ?? null,
          inheritedEndTime: timeSlot?.endTime ?? null,
          inferredTimeFromSlot: false,
          lastSubjectName,
          existingSubjects,
          defaultDurationMinutes,
          colorCounter,
          semesterStart,
          semesterEnd,
        });
        if (parsed) {
          if (parsed.subjectName) lastSubjectName = parsed.subjectName;
          colorCounter++;
          parsedRows.push(parsed);
        }
      }
    }
  }

  return parsedRows;
}

/**
 * Parses `.ics` iCalendar content into reviewable timetable rows.
 */
export function parseIcsToRows(
  icsText: string,
  existingSubjects: Subject[],
  existingSlots: TimetableSlot[] = [],
  defaultDurationMinutes: number = 90
): ParsedTimetableResult {
  const eventBlocks = icsText.match(/BEGIN:VEVENT[\s\S]*?END:VEVENT/gi) || [];
  const rows: ParsedTimetableRow[] = [];
  let colorCounter = 0;

  for (const block of eventBlocks) {
    const summaryMatch = block.match(/SUMMARY(?:;[^:]*)?:(.+)/i);
    const locationMatch = block.match(/LOCATION(?:;[^:]*)?:(.+)/i);
    const descMatch = block.match(/DESCRIPTION(?:;[^:]*)?:(.+)/i);
    const dtStartMatch = block.match(/DTSTART(?:;[^:]*)?:(\d{8})T(\d{4})/i);
    const dtEndMatch = block.match(/DTEND(?:;[^:]*)?:(\d{8})T(\d{4})/i);

    if (!summaryMatch || !dtStartMatch) continue;
    const summary = summaryMatch[1].trim();
    const location = locationMatch ? locationMatch[1].trim() : '';
    const desc = descMatch ? descMatch[1].trim().replace(/\\n/g, ' ') : '';

    const datePart = dtStartMatch[1];
    const startT = `${dtStartMatch[2].slice(0, 2)}:${dtStartMatch[2].slice(2, 4)}`;
    const endT = dtEndMatch
      ? `${dtEndMatch[2].slice(0, 2)}:${dtEndMatch[2].slice(2, 4)}`
      : minutesToTime(timeToMinutes(startT) + defaultDurationMinutes);

    const y = parseInt(datePart.slice(0, 4), 10);
    const m = parseInt(datePart.slice(4, 6), 10) - 1;
    const d = parseInt(datePart.slice(6, 8), 10);
    const localDate = new Date(y, m, d, 12, 0, 0);
    const dow = localDate.getDay() as WeekDay;

    const combinedLine = `${summary} | ${location} | ${desc}`;
    const parsed = parseClassChunk(combinedLine, {
      inheritedDay: dow,
      inheritedStartTime: startT,
      inheritedEndTime: endT,
      inferredTimeFromSlot: false,
      lastSubjectName: '',
      existingSubjects,
      defaultDurationMinutes,
      colorCounter,
    });
    if (parsed) {
      colorCounter++;
      rows.push(parsed);
    }
  }

  return recomputeImportAnalysis(rows, existingSubjects, existingSlots);
}

/**
 * Main entry point for Waqti's deterministic offline Smart Paste Timetable Parser.
 */
export function parseSmartTimetable(input: {
  plainText?: string;
  htmlText?: string;
  existingSubjects: Subject[];
  existingSlots?: TimetableSlot[];
  defaultDurationMinutes?: number;
}): ParsedTimetableResult {
  const plainText = input.plainText ?? '';
  const htmlText = input.htmlText ?? '';
  const existingSubjects = input.existingSubjects ?? [];
  const existingSlots = input.existingSlots ?? [];
  const defaultDurationMinutes = input.defaultDurationMinutes ?? 90;

  // Handle .ics files if pasted or uploaded
  if (/BEGIN:VCALENDAR/i.test(plainText)) {
    return parseIcsToRows(
      plainText,
      existingSubjects,
      existingSlots,
      defaultDurationMinutes
    );
  }

  const combinedForMeta = `${plainText}\n${htmlText.replace(/<[^>]+>/g, ' ')}`;
  const slotDefs = extractFixedSlotDefinitions(combinedForMeta);
  const { semesterStart, semesterEnd } = extractSemesterDateRange(combinedForMeta);

  let rows: ParsedTimetableRow[] = [];

  // 1. Try HTML table grid first if present
  if (htmlText && /<table/i.test(htmlText)) {
    const htmlGrid = sanitizeClipboardHtmlToGrid(htmlText);
    rows = parseGridTable(
      htmlGrid,
      slotDefs,
      existingSubjects,
      defaultDurationMinutes,
      semesterStart,
      semesterEnd
    );
  }

  // 2. Try TSV / CSV / semicolon grid if HTML table didn't produce rows
  if (rows.length === 0 && plainText.trim()) {
    const textGrid = parseDelimitedTextToGrid(plainText);
    if (textGrid.length >= 2) {
      rows = parseGridTable(
        textGrid,
        slotDefs,
        existingSubjects,
        defaultDurationMinutes,
        semesterStart,
        semesterEnd
      );
    }
  }

  // 3. Parse line-by-line (List layout, Per-day blocks, and Messy copies)
  if (rows.length === 0 && plainText.trim()) {
    const rawLines = plainText.split(/\r?\n/);
    let currentBlockDay: WeekDay | null = null;
    let lastSubjectName = '';
    let colorCounter = 0;

    for (const rawLine of rawLines) {
      const trimmed = rawLine.trim();
      if (!trimmed) continue;

      // Skip explicit slot definition lines like "S1 = 08:00 - 09:30"
      if (
        /^\s*(?:s\d|seance\s*\d|séance\s*\d|p\d)\s*[=:]\s*[0-2]?\d/i.test(
          normalizeDigitsToWestern(trimmed)
        )
      ) {
        continue;
      }

      // Check if the line is a standalone Day Header (e.g. "Lundi:" or "الأحد")
      const headerDay = matchPureDayHeader(trimmed);
      if (headerDay !== null) {
        currentBlockDay = headerDay;
        continue;
      }

      if (isNoiseLine(trimmed)) {
        continue;
      }

      // Check if line references a fixed slot like "S1" without an explicit time
      let inheritedStart: string | null = null;
      let inheritedEnd: string | null = null;
      let workingLine = trimmed;
      const hasTime = extractTimeRangeFromText(trimmed, defaultDurationMinutes).startTime !== null;
      if (!hasTime) {
        const slotRefMatch = normalizeDigitsToWestern(trimmed).match(
          /(?:^|[\s|,;:/\-()[\]])(s[1-6])(?=$|[\s|,;:/\-()[\]])/i
        );
        if (slotRefMatch && slotRefMatch[1]) {
          const key = slotRefMatch[1].toLowerCase();
          if (slotDefs[key]) {
            inheritedStart = slotDefs[key].startTime;
            inheritedEnd = slotDefs[key].endTime;
            workingLine = workingLine.replace(slotRefMatch[1], ' ');
          }
        }
      }

      const parsed = parseClassChunk(workingLine, {
        inheritedDay: currentBlockDay,
        inheritedStartTime: inheritedStart,
        inheritedEndTime: inheritedEnd,
        inferredTimeFromSlot: false,
        lastSubjectName,
        existingSubjects,
        defaultDurationMinutes,
        colorCounter,
        semesterStart,
        semesterEnd,
      });

      if (parsed) {
        if (parsed.dayOfWeek !== null) {
          currentBlockDay = parsed.dayOfWeek;
        }
        if (parsed.subjectName) {
          lastSubjectName = parsed.subjectName;
        }
        colorCounter++;
        rows.push(parsed);
      }
    }
  }

  // Sort rows: rows with issues first (for immediate user attention), then by day & startTime
  const analysis = recomputeImportAnalysis(rows, existingSubjects, existingSlots);
  return {
    ...analysis,
    detectedSemesterStart: semesterStart,
    detectedSemesterEnd: semesterEnd,
  };
}
