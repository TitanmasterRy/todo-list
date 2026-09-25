import { describe, expect, it } from 'vitest';
import { csvCell, tasksToCSV, tasksToMarkdown } from './exporters';
import { importCSV, parseCSV } from './csvimport';
import type { Course, Task } from './types';

const t = (over: Partial<Task>): Task => ({
  id: 'x',
  title: 'x',
  tags: [],
  priority: 'normal',
  subtasks: [],
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '',
  order: 0,
  deferredCount: 0,
  ...over,
});
const courses: Course[] = [{ id: 'c1', name: 'Biology', color: '#0f0', emoji: '🧬', archived: false }];

describe('CSV', () => {
  it('quotes and neutralizes formulas', () => {
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvCell(undefined)).toBe('');
  });
  it('round-trips through the importer', () => {
    const tasks = [
      t({
        id: 'a',
        title: 'Lab report, part 2',
        courseId: 'c1',
        dueAt: '2026-10-01',
        priority: 'high',
        tags: ['lab'],
        estimateMin: 90,
        subtasks: [{ id: 's', title: 'Graphs', done: true }],
      }),
      t({ id: 'b', title: 'Read ch. 3', completedAt: '2026-09-20T00:00:00.000Z', notes: 'line 1\nline 2' }),
    ];
    const back = importCSV(tasksToCSV(tasks, courses)).tasks;
    expect(back).toHaveLength(2);
    expect(back[0]).toMatchObject({
      title: 'Lab report, part 2',
      course: 'Biology',
      dueAt: '2026-10-01',
      priority: 'high',
      tags: ['lab'],
      estimateMin: 90,
      done: false,
      subtasks: ['Graphs'],
    });
    expect(back[1]).toMatchObject({ done: true, notes: 'line 1\nline 2' });
  });
  it('parses quoted newlines, semicolons and BOMs', () => {
    expect(parseCSV('\uFEFFa;b\n"x;1";"y\nz"\n')).toEqual([
      ['a', 'b'],
      ['x;1', 'y\nz'],
    ]);
  });
  it('reads Todoist exports (priority 1 = highest, indented subtasks)', () => {
    const csv =
      'TYPE,CONTENT,DESCRIPTION,PRIORITY,INDENT,AUTHOR,RESPONSIBLE,DATE,DATE_LANG,TIMEZONE\nsection,Week 1,,,,,,,,\ntask,Essay draft,Outline first,1,1,,,2026-10-02,en,\ntask,Find sources,,4,2,,,,en,\ntask,Math set,,4,1,,,,en,\n';
    const r = importCSV(csv);
    expect(r.tasks.map((x) => x.title)).toEqual(['Essay draft', 'Math set']);
    expect(r.tasks[0]).toMatchObject({ priority: 'urgent', dueAt: '2026-10-02', notes: 'Outline first', subtasks: ['Find sources'] });
    expect(r.tasks[1].priority).toBe('low');
    expect(r.skipped).toBe(1);
  });
  it('accepts a headerless list and US dates', () => {
    expect(importCSV('Buy notebook\nStudy for quiz\n').tasks.map((x) => x.title)).toEqual(['Buy notebook', 'Study for quiz']);
    expect(importCSV('Task,Due Date\nQuiz,9/30/2026\n').tasks[0].dueAt).toBe('2026-09-30');
  });
});

describe('Markdown', () => {
  it('groups by course with checkboxes', () => {
    const md = tasksToMarkdown(
      [t({ id: 'a', title: 'Lab', courseId: 'c1', dueAt: '2026-10-01', subtasks: [{ id: 's', title: 'Graphs', done: true }] }), t({ id: 'b', title: 'Misc', completedAt: 'x' })],
      courses,
    );
    expect(md).toContain('## 🧬 Biology');
    expect(md).toContain('- [ ] Lab (due 2026-10-01)');
    expect(md).toContain('  - [x] Graphs');
    expect(md).toContain('## No course');
    expect(md).toContain('- [x] Misc');
  });
});
