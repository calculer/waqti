import test from 'node:test';
import assert from 'node:assert/strict';
import {
  detectMeetingPlatform,
  fuzzyMatchSubject,
  parseSmartTimetable,
  recomputeImportAnalysis,
} from './timetableParser';
import type { Subject, TimetableSlot } from '../types';

const mockSubjects: Subject[] = [
  {
    id: 'subj-analyse',
    name: 'Analyse 1',
    color: 'honey',
    icon: 'Sigma',
    teacher: 'Pr. Benali',
    room: 'Amphi A',
    coefficient: 6,
    weeklyGoalHours: 8,
    archived: false,
    createdAt: '2026-09-01T00:00:00.000Z',
  },
  {
    id: 'subj-algo',
    name: 'Algorithms & Data Structures',
    color: 'sage',
    icon: 'Code2',
    teacher: 'Dr. Smith',
    room: 'Room 203',
    coefficient: 5,
    weeklyGoalHours: 6,
    archived: false,
    createdAt: '2026-09-01T00:00:00.000Z',
  },
  {
    id: 'subj-ar-math',
    name: 'تحليل 1',
    color: 'amber',
    icon: 'Sigma',
    teacher: 'د. بن علي',
    room: 'مدرج أ',
    coefficient: 6,
    weeklyGoalHours: 8,
    archived: false,
    createdAt: '2026-09-01T00:00:00.000Z',
  },
];

test('1) FR list: parses Lundi 08h00-09h30 | Analyse 1 | Cours | Amphi A | Pr. Benali | Section 1 accurately', () => {
  const sample = 'Lundi 08h00-09h30 | Analyse 1 | Cours | Amphi A | Pr. Benali | Section 1';
  const result = parseSmartTimetable({
    plainText: sample,
    existingSubjects: mockSubjects,
  });

  assert.equal(result.rows.length, 1);
  const row = result.rows[0];
  assert.equal(row.dayOfWeek, 1); // Lundi = 1
  assert.equal(row.startTime, '08:00');
  assert.equal(row.endTime, '09:30');
  assert.equal(row.subjectName, 'Analyse 1');
  assert.equal(row.matchedSubjectId, 'subj-analyse');
  assert.equal(row.sessionType, 'lecture');
  assert.equal(row.room, 'Amphi A');
  assert.equal(row.teacher, 'Pr. Benali');
  assert.equal(row.section, '1');
  assert.equal(row.group, '');
  assert.equal(row.mode, 'in_person');
});

test('2) FR table (tab-separated) with days as columns and slots as rows, with TD/TP and G3 groups', () => {
  const tsvTable = [
    'Horaire\tLundi\tMardi\tMercredi',
    '08:00 - 09:30\tAlgèbre 1 Cours Amphi B Pr. Mansouri Section 2\t\tPhysique 1 TP Labo 2 G3',
    '09:45 - 11:15\t\tAlgèbre 1 TD Salle 14 G3 Mme. Khelifi\t',
  ].join('\n');

  const result = parseSmartTimetable({
    plainText: tsvTable,
    existingSubjects: mockSubjects,
  });

  assert.equal(result.rows.length, 3);

  const monSlot = result.rows.find((r) => r.dayOfWeek === 1);
  assert.ok(monSlot);
  assert.equal(monSlot.startTime, '08:00');
  assert.equal(monSlot.endTime, '09:30');
  assert.equal(monSlot.sessionType, 'lecture');
  assert.equal(monSlot.section, '2');
  assert.equal(monSlot.room, 'Amphi B');

  const wedSlot = result.rows.find((r) => r.dayOfWeek === 3);
  assert.ok(wedSlot);
  assert.equal(wedSlot.startTime, '08:00');
  assert.equal(wedSlot.endTime, '09:30');
  assert.equal(wedSlot.sessionType, 'tp');
  assert.equal(wedSlot.group, '3');
  assert.equal(wedSlot.room, 'Labo 2');

  const tueSlot = result.rows.find((r) => r.dayOfWeek === 2);
  assert.ok(tueSlot);
  assert.equal(tueSlot.startTime, '09:45');
  assert.equal(tueSlot.endTime, '11:15');
  assert.equal(tueSlot.sessionType, 'td');
  assert.equal(tueSlot.group, '3');
  assert.equal(tueSlot.room, 'Salle 14');
  assert.equal(tueSlot.teacher, 'Mme. Khelifi');
});

test('3) AR list: parses Arabic lecture and subsequent TD line with section vs group separation', () => {
  const arList = [
    'الأحد 08:00 - 09:30 | تحليل 1 | محاضرة | مدرج أ | د. بن علي | القسم 1',
    'الاثنين 10:00 - 11:30 | أعمال موجهة | الفوج 3 | قاعة 12',
  ].join('\n');

  const result = parseSmartTimetable({
    plainText: arList,
    existingSubjects: mockSubjects,
  });

  assert.equal(result.rows.length, 2);

  const sunRow = result.rows.find((r) => r.dayOfWeek === 0);
  assert.ok(sunRow);
  assert.equal(sunRow.startTime, '08:00');
  assert.equal(sunRow.endTime, '09:30');
  assert.equal(sunRow.subjectName, 'تحليل 1');
  assert.equal(sunRow.matchedSubjectId, 'subj-ar-math');
  assert.equal(sunRow.sessionType, 'lecture');
  assert.equal(sunRow.room, 'مدرج أ');
  assert.equal(sunRow.teacher, 'د. بن علي');
  assert.equal(sunRow.section, '1');
  assert.equal(sunRow.group, '');

  const monRow = result.rows.find((r) => r.dayOfWeek === 1);
  assert.ok(monRow);
  assert.equal(monRow.startTime, '10:00');
  assert.equal(monRow.endTime, '11:30');
  assert.equal(monRow.subjectName, 'تحليل 1'); // Inherited from previous line
  assert.equal(monRow.sessionType, 'td');
  assert.equal(monRow.group, '3');
  assert.equal(monRow.room, 'قاعة 12');
});

test('4) EN: parses Mon 8:00 AM – 9:30 AM Algorithms Lab (TP) Group 2 Room 203 Dr. Smith', () => {
  const enSample = 'Mon 8:00 AM – 9:30 AM Algorithms Lab (TP) Group 2 Room 203 Dr. Smith';
  const result = parseSmartTimetable({
    plainText: enSample,
    existingSubjects: mockSubjects,
  });

  assert.equal(result.rows.length, 1);
  const row = result.rows[0];
  assert.equal(row.dayOfWeek, 1);
  assert.equal(row.startTime, '08:00');
  assert.equal(row.endTime, '09:30');
  assert.equal(row.sessionType, 'tp');
  assert.equal(row.group, '2');
  assert.equal(row.room, 'Room 203');
  assert.equal(row.teacher, 'Dr. Smith');
  assert.equal(row.matchedSubjectId, 'subj-algo');
});

test('5) Messy copy: Arabic-Indic digits, accents/diacritics, HTML merged cells, and header/footer noise', () => {
  const messyText = [
    'Université des Sciences et de la Technologie — Année Universitaire 2026/2027',
    '====================================================================',
    'du 05/10/2026 au 25/01/2027',
    'الثلاثاء ٠٨:٠٠ - ٠٩:٣٠ | الفيزياء الكمّية | أعمال تطبيقية | مخبر ١ | أ.د. سلمى | S2-G4 | أسبوع فردي',
    'Page 1/2',
  ].join('\n');

  const result = parseSmartTimetable({
    plainText: messyText,
    existingSubjects: mockSubjects,
  });

  assert.equal(result.rows.length, 1);
  assert.equal(result.detectedSemesterStart, '2026-10-05');
  assert.equal(result.detectedSemesterEnd, '2027-01-25');

  const row = result.rows[0];
  assert.equal(row.dayOfWeek, 2); // الثلاثاء
  assert.equal(row.startTime, '08:00');
  assert.equal(row.endTime, '09:30');
  assert.equal(row.sessionType, 'tp');
  assert.equal(row.room, 'مخبر 1');
  assert.equal(row.section, '2');
  assert.equal(row.group, '4');
  assert.equal(row.recurrence, 'biweekly');
  assert.equal(row.weekParity, 'odd');

  // Also test HTML table with colspan and script sanitization
  const htmlTable = `
    <script>alert("xss")</script>
    <table>
      <tr><th>Jour</th><th>08:00-09:30</th><th>09:30-11:00</th></tr>
      <tr>
        <td>Jeudi</td>
        <td colspan="2">Chimie Organique<br/>Cours<br/>Amphi C<br/>Pr. Touati</td>
      </tr>
    </table>
  `;
  const htmlRes = parseSmartTimetable({
    htmlText: htmlTable,
    existingSubjects: mockSubjects,
  });
  assert.ok(htmlRes.rows.length >= 1);
  assert.equal(htmlRes.rows[0].dayOfWeek, 4); // Jeudi
  assert.equal(htmlRes.rows[0].sessionType, 'lecture');
  assert.equal(htmlRes.rows[0].room, 'Amphi C');
});

test('6) Remote class with Zoom/Meet link, duplicate/conflict detection, and fuzzy subject matching', () => {
  const remoteSample =
    'Vendredi 14h00 à 15h30 | Analyse 1 | Cours en ligne | Pr. Benali | https://zoom.us/j/987654321';

  const existingSlots: TimetableSlot[] = [
    {
      id: 'slot-existing-1',
      subjectId: 'subj-analyse',
      dayOfWeek: 5, // Friday
      startTime: '14:00',
      endTime: '15:30',
      type: 'lecture',
      room: '',
      teacher: 'Pr. Benali',
      mode: 'remote',
      recurrence: 'weekly',
    },
  ];

  const result = parseSmartTimetable({
    plainText: remoteSample,
    existingSubjects: mockSubjects,
    existingSlots,
  });

  assert.equal(result.rows.length, 1);
  const row = result.rows[0];
  assert.equal(row.dayOfWeek, 5);
  assert.equal(row.startTime, '14:00');
  assert.equal(row.endTime, '15:30');
  assert.equal(row.mode, 'remote');
  assert.equal(row.meetingUrl, 'https://zoom.us/j/987654321');
  assert.equal(row.platform, 'zoom');
  assert.equal(detectMeetingPlatform('https://meet.google.com/abc-defg-hij'), 'meet');

  // Verify duplicate detection against existing slot
  assert.equal(row.duplicateOfSlotId, 'slot-existing-1');
  assert.ok(row.issues.includes('duplicate_existing'));
  assert.equal(result.duplicateCount, 1);

  // Verify fuzzy subject matching ignoring accents and case
  const match = fuzzyMatchSubject('analyse 1', mockSubjects);
  assert.equal(match.matchedSubject?.id, 'subj-analyse');

  // Verify conflict detection when times partially overlap
  const editedRows = [
    {
      ...row,
      startTime: '14:30',
      endTime: '16:00',
    },
  ];
  const recomputed = recomputeImportAnalysis(editedRows, mockSubjects, existingSlots);
  assert.equal(recomputed.conflictCount, 1);
  assert.ok(recomputed.rows[0].issues.includes('conflict_existing'));
});
