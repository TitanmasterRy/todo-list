import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { autoDescribe, inferSubject } from './autodescribe';
import { setLocale } from './i18n/index.svelte';

// The auto plan in Spanish: Spanish titles are understood and the plan, steps and tip come out in Spanish.
// (English output is covered by autodescribe.test.ts and must not change.)
describe('auto plan in Spanish', () => {
  beforeEach(async () => {
    await setLocale('es', { languages: ['es-ES'] });
  });
  afterEach(async () => {
    await setLocale('en');
  });

  it('reads Spanish page ranges and writes Spanish steps', () => {
    const d = autoDescribe('Leer págs. 112-140', { courseName: 'Química' });
    expect(d.type).toBe('reading');
    expect(d.estimateMin).toBe(87);
    expect(d.notes.split('\n')[0]).toBe('Lectura de Química: págs. 112–140.');
    expect(d.notes).toContain('**Plan:** repasa los títulos');
    expect(d.notes).toContain('**Consejo:** Sigue las unidades en cada paso.');
    expect(d.subtasks).toEqual(['Echar un vistazo a los títulos: págs. 112–140', 'Leer y subrayar', 'Escribir un resumen en 5 puntos']);
  });

  it('understands chapters and "del 1 al 20"', () => {
    expect(autoDescribe('Leer el capítulo 6').notes).toContain('capítulo 6');
    const hw = autoDescribe('Ejercicios del 1 al 20', { courseName: 'Matemáticas' });
    expect(hw.type).toBe('homework');
    expect(hw.subtasks[0]).toBe('Hacer ejercicios 1–20');
    expect(hw.estimateMin).toBe(80);
    expect(hw.notes).toContain('Escribe cada paso');
  });

  it('spots exams, quizzes, essays and presentations', () => {
    expect(autoDescribe('Examen de historia').type).toBe('exam');
    expect(autoDescribe('Examen de historia').notes).toMatch(/^Preparar el examen: Examen de historia\./);
    expect(autoDescribe('Prueba de vocabulario').type).toBe('quiz');
    expect(autoDescribe('Ensayo sobre el Quijote').type).toBe('project');
    expect(autoDescribe('Presentación de biología').subtasks).toContain('Hacer las diapositivas');
    expect(autoDescribe('Informe de laboratorio').notes).toMatch(/^Informe de laboratorio: /);
  });

  it('knows Spanish course names', () => {
    expect(inferSubject('Física y Química')).toBe('science');
    expect(inferSubject('Inglés')).toBe('language');
    expect(inferSubject('Lengua castellana')).toBe('english');
    expect(inferSubject('Historia de España')).toBe('history');
    expect(inferSubject('Informática')).toBe('cs');
  });

  it('keeps an English title working', () => {
    expect(autoDescribe('Read pp. 12-40').notes.split('\n')[0]).toBe('Lectura: págs. 12–40.');
  });
});
