import { describe, expect, it } from 'vitest';
import { parseQuickAdd } from './parser';

// Monday 2026-09-14, 10:00 local
const now = new Date(2026, 8, 14, 10, 0, 0);
const courses = [
  { id: 'c1', name: 'Química' },
  { id: 'c2', name: 'Historia' },
];
const es = (s: string) => parseQuickAdd(s, { now, courses, locale: 'es' });
const hm = (iso: string | undefined) => {
  const d = new Date(iso!);
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
};

describe('parseQuickAdd in Spanish', () => {
  it('parses the e2e example', () => {
    const p = es('Leer capítulo 3 mañana a las 5 !alta');
    expect(p.title).toBe('Leer capítulo 3');
    expect(p.dueKey).toBe('2026-09-15');
    expect(p.hasTime).toBe(true);
    expect(hm(p.dueAt)).toBe('17:00');
    expect(p.priority).toBe('high');
  });

  it('parses relative days', () => {
    expect(es('x hoy').dueKey).toBe('2026-09-14');
    expect(es('x mañana').dueKey).toBe('2026-09-15');
    expect(es('x manana').dueKey).toBe('2026-09-15');
    expect(es('x pasado mañana').dueKey).toBe('2026-09-16');
    expect(es('x ayer').dueKey).toBe('2026-09-13');
    expect(es('Tarea de mate para mañana').title).toBe('Tarea de mate');
    expect(es('x esta noche').dueKey).toBe('2026-09-14');
  });

  it('parses weekdays and abbreviations', () => {
    expect(es('x lunes').dueKey).toBe('2026-09-14'); // today is Monday
    expect(es('x martes').dueKey).toBe('2026-09-15');
    expect(es('x miércoles').dueKey).toBe('2026-09-16');
    expect(es('x miercoles').dueKey).toBe('2026-09-16');
    expect(es('x jueves').dueKey).toBe('2026-09-17');
    expect(es('x el viernes').dueKey).toBe('2026-09-18');
    expect(es('x sábado').dueKey).toBe('2026-09-19');
    expect(es('x domingo').dueKey).toBe('2026-09-20');
    for (const [w, key] of [
      ['lun', '2026-09-14'],
      ['mar', '2026-09-15'],
      ['mié', '2026-09-16'],
      ['mie', '2026-09-16'],
      ['jue', '2026-09-17'],
      ['vie', '2026-09-18'],
      ['sáb', '2026-09-19'],
      ['sab', '2026-09-19'],
      ['dom', '2026-09-20'],
    ]) {
      expect(es(`x ${w}`).dueKey, w).toBe(key);
      expect(es(`x ${w}`).title).toBe('x');
    }
    expect(es('Ensayo para el viernes').title).toBe('Ensayo');
  });

  it('parses next week and "el próximo viernes"', () => {
    expect(es('x la próxima semana').dueKey).toBe('2026-09-21');
    expect(es('x la semana que viene').dueKey).toBe('2026-09-21');
    expect(es('x proxima semana').dueKey).toBe('2026-09-21');
    expect(es('x el próximo viernes').dueKey).toBe('2026-09-18');
    expect(es('x el viernes que viene').dueKey).toBe('2026-09-18');
    expect(es('x el próximo lunes').dueKey).toBe('2026-09-21'); // never today
    expect(es('x el viernes de la semana que viene').dueKey).toBe('2026-09-25');
  });

  it('parses "en N días" and "dentro de N semanas"', () => {
    expect(es('x en 3 días').dueKey).toBe('2026-09-17');
    expect(es('x en 3 dias').dueKey).toBe('2026-09-17');
    expect(es('x dentro de 2 semanas').dueKey).toBe('2026-09-28');
    expect(es('x en una semana').dueKey).toBe('2026-09-21');
    expect(es('x en dos días').dueKey).toBe('2026-09-16');
  });

  it('parses month names and day/month numbers', () => {
    expect(es('x 15 de octubre').dueKey).toBe('2026-10-15');
    expect(es('x el 15 de octubre').title).toBe('x');
    expect(es('x 1 de enero').dueKey).toBe('2027-01-01'); // rolls to next year
    expect(es('x 3 de marzo de 2027').dueKey).toBe('2027-03-03');
    expect(es('x 21 sep').dueKey).toBe('2026-09-21');
    expect(es('x 5 dic').dueKey).toBe('2026-12-05');
    expect(es('x 20 de setiembre').dueKey).toBe('2026-09-20');
    expect(es('x mar 21').dueKey).toBe('2027-03-21'); // "mar" + number is March, not martes
    expect(es('x 9/10').dueKey).toBe('2026-10-09'); // day/month
    expect(es('x 9/21').dueKey).toBe('2026-09-21'); // no month 21: month/day
    expect(es('x 2026-10-02').dueKey).toBe('2026-10-02');
  });

  it('parses times', () => {
    expect(hm(es('x mañana a las 5').dueAt)).toBe('17:00');
    expect(hm(es('x mañana a las 9').dueAt)).toBe('9:00');
    expect(hm(es('x mañana a la 1').dueAt)).toBe('13:00');
    expect(hm(es('x mañana a las 5 y media').dueAt)).toBe('17:30');
    expect(hm(es('x mañana a las 17:00').dueAt)).toBe('17:00');
    expect(hm(es('x mañana 17:00').dueAt)).toBe('17:00');
    expect(hm(es('x mañana 5pm').dueAt)).toBe('17:00');
    expect(hm(es('x mañana a las 5 p. m.').dueAt)).toBe('17:00');
    expect(hm(es('x viernes a las 8 de la mañana').dueAt)).toBe('8:00');
    expect(es('x viernes a las 8 de la mañana').dueKey).toBe('2026-09-18');
    expect(hm(es('x mañana a las 8 de la noche').dueAt)).toBe('20:00');
    expect(hm(es('x mañana al mediodía').dueAt)).toBe('12:00');
    const p = es('x a las 3'); // no date: today at 15:00
    expect(p.dueKey).toBe('2026-09-14');
    expect(hm(p.dueAt)).toBe('15:00');
    expect(es('x mañana a las 8 de la mañana').title).toBe('x');
  });

  it('keeps "por la mañana" from meaning tomorrow', () => {
    expect(es('Correr por la mañana').dueKey).toBeUndefined();
  });

  it('parses priority words', () => {
    expect(es('x !urgente').priority).toBe('urgent');
    expect(es('x !alta').priority).toBe('high');
    expect(es('x !baja').priority).toBe('low');
    expect(es('x !media').priority).toBe('normal');
    expect(es('x !high').priority).toBe('high'); // English still works
    // Spanish priority words work in English too (they can't be mistaken for anything else)
    expect(parseQuickAdd('x !alta', { now, locale: 'en' }).priority).toBe('high');
  });

  it('matches accented course names', () => {
    expect(es('x #química').courseId).toBe('c1');
    expect(es('x #quimica').courseId).toBe('c1');
    expect(es('x #hist').courseId).toBe('c2');
    expect(es('x #laboratorio').tags).toEqual(['laboratorio']);
  });

  it('parses recurrence and types', () => {
    expect(es('x todos los días').recurrence).toEqual({ kind: 'daily' });
    expect(es('x cada día').recurrence).toEqual({ kind: 'daily' });
    expect(es('x entre semana').recurrence).toEqual({ kind: 'weekdays' });
    expect(es('x cada 3 días').recurrence).toEqual({ kind: 'everyNDays', n: 3 });
    expect(es('x cada dos semanas').recurrence).toEqual({ kind: 'weekly', n: 2 });
    expect(es('x cada mes').recurrence).toEqual({ kind: 'monthly' });
    expect(es('x cada semana').recurrence).toEqual({ kind: 'weekly' });
    expect(es('x todos los lunes y miércoles').recurrence).toEqual({ kind: 'weekly', days: [1, 3] });
    expect(es('Gimnasio cada lun, mié, vie a las 7').recurrence).toEqual({ kind: 'weekly', days: [1, 3, 5] });
    expect(es('x todos los sábados').recurrence).toEqual({ kind: 'weekly', days: [6] });
    expect(es('Final tipo:examen').type).toBe('exam');
  });

  it('leaves English parsing alone when the locale is English', () => {
    const p = parseQuickAdd('x mañana mar', { now, locale: 'en' });
    expect(p.dueKey).toBeUndefined();
    expect(p.title).toBe('x mañana mar');
    expect(parseQuickAdd('x 9/10', { now, locale: 'en' }).dueKey).toBe('2026-09-10');
  });

  it('still understands English words in Spanish mode', () => {
    expect(es('x tomorrow 8pm').dueKey).toBe('2026-09-15');
    expect(es('x next fri').dueKey).toBe('2026-09-25');
    expect(es('x ~45m').estimateMin).toBe(45);
  });

  it('keeps numbers that are not dates in the title', () => {
    expect(es('Problemas 1 a 20 del capítulo 4').title).toBe('Problemas 1 a 20 del capítulo 4');
    expect(es('Problemas 1 a 20 del capítulo 4').dueAt).toBeUndefined();
  });
});
