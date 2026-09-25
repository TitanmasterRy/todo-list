import { describe, expect, it } from 'vitest';
import { examSessions, MILESTONE_TEMPLATES, planMilestones, spreadDates, templateForType } from './plan';

describe('spreadDates', () => {
  it('spreads steps in proportion to weight, ending the day before it is due', () => {
    expect(spreadDates('2026-10-01', '2026-10-11', [1, 1, 1, 1, 1])).toEqual(['2026-10-02', '2026-10-04', '2026-10-06', '2026-10-08', '2026-10-10']);
  });
  it('gives heavier steps more days before them', () => {
    const d = spreadDates('2026-10-01', '2026-10-11', [3, 1]);
    expect(d).toEqual(['2026-10-08', '2026-10-10']);
  });
  it('never goes backwards and handles more steps than days', () => {
    const d = spreadDates('2026-10-01', '2026-10-03', [1, 1, 1, 1, 1]);
    expect(d).toEqual([...d].sort());
    expect(d.every((x) => x >= '2026-10-01' && x <= '2026-10-02')).toBe(true);
  });
  it('puts everything on the due day when it is due today, and on today when overdue', () => {
    expect(spreadDates('2026-10-05', '2026-10-05', [1, 2])).toEqual(['2026-10-05', '2026-10-05']);
    expect(spreadDates('2026-10-05', '2026-10-01', [1])).toEqual(['2026-10-05']);
  });
  it('treats all-zero weights as equal', () => {
    expect(spreadDates('2026-10-01', '2026-10-05', [0, 0])).toEqual(['2026-10-02', '2026-10-04']);
  });
});

describe('planMilestones', () => {
  it('drops empty steps and trims titles', () => {
    const p = planMilestones(
      [
        { title: ' Outline ', weight: 1 },
        { title: '  ', weight: 5 },
        { title: 'Draft', weight: 1, estimateMin: 60 },
      ],
      '2026-10-01',
      '2026-10-05',
    );
    expect(p.map((x) => x.title)).toEqual(['Outline', 'Draft']);
    expect(p[1].estimateMin).toBe(60);
    expect(p[1].dateKey).toBe('2026-10-04');
  });
  it('picks a template by task type', () => {
    expect(templateForType('reading').id).toBe('reading');
    expect(templateForType('homework').id).toBe('essay');
    expect(templateForType(undefined).id).toBe('project');
    expect(MILESTONE_TEMPLATES.every((t) => t.steps.length >= 3)).toBe(true);
  });
});

describe('examSessions', () => {
  it('spaces sessions out before the exam', () => {
    expect(examSessions('2026-10-01', '2026-10-15')).toEqual(['2026-10-05', '2026-10-08', '2026-10-11', '2026-10-13', '2026-10-14']);
  });
  it('drops sessions that would be in the past', () => {
    expect(examSessions('2026-10-12', '2026-10-15')).toEqual(['2026-10-13', '2026-10-14']);
  });
  it('studies today when the exam is today or tomorrow is the only option', () => {
    expect(examSessions('2026-10-15', '2026-10-15')).toEqual(['2026-10-15']);
    expect(examSessions('2026-10-14', '2026-10-15')).toEqual(['2026-10-14']);
  });
  it('plans nothing for a past exam', () => {
    expect(examSessions('2026-10-16', '2026-10-15')).toEqual([]);
  });
});
