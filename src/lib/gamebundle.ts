// "Add a game": turn whatever the user drops in (an .html file, a .js file, a .zip of a web game, several loose
// files, pasted code, or a link) into one self-contained HTML page for the sandboxed arcade player.
// Relative scripts, styles, images, sounds and fonts are inlined (scripts and styles as text, the rest as data:
// URLs), so the game needs nothing from the network. Pure (no DOM), so it's unit-tested.

export interface InFile {
  name: string; // path inside a zip, or a file name
  data: Uint8Array;
}

export const MAX_GAME_BYTES = 25 * 1024 * 1024;

const MIME: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  ico: 'image/x-icon',
  bmp: 'image/bmp',
  mp3: 'audio/mpeg',
  ogg: 'audio/ogg',
  wav: 'audio/wav',
  m4a: 'audio/mp4',
  mp4: 'video/mp4',
  webm: 'video/webm',
  woff: 'font/woff',
  woff2: 'font/woff2',
  ttf: 'font/ttf',
  otf: 'font/otf',
  json: 'application/json',
  wasm: 'application/wasm',
  js: 'text/javascript',
  mjs: 'text/javascript',
  css: 'text/css',
  html: 'text/html',
  htm: 'text/html',
  txt: 'text/plain',
};

const ext = (name: string) => /\.([a-z0-9]+)$/i.exec(name)?.[1].toLowerCase() ?? '';
export const mimeOf = (name: string) => MIME[ext(name)] ?? 'application/octet-stream';
const text = (d: Uint8Array) => new TextDecoder().decode(d);

function toBase64(d: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < d.length; i += 0x8000) bin += String.fromCharCode(...d.subarray(i, i + 0x8000));
  return btoa(bin);
}
const dataUrl = (f: InFile) => `data:${mimeOf(f.name)};base64,${toBase64(f.data)}`;

/** Normalize a path: forward slashes, no leading ./ or /, resolve .. */
export function normPath(p: string): string {
  const out: string[] = [];
  for (const part of p.replace(/\\/g, '/').split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') out.pop();
    else out.push(part);
  }
  return out.join('/');
}
const dirOf = (p: string) => (p.includes('/') ? p.slice(0, p.lastIndexOf('/') + 1) : '');
const isRemote = (ref: string) => /^([a-z][a-z0-9+.-]*:|\/\/|#)/i.test(ref);

/** A plain script as a full-screen game page with a canvas ready to draw on (id="game"). */
export function wrapScript(js: string, title = 'Game', module = false): string {
  const safeTitle = title.replace(/[<>&"]/g, '');
  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${safeTitle}</title>
<style>html,body{margin:0;height:100%;background:#111;color:#eee;font-family:system-ui,sans-serif;overflow:hidden}canvas#game{display:block;width:100%;height:100%}</style>
</head><body><canvas id="game"></canvas>
<script>(function(){var c=document.getElementById('game');function fit(){c.width=innerWidth*devicePixelRatio;c.height=innerHeight*devicePixelRatio}fit();addEventListener('resize',fit)})();</script>
<script${module ? ' type="module"' : ''}>
${js.replace(/<\/script/gi, '<\\/script')}
</script></body></html>`;
}

/** Does pasted code look like HTML (vs. JavaScript)? */
export function looksLikeHtml(code: string): boolean {
  return /^\s*(<!doctype|<html|<head|<body|<canvas|<div|<script|<style|<svg|<!--)/i.test(code);
}

export function titleFromHtml(html: string): string {
  const m = /<title[^>]*>([^<]{1,80})<\/title>/i.exec(html);
  return m ? m[1].trim() : '';
}

export function titleFromName(name: string): string {
  const base = name.replace(/^.*[\\/]/, '').replace(/\.(html?|js|mjs|zip)$/i, '');
  const t = base.replace(/[-_.]+/g, ' ').trim();
  return t ? t[0].toUpperCase() + t.slice(1) : 'My game';
}

/**
 * Inline every relative reference in an HTML page from the other files. Unknown files are left as they are
 * (they'll just fail to load, like on any host).
 */
export function inlineAssets(html: string, htmlPath: string, files: Map<string, InFile>): { html: string; missing: string[] } {
  const base = dirOf(htmlPath);
  const missing = new Set<string>();
  const find = (ref: string, from = base): InFile | undefined => {
    const clean = ref.split(/[?#]/)[0];
    try {
      return files.get(normPath(from + decodeURIComponent(clean)));
    } catch {
      return files.get(normPath(from + clean));
    }
  };
  const cssInline = (css: string, cssPath: string) =>
    css.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g, (all, _q, ref: string) => {
      if (isRemote(ref) || ref.startsWith('data:')) return all;
      const f = find(ref, dirOf(cssPath));
      if (!f) {
        missing.add(ref);
        return all;
      }
      return `url("${dataUrl(f)}")`;
    });

  // <script src="x.js"></script> → inline
  let out = html.replace(/<script\b([^>]*?)\bsrc\s*=\s*(['"])([^'"]+)\2([^>]*)>\s*<\/script>/gi, (all, pre: string, _q, ref: string, post: string) => {
    if (isRemote(ref)) return all;
    const f = find(ref);
    if (!f) {
      missing.add(ref);
      return all;
    }
    const attrs = `${pre} ${post}`.replace(/\s+/g, ' ').trim();
    return `<script${attrs ? ' ' + attrs : ''}>\n${text(f.data).replace(/<\/script/gi, '<\\/script')}\n</script>`;
  });
  // <link rel="stylesheet" href="x.css"> → <style>
  out = out.replace(/<link\b[^>]*>/gi, (tag) => {
    if (!/rel\s*=\s*(['"]?)stylesheet\1/i.test(tag)) return tag;
    const ref = /href\s*=\s*(['"])([^'"]+)\1/i.exec(tag)?.[2];
    if (!ref || isRemote(ref)) return tag;
    const f = find(ref);
    if (!f) {
      missing.add(ref);
      return tag;
    }
    return `<style>\n${cssInline(text(f.data), normPath(base + ref))}\n</style>`;
  });
  // inline <style> blocks' url(...)
  out = out.replace(/<style\b([^>]*)>([\s\S]*?)<\/style>/gi, (_all, attrs: string, css: string) => `<style${attrs}>${cssInline(css, htmlPath)}</style>`);
  // src= / href= (icons) / poster= on media and images → data: URLs
  out = out.replace(/\b(src|poster|href)\s*=\s*(['"])([^'"]+)\2/gi, (all, attr: string, q: string, ref: string) => {
    if (isRemote(ref) || ref.startsWith('data:')) return all;
    if (attr.toLowerCase() === 'href' && !/\.(png|jpe?g|gif|webp|svg|ico)$/i.test(ref.split(/[?#]/)[0])) return all;
    const f = find(ref);
    if (!f) {
      if (/\.[a-z0-9]{2,5}$/i.test(ref.split(/[?#]/)[0])) missing.add(ref);
      return all;
    }
    return `${attr}=${q}${dataUrl(f)}${q}`;
  });
  return { html: out, missing: [...missing] };
}

/**
 * Other files the game loads from JavaScript at runtime (fetch('level1.json'), new Audio('boom.mp3'), images by
 * name) can't be rewritten safely, so they're offered through a tiny shim: fetch/XHR/Image/Audio of a relative
 * path that matches a bundled file get the data: URL instead.
 */
export function runtimeShim(files: InFile[], used: Set<string>): string {
  const map: Record<string, string> = {};
  let bytes = 0;
  for (const f of files) {
    if (used.has(f.name) || /\.(html?)$/i.test(f.name)) continue;
    if (bytes + f.data.length > 12 * 1024 * 1024) break;
    bytes += f.data.length;
    map[f.name] = dataUrl(f);
  }
  if (!Object.keys(map).length) return '';
  return `<script>(function(){var M=${JSON.stringify(map)};function r(u){if(typeof u!=='string')return u;var k=u.split(/[?#]/)[0].replace(/^\\.\\//,'');return M[k]||M[decodeURIComponent(k)]||u}
var F=window.fetch;window.fetch=function(u,o){return F.call(this,typeof u==='string'?r(u):u,o)};
var X=XMLHttpRequest.prototype.open;XMLHttpRequest.prototype.open=function(m,u){arguments[1]=r(u);return X.apply(this,arguments)};
var d=Object.getOwnPropertyDescriptor(HTMLImageElement.prototype,'src');Object.defineProperty(HTMLImageElement.prototype,'src',{get:d.get,set:function(v){d.set.call(this,r(v))}});
var d2=Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype,'src');Object.defineProperty(HTMLMediaElement.prototype,'src',{get:d2.get,set:function(v){d2.set.call(this,r(v))}});
var A=window.Audio;window.Audio=function(u){return new A(r(u))};window.Audio.prototype=A.prototype;})();</script>`;
}

export class BundleError extends Error {}

/** Build one HTML page from dropped files (loose files or the entries of a zip). */
export function bundleGame(input: InFile[]): { html: string; title: string; missing: string[] } {
  const files = input.filter((f) => !/(^|\/)(__MACOSX|\.DS_Store|Thumbs\.db)/.test(f.name)).map((f) => ({ ...f, name: normPath(f.name) }));
  const total = files.reduce((a, f) => a + f.data.length, 0);
  if (total > MAX_GAME_BYTES) throw new BundleError(`That's ${(total / 1048576).toFixed(0)} MB; games can be up to ${MAX_GAME_BYTES / 1048576} MB.`);
  // if everything sits in one top folder (a zipped folder), treat that folder as the root
  const tops = new Set(files.map((f) => (f.name.includes('/') ? f.name.split('/')[0] : '')));
  if (tops.size === 1 && !tops.has('')) {
    const top = [...tops][0] + '/';
    for (const f of files) f.name = f.name.slice(top.length);
  }
  const byPath = new Map(files.map((f) => [f.name, f]));
  const htmls = files.filter((f) => /\.html?$/i.test(f.name)).sort((a, b) => a.name.split('/').length - b.name.split('/').length);
  const entry = htmls.find((f) => /(^|\/)index\.html?$/i.test(f.name)) ?? htmls[0];
  if (entry) {
    const src = text(entry.data);
    const { html, missing } = inlineAssets(src, entry.name, byPath);
    const used = new Set([entry.name, ...[...byPath.keys()].filter((k) => html.includes(k) === false && src.includes(k))]);
    const shim = runtimeShim(files, used);
    const withShim = shim ? (/<head[^>]*>/i.test(html) ? html.replace(/<head[^>]*>/i, (h) => h + shim) : shim + html) : html;
    return { html: withShim, title: titleFromHtml(src) || titleFromName(entry.name), missing };
  }
  const scripts = files.filter((f) => /\.(m?js)$/i.test(f.name));
  if (!scripts.length) throw new BundleError('Add an .html file, a .js file, or a .zip with an index.html inside.');
  // several scripts without a page: main/game/index last, the rest (libraries) first
  const rank = (n: string) => (/(^|\/)(main|game|index|app)\.m?js$/i.test(n) ? 1 : 0);
  scripts.sort((a, b) => rank(a.name) - rank(b.name));
  const css = files.filter((f) => /\.css$/i.test(f.name)).map((f) => text(f.data));
  const module = scripts.some((f) => /\.mjs$/i.test(f.name) || /^\s*(import|export)\s/m.test(text(f.data)));
  let html = wrapScript(scripts.map((f) => text(f.data)).join('\n;\n'), titleFromName(scripts[scripts.length - 1].name), module);
  if (css.length) html = html.replace('</head>', `<style>${css.join('\n')}</style></head>`);
  const shim = runtimeShim(files, new Set(scripts.map((f) => f.name)));
  if (shim) html = html.replace(/<head>/, `<head>${shim}`);
  return { html, title: titleFromName(scripts[scripts.length - 1].name), missing: [] };
}

/** Turn a pasted game link into something that can be embedded (known sites), or null if it isn't an https link. */
export function gameEmbedUrl(input: string): string | null {
  let u: URL;
  try {
    u = new URL(input.trim());
  } catch {
    return null;
  }
  if (u.protocol !== 'https:') return null;
  const h = u.hostname.replace(/^www\./, '');
  // Scratch: /projects/123 → /projects/123/embed
  let m = /^\/projects\/(\d+)/.exec(u.pathname);
  if (h === 'scratch.mit.edu' && m) return `https://scratch.mit.edu/projects/${m[1]}/embed`;
  // CodePen: /user/pen/ID → /user/embed/ID?default-tab=result
  m = /^\/([^/]+)\/(?:pen|full|details)\/([^/?#]+)/.exec(u.pathname);
  if (h === 'codepen.io' && m) return `https://codepen.io/${m[1]}/embed/${m[2]}?default-tab=result&editable=false`;
  // JSFiddle: add /embedded/result/
  if (h === 'jsfiddle.net' && !u.pathname.includes('/embedded/')) return `https://jsfiddle.net${u.pathname.replace(/\/$/, '')}/embedded/result/`;
  // Replit: ?embed=true
  if (h === 'replit.com' && !u.searchParams.has('embed')) {
    u.searchParams.set('embed', 'true');
    return u.href;
  }
  // Khan Academy computer programs
  m = /^\/computer-programming\/[^/]+\/(\d+)/.exec(u.pathname);
  if (h === 'khanacademy.org' && m) return `https://www.khanacademy.org/computer-programming/embed/${m[1]}`;
  // Google Drive file → preview
  m = /^\/file\/d\/([^/]+)/.exec(u.pathname);
  if (h === 'drive.google.com' && m) return `https://drive.google.com/file/d/${m[1]}/preview`;
  return u.href;
}

/** Name a game from its link. */
export function titleFromUrl(url: string): string {
  try {
    const u = new URL(url);
    const last = u.pathname
      .split('/')
      .filter((p) => p && !/^(embed|projects|pen|full|embedded|result|\d+)$/.test(p))
      .pop();
    return titleFromName(last ?? u.hostname.replace(/^www\./, '').split('.')[0]);
  } catch {
    return 'My game';
  }
}
