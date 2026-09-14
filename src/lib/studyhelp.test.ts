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

describe('textbook-level depth', () => {
  it('every topic has at least 2 fully worked examples with steps and an answer', () => {
    for (const t of TOPICS) {
      expect(t.examples, t.id).toBeDefined();
      expect(t.examples!.length, t.id).toBeGreaterThanOrEqual(2);
      expect(t.examples!.length, t.id).toBeLessThanOrEqual(4);
      for (const ex of t.examples!) {
        expect(ex.problem.trim().length, t.id).toBeGreaterThan(0);
        expect(ex.steps.length, t.id).toBeGreaterThanOrEqual(2);
        for (const step of ex.steps) expect(step.trim().length, t.id).toBeGreaterThan(0);
        expect(ex.answer.trim().length, t.id).toBeGreaterThan(0);
      }
    }
  });
  it('every topic has 2–3 paragraph-length "deeper" explanations', () => {
    for (const t of TOPICS) {
      expect(t.deeper, t.id).toBeDefined();
      expect(t.deeper!.length, t.id).toBeGreaterThanOrEqual(2);
      expect(t.deeper!.length, t.id).toBeLessThanOrEqual(3);
      for (const d of t.deeper!) {
        expect(d.heading.trim().length, t.id).toBeGreaterThan(0);
        const words = d.text.trim().split(/\s+/).length;
        expect(words, `${t.id}: ${d.heading}`).toBeGreaterThanOrEqual(60);
        expect(words, `${t.id}: ${d.heading}`).toBeLessThanOrEqual(120);
      }
    }
  });
  it('every topic links to at least one OpenStax textbook', () => {
    for (const t of TOPICS) {
      expect(t.textbook, t.id).toBeDefined();
      expect(t.textbook!.length, t.id).toBeGreaterThanOrEqual(1);
      for (const b of t.textbook!) {
        expect(b.title.trim().length, t.id).toBeGreaterThan(0);
        expect(b.url, t.id).toMatch(/^https:\/\/openstax\.org\//);
        expect(b.url, t.id).not.toMatch(/\s/);
      }
    }
  });
  it('worked examples have correct arithmetic (spot checks)', () => {
    const algebra = TOPICS.find((t) => t.id === 'algebra-essentials')!;
    expect(algebra.examples![0].answer).toBe('(2x + 1)(x + 3)');
    expect(algebra.examples![1].answer).toContain('x = 2');
    const stats = TOPICS.find((t) => t.id === 'statistics-probability')!;
    expect(stats.examples![0].answer).toContain('Mean 7');
    const si = TOPICS.find((t) => t.id === 'si-units-conversions')!;
    expect(si.examples![0].answer).toBe('20 m/s');
  });
  it('keeps the quick-reference sections intact and searchable', () => {
    for (const t of TOPICS) expect(t.sections.length).toBeGreaterThanOrEqual(3);
    expect(searchTopics('quadratic formula')[0].id).toBe('algebra-essentials');
  });
});
