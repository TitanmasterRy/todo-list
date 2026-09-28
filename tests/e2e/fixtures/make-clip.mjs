// Regenerates tests/e2e/fixtures/clip.webm (a two-second VP8 clip for the Watch spec) with the test browser's
// MediaRecorder:  PW_CHROMIUM=/path/to/chrome node tests/e2e/fixtures/make-clip.mjs
import { chromium } from '@playwright/test';
import { writeFileSync } from 'node:fs';

const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
const page = await browser.newPage();
const b64 = await page.evaluate(async () => {
  const canvas = Object.assign(document.createElement('canvas'), { width: 64, height: 36 });
  const ctx = canvas.getContext('2d');
  const rec = new MediaRecorder(canvas.captureStream(15), { mimeType: 'video/webm;codecs=vp8', videoBitsPerSecond: 50_000 });
  const chunks = [];
  rec.ondataavailable = (e) => chunks.push(e.data);
  const done = new Promise((r) => (rec.onstop = r));
  rec.start();
  const t0 = performance.now();
  await new Promise((resolve) => {
    const draw = () => {
      const t = performance.now() - t0;
      ctx.fillStyle = `hsl(${(t / 10) % 360} 70% 50%)`;
      ctx.fillRect(0, 0, 64, 36);
      if (t < 2000) requestAnimationFrame(draw);
      else resolve();
    };
    draw();
  });
  rec.stop();
  await done;
  const buf = new Uint8Array(await new Blob(chunks, { type: 'video/webm' }).arrayBuffer());
  let s = '';
  for (const b of buf) s += String.fromCharCode(b);
  return btoa(s);
});
writeFileSync(new URL('./clip.webm', import.meta.url), Buffer.from(b64, 'base64'));
await browser.close();
