import { describe, expect, it } from 'vitest';
import { TOPICS, searchTopics } from './studyhelp';

describe('TOPICS', () => {
  it('has a good number of topics', () => {
    expect(TOPICS.length).toBeGreaterThanOrEqual(22);
  });
  it('every topic has a unique kebab-case id', () => {
    const ids = TOPICS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });
  it('every topic has a title, emoji, tags and at least 3 sections', () => {
    for (const t of TOPICS) {
      expect(t.title.trim().length).toBeGreaterThan(0);
      expect(t.emoji.length).toBeGreaterThan(0);
      expect(t.tags.length).toBeGreaterThan(0);
      expect(t.sections.length).toBeGreaterThanOrEqual(3);
      expect(t.sections.length).toBeLessThanOrEqual(7);
    }
  });
  it('every section has a heading and non-empty items', () => {
    for (const t of TOPICS) {
      for (const s of t.sections) {
        expect(s.heading.trim().length).toBeGreaterThan(0);
        expect(s.items.length).toBeGreaterThanOrEqual(2);
        expect(s.items.length).toBeLessThanOrEqual(9);
        for (const item of s.items) expect(item.trim().length).toBeGreaterThan(0);
      }
    }
  });
  it('covers the required subjects', () => {
    const subjects = new Set(TOPICS.map((t) => t.subject));
    for (const s of ['math', 'science', 'writing', 'study', 'language', 'cs']) expect(subjects.has(s as never)).toBe(true);
  });
  it('includes the required topics', () => {
    const titles = TOPICS.map((t) => t.title.toLowerCase());
    for (const needle of ['algebra', 'linear', 'logarithm', 'trigonometry', 'geometry', 'limits', 'derivatives', 'integrals', 'statistics', 'kinematics', 'momentum', 'stoichiometry', 'periodic', 'genetics', 'essay', 'citations', 'grammar', 'study techniques', 'test-taking', 'si units', 'programming', 'spanish']) {
      expect(titles.some((t) => t.includes(needle)), needle).toBe(true);
    }
  });
});

describe('searchTopics', () => {
  it('returns all topics for an empty query', () => {
    expect(searchTopics('')).toHaveLength(TOPICS.length);
    expect(searchTopics('   ')).toHaveLength(TOPICS.length);
  });
  it('returns Derivatives first for "deriv"', () => {
    const r = searchTopics('deriv');
    expect(r.length).toBeGreaterThan(0);
    expect(r[0].id).toBe('derivatives');
  });
  it('is case-insensitive', () => {
    expect(searchTopics('DERIV').map((t) => t.id)).toEqual(searchTopics('deriv').map((t) => t.id));
    expect(searchTopics('MLA')[0].id).toBe('citations-mla-apa');
  });
  it('matches tags and section content', () => {
    expect(searchTopics('punnett')[0].id).toBe('biology-cell-genetics');
    expect(searchTopics('pomodoro')[0].id).toBe('study-techniques');
    expect(searchTopics('quadratic formula')[0].id).toBe('algebra-essentials');
  });
  it('requires all terms to match', () => {
    expect(searchTopics('xyzzy nothing')).toHaveLength(0);
    const r = searchTopics('gas laws');
    expect(r[0].id).toBe('chemistry-moles-stoichiometry-gases');
  });
  it('does not mutate TOPICS', () => {
    const all = searchTopics('');
    all.pop();
    expect(TOPICS.length).toBeGreaterThanOrEqual(22);
  });
});
