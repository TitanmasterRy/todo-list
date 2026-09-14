/**
 * mathparser.ts — a small, safe math expression evaluator (no eval / Function).
 *
 * Pipeline:  tokenize()  →  Parser (Pratt)  →  AST  →  evalNode()
 *
 * Supports: + - * / ^ (right-assoc), unary ±, binary % (modulo) and postfix %
 * (percent), postfix ! (factorial), unicode aliases × ÷ −, ** for ^, parentheses,
 * implicit multiplication (2x, 2(3), (1)(2), x y, 2pi, 3sin(x)), case-insensitive
 * functions, constants (pi π e tau inf) and user variables.
 */

export interface EvalOptions {
  /** Angle unit for sin cos tan asin acos atan atan2. Default 'rad'. */
  angle?: 'rad' | 'deg';
  /** User variables, e.g. { x: 2, ans: 5 }. */
  variables?: Record<string, number>;
}

/** Thrown for any syntax or runtime problem, with a short human-readable message. */
export class MathError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MathError';
  }
}

// ───────────────────────────── Tokenizer ─────────────────────────────

type TokType = 'num' | 'ident' | 'op' | '(' | ')' | ',' | 'end';
interface Token {
  type: TokType;
  value: string;
  pos: number;
}

const OP_ALIASES: Record<string, string> = { '×': '*', '÷': '/', '−': '-' };
const NUM_RE = /^(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/;
const IDENT_RE = /^(?:[A-Za-z_][A-Za-z0-9_]*|π)/;

function tokenize(src: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    const rest = src.slice(i);
    let m = NUM_RE.exec(rest);
    if (m) {
      tokens.push({ type: 'num', value: m[0], pos: i });
      i += m[0].length;
      continue;
    }
    m = IDENT_RE.exec(rest);
    if (m) {
      tokens.push({ type: 'ident', value: m[0], pos: i });
      i += m[0].length;
      continue;
    }
    if (rest.startsWith('**')) {
      tokens.push({ type: 'op', value: '^', pos: i });
      i += 2;
      continue;
    }
    if ('+-*/^%!'.includes(ch) || ch in OP_ALIASES) {
      tokens.push({ type: 'op', value: OP_ALIASES[ch] ?? ch, pos: i });
      i++;
      continue;
    }
    if (ch === '(' || ch === ')' || ch === ',') {
      tokens.push({ type: ch, value: ch, pos: i });
      i++;
      continue;
    }
    throw new MathError(`Unexpected character '${ch}'`);
  }
  tokens.push({ type: 'end', value: '', pos: src.length });
  return tokens;
}

// ───────────────────────────── AST ─────────────────────────────

type Node =
  | { kind: 'num'; value: number }
  | { kind: 'var'; name: string }
  | { kind: 'neg'; arg: Node }
  | { kind: 'bin'; op: '+' | '-' | '*' | '/' | '%' | '^'; left: Node; right: Node }
  | { kind: 'post'; op: '!' | '%'; arg: Node }
  | { kind: 'call'; name: string; args: Node[] };

// ───────────────────────────── Parser (Pratt) ─────────────────────────────

/** Left binding powers of binary operators. */
const BP: Record<string, number> = { '+': 10, '-': 10, '*': 20, '/': 20, '%': 20, '^': 30 };
const IMPLICIT_BP = 20; // `2x` binds like `2*x`, so 2x^2 = 2*(x^2)
const UNARY_BP = 15; // between +- and */ so that -2^2 = -(2^2) and -2*3 = -(2*3)
const MAX_DEPTH = 100;

class Parser {
  private i = 0;
  private depth = 0;
  constructor(private toks: Token[]) {}

  private peek(offset = 0): Token {
    return this.toks[Math.min(this.i + offset, this.toks.length - 1)];
  }
  private next(): Token {
    return this.toks[this.i++];
  }

  parse(): Node {
    const node = this.expr(0);
    const t = this.peek();
    if (t.type !== 'end') {
      throw new MathError(t.type === ')' ? 'Unexpected )' : `Unexpected '${t.value}'`);
    }
    return node;
  }

  /** Parse an expression whose operators bind tighter than `rbp`. */
  private expr(rbp: number): Node {
    if (++this.depth > MAX_DEPTH) throw new MathError('Expression too deeply nested');
    let left = this.prefix();
    for (;;) {
      const t = this.peek();
      if (t.type === 'op' && t.value === '!') {
        // Postfix factorial binds tighter than everything else.
        this.next();
        left = { kind: 'post', op: '!', arg: left };
      } else if (t.type === 'op' && t.value === '%' && !this.startsOperand(this.peek(1))) {
        // `50% * 2` or `50%` at the end → percent. `7 % 3` → modulo (handled below).
        this.next();
        left = { kind: 'post', op: '%', arg: left };
      } else if (t.type === 'op' && t.value in BP && BP[t.value] > rbp) {
        this.next();
        const bp = BP[t.value];
        const right = this.expr(t.value === '^' ? bp - 1 : bp); // ^ is right-assoc
        left = { kind: 'bin', op: t.value as '+', left, right };
      } else if (this.startsOperand(t) && IMPLICIT_BP > rbp) {
        // Implicit multiplication: `2x`, `2(3)`, `(1)(2)`, `x y`, `3sin(x)`.
        const right = this.expr(IMPLICIT_BP);
        left = { kind: 'bin', op: '*', left, right };
      } else {
        break;
      }
    }
    this.depth--;
    return left;
  }

  private startsOperand(t: Token): boolean {
    return t.type === 'num' || t.type === 'ident' || t.type === '(';
  }

  /** Parse a prefix/atom: number, identifier, function call, parens, unary ±. */
  private prefix(): Node {
    const t = this.next();
    switch (t.type) {
      case 'num':
        return { kind: 'num', value: Number(t.value) };
      case 'ident': {
        const name = t.value.toLowerCase();
        // An identifier followed by `(` is a call only if it names a known function.
        if (this.peek().type === '(' && name in FN) {
          this.next();
          const args: Node[] = [];
          if (this.peek().type !== ')') {
            for (;;) {
              args.push(this.expr(0));
              if (this.peek().type === ',') {
                this.next();
                continue;
              }
              break;
            }
          }
          if (this.next().type !== ')') throw new MathError('Missing )');
          const { min, max } = FN[name];
          if (args.length < min || args.length > max) {
            const want = min === max ? `${min}` : max === Infinity ? `at least ${min}` : `${min}-${max}`;
            throw new MathError(`${name} expects ${want} argument${want === '1' ? '' : 's'}`);
          }
          return { kind: 'call', name, args };
        }
        return { kind: 'var', name: t.value };
      }
      case '(': {
        const inner = this.expr(0);
        if (this.next().type !== ')') throw new MathError('Missing )');
        return inner;
      }
      case 'op':
        if (t.value === '-') return { kind: 'neg', arg: this.expr(UNARY_BP) };
        if (t.value === '+') return this.expr(UNARY_BP);
        throw new MathError(`Unexpected '${t.value}'`);
      case ')':
        throw new MathError('Unexpected )');
      case ',':
        throw new MathError("Unexpected ','");
      default:
        throw new MathError('Unexpected end of expression');
    }
  }
}

function parse(expr: string): Node {
  if (!expr || !expr.trim()) throw new MathError('Empty expression');
  return new Parser(tokenize(expr)).parse();
}

// ───────────────────────────── Functions & constants ─────────────────────────────

interface Ctx {
  angle: 'rad' | 'deg';
  vars: Record<string, number>;
}
interface Fn {
  fn: (args: number[], ctx: Ctx) => number;
  min: number;
  max: number;
}

const toRad = (v: number, c: Ctx) => (c.angle === 'deg' ? (v * Math.PI) / 180 : v);
const fromRad = (v: number, c: Ctx) => (c.angle === 'deg' ? (v * 180) / Math.PI : v);
const f1 = (fn: (x: number) => number): Fn => ({ fn: (a) => fn(a[0]), min: 1, max: 1 });
const f2 = (fn: (x: number, y: number) => number): Fn => ({ fn: (a) => fn(a[0], a[1]), min: 2, max: 2 });
const fN = (fn: (...xs: number[]) => number, min: number): Fn => ({ fn: (a) => fn(...a), min, max: Infinity });

function requireInt(name: string, ...xs: number[]): void {
  if (!xs.every((x) => Number.isInteger(x) && x >= 0)) {
    throw new MathError(`${name} requires non-negative integers`);
  }
}
function factorial(n: number): number {
  if (!Number.isInteger(n) || n < 0 || n > 170) {
    throw new MathError('Factorial is only defined for integers 0..170');
  }
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}
function ncr(n: number, r: number): number {
  requireInt('ncr', n, r);
  if (r > n) return 0;
  r = Math.min(r, n - r);
  let res = 1;
  for (let i = 1; i <= r; i++) res = (res * (n - r + i)) / i;
  return Math.round(res);
}
function npr(n: number, r: number): number {
  requireInt('npr', n, r);
  if (r > n) return 0;
  let res = 1;
  for (let i = n - r + 1; i <= n; i++) res *= i;
  return res;
}
function gcd2(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a;
}

const FN: Record<string, Fn> = {
  sin: { fn: (a, c) => Math.sin(toRad(a[0], c)), min: 1, max: 1 },
  cos: { fn: (a, c) => Math.cos(toRad(a[0], c)), min: 1, max: 1 },
  tan: { fn: (a, c) => Math.tan(toRad(a[0], c)), min: 1, max: 1 },
  asin: { fn: (a, c) => fromRad(Math.asin(a[0]), c), min: 1, max: 1 },
  acos: { fn: (a, c) => fromRad(Math.acos(a[0]), c), min: 1, max: 1 },
  atan: { fn: (a, c) => fromRad(Math.atan(a[0]), c), min: 1, max: 1 },
  atan2: { fn: (a, c) => fromRad(Math.atan2(a[0], a[1]), c), min: 2, max: 2 },
  sinh: f1(Math.sinh),
  cosh: f1(Math.cosh),
  tanh: f1(Math.tanh),
  sqrt: f1(Math.sqrt),
  cbrt: f1(Math.cbrt),
  abs: f1(Math.abs),
  ln: f1(Math.log),
  log: f1(Math.log10),
  log2: f1(Math.log2),
  exp: f1(Math.exp),
  floor: f1(Math.floor),
  ceil: f1(Math.ceil),
  round: f1(Math.round),
  trunc: f1(Math.trunc),
  sign: f1(Math.sign),
  min: fN(Math.min, 1),
  max: fN(Math.max, 1),
  hypot: fN(Math.hypot, 1),
  ncr: f2(ncr),
  npr: f2(npr),
  gcd: fN((...xs) => xs.reduce(gcd2), 2),
  lcm: fN((...xs) => xs.reduce((a, b) => (a === 0 || b === 0 ? 0 : Math.abs(a * b) / gcd2(a, b))), 2),
  deg: f1((x) => (x * 180) / Math.PI),
  rad: f1((x) => (x * Math.PI) / 180),
  /** root(n, x) = x^(1/n); odd roots of negatives are real (root(3,-8) = -2). */
  root: f2((n, x) => (x < 0 && n % 2 === 1 ? -Math.pow(-x, 1 / n) : Math.pow(x, 1 / n))),
};

/** Names of all supported functions, for help text. */
export const FUNCTIONS: string[] = Object.keys(FN);

const CONSTANTS: Record<string, number> = { pi: Math.PI, 'π': Math.PI, e: Math.E, tau: 2 * Math.PI, inf: Infinity };

function lookupVar(name: string, vars: Record<string, number>): number {
  if (Object.hasOwn(vars, name)) return vars[name];
  const c = CONSTANTS[name.toLowerCase()];
  if (c !== undefined) return c;
  throw new MathError(`Unknown variable: ${name}`);
}

// ───────────────────────────── Evaluator ─────────────────────────────

function evalNode(n: Node, ctx: Ctx): number {
  switch (n.kind) {
    case 'num':
      return n.value;
    case 'var':
      return lookupVar(n.name, ctx.vars);
    case 'neg':
      return -evalNode(n.arg, ctx);
    case 'post': {
      const v = evalNode(n.arg, ctx);
      return n.op === '!' ? factorial(v) : v / 100;
    }
    case 'bin': {
      const a = evalNode(n.left, ctx);
      const b = evalNode(n.right, ctx);
      switch (n.op) {
        case '+': return a + b;
        case '-': return a - b;
        case '*': return a * b;
        case '/': return a / b;
        case '%': return a % b;
        case '^': return Math.pow(a, b);
      }
      break;
    }
    case 'call':
      return FN[n.name].fn(n.args.map((arg) => evalNode(arg, ctx)), ctx);
  }
  throw new MathError('Invalid expression');
}

/** Collect the names of every variable referenced in the AST. */
function collectVars(n: Node, out: Set<string>): Set<string> {
  if (n.kind === 'var') out.add(n.name);
  else if (n.kind === 'neg' || n.kind === 'post') collectVars(n.arg, out);
  else if (n.kind === 'bin') {
    collectVars(n.left, out);
    collectVars(n.right, out);
  } else if (n.kind === 'call') n.args.forEach((a) => collectVars(a, out));
  return out;
}

// ───────────────────────────── Public API ─────────────────────────────

/** Evaluate an expression. Throws MathError for syntax errors, unknown names and undefined (NaN) results. */
export function evaluate(expr: string, opts: EvalOptions = {}): number {
  const ast = parse(expr);
  const result = evalNode(ast, { angle: opts.angle ?? 'rad', vars: opts.variables ?? {} });
  if (Number.isNaN(result)) throw new MathError('Result is undefined');
  return result;
}

/**
 * Parse once, evaluate many times with different x (for graphing).
 * Throws MathError at compile time for syntax errors and unknown variables;
 * the returned function returns NaN for domain errors (sqrt(-1), 2.5!, ...).
 */
export function compile(
  expr: string,
  opts: Omit<EvalOptions, 'variables'> & { variables?: Record<string, number> } = {},
): (x: number) => number {
  const ast = parse(expr);
  const vars: Record<string, number> = { ...(opts.variables ?? {}), x: 0 };
  for (const name of collectVars(ast, new Set())) lookupVar(name, vars); // throws if unknown
  const ctx: Ctx = { angle: opts.angle ?? 'rad', vars };
  return (x: number): number => {
    vars.x = x;
    try {
      return evalNode(ast, ctx);
    } catch (e) {
      if (e instanceof MathError) return NaN;
      throw e;
    }
  };
}

/**
 * Nice display: up to `digits` significant digits, trailing zeros stripped,
 * no "-0", exponent form for very large (≥1e15) or very small (<1e-6) values.
 */
export function formatNumber(n: number, digits = 12): string {
  if (Number.isNaN(n)) return 'NaN';
  if (!Number.isFinite(n)) return n > 0 ? '∞' : '-∞';
  if (n === 0) return '0';
  digits = Math.min(21, Math.max(1, Math.floor(digits)));
  const abs = Math.abs(n);
  if (abs >= 1e15 || abs < 1e-6) {
    const [mant, exp] = n.toExponential(digits - 1).split('e');
    const m = mant.includes('.') ? mant.replace(/\.?0+$/, '') : mant;
    return `${m}e${exp.replace('+', '')}`;
  }
  const s = String(Number(n.toPrecision(digits)));
  return s === '-0' ? '0' : s;
}
