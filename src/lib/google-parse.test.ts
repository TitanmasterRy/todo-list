import { describe, expect, it } from 'vitest';
import { cleanSubject, extractAssignmentsFromMail, type GmailMessage } from './google-parse';

// Monday 2026-09-14, 10:00 local
const now = new Date(2026, 8, 14, 10, 0, 0);
const courses = [
  { id: 'chem', name: 'AP Chemistry' },
  { id: 'alg', name: 'Algebra 2' },
  { id: 'hist', name: 'US History' },
  { id: 'eng', name: 'English' },
];

function msg(p: Partial<GmailMessage> & { id: string }): GmailMessage {
  return {
    threadId: `t_${p.id}`,
    subject: '',
    from: 'someone@example.com',
    date: '2026-09-13T15:00:00.000Z',
    snippet: '',
    url: `https://mail.google.com/mail/u/0/#inbox/t_${p.id}`,
    ...p,
  };
}

const classroom = msg({
  id: 'm1',
  from: 'Ms. Rivera (Classroom) <no-reply@classroom.google.com>',
  subject: 'New assignment: "Lab 3 Report"',
  snippet: 'AP Chemistry · Ms. Rivera posted a new assignment: Lab 3 Report. Due Sep 18, 11:59 PM. Open.',
});
const teacher = msg({
  id: 'm2',
  from: 'Mr. Okafor <okafor@school.org>',
  subject: 'Homework: problem set 4 due Friday',
  snippet: 'Algebra 2 students: please finish problem set 4 (sections 2.1-2.3) and submit it on the portal.',
});
const newsletter = msg({
  id: 'm3',
  from: 'School News <news@school.org>',
  subject: 'Weekly Newsletter: Fall festival this Friday!',
  snippet: 'Join us for food and games on the front lawn. Unsubscribe here.',
});
const essay = msg({
  id: 'm4',
  from: 'Ms. Chen <chen@school.org>',
  subject: 'Re: Essay draft',
  snippet: 'Hi everyone, please send me your essay draft by Friday. Thanks, Ms. Chen (English 10)',
});
const bracket = msg({
  id: 'm5',
  from: 'Mr. Park <park@school.org>',
  subject: 'Fwd: [US History] Reading ch. 5 for Wednesday',
  snippet: 'Pages 110-135. We will discuss in class.',
});
const camera = msg({
  id: 'm6',
  from: 'Photo Club <club@school.org>',
  subject: 'Photos from the field trip',
  snippet: 'We had a great time. The test of the new camera went well, see attached.',
});

describe('cleanSubject', () => {
  it('strips reply/forward prefixes and brackets', () => {
    expect(cleanSubject('Re: Fwd: [Calc II] Quiz 2 Friday')).toEqual({ title: 'Quiz 2 Friday', brackets: ['Calc II'] });
    expect(cleanSubject('FW: hello')).toEqual({ title: 'hello', brackets: [] });
  });
});

describe('extractAssignmentsFromMail', () => {
  it('trusts Google Classroom assignment notifications', () => {
    const [s] = extractAssignmentsFromMail([classroom], courses, now);
    expect(s.title).toBe('Lab 3 Report');
    expect(s.confidence).toBe('high');
    expect(s.courseId).toBe('chem');
    expect(s.messageId).toBe('m1');
    expect(s.url).toBe(classroom.url);
    expect(s.dueAt).toBeDefined();
    const d = new Date(s.dueAt!);
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(8);
    expect(d.getDate()).toBe(18);
    expect(d.getHours()).toBe(23);
    expect(d.getMinutes()).toBe(59);
    expect(s.reason).toMatch(/Classroom/);
  });

  it('extracts "due Friday" from a teacher email and matches the course from the snippet', () => {
    const [s] = extractAssignmentsFromMail([teacher], courses, now);
    expect(s.title).toBe('Problem set 4');
    expect(s.dueAt).toBe('2026-09-18');
    expect(s.courseId).toBe('alg');
    expect(s.confidence).toBe('high');
    expect(s.reason).toMatch(/homework/);
    expect(s.reason).toMatch(/due Friday/);
  });

  it('excludes a newsletter with no assignment words', () => {
    expect(extractAssignmentsFromMail([newsletter], courses, now)).toEqual([]);
  });

  it('handles "by Friday" in the snippet', () => {
    const [s] = extractAssignmentsFromMail([essay], courses, now);
    expect(s.title).toBe('Essay draft');
    expect(s.dueAt).toBe('2026-09-18');
    expect(s.courseId).toBe('eng');
    expect(s.confidence).toBe('high');
  });

  it('matches a course from a [bracket] prefix and finds a loose weekday', () => {
    const [s] = extractAssignmentsFromMail([bracket], courses, now);
    expect(s.courseId).toBe('hist');
    expect(s.dueAt).toBe('2026-09-16');
    expect(s.title).toBe('Reading ch. 5');
    expect(s.confidence).toBe('high');
  });

  it('keeps a keyword-only snippet match as low confidence', () => {
    const [s] = extractAssignmentsFromMail([camera], courses, now);
    expect(s.confidence).toBe('low');
    expect(s.dueAt).toBeUndefined();
    expect(s.title).toBe('Photos from the field trip');
  });

  it('sorts by confidence then due date and dedupes repeated assignments', () => {
    const dup = msg({ ...teacher, id: 'm2b', threadId: 't_x', subject: 'Re: Homework: problem set 4 due Friday', snippet: 'Thanks!' });
    const all = extractAssignmentsFromMail([camera, dup, teacher, classroom, bracket, essay, newsletter], courses, now);
    expect(all.map((s) => s.confidence)).toEqual(['high', 'high', 'high', 'high', 'low']);
    const high = all.filter((s) => s.confidence === 'high').map((s) => s.dueAt!);
    expect([...high].sort()).toEqual(high);
    expect(all.filter((s) => s.title === 'Problem set 4')).toHaveLength(1);
    expect(all.at(-1)?.messageId).toBe('m6');
  });

  it('handles numeric dates and times after "due"', () => {
    const m = msg({ id: 'm7', subject: 'Quiz 2 due 9/22 at 8am', snippet: 'Covers chapters 3 and 4.' });
    const [s] = extractAssignmentsFromMail([m], courses, now);
    expect(s.title).toBe('Quiz 2');
    expect(new Date(s.dueAt!).getDate()).toBe(22);
    expect(new Date(s.dueAt!).getHours()).toBe(8);
  });
});
