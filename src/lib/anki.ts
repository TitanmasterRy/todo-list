// Anki interop: export a deck as a text file Anki imports, import Anki text exports, and import .apkg decks.
// .apkg files are a zip with a SQLite collection; sql.js (WebAssembly) and the unzip/zstd helpers load only
// when an .apkg is opened.
import { parseCloze } from './flashcards';

const stripBom = (s: string) => (s.charCodeAt(0) === 0xfeff ? s.slice(1) : s);

export interface ImportedCard {
  front: string;
  back: string;
  frontImage?: string;
  backImage?: string;
}
export interface ImportedDeck {
  name: string;
  cards: ImportedCard[];
}

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Anki "Notes in Plain Text" format with header lines (Anki 2.1.54+). Images are not included. */
export function toAnkiText(deckName: string, cards: { front: string; back: string }[]): string {
  const cell = (s: string) => escapeHtml(s).replace(/\t/g, ' ').replace(/\r?\n/g, '<br>');
  return ['#separator:tab', '#html:true', `#deck:${deckName.replace(/[\r\n]/g, ' ')}`, ...cards.map((c) => `${cell(c.front)}\t${cell(c.back)}`)].join('\n') + '\n';
}

/** HTML from Anki fields to plain text (line breaks kept, tags and entities removed). */
export function htmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(div|p|li)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Parse an Anki text export (tab- or semicolon-separated, optional # headers). */
export function fromAnkiText(text: string): ImportedCard[] {
  let sep = '\t';
  let html = true;
  const out: ImportedCard[] = [];
  for (const raw of stripBom(text).split(/\r?\n/)) {
    if (raw.startsWith('#')) {
      const m = /^#separator:(\w+)/i.exec(raw);
      if (m) sep = { tab: '\t', semicolon: ';', comma: ',', pipe: '|', space: ' ' }[m[1].toLowerCase()] ?? sep;
      if (/^#html:false/i.test(raw)) html = false;
      continue;
    }
    if (!raw.trim()) continue;
    const parts = raw.split(sep);
    if (parts.length < 2) continue;
    const clean = (s: string) => (html ? htmlToText(s) : s.trim());
    const front = clean(parts[0]);
    const back = clean(parts.slice(1).join(sep === '\t' ? ' ' : sep));
    if (front && back) out.push({ front, back });
  }
  return out;
}

type SqlJs = Awaited<ReturnType<typeof import('sql.js').default>>;

async function browserSql(): Promise<SqlJs> {
  const [{ default: init }, { default: wasmUrl }] = await Promise.all([import('sql.js'), import('sql.js/dist/sql-wasm.wasm?url')]);
  return init({ locateFile: () => wasmUrl });
}

const MIME: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml' };

function toDataUrl(name: string, bytes: Uint8Array): string | undefined {
  const mime = MIME[name.split('.').pop()?.toLowerCase() ?? ''];
  if (!mime || bytes.length > 400_000) return undefined; // keep synced data small
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return `data:${mime};base64,${btoa(bin)}`;
}

/** Read an .apkg (or .colpkg) file into decks of plain cards. `sql` lets tests supply sql.js. */
export async function importApkg(data: Uint8Array, sql?: SqlJs): Promise<ImportedDeck[]> {
  const { unzipSync } = await import('fflate');
  const files = unzipSync(data);
  let db: Uint8Array | undefined;
  if (files['collection.anki21b']) {
    const { decompress } = await import('fzstd');
    db = decompress(files['collection.anki21b']);
  } else db = files['collection.anki21'] ?? files['collection.anki2'];
  if (!db) throw new Error('This file has no Anki collection in it.');

  // media map: legacy JSON {"0": "image.png"}; newer files use a compressed protobuf we don't read (images skipped)
  let media: Record<string, string> = {};
  try {
    if (files.media) media = JSON.parse(new TextDecoder().decode(files.media)) as Record<string, string>;
  } catch {
    media = {};
  }
  const byName = new Map(Object.entries(media).map(([k, name]) => [name, files[k]]));
  const imageFor = (html: string): string | undefined => {
    const m = /<img[^>]+src=["']?([^"'>\s]+)/i.exec(html);
    const bytes = m ? byName.get(decodeURIComponent(m[1])) : undefined;
    return m && bytes ? toDataUrl(m[1], bytes) : undefined;
  };

  const SQL = sql ?? (await browserSql());
  const conn = new SQL.Database(db);
  try {
    const rows = <T>(q: string): T[] => {
      const res = conn.exec(q);
      if (!res.length) return [];
      const { columns, values } = res[0];
      return values.map((v) => Object.fromEntries(columns.map((c, i) => [c, v[i]])) as T);
    };
    const hasTable = (name: string) => rows<{ n: number }>(`SELECT count(*) AS n FROM sqlite_master WHERE type='table' AND name='${name}'`)[0]?.n > 0;

    // deck names and which note types are cloze
    const deckName = new Map<number, string>();
    const clozeTypes = new Set<number>();
    const col = rows<{ models: string; decks: string }>('SELECT models, decks FROM col')[0];
    if (col?.decks && col.decks.length > 2) {
      for (const [id, d] of Object.entries(JSON.parse(col.decks) as Record<string, { name: string }>)) deckName.set(Number(id), d.name);
      for (const [id, m] of Object.entries(JSON.parse(col.models) as Record<string, { type?: number }>)) if (m.type === 1) clozeTypes.add(Number(id));
    } else if (hasTable('decks')) {
      for (const d of rows<{ id: number; name: string }>('SELECT id, name FROM decks')) deckName.set(Number(d.id), String(d.name).split('\x1f').join('::'));
    }
    const noteDeck = new Map<number, number>();
    for (const c of rows<{ nid: number; did: number }>('SELECT nid, did FROM cards')) if (!noteDeck.has(Number(c.nid))) noteDeck.set(Number(c.nid), Number(c.did));

    const decks = new Map<string, ImportedCard[]>();
    for (const n of rows<{ id: number; mid: number; flds: string }>('SELECT id, mid, flds FROM notes')) {
      const fields = String(n.flds).split('\x1f');
      const name = deckName.get(noteDeck.get(Number(n.id)) ?? -1) ?? 'Imported deck';
      if (/Please update to the latest Anki version/i.test(fields[0] ?? '')) continue; // placeholder in new-format files
      const list = decks.get(name) ?? [];
      const isCloze = clozeTypes.has(Number(n.mid)) || /\{\{c\d+::/.test(fields[0] ?? '');
      if (isCloze) {
        const extra = htmlToText(fields[1] ?? '');
        for (const c of parseCloze(htmlToText(fields[0]))) list.push({ front: c.front, back: extra ? `${c.back}\n\n${extra}` : c.back });
      } else {
        const front = htmlToText(fields[0] ?? '');
        const back = htmlToText(fields.slice(1).join('\n'));
        const frontImage = imageFor(fields[0] ?? '');
        const backImage = imageFor(fields.slice(1).join(' '));
        if ((front || frontImage) && (back || backImage)) list.push({ front: front || '(image)', back: back || '(image)', frontImage, backImage });
      }
      decks.set(name, list);
    }
    return [...decks.entries()].filter(([, cards]) => cards.length).map(([name, cards]) => ({ name: name.split('::').pop() || name, cards }));
  } finally {
    conn.close();
  }
}
