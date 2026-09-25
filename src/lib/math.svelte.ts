// LaTeX math in notes and notecards: $x^2$, $$\int_0^1 f$$, \( … \) and \[ … \]. KaTeX (and its fonts)
// load only the first time some text actually contains math; until then the TeX shows as code.
type Katex = typeof import('katex').default;

export const mathState = $state({ ready: false });
let katex: Katex | null = null;
let loading: Promise<void> | null = null;

export function ensureKatex(): Promise<void> {
  if (katex) return Promise.resolve();
  loading ??= Promise.all([import('katex'), import('katex/dist/katex.min.css')])
    .then(([m]) => {
      katex = m.default;
      mathState.ready = true;
    })
    .catch((e) => {
      loading = null;
      console.error(e);
    });
  return loading;
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// $$…$$ and \[…\] (display), \(…\) and $…$ (inline). A $…$ pair only counts when it hugs its content and isn't
// followed by a digit, so "$5 and $10" stays money.
const MATH_RE = /\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]|\\\(([\s\S]+?)\\\)|\$(?![\s$])((?:\\\$|[^$\n])+?)(?<![\s\\])\$(?!\d)/g;

export function hasMath(s: string): boolean {
  MATH_RE.lastIndex = 0;
  return MATH_RE.test(s);
}

/** Split text into plain and math pieces. */
export function splitMath(s: string): ({ text: string } | { tex: string; display: boolean })[] {
  const out: ({ text: string } | { tex: string; display: boolean })[] = [];
  let last = 0;
  MATH_RE.lastIndex = 0;
  for (let m: RegExpExecArray | null; (m = MATH_RE.exec(s));) {
    if (m.index > last) out.push({ text: s.slice(last, m.index) });
    const display = m[1] !== undefined || m[2] !== undefined;
    out.push({ tex: (m[1] ?? m[2] ?? m[3] ?? m[4]).trim(), display });
    last = m.index + m[0].length;
  }
  if (last < s.length) out.push({ text: s.slice(last) });
  return out;
}

/** One formula as HTML: KaTeX when loaded (reading mathState makes callers re-render once it is), else escaped TeX. */
export function renderTex(tex: string, display: boolean): string {
  if (!mathState.ready || !katex) {
    void ensureKatex();
    return `<code class="tex">${esc(tex)}</code>`;
  }
  try {
    return katex.renderToString(tex, { displayMode: display, throwOnError: false, output: 'htmlAndMathml', trust: false, maxExpand: 500, maxSize: 50 });
  } catch {
    return `<code class="tex">${esc(tex)}</code>`;
  }
}

/** Plain text (a notecard face) with its math rendered; everything else escaped. */
export function renderTextWithMath(s: string): string {
  if (!hasMath(s)) return esc(s).replace(/\n/g, '<br>');
  return splitMath(s)
    .map((p) => ('text' in p ? esc(p.text).replace(/\n/g, '<br>') : renderTex(p.tex, p.display)))
    .join('');
}
