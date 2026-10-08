// Renders tools/og/card.html, with the real element in its still poses, to the social card every page shares.
import { chromium } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'light' });
await page.route('http://card.local/**', async route => {
  const path = join(ROOT, new URL(route.request().url()).pathname);
  await route.fulfill({ body: await readFile(path), contentType: TYPES[extname(path)] });
});
await page.goto('http://card.local/tools/og/card.html');
await page.waitForSelector('body[data-ready]');
await page.screenshot({ path: join(ROOT, 'tools', 'og', 'og.png') });
console.log('wrote tools/og/og.png');
await browser.close();
