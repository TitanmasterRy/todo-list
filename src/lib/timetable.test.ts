import { describe, expect, it } from 'vitest';
import { bellFor, bellProblems, daySlots, emptySchedule, formatHM, isSchoolDay, nextMeeting, rotationDay, whatsNow } from './timetable';
import type { SchoolSchedule } from './types';

// 2026-10-05 is a Monday
function sched(): SchoolSchedule {
  const s = emptySchedule();
  const reg = s.bells[0];
  const early = {
    id: 'early',
    name: 'Early release',
    periods: reg.periods
      .filter((p) => p.name !== 'Lunch')
      .map((p, i) => ({
        ...p,
        id: `e${i}`,
        start: `0${8 + Math.floor(i / 2)}:${i % 2 ? '30' : '00'}`.slice(-5),
        end: `0${8 + Math.floor(i / 2)}:${i % 2 ? '55' : '25'}`.slice(-5),
      })),
  };
  s.bells.push(early);
  s.rotation = ['A', 'B'];
  s.rotationStart = '2026-10-05';
  const p = (name: string) => reg.periods.find((x) => x.name === name)!.id;
  s.classes = [
    { id: 'm1', courseId: 'chem', periodId: p('Period 1'), rotationDays: ['A'], room: '204' },
    { id: 'm2', courseId: 'art', periodId: p('Period 1'), rotationDays: ['B'] },
    { id: 'm3', courseId: 'math', periodId: p('Period 3') },
    { id: 'm4', courseId: 'pe', periodId: p('Period 5'), weekdays: [5] },
  ];
  return s;
}

describe('timetable', () => {
  it('knows school days: weekends, overrides and breaks are off', () => {
    const s = sched();
    s.overrides['2026-10-07'] = { noSchool: true };
    expect(isSchoolDay(s, '2026-10-05')).toBe(true);
    expect(isSchoolDay(s, '2026-10-10')).toBe(false); // Saturday
    expect(isSchoolDay(s, '2026-10-07')).toBe(false);
    expect(isSchoolDay(s, '2026-10-06', [{ id: 'b', from: '2026-10-06', to: '2026-10-06' }])).toBe(false);
  });

  it('alternates A/B over school days, skipping weekends and days off', () => {
    const s = sched();
    s.overrides['2026-10-07'] = { noSchool: true };
    const days = ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10', '2026-10-12'].map((k) => rotationDay(s, k));
    expect(days).toEqual(['A', 'B', undefined, 'A', 'B', undefined, 'A']);
    // counting backwards from the start day
    expect(rotationDay(s, '2026-10-02')).toBe('B'); // the Friday before
  });

  it('a forced day resets the count from there', () => {
    const s = sched();
    s.overrides['2026-10-08'] = { rotation: 'A' }; // would have been B
    expect(rotationDay(s, '2026-10-07')).toBe('A');
    expect(rotationDay(s, '2026-10-08')).toBe('A');
    expect(rotationDay(s, '2026-10-09')).toBe('B');
  });

  it('breaks pause the rotation', () => {
    const s = sched();
    const breaks = [{ id: 'fb', from: '2026-10-06', to: '2026-10-09' }];
    expect(rotationDay(s, '2026-10-12', breaks)).toBe('B');
  });

  it('lists the day with the right classes', () => {
    const s = sched();
    const mon = daySlots(s, '2026-10-05');
    expect(mon[0].meetings.map((m) => m.courseId)).toEqual(['chem']);
    expect(mon.find((x) => x.period.name === 'Period 3')!.meetings.map((m) => m.courseId)).toEqual(['math']);
    expect(mon.find((x) => x.period.name === 'Period 5')!.meetings).toEqual([]);
    const fri = daySlots(s, '2026-10-09');
    expect(fri[0].meetings.map((m) => m.courseId)).toEqual(['chem']); // Mon A, Tue B, Wed A, Thu B, Fri A
    expect(fri.find((x) => x.period.name === 'Period 5')!.meetings.map((m) => m.courseId)).toEqual(['pe']);
    expect(daySlots(s, '2026-10-10')).toEqual([]);
  });

  it('uses another bell by name for one day or every week', () => {
    const s = sched();
    s.overrides['2026-10-06'] = { bellId: 'early' };
    expect(bellFor(s, '2026-10-06')?.name).toBe('Early release');
    const tue = daySlots(s, '2026-10-06');
    expect(tue.find((x) => x.period.name === 'Period 1')!.meetings.map((m) => m.courseId)).toEqual(['art']);
    expect(tue.find((x) => x.period.name === 'Period 1')!.period.start).toBe('08:00');
    s.weekdayBells = { 3: 'early' };
    expect(bellFor(s, '2026-10-07')?.name).toBe('Early release');
    expect(bellFor(s, '2026-10-08')?.name).toBe('Regular');
  });

  it("says what's on now and what's next", () => {
    const s = sched();
    const n = whatsNow(s, new Date(2026, 9, 5, 8, 20));
    expect(n.rotation).toBe('A');
    expect(n.current?.meetings[0].courseId).toBe('chem');
    expect(n.minutesLeft).toBe(30);
    expect(n.next?.period.name).toBe('Period 2');
    expect(n.minutesUntilNext).toBe(35);
    const between = whatsNow(s, new Date(2026, 9, 5, 8, 52));
    expect(between.current).toBeUndefined();
    expect(between.next?.period.name).toBe('Period 2');
    expect(whatsNow(s, new Date(2026, 9, 5, 16, 0)).done).toBe(true);
    expect(whatsNow(s, new Date(2026, 9, 10, 9, 0)).schoolDay).toBe(false);
  });

  it('finds the next class meeting for "due next class"', () => {
    const s = sched();
    expect(nextMeeting(s, 'chem', '2026-10-05')).toEqual({ key: '2026-10-07', start: '08:00' });
    expect(nextMeeting(s, 'art', '2026-10-05')).toEqual({ key: '2026-10-06', start: '08:00' });
    expect(nextMeeting(s, 'pe', '2026-10-05')?.key).toBe('2026-10-09');
    expect(nextMeeting(s, 'nope', '2026-10-05')).toBeUndefined();
  });

  it('checks bell schedules and formats times', () => {
    const b = {
      id: 'x',
      name: 'x',
      periods: [
        { id: '1', name: 'P1', start: '08:00', end: '09:00' },
        { id: '2', name: 'P2', start: '08:30', end: '08:20' },
      ],
    };
    expect(bellProblems(b)).toEqual(['P2 ends before it starts.', 'P1 and P2 overlap.']);
    expect(bellProblems(emptySchedule().bells[0])).toEqual([]);
    expect(formatHM('13:05')).toBe('1:05 pm');
    expect(formatHM('00:10')).toBe('12:10 am');
    expect(formatHM('13:05', '24h')).toBe('13:05');
  });
});

describe('attendance', () => {
  it('totals marks per course and lists recent classes', async () => {
    const { attendanceSummary, recentMeetings } = await import('./timetable');
    const s = sched();
    s.attendance = { '2026-10-05': { m1: 'present', m3: 'late' }, '2026-10-06': { m2: 'absent', m3: 'excused' }, '2026-10-07': { m1: 'absent', gone: 'present' } };
    const sum = attendanceSummary(s);
    const chem = sum.find((r) => r.courseId === 'chem')!;
    expect(chem).toMatchObject({ present: 1, absent: 1, rate: 0.5 });
    expect(sum.find((r) => r.courseId === 'math')).toMatchObject({ late: 1, excused: 1, rate: 1 });
    expect(sum.some((r) => r.courseId === 'gone')).toBe(false);
    const recent = recentMeetings(s, '2026-10-06', 3);
    expect(recent.map((r) => `${r.key}:${r.meeting.courseId}`)).toEqual(['2026-10-06:art', '2026-10-06:math', '2026-10-05:chem', '2026-10-05:math']);
  });
});
