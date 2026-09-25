// Generic, tolerant iCalendar (RFC 5545) parser. Only VEVENT components are

const stripBom = (s: string) => (s.charCodeAt(0) === 0xfeff ? s.slice(1) : s);
// returned; VALARM and other nested components are skipped. Designed for
// calendar feeds (Schoology, Google, etc.) which are not always spec-perfect.

export interface ParsedEvent {
  uid: string;
  summary: string;
  description?: string; // unescaped plain text, HTML stripped, entities decoded
  start?: string; // 'YYYY-MM-DD' for all-day, otherwise ISO 8601 with Z
  end?: string; // same rules
  allDay: boolean;
  url?: string;
  location?: string;
  categories?: string[];
  lastModified?: string; // ISO
  status?: string;
  raw: Record<string, string>; // property name (upper) -> raw value
}

interface Property {
  name: string;
  params: Record<string, string>;
  value: string;
}

/** Unfold RFC 5545 folded lines (CRLF followed by a space or tab). Tolerates LF-only files and a BOM. */
export function unfoldLines(text: string): string[] {
  const clean = stripBom(text).replace(/\r\n?/g, '\n');
  const out: string[] = [];
  for (const line of clean.split('\n')) {
    if ((line.startsWith(' ') || line.startsWith('\t')) && out.length) {
      out[out.length - 1] += line.slice(1);
    } else {
      out.push(line);
    }
  }
  return out.filter((l) => l.length > 0);
}

/** Split a content line into name, parameters and value. Handles quoted parameter values containing ':' or ';'. */
function parseLine(line: string): Property | null {
  let i = 0;
  let inQuote = false;
  for (; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') inQuote = !inQuote;
    else if (ch === ':' && !inQuote) break;
  }
  if (i >= line.length) return null;
  const head = line.slice(0, i);
  const value = line.slice(i + 1);
  const parts: string[] = [];
  let cur = '';
  inQuote = false;
  for (const ch of head) {
    if (ch === '"') inQuote = !inQuote;
    if (ch === ';' && !inQuote) {
      parts.push(cur);
      cur = '';
    } else cur += ch;
  }
  parts.push(cur);
  const name = parts[0].trim().toUpperCase();
  if (!name) return null;
  const params: Record<string, string> = {};
  for (const p of parts.slice(1)) {
    const eq = p.indexOf('=');
    if (eq < 0) continue;
    const k = p.slice(0, eq).trim().toUpperCase();
    const v = p
      .slice(eq + 1)
      .trim()
      .replace(/^"(.*)"$/, '$1');
    params[k] = v;
  }
  return { name, params, value };
}

/** Undo RFC 5545 TEXT escaping. */
export function unescapeText(s: string): string {
  return s.replace(/\\(n|N|\\|,|;)/g, (_, c: string) => (c === 'n' || c === 'N' ? '\n' : c));
}

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  ndash: '–',
  mdash: '—',
  hellip: '…',
  lsquo: '‘',
  rsquo: '’',
  ldquo: '“',
  rdquo: '”',
  copy: '©',
};

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) && code > 0 ? String.fromCodePoint(code) : m;
    }
    const v = ENTITIES[e.toLowerCase()];
    return v ?? m;
  });
}

/** Turn an HTML fragment into readable plain text: block tags become newlines, other tags are dropped, entities decoded. */
export function htmlToText(s: string): string {
  if (!/<[a-z!/]/i.test(s)) return decodeEntities(s);
  let t = s
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|h[1-6]|blockquote|pre|table)\s*>/gi, '\n\n')
    .replace(/<\/(div|li|tr)\s*>/gi, '\n')
    .replace(/<li[^>]*>/gi, '- ')
    .replace(/<[^>]+>/g, '');
  t = decodeEntities(t);
  return t;
}

function cleanText(s: string): string {
  return htmlToText(unescapeText(s))
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Convert an iCalendar DATE or DATE-TIME value to our representation.
 * - VALUE=DATE (or bare 8-digit) -> 'YYYY-MM-DD'
 * - ...Z -> ISO UTC
 * - floating / TZID -> interpreted as local time and converted to ISO UTC
 */
export function parseICSDate(value: string, params: Record<string, string> = {}): { value: string; allDay: boolean } | undefined {
  const v = value.trim();
  const dateOnly = /^(\d{4})(\d{2})(\d{2})$/.exec(v);
  if (dateOnly || params.VALUE === 'DATE') {
    const m = dateOnly ?? /^(\d{4})(\d{2})(\d{2})/.exec(v);
    if (!m) return undefined;
    return { value: `${m[1]}-${m[2]}-${m[3]}`, allDay: true };
  }
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z)?$/i.exec(v);
  if (!m) return undefined;
  const [y, mo, d, h, mi] = [m[1], m[2], m[3], m[4], m[5]].map(Number);
  const s = m[6] ? Number(m[6]) : 0;
  const date = m[7] ? new Date(Date.UTC(y, mo - 1, d, h, mi, s)) : new Date(y, mo - 1, d, h, mi, s);
  if (Number.isNaN(date.getTime())) return undefined;
  return { value: date.toISOString(), allDay: false };
}

function splitList(s: string): string[] {
  const out: string[] = [];
  let cur = '';
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '\\' && i + 1 < s.length) {
      cur += ch + s[i + 1];
      i++;
    } else if (ch === ',') {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  out.push(cur);
  return out.map((x) => unescapeText(x).trim()).filter(Boolean);
}

function buildEvent(props: Property[]): ParsedEvent | null {
  const raw: Record<string, string> = {};
  const ev: ParsedEvent = { uid: '', summary: '', allDay: false, raw };
  for (const p of props) {
    raw[p.name] = p.value;
    switch (p.name) {
      case 'UID':
        ev.uid = p.value.trim();
        break;
      case 'SUMMARY':
        ev.summary = cleanText(p.value).replace(/\s+/g, ' ');
        break;
      case 'DESCRIPTION': {
        const d = cleanText(p.value);
        if (d) ev.description = d;
        break;
      }
      case 'DTSTART': {
        const r = parseICSDate(p.value, p.params);
        if (r) {
          ev.start = r.value;
          ev.allDay = r.allDay;
        }
        break;
      }
      case 'DTEND': {
        const r = parseICSDate(p.value, p.params);
        if (r) ev.end = r.value;
        break;
      }
      case 'URL': {
        const u = unescapeText(p.value).trim();
        if (u) ev.url = u;
        break;
      }
      case 'LOCATION': {
        const l = cleanText(p.value);
        if (l) ev.location = l;
        break;
      }
      case 'CATEGORIES': {
        const cats = splitList(p.value);
        if (cats.length) ev.categories = [...(ev.categories ?? []), ...cats];
        break;
      }
      case 'LAST-MODIFIED': {
        const r = parseICSDate(p.value, p.params);
        if (r) ev.lastModified = r.value;
        break;
      }
      case 'STATUS':
        ev.status = p.value.trim().toUpperCase();
        break;
    }
  }
  if (!ev.uid && !ev.summary && !ev.start) return null;
  if (!ev.uid) ev.uid = `${ev.summary}|${ev.start ?? ''}`;
  return ev;
}

/** Parse an iCalendar document into events. Duplicate UIDs keep the last occurrence. */
export function parseICS(text: string): ParsedEvent[] {
  const lines = unfoldLines(text);
  const byUid = new Map<string, ParsedEvent>();
  let inEvent = false;
  let depth = 0; // nesting inside VEVENT (VALARM etc.)
  let props: Property[] = [];
  for (const line of lines) {
    const p = parseLine(line);
    if (!p) continue;
    if (p.name === 'BEGIN') {
      const comp = p.value.trim().toUpperCase();
      if (!inEvent && comp === 'VEVENT') {
        inEvent = true;
        depth = 0;
        props = [];
      } else if (inEvent) depth++;
      continue;
    }
    if (p.name === 'END') {
      const comp = p.value.trim().toUpperCase();
      if (inEvent && depth > 0) depth--;
      else if (inEvent && comp === 'VEVENT') {
        inEvent = false;
        const ev = buildEvent(props);
        if (ev) {
          byUid.delete(ev.uid);
          byUid.set(ev.uid, ev);
        }
        props = [];
      }
      continue;
    }
    if (inEvent && depth === 0) props.push(p);
  }
  return [...byUid.values()];
}
