import { describe, expect, it } from 'vitest';
import { parseICS } from './ics-parse';
import { diffAssignments, eventsToAssignments, inferType, isSchoologyFeedUrl, matchCourseName, splitTitle, type ExternalAssignment } from './schoology';

// A Schoology-style personal calendar feed (CRLF line endings, BOM, folded lines, VALARM).
const SCHOOLOGY_FIXTURE =
  '\uFEFF' +
  [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Schoology//Calendar//EN',
    'X-WR-CALNAME:My Schoology Calendar',
    // all-day assignment with "Title (Course)" summary; superseded below by a duplicate UID
    'BEGIN:VEVENT',
    'UID:123456@schoology.com',
    'DTSTART;VALUE=DATE:20260921',
    'DTEND;VALUE=DATE:20260922',
    'SUMMARY:Problem Set 3 (AP Calculus BC)',
    'DESCRIPTION:Complete problems 1-20\\, odd only.',
    'URL:https://app.schoology.com/assignment/123456/info',
    'CATEGORIES:AP Calculus BC',
    'LAST-MODIFIED:20260910T083000Z',
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    'TRIGGER:-P1D',
    'END:VALARM',
    'END:VEVENT',
    // timed assignment with TZID, "Course: Title" summary, HTML description folded mid-tag
    'BEGIN:VEVENT',
    'UID:assignment-234567',
    'DTSTART;TZID=America/New_York:20260923T235900',
    'SUMMARY:US History: Chapter 4 Reading Quiz',
    'DESCRIPTION:<p>Read <b>pages 88&ndash;104</b>\\, then take the quiz.</p><p>Course: US Hist',
    ' ory</p><ul><li>Bring notes &amp; pencil</li><li>No&nbsp;calculators</li></ul>',
    'URL:https://app.schoology.com/assignment/234567/info',
    'STATUS:CONFIRMED',
    'END:VEVENT',
    // UTC timed exam with a long folded summary
    'BEGIN:VEVENT',
    'UID:345678@schoology.com',
    'DTSTART:20261002T130000Z',
    'DTEND:20261002T143000Z',
    'SUMMARY:Unit 2 Exam - Cell Structure and Function and Membrane Transport and E',
    ' nergy Metabolism (Biology Honors)',
    'URL:https://app.schoology.com/assignment/345678/info',
    'END:VEVENT',
    // a calendar event, not an assignment
    'BEGIN:VEVENT',
    'UID:event-456789',
    'DTSTART;VALUE=DATE:20260925',
    'SUMMARY:No School - Teacher Workday',
    'URL:https://app.schoology.com/event/456789',
    'END:VEVENT',
    // project, course only in CATEGORIES, no URL
    'BEGIN:VEVENT',
    'UID:567890@schoology.com',
    'DTSTART;VALUE=DATE:20261015',
    'SUMMARY:Research Paper Final Draft',
    'CATEGORIES:English 11',
    'END:VEVENT',
    // no DTSTART
    'BEGIN:VEVENT',
    'UID:678901@schoology.com',
    'SUMMARY:Undated thing',
    'URL:https://app.schoology.com/assignment/678901/info',
    'END:VEVENT',
    // duplicate UID of the first event: the later one wins
    'BEGIN:VEVENT',
    'UID:123456@schoology.com',
    'DTSTART;VALUE=DATE:20260922',
    'SUMMARY:Problem Set 3 (revised) (AP Calculus BC)',
    'URL:https://app.schoology.com/assignment/123456/info',
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ].join('\r\n');

describe('eventsToAssignments', () => {
  const events = parseICS(SCHOOLOGY_FIXTURE);
  const assignments = eventsToAssignments(events);
  const byId = new Map(assignments.map((a) => [a.externalId, a]));

  it('drops events and undated entries by default, keeps assignments', () => {
    expect(assignments.map((a) => a.externalId).sort()).toEqual(['assignment:123456', 'assignment:234567', 'assignment:345678', 'assignment:567890']);
    expect(assignments.every((a) => a.kind === 'assignment')).toBe(true);
  });

  it('includes events when asked', () => {
    const all = eventsToAssignments(events, { includeEvents: true });
    const ev = all.find((a) => a.externalId === 'event:456789')!;
    expect(ev.kind).toBe('event');
    expect(ev.title).toBe('No School - Teacher Workday');
    const undated = all.find((a) => a.externalId === 'assignment:678901')!;
    expect(undated.kind).toBe('event');
    expect(undated.dueAt).toBeUndefined();
  });

  it('strips a "Title (Course)" suffix and uses the URL id', () => {
    const a = byId.get('assignment:123456')!;
    expect(a.title).toBe('Problem Set 3 (revised)');
    expect(a.courseName).toBe('AP Calculus BC');
    expect(a.dueAt).toBe('2026-09-22');
    expect(a.url).toBe('https://app.schoology.com/assignment/123456/info');
    expect(a.notes).toBe('https://app.schoology.com/assignment/123456/info');
    expect(a.type).toBe('homework');
  });

  it('strips a "Course: Title" prefix, pulls Course: out of the description and appends the URL', () => {
    const a = byId.get('assignment:234567')!;
    expect(a.title).toBe('Chapter 4 Reading Quiz');
    expect(a.courseName).toBe('US History');
    expect(a.type).toBe('quiz');
    expect(a.dueAt).toBe(new Date(2026, 8, 23, 23, 59, 0).toISOString());
    expect(a.notes).toBe('Read pages 88–104, then take the quiz.\n\n- Bring notes & pencil\n- No calculators\n\nhttps://app.schoology.com/assignment/234567/info');
    expect(a.notes).not.toContain('Course:');
  });

  it('infers exam type and keeps timed UTC due dates', () => {
    const a = byId.get('assignment:345678')!;
    expect(a.type).toBe('exam');
    expect(a.courseName).toBe('Biology Honors');
    expect(a.dueAt).toBe('2026-10-02T13:00:00.000Z');
    expect(a.updatedAt).toBeUndefined();
    expect(byId.get('assignment:123456')!.updatedAt).toBeUndefined(); // duplicate replaced the copy with LAST-MODIFIED
  });

  it('falls back to CATEGORIES for the course and has no notes without description/url', () => {
    const a = byId.get('assignment:567890')!;
    expect(a.title).toBe('Research Paper Final Draft');
    expect(a.courseName).toBe('English 11');
    expect(a.type).toBe('project');
    expect(a.notes).toBeUndefined();
    expect(a.url).toBeUndefined();
  });

  it('falls back to the UID when no numeric id is available and clips long notes', () => {
    const [a] = eventsToAssignments([{ uid: 'weird-uid', summary: 'Thing', allDay: true, start: '2026-01-01', description: 'x'.repeat(5000), raw: {} }]);
    expect(a.externalId).toBe('weird-uid');
    expect(a.notes!.length).toBeLessThanOrEqual(2000);
    expect(a.notes!.endsWith('…')).toBe(true);
  });

  it('skips cancelled events', () => {
    expect(eventsToAssignments([{ uid: '1@schoology.com', summary: 'Gone', allDay: true, start: '2026-01-01', status: 'CANCELLED', raw: {} }])).toEqual([]);
  });
});

describe('splitTitle', () => {
  it('does not treat headings, page ranges or times as course names', () => {
    expect(splitTitle('Chapter 3: Photosynthesis')).toEqual({ title: 'Chapter 3: Photosynthesis' });
    expect(splitTitle('Read pages (12-30)')).toEqual({ title: 'Read pages (12-30)' });
    expect(splitTitle('Lab due 3: 00')).toEqual({ title: 'Lab due 3: 00' });
    expect(splitTitle('Spanish II: Vocab list 4')).toEqual({ title: 'Vocab list 4', courseName: 'Spanish II' });
  });
});

describe('inferType', () => {
  it('maps keywords to task types', () => {
    expect(inferType('Pop Quiz on fractions')).toBe('quiz');
    expect(inferType('Unit 3 Test')).toBe('exam');
    expect(inferType('MIDTERM review')).toBe('exam');
    expect(inferType('Final Exam')).toBe('exam');
    expect(inferType('Read Chapter 7')).toBe('reading');
    expect(inferType('Pages 40-55')).toBe('reading');
    expect(inferType('Group Project proposal')).toBe('project');
    expect(inferType('Persuasive Essay')).toBe('project');
    expect(inferType('Oral presentation')).toBe('project');
    expect(inferType('Research paper outline')).toBe('project');
    expect(inferType('Worksheet 12')).toBe('homework');
    expect(inferType('Quizlet practice')).toBe('homework'); // no partial-word match
  });
  it('prefers quiz over exam over reading over project', () => {
    expect(inferType('Reading quiz chapter 2')).toBe('quiz');
    expect(inferType('Test on chapter 2')).toBe('exam');
    expect(inferType('Read about the project')).toBe('reading');
  });
});

describe('matchCourseName', () => {
  const courses = [
    { id: 'c1', name: 'AP Calculus BC' },
    { id: 'c2', name: 'US History' },
    { id: 'c3', name: 'Biology (Honors)' },
    { id: 'c4', name: 'Spanish II' },
    { id: 'c5', name: 'Spanish III' },
  ];
  it('matches exactly ignoring case and punctuation', () => {
    expect(matchCourseName('ap calculus bc', courses)).toBe('c1');
    expect(matchCourseName('U.S. History', courses)).toBe('c2');
    expect(matchCourseName('Biology Honors', courses)).toBe('c3');
  });
  it('falls back to prefix / contains matches when unambiguous', () => {
    expect(matchCourseName('Calculus BC', courses)).toBe('c1');
    expect(matchCourseName('Biology', courses)).toBe('c3');
    expect(matchCourseName('AP Calculus BC - Period 3', courses)).toBe('c1');
    expect(matchCourseName('US History: Mr. Smith', courses)).toBe('c2');
  });
  it('returns undefined when ambiguous or unknown', () => {
    expect(matchCourseName('Spanish', courses)).toBeUndefined();
    expect(matchCourseName('Physics', courses)).toBeUndefined();
    expect(matchCourseName(undefined, courses)).toBeUndefined();
    expect(matchCourseName('   ', courses)).toBeUndefined();
    expect(matchCourseName('Spanish II', courses)).toBe('c4'); // exact beats prefix ambiguity
  });
});

describe('diffAssignments', () => {
  const inc = (over: Partial<ExternalAssignment> & { externalId: string }): ExternalAssignment => ({ title: 'T', kind: 'assignment', ...over });

  it('creates new, skips ignored', () => {
    const d = diffAssignments([], [inc({ externalId: 'assignment:1', dueAt: '2026-09-21' }), inc({ externalId: 'assignment:2' })], ['assignment:2']);
    expect(d.create.map((a) => a.externalId)).toEqual(['assignment:1']);
    expect(d.update).toEqual([]);
    expect(d.unchanged).toBe(0);
  });

  it('updates title and due date when changed on incomplete tasks', () => {
    const d = diffAssignments(
      [{ externalId: 'assignment:1', title: 'Old', dueAt: '2026-09-21', notes: 'my notes' }],
      [inc({ externalId: 'assignment:1', title: 'New', dueAt: '2026-09-22', notes: 'feed notes' })],
      [],
    );
    expect(d.update).toEqual([{ externalId: 'assignment:1', patch: { title: 'New', dueAt: '2026-09-22' } }]);
    expect(d.unchanged).toBe(0);
  });

  it('only fills notes when the existing notes are empty', () => {
    const d = diffAssignments(
      [
        { externalId: 'assignment:1', title: 'T', dueAt: '2026-09-21', notes: '' },
        { externalId: 'assignment:2', title: 'T', dueAt: '2026-09-21', notes: 'user wrote this' },
      ],
      [inc({ externalId: 'assignment:1', dueAt: '2026-09-21', notes: 'from feed' }), inc({ externalId: 'assignment:2', dueAt: '2026-09-21', notes: 'from feed' })],
      [],
    );
    expect(d.update).toEqual([{ externalId: 'assignment:1', patch: { notes: 'from feed' } }]);
    expect(d.unchanged).toBe(1);
  });

  it('counts unchanged and never touches completed tasks', () => {
    const d = diffAssignments(
      [
        { externalId: 'assignment:1', title: 'Same', dueAt: '2026-09-21', notes: 'n' },
        { externalId: 'assignment:2', title: 'Done', dueAt: '2026-09-21', completedAt: '2026-09-10T00:00:00.000Z' },
      ],
      [inc({ externalId: 'assignment:1', title: 'Same', dueAt: '2026-09-21', notes: 'n' }), inc({ externalId: 'assignment:2', title: 'Renamed', dueAt: '2026-10-01', notes: 'x' })],
      [],
    );
    expect(d.create).toEqual([]);
    expect(d.update).toEqual([]);
    expect(d.unchanged).toBe(2);
  });

  it('does not clear a due date when the feed has none, and ignores deleted ids even if they change', () => {
    const d = diffAssignments(
      [{ externalId: 'assignment:1', title: 'T', dueAt: '2026-09-21' }],
      [inc({ externalId: 'assignment:1' }), inc({ externalId: 'assignment:9', title: 'Z' })],
      ['assignment:9'],
    );
    expect(d.update).toEqual([]);
    expect(d.create).toEqual([]);
    expect(d.unchanged).toBe(1);
  });
});

describe('isSchoologyFeedUrl', () => {
  it('accepts Schoology iCal feed URLs', () => {
    expect(isSchoologyFeedUrl('https://app.schoology.com/calendar/feed/ical/1694000000/abcdef0123456789/ical.ics')).toBe(true);
    expect(isSchoologyFeedUrl('  https://myschool.schoology.com/calendar/feed/ical/1/x/ical.ics ')).toBe(true);
    expect(isSchoologyFeedUrl('webcal://app.schoology.com/calendar/feed/ical/1/x/ical.ics')).toBe(true);
    expect(isSchoologyFeedUrl('https://app.schoology.com/some/feed.ics')).toBe(true);
  });
  it('rejects everything else', () => {
    expect(isSchoologyFeedUrl('https://app.schoology.com/assignment/123/info')).toBe(false);
    expect(isSchoologyFeedUrl('https://evil.com/app.schoology.com/calendar/feed/ical/x.ics')).toBe(false);
    expect(isSchoologyFeedUrl('https://notschoology.com/calendar/feed/ical/x.ics')).toBe(false);
    expect(isSchoologyFeedUrl('not a url')).toBe(false);
    expect(isSchoologyFeedUrl('')).toBe(false);
  });
});
