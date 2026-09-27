import { describe, expect, it } from 'vitest';
import {
  activeAnnouncement,
  adjustEntries,
  hashPassphrase,
  isPassHash,
  parseEditedRecord,
  parseSite,
  publishFile,
  readRepoFile,
  recordLabel,
  removeFromManifest,
  repoFromLocation,
  reversal,
  upsertManifest,
  utf8ToBase64,
  validRepo,
  verifyPassphrase,
} from './admin';
import { errorLog, installErrorLog } from './errlog';

describe('admin passphrase', () => {
  it('hashes and verifies (low iterations for speed)', async () => {
    const h = await hashPassphrase('correct horse', 1000);
    expect(isPassHash(h)).toBe(true);
    expect(h.startsWith('pbkdf2$1000$')).toBe(true);
    expect(await verifyPassphrase('correct horse', h)).toBe(true);
    expect(await verifyPassphrase('wrong horse', h)).toBe(false);
    expect(await verifyPassphrase('correct horse', 'nonsense')).toBe(false);
  });
  it('salts every hash', async () => {
    expect(await hashPassphrase('same', 1000)).not.toBe(await hashPassphrase('same', 1000));
  });
});

describe('economy adjustments', () => {
  it('makes admin ledger entries and reversals', () => {
    expect(adjustEntries('coins', 250.7, ' bonus ')).toEqual([{ currency: 'coins', amount: 250, reason: 'admin', ref: 'bonus' }]);
    expect(adjustEntries('chips', 0)).toEqual([]);
    expect(adjustEntries('chips', NaN)).toEqual([]);
    expect(reversal({ id: 'l1', at: '', currency: 'vouchers', amount: 3, reason: 'shop:x' })).toEqual({ currency: 'vouchers', amount: -3, reason: 'admin', ref: 'undo l1' });
  });
});

describe('site.json', () => {
  it('keeps only well-formed fields', () => {
    const s = parseSite({
      flags: { casino: false, arcade: 'no', bogus: true },
      announcement: { id: 'x1', text: '  Hello  ', level: 'party', link: 'javascript:alert(1)', until: '2026-10-01' },
    });
    expect(s.flags).toEqual({ casino: false });
    expect(s.announcement).toEqual({ id: 'x1', text: 'Hello', level: 'party', link: undefined, until: '2026-10-01' });
    expect(parseSite(null)).toEqual({ flags: {}, announcement: undefined, updatedAt: undefined });
    expect(parseSite({ announcement: { text: '' } }).announcement).toBeUndefined();
  });
  it('hides expired or dismissed announcements', () => {
    const s = parseSite({ announcement: { id: 'a', text: 'Hi', until: '2026-09-30' } });
    expect(activeAnnouncement(s, '2026-09-27', null)?.text).toBe('Hi');
    expect(activeAnnouncement(s, '2026-10-01', null)).toBeUndefined();
    expect(activeAnnouncement(s, '2026-09-27', 'a')).toBeUndefined();
  });
});

describe('publishing', () => {
  it('guesses the repo from a GitHub Pages address', () => {
    expect(repoFromLocation('titanmasterry.github.io', '/todo-list/')).toEqual({ owner: 'titanmasterry', repo: 'todo-list', branch: 'main' });
    expect(repoFromLocation('me.github.io', '/')).toEqual({ owner: 'me', repo: 'me.github.io', branch: 'main' });
    expect(repoFromLocation('example.com', '/x')).toEqual({});
    expect(validRepo({ owner: 'a', repo: 'b', branch: 'main' })).toBe(true);
    expect(validRepo({ owner: 'a/../b', repo: 'b', branch: 'main' })).toBe(false);
  });
  it('base64-encodes UTF-8', () => {
    expect(atob(utf8ToBase64('hi'))).toBe('hi');
    expect(new TextDecoder().decode(Uint8Array.from(atob(utf8ToBase64('🎉 é')), (c) => c.charCodeAt(0)))).toBe('🎉 é');
  });
  it('updates an existing file with its sha', async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    const f = (async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      if (!init?.method) return new Response(JSON.stringify({ sha: 'abc' }), { status: 200 });
      return new Response(JSON.stringify({ commit: { html_url: 'https://github.com/o/r/commit/1' } }), { status: 200 });
    }) as typeof fetch;
    const url = await publishFile({ owner: 'o', repo: 'r', branch: 'main', token: 't', path: 'public/site.json', content: '{}', message: 'm' }, f);
    expect(url).toBe('https://github.com/o/r/commit/1');
    expect(calls[0].url).toBe('https://api.github.com/repos/o/r/contents/public/site.json?ref=main');
    const body = JSON.parse(String(calls[1].init?.body));
    expect(body).toMatchObject({ message: 'm', branch: 'main', sha: 'abc' });
    expect(atob(body.content)).toBe('{}');
    expect((calls[1].init?.headers as Record<string, string>).Authorization).toBe('Bearer t');
  });
  it('creates a new file without a sha, and explains auth errors', async () => {
    let put: Record<string, unknown> = {};
    const f = (async (_url: string, init?: RequestInit) => {
      if (!init?.method) return new Response('{}', { status: 404 });
      put = JSON.parse(String(init.body));
      return new Response('{}', { status: 201 });
    }) as typeof fetch;
    await publishFile({ owner: 'o', repo: 'r', branch: 'main', token: 't', path: 'a.json', content: 'x', message: 'm' }, f);
    expect(put.sha).toBeUndefined();
    const denied = (async () => new Response(JSON.stringify({ message: 'Bad credentials' }), { status: 401 })) as typeof fetch;
    await expect(publishFile({ owner: 'o', repo: 'r', branch: 'main', token: 't', path: 'a', content: '', message: '' }, denied)).rejects.toThrow(/401/);
    expect(
      await readRepoFile({ owner: 'o', repo: 'r', branch: 'main', token: 't', path: 'nope' }, (async () => new Response('', { status: 404 })) as typeof fetch),
    ).toBeUndefined();
  });
  it('adds, replaces and removes games in games.json', () => {
    const start = JSON.stringify({ games: [{ id: 'snake', title: 'Snake' }], note: 'keep' });
    const added = JSON.parse(upsertManifest(start, { id: 'pong', title: 'Pong' }));
    expect(added.games.map((g: { id: string }) => g.id)).toEqual(['snake', 'pong']);
    expect(added.note).toBe('keep');
    const replaced = JSON.parse(upsertManifest(JSON.stringify(added), { id: 'snake', title: 'Snake 2' }));
    expect(replaced.games.find((g: { id: string }) => g.id === 'snake').title).toBe('Snake 2');
    expect(JSON.parse(upsertManifest(undefined, { id: 'a', title: 'A' }))).toEqual({ games: [{ id: 'a', title: 'A' }] });
    expect(JSON.parse(upsertManifest('[{"id":"x"}]', { id: 'y' }))).toEqual([{ id: 'x' }, { id: 'y' }]);
    expect(JSON.parse(removeFromManifest(JSON.stringify(added), 'snake')).games).toEqual([{ id: 'pong', title: 'Pong' }]);
  });
});

describe('data browser', () => {
  it('labels records', () => {
    expect(recordLabel({ id: 't1', title: 'Essay' })).toBe('Essay');
    expect(recordLabel({ id: 'c', front: 'Q?' })).toBe('Q?');
    expect(recordLabel(42)).toBe('42');
  });
  it('checks edited JSON and keeps the key', () => {
    expect(parseEditedRecord('{"id":"t1","title":"x"}', 'id', 't1')).toEqual({ ok: true, value: { id: 't1', title: 'x' } });
    expect(parseEditedRecord('{"id":"t2"}', 'id', 't1').ok).toBe(false);
    expect(parseEditedRecord('{oops', 'id', 't1').ok).toBe(false);
    expect(parseEditedRecord('[1]', 'id', 't1').ok).toBe(false);
    expect(parseEditedRecord('123', null, 'k')).toEqual({ ok: true, value: 123 });
  });
});

describe('error log', () => {
  it('records errors and rejections, capped', () => {
    const target = new EventTarget() as unknown as Window;
    installErrorLog(target);
    const before = errorLog.length;
    const err = Object.assign(new Event('error'), { message: 'boom', filename: 'app.js', lineno: 3 });
    target.dispatchEvent(err);
    const rej = Object.assign(new Event('unhandledrejection'), { reason: new Error('nope') });
    target.dispatchEvent(rej);
    expect(errorLog.slice(before).map((e) => e.message)).toEqual(['boom', 'nope']);
    expect(errorLog[before].source).toBe('app.js:3');
    for (let i = 0; i < 80; i++) target.dispatchEvent(Object.assign(new Event('error'), { message: `e${i}` }));
    expect(errorLog.length).toBe(50);
  });
});
