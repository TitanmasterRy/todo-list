import { describe, expect, it } from 'vitest';
import { toB64url } from './b64url';
import { buildSharedList, isDuplicate, parseSharedList, shareLink, SHARE_LIMITS } from './sharelist';
import type { Task } from './types';

const task = (o: Partial<Task>): Task => ({
  id: 'x',
  title: 'Lab report',
  tags: ['private'],
  priority: 'high',
  subtasks: [
    { id: 's1', title: 'Collect data', done: true },
    { id: 's2', title: 'Write it up', done: false },
  ],
  createdAt: '',
  updatedAt: '',
  order: 0,
  deferredCount: 3,
  ...o,
});

describe('group project links', () => {
  it('round-trips titles, dates, steps and optional notes, and nothing private', () => {
    const list = buildSharedList([task({ dueAt: '2026-10-02', type: 'project', estimateMin: 90, notes: 'Use the rubric', score: 95, completedAt: 'x' })], {
      name: 'Bio group',
      from: 'Sam',
      notes: false,
    });
    const url = shareLink(list, 'https://example.com/app/#old');
    expect(url.startsWith('https://example.com/app/#tasks=')).toBe(true);
    const back = parseSharedList(url.split('#tasks=')[1])!;
    expect(back).toEqual({ v: 1, name: 'Bio group', from: 'Sam', items: [{ t: 'Lab report', d: '2026-10-02', y: 'project', e: 90, s: ['Collect data', 'Write it up'] }] });
    expect(JSON.stringify(back)).not.toMatch(/private|95|rubric/);
    expect(buildSharedList([task({ notes: 'Use the rubric' })], { notes: true }).items[0].n).toBe('Use the rubric');
  });
  it('rejects junk and cleans untrusted fields', () => {
    expect(parseSharedList('%%%')).toBeNull();
    expect(parseSharedList(toB64url(JSON.stringify({ v: 2, items: [{ t: 'a' }] })))).toBeNull();
    expect(parseSharedList(toB64url(JSON.stringify({ v: 1, items: [{ t: '' }] })))).toBeNull();
    const code = toB64url(JSON.stringify({ v: 1, items: [{ t: 'ok‮', d: 'tomorrow', y: 'party', e: -5, s: [1, 'Step'] }, 'bad'] }));
    expect(parseSharedList(code)).toEqual({ v: 1, items: [{ t: 'ok', s: ['Step'] }] });
    expect(parseSharedList('A'.repeat(SHARE_LIMITS.code + 1))).toBeNull();
  });
  it('caps the number of tasks', () => {
    const many = Array.from({ length: 60 }, (_, i) => task({ id: `t${i}`, title: `T${i}` }));
    expect(buildSharedList(many, { notes: false }).items).toHaveLength(SHARE_LIMITS.items);
  });
  it('spots tasks already on the list', () => {
    const mine = [task({ title: 'Lab Report', dueAt: '2026-10-02' })];
    expect(isDuplicate({ t: 'lab report', d: '2026-10-02' }, mine)).toBe(true);
    expect(isDuplicate({ t: 'lab report', d: '2026-10-03' }, mine)).toBe(false);
  });
});
