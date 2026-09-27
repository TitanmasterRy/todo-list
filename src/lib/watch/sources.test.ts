import { describe, expect, it } from 'vitest';
import { cleanSource, emptyWatch, loadWatch, normalizeServer, parseTokens, parseWatch, rememberPosition, saveWatch, WATCH_KEY, WATCH_VERSION, withToken } from './sources';

describe('watch sources storage', () => {
  it('starts fresh from nothing or junk', () => {
    for (const raw of [null, '', '{', '42', '"x"', 'null']) {
      const d = parseWatch(raw);
      expect(d.v).toBe(WATCH_VERSION);
      expect(d.sources).toEqual([]);
      expect(d.deviceId).toMatch(/^[0-9a-f]{32}$/);
    }
  });

  it('migrates the unversioned array format', () => {
    const d = parseWatch(JSON.stringify([{ id: 'a1', kind: 'embed', name: 'Clip', url: 'https://youtu.be/dQw4w9WgXcQ' }]));
    expect(d.v).toBe(1);
    expect(d.sources).toHaveLength(1);
    expect(d.sources[0]).toMatchObject({ id: 'a1', kind: 'embed', name: 'Clip' });
  });

  it('drops invalid sources and keeps valid fields only', () => {
    const d = parseWatch(
      JSON.stringify({
        v: 1,
        deviceId: 'dev-1234567890',
        sources: [
          { id: 'ok', kind: 'jellyfin', name: 'Home', url: 'https://jf.example.com/web/index.html#!/home', userId: 'abc123', userName: 'kid', token: 'should-not-survive' },
          { id: 'bad kind', kind: 'netflix', url: 'https://netflix.com' },
          { id: 'js', kind: 'embed', url: 'javascript:alert(1)' },
          { id: 'ok', kind: 'embed', url: 'https://vimeo.com/1' }, // duplicate id
          'nope',
        ],
        positions: { ok: { t: 120, at: 5 }, 'bad key!': { t: 1, at: 1 }, neg: { t: -1, at: 1 } },
        speed: 1.5,
      }),
    );
    expect(d.deviceId).toBe('dev-1234567890');
    expect(d.sources).toEqual([{ id: 'ok', kind: 'jellyfin', name: 'Home', url: 'https://jf.example.com', userId: 'abc123', userName: 'kid', addedAt: new Date(0).toISOString() }]);
    expect(d.positions).toEqual({ ok: { t: 120, at: 5 } });
    expect(d.speed).toBe(1.5);
  });

  it('normalizes server addresses', () => {
    expect(normalizeServer('https://jf.example.com/')).toBe('https://jf.example.com');
    expect(normalizeServer('jf.example.com:8920/jellyfin/web/#/home.html')).toBe('https://jf.example.com:8920/jellyfin');
    expect(normalizeServer('http://192.168.1.5:8096')).toBe('http://192.168.1.5:8096');
    expect(normalizeServer('ftp://x')).toBeNull();
    expect(cleanSource({ id: 'x', kind: 'web', url: 'https://app.plex.tv/desktop' })?.name).toBe('app.plex.tv');
  });

  it('saves and loads through storage, surviving storage errors', () => {
    const mem = new Map<string, string>();
    const storage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) };
    const d = emptyWatch('device-abcdefgh');
    d.sources.push({ id: 's1', kind: 'direct', name: 'Clip', url: 'https://x.example/a.mp4', addedAt: '2026-01-01T00:00:00.000Z' });
    expect(saveWatch(d, storage)).toBe(true);
    expect(mem.has(WATCH_KEY)).toBe(true);
    expect(loadWatch(storage)).toEqual(d);
    const broken = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('quota');
      },
    };
    expect(loadWatch(broken).sources).toEqual([]);
    expect(saveWatch(d, broken)).toBe(false);
  });

  it('remembers positions, but not near the start or the end', () => {
    let p = rememberPosition({}, 's1', 125.7, 600, 1);
    expect(p).toEqual({ s1: { t: 125, at: 1 } });
    p = rememberPosition(p, 's1', 3, 600, 2);
    expect(p).toEqual({});
    p = rememberPosition({ s1: { t: 100, at: 1 } }, 's1', 590, 600, 3);
    expect(p).toEqual({});
    // live streams have no duration
    expect(rememberPosition({}, 'live', 300, Infinity, 4)).toEqual({ live: { t: 300, at: 4 } });
  });

  it('keeps sign-in tokens in a small map', () => {
    let json = withToken('', 'a', 'tok-a');
    json = withToken(json, 'b', 'tok-b');
    expect(parseTokens(json)).toEqual({ a: 'tok-a', b: 'tok-b' });
    json = withToken(json, 'a', '');
    expect(parseTokens(json)).toEqual({ b: 'tok-b' });
    expect(withToken(json, 'b', '')).toBe('');
    expect(parseTokens('garbage')).toEqual({});
    expect(parseTokens('{"x":5,"ok":"t"}')).toEqual({ ok: 't' });
  });
});
