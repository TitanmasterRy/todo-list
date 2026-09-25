import { describe, expect, it } from 'vitest';
import { manifestEntry, parseManifest, readScoreMessage, sandboxFor, validateGame } from './arcade';

describe('arcade manifest', () => {
  it('accepts files in games/ and https links', () => {
    const { games, errors } = parseManifest([
      { id: 'snake', title: 'Snake', src: 'snake.html', cost: 1, theme: 'arcade' },
      { id: 'itch', title: 'Itch game', url: 'https://example.itch.io/game/embed', cost: 2, minutes: 10 },
    ]);
    expect(errors).toEqual([]);
    expect(games.map((g) => g.id)).toEqual(['snake', 'itch']);
    expect(games[1].minutes).toBe(10);
  });
  it('accepts { games: [...] } and defaults cost to 1', () => {
    expect(parseManifest({ games: [{ id: 'a', title: 'A', src: 'a.html' }] }).games[0].cost).toBe(1);
  });
  it('rejects unsafe paths, http links and duplicates', () => {
    const { games, errors } = parseManifest([
      { id: 'up', title: 'Up', src: '../index.html' },
      { id: 'abs', title: 'Abs', src: '/etc/x.html' },
      { id: 'js', title: 'JS', src: 'javascript:alert(1)' },
      { id: 'http', title: 'Http', url: 'http://example.com' },
      { id: 'ok', title: 'OK', src: 'ok.html' },
      { id: 'ok', title: 'Again', src: 'ok2.html' },
      { id: 'bad id!', title: 'x', src: 'x.html' },
    ]);
    expect(games.map((g) => g.id)).toEqual(['ok']);
    expect(errors).toHaveLength(6);
  });
  it('strips inline HTML from site manifests', () => {
    expect(parseManifest([{ id: 'h', title: 'H', html: '<p>x</p>', src: 'h.html' }]).games[0].html).toBeUndefined();
  });
  it('clamps cost and minutes', () => {
    const g = validateGame({ id: 'c', title: 'C', src: 'c.html', cost: 1000, minutes: -5 }).game!;
    expect(g.cost).toBe(99);
    expect(g.minutes).toBe(1);
  });
});

describe('sandbox and bridge', () => {
  it('never grants same-origin to site files or uploads', () => {
    expect(sandboxFor({})).not.toContain('allow-same-origin');
    expect(sandboxFor({ url: 'https://x' })).toContain('allow-same-origin');
  });
  it('reads score messages', () => {
    expect(readScoreMessage({ type: 'hwtodo:score', score: 42.7 })).toBe(42);
    expect(readScoreMessage({ type: 'other', score: 1 })).toBeNull();
    expect(readScoreMessage({ type: 'hwtodo:score', score: 'NaN' })).toBeNull();
    expect(readScoreMessage('hi')).toBeNull();
  });
  it('builds a manifest entry for a local game', () => {
    expect(manifestEntry({ id: 'my-game', title: 'Mine', emoji: '🎯', cost: 2, html: '<p/>' })).toEqual({
      id: 'my-game',
      title: 'Mine',
      emoji: '🎯',
      src: 'my-game.html',
      cost: 2,
    });
  });
});
