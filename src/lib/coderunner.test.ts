import { describe, expect, it } from 'vitest';
import { canRun, formatValue, runHTML, CSS_SAMPLE_HTML } from './coderunner';

describe('formatValue', () => {
  it('passes strings through unchanged', () => {
    expect(formatValue('hi')).toBe('hi');
    expect(formatValue('')).toBe('');
  });
  it('stringifies primitives', () => {
    expect(formatValue(42)).toBe('42');
    expect(formatValue(1.5)).toBe('1.5');
    expect(formatValue(true)).toBe('true');
    expect(formatValue(10n)).toBe('10');
    expect(formatValue(NaN)).toBe('NaN');
  });
  it('handles undefined and null', () => {
    expect(formatValue(undefined)).toBe('undefined');
    expect(formatValue(null)).toBe('null');
  });
  it('JSON-encodes objects and arrays', () => {
    expect(formatValue({ a: 1, b: 'x' })).toBe('{"a":1,"b":"x"}');
    expect(formatValue([1, 2, 3])).toBe('[1,2,3]');
    expect(formatValue([1, [2, { c: null }]])).toBe('[1,[2,{"c":null}]]');
  });
  it('encodes maps, sets, bigints and nested undefined inside objects', () => {
    expect(formatValue(new Map([['k', 1]]))).toBe('{"k":1}');
    expect(formatValue(new Set([1, 2]))).toBe('[1,2]');
    expect(formatValue({ n: 5n })).toBe('{"n":"5n"}');
    expect(formatValue({ u: undefined })).toBe('{"u":"undefined"}');
  });
  it('uses the message for errors', () => {
    expect(formatValue(new Error('boom'))).toBe('boom');
    expect(formatValue(new TypeError('bad type'))).toBe('bad type');
    expect(formatValue(new Error(''))).toBe('Error');
  });
  it('describes functions', () => {
    function named() {}
    expect(formatValue(named)).toBe('[Function: named]');
    expect(formatValue(() => {})).toMatch(/^\[Function/);
  });
  it('does not throw on circular structures', () => {
    const o: Record<string, unknown> = {};
    o.self = o;
    expect(formatValue(o)).toBe('[object Object]');
  });
});

describe('runHTML', () => {
  it('wraps a fragment in a full document', () => {
    const doc = runHTML('<p>hi</p>');
    expect(doc.startsWith('<!doctype html>')).toBe(true);
    expect(doc).toContain('<meta charset="utf-8">');
    expect(doc).toContain('<body>\n<p>hi</p>');
    expect(doc).not.toContain('<style>');
    expect(doc).not.toContain('<script>');
  });
  it('adds style and script tags when css and js are given', () => {
    const doc = runHTML('<p>hi</p>', 'p { color: red }', 'console.log(1)');
    expect(doc).toContain('<style>\np { color: red }\n</style>');
    expect(doc).toContain('<script>\nconsole.log(1)\n</script>');
    expect(doc.indexOf('<style>')).toBeLessThan(doc.indexOf('</head>'));
    expect(doc.indexOf('<script>')).toBeGreaterThan(doc.indexOf('<p>hi</p>'));
    expect(doc.indexOf('<script>')).toBeLessThan(doc.indexOf('</body>'));
  });
  it('ignores blank css and js', () => {
    const doc = runHTML('<p>hi</p>', '   ', '\n');
    expect(doc).not.toContain('<style>');
    expect(doc).not.toContain('<script>');
  });
  it('injects into an existing full document instead of wrapping it', () => {
    const src = '<html><head><title>t</title></head><body><p>x</p></body></html>';
    const doc = runHTML(src, 'p{}', 'alert(1)');
    expect(doc.match(/<html/g)?.length).toBe(1);
    expect(doc).toContain('<title>t</title><style>\np{}\n</style>\n</head>');
    expect(doc).toContain('<p>x</p><script>\nalert(1)\n</script>\n</body>');
  });
  it('escapes a closing script tag inside user js', () => {
    const doc = runHTML('<p></p>', undefined, 'const s = "</script>";');
    expect(doc).not.toContain('"</script>"');
    expect(doc).toContain('<\\/script>');
  });
  it('can preview css against the sample page', () => {
    const doc = runHTML(CSS_SAMPLE_HTML, 'h1 { color: blue }');
    expect(doc).toContain('Sample heading');
    expect(doc).toContain('h1 { color: blue }');
  });
});

describe('canRun', () => {
  it('runs js, ts, python, html and css but not java or cpp', () => {
    expect(canRun('javascript')).toBe(true);
    expect(canRun('typescript')).toBe(true);
    expect(canRun('python')).toBe(true);
    expect(canRun('html')).toBe(true);
    expect(canRun('css')).toBe(true);
    expect(canRun('java')).toBe(false);
    expect(canRun('cpp')).toBe(false);
  });
});
