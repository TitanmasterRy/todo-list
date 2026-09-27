import { describe, expect, it } from 'vitest';
import { strToU8, zipSync, unzipSync } from 'fflate';
import { bundleGame, BundleError, gameEmbedUrl, inlineAssets, looksLikeHtml, normPath, titleFromHtml, titleFromName, titleFromUrl, wrapScript, type InFile } from './gamebundle';

const f = (name: string, s: string | Uint8Array): InFile => ({ name, data: typeof s === 'string' ? strToU8(s) : s });

describe('adding games', () => {
  it('wraps a plain script in a page with a canvas, and keeps </script> inside strings safe', () => {
    const html = wrapScript('const s = "</script>"; draw();', 'Pong <b>');
    expect(html).toContain('<canvas id="game">');
    expect(html).toContain('<title>Pong b</title>');
    expect(html).toContain('"<\\/script>"');
    expect(wrapScript('import x from "./x.js"', 'M', true)).toContain('<script type="module">');
  });
  it('tells HTML from JavaScript and finds titles', () => {
    expect(looksLikeHtml('  <!DOCTYPE html><p>')).toBe(true);
    expect(looksLikeHtml('const x = 1 < 2;')).toBe(false);
    expect(titleFromHtml('<title> Space Run </title>')).toBe('Space Run');
    expect(titleFromName('games/space-run_v2.html')).toBe('Space run v2');
    expect(normPath('./a/../b//c.js')).toBe('b/c.js');
  });
  it('inlines scripts, styles, css url() and images from the other files', () => {
    const files = new Map(
      [
        f('game/main.js', 'console.log("hi")'),
        f('game/css/style.css', 'body{background:url(../img/bg.png)}'),
        f('game/img/bg.png', new Uint8Array([137, 80, 78, 71])),
        f('game/img/hero.png', new Uint8Array([1, 2, 3])),
      ].map((x) => [x.name, x]),
    );
    const page =
      '<html><head><link rel="stylesheet" href="css/style.css"><script src="https://cdn.example.com/lib.js"></script></head><body><img src="img/hero.png"><script src="./main.js"></script><script src="gone.js"></script></body></html>';
    const { html, missing } = inlineAssets(page, 'game/index.html', files);
    expect(html).toContain('<script>\nconsole.log("hi")\n</script>');
    expect(html).toContain('url("data:image/png;base64,iVBORw==")');
    expect(html).toContain('src="data:image/png;base64,AQID"');
    expect(html).toContain('src="https://cdn.example.com/lib.js"');
    expect(missing).toEqual(['gone.js']);
  });
  it('bundles a zipped folder with index.html, and serves runtime-loaded files through the shim', () => {
    const zip = zipSync({
      'MyGame/index.html': strToU8('<html><head><title>Zip Quest</title></head><body><script src="app.js"></script></body></html>'),
      'MyGame/app.js': strToU8('fetch("level.json")'),
      'MyGame/level.json': strToU8('{"a":1}'),
      '__MACOSX/x': strToU8('junk'),
    });
    const entries = Object.entries(unzipSync(zip)).map(([name, data]) => ({ name, data }));
    const { html, title } = bundleGame(entries);
    expect(title).toBe('Zip Quest');
    expect(html).toContain('fetch("level.json")');
    expect(html).toContain('"level.json":"data:application/json;base64,');
  });
  it('builds a page from loose scripts (libraries first) and css', () => {
    const { html, title } = bundleGame([f('game.js', 'start()'), f('lib.js', 'function start(){}'), f('look.css', 'canvas{border:0}')]);
    expect(title).toBe('Game');
    expect(html.indexOf('function start')).toBeLessThan(html.indexOf('start()'));
    expect(html).toContain('canvas{border:0}');
  });
  it('refuses empty or oversized bundles', () => {
    expect(() => bundleGame([f('readme.txt', 'hi')])).toThrow(BundleError);
    expect(() => bundleGame([{ name: 'big.html', data: new Uint8Array(26 * 1024 * 1024) }])).toThrow(/MB/);
  });
  it('turns game links into embeddable ones', () => {
    expect(gameEmbedUrl('https://scratch.mit.edu/projects/123456/')).toBe('https://scratch.mit.edu/projects/123456/embed');
    expect(gameEmbedUrl('https://codepen.io/sam/pen/abcXYZ')).toBe('https://codepen.io/sam/embed/abcXYZ?default-tab=result&editable=false');
    expect(gameEmbedUrl('https://jsfiddle.net/u/abc/')).toBe('https://jsfiddle.net/u/abc/embedded/result/');
    expect(gameEmbedUrl('https://replit.com/@me/game')).toBe('https://replit.com/@me/game?embed=true');
    expect(gameEmbedUrl('https://example.itch.io/cool-game')).toBe('https://example.itch.io/cool-game');
    expect(gameEmbedUrl('http://insecure.example.com')).toBeNull();
    expect(gameEmbedUrl('javascript:alert(1)')).toBeNull();
    expect(titleFromUrl('https://example.itch.io/cool-game')).toBe('Cool game');
    expect(titleFromUrl('https://scratch.mit.edu/projects/123/embed')).toBe('Scratch');
  });
});
