import { getLocalDateString, getWeekDayIndex, shiftDateString } from './dates';
import type {
  AlarmReminder,
  Exam,
  Flashcard,
  FocusSessionLog,
  Habit,
  Language,
  LessonLog,
  RevisionSession,
  StudyTask,
  Subject,
  TimetableSlot,
  WeekDay,
} from '../types';

export interface DemoDataset {
  subjects: Subject[];
  timetable: TimetableSlot[];
  exams: Exam[];
  revisionSessions: RevisionSession[];
  lessons: LessonLog[];
  tasks: StudyTask[];
  habits: Habit[];
  focusSessions: FocusSessionLog[];
  alarms: AlarmReminder[];
  flashcards: Flashcard[];
}

export function buildSeedDemoData(
  lang: Language = 'ar',
  todayStr: string = getLocalDateString()
): DemoDataset {
  const todayDow = getWeekDayIndex(todayStr);
  const tomorrowDow = ((todayDow + 1) % 7) as WeekDay;
  const dayAfterDow = ((todayDow + 2) % 7) as WeekDay;
  const prevDow = ((todayDow + 6) % 7) as WeekDay;

  const isAr = lang === 'ar';
  const isFr = lang === 'fr';
  const nowIso = new Date().toISOString();

  const subjects: Subject[] = [
    {
      id: 'subj-math',
      name: isAr
        ? 'الرياضيات المتقدمة والتحليل'
        : isFr
          ? 'Mathématiques & Analyse'
          : 'Advanced Mathematics',
      color: 'honey',
      icon: 'Sigma',
      teacher: isAr ? 'د. طارق المنصور' : isFr ? 'Prof. Laurent Moreau' : 'Dr. Tariq Al-Mansour',
      room: isAr ? 'مدرج ابن الهيثم B2' : 'Amphi Euler B2',
      coefficient: 6,
      weeklyGoalHours: 8,
      defaultMode: 'in_person',
      modeByType: { lecture: 'in_person', td: 'in_person', tp: 'in_person' },
      archived: false,
      createdAt: nowIso,
    },
    {
      id: 'subj-phys',
      name: isAr
        ? 'الفيزياء الكمّية والميكانيك'
        : isFr
          ? 'Physique Quantique & Mécanique'
          : 'Quantum Physics & Mechanics',
      color: 'slate',
      icon: 'Atom',
      teacher: isAr ? 'د. سلمى الخطيب' : isFr ? 'Dr. Claire Dubois' : 'Dr. Salma Al-Khatib',
      room: isAr ? 'مختبر الفيزياء 104' : 'Labo Curie 104',
      coefficient: 5,
      weeklyGoalHours: 6,
      defaultMode: 'in_person',
      modeByType: { lecture: 'hybrid', td: 'in_person', tp: 'in_person' },
      archived: false,
      createdAt: nowIso,
    },
    {
      id: 'subj-cs',
      name: isAr
        ? 'هندسة الخوارزميات والذكاء الاصطناعي'
        : isFr
          ? 'Algorithmique & Structures'
          : 'Algorithms & Systems Design',
      color: 'sage',
      icon: 'Code2',
      teacher: isAr ? 'م. كريم بن علي' : isFr ? 'Prof. Karim Benali' : 'Prof. Karim Benali',
      room: isAr ? 'قاعة الخوارزمي 301' : 'Salle Turing 301',
      coefficient: 5,
      weeklyGoalHours: 7,
      defaultMode: 'hybrid',
      modeByType: { lecture: 'remote', td: 'in_person', tp: 'in_person' },
      archived: false,
      createdAt: nowIso,
    },
    {
      id: 'subj-lit',
      name: isAr
        ? 'الفلسفة والفكر النقدي'
        : isFr
          ? 'Philosophie & Épistémologie'
          : 'Philosophy & Critical Thought',
      color: 'terracotta',
      icon: 'BookOpen',
      teacher: isAr ? 'أ. نادية الشامي' : isFr ? 'Mme. Nadia Chami' : 'Prof. Nadia Chami',
      room: isAr ? 'قاعة ابن رشد 12' : 'Salle Averroès 12',
      coefficient: 3,
      weeklyGoalHours: 4,
      defaultMode: 'remote',
      modeByType: { lecture: 'remote', td: 'remote' },
      archived: false,
      createdAt: nowIso,
    },
    {
      id: 'subj-bio',
      name: isAr
        ? 'الكيمياء الحيوية والجزيئية'
        : isFr
          ? 'Biochimie Moléculaire'
          : 'Molecular Biochemistry',
      color: 'plum',
      icon: 'Microscope',
      teacher: isAr ? 'د. ياسين الفاسي' : isFr ? 'Dr. Yassine El-Fassi' : 'Dr. Yassine El-Fassi',
      room: isAr ? 'مختبر الرازي 205' : 'Labo Pasteur 205',
      coefficient: 4,
      weeklyGoalHours: 5,
      defaultMode: 'in_person',
      modeByType: { lecture: 'in_person', tp: 'in_person' },
      archived: false,
      createdAt: nowIso,
    },
  ];

  const timetable: TimetableSlot[] = [
    {
      id: 'slot-today-1',
      subjectId: 'subj-math',
      dayOfWeek: todayDow,
      startTime: '08:30',
      endTime: '10:00',
      type: 'lecture',
      section: '1',
      room: subjects[0].room,
      teacher: subjects[0].teacher,
      mode: 'in_person',
      recurrence: 'weekly',
    },
    {
      id: 'slot-today-2',
      subjectId: 'subj-phys',
      dayOfWeek: todayDow,
      startTime: '10:30',
      endTime: '12:00',
      type: 'tp',
      section: '1',
      group: '2',
      room: subjects[1].room,
      teacher: subjects[1].teacher,
      mode: 'in_person',
      recurrence: 'weekly',
    },
    {
      id: 'slot-today-3',
      subjectId: 'subj-cs',
      dayOfWeek: todayDow,
      startTime: '14:00',
      endTime: '15:30',
      type: 'lecture',
      section: '1',
      room: '',
      teacher: subjects[2].teacher,
      mode: 'remote',
      meetingUrl: 'https://meet.google.com/waq-algo-cs',
      platform: 'meet',
      recurrence: 'weekly',
    },
    {
      id: 'slot-today-4',
      subjectId: 'subj-lit',
      dayOfWeek: todayDow,
      startTime: '16:00',
      endTime: '17:30',
      type: 'td',
      section: '1',
      group: '3',
      room: subjects[3].room,
      teacher: subjects[3].teacher,
      mode: 'hybrid',
      meetingUrl: 'https://zoom.us/j/948271605',
      platform: 'zoom',
      recurrence: 'weekly',
    },
    {
      id: 'slot-tom-1',
      subjectId: 'subj-bio',
      dayOfWeek: tomorrowDow,
      startTime: '09:00',
      endTime: '11:00',
      type: 'tp',
      section: '1',
      group: '2',
      room: subjects[4].room,
      teacher: subjects[4].teacher,
      mode: 'in_person',
      recurrence: 'weekly',
    },
    {
      id: 'slot-tom-2',
      subjectId: 'subj-math',
      dayOfWeek: tomorrowDow,
      startTime: '13:30',
      endTime: '15:00',
      type: 'td',
      section: '1',
      group: '2',
      room: isAr ? 'قاعة 14' : 'Salle 14',
      teacher: subjects[0].teacher,
      mode: 'in_person',
      recurrence: 'weekly',
    },
    {
      id: 'slot-after-1',
      subjectId: 'subj-cs',
      dayOfWeek: dayAfterDow,
      startTime: '10:00',
      endTime: '12:00',
      type: 'tp',
      section: '1',
      group: '2',
      room: subjects[2].room,
      teacher: subjects[2].teacher,
      mode: 'in_person',
      recurrence: 'weekly',
    },
    {
      id: 'slot-prev-1',
      subjectId: 'subj-phys',
      dayOfWeek: prevDow,
      startTime: '09:00',
      endTime: '10:30',
      type: 'lecture',
      section: '1',
      room: subjects[1].room,
      teacher: subjects[1].teacher,
      mode: 'hybrid',
      meetingUrl: 'https://teams.microsoft.com/l/meetup-join/phys101',
      platform: 'teams',
      recurrence: 'weekly',
    },
  ];

  const exams: Exam[] = [
    {
      id: 'exam-1',
      subjectId: 'subj-math',
      title: isAr
        ? 'الامتحان الفصلي في التكامل والمعادلات التفاضلية'
        : isFr
          ? 'Devoir Surveillé : Équations Différentielles'
          : 'Differential Equations & Complex Integration Midterm',
      type: 'devoir_surveille',
      date: shiftDateString(todayStr, 3),
      startTime: '09:00',
      durationMinutes: 120,
      room: subjects[0].room,
      coefficient: 6,
      topics: isAr
        ? ['التكامل بالتجزئة', 'متسلسلات فورييه', 'المعادلات التفاضلية من الرتبة الثانية']
        : isFr
          ? ['Intégration par parties', 'Séries de Fourier', 'Équations du second ordre']
          : ['Integration by parts', 'Fourier series', 'Second-order ODEs'],
      priority: 'critical',
      reminderOffsetsMinutes: [1440, 10080],
      readinessScore: 78,
    },
    {
      id: 'exam-2',
      subjectId: 'subj-cs',
      title: isAr
        ? 'اختبار عملي: خوارزميات الرسوم البيانية والبرمجة الديناميكية'
        : isFr
          ? 'Examen : Algorithmes de Graphes & Programmation Dynamique'
          : 'Graph Theory & Dynamic Programming Exam',
      type: 'examen',
      date: shiftDateString(todayStr, 7),
      startTime: '14:00',
      durationMinutes: 90,
      room: subjects[2].room,
      coefficient: 5,
      topics: isAr
        ? ['خوارزمية ديكسترا', 'البرمجة الديناميكية', 'أشجار البحث المتوازنة']
        : isFr
          ? ['Algorithme de Dijkstra', 'Programmation dynamique', 'Arbres AVL']
          : ['Dijkstra shortest path', 'Memoization & DP tables', 'Balanced BSTs'],
      priority: 'high',
      reminderOffsetsMinutes: [1440],
      readinessScore: 64,
    },
    {
      id: 'exam-3',
      subjectId: 'subj-phys',
      title: isAr
        ? 'فرض محروس: الديناميكا الحرارية والأمواج'
        : isFr
          ? 'Contrôle : Thermodynamique & Ondes'
          : 'Thermodynamics & Wave Mechanics Assessment',
      type: 'controle',
      date: shiftDateString(todayStr, -6),
      startTime: '10:00',
      durationMinutes: 90,
      room: subjects[1].room,
      coefficient: 5,
      topics: ['Carnot cycle', 'Entropy', 'Standing waves'],
      priority: 'high',
      reminderOffsetsMinutes: [1440],
      grade: 17.5,
      outOf: 20,
      readinessScore: 100,
    },
    {
      id: 'exam-4',
      subjectId: 'subj-math',
      title: isAr
        ? 'اختبار الجبر الخطي والمصفوفات'
        : isFr
          ? 'Contrôle : Algèbre Linéaire & Diagonalisation'
          : 'Linear Algebra & Eigenvalues Test',
      type: 'test',
      date: shiftDateString(todayStr, -14),
      startTime: '08:30',
      durationMinutes: 60,
      room: subjects[0].room,
      coefficient: 6,
      topics: ['Eigenvalues', 'Vector spaces'],
      priority: 'medium',
      reminderOffsetsMinutes: [1440],
      grade: 18.25,
      outOf: 20,
      readinessScore: 100,
    },
    {
      id: 'exam-5',
      subjectId: 'subj-bio',
      title: isAr
        ? 'كويز الإنزيمات والتمثيل الغذائي'
        : isFr
          ? 'Quiz : Cinétique Enzymatique'
          : 'Enzyme Kinetics & Metabolism Quiz',
      type: 'quiz',
      date: shiftDateString(todayStr, -10),
      startTime: '11:00',
      durationMinutes: 45,
      room: subjects[4].room,
      coefficient: 4,
      topics: ['Michaelis-Menten', 'ATP synthesis'],
      priority: 'medium',
      reminderOffsetsMinutes: [1440],
      grade: 16.5,
      outOf: 20,
      readinessScore: 100,
    },
  ];

  const revisionSessions: RevisionSession[] = [
    {
      id: 'rev-demo-1',
      examId: 'exam-1',
      subjectId: 'subj-math',
      date: todayStr,
      startTime: '18:00',
      endTime: '19:30',
      topic: exams[0].topics[0],
      completed: false,
    },
    {
      id: 'rev-demo-2',
      examId: 'exam-1',
      subjectId: 'subj-math',
      date: shiftDateString(todayStr, 1),
      startTime: '17:30',
      endTime: '19:00',
      topic: exams[0].topics[1],
      completed: false,
    },
  ];

  const tasks: StudyTask[] = [
    {
      id: 'task-1',
      title: isAr
        ? 'حل سلسلة تمارين المعادلات التفاضلية (المجموعة ٤)'
        : isFr
          ? 'Résoudre la fiche TD n°4 (Équations différentielles)'
          : 'Complete Problem Set #4 on Differential Equations',
      subjectId: 'subj-math',
      dueDate: todayStr,
      dueTime: '20:00',
      priority: 'critical',
      status: 'doing',
      subtasks: [
        { id: 'st-1', title: isAr ? 'التمرين ١ و ٢' : 'Exercises 1 & 2', done: true },
        { id: 'st-2', title: isAr ? 'مسألة القيم الحدية ٣' : 'Boundary value problem #3', done: false },
      ],
      recurrence: 'none',
    },
    {
      id: 'task-2',
      title: isAr
        ? 'تحضير تقرير مختبر التداخل الضوئي'
        : isFr
          ? 'Rédiger le compte-rendu de TP Interférences'
          : 'Write Optical Interference Lab Report',
      subjectId: 'subj-phys',
      dueDate: shiftDateString(todayStr, 1),
      dueTime: '18:00',
      priority: 'high',
      status: 'todo',
      subtasks: [
        { id: 'st-3', title: isAr ? 'رسم المنحنيات البيانية' : 'Plot error bars & graphs', done: true },
        { id: 'st-4', title: isAr ? 'كتابة الاستنتاج الفيزيائي' : 'Write error analysis conclusion', done: false },
      ],
      recurrence: 'none',
    },
    {
      id: 'task-3',
      title: isAr
        ? 'برمجة خوارزمية A* وتحليل التعقيد الزمني'
        : isFr
          ? 'Implémenter A* et analyser la complexité'
          : 'Implement A* Search & Complexity Benchmark',
      subjectId: 'subj-cs',
      dueDate: todayStr,
      dueTime: '22:00',
      priority: 'medium',
      status: 'done',
      completedAt: nowIso,
      subtasks: [],
      recurrence: 'none',
    },
  ];

  const lessons: LessonLog[] = [
    {
      id: 'lesson-1',
      subjectId: 'subj-math',
      date: todayStr,
      title: isAr
        ? 'تحويل لابلاس وتطبيقاته في الأنظمة الخطية'
        : isFr
          ? 'Transformée de Laplace & Systèmes Linéaires'
          : 'Laplace Transforms in Linear Differential Systems',
      notes: isAr
        ? 'التركيز على مبرهنة الالتفاف (Convolution Theorem) وشروط التقارب.'
        : isFr
          ? 'Théorème du produit de convolution et pôles de stabilité.'
          : 'Key theorem: Convolution integral turns differential equations into algebraic polynomials in s-domain.',
      links: ['https://ocw.mit.edu'],
    },
    {
      id: 'lesson-2',
      subjectId: 'subj-phys',
      date: shiftDateString(todayStr, -1),
      title: isAr
        ? 'معادلة شرودنغر في بئر كمومي لا نهائي'
        : isFr
          ? 'Équation de Schrödinger : Puits de potentiel infini'
          : 'Schrödinger Wave Equation in Infinite Potential Well',
      notes: isAr
        ? 'مستويات الطاقة مكمّمة تتناسب مع مربع رقم المدار n².'
        : isFr
          ? 'Quantification des niveaux d’énergie proportionnelle à n².'
          : 'Energy eigenvalues scale with n^2; wavefunctions must vanish at boundary walls.',
      links: [],
    },
  ];

  const last10Days = Array.from({ length: 10 }, (_, i) => shiftDateString(todayStr, -i));
  const last6Days = Array.from({ length: 6 }, (_, i) => shiftDateString(todayStr, -i));

  const habits: Habit[] = [
    {
      id: 'hab-1',
      name: isAr
        ? 'مراجعة البطاقات الذكية (Anki) لمدة ٢٥ دقيقة'
        : isFr
          ? 'Révision active Anki (25 min)'
          : '25-min Active Recall & Flashcards',
      icon: 'Brain',
      color: 'honey',
      frequencyType: 'daily',
      targetDays: [0, 1, 2, 3, 4, 5, 6],
      timesPerWeek: 7,
      reminderTimes: ['19:00'],
      completedDates: last10Days,
      bestStreak: 14,
      createdAt: nowIso,
    },
    {
      id: 'hab-2',
      name: isAr
        ? 'قراءة عميقة وتلخيص محاضرات اليوم'
        : isFr
          ? 'Synthèse des cours du jour'
          : 'Synthesize Daily Lecture Notes',
      icon: 'BookCheck',
      color: 'sage',
      frequencyType: 'daily',
      targetDays: [0, 1, 2, 3, 4, 5, 6],
      timesPerWeek: 7,
      reminderTimes: ['20:30'],
      completedDates: last6Days,
      bestStreak: 9,
      createdAt: nowIso,
    },
    {
      id: 'hab-3',
      name: isAr
        ? 'شرب ٢ لتر ماء وتمارين تمدد ذهني'
        : isFr
          ? 'Hydratation 2L & marche sans écran'
          : '2L Hydration & Screen-Free Walk',
      icon: 'Sparkles',
      color: 'slate',
      frequencyType: 'times_per_week',
      targetDays: [0, 1, 2, 3, 4, 5, 6],
      timesPerWeek: 5,
      reminderTimes: ['17:00'],
      completedDates: [
        todayStr,
        shiftDateString(todayStr, -1),
        shiftDateString(todayStr, -2),
        shiftDateString(todayStr, -4),
      ],
      bestStreak: 7,
      createdAt: nowIso,
    },
  ];

  const alarms: AlarmReminder[] = [
    {
      id: 'alarm-1',
      title: isAr
        ? 'جلسة مراجعة المساء (الرياضيات)'
        : isFr
          ? 'Session de révision du soir (Maths)'
          : 'Evening Study & Active Recall Session',
      note: isAr
        ? 'مراجعة تمارين المعادلات التفاضلية لمدة ٤٥ دقيقة'
        : isFr
          ? '45 minutes sur les équations différentielles'
          : '45-minute deep focus on differential equations',
      date: todayStr,
      time: '19:00',
      recurrence: 'daily',
      daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
      linkedType: 'habit',
      linkedId: 'hab-1',
      sound: 'soft_bell',
      vibrate: true,
      snoozeMinutes: 10,
      leadMinutes: 0,
      enabled: true,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: 'alarm-2',
      title: isAr
        ? 'منبه الاستيقاظ الصباحي والتهيئة الذهنية'
        : isFr
          ? 'Réveil matinal & préparation'
          : 'Morning Wake-up & Timetable Check',
      note: isAr ? 'بداية هادئة قبل المحاضرات' : 'Calm start before morning lectures',
      date: todayStr,
      time: '07:15',
      recurrence: 'weekdays',
      daysOfWeek: [1, 2, 3, 4, 5],
      linkedType: 'class',
      linkedId: 'slot-today-1',
      sound: 'morning_chime',
      vibrate: true,
      snoozeMinutes: 5,
      leadMinutes: 0,
      enabled: true,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: 'alarm-3',
      title: isAr
        ? 'تذكير الامتحان الفصلي للرياضيات'
        : isFr
          ? 'Rappel : Devoir Surveillé de Maths'
          : 'Math Midterm Exam Final Check',
      note: isAr ? 'تجهيز الآلة الحاسبة والأدوات' : 'Prepare exam room & formula sheet',
      date: shiftDateString(todayStr, 3),
      time: '09:00',
      recurrence: 'once',
      daysOfWeek: [],
      linkedType: 'exam',
      linkedId: 'exam-1',
      sound: 'marimba',
      vibrate: true,
      snoozeMinutes: 15,
      leadMinutes: 60,
      enabled: true,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
  ];

  const flashcards: Flashcard[] = [
    {
      id: 'fc-1',
      subjectId: 'subj-math',
      front: isAr
        ? 'ما هي صيغة التكامل بالتجزئة؟'
        : isFr
          ? 'Quelle est la formule d’intégration par parties ?'
          : 'What is the Integration by Parts formula?',
      back: '∫ u dv = u·v − ∫ v du',
      box: 3,
      nextReviewDate: todayStr,
    },
    {
      id: 'fc-2',
      subjectId: 'subj-phys',
      front: isAr
        ? 'ما هي مستويات الطاقة في بئر كمومي لا نهائي بعرض L؟'
        : isFr
          ? 'Quels sont les niveaux d’énergie dans un puits infini de largeur L ?'
          : 'What are the energy eigenvalues in a 1D infinite potential well of width L?',
      back: 'E_n = (n² · π² · ℏ²) / (2m · L²)',
      box: 2,
      nextReviewDate: todayStr,
    },
    {
      id: 'fc-3',
      subjectId: 'subj-cs',
      front: isAr
        ? 'ما هو التعقيد الزمني لخوارزمية ديكسترا باستخدام Binary Heap؟'
        : isFr
          ? 'Quelle est la complexité de Dijkstra avec un tas binaire ?'
          : 'What is the time complexity of Dijkstra’s algorithm with a binary heap?',
      back: 'O((V + E) log V)',
      box: 4,
      nextReviewDate: shiftDateString(todayStr, 2),
    },
  ];

  const focusSessions: FocusSessionLog[] = [
    {
      id: 'foc-1',
      subjectId: 'subj-math',
      startedAt: new Date(Date.now() - 3600_000 * 3).toISOString(),
      endedAt: new Date(Date.now() - 3600_000 * 2).toISOString(),
      durationMinutes: 50,
      date: todayStr,
      mode: 'focus',
    },
    {
      id: 'foc-2',
      subjectId: 'subj-cs',
      startedAt: new Date(Date.now() - 3600_000 * 5).toISOString(),
      endedAt: new Date(Date.now() - 3600_000 * 4).toISOString(),
      durationMinutes: 45,
      date: todayStr,
      mode: 'focus',
    },
    {
      id: 'foc-3',
      subjectId: 'subj-phys',
      startedAt: new Date(Date.now() - 86400_000).toISOString(),
      endedAt: new Date(Date.now() - 86400_000 + 3600_000).toISOString(),
      durationMinutes: 75,
      date: shiftDateString(todayStr, -1),
      mode: 'focus',
    },
    {
      id: 'foc-4',
      subjectId: 'subj-math',
      startedAt: new Date(Date.now() - 86400_000 * 2).toISOString(),
      endedAt: new Date(Date.now() - 86400_000 * 2 + 5400_000).toISOString(),
      durationMinutes: 90,
      date: shiftDateString(todayStr, -2),
      mode: 'focus',
    },
    {
      id: 'foc-5',
      subjectId: 'subj-bio',
      startedAt: new Date(Date.now() - 86400_000 * 3).toISOString(),
      endedAt: new Date(Date.now() - 86400_000 * 3 + 3600_000).toISOString(),
      durationMinutes: 60,
      date: shiftDateString(todayStr, -3),
      mode: 'focus',
    },
  ];

  return {
    subjects,
    timetable,
    exams,
    revisionSessions,
    lessons,
    tasks,
    habits,
    focusSessions,
    alarms,
    flashcards,
  };
}
