/**
 * PowerSchool "Grades and Attendance" import.
 *
 * Students cannot get an API key, so we parse the student-portal page
 * (`guardian/home.html`) that a user saves or copies. The parser is
 * regex-based so it works identically in the browser and in Node tests
 * (no jsdom needed); it is deliberately tolerant of markup differences
 * between the classic table and the newer PowerSchool UI.
 */

export interface PSCourse {
  name: string;
  teacher?: string;
  period?: string;
  terms: Record<string, { letter?: string; percent?: number }>;
  absences?: number;
  tardies?: number;
}

export interface PSImport {
  student?: string;
  courses: PSCourse[];
  terms: string[];
}

// ───────────────────────── helpers ─────────────────────────

const ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', hellip: '…', copy: '©', reg: '®', trade: '™', laquo: '«', raquo: '»', middot: '·', bull: '•', eacute: 'é', egrave: 'è', ecirc: 'ê', aacute: 'á', agrave: 'à', iacute: 'í', oacute: 'ó', uacute: 'ú', ntilde: 'ñ', ccedil: 'ç', uuml: 'ü', ouml: 'ö', auml: 'ä',
};

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]*);/gi, (m, code: string) => {
    if (code[0] === '#') {
      const n = code[1] === 'x' || code[1] === 'X' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) && n > 0 ? String.fromCodePoint(n) : m;
    }
    const v = ENTITIES[code.toLowerCase()];
    return v ?? m;
  });
}

/** Strip tags, turning <br> and block boundaries into newlines, and decode entities. */
export function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|li|tr|h\d)>/gi, '\n')
      .replace(/<[^>]+>/g, ''),
  )
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .trim();
}

function collapse(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

/** Term codes PowerSchool uses as column headers (Q1, S1, T2, Y1, F1, E1, MP3, HEX1, Sem 1, Tri 2, ...). */
const TERM_RE = /^(?:Q[1-9]|S[1-4]|T[1-6]|Y1|F[1-2]|E[1-4]|P[1-9]|MP[1-9]|HEX[1-6]|X[1-6]|SEM\s?[1-4]|TRI\s?[1-4]|QTR\s?[1-9])$/i;

export function isTermCode(s: string): boolean {
  return TERM_RE.test(collapse(s));
}

function normalizeTerm(s: string): string {
  return collapse(s).toUpperCase().replace(/\s+/g, '');
}

const LETTER_RE = /^(?:[A-F][+\-−]?|P|F|I|INC|NG|CR|NC|W|WF|WP|S|U|E)$/i;
const PLACEHOLDER_RE = /^(?:-+|—|–|\[\s*i\s*\]|n\/?a|\(?none\)?|\.|\*)$/i;

/** Parse the text of a single grade cell such as "A\n95", "B+ 88", "95", "--", "[ i ]". */
export function parseGradeCell(text: string): { letter?: string; percent?: number } | null {
  const t = collapse(text.replace(/%/g, ' '));
  if (!t || PLACEHOLDER_RE.test(t)) return null;
  let letter: string | undefined;
  let percent: number | undefined;
  for (const tok of t.split(' ')) {
    if (percent === undefined && /^\d{1,3}(?:\.\d+)?$/.test(tok)) {
      const n = Number(tok);
      if (n >= 0 && n <= 150) percent = n;
      continue;
    }
    if (letter === undefined && LETTER_RE.test(tok)) letter = tok.replace('−', '-').toUpperCase();
  }
  if (letter === undefined && percent === undefined) return null;
  return { ...(letter !== undefined ? { letter } : {}), ...(percent !== undefined ? { percent } : {}) };
}

function parseIntCell(text: string): number | undefined {
  const m = collapse(text).match(/^(\d+)$/);
  return m ? Number(m[1]) : undefined;
}

/** Extract the course name and teacher from the HTML of the course cell. */
function parseCourseCellHtml(html: string): { name: string; teacher?: string } | null {
  let teacher: string | undefined;
  const stripped = html.replace(/<a\b[^>]*href=["']mailto:[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi, (_m, inner: string) => {
    const t = collapse(htmlToText(inner).replace(/\n/g, ' ').replace(/^\s*email\s+/i, ''));
    if (t && !teacher) teacher = t;
    return '';
  });
  const parsed = parseCourseCell(htmlToText(stripped));
  if (!parsed) return null;
  if (teacher && !parsed.teacher) parsed.teacher = teacher;
  return parsed;
}

/** Extract the course name and teacher from the text of the course cell. */
function parseCourseCell(text: string): { name: string; teacher?: string } | null {
  const lines = text.split('\n').map(collapse).filter(Boolean);
  let teacher: string | undefined;
  const nameParts: string[] = [];
  for (const line of lines) {
    const email = line.match(/^(?:.*?\b)?Email\s+(.+)$/i);
    if (email) {
      teacher = collapse(email[1].replace(/\bDetails\b/gi, '').replace(/[|·•]/g, ' '));
      const before = collapse(line.slice(0, line.toLowerCase().indexOf('email')));
      if (before && !/^details$/i.test(before)) nameParts.push(before);
      continue;
    }
    if (/^details$/i.test(line)) continue;
    // "Teacher: Smith, John" or "Smith, John (Rm 204)" style lines
    const tline = line.match(/^(?:teacher|instructor)\s*:\s*(.+)$/i);
    if (tline) {
      teacher = collapse(tline[1]);
      continue;
    }
    nameParts.push(line.replace(/\bDetails\b/gi, '').trim());
  }
  const name = collapse(nameParts.filter(Boolean).join(' ')).replace(/^[-–—:\s]+|[-–—:\s]+$/g, '');
  if (!name || name.length < 2 || !/\p{L}/u.test(name)) return null;
  return teacher ? { name, teacher } : { name };
}

// ───────────────────────── HTML parser ─────────────────────────

interface Cell {
  tag: 'td' | 'th';
  attrs: string;
  html: string;
  text: string;
}

function splitCells(rowHtml: string): Cell[] {
  const cells: Cell[] = [];
  const re = /<t([dh])\b([^>]*)>([\s\S]*?)<\/t\1\s*>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(rowHtml))) cells.push({ tag: m[1].toLowerCase() === 'h' ? 'th' : 'td', attrs: m[2], html: m[3], text: htmlToText(m[3]) });
  return cells;
}

function splitRows(tableHtml: string): string[] {
  const rows: string[] = [];
  const re = /<tr\b[^>]*>([\s\S]*?)<\/tr\s*>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(tableHtml))) rows.push(m[1]);
  return rows;
}

function findTables(html: string): { attrs: string; html: string }[] {
  const tables: { attrs: string; html: string }[] = [];
  // Innermost tables first: match tables whose body contains no other <table>.
  const re = /<table\b([^>]*)>((?:(?!<table\b)[\s\S])*?)<\/table\s*>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) tables.push({ attrs: m[1], html: m[2] });
  return tables;
}

interface HeaderMap {
  termCols: { index: number; term: string }[];
  courseCol: number;
  periodCol: number;
  absCol: number;
  tardyCol: number;
}

function analyzeHeader(cells: Cell[]): HeaderMap | null {
  const termCols: { index: number; term: string }[] = [];
  let courseCol = -1;
  let periodCol = -1;
  let absCol = -1;
  let tardyCol = -1;
  cells.forEach((c, i) => {
    const t = collapse(c.text);
    if (isTermCode(t)) termCols.push({ index: i, term: normalizeTerm(t) });
    else if (/^course$/i.test(t) || /^course\b/i.test(t)) courseCol = i;
    else if (/^(exp|expression|period|per\.?)$/i.test(t)) periodCol = i;
    else if (/^abs(ences)?\.?$/i.test(t)) absCol = i;
    else if (/^tard(ies|y)\.?$/i.test(t)) tardyCol = i;
  });
  if (termCols.length === 0) return null;
  return { termCols, courseCol, periodCol, absCol, tardyCol };
}

function isCourseCell(c: Cell): boolean {
  return /table-element-text-align-start/i.test(c.attrs) || /align\s*=\s*["']?left/i.test(c.attrs);
}

function parseTable(tableHtml: string): PSImport | null {
  const rows = splitRows(tableHtml).map(splitCells);
  let header: HeaderMap | null = null;
  let headerRow = -1;
  rows.forEach((cells, i) => {
    const h = analyzeHeader(cells);
    if (h && (!header || h.termCols.length > header.termCols.length)) {
      header = h;
      headerRow = i;
    }
  });
  if (!header) return null;
  const hdr: HeaderMap = header;
  const courses: PSCourse[] = [];
  for (let r = headerRow + 1; r < rows.length; r++) {
    const cells = rows[r];
    if (cells.length === 0 || cells.every((c) => c.tag === 'th')) continue;
    // Locate the course cell: explicit class first, then the header's column, then a heuristic.
    let courseIdx = cells.findIndex(isCourseCell);
    if (courseIdx < 0 && hdr.courseCol >= 0 && hdr.courseCol < cells.length) courseIdx = hdr.courseCol;
    if (courseIdx < 0) {
      courseIdx = cells.findIndex((c) => /email\s+\S/i.test(c.text) || /mailto:/i.test(c.html));
    }
    if (courseIdx < 0) continue;
    const course = parseCourseCellHtml(cells[courseIdx].html);
    if (!course) continue;
    // The header's "Last Week"/"This Week" cells span several day columns, so
    // columns after the course cell are offset in data rows; align them by
    // their distance from the course column. Columns before it line up as-is.
    const shift = hdr.courseCol >= 0 ? courseIdx - hdr.courseCol : 0;
    const at = (col: number): Cell | undefined => {
      if (col < 0) return undefined;
      return hdr.courseCol >= 0 && col < hdr.courseCol ? cells[col] : cells[col + shift];
    };
    const terms: PSCourse['terms'] = {};
    let sawTermCell = false;
    for (const tc of hdr.termCols) {
      const cell = at(tc.index);
      if (!cell) continue;
      sawTermCell = true;
      const g = parseGradeCell(cell.text);
      if (g) terms[tc.term] = g;
    }
    if (!sawTermCell && hdr.termCols.length > 0) continue; // not a data row (e.g. the weekday header)
    const c: PSCourse = { name: course.name, terms };
    if (course.teacher) c.teacher = course.teacher;
    const periodCell = at(hdr.periodCol) ?? (hdr.periodCol < 0 && courseIdx > 0 ? cells[0] : undefined);
    if (periodCell) {
      const p = collapse(periodCell.text);
      if (p && p.length <= 12 && /\d/.test(p)) c.period = p;
    }
    const abs = at(hdr.absCol);
    const tardy = at(hdr.tardyCol);
    const a = abs ? parseIntCell(abs.text) : undefined;
    const t = tardy ? parseIntCell(tardy.text) : undefined;
    if (a !== undefined) c.absences = a;
    if (t !== undefined) c.tardies = t;
    courses.push(c);
  }
  return { courses, terms: hdr.termCols.map((t) => t.term) };
}

function findStudentName(html: string): string | undefined {
  const patterns = [
    /<[^>]+id=["']firstlast["'][^>]*>([\s\S]*?)<\/[a-z]+>/i,
    /<[^>]+id=["']userName["'][^>]*>([\s\S]*?)<\/(?:div|span|li|h\d)>/i,
    /<[^>]+class=["'][^"']*\bstudent-name\b[^"']*["'][^>]*>([\s\S]*?)<\/[a-z]+>/i,
    /<title>[^<]*?(?:grades?\s*(?:and|&amp;|&)\s*attendance)\s*[:\-–—]\s*([^<]+)<\/title>/i,
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m) {
      const name = collapse(htmlToText(m[1]).replace(/\n/g, ' '));
      if (name && name.length <= 80) return name;
    }
  }
  return undefined;
}

/**
 * Parse a saved/copied PowerSchool "Grades and Attendance" page. Prefers the
 * `#quickLookup` table, then any table with a term-code header row.
 */
export function parsePowerSchoolHTML(html: string): PSImport {
  const src = String(html ?? '');
  const tables = findTables(src);
  const ranked = tables
    .map((t, i) => ({ t, i, pri: /id=["']quickLookup["']/i.test(t.attrs) ? 2 : /class=["'][^"']*\bgrid\b/i.test(t.attrs) ? 1 : 0 }))
    .sort((a, b) => b.pri - a.pri || a.i - b.i);
  let best: PSImport | null = null;
  for (const { t } of ranked) {
    const parsed = parseTable(t.html);
    if (!parsed) continue;
    if (!best || parsed.courses.length > best.courses.length) best = parsed;
    if (best.courses.length > 0 && /id=["']quickLookup["']/i.test(t.attrs)) break;
  }
  const result: PSImport = best ?? { courses: [], terms: [] };
  const student = findStudentName(src);
  if (student) result.student = student;
  return result;
}

// ───────────────────────── plain-text parser ─────────────────────────

const INLINE_TERM_RE = /(?:^|\s)((?:Q[1-9]|S[1-4]|T[1-6]|Y1|F[1-2]|E[1-4]|MP[1-9]|HEX[1-6]|SEM\s?[1-4]|TRI\s?[1-4]))\b\s*[:=-]?\s*/gi;

function splitColumns(line: string): string[] {
  return line.split(/\t+|\s{2,}/).map(collapse).filter(Boolean);
}

const HEADER_WORD_RE = /^(?:exp|expression|course|courses|teacher|period|per\.?|grade|grades|term|terms|absences|abs\.?|tardies|tardy|last week|this week|attendance|[MTWHF])$/i;

function isHeaderLine(cols: string[]): boolean {
  return cols.length > 0 && cols.some(isTermCode) && cols.every((c) => isTermCode(c) || HEADER_WORD_RE.test(c));
}

/**
 * Parse pasted plain text of the grades table. Supports two shapes:
 *  1. Inline term labels: `AP Biology  Q1 A 94  Q2 B+ 88`
 *  2. A header line of term codes followed by column-aligned rows
 *     (what you get when copying the table out of the browser).
 */
export function parsePowerSchoolText(text: string): { courses: PSCourse[]; terms: string[] } {
  const lines = String(text ?? '')
    .replace(/\u00a0/g, ' ')
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+$/, ''))
    .filter((l) => l.trim().length > 0);
  const termOrder: string[] = [];
  const addTerm = (t: string) => {
    if (!termOrder.includes(t)) termOrder.push(t);
  };
  const courses: PSCourse[] = [];

  // Shape 2: header line with ≥2 term codes and rows without inline labels.
  let header: HeaderMap | null = null;
  for (const line of lines) {
    const cols = splitColumns(line).map((text) => ({ tag: 'th' as const, attrs: '', html: '', text }));
    const h = analyzeHeader(cols);
    if (h && h.termCols.length >= 2 && (!header || h.termCols.length > header.termCols.length)) header = h;
  }

  for (const line of lines) {
    if (isHeaderLine(splitColumns(line))) continue;
    const inline: { term: string; index: number; end: number }[] = [];
    INLINE_TERM_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = INLINE_TERM_RE.exec(line))) {
      const start = m.index + (m[0].length - m[0].trimStart().length);
      inline.push({ term: normalizeTerm(m[1]), index: start, end: m.index + m[0].length });
    }
    if (inline.length > 0 && inline[0].index > 0) {
      // Shape 1
      const head = line.slice(0, inline[0].index);
      const course = parseCourseCell(head.replace(/\s{2,}/g, '\n'));
      if (!course) continue;
      const terms: PSCourse['terms'] = {};
      inline.forEach((it, i) => {
        const chunk = line.slice(it.end, i + 1 < inline.length ? inline[i + 1].index : line.length);
        const g = parseGradeCell(chunk.replace(/\s{2,}.*$/, ''));
        addTerm(it.term);
        if (g) terms[it.term] = g;
      });
      const c: PSCourse = { name: course.name, terms };
      if (course.teacher) c.teacher = course.teacher;
      const tail = line.slice(inline[inline.length - 1].end);
      const att = tail.match(/abs(?:ences)?\s*[:=]?\s*(\d+)/i);
      const tar = tail.match(/tard(?:ies|y)?\s*[:=]?\s*(\d+)/i);
      if (att) c.absences = Number(att[1]);
      if (tar) c.tardies = Number(tar[1]);
      courses.push(c);
      continue;
    }
    if (inline.length > 0) continue; // a header line of term codes
    if (!header) continue;
    // Shape 2 data row
    const cols = splitColumns(line);
    if (cols.length < 2) continue;
    let courseIdx = header.courseCol;
    if (courseIdx < 0 || courseIdx >= cols.length || /^\d/.test(cols[courseIdx])) {
      courseIdx = cols.findIndex((c) => /[a-z]/i.test(c) && !/^(?:email|details)\b/i.test(c) && !LETTER_RE.test(c) && !isTermCode(c));
    }
    if (courseIdx < 0) continue;
    // Teacher may be its own column right after the course ("Email Smith, John").
    let course = parseCourseCell(cols[courseIdx]);
    if (!course) continue;
    let consumed = courseIdx;
    if (!course.teacher && cols[courseIdx + 1] && /^(?:details\s+)?email\s+\S/i.test(cols[courseIdx + 1])) {
      const t = parseCourseCell(`${course.name}\n${cols[courseIdx + 1]}`);
      if (t) course = t;
      consumed = courseIdx + 1;
    }
    const gradeCols = cols.slice(consumed + 1);
    const terms: PSCourse['terms'] = {};
    header.termCols.forEach((tc, i) => {
      addTerm(tc.term);
      const cell = gradeCols[i];
      if (cell === undefined) return;
      const g = parseGradeCell(cell);
      if (g) terms[tc.term] = g;
    });
    const c: PSCourse = { name: course.name, terms };
    if (course.teacher) c.teacher = course.teacher;
    if (header.periodCol >= 0 && header.periodCol < courseIdx) {
      const p = cols[header.periodCol];
      if (p && /\d/.test(p) && p.length <= 12) c.period = p;
    }
    const extra = gradeCols.slice(header.termCols.length).map(parseIntCell);
    if (extra[0] !== undefined) c.absences = extra[0];
    if (extra[1] !== undefined) c.tardies = extra[1];
    courses.push(c);
  }
  return { courses, terms: termOrder };
}

// ───────────────────────── matching & summaries ─────────────────────────

export function normalizeCourseName(s: string): string {
  return s
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Match imported PowerSchool courses to the app's courses: exact match after
 * normalizing case and punctuation first, then a contains-either-way match,
 * otherwise `courseId` is undefined. Each app course is used at most once.
 */
export function matchToCourses(ps: PSCourse[], courses: { id: string; name: string }[]): { ps: PSCourse; courseId?: string }[] {
  const pool = courses.map((c) => ({ id: c.id, norm: normalizeCourseName(c.name) })).filter((c) => c.norm.length > 0);
  const used = new Set<string>();
  const out: { ps: PSCourse; courseId?: string }[] = ps.map((p) => ({ ps: p }));
  // Pass 1: exact
  out.forEach((entry) => {
    const n = normalizeCourseName(entry.ps.name);
    const hit = pool.find((c) => !used.has(c.id) && c.norm === n);
    if (hit) {
      entry.courseId = hit.id;
      used.add(hit.id);
    }
  });
  // Pass 2: contains either way (prefer the longest overlap)
  out.forEach((entry) => {
    if (entry.courseId) return;
    const n = normalizeCourseName(entry.ps.name);
    if (!n) return;
    let best: { id: string; score: number } | undefined;
    for (const c of pool) {
      if (used.has(c.id)) continue;
      const contains = n.includes(c.norm) || c.norm.includes(n);
      if (!contains) continue;
      const score = Math.min(n.length, c.norm.length);
      if (!best || score > best.score) best = { id: c.id, score };
    }
    if (best) {
      entry.courseId = best.id;
      used.add(best.id);
    }
  });
  return out;
}

/**
 * The most relevant grade for a course: the preferred term if it has a grade,
 * otherwise the last term (in column order) that has a percent, otherwise the
 * last term with a letter, otherwise null.
 */
export function latestGrade(c: PSCourse, preferTerm?: string): { term: string; percent?: number; letter?: string } | null {
  const entries = Object.entries(c.terms ?? {});
  if (entries.length === 0) return null;
  const pick = (term: string, g: { letter?: string; percent?: number }) => ({
    term,
    ...(g.percent !== undefined ? { percent: g.percent } : {}),
    ...(g.letter !== undefined ? { letter: g.letter } : {}),
  });
  if (preferTerm) {
    const key = normalizeTerm(preferTerm);
    const hit = entries.find(([t]) => normalizeTerm(t) === key);
    if (hit && (hit[1].percent !== undefined || hit[1].letter !== undefined)) return pick(hit[0], hit[1]);
  }
  for (let i = entries.length - 1; i >= 0; i--) {
    if (entries[i][1].percent !== undefined) return pick(entries[i][0], entries[i][1]);
  }
  for (let i = entries.length - 1; i >= 0; i--) {
    if (entries[i][1].letter !== undefined) return pick(entries[i][0], entries[i][1]);
  }
  return null;
}
