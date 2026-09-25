import { describe, expect, it } from 'vitest';
import { canvasAssignments, isCanvasFeedUrl, splitCanvasTitle } from './canvas';
import { parseICS } from './ics-parse';

const FEED = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Instructure//Canvas//EN
BEGIN:VEVENT
UID:event-assignment-5678
DTSTART:20261009T055900Z
SUMMARY:Essay 1 [ENGL 101 - Fall 2026]
URL;VALUE=URI:https://myschool.instructure.com/courses/1234/assignments/5678
DESCRIPTION:Write 3 pages about\\nthe novel.
END:VEVENT
BEGIN:VEVENT
UID:event-assignment-9012
DTSTART;VALUE=DATE:20261014
SUMMARY:Unit 2 Quiz [BIO 110]
URL;VALUE=URI:https://myschool.instructure.com/courses/77/assignments/9012
END:VEVENT
BEGIN:VEVENT
UID:event-calendar-event-333
DTSTART:20261012T150000Z
SUMMARY:Field trip [BIO 110]
END:VEVENT
END:VCALENDAR`;

describe('Canvas calendar feed', () => {
  it('recognizes feed URLs', () => {
    expect(isCanvasFeedUrl('https://myschool.instructure.com/feeds/calendars/user_AbC123.ics')).toBe(true);
    expect(isCanvasFeedUrl('webcal://canvas.myschool.edu/feeds/calendars/user_AbC123.ics')).toBe(true);
    expect(isCanvasFeedUrl('https://myschool.instructure.com/courses/1')).toBe(false);
    expect(isCanvasFeedUrl('not a url')).toBe(false);
  });
  it('splits course names in brackets', () => {
    expect(splitCanvasTitle('Essay 1 [ENGL 101 - Fall 2026]')).toEqual({ title: 'Essay 1', courseName: 'ENGL 101 - Fall 2026' });
    expect(splitCanvasTitle('Read pages [12-20] tonight')).toEqual({ title: 'Read pages [12-20] tonight' });
  });
  it('turns the feed into assignments with stable ids', () => {
    const a = canvasAssignments(parseICS(FEED));
    expect(a.map((x) => [x.externalId, x.title, x.courseName, x.type])).toEqual([
      ['canvas:assignment:5678', 'Essay 1', 'ENGL 101 - Fall 2026', 'project'],
      ['canvas:assignment:9012', 'Unit 2 Quiz', 'BIO 110', 'quiz'],
    ]);
    expect(a[0].notes).toContain('the novel');
    expect(a[0].notes).toContain('https://myschool.instructure.com/courses/1234/assignments/5678');
    expect(a[1].dueAt).toBe('2026-10-14');
    expect(canvasAssignments(parseICS(FEED), { includeEvents: true }).map((x) => x.externalId)).toContain('canvas:event:333');
  });
});
