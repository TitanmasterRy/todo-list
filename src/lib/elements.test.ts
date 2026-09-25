import { describe, expect, it } from 'vitest';
import { electronConfig, element, ELEMENTS, groupOf, molarMass } from './elements';

describe('periodic table data', () => {
  it('has all 118 elements with positions', () => {
    expect(ELEMENTS).toHaveLength(118);
    expect(ELEMENTS.map((e) => e.z)).toEqual(Array.from({ length: 118 }, (_, i) => i + 1));
    expect(new Set(ELEMENTS.map((e) => e.symbol)).size).toBe(118);
    expect([groupOf(1), groupOf(2), groupOf(5), groupOf(26), groupOf(56), groupOf(57), groupOf(72), groupOf(80), groupOf(86), groupOf(104), groupOf(118)]).toEqual([
      1,
      18,
      13,
      8,
      2,
      null,
      4,
      12,
      18,
      4,
      18,
    ]);
    // every table position (period, group) is used exactly once outside the f rows
    const spots = ELEMENTS.filter((e) => e.group !== null).map((e) => `${e.period}:${e.group}`);
    expect(new Set(spots).size).toBe(spots.length);
    expect(ELEMENTS.filter((e) => e.block === 'f')).toHaveLength(30);
    expect(element('Fe')).toMatchObject({ name: 'Iron', period: 4, group: 8, block: 'd', state: 'solid' });
    expect(element('Br')?.state).toBe('liquid');
    expect(element('He')?.block).toBe('s');
    expect(element('Tc')?.massIsotope).toBe(true);
  });

  it('writes electron configurations', () => {
    expect(electronConfig(1)).toBe('1s1');
    expect(electronConfig(8)).toBe('[He] 2s2 2p4');
    expect(electronConfig(26)).toBe('[Ar] 4s2 3d6');
    expect(electronConfig(33)).toBe('[Ar] 4s2 3d10 4p3');
    expect(electronConfig(29)).toBe('[Ar] 3d10 4s1');
    expect(electronConfig(82)).toBe('[Xe] 6s2 4f14 5d10 6p2');
  });

  it('computes molar masses', () => {
    expect(molarMass('H2O').mass).toBeCloseTo(18.015, 2);
    expect(molarMass('H2SO4').mass).toBeCloseTo(98.07, 1);
    expect(molarMass('Ca(OH)2').mass).toBeCloseTo(74.09, 1);
    expect(molarMass('CuSO4·5H2O').mass).toBeCloseTo(249.68, 1);
    expect(molarMass('CuSO4*5H2O').counts).toEqual({ Cu: 1, S: 1, O: 9, H: 10 });
    expect(molarMass('[Cu(NH3)4]SO4').counts).toEqual({ Cu: 1, N: 4, H: 12, S: 1, O: 4 });
    expect(molarMass('C₆H₁₂O₆').mass).toBeCloseTo(180.16, 1);
    const pct = molarMass('NaCl').percent;
    expect(pct.reduce((a, p) => a + p.percent, 0)).toBeCloseTo(100);
    expect(() => molarMass('Xx2')).toThrow(/isn't an element/);
    expect(() => molarMass('Ca(OH2')).toThrow(/never closed/);
    expect(() => molarMass('h2o')).toThrow(/capital/);
  });
});
