import { describe, it, expect } from 'vitest';
import { evaluate, compile, formatNumber, MathError, FUNCTIONS } from './mathparser';

const ev = (s: string, vars?: Record<string, number>) => evaluate(s, { variables: vars });
const evDeg = (s: string) => evaluate(s, { angle: 'deg' });

describe('numbers and basic arithmetic', () => {
  it('parses number literals', () => {
    expect(ev('3')).toBe(3);
    expect(ev('3.5')).toBe(3.5);
    expect(ev('.5')).toBe(0.5);
    expect(ev('1e3')).toBe(1000);
    expect(ev('2.5E-2')).toBe(0.025);
  });

  it('respects precedence and associativity', () => {
    expect(ev('2*3+4')).toBe(10);
    expect(ev('2+3*4')).toBe(14);
    expect(ev('2^3^2')).toBe(512);
    expect(ev('-2^2')).toBe(-4);
    expect(ev('(-2)^2')).toBe(4);
    expect(ev('2^-1')).toBe(0.5);
    expect(ev('10-2-3')).toBe(5);
    expect(ev('12/2/3')).toBe(2);
    expect(ev('2**3')).toBe(8);
  });

  it('handles unary plus/minus and whitespace', () => {
    expect(ev('  -  3 + +2 ')).toBe(-1);
    expect(ev('--3')).toBe(3);
    expect(ev('2*-3')).toBe(-6);
  });

  it('accepts unicode operator aliases', () => {
    expect(ev('6×7')).toBe(42);
    expect(ev('8÷2')).toBe(4);
    expect(ev('5−3')).toBe(2);
  });

  it('division by zero yields Infinity', () => {
    expect(ev('1/0')).toBe(Infinity);
  });
});

describe('implicit multiplication', () => {
  it('multiplies number and variable', () => {
    expect(ev('2x', { x: 3 })).toBe(6);
    expect(ev('2x^2', { x: 3 })).toBe(18);
  });
  it('multiplies with parentheses', () => {
    expect(ev('2(3)')).toBe(6);
    expect(ev('(1)(2)')).toBe(2);
    expect(ev('(1+2)(3+4)')).toBe(21);
  });
  it('multiplies adjacent identifiers', () => {
    expect(ev('x y', { x: 2, y: 5 })).toBe(10);
  });
  it('multiplies with constants and functions', () => {
    expect(ev('2pi')).toBeCloseTo(2 * Math.PI);
    expect(ev('3sin(x)', { x: Math.PI / 2 })).toBeCloseTo(3);
    expect(ev('2e')).toBeCloseTo(2 * Math.E);
  });
  it('treats unknown identifier followed by ( as multiplication, not a call', () => {
    expect(ev('k(2)', { k: 4 })).toBe(8);
    expect(() => ev('foo(2)')).toThrow('Unknown variable: foo');
  });
});

describe('functions', () => {
  it('trig in radians (default)', () => {
    expect(ev('sin(pi/2)')).toBeCloseTo(1);
    expect(ev('cos(0)')).toBe(1);
    expect(ev('atan2(1,1)')).toBeCloseTo(Math.PI / 4);
    expect(ev('asin(1)')).toBeCloseTo(Math.PI / 2);
  });
  it('trig in degrees', () => {
    expect(evDeg('sin(90)')).toBeCloseTo(1);
    expect(evDeg('cos(60)')).toBeCloseTo(0.5);
    expect(evDeg('tan(45)')).toBeCloseTo(1);
    expect(evDeg('asin(1)')).toBeCloseTo(90);
    expect(evDeg('atan(1)')).toBeCloseTo(45);
    expect(evDeg('atan2(1,1)')).toBeCloseTo(45);
  });
  it('is case-insensitive', () => {
    expect(ev('SQRT(16)')).toBe(4);
    expect(ev('Sin(0)')).toBe(0);
  });
  it('supports the remaining functions', () => {
    expect(ev('sqrt(16)')).toBe(4);
    expect(ev('cbrt(27)')).toBe(3);
    expect(ev('abs(-3)')).toBe(3);
    expect(ev('ln(e)')).toBeCloseTo(1);
    expect(ev('log(100)')).toBeCloseTo(2);
    expect(ev('log2(8)')).toBeCloseTo(3);
    expect(ev('exp(0)')).toBe(1);
    expect(ev('floor(2.7)')).toBe(2);
    expect(ev('ceil(2.1)')).toBe(3);
    expect(ev('round(2.5)')).toBe(3);
    expect(ev('trunc(-2.7)')).toBe(-2);
    expect(ev('sign(-5)')).toBe(-1);
    expect(ev('sinh(0)')).toBe(0);
    expect(ev('cosh(0)')).toBe(1);
    expect(ev('tanh(0)')).toBe(0);
    expect(ev('min(3,1,2)')).toBe(1);
    expect(ev('max(3,1,2)')).toBe(3);
    expect(ev('hypot(3,4)')).toBe(5);
    expect(ev('ncr(5,2)')).toBe(10);
    expect(ev('npr(5,2)')).toBe(20);
    expect(ev('gcd(12,18)')).toBe(6);
    expect(ev('lcm(4,6)')).toBe(12);
    expect(ev('deg(pi)')).toBeCloseTo(180);
    expect(ev('rad(180)')).toBeCloseTo(Math.PI);
    expect(ev('root(3,27)')).toBeCloseTo(3);
    expect(ev('root(3,-8)')).toBeCloseTo(-2);
  });
  it('checks arity', () => {
    expect(() => ev('min()')).toThrow(MathError);
    expect(() => ev('sqrt(1,2)')).toThrow(MathError);
    expect(() => ev('ncr(5)')).toThrow(MathError);
  });
  it('exports FUNCTIONS', () => {
    expect(FUNCTIONS).toContain('sin');
    expect(FUNCTIONS).toContain('ncr');
    expect(FUNCTIONS).toContain('root');
  });
});

describe('factorial, percent, modulo', () => {
  it('factorial', () => {
    expect(ev('5!')).toBe(120);
    expect(ev('0!')).toBe(1);
    expect(ev('-2!')).toBe(-2);
    expect(ev('2^3!')).toBe(64);
    expect(ev('(2+1)!')).toBe(6);
  });
  it('rejects invalid factorials', () => {
    expect(() => ev('3.5!')).toThrow(MathError);
    expect(() => ev('171!')).toThrow(MathError);
    expect(() => ev('(-2)!')).toThrow(MathError);
    expect(ev('5!!') / 6.6895e198).toBeCloseTo(1, 3); // (5!)! = 120!
    expect(() => ev('10!!')).toThrow(MathError); // 3628800! is out of range
  });
  it('percent as postfix', () => {
    expect(ev('50%')).toBe(0.5);
    expect(ev('50% * 2')).toBe(1);
    expect(ev('200 + 10%')).toBeCloseTo(200.1);
  });
  it('modulo as binary', () => {
    expect(ev('7 % 3')).toBe(1);
    expect(ev('7 % (3)')).toBe(1);
    expect(ev('x % y', { x: 10, y: 4 })).toBe(2);
  });
});

describe('constants and variables', () => {
  it('constants', () => {
    expect(ev('pi')).toBe(Math.PI);
    expect(ev('π')).toBe(Math.PI);
    expect(ev('PI')).toBe(Math.PI);
    expect(ev('e')).toBe(Math.E);
    expect(ev('tau')).toBe(2 * Math.PI);
    expect(ev('inf')).toBe(Infinity);
  });
  it('variables', () => {
    expect(ev('x + ans', { x: 2, ans: 5 })).toBe(7);
    expect(ev('ans * 2', { ans: 5 })).toBe(10);
  });
  it('unknown variable', () => {
    expect(() => ev('foo + 1')).toThrow('Unknown variable: foo');
    expect(() => ev('ans')).toThrow(MathError);
  });
});

describe('compile', () => {
  it('evaluates over several x values', () => {
    const f = compile('x^2 + 1');
    expect([0, 1, 2, 3].map(f)).toEqual([1, 2, 5, 10]);
  });
  it('uses extra variables and angle mode', () => {
    expect(compile('a*x', { variables: { a: 3 } })(2)).toBe(6);
    expect(compile('sin(x)', { angle: 'deg' })(90)).toBeCloseTo(1);
  });
  it('returns NaN for domain errors', () => {
    expect(compile('sqrt(x)')(-1)).toBeNaN();
    expect(compile('x!')(0.5)).toBeNaN();
    expect(compile('1/x')(0)).toBe(Infinity);
  });
  it('throws at compile time for syntax errors and unknown variables', () => {
    expect(() => compile('x +')).toThrow(MathError);
    expect(() => compile('y + 1')).toThrow('Unknown variable: y');
  });
});

describe('formatNumber', () => {
  it('rounds floating noise and strips trailing zeros', () => {
    expect(formatNumber(0.1 + 0.2)).toBe('0.3');
    expect(formatNumber(2.5)).toBe('2.5');
    expect(formatNumber(100)).toBe('100');
    expect(formatNumber(-1.5)).toBe('-1.5');
    expect(formatNumber(1 / 3)).toBe('0.333333333333');
    expect(formatNumber(1 / 3, 4)).toBe('0.3333');
  });
  it('uses exponent form for very large / small values', () => {
    expect(formatNumber(1e21)).toBe('1e21');
    expect(formatNumber(1e21)).toMatch(/e/);
    expect(formatNumber(1.5e-9)).toBe('1.5e-9');
  });
  it('avoids -0 and handles specials', () => {
    expect(formatNumber(-0)).toBe('0');
    expect(formatNumber(NaN)).toBe('NaN');
    expect(formatNumber(Infinity)).toBe('∞');
    expect(formatNumber(-Infinity)).toBe('-∞');
  });
});

describe('errors', () => {
  it('empty expression', () => {
    expect(() => ev('')).toThrow('Empty expression');
    expect(() => ev('   ')).toThrow('Empty expression');
  });
  it('unbalanced parentheses', () => {
    expect(() => ev('(1+2')).toThrow('Missing )');
    expect(() => ev('sin(1')).toThrow('Missing )');
    expect(() => ev('1+2)')).toThrow('Unexpected )');
  });
  it('dangling / stray operators', () => {
    expect(() => ev('1+')).toThrow(MathError);
    expect(() => ev('*2')).toThrow(MathError);
    expect(() => ev('1,2')).toThrow(MathError);
  });
  it('unexpected characters', () => {
    expect(() => ev('2 $ 3')).toThrow("Unexpected character '$'");
  });
  it('undefined results throw from evaluate', () => {
    expect(() => ev('sqrt(-1)')).toThrow(MathError);
    expect(() => ev('0/0')).toThrow(MathError);
  });
  it('rejects deep nesting', () => {
    const deep = '('.repeat(300) + '1' + ')'.repeat(300);
    expect(() => ev(deep)).toThrow('too deeply nested');
  });
  it('errors are instances of MathError', () => {
    try {
      ev('(');
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(MathError);
      expect((e as Error).name).toBe('MathError');
    }
  });
});
