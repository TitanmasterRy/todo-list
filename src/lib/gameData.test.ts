import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { saveKey } from './arcade';
import { collectGameData, gameDataToApply, normalizeGameData, SAVE_PREFIX, saveIdOf } from './gameData';
import { parseBundle } from './backup';

const storage = (m: Record<string, string>) => ({ getItem: (k: string) => m[k] ?? null });

describe('game data in backups', () => {
  it('uses the arcade save key format', () => {
    expect(SAVE_PREFIX).toBe(saveKey(''));
    expect(saveIdOf(saveKey('snake'))).toBe('snake');
    expect(saveIdOf('stats')).toBeUndefined();
  });

  it('collects only game progress, never settings or keys', () => {
    const d = collectGameData(
      storage({
        'homework-todo:factory': '{"v":3}',
        'homework-todo:factory-pending': '{"tasks":4}',
        'homework-todo:garden': '{"plots":[]}',
        'homework-todo:settings': '{"gistToken":"x"}',
        'homework-todo:vault': '{}',
      }),
      { snake: 'level 3' },
    );
    expect(d).toEqual({ local: { 'homework-todo:factory': '{"v":3}', 'homework-todo:garden': '{"plots":[]}' }, saves: { snake: 'level 3' } });
    expect(collectGameData(storage({}), {})).toBeUndefined();
  });

  it('a file cannot write other storage keys', () => {
    const d = normalizeGameData({ local: { 'homework-todo:settings': '{}', 'homework-todo:pet': '{"name":"Rex"}', 'homework-todo:garden': 5 }, saves: { '../x': 'a', ok: 'b' } });
    expect(d).toEqual({ local: { 'homework-todo:pet': '{"name":"Rex"}' }, saves: { ok: 'b' } });
    expect(normalizeGameData('nope')).toBeUndefined();
  });

  it('replace restores everything; merge only fills in games not played here', () => {
    const d = { local: { 'homework-todo:factory': 'old', 'homework-todo:garden': 'g' }, saves: { snake: 's', tetris: 't' } };
    const has = { local: (k: string) => k === 'homework-todo:factory', save: (id: string) => id === 'snake' };
    expect(gameDataToApply(d, 'replace', has)).toEqual(d);
    expect(gameDataToApply(d, 'merge', has)).toEqual({ local: { 'homework-todo:garden': 'g' }, saves: { tetris: 't' } });
  });

  it('parseBundle passes game data through to be checked on restore', () => {
    const gameData = { local: { 'homework-todo:pet': 'p', bad: 'x' }, saves: {} };
    expect(parseBundle({ tasks: [], courses: [], gameData }).gameData).toEqual(gameData);
    expect(parseBundle({ tasks: [], courses: [] }).gameData).toBeUndefined();
  });

  it('restores through IndexedDB and localStorage, merge keeping what this device has', async () => {
    const m = new Map<string, string>([['homework-todo:garden', 'mine']]);
    Object.assign(globalThis, { localStorage: { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) } });
    const { readGameData, writeGameData } = await import('./gameData');
    const n = await writeGameData({ local: { 'homework-todo:garden': 'theirs', 'homework-todo:pet': 'p', 'homework-todo:settings': 'x' }, saves: { snake: 'lvl 2' } }, 'merge');
    expect(n).toBe(2);
    expect(await readGameData()).toEqual({ local: { 'homework-todo:garden': 'mine', 'homework-todo:pet': 'p' }, saves: { snake: 'lvl 2' } });
    await writeGameData({ local: { 'homework-todo:garden': 'theirs' }, saves: {} }, 'replace');
    expect(m.get('homework-todo:garden')).toBe('theirs');
    expect(m.has('homework-todo:settings')).toBe(false);
  });
});
