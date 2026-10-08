// Renders tools/favicon/favicon.svg to the PNG fallback and the iOS home screen icon. The build copies all three into the site.
import { chromium } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const svg = await readFile(join(HERE, 'favicon.svg'), 'utf8');
const face = svg.match(/<rect[^>]*stroke[^>]*\/>/)[0];
/* iOS rounds the corners of a full square, so the face becomes the whole icon and the eyes sit centered on it. */
const eyes = svg.replace(face, '').replace('viewBox="0 0 32 32"', 'viewBox="3 2 28 28"');

const browser = await chromium.launch();
for (const [file, size, html] of [
  ['favicon-32.png', 32, svg],
  [
    'apple-touch-icon.png',
    180,
    `<div style="display:grid;place-items:center;width:180px;height:180px;background:#23262c">${eyes.replace('<svg', '<svg width="180" height="180"')}</div>`,
  ],
]) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(
    `<style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${html}`
  );
  await page.screenshot({ path: join(HERE, file), omitBackground: true });
  console.log(`wrote tools/favicon/${file}`);
  await page.close();
}
await browser.close();
