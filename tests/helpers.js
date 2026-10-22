import { readFileSync } from 'node:fs';
import { expect } from '@playwright/test';

export const API = JSON.parse(readFileSync(new URL('../src/api.json', import.meta.url)));
const valuesOf = name => Object.keys(API.attributes.find(a => a.name === name).values);
export const TELLS = valuesOf('tell');
export const STATES = valuesOf('state');

export const drawn = page =>
  page.waitForFunction(() =>
    [...document.querySelectorAll('tiny-tell:not([hidden])')]
      .filter(el => el.getBoundingClientRect().width > 0)
      .every(el => el.shadowRoot?.querySelector('[part="tell"]')?.width > 1)
  );
export const open = async (page, { still = false, forced = false, path = '/tests/fixture.html' } = {}) => {
  if (!page.problems) {
    page.on('pageerror', err => page.problems.push(String(err)));
    page.on('console', msg => {
      if (msg.type() === 'error') page.problems.push(msg.text());
    });
  }
  page.problems = [];
  await page.emulateMedia({
    reducedMotion: still ? 'reduce' : 'no-preference',
    forcedColors: forced ? 'active' : 'none',
  });
  await page.goto(path);
  await drawn(page);
};

export const noProblems = ({ page }) => expect(page.problems, 'no page errors or console errors').toEqual([]);
