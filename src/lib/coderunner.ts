// In-browser code execution for the Code tool.
// - JavaScript runs in a throwaway Web Worker (no DOM, killed on timeout).
// - Python runs in Pyodide, lazily loaded from the CDN on first use.
// - HTML/CSS/JS are combined into a srcdoc for a sandboxed iframe.
// - Java and C++ can't run in the browser; the UI links to an online compiler instead.
import type { SnippetLanguage } from './snippets';

export interface RunResult {
  output: string[];
  error?: string;
  ms: number;
}

export const DEFAULT_TIMEOUT_MS = 5000;
export const PYODIDE_VERSION = '0.27.2';
export const PYODIDE_URL = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/pyodide.js`;
export const PYODIDE_INDEX_URL = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;
export const ONECOMPILER_URLS: Partial<Record<SnippetLanguage, string>> = {
  java: 'https://onecompiler.com/java',
  cpp: 'https://onecompiler.com/cpp',
};

/** Whether "Run" does anything for this language in the browser. */
export function canRun(language: SnippetLanguage): boolean {
  return language !== 'java' && language !== 'cpp';
}

/** Turn a console argument into text: objects → JSON, undefined → 'undefined', errors → message. */
export function formatValue(v: unknown): string {
  if (v === undefined) return 'undefined';
  if (v === null) return 'null';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean' || typeof v === 'bigint') return String(v);
  if (typeof v === 'symbol') return v.toString();
  if (typeof v === 'function') return `[Function${v.name ? `: ${v.name}` : ''}]`;
  if (v instanceof Error) return v.message || v.name || 'Error';
  try {
    const json = JSON.stringify(v, (_k, val: unknown) => {
      if (typeof val === 'bigint') return `${val}n`;
      if (typeof val === 'function') return `[Function${val.name ? `: ${val.name}` : ''}]`;
      if (typeof val === 'undefined') return 'undefined';
      if (val instanceof Map) return Object.fromEntries(val);
      if (val instanceof Set) return Array.from(val);
      return val;
    });
    return json === undefined ? String(v) : json;
  } catch {
    // circular structure or hostile toJSON
    return Object.prototype.toString.call(v);
  }
}

// ---------- JavaScript ----------

// Source of the worker. Kept as a string so it can be turned into a Blob URL
// and so it never references anything from this module's scope.
const WORKER_SOURCE = `
'use strict';
var __out = [];
var __fmt = ${formatValue.toString()};
function __log(level, args) {
  var line = Array.prototype.map.call(args, __fmt).join(' ');
  __out.push({ level: level, text: line });
}
var console = {
  log: function () { __log('log', arguments); },
  info: function () { __log('info', arguments); },
  warn: function () { __log('warn', arguments); },
  error: function () { __log('error', arguments); },
  debug: function () { __log('log', arguments); },
  table: function () { __log('log', arguments); },
};
self.console = console;
// No DOM here anyway, but make the intent explicit for scripts that probe.
self.importScripts = undefined;
self.onmessage = function (e) {
  var code = e.data && e.data.code;
  var result = { output: [], error: undefined, value: undefined };
  var finish = function (err) {
    if (err !== undefined) {
      result.error = err && typeof err === 'object' && 'message' in err ? (err.name || 'Error') + ': ' + err.message : __fmt(err);
    }
    result.output = __out;
    self.postMessage(result);
  };
  var value;
  try {
    // Report the final expression's value when there is one: try the whole
    // program as an expression, then the last line as one, else run as-is.
    var fn = null;
    try {
      fn = new Function('"use strict";\\nreturn (\\n' + code + '\\n);');
    } catch (_) {}
    if (!fn) {
      var lines = String(code).replace(/\\s+$/, '').split('\\n');
      var last = lines.pop();
      if (last && !/^\\s*(\\/\\/|}|return\\b)/.test(last)) {
        try {
          fn = new Function('"use strict";\\n' + lines.join('\\n') + '\\nreturn (\\n' + last.replace(/;\\s*$/, '') + '\\n);');
        } catch (_) {}
      }
    }
    if (!fn) fn = new Function('"use strict";\\n' + code);
    value = fn();
  } catch (err) {
    finish(err);
    return;
  }
  if (value && typeof value.then === 'function') {
    value.then(
      function (v) { if (v !== undefined) result.value = __fmt(v); finish(undefined); },
      function (err) { finish(err); }
    );
  } else {
    if (value !== undefined) result.value = __fmt(value);
    finish(undefined);
  }
};
`;

interface WorkerLine {
  level: 'log' | 'info' | 'warn' | 'error';
  text: string;
}

export function runJavaScript(code: string, opts: { timeoutMs?: number } = {}): Promise<RunResult> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const start = performance.now();
  return new Promise<RunResult>((resolve) => {
    if (typeof Worker === 'undefined') {
      resolve({ output: [], error: 'Web Workers are not available in this browser.', ms: 0 });
      return;
    }
    const blob = new Blob([WORKER_SOURCE], { type: 'text/javascript' });
    const url = URL.createObjectURL(blob);
    let worker: Worker;
    try {
      worker = new Worker(url);
    } catch (err) {
      URL.revokeObjectURL(url);
      resolve({ output: [], error: `Could not start a worker: ${formatValue(err)}`, ms: 0 });
      return;
    }
    let done = false;
    const cleanup = () => {
      worker.terminate();
      URL.revokeObjectURL(url);
    };
    const timer = setTimeout(() => {
      if (done) return;
      done = true;
      cleanup();
      resolve({ output: [], error: `Timed out after ${Math.round(timeoutMs / 1000)}s (infinite loop?)`, ms: Math.round(performance.now() - start) });
    }, timeoutMs);
    worker.onmessage = (e: MessageEvent<{ output: WorkerLine[]; error?: string; value?: string }>) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      cleanup();
      const data = e.data ?? { output: [] };
      const output = (data.output ?? []).map((l) => (l.level === 'error' ? `✖ ${l.text}` : l.level === 'warn' ? `⚠ ${l.text}` : l.text));
      if (data.value !== undefined) output.push(`→ ${data.value}`);
      resolve({ output, error: data.error, ms: Math.round(performance.now() - start) });
    };
    worker.onerror = (e: ErrorEvent) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      cleanup();
      resolve({ output: [], error: e.message || 'Worker error', ms: Math.round(performance.now() - start) });
    };
    worker.postMessage({ code });
  });
}

// ---------- Python (Pyodide) ----------

interface PyodideLike {
  runPythonAsync(code: string): Promise<unknown>;
  setStdout(opts: { batched: (s: string) => void }): void;
  setStderr(opts: { batched: (s: string) => void }): void;
}

type LoadPyodide = (opts: { indexURL: string }) => Promise<PyodideLike>;

let pyodidePromise: Promise<PyodideLike> | null = null;

function injectScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
    if (existing && (window as unknown as { loadPyodide?: LoadPyodide }).loadPyodide) {
      resolve();
      return;
    }
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Could not download the Python runtime. Check your connection and try again.'));
    document.head.appendChild(s);
  });
}

function loadPyodideOnce(onStatus?: (s: string) => void): Promise<PyodideLike> {
  if (!pyodidePromise) {
    onStatus?.('Loading Python runtime (~10 MB, once)…');
    pyodidePromise = (async () => {
      await injectScript(PYODIDE_URL);
      const loadPyodide = (window as unknown as { loadPyodide?: LoadPyodide }).loadPyodide;
      if (!loadPyodide) throw new Error('Python runtime failed to initialise.');
      onStatus?.('Starting Python…');
      return loadPyodide({ indexURL: PYODIDE_INDEX_URL });
    })();
    pyodidePromise.catch(() => {
      // Let a later Run retry the download.
      pyodidePromise = null;
    });
  } else {
    onStatus?.('Starting Python…');
  }
  return pyodidePromise;
}

/** True once Pyodide has been requested (loaded or loading). */
export function pythonReady(): boolean {
  return pyodidePromise !== null;
}

export async function runPython(code: string, opts: { onStatus?: (s: string) => void } = {}): Promise<RunResult> {
  const start = performance.now();
  let py: PyodideLike;
  try {
    py = await loadPyodideOnce(opts.onStatus);
  } catch (err) {
    return { output: [], error: formatValue(err), ms: Math.round(performance.now() - start) };
  }
  opts.onStatus?.('Running…');
  const output: string[] = [];
  const pushLines = (prefix: string) => (s: string) => {
    for (const line of s.split('\n')) output.push(prefix + line);
  };
  py.setStdout({ batched: pushLines('') });
  py.setStderr({ batched: pushLines('✖ ') });
  const runStart = performance.now();
  try {
    const value = await py.runPythonAsync(code);
    if (value !== undefined && value !== null) {
      const text = typeof value === 'object' && value && 'toString' in value ? String(value) : formatValue(value);
      if (text && text !== 'undefined') output.push(`→ ${text}`);
    }
    return { output, ms: Math.round(performance.now() - runStart) };
  } catch (err) {
    // Pyodide errors carry the full Python traceback in .message; keep the tail.
    const msg = err instanceof Error ? err.message : formatValue(err);
    const lines = msg.trim().split('\n');
    const tail = lines.slice(Math.max(0, lines.length - 8)).join('\n');
    return { output, error: tail, ms: Math.round(performance.now() - runStart) };
  } finally {
    opts.onStatus?.('');
  }
}

// ---------- HTML ----------

/** Compose HTML, CSS and JS into a single srcdoc for a sandboxed iframe. */
export function runHTML(html: string, css?: string, js?: string): string {
  const hasDoc = /<html[\s>]/i.test(html);
  const styleTag = css && css.trim() ? `<style>\n${css}\n</style>` : '';
  // Guard against a "</script>" inside user JS ending the tag early.
  const scriptTag = js && js.trim() ? `<script>\n${js.replace(/<\/script/gi, '<\\/script')}\n</script>` : '';
  if (hasDoc) {
    let out = html;
    if (styleTag) out = /<\/head>/i.test(out) ? out.replace(/<\/head>/i, `${styleTag}\n</head>`) : `${styleTag}\n${out}`;
    if (scriptTag) out = /<\/body>/i.test(out) ? out.replace(/<\/body>/i, `${scriptTag}\n</body>`) : `${out}\n${scriptTag}`;
    return out;
  }
  return `<!doctype html>\n<html>\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n${styleTag}\n</head>\n<body>\n${html}\n${scriptTag}\n</body>\n</html>`;
}

/** Sample page used to preview a CSS-only snippet. */
export const CSS_SAMPLE_HTML = `<h1>Sample heading</h1>
<p>A paragraph of text with a <a href="#">link</a> and <strong>bold</strong> words.</p>
<div class="box">A div with class <code>box</code>.</div>
<ul><li>List item one</li><li>List item two</li></ul>
<button>Button</button> <input placeholder="Input">`;
