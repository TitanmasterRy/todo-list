// Citations: MLA 9, APA 7 and Chicago (bibliography) for books, journal articles and web pages.
// DOI lookup uses Crossref and ISBN lookup uses Open Library; both allow browser requests.

export type SourceType = 'book' | 'article' | 'website';
export type CitationStyle = 'mla' | 'apa' | 'chicago';

export interface Person {
  given: string;
  family: string;
}

export interface Source {
  type: SourceType;
  authors: Person[];
  title: string;
  container?: string; // journal or website name
  publisher?: string;
  place?: string;
  year?: string;
  month?: number; // 1–12
  day?: number;
  volume?: string;
  issue?: string;
  pages?: string;
  doi?: string;
  url?: string;
  accessed?: string; // YYYY-MM-DD
  edition?: string;
}

/** A formatted citation as runs of text, some italic. */
export type Run = { text: string; italic?: boolean };

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MLA_MONTHS = ['Jan.', 'Feb.', 'Mar.', 'Apr.', 'May', 'June', 'July', 'Aug.', 'Sept.', 'Oct.', 'Nov.', 'Dec.'];

const initials = (given: string) =>
  given
    .split(/[\s-]+/)
    .filter(Boolean)
    .map((g) => `${g[0].toUpperCase()}.`)
    .join(' ');
const full = (p: Person) => [p.given, p.family].filter(Boolean).join(' ');
const inverted = (p: Person) => (p.given ? `${p.family}, ${p.given}` : p.family);
const endDot = (s: string) => (/[.?!]$/.test(s) ? s : `${s}.`);
const doiUrl = (doi: string) => `https://doi.org/${doi.replace(/^https?:\/\/(dx\.)?doi\.org\//i, '')}`;

function mlaAuthors(a: Person[]): string {
  if (!a.length) return '';
  if (a.length === 1) return inverted(a[0]);
  if (a.length === 2) return `${inverted(a[0])}, and ${full(a[1])}`;
  return `${inverted(a[0])}, et al`;
}
function apaAuthors(a: Person[]): string {
  const one = (p: Person) => (p.given ? `${p.family}, ${initials(p.given)}` : p.family);
  if (!a.length) return '';
  if (a.length === 1) return one(a[0]);
  if (a.length <= 20) return `${a.slice(0, -1).map(one).join(', ')}, & ${one(a[a.length - 1])}`;
  return `${a.slice(0, 19).map(one).join(', ')}, . . . ${one(a[a.length - 1])}`;
}
function chicagoAuthors(a: Person[]): string {
  if (!a.length) return '';
  if (a.length === 1) return inverted(a[0]);
  if (a.length <= 3)
    return `${inverted(a[0])}, ${a
      .slice(1, -1)
      .map((p) => `${full(p)}, `)
      .join('')}and ${full(a[a.length - 1])}`;
  return `${inverted(a[0])} et al`;
}

function mlaDate(s: Source): string {
  return [s.day, s.month ? MLA_MONTHS[s.month - 1] : '', s.year].filter(Boolean).join(' ');
}
function accessedMla(d?: string): string {
  if (!d) return '';
  const [y, m, day] = d.split('-').map(Number);
  return `Accessed ${day} ${MLA_MONTHS[m - 1]} ${y}.`;
}

export function formatCitation(s: Source, style: CitationStyle): Run[] {
  const r: Run[] = [];
  const t = (text: string) => text && r.push({ text });
  const i = (text: string) => text && r.push({ text, italic: true });
  const link = s.doi ? doiUrl(s.doi) : s.url;
  if (style === 'mla') {
    const au = mlaAuthors(s.authors);
    if (au) t(`${endDot(au)} `);
    if (s.type === 'book') {
      i(endDot(s.title));
      t(` ${[s.edition ? `${s.edition} ed.` : '', s.publisher, s.year].filter(Boolean).join(', ')}.`);
      if (link) t(` ${link}.`);
    } else if (s.type === 'article') {
      t(`“${endDot(s.title)}” `);
      if (s.container) i(s.container);
      const parts = [s.volume ? `vol. ${s.volume}` : '', s.issue ? `no. ${s.issue}` : '', mlaDate(s), s.pages ? `pp. ${s.pages}` : ''].filter(Boolean);
      t(`${parts.length ? ', ' + parts.join(', ') : ''}.`);
      if (link) t(` ${link}.`);
    } else {
      t(`“${endDot(s.title)}” `);
      if (s.container) i(s.container);
      const parts = [s.publisher && s.publisher !== s.container ? s.publisher : '', mlaDate(s), link ?? ''].filter(Boolean);
      t(`${parts.length ? ', ' + parts.join(', ') : ''}.`);
      if (s.accessed) t(` ${accessedMla(s.accessed)}`);
    }
  } else if (style === 'apa') {
    const au = apaAuthors(s.authors);
    const date = s.type === 'website' && s.year ? [s.year, s.month ? MONTHS[s.month - 1] + (s.day ? ` ${s.day}` : '') : ''].filter(Boolean).join(', ') : (s.year ?? 'n.d.');
    if (au) t(`${au} (${date}). `);
    if (s.type === 'book') {
      i(endDot(s.title + (s.edition ? ` (${s.edition} ed.)` : '')));
      if (!au) t(` (${date}).`);
      if (s.publisher) t(` ${endDot(s.publisher)}`);
    } else if (s.type === 'article') {
      t(endDot(s.title));
      if (!au) t(` (${date}).`);
      if (s.container) {
        t(' ');
        i(s.container);
        if (s.volume) {
          t(', ');
          i(s.volume);
        }
        t(`${s.issue ? `(${s.issue})` : ''}${s.pages ? `, ${s.pages}` : ''}.`);
      }
    } else {
      i(endDot(s.title));
      if (!au) t(` (${date}).`);
      if (s.container) t(` ${endDot(s.container)}`);
    }
    if (link) t(` ${link}`);
  } else {
    const au = chicagoAuthors(s.authors);
    if (au) t(`${endDot(au)} `);
    if (s.type === 'book') {
      i(endDot(s.title));
      const pub = [s.place, s.publisher].filter(Boolean).join(': ');
      t(` ${[pub, s.year].filter(Boolean).join(', ')}.`);
      if (link) t(` ${link}.`);
    } else if (s.type === 'article') {
      t(`“${endDot(s.title)}” `);
      if (s.container) i(s.container);
      t(`${s.volume ? ` ${s.volume}` : ''}${s.issue ? `, no. ${s.issue}` : ''}${s.year ? ` (${s.year})` : ''}${s.pages ? `: ${s.pages}` : ''}.`);
      if (link) t(` ${link}.`);
    } else {
      t(`“${endDot(s.title)}” `);
      if (s.container) t(`${endDot(s.container)} `);
      const date = [s.month ? MONTHS[s.month - 1] : '', s.day ? `${s.day},` : '', s.year].filter(Boolean).join(' ');
      if (date) t(`${endDot(date)} `);
      if (link) t(`${link}.`);
    }
  }
  // tidy spacing
  return r.map((x) => ({ ...x, text: x.text.replace(/\s{2,}/g, ' ') })).filter((x) => x.text);
}

export function citationText(runs: Run[]): string {
  return runs
    .map((r) => r.text)
    .join('')
    .trim();
}

export function citationHTML(runs: Run[]): string {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return runs
    .map((r) => (r.italic ? `<i>${esc(r.text)}</i>` : esc(r.text)))
    .join('')
    .trim();
}

/** Sort key for a works-cited list: first author's family name, then title. */
export function sortKey(s: Source): string {
  return `${s.authors[0]?.family ?? s.title}`.toLowerCase() + ' ' + s.title.toLowerCase();
}

// ---------- lookups ----------
interface CrossrefWork {
  type?: string;
  title?: string[];
  author?: { given?: string; family?: string; name?: string }[];
  'container-title'?: string[];
  publisher?: string;
  issued?: { 'date-parts'?: number[][] };
  volume?: string;
  issue?: string;
  page?: string;
  DOI?: string;
  URL?: string;
}

export function fromCrossref(w: CrossrefWork): Source {
  const [y, m, d] = w.issued?.['date-parts']?.[0] ?? [];
  const isBook = w.type === 'book' || w.type === 'monograph' || w.type === 'edited-book';
  return {
    type: isBook ? 'book' : 'article',
    authors: (w.author ?? []).map((a) => ({ given: a.given ?? '', family: a.family ?? a.name ?? '' })).filter((a) => a.family),
    title: w.title?.[0] ?? '',
    container: isBook ? undefined : w['container-title']?.[0],
    publisher: w.publisher,
    year: y ? String(y) : undefined,
    month: m,
    day: d,
    volume: w.volume,
    issue: w.issue,
    pages: w.page?.replace('-', '–'),
    doi: w.DOI,
  };
}

export function splitName(name: string): Person {
  const n = name.trim();
  if (n.includes(',')) {
    const [family, given] = n.split(',', 2).map((x) => x.trim());
    return { given, family };
  }
  const parts = n.split(/\s+/);
  return { family: parts.pop() ?? '', given: parts.join(' ') };
}

interface OpenLibraryBook {
  title?: string;
  subtitle?: string;
  authors?: { name: string }[];
  publishers?: { name: string }[];
  publish_places?: { name: string }[];
  publish_date?: string;
  url?: string;
}

export function fromOpenLibrary(b: OpenLibraryBook): Source {
  return {
    type: 'book',
    authors: (b.authors ?? []).map((a) => splitName(a.name)),
    title: b.subtitle ? `${b.title}: ${b.subtitle}` : (b.title ?? ''),
    publisher: b.publishers?.[0]?.name,
    place: b.publish_places?.[0]?.name,
    year: b.publish_date?.match(/\d{4}/)?.[0],
  };
}

export function extractDOI(input: string): string | null {
  return input.match(/10\.\d{4,9}\/[^\s"<>]+/)?.[0].replace(/[.,;]$/, '') ?? null;
}
export function extractISBN(input: string): string | null {
  const digits = input.replace(/[^0-9Xx]/g, '');
  return digits.length === 10 || digits.length === 13 ? digits.toUpperCase() : null;
}

export async function lookup(input: string): Promise<Source> {
  const doi = extractDOI(input);
  if (doi) {
    const res = await fetch(`https://api.crossref.org/works/${encodeURIComponent(doi)}`);
    if (!res.ok) throw new Error(res.status === 404 ? 'No record for that DOI.' : `Crossref error ${res.status}`);
    const json = (await res.json()) as { message: CrossrefWork };
    return fromCrossref(json.message);
  }
  const isbn = extractISBN(input);
  if (isbn) {
    const res = await fetch(`https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`);
    if (!res.ok) throw new Error(`Open Library error ${res.status}`);
    const json = (await res.json()) as Record<string, OpenLibraryBook>;
    const b = json[`ISBN:${isbn}`];
    if (!b) throw new Error('No book found for that ISBN.');
    return fromOpenLibrary(b);
  }
  if (/^https?:\/\//i.test(input.trim())) {
    const u = new URL(input.trim());
    return { type: 'website', authors: [], title: '', container: u.hostname.replace(/^www\./, ''), url: u.toString(), accessed: new Date().toISOString().slice(0, 10) };
  }
  throw new Error('Paste a DOI, an ISBN, or a web address.');
}
