import type { Priority, Recurrence, TaskType } from './types';
import { addDays, combineDateTime, dateKey, startOfDay, startOfWeekKey, addDaysKey, fromKey, dayName, formatMinutes, formatMonthDay, formatTime, MONTH_SHORT } from './dates';
import { locale as appLocale, t } from './i18n/index.svelte';

export interface ParserCourse {
  id: string;
  name: string;
}

export interface ParserContext {
  now?: Date;
  courses?: ParserCourse[];
  templates?: string[];
  weekStart?: 0 | 1;
  /** Language of the typed text. Spanish adds "mañana", "el viernes", "15 de octubre", "a las 5"… (default: the app language). */
  locale?: string;
  timeFormat?: '12h' | '24h';
}

export interface ParsedChip {
  kind: 'due' | 'course' | 'tag' | 'priority' | 'estimate' | 'recurrence' | 'template' | 'type';
  label: string;
}

export interface ParsedQuickAdd {
  title: string;
  dueAt?: string; // date-only key or ISO datetime
  dueKey?: string;
  hasTime: boolean;
  courseId?: string;
  courseName?: string;
  tags: string[];
  priority?: Priority;
  estimateMin?: number;
  recurrence?: Recurrence;
  template?: string;
  type?: TaskType;
  chips: ParsedChip[];
}

const DAYS: Record<string, number> = {
  sun: 0,
  sunday: 0,
  mon: 1,
  monday: 1,
  tue: 2,
  tues: 2,
  tuesday: 2,
  wed: 3,
  weds: 3,
  wednesday: 3,
  thu: 4,
  thur: 4,
  thurs: 4,
  thursday: 4,
  fri: 5,
  friday: 5,
  sat: 6,
  saturday: 6,
};
const DAY_RE = 'sun(?:day)?|mon(?:day)?|tue(?:s|sday)?|wed(?:s|nesday)?|thu(?:r|rs|rsday)?|fri(?:day)?|sat(?:urday)?';
const MONTHS: Record<string, number> = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  sept: 8,
  oct: 9,
  nov: 10,
  dec: 11,
};
const MONTH_RE = 'jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?';
const DAY_LABEL = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Spanish words (lookups are accent-free, so "miercoles" and "sabado" work too). "mar" is martes unless a number
// follows ("mar 21" stays March 21).
const ES_DAYS: Record<string, number> = { dom: 0, domingo: 0, lun: 1, lunes: 1, mar: 2, martes: 2, mie: 3, miercoles: 3, jue: 4, jueves: 4, vie: 5, viernes: 5, sab: 6, sabado: 6 };
const ES_DAY_RE = 'domingos?|dom|lunes|lun|martes|mar(?!\\s\\d)|mi[ée]rcoles|mi[ée]|jueves|jue|viernes|vie|s[áa]bados?|s[áa]b';
const ES_MONTHS: Record<string, number> = { ene: 0, feb: 1, mar: 2, abr: 3, may: 4, jun: 5, jul: 6, ago: 7, sep: 8, set: 8, oct: 9, nov: 10, dic: 11 };
const ES_MONTH_RE =
  'ene(?:ro)?|feb(?:rero)?|mar(?:zo)?|abr(?:il)?|may(?:o)?|jun(?:io)?|jul(?:io)?|ago(?:sto)?|sep(?:t|tiembre)?|set(?:iembre)?|oct(?:ubre)?|nov(?:iembre)?|dic(?:iembre)?';
const ES_NUM: Record<string, number> = { un: 1, una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10 };
const ES_NUM_RE = '\\d+|una?|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez';
const deaccent = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const esDay = (w: string) => ES_DAYS[deaccent(w.toLowerCase()).replace(/(bado|mingo)s$/, '$1')];
const esNum = (w: string) => ES_NUM[w.toLowerCase()] ?? parseInt(w, 10);

function normalizeName(s: string): string {
  return deaccent(s.toLowerCase()).replace(/[^a-z0-9]/g, '');
}

/** Match a `#word` against course names: exact (normalized) first, then unique prefix of length ≥ 3. */
export function matchCourse(word: string, courses: ParserCourse[]): ParserCourse | undefined {
  const n = normalizeName(word);
  if (!n) return undefined;
  const exact = courses.find((c) => normalizeName(c.name) === n);
  if (exact) return exact;
  if (n.length < 3) return undefined;
  const prefix = courses.filter((c) => normalizeName(c.name).startsWith(n));
  if (prefix.length === 1) return prefix[0];
  // also allow matching the first word of a course name ("calc" -> "Calc II")
  const firstWord = courses.filter((c) => normalizeName(c.name.split(/\s+/)[0]) === n);
  if (firstWord.length === 1) return firstWord[0];
  return undefined;
}

function nextWeekday(from: Date, dow: number, includeToday: boolean): Date {
  const d = startOfDay(from);
  let diff = (dow - d.getDay() + 7) % 7;
  if (diff === 0 && !includeToday) diff = 7;
  return addDays(d, diff);
}

export function parseQuickAdd(input: string, ctx: ParserContext = {}): ParsedQuickAdd {
  const now = ctx.now ?? new Date();
  const courses = ctx.courses ?? [];
  const weekStart = ctx.weekStart ?? 1;
  const es = (ctx.locale ?? appLocale()).toLowerCase().startsWith('es');
  let text = ` ${input.replace(/\s+/g, ' ')} `;
  const chips: ParsedChip[] = [];
  const out: ParsedQuickAdd = { title: '', tags: [], hasTime: false, chips };

  const take = (re: RegExp, fn: (m: RegExpExecArray) => void) => {
    let m: RegExpExecArray | null;
    let guard = 0;
    while ((m = re.exec(text)) && guard++ < 20) {
      fn(m);
      text = text.slice(0, m.index) + ' ' + text.slice(m.index + m[0].length);
      re.lastIndex = 0;
    }
  };

  // template: @name
  take(/(?:^|\s)@([\w-]+)(?=\s)/i, (m) => {
    out.template = m[1].toLowerCase();
    chips.push({ kind: 'template', label: `@${m[1]}` });
  });

  // priority: !high
  take(/(?:^|\s)!(low|normal|med|medium|high|urgent|p[1-4]|baja|media|alta|urgente)(?=\s)/i, (m) => {
    const v = m[1].toLowerCase();
    const map: Record<string, Priority> = {
      baja: 'low',
      media: 'normal',
      alta: 'high',
      urgente: 'urgent',
      low: 'low',
      normal: 'normal',
      med: 'normal',
      medium: 'normal',
      high: 'high',
      urgent: 'urgent',
      p4: 'low',
      p3: 'normal',
      p2: 'high',
      p1: 'urgent',
    };
    out.priority = map[v];
    chips.push({ kind: 'priority', label: `!${appLocale() === 'en' ? out.priority : t(`priority.${out.priority!}` as const).toLowerCase()}` });
  });

  // estimate: ~45m ~2h ~1h30m ~90
  take(/(?:^|\s)~(\d+(?:\.\d+)?)(h|hr|hrs|m|min|mins)?(?:\s?(\d+)m)?(?=\s)/i, (m) => {
    const n = parseFloat(m[1]);
    const unit = (m[2] ?? 'm').toLowerCase();
    let min = unit.startsWith('h') ? Math.round(n * 60) : Math.round(n);
    if (m[3]) min += parseInt(m[3], 10);
    if (min > 0) {
      out.estimateMin = min;
      chips.push({ kind: 'estimate', label: `⏱ ${formatMinutes(min)}` });
    }
  });
  if (es) {
    const types: Record<string, TaskType> = {
      tarea: 'homework',
      deberes: 'homework',
      lectura: 'reading',
      examen: 'exam',
      proyecto: 'project',
      prueba: 'quiz',
      quiz: 'quiz',
      otro: 'other',
    };
    take(/(?:^|\s)tipo:(tarea|deberes|lectura|examen|proyecto|prueba|quiz|otro)(?=\s)/i, (m) => {
      out.type = types[m[1].toLowerCase()];
      chips.push({ kind: 'type', label: m[1].toLowerCase() });
    });
  }

  // type:exam
  take(/(?:^|\s)type:(homework|reading|exam|project|quiz|other)(?=\s)/i, (m) => {
    out.type = m[1].toLowerCase() as TaskType;
    chips.push({ kind: 'type', label: out.type });
  });

  // #course or #tag
  take(/(?:^|\s)#([\p{L}\p{N}_-]+)(?=\s)/iu, (m) => {
    const word = m[1];
    const course = !out.courseId ? matchCourse(word, courses) : undefined;
    if (course) {
      out.courseId = course.id;
      out.courseName = course.name;
      chips.push({ kind: 'course', label: course.name });
    } else {
      const tag = word.toLowerCase();
      if (!out.tags.includes(tag)) out.tags.push(tag);
      chips.push({ kind: 'tag', label: `#${tag}` });
    }
  });

  // recurrence (before dates so weekday names aren't eaten)
  if (es) {
    take(/(?:^|\s)(todos los d[íi]as|cada d[íi]a|a diario|diariamente)(?=\s)/i, () => {
      out.recurrence = { kind: 'daily' };
      chips.push({ kind: 'recurrence', label: t('parser.everyDay') });
    });
    take(/(?:^|\s)(entre semana|d[íi]as de semana|d[íi]as laborables|de lunes a viernes)(?=\s)/i, () => {
      out.recurrence = { kind: 'weekdays' };
      chips.push({ kind: 'recurrence', label: t('parser.weekdays') });
    });
    take(new RegExp(`(?:^|\\s)cada (${ES_NUM_RE}) d[íi]as(?=\\s)`, 'i'), (m) => {
      const n = esNum(m[1]);
      out.recurrence = { kind: 'everyNDays', n };
      chips.push({ kind: 'recurrence', label: t('parser.everyNDays', { n }) });
    });
    take(new RegExp(`(?:^|\\s)cada (${ES_NUM_RE}) semanas(?=\\s)`, 'i'), (m) => {
      const n = Math.max(1, esNum(m[1]));
      out.recurrence = { kind: 'weekly', n };
      chips.push({ kind: 'recurrence', label: t('parser.everyNWeeks', { n }) });
    });
    take(/(?:^|\s)(cada mes|todos los meses|mensual|mensualmente)(?=\s)/i, () => {
      out.recurrence = { kind: 'monthly' };
      chips.push({ kind: 'recurrence', label: t('parser.monthly') });
    });
    take(new RegExp(`(?:^|\\s)(?:cada|todos los) ((?:(?:${ES_DAY_RE})(?:,? y |,\\s?|\\s))*(?:${ES_DAY_RE}))(?=\\s)`, 'i'), (m) => {
      const days = m[1]
        .split(/[\s,]+/)
        .filter((w) => w && w.toLowerCase() !== 'y')
        .map(esDay)
        .filter((d) => d !== undefined);
      const uniq = Array.from(new Set(days)).sort();
      out.recurrence = { kind: 'weekly', days: uniq };
      chips.push({ kind: 'recurrence', label: t('parser.everyDays', { days: uniq.map((d) => dayName(d)).join(' ') }) });
    });
    take(/(?:^|\s)(cada semana|todas las semanas|semanal|semanalmente)(?=\s)/i, () => {
      out.recurrence = { kind: 'weekly' };
      chips.push({ kind: 'recurrence', label: t('parser.weekly') });
    });
  }
  take(/(?:^|\s)(every day|daily)(?=\s)/i, () => {
    out.recurrence = { kind: 'daily' };
    chips.push({ kind: 'recurrence', label: t('parser.everyDay') });
  });
  take(/(?:^|\s)(weekdays|every weekday)(?=\s)/i, () => {
    out.recurrence = { kind: 'weekdays' };
    chips.push({ kind: 'recurrence', label: t('parser.weekdays') });
  });
  take(/(?:^|\s)every (\d+) days?(?=\s)/i, (m) => {
    out.recurrence = { kind: 'everyNDays', n: parseInt(m[1], 10) };
    chips.push({ kind: 'recurrence', label: t('parser.everyNDays', { n: m[1] }) });
  });
  take(/(?:^|\s)every other day(?=\s)/i, () => {
    out.recurrence = { kind: 'everyNDays', n: 2 };
    chips.push({ kind: 'recurrence', label: t('parser.everyNDays', { n: 2 }) });
  });
  // "every 2nd tuesday", "every last friday" (monthly on the n-th weekday)
  take(new RegExp(`(?:^|\\s)every (1st|first|2nd|second|3rd|third|4th|fourth|last) (${DAY_RE})(?=\\s)`, 'i'), (m) => {
    const nth = { '1st': 1, first: 1, '2nd': 2, second: 2, '3rd': 3, third: 3, '4th': 4, fourth: 4, last: -1 }[m[1].toLowerCase()] ?? 1;
    const weekday = DAYS[m[2].toLowerCase()];
    out.recurrence = { kind: 'monthlyNth', nth, weekday };
    chips.push({ kind: 'recurrence', label: t('parser.everyNth', { nth: m[1].toLowerCase(), day: dayName(weekday) }) });
  });
  // "every other tue" / "every other week" / "every 3 weeks"
  take(new RegExp(`(?:^|\\s)every other (${DAY_RE})(?=\\s)`, 'i'), (m) => {
    const d = DAYS[m[1].toLowerCase()];
    out.recurrence = { kind: 'weekly', days: [d], n: 2 };
    chips.push({ kind: 'recurrence', label: t('parser.everyOtherDay', { day: dayName(d) }) });
  });
  take(/(?:^|\s)every other week(?=\s)/i, () => {
    out.recurrence = { kind: 'weekly', n: 2 };
    chips.push({ kind: 'recurrence', label: t('parser.everyOtherWeek') });
  });
  take(/(?:^|\s)every (\d+) weeks(?=\s)/i, (m) => {
    out.recurrence = { kind: 'weekly', n: Math.max(1, parseInt(m[1], 10)) };
    chips.push({ kind: 'recurrence', label: t('parser.everyNWeeks', { n: m[1] }) });
  });
  take(/(?:^|\s)(monthly|every month)(?=\s)/i, () => {
    out.recurrence = { kind: 'monthly' };
    chips.push({ kind: 'recurrence', label: t('parser.monthly') });
  });
  take(new RegExp(`(?:^|\\s)every ((?:(?:${DAY_RE})(?:,?\\s|,))*(?:${DAY_RE}))(?=\\s)`, 'i'), (m) => {
    const days = m[1]
      .toLowerCase()
      .split(/[\s,]+/)
      .filter(Boolean)
      .map((d) => DAYS[d])
      .filter((d) => d !== undefined);
    const uniq = Array.from(new Set(days)).sort();
    out.recurrence = { kind: 'weekly', days: uniq };
    chips.push({ kind: 'recurrence', label: t('parser.everyDays', { days: uniq.map((d) => dayName(d)).join(' ') }) });
  });
  take(/(?:^|\s)(every week|weekly)(?=\s)/i, () => {
    out.recurrence = { kind: 'weekly' };
    chips.push({ kind: 'recurrence', label: t('parser.weekly') });
  });

  // dates
  let dueDate: Date | undefined;
  const setDate = (d: Date) => {
    dueDate = startOfDay(d);
  };
  let hours: number | undefined;
  let minutes = 0;
  if (es) {
    // no year given and more than a month in the past: next year
    const rollYear = (d: Date, hasYear: boolean) =>
      !hasYear && d.getTime() < startOfDay(now).getTime() - 86400000 * 30 ? new Date(d.getFullYear() + 1, d.getMonth(), d.getDate()) : d;
    const quarter = (w: string | undefined) => (w?.toLowerCase() === 'media' ? 30 : w ? 15 : 0);
    // times first, so "de la mañana" (in the morning) isn't read as "mañana" (tomorrow)
    take(/(?:^|\s)(?:a las? |a eso de las? )?(\d{1,2})(?::(\d{2}))?(?: y (media|cuarto))? de la (ma[ñn]ana|madrugada|tarde|noche)(?=\s)/i, (m) => {
      const h = +m[1] % 12;
      hours = /tarde|noche/i.test(m[4]) ? h + 12 : h;
      minutes = m[2] ? +m[2] : quarter(m[3]);
    });
    take(/(?:^|\s)(?:a las? )?(\d{1,2})(?::(\d{2}))?\s?([ap])\.\s?m\.(?=\s)/i, (m) => {
      hours = (+m[1] % 12) + (m[3].toLowerCase() === 'p' ? 12 : 0);
      minutes = m[2] ? +m[2] : 0;
    });
    // "a las 5" without am/pm: homework at 1–6 means the afternoon
    take(/(?:^|\s)a las? (\d{1,2})(?::(\d{2}))?(?: y (media|cuarto))?(?=\s)/i, (m) => {
      const h = +m[1];
      if (h > 23 || (m[2] && +m[2] > 59)) return;
      hours = h >= 1 && h <= 6 ? h + 12 : h;
      minutes = m[2] ? +m[2] : quarter(m[3]);
    });
    take(/(?:^|\s)(?:al |a )?(?:la )?(mediod[íi]a|medianoche)(?=\s)/i, (m) => {
      hours = /^mediod/i.test(m[1]) ? 12 : 0;
      minutes = 0;
    });
    take(/(?:^|\s)(?:para )?(hoy|esta noche|esta tarde|esta ma[ñn]ana)(?=\s)/i, () => setDate(now));
    take(/(?:^|\s)(?:para )?pasado ma[ñn]ana(?=\s)/i, () => setDate(addDays(now, 2)));
    take(/(?:^|(?<!\bla)\s)(?:para )?ma[ñn]ana(?=\s)/i, () => setDate(addDays(now, 1)));
    take(/(?:^|\s)ayer(?=\s)/i, () => setDate(addDays(now, -1)));
    const nextWeekStart = () => fromKey(addDaysKey(startOfWeekKey(dateKey(now), weekStart), 7));
    // "el viernes de la semana que viene": that day next week (like "next fri")
    take(new RegExp(`(?:^|\\s)(?:para )?(?:el )?(${ES_DAY_RE}) de la (?:semana que viene|pr[óo]xima semana|semana pr[óo]xima)(?=\\s)`, 'i'), (m) => {
      setDate(nextWeekday(nextWeekStart(), esDay(m[1]), true));
    });
    take(/(?:^|\s)(?:para )?(?:la )?(?:pr[óo]xima semana|semana que viene|semana pr[óo]xima)(?=\s)/i, () => setDate(nextWeekStart()));
    // "el próximo viernes" / "el viernes que viene": the coming Friday, never today
    take(new RegExp(`(?:^|\\s)(?:para )?(?:el )?(?:pr[óo]ximo (${ES_DAY_RE})|(${ES_DAY_RE}) (?:que viene|pr[óo]ximo))(?=\\s)`, 'i'), (m) => {
      setDate(nextWeekday(now, esDay(m[1] ?? m[2]), false));
    });
    take(new RegExp(`(?:^|\\s)(?:en|dentro de) (${ES_NUM_RE}) (d[íi]as?|semanas?)(?=\\s)`, 'i'), (m) => {
      const n = esNum(m[1]);
      setDate(addDays(now, /^s/i.test(m[2]) ? n * 7 : n));
    });
    take(new RegExp(`(?:^|\\s)(?:para |antes del? )?(?:el |este )?(${ES_DAY_RE})(?=\\s)`, 'i'), (m) => {
      setDate(nextWeekday(now, esDay(m[1]), true));
    });
    take(new RegExp(`(?:^|\\s)(?:para |antes )?(?:el |del )?(\\d{1,2})(?:º|°)?(?: de)? (${ES_MONTH_RE})(?:,? (?:de |del )?(\\d{4}))?(?=\\s)`, 'i'), (m) => {
      const month = ES_MONTHS[deaccent(m[2].toLowerCase()).slice(0, 3)];
      setDate(rollYear(new Date(m[3] ? +m[3] : now.getFullYear(), month, +m[1]), !!m[3]));
    });
    // day/month order; "9/21" (no month 21) still reads as September 21
    take(/(?:^|\s)(?:para |antes )?(?:el |del )?(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?(?=\s)/, (m) => {
      let day = +m[1];
      let month = +m[2];
      if (month > 12 && day <= 12) [day, month] = [month, day];
      let year = m[3] ? +m[3] : now.getFullYear();
      if (m[3] && m[3].length === 2) year += 2000;
      setDate(rollYear(new Date(year, month - 1, day), !!m[3]));
    });
  }
  take(/(?:^|\s)(today|tonight)(?=\s)/i, () => setDate(now));
  take(/(?:^|\s)(tomorrow|tmrw|tmr)(?=\s)/i, () => setDate(addDays(now, 1)));
  take(/(?:^|\s)(yesterday)(?=\s)/i, () => setDate(addDays(now, -1)));
  take(/(?:^|\s)next week(?=\s)/i, () => setDate(fromKey(addDaysKey(startOfWeekKey(dateKey(now), weekStart), 7))));
  take(new RegExp(`(?:^|\\s)next (${DAY_RE})(?=\\s)`, 'i'), (m) => {
    const dow = DAYS[m[1].toLowerCase()];
    const nextWeekStart = fromKey(addDaysKey(startOfWeekKey(dateKey(now), weekStart), 7));
    setDate(nextWeekday(nextWeekStart, dow, true));
  });
  take(/(?:^|\s)in (\d+) (days?|weeks?)(?=\s)/i, (m) => {
    const n = parseInt(m[1], 10);
    setDate(addDays(now, m[2].startsWith('week') ? n * 7 : n));
  });
  take(new RegExp(`(?:^|\\s)(?:on |this |due )?(${DAY_RE})(?=\\s)`, 'i'), (m) => {
    const dow = DAYS[m[1].toLowerCase()];
    setDate(nextWeekday(now, dow, true));
  });
  take(/(?:^|\s)(\d{4})-(\d{2})-(\d{2})(?=\s)/, (m) => {
    setDate(new Date(+m[1], +m[2] - 1, +m[3]));
  });
  take(/(?:^|\s)(?:on |due )?(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?(?=\s)/, (m) => {
    const month = +m[1] - 1;
    const day = +m[2];
    let year = m[3] ? +m[3] : now.getFullYear();
    if (m[3] && m[3].length === 2) year += 2000;
    let d = new Date(year, month, day);
    if (!m[3] && d.getTime() < startOfDay(now).getTime() - 86400000 * 30) d = new Date(year + 1, month, day);
    setDate(d);
  });
  take(new RegExp(`(?:^|\\s)(?:on |due )?(${MONTH_RE}) (\\d{1,2})(?:st|nd|rd|th)?(?:,? (\\d{4}))?(?=\\s)`, 'i'), (m) => {
    const month = MONTHS[m[1].toLowerCase().slice(0, 3)] ?? MONTHS[m[1].toLowerCase()];
    const day = +m[2];
    const year = m[3] ? +m[3] : now.getFullYear();
    let d = new Date(year, month, day);
    if (!m[3] && d.getTime() < startOfDay(now).getTime() - 86400000 * 30) d = new Date(year + 1, month, day);
    setDate(d);
  });
  take(new RegExp(`(?:^|\\s)(?:on |due )?(\\d{1,2})(?:st|nd|rd|th)? (${MONTH_RE})(?:,? (\\d{4}))?(?=\\s)`, 'i'), (m) => {
    const month = MONTHS[m[2].toLowerCase().slice(0, 3)] ?? MONTHS[m[2].toLowerCase()];
    const day = +m[1];
    const year = m[3] ? +m[3] : now.getFullYear();
    let d = new Date(year, month, day);
    if (!m[3] && d.getTime() < startOfDay(now).getTime() - 86400000 * 30) d = new Date(year + 1, month, day);
    setDate(d);
  });

  // time: 8pm, 8:30pm, at 20:00, noon, midnight
  take(/(?:^|\s)(?:at |@ )?(\d{1,2})(?::(\d{2}))?\s?(am|pm)(?=\s)/i, (m) => {
    let h = +m[1] % 12;
    if (m[3].toLowerCase() === 'pm') h += 12;
    hours = h;
    minutes = m[2] ? +m[2] : 0;
  });
  take(/(?:^|\s)(?:at )(\d{1,2}):(\d{2})(?=\s)/i, (m) => {
    hours = +m[1];
    minutes = +m[2];
  });
  take(/(?:^|\s)(\d{1,2}):(\d{2})(?=\s)/, (m) => {
    if (+m[1] < 24 && +m[2] < 60) {
      hours = +m[1];
      minutes = +m[2];
    }
  });
  take(/(?:^|\s)(?:at )?(noon|midnight)(?=\s)/i, (m) => {
    hours = m[1].toLowerCase() === 'noon' ? 12 : 0;
    minutes = 0;
  });

  if (hours !== undefined && !dueDate) {
    // time without a date: today, or tomorrow if that time already passed
    const candidate = new Date(now);
    candidate.setHours(hours, minutes, 0, 0);
    dueDate = startOfDay(candidate.getTime() < now.getTime() ? addDays(now, 1) : now);
  }
  if (dueDate) {
    const key = dateKey(dueDate);
    out.dueKey = key;
    if (hours !== undefined) {
      out.dueAt = combineDateTime(key, hours, minutes);
      out.hasTime = true;
    } else {
      out.dueAt = key;
    }
    chips.push({ kind: 'due', label: `📅 ${describeDateKey(key, now)}${hours !== undefined ? ` ${formatHM(hours, minutes, ctx.timeFormat)}` : ''}` });
  }

  out.title = text.replace(/\s+/g, ' ').trim();
  return out;
}

function formatHM(h: number, m: number, timeFormat: '12h' | '24h' = '12h'): string {
  if (appLocale() !== 'en') return formatTime(new Date(2026, 0, 1, h, m), timeFormat);
  const ampm = h >= 12 ? 'pm' : 'am';
  const hh = h % 12 === 0 ? 12 : h % 12;
  return m ? `${hh}:${String(m).padStart(2, '0')}${ampm}` : `${hh}${ampm}`;
}

export function describeDateKey(key: string, now: Date): string {
  const today = dateKey(now);
  if (key === today) return t('date.today');
  if (key === dateKey(addDays(now, 1))) return t('date.tomorrow');
  const d = fromKey(key);
  const diff = Math.round((d.getTime() - startOfDay(now).getTime()) / 86400000);
  if (diff > 1 && diff < 7) return dayName(d.getDay());
  if (appLocale() !== 'en') return `${dayName(d.getDay())} ${formatMonthDay(d, d)}`;
  return `${DAY_LABEL[d.getDay()]} ${MONTH_SHORT[d.getMonth()]} ${d.getDate()}`;
}
