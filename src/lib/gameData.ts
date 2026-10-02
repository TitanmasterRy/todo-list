// Game progress in backups. The Play games keep their saves on this device (localStorage for Orebelt, the
// garden, the pet and the rest; IndexedDB `gamesave:<id>` for sandboxed arcade games), outside the synced
// bundle, so a JSON backup carries them in `gameData` and an import puts them back. Only known keys travel
// (nothing from settings, sign-ins or the key vault), and each value stays a string, as the games stored it.
import { getMetaEntries, putMeta } from './storage';

/** localStorage entries that hold game progress. (Not factory-pending: homework rewards banked on this device pay out here only.) */
export const GAME_KEYS = [
  'homework-todo:factory',
  'homework-todo:garden',
  'homework-todo:pet',
  'homework-todo:arcade-scores',
  'homework-todo:arcade-times',
  'homework-todo:race-ghosts',
  'homework-todo:holdem-table',
  'homework-todo:companion',
] as const;

/** Arcade saves are capped at 1 MB each by the game player; leave room for a little overhead. */
const MAX_VALUE = 1_100_000;
/** arcade.ts saveKey(): not imported, so parseBundle (first load) doesn't pull in the arcade code. */
export const SAVE_PREFIX = 'gamesave:';
const SAVE_ID = /^[\w.-]{1,80}$/;

export interface GameData {
  /** localStorage key → stored text. */
  local: Record<string, string>;
  /** Arcade game id → saved text. */
  saves: Record<string, string>;
}

/** What to export: undefined when no game has saved anything yet. */
export function collectGameData(storage: Pick<Storage, 'getItem'> | undefined, saves: Record<string, string>): GameData | undefined {
  const local: Record<string, string> = {};
  for (const k of GAME_KEYS) {
    const v = storage?.getItem(k);
    if (v) local[k] = v;
  }
  const out = normalizeGameData({ local, saves });
  return out && (Object.keys(out.local).length || Object.keys(out.saves).length) ? out : undefined;
}

/** Keep known keys with string values of a sane size (a file can't write anything else on import). */
export function normalizeGameData(raw: unknown): GameData | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const r = raw as Partial<Record<keyof GameData, unknown>>;
  const ok = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= MAX_VALUE;
  const local: Record<string, string> = {};
  const src = r.local && typeof r.local === 'object' ? (r.local as Record<string, unknown>) : {};
  for (const k of GAME_KEYS) if (ok(src[k])) local[k] = src[k];
  const saves: Record<string, string> = {};
  for (const [id, v] of Object.entries(r.saves && typeof r.saves === 'object' ? (r.saves as Record<string, unknown>) : {})) if (SAVE_ID.test(id) && ok(v)) saves[id] = v;
  return { local, saves };
}

/** The arcade-save id for an IndexedDB meta key, or undefined when it isn't one. */
export function saveIdOf(metaKey: string): string | undefined {
  const id = metaKey.startsWith(SAVE_PREFIX) ? metaKey.slice(SAVE_PREFIX.length) : '';
  return SAVE_ID.test(id) ? id : undefined;
}

/**
 * Which entries to write. Replace puts the backup's progress over this device's; merge only fills in games
 * this device hasn't played (two saves of one game can't be combined).
 */
export function gameDataToApply(d: GameData, mode: 'replace' | 'merge', has: { local: (k: string) => boolean; save: (id: string) => boolean }): GameData {
  if (mode === 'replace') return d;
  return {
    local: Object.fromEntries(Object.entries(d.local).filter(([k]) => !has.local(k))),
    saves: Object.fromEntries(Object.entries(d.saves).filter(([id]) => !has.save(id))),
  };
}

function localStore(): Storage | undefined {
  try {
    return typeof localStorage === 'undefined' ? undefined : localStorage;
  } catch {
    return undefined;
  }
}

/** This device's game progress, for a backup. */
export async function readGameData(): Promise<GameData | undefined> {
  const saves: Record<string, string> = {};
  for (const [k, v] of await getMetaEntries(SAVE_PREFIX)) {
    const id = saveIdOf(k);
    if (id && typeof v === 'string') saves[id] = v;
  }
  return collectGameData(localStore(), saves);
}

/** Restore game progress from a backup. Returns how many games' progress was written. */
export async function writeGameData(raw: unknown, mode: 'replace' | 'merge'): Promise<number> {
  const d = normalizeGameData(raw);
  if (!d) return 0;
  const storage = localStore();
  const saved = new Set((await getMetaEntries(SAVE_PREFIX)).map(([k]) => saveIdOf(k)));
  const todo = gameDataToApply(d, mode, { local: (k) => !!storage?.getItem(k), save: (id) => saved.has(id) });
  let n = 0;
  for (const [k, v] of Object.entries(todo.local)) {
    try {
      storage?.setItem(k, v);
      n++;
    } catch {
      /* quota: skip this one */
    }
  }
  for (const [id, v] of Object.entries(todo.saves)) {
    await putMeta(SAVE_PREFIX + id, v);
    n++;
  }
  return n;
}
