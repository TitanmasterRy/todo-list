import { describe, expect, it } from 'vitest';
import { decodeEntities, htmlToText, parseICS, parseICSDate, unfoldLines } from './ics-parse';

const CRLF = '\r\n';

const SCHOOLOGY_FIXTURE =
  '\uFEFF' +
  [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Schoology//Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:My Schoology Calendar',
    'X-WR-TIMEZONE:America/New_York',
    // 1. all-day assignment, course in parentheses, categories, alarm to skip
    'BEGIN:VEVENT',
    'UID:123456@schoology.com',
    'DTSTAMP:20260901T120000Z',
    'DTSTART;VALUE=DATE:20260921',
    'DTEND;VALUE=DATE:20260922',
    'SUMMARY:Problem Set 3 (AP Calculus BC)',
    'DESCRIPTION:Complete problems 1-20\\, odd only.\\nShow all work.',
    'URL:https://app.schoology.com/assignment/123456/info',
    'CATEGORIES:AP Calculus BC',
    'LAST-MODIFIED:20260910T083000Z',
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    'TRIGGER:-P1D',
    'DESCRIPTION:Reminder',
    'END:VALARM',
    'END:VEVENT',
    // 2. timed assignment with TZID, "Course: Title" summary, HTML description with entities & escaped commas
    'BEGIN:VEVENT',
    'UID:assignment-234567',
    'DTSTART;TZID=America/New_York:20260923T235900',
    'DTEND;TZID=America/New_York:20260923T235900',
    'SUMMARY:US History: Chapter 4 Reading Quiz',
    'DESCRIPTION:<p>Read <b>pages 88&ndash;104</b>\\, then take the quiz.</p><p>Course: US Hist',
    ' ory</p><ul><li>Bring notes &amp; pencil</li><li>No&nbsp;calculators</li></ul>',
    'URL:https://app.schoology.com/assignment/234567/info',
    'STATUS:CONFIRMED',
    'END:VEVENT',
    // 3. UTC timed exam, long folded summary
    'BEGIN:VEVENT',
    'UID:345678@schoology.com',
    'DTSTART:20261002T130000Z',
    'DTEND:20261002T143000Z',
    'SUMMARY:Unit 2 Exam - Cell Structure and Function and Membrane Transport and E',
    ' nergy Metabolism (Biology Honors)',
    'URL:https://app.schoology.com/assignment/345678/info',
    'END:VEVENT',
    // 4. a calendar event (not an assignment)
    'BEGIN:VEVENT',
    'UID:event-456789',
    'DTSTART;VALUE=DATE:20260925',
    'DTEND;VALUE=DATE:20260926',
    'SUMMARY:No School - Teacher Workday',
    'URL:https://app.schoology.com/event/456789',
    'X-SCHOOLOGY-TYPE:event',
    'END:VEVENT',
    // 5. project, course only in CATEGORIES, no URL
    'BEGIN:VEVENT',
    'UID:567890@schoology.com',
    'DTSTART;VALUE=DATE:20261015',
    'SUMMARY:Research Paper Final Draft',
    'CATEGORIES:English 11',
    'END:VEVENT',
    // 6. no DTSTART at all
    'BEGIN:VEVENT',
    'UID:678901@schoology.com',
    'SUMMARY:Undated thing',
    'URL:https://app.schoology.com/assignment/678901/info',
    'END:VEVENT',
    // 7. duplicate of #1 (should win)
    'BEGIN:VEVENT',
    'UID:123456@schoology.com',
    'DTSTART;VALUE=DATE:20260922',
    'SUMMARY:Problem Set 3 (revised) (AP Calculus BC)',
    'URL:https://app.schoology.com/assignment/123456/info',
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ].join(CRLF);

describe('unfoldLines', () => {
  it('joins folded continuation lines and strips the BOM', () => {
    const lines = unfoldLines('\uFEFFBEGIN:VCALENDAR\r\nSUMMARY:abc\r\n def\r\n\tghi\r\nEND:VCALENDAR\r\n');
    expect(lines).toEqual(['BEGIN:VCALENDAR', 'SUMMARY:abcdefghi', 'END:VCALENDAR']);
  });
  it('tolerates LF-only and CR-only files', () => {
    expect(unfoldLines('A:1\nB:2\n 3\n')).toEqual(['A:1', 'B:23']);
    expect(unfoldLines('A:1\rB:2')).toEqual(['A:1', 'B:2']);
  });
});

describe('parseICSDate', () => {
  it('handles DATE, UTC and floating values', () => {
    expect(parseICSDate('20260921', { VALUE: 'DATE' })).toEqual({ value: '2026-09-21', allDay: true });
    expect(parseICSDate('20260921')).toEqual({ value: '2026-09-21', allDay: true });
    expect(parseICSDate('20260921T140000Z')).toEqual({ value: '2026-09-21T14:00:00.000Z', allDay: false });
    const local = new Date(2026, 8, 21, 14, 0, 0).toISOString();
    expect(parseICSDate('20260921T140000', { TZID: 'America/New_York' })).toEqual({ value: local, allDay: false });
    expect(parseICSDate('20260921T1400')).toEqual({ value: local, allDay: false });
    expect(parseICSDate('garbage')).toBeUndefined();
  });
});

describe('htmlToText / decodeEntities', () => {
  it('decodes named, decimal and hex entities', () => {
    expect(decodeEntities('a &amp; b &lt;c&gt; &#39;x&#x27; &nbsp;y &unknown;')).toBe("a & b <c> 'x'  y &unknown;");
  });
  it('turns block tags into newlines and drops the rest', () => {
    expect(htmlToText('<p>Hello <b>world</b></p><ul><li>one</li><li>two</li></ul>')).toBe('Hello world\n\n- one\n- two\n');
    expect(htmlToText('a<br>b<br/>c<div>d</div>')).toBe('a\nb\ncd\n');
    expect(htmlToText('plain &amp; simple')).toBe('plain & simple');
  });
});

describe('parseICS', () => {
  const events = parseICS(SCHOOLOGY_FIXTURE);
  const byUid = new Map(events.map((e) => [e.uid, e]));

  it('parses every VEVENT once, keeping the last duplicate UID', () => {
    expect(events).toHaveLength(6);
    const dup = byUid.get('123456@schoology.com')!;
    expect(dup.summary).toBe('Problem Set 3 (revised) (AP Calculus BC)');
    expect(dup.start).toBe('2026-09-22');
    // the earlier copy's VALARM never leaked into the event
    expect(dup.raw.TRIGGER).toBeUndefined();
    expect(dup.raw.ACTION).toBeUndefined();
  });

  it('parses all-day VALUE=DATE and skips nested VALARM', () => {
    const all = parseICS(SCHOOLOGY_FIXTURE.replace(/BEGIN:VEVENT\r\nUID:123456@schoology.com\r\nDTSTART;VALUE=DATE:20260922[\s\S]*?END:VEVENT\r\n/, ''));
    const ev = all.find((e) => e.uid === '123456@schoology.com')!;
    expect(ev.allDay).toBe(true);
    expect(ev.start).toBe('2026-09-21');
    expect(ev.end).toBe('2026-09-22');
    expect(ev.description).toBe('Complete problems 1-20, odd only.\nShow all work.');
    expect(ev.raw.ACTION).toBeUndefined();
    expect(ev.raw.TRIGGER).toBeUndefined();
    expect(ev.categories).toEqual(['AP Calculus BC']);
    expect(ev.lastModified).toBe('2026-09-10T08:30:00.000Z');
    expect(ev.url).toBe('https://app.schoology.com/assignment/123456/info');
  });

  it('treats TZID times as local and cleans HTML descriptions (folded mid-tag)', () => {
    const ev = byUid.get('assignment-234567')!;
    expect(ev.allDay).toBe(false);
    expect(ev.start).toBe(new Date(2026, 8, 23, 23, 59, 0).toISOString());
    expect(ev.description).toBe('Read pages 88–104, then take the quiz.\n\nCourse: US History\n\n- Bring notes & pencil\n- No calculators');
    expect(ev.status).toBe('CONFIRMED');
    expect(ev.raw.DESCRIPTION.startsWith('<p>Read')).toBe(true);
  });

  it('parses UTC times and folded summaries', () => {
    const ev = byUid.get('345678@schoology.com')!;
    expect(ev.start).toBe('2026-10-02T13:00:00.000Z');
    expect(ev.end).toBe('2026-10-02T14:30:00.000Z');
    expect(ev.summary).toBe('Unit 2 Exam - Cell Structure and Function and Membrane Transport and Energy Metabolism (Biology Honors)');
  });

  it('keeps X- properties in raw and events without DTSTART', () => {
    expect(byUid.get('event-456789')!.raw['X-SCHOOLOGY-TYPE']).toBe('event');
    const undated = byUid.get('678901@schoology.com')!;
    expect(undated.start).toBeUndefined();
    expect(undated.allDay).toBe(false);
  });

  it('handles quoted parameters and empty input', () => {
    const ev = parseICS('BEGIN:VCALENDAR\nBEGIN:VEVENT\nUID:q\nDTSTART;TZID="Europe/Paris":20260101T090000\nSUMMARY:Q\nEND:VEVENT\nEND:VCALENDAR');
    expect(ev[0].start).toBe(new Date(2026, 0, 1, 9, 0, 0).toISOString());
    expect(parseICS('')).toEqual([]);
    expect(parseICS('BEGIN:VCALENDAR\nEND:VCALENDAR')).toEqual([]);
  });
});
