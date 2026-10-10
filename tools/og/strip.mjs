// Renders tools/og/strip.html, with the real element on a stepped clock, to the looping README strips in light and dark.
import { chromium } from '@playwright/test';
import gifenc from 'gifenc';
import omggif from 'omggif';
import pngjs from 'pngjs';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const { quantize, applyPalette } = gifenc;
const { GifWriter } = omggif;
const { PNG } = pngjs;
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const STATES = ['working', 'done', 'error', 'warning', 'idle'];
const HOLD = 1600;
const FRAME = 50;
const PASS = STATES.length * HOLD;
const START = PASS + 800;

/* The cast runs the sequence twice and only the second pass is kept: by then every handoff springs from the same place it will spring from on the loop's next turn, so the last frame leads straight back into the first. The window opens half a beat after the handoff into working, so the poster frame is a settled cast. */
const capture = async (browser, scheme) => {
  const page = await browser.newPage({ viewport: { width: 600, height: 136 }, deviceScaleFactor: 2 });
  await page.clock.install({ time: 0 });
  await page.route('http://strip.local/**', async route => {
    const path = join(ROOT, new URL(route.request().url()).pathname);
    await route.fulfill({ body: await readFile(path), contentType: TYPES[extname(path)] });
  });
  await page.goto(`http://strip.local/tools/og/strip.html?scheme=${scheme}`);
  await page.waitForSelector('body[data-ready]');
  await page.clock.pauseAt(60_000);
  const frames = [];
  for (let t = 0; t < START + PASS; t += FRAME) {
    if (t % HOLD === 0) await page.evaluate(s => globalThis.strip.set(s), STATES[(t / HOLD) % STATES.length]);
    await page.evaluate(p => globalThis.strip.progress(p), ((t + FRAME - START) % PASS) / PASS);
    await page.clock.runFor(FRAME);
    if (t >= START) frames.push(PNG.sync.read(await page.screenshot({ type: 'png' })));
  }
  await page.close();
  return frames;
};

/* One global palette from a sample of frames, then every frame after the first is cropped to the pixels that changed and the rest is left transparent over the frame before. That's where most of the file size goes. */
const encode = frames => {
  const { width, height } = frames[0];
  const sample = Buffer.concat(frames.filter((_, i) => i % 8 === 0).map(f => f.data));
  const palette = quantize(sample, 255, { format: 'rgb565' });
  const transparentIndex = palette.length;
  const table = [...palette.map(([r, g, b]) => (r << 16) | (g << 8) | b), 0];
  while (table.length & (table.length - 1)) table.push(0);
  const buf = Buffer.alloc(width * height * frames.length);
  const gif = new GifWriter(buf, width, height, { loop: 0, palette: table });
  let prev = null;
  frames.forEach(({ data }) => {
    const index = applyPalette(data, palette, 'rgb565');
    let x0 = 0,
      y0 = 0,
      x1 = width,
      y1 = height;
    if (prev) {
      ((x0 = width), (y0 = height), (x1 = 0), (y1 = 0));
      for (let y = 0, i = 0, p = 0; y < height; y++)
        for (let x = 0; x < width; x++, i++, p += 4)
          if (data[p] === prev[p] && data[p + 1] === prev[p + 1] && data[p + 2] === prev[p + 2])
            index[i] = transparentIndex;
          else ((x0 = Math.min(x0, x)), (y0 = Math.min(y0, y)), (x1 = Math.max(x1, x + 1)), (y1 = Math.max(y1, y + 1)));
      if (x1 <= x0) ((x0 = y0 = 0), (x1 = y1 = 1));
    }
    const w = x1 - x0,
      h = y1 - y0,
      crop = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) crop.set(index.subarray((y0 + y) * width + x0, (y0 + y) * width + x1), y * w);
    gif.addFrame(x0, y0, w, h, crop, { delay: FRAME / 10, disposal: 1, transparent: prev ? transparentIndex : null });
    prev = data;
  });
  return buf.subarray(0, gif.end());
};

const browser = await chromium.launch();
for (const [scheme, name] of [
  ['light', 'readme.gif'],
  ['dark', 'readme-dark.gif'],
]) {
  const frames = await capture(browser, scheme);
  const bytes = encode(frames);
  await writeFile(join(ROOT, 'tools', 'og', name), bytes);
  console.log(`wrote tools/og/${name} (${frames.length} frames, ${(bytes.length / 1024).toFixed(0)} KB)`);
}
await browser.close();
