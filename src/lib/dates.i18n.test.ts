import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { dayName, formatDayHeading, formatDue, formatMinutes, formatMonthDay, formatTime, formatWeekdayDate, monthName, relativeDays } from './dates';
import { setLocale } from './i18n/index.svelte';
import { describeRecurrence } from './recurrence';

// Monday 2026-09-14, 10:00 local
const now = new Date(2026, 8, 14, 10, 0, 0);
const at = (d: number, h: number, m = 0) => new Date(2026, 8, d, h, m).toISOString();
// Intl puts no-break spaces in "8 p. m."
const plain = (s: string) => s.replace(/\s/g, ' ');

describe('date formatting in English (unchanged)', () => {
  it('formats due labels', () => {
    expect(formatDue('2026-09-14', now)).toBe('Today');
    expect(formatDue(at(15, 20), now)).toBe('Tomorrow 8pm');
    expect(formatDue(at(15, 20, 30), now, '24h')).toBe('Tomorrow 20:30');
    expect(formatDue('2026-09-13', now)).toBe('Yesterday');
    expect(formatDue('2026-09-11', now)).toBe('3 days ago');
    expect(formatDue('2026-09-17', now)).toBe('Thu');
    expect(formatDue('2026-10-05', now)).toBe('Oct 5');
    expect(formatDue('2027-01-05', now)).toBe('Jan 5 2027');
  });

  it('formats headings, names and durations', () => {
    expect(formatDayHeading('2026-09-14', now)).toBe('Today · Mon, Sep 14');
    expect(formatDayHeading('2026-09-17', now)).toBe('Thursday · Sep 17');
    expect(formatWeekdayDate(new Date(2026, 9, 5))).toBe('Monday, Oct 5');
    expect(formatMonthDay(new Date(2026, 9, 5), now)).toBe('Oct 5');
    expect(dayName(1)).toBe('Mon');
    expect(dayName(0, 'long')).toBe('Sunday');
    expect(monthName(8)).toBe('Sep');
    expect(formatTime(new Date(2026, 0, 1, 17, 5))).toBe('5:05pm');
    expect(formatMinutes(90)).toBe('1h 30m');
    expect(formatMinutes(45)).toBe('45m');
    expect(describeRecurrence({ kind: 'weekly', days: [1, 3] })).toBe('Every Mon, Wed');
  });
});

describe('date formatting in Spanish (Intl)', () => {
  beforeEach(async () => {
    await setLocale('es', { languages: ['es-ES'] });
  });
  afterEach(async () => {
    await setLocale('en');
  });

  it('formats due labels', () => {
    expect(formatDue('2026-09-14', now)).toBe('Hoy');
    expect(plain(formatDue(at(15, 20), now))).toBe('Mañana 8 p. m.');
    expect(formatDue(at(15, 20, 30), now, '24h')).toBe('Mañana 20:30');
    expect(formatDue('2026-09-13', now)).toBe('Ayer');
    expect(formatDue('2026-09-11', now)).toBe('hace 3 días');
    expect(formatDue('2026-09-17', now)).toBe('jue');
    expect(formatDue('2026-10-05', now)).toBe('5 oct');
    expect(formatDue('2027-01-05', now)).toBe('5 ene 2027');
  });

  it('formats headings, names and durations', () => {
    expect(formatDayHeading('2026-09-14', now)).toBe('Hoy · lun, 14 sept');
    expect(formatDayHeading('2026-09-17', now)).toBe('jueves · 17 sept');
    expect(formatWeekdayDate(new Date(2026, 9, 5))).toBe('lunes, 5 oct');
    expect(dayName(3)).toBe('mié');
    expect(dayName(6, 'long')).toBe('sábado');
    expect(monthName(0, 'long')).toBe('enero');
    expect(relativeDays(-2)).toBe('anteayer');
    expect(relativeDays(-5)).toBe('hace 5 días');
    expect(formatTime(new Date(2026, 0, 1, 17, 0), '24h')).toBe('17:00');
    expect(plain(formatTime(new Date(2026, 0, 1, 17, 30)))).toBe('5:30 p. m.');
    expect(formatMinutes(90)).toBe('1 h 30 min');
    expect(formatMinutes(45)).toBe('45 min');
    expect(describeRecurrence({ kind: 'weekly', days: [1, 3] })).toBe('Cada lun, mié');
    expect(describeRecurrence({ kind: 'monthlyNth', nth: 1, weekday: 5 })).toBe('El primer viernes de cada mes');
  });

  it('keeps the browser region', async () => {
    await setLocale('es', { languages: ['es-MX'] });
    expect(formatDue('2026-10-05', now)).toMatch(/^5 oct/);
  });
});
