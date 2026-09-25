import { describe, expect, it } from 'vitest';
import {
  buildClassICS,
  buildClassList,
  classExternalId,
  classLink,
  classSourceUrl,
  classToAssignments,
  diffClass,
  gistRawUrl,
  parseClassList,
  serializeClassList,
  type ClassList,
} from './classlist';
import type { Course, Task } from './types';

const course: Course = { id: 'c1', name: 'AP Biology', color: '#10b981', emoji: '🧬', archived: false };
const task = (o: Partial<Task>): Task => ({
  id: 't_' + (o.title ?? 'x').replace(/\W/g, ''),
  title: 'x',
  tags: [],
  priority: 'normal',
  subtasks: [],
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
  order: 0,
  deferredCount: 0,
  courseId: 'c1',
  ...o,
});

describe('building a class list', () => {
  const tasks: Task[] = [
    task({
      title: 'Lab report',
      dueAt: '2026-10-02',
      type: 'project',
      notes: 'Use the template',
      url: 'https://school.example/lab',
      score: 93,
      completedAt: '2026-09-20T00:00:00Z',
    }),
    task({ title: 'Cell quiz', dueAt: '2026-09-28T13:00:00.000Z', type: 'quiz', weight: 10, timeSpentMin: 40 }),
    task({ title: 'Old worksheet', dueAt: '2026-09-01' }),
    task({ title: 'Read ch. 4' }),
    task({ title: 'Other class', courseId: 'c2', dueAt: '2026-10-01' }),
    task({ title: 'Archived', archived: true }),
    task({ title: 'Study session', parentId: 't_Cellquiz' }),
    task({ title: 'Bad link', url: 'javascript:alert(1)' }),
  ];

  it('publishes only title, due, type, notes and link for that course', () => {
    const list = buildClassList(course, tasks, { id: 'list1', teacher: 'Ms. Rivera', includeNotes: true, now: new Date('2026-09-25T12:00:00Z') });
    expect(list).toMatchObject({ hwtodoClass: 1, id: 'list1', course: 'AP Biology', color: '#10b981', emoji: '🧬', teacher: 'Ms. Rivera', updatedAt: '2026-09-25T12:00:00.000Z' });
    expect(list.items.map((i) => i.title)).toEqual(['Old worksheet', 'Cell quiz', 'Lab report', 'Read ch. 4', 'Bad link']);
    const json = serializeClassList(list);
    for (const secret of ['93', 'score', 'weight', 'completed', 'timeSpent', 'priority', 'javascript']) expect(json).not.toContain(secret);
    expect(list.items[2]).toEqual({ id: 't_Labreport', title: 'Lab report', due: '2026-10-02', type: 'project', notes: 'Use the template', url: 'https://school.example/lab' });
  });

  it('can leave out notes and past items', () => {
    const list = buildClassList(course, tasks, { id: 'list1', includeNotes: false, fromDay: '2026-09-25' });
    expect(list.items.map((i) => i.title)).toEqual(['Cell quiz', 'Lab report', 'Read ch. 4', 'Bad link']);
    expect(list.items.some((i) => i.notes)).toBe(false);
    expect(list.teacher).toBeUndefined();
  });

  it('round-trips through the JSON file', () => {
    const list = buildClassList(course, tasks, { id: 'list1', includeNotes: true });
    expect(parseClassList(serializeClassList(list))).toEqual({ list, skipped: 0 });
  });
});

describe('parsing untrusted class lists', () => {
  const base = {
    hwtodoClass: 1,
    id: 'abc123',
    course: 'Chem',
    updatedAt: '2026-09-20T10:00:00Z',
    items: [{ id: 'a1', title: 'Moles worksheet', due: '2026-09-30', type: 'homework' }],
  };
  const parse = (o: unknown) => parseClassList(JSON.stringify(o));

  it('accepts a minimal list', () => {
    expect(parse(base).list).toEqual({ ...base, updatedAt: '2026-09-20T10:00:00.000Z' });
  });

  it('throws on files that are not class lists', () => {
    expect(() => parseClassList('')).toThrow(/empty/);
    expect(() => parseClassList('<!doctype html><p>hi')).toThrow(/web page/);
    expect(() => parseClassList('{nope')).toThrow(/not JSON/);
    expect(() => parse([1])).toThrow(/not a class list/);
    expect(() => parse({ ...base, hwtodoClass: 2 })).toThrow(/newer version/);
    expect(() => parse({ ...base, id: '../x' })).toThrow(/id/);
    expect(() => parse({ ...base, course: '' })).toThrow(/course/);
    expect(() => parse({ ...base, items: 'x' })).toThrow(/assignments/);
    expect(() => parse({ ...base, items: Array.from({ length: 501 }, (_, i) => ({ id: `i${i}`, title: 't' })) })).toThrow(/more than 500/);
    expect(() => parseClassList(' '.repeat(600 * 1024) + '{}')).toThrow(/too big/);
  });

  it('skips bad items and cleans the fields', () => {
    const { list, skipped } = parse({
      ...base,
      color: 'red; background:url(x)',
      emoji: '🧪',
      teacher: 'Mr. <b>White</b>\u0000',
      items: [
        { id: 'a1', title: '  Titration lab‮ ', due: '2026-02-30', type: 'boss', notes: 'Line 1\r\nLine 2\u0007', url: 'javascript:alert(1)' },
        { id: 'a1', title: 'duplicate id' },
        { id: 'a2', title: '' },
        { id: 'a 3', title: 'bad id' },
        'not an object',
        { id: 'a4', title: 'x'.repeat(300), due: '2026-10-01T09:00:00-04:00', type: 'exam', notes: 'n'.repeat(6000), url: 'https://ok.example/a?b=1' },
        { id: 'a5', title: 'Final exam', due: 1234 },
      ],
    });
    expect(skipped).toBe(4);
    expect(list.color).toBeUndefined();
    expect(list.teacher).toBe('Mr. <b>White</b>'); // text only: the app never renders it as HTML
    const [a1, a4, a5] = list.items;
    expect(a1).toEqual({ id: 'a1', title: 'Titration lab', type: 'homework', notes: 'Line 1\nLine 2' }); // bad date, type and link dropped
    expect(a4.title).toHaveLength(200);
    expect(a4.notes).toHaveLength(5000);
    expect(a4.due).toBe('2026-10-01T13:00:00.000Z');
    expect(a4.url).toBe('https://ok.example/a?b=1');
    expect(a5).toEqual({ id: 'a5', title: 'Final exam', type: 'exam' });
  });
});

describe('subscribing', () => {
  const list: ClassList = {
    hwtodoClass: 1,
    id: 'L1',
    course: 'Chem',
    updatedAt: '2026-09-20T10:00:00.000Z',
    items: [
      { id: 'a1', title: 'Worksheet', due: '2026-09-30', type: 'homework', url: 'https://x.example/a1' },
      { id: 'a2', title: 'Unit test', due: '2026-10-05', type: 'exam', notes: 'Bring a calculator' },
    ],
  };

  it('turns items into namespaced external assignments with the link in the notes', () => {
    const a = classToAssignments(list);
    expect(a[0]).toEqual({
      externalId: 'class:L1:a1',
      title: 'Worksheet',
      courseName: 'Chem',
      kind: 'assignment',
      type: 'homework',
      dueAt: '2026-09-30',
      notes: 'https://x.example/a1',
      url: 'https://x.example/a1',
    });
    expect(a[1].notes).toBe('Bring a calculator');
  });

  it('diffs against existing tasks: new, changed, removed; other lists and done tasks untouched', () => {
    const existing = [
      { externalId: classExternalId('L1', 'a1'), title: 'Worksheet', dueAt: '2026-09-29', notes: 'my own notes' },
      { externalId: classExternalId('L1', 'gone'), title: 'Cancelled lab' },
      { externalId: classExternalId('L1', 'done'), title: 'Finished', completedAt: '2026-09-01' },
      { externalId: classExternalId('L2', 'a2'), title: 'Other list' },
      { externalId: 'assignment:123', title: 'Schoology' },
    ];
    const { diff, removed } = diffClass(existing, list, []);
    expect(diff.create.map((a) => a.externalId)).toEqual(['class:L1:a2']);
    expect(diff.update).toEqual([{ externalId: 'class:L1:a1', patch: { dueAt: '2026-09-30' } }]);
    expect(removed).toEqual(['class:L1:gone']);
    // deleted by the student: not recreated
    expect(diffClass([], list, ['class:L1:a2']).diff.create.map((a) => a.externalId)).toEqual(['class:L1:a1']);
  });

  it('finds the file to fetch from what a student pastes', () => {
    const raw = 'https://gist.githubusercontent.com/msrivera/0123456789abcdef0123/raw/homework-todo-class.json';
    expect(classSourceUrl(raw)).toBe(raw);
    expect(classSourceUrl(classLink(raw, 'https://app.example/#x'))).toBe(raw);
    expect(classSourceUrl('https://gist.github.com/msrivera/0123456789abcdef0123')).toBe(raw);
    expect(gistRawUrl('msrivera', '0123456789abcdef0123', 'homework-todo-class.json')).toBe(raw);
    expect(classSourceUrl('http://localhost:5173/class.json')).toBe('http://localhost:5173/class.json');
    expect(classSourceUrl('http://example.com/class.json')).toBeNull();
    expect(classSourceUrl('javascript:alert(1)')).toBeNull();
    expect(classSourceUrl('https://user:pw@example.com/x')).toBeNull();
    expect(classSourceUrl('not a url')).toBeNull();
  });
});

describe('class calendar (.ics)', () => {
  it('has one event per dated item with escaped text', () => {
    const list: ClassList = {
      hwtodoClass: 1,
      id: 'L1',
      course: 'Chem, period 2',
      updatedAt: '2026-09-20T10:00:00.000Z',
      items: [
        { id: 'a1', title: 'Worksheet; part 1', due: '2026-09-30', type: 'homework', url: 'https://x.example/a1' },
        { id: 'a2', title: 'Unit test', due: '2026-10-05T13:00:00.000Z', type: 'exam', notes: 'Bring:\na calculator' },
        { id: 'a3', title: 'Someday reading' },
      ],
    };
    const ics = buildClassICS(list, new Date('2026-09-25T00:00:00Z'));
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2);
    expect(ics).toContain('X-WR-CALNAME:Chem\\, period 2');
    expect(ics).toContain('UID:a1.L1@homework-todo-class');
    expect(ics).toContain('DTSTART;VALUE=DATE:20260930\r\nDTEND;VALUE=DATE:20261001');
    expect(ics).toContain('DTSTART:20261005T130000Z\r\nDTEND:20261005T133000Z');
    expect(ics).toContain('SUMMARY:[Chem\\, period 2] Worksheet\\; part 1');
    expect(ics).toContain('DESCRIPTION:Type: exam\\nBring:\\na calculator');
    expect(ics).toContain('URL:https://x.example/a1');
    expect(ics.split('\r\n').every((l) => new TextEncoder().encode(l).length <= 75)).toBe(true);
  });
});
