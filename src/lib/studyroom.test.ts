import { describe, expect, it } from 'vitest';
import { createRoom, decodeRoom, encodeRoom, formatLeft, phaseAt, roomLink, totalMs, type StudyRoom } from './studyroom';
import { toB64url } from './b64url';

const MIN = 60_000;
const T0 = Date.UTC(2026, 8, 25, 15, 0, 0);
const room = (o: Partial<StudyRoom> = {}): StudyRoom => ({ id: 'abcd1234', name: 'Bio crew', start: T0, work: 25, brk: 5, long: 15, every: 4, rounds: 0, ...o });

describe('study room codes', () => {
  it('round-trips through a code and a link', () => {
    const r = room({ name: 'Calc 🧮 study' });
    expect(decodeRoom(encodeRoom(r))).toEqual(r);
    const link = roomLink(r, 'https://example.com/app/#old');
    expect(link.startsWith('https://example.com/app/#room=')).toBe(true);
    expect(decodeRoom(link)).toEqual(r);
    expect(decodeRoom(`https://example.com/?room=${encodeRoom(r)}&x=1`)).toEqual(r);
    expect(encodeRoom(r).length).toBeLessThan(160);
  });

  it('creates rooms that start on a whole second, with clamped lengths', () => {
    const r = createRoom({ name: '  ', work: 999, brk: 0, long: 20, every: 3, startInMin: 2 }, T0 + 1234);
    expect(r.start).toBe(T0 + 2 * MIN + 2000);
    expect(r).toMatchObject({ name: 'Study room', work: 180, brk: 1, long: 20, every: 3, rounds: 0 });
    expect(r.id).toMatch(/^[a-z0-9]{10}$/);
  });

  it('rejects bad or hostile codes', () => {
    const enc = (o: unknown) => toB64url(JSON.stringify(o));
    const ok = { v: 1, i: 'abcd1234', n: 'x', s: T0 / 1000, w: 25, b: 5 };
    expect(decodeRoom(enc(ok))).not.toBeNull();
    expect(decodeRoom('')).toBeNull();
    expect(decodeRoom('not base64 !!')).toBeNull();
    expect(decodeRoom(enc([1, 2]))).toBeNull();
    expect(decodeRoom(enc({ ...ok, v: 2 }))).toBeNull();
    expect(decodeRoom(enc({ ...ok, i: '<script>' }))).toBeNull();
    expect(decodeRoom(enc({ ...ok, w: 0 }))).toBeNull();
    expect(decodeRoom(enc({ ...ok, w: 2.5 }))).toBeNull();
    expect(decodeRoom(enc({ ...ok, b: '5' }))).toBeNull();
    expect(decodeRoom(enc({ ...ok, s: 1 }))).toBeNull();
    expect(decodeRoom(enc({ ...ok, e: 99 }))).toBeNull();
    expect(decodeRoom('A'.repeat(5000))).toBeNull();
    // names are cleaned and cut, never rejected for content
    expect(decodeRoom(enc({ ...ok, n: '\u0000<b>hi</b>‮' + 'x'.repeat(80) }))!.name).toBe('<b>hi</b>' + 'x'.repeat(31));
  });
});

describe('phaseAt', () => {
  it('waits until the start time', () => {
    expect(phaseAt(room(), T0 - 90_000)).toMatchObject({ phase: 'waiting', left: 90_000, endsAt: T0, index: -1 });
  });

  it('alternates focus and short breaks, with a long break after every 4th round', () => {
    const r = room();
    expect(phaseAt(r, T0)).toMatchObject({ phase: 'work', round: 1, left: 25 * MIN, endsAt: T0 + 25 * MIN, index: 0 });
    expect(phaseAt(r, T0 + 24 * MIN + 59_000)).toMatchObject({ phase: 'work', round: 1, left: 1000 });
    expect(phaseAt(r, T0 + 25 * MIN)).toMatchObject({ phase: 'break', round: 1, left: 5 * MIN, index: 1 });
    expect(phaseAt(r, T0 + 30 * MIN)).toMatchObject({ phase: 'work', round: 2, index: 2 });
    // round 4 ends at 4*25 + 3*5 = 115 min; the long break follows
    expect(phaseAt(r, T0 + 115 * MIN)).toMatchObject({ phase: 'long', round: 4, left: 15 * MIN, length: 15 * MIN, index: 7 });
    // the cycle (130 min) repeats: round 5 starts after the long break
    expect(phaseAt(r, T0 + 130 * MIN)).toMatchObject({ phase: 'work', round: 5, endsAt: T0 + 155 * MIN, index: 8 });
    expect(phaseAt(r, T0 + 10 * 130 * MIN + 115 * MIN + 1)).toMatchObject({ phase: 'long', round: 44 });
  });

  it('has no long breaks when none are set', () => {
    const r = room({ long: 0, every: 4 });
    expect(phaseAt(r, T0 + 115 * MIN)).toMatchObject({ phase: 'break', round: 4 });
    expect(phaseAt(r, T0 + 120 * MIN)).toMatchObject({ phase: 'work', round: 5 });
    expect(phaseAt(room({ every: 0 }), T0 + 115 * MIN).phase).toBe('break');
  });

  it('ends after the set number of rounds, without a last break', () => {
    const r = room({ rounds: 2 });
    expect(totalMs(r)).toBe(55 * MIN);
    expect(phaseAt(r, T0 + 54 * MIN)).toMatchObject({ phase: 'work', round: 2 });
    expect(phaseAt(r, T0 + 55 * MIN)).toMatchObject({ phase: 'done', round: 2, left: 0, endsAt: T0 + 55 * MIN, index: 3 });
    expect(phaseAt(r, T0 + 999 * MIN).phase).toBe('done');
    // 5 rounds with a long break after the 4th
    expect(totalMs(room({ rounds: 5 }))).toBe((5 * 25 + 3 * 5 + 15) * MIN);
    expect(phaseAt(room({ rounds: 5 }), T0 + 154 * MIN)).toMatchObject({ phase: 'work', round: 5 });
    expect(phaseAt(room({ rounds: 5 }), T0 + 155 * MIN).phase).toBe('done');
    expect(totalMs(room())).toBe(Infinity);
  });

  it('gives every device the same answer from the link alone', () => {
    const r = decodeRoom(encodeRoom(room()))!;
    const now = T0 + 77 * MIN + 12_345;
    expect(phaseAt(r, now)).toEqual(phaseAt(room(), now));
    // the phase index changes exactly at phase boundaries
    const seen = new Set<number>();
    for (let t = T0; t < T0 + 260 * MIN; t += MIN) seen.add(phaseAt(r, t).index);
    expect([...seen]).toEqual(Array.from({ length: 16 }, (_, i) => i));
  });
});

describe('formatLeft', () => {
  it('rounds up and shows hours when needed', () => {
    expect(formatLeft(0)).toBe('00:00');
    expect(formatLeft(1)).toBe('00:01');
    expect(formatLeft(25 * MIN)).toBe('25:00');
    expect(formatLeft(61 * MIN + 500)).toBe('1:01:01');
  });
});
