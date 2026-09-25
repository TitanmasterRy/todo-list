import type { ExportBundle, Task, Course, Template, Stats, DayNote, Deck, Card, Tombstone, LedgerEntry } from './types';
import { DEFAULT_STATS } from './types';

/** Tombstones older than this are forgotten (every device has synced by then). */
export const TOMBSTONE_DAYS = 60;
/** Deleted tasks stay restorable from the trash this long. */
export const TRASH_DAYS = 30;

export interface BundleData {
  tasks: Task[];
  courses: Course[];
  templates: Template[];
  stats: Stats;
  dayNotes: DayNote[];
  decks?: Deck[];
  cards?: Card[];
  tombstones?: Tombstone[];
  ledger?: LedgerEntry[];
}

export function buildBundle(data: BundleData): ExportBundle {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    tasks: data.tasks,
    courses: data.courses,
    templates: data.templates,
    stats: data.stats,
    dayNotes: data.dayNotes,
    decks: data.decks ?? [],
    cards: data.cards ?? [],
    tombstones: data.tombstones ?? [],
    ledger: data.ledger ?? [],
  };
}

export function downloadJSON(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function backupFilename(now: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `homework-todo-backup-${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}.json`;
}

/** Validate and normalize an imported bundle. Throws with a readable message on bad input. */
export function parseBundle(raw: unknown): ExportBundle {
  if (!raw || typeof raw !== 'object') throw new Error('Not a JSON object');
  const b = raw as Partial<ExportBundle>;
  if (!Array.isArray(b.tasks) || !Array.isArray(b.courses)) throw new Error('Missing tasks or courses');
  const tasks: Task[] = b.tasks.map((t) => normalizeTask(t as Partial<Task>));
  const courses: Course[] = b.courses
    .filter((c): c is Course => !!c && typeof (c as Course).id === 'string' && typeof (c as Course).name === 'string')
    .map((c) => ({ id: c.id, name: c.name, color: c.color ?? '#6c5ce7', emoji: c.emoji, archived: !!c.archived, credits: c.credits, term: c.term, finalGrade: c.finalGrade, schoologyName: c.schoologyName, updatedAt: c.updatedAt }));
  const templates: Template[] = Array.isArray(b.templates) ? (b.templates as Template[]).filter((t) => t && t.id && t.name && t.task) : [];
  const stats: Stats = { ...structuredClone(DEFAULT_STATS), ...((b.stats as Partial<Stats>) ?? {}) };
  const dayNotes: DayNote[] = Array.isArray(b.dayNotes) ? (b.dayNotes as DayNote[]).filter((n) => n && n.date) : [];
  const decks: Deck[] = Array.isArray(b.decks) ? (b.decks as Deck[]).filter((d) => d && d.id && d.name) : [];
  const cards: Card[] = Array.isArray(b.cards) ? (b.cards as Card[]).filter((c) => c && c.id && c.deckId && typeof c.front === 'string') : [];
  const tombstones: Tombstone[] = Array.isArray(b.tombstones)
    ? (b.tombstones as Tombstone[]).filter((t) => t && typeof t.id === 'string' && typeof t.kind === 'string' && typeof t.deletedAt === 'string')
    : [];
  const ledger: LedgerEntry[] = Array.isArray(b.ledger)
    ? (b.ledger as LedgerEntry[]).filter((e) => e && typeof e.id === 'string' && typeof e.currency === 'string' && Number.isFinite(e.amount))
    : [];
  return { version: 1, exportedAt: b.exportedAt ?? new Date().toISOString(), tasks, courses, templates, stats, dayNotes, decks, cards, tombstones, ledger, settings: b.settings };
}

export function normalizeTask(t: Partial<Task>): Task {
  if (!t || typeof t.id !== 'string' || typeof t.title !== 'string') throw new Error('Task missing id or title');
  const now = new Date().toISOString();
  return {
    id: t.id,
    title: t.title,
    notes: t.notes,
    courseId: t.courseId,
    tags: Array.isArray(t.tags) ? t.tags.map(String) : [],
    priority: t.priority ?? 'normal',
    dueAt: t.dueAt,
    estimateMin: t.estimateMin,
    type: t.type,
    weight: t.weight,
    score: t.score,
    subtasks: Array.isArray(t.subtasks) ? t.subtasks.map((s, i) => ({ id: s.id ?? `${t.id}_s${i}`, title: String(s.title ?? ''), done: !!s.done })) : [],
    recurrence: t.recurrence,
    createdAt: t.createdAt ?? now,
    completedAt: t.completedAt,
    updatedAt: t.updatedAt ?? t.createdAt ?? now,
    order: typeof t.order === 'number' ? t.order : 0,
    deferredCount: typeof t.deferredCount === 'number' ? t.deferredCount : 0,
    pinnedDay: t.pinnedDay,
    frog: t.frog,
    frogDate: t.frogDate,
    archived: t.archived,
    templateId: t.templateId,
    source: t.source,
    externalId: t.externalId,
    url: t.url,
    syncedAt: t.syncedAt,
    gradedXpAt: t.gradedXpAt,
    autoDescribed: t.autoDescribed,
  };
}

/** Merge two datasets, last-write-wins per task by updatedAt. Returns merged data and ids whose timestamps clashed within the same second. */
export function mergeBundles(local: ExportBundle, remote: ExportBundle, now: Date = new Date()): { merged: ExportBundle; conflicts: string[] } {
  const conflicts: string[] = [];
  const tombstones = mergeTombstones(local.tombstones ?? [], remote.tombstones ?? [], now);
  const deletedAt = new Map(tombstones.map((t) => [`${t.kind}:${t.id}`, t.deletedAt]));
  /** An item survives unless it was deleted at or after its last edit. */
  const alive = (kind: Tombstone['kind'], id: string, updatedAt: string | undefined) => {
    const d = deletedAt.get(`${kind}:${id}`);
    return !d || (!!updatedAt && updatedAt > d);
  };
  const tasks = new Map<string, Task>();
  for (const t of local.tasks) tasks.set(t.id, t);
  for (const r of remote.tasks) {
    const l = tasks.get(r.id);
    if (!l) {
      tasks.set(r.id, r);
      continue;
    }
    if (l.updatedAt === r.updatedAt) continue;
    const ls = Math.floor(new Date(l.updatedAt).getTime() / 1000);
    const rs = Math.floor(new Date(r.updatedAt).getTime() / 1000);
    if (ls === rs && JSON.stringify(l) !== JSON.stringify(r)) conflicts.push(r.id);
    if (r.updatedAt > l.updatedAt) tasks.set(r.id, r);
  }
  const courses = new Map<string, Course>();
  for (const c of [...remote.courses, ...local.courses]) {
    const cur = courses.get(c.id);
    // last-write-wins; on a tie (or courses from versions without updatedAt) local wins
    if (!cur || (c.updatedAt ?? '') >= (cur.updatedAt ?? '')) courses.set(c.id, c);
  }
  const templates = new Map<string, Template>();
  for (const t of [...remote.templates, ...local.templates]) templates.set(t.id, t);
  const notes = new Map<string, DayNote>();
  for (const n of [...remote.dayNotes, ...local.dayNotes]) notes.set(n.date, n);
  const decks = new Map<string, Deck>();
  for (const d of [...(remote.decks ?? []), ...(local.decks ?? [])]) {
    const cur = decks.get(d.id);
    if (!cur || d.updatedAt > cur.updatedAt) decks.set(d.id, d);
  }
  const cards = new Map<string, Card>();
  for (const c of [...(remote.cards ?? []), ...(local.cards ?? [])]) {
    const cur = cards.get(c.id);
    if (!cur || c.updatedAt > cur.updatedAt) cards.set(c.id, c);
  }
  // stats: take the one with more XP (completions are monotonic), merge completion days by max
  const stats: Stats = local.stats.xp >= remote.stats.xp ? structuredClone(local.stats) : structuredClone(remote.stats);
  const days = { ...remote.stats.completionsByDay };
  for (const [k, v] of Object.entries(local.stats.completionsByDay)) days[k] = Math.max(days[k] ?? 0, v);
  stats.completionsByDay = days;
  stats.badges = Array.from(new Set([...local.stats.badges, ...remote.stats.badges]));
  stats.cardsReviewed = Math.max(local.stats.cardsReviewed ?? 0, remote.stats.cardsReviewed ?? 0);
  // ledger entries are immutable, so a union by id is exact
  const ledger = new Map<string, LedgerEntry>();
  for (const e of [...(remote.ledger ?? []), ...(local.ledger ?? [])]) ledger.set(e.id, e);
  const liveDecks = [...decks.values()].filter((d) => alive('deck', d.id, d.updatedAt));
  const deckIds = new Set(liveDecks.map((d) => d.id));
  return {
    merged: {
      version: 1,
      exportedAt: now.toISOString(),
      tasks: [...tasks.values()].filter((t) => alive('task', t.id, t.updatedAt)),
      courses: [...courses.values()].filter((c) => alive('course', c.id, c.updatedAt)),
      templates: [...templates.values()].filter((t) => alive('template', t.id, undefined)),
      stats,
      dayNotes: [...notes.values()],
      decks: liveDecks,
      cards: [...cards.values()].filter((c) => deckIds.has(c.deckId) && alive('card', c.id, c.updatedAt)),
      tombstones,
      ledger: [...ledger.values()].sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0)),
    },
    conflicts,
  };
}

/** Union two tombstone lists (latest deletion wins), forgetting ones past TOMBSTONE_DAYS and trash snapshots past TRASH_DAYS. */
export function mergeTombstones(a: Tombstone[], b: Tombstone[], now: Date = new Date()): Tombstone[] {
  const forget = new Date(now.getTime() - TOMBSTONE_DAYS * 86_400_000).toISOString();
  const trashCutoff = new Date(now.getTime() - TRASH_DAYS * 86_400_000).toISOString();
  const out = new Map<string, Tombstone>();
  for (const t of [...a, ...b]) {
    if (t.deletedAt < forget) continue;
    const key = `${t.kind}:${t.id}`;
    const cur = out.get(key);
    if (!cur || t.deletedAt > cur.deletedAt) out.set(key, { ...t, task: t.task ?? cur?.task });
  }
  return [...out.values()].map((t) => (t.task && t.deletedAt < trashCutoff ? { kind: t.kind, id: t.id, deletedAt: t.deletedAt } : t));
}

/** True when two bundles differ in anything sync carries (ignores exportedAt). */
export function bundlesDiffer(a: ExportBundle, b: ExportBundle): boolean {
  const key = (x: ExportBundle) =>
    JSON.stringify({ t: x.tasks, c: x.courses, tp: x.templates, n: x.dayNotes, s: x.stats, d: x.decks ?? [], k: x.cards ?? [], ts: x.tombstones ?? [], l: x.ledger ?? [] });
  return key(a) !== key(b);
}
