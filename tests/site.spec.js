import { test, expect } from '@playwright/test';
import { noProblems, open } from './helpers.js';

const revealed = page => page.waitForFunction(() => !('upgrading' in document.documentElement.dataset));

// Font Awesome's kit only serves its allowed hosts (locally, just port 4173), and outages there or at Umami aren't our bug.
const offline = ({ page }) =>
  Promise.all([
    page.route('https://ka-p.fontawesome.com/**', route =>
      route.fulfill({
        contentType: 'image/svg+xml',
        body: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"/>',
      })
    ),
    page.route('https://cloud.umami.is/**', route => route.fulfill({ contentType: 'text/javascript', body: '' })),
  ]);

test.describe('site pages', () => {
  test.beforeEach(offline);
  test.afterEach(noProblems);

  test('landing, docs, and 404 load, define every wa-* element, and switch theme without errors', async ({ page }) => {
    await page.addInitScript(() => {
      window.windowErrors = [];
      addEventListener('error', e => window.windowErrors.push(e.message));
    });
    for (const path of ['/', '/docs/', '/404.html']) {
      await open(page, { path });
      await expect
        .poll(
          () =>
            page.evaluate(() => [
              ...new Set(
                [...document.querySelectorAll(':not(:defined)')]
                  .map(el => el.localName)
                  .filter(name => name.startsWith('wa-'))
              ),
            ]),
          { message: `${path} defines every wa-* element` }
        )
        .toEqual([]);
      const html = page.locator('html');
      await expect(html, `${path} applies a theme`).toHaveAttribute('data-theme', /^(light|dark)$/);
      const before = await html.getAttribute('data-theme');
      await page.locator('#theme').click();
      await expect(html, `${path} flips the theme`).not.toHaveAttribute('data-theme', before);
      expect(await page.evaluate(() => window.windowErrors), `${path} raises no window errors`).toEqual([]);
    }
  });

  test('?stats=off opts the browser out of Umami, and ?stats=on puts it back', async ({ page }) => {
    const flag = () => page.evaluate(() => localStorage.getItem('umami.disabled'));
    await open(page, { path: '/docs/?stats=off#stats' });
    await page.waitForURL(/\/docs\/#stats$/);
    expect(await flag(), 'off sets the key Umami checks before every send, and drops the param').toBe('1');
    await open(page, { path: '/?stats=on' });
    await page.waitForURL(url => url.search === '');
    expect(await flag(), 'on clears it again').toBeNull();
  });

  test('docs headings are named by their own text, and the contrast note describes the current palette', async ({
    page,
  }) => {
    await open(page, { path: '/docs/' });
    await expect
      .poll(() => page.locator('#a11y-contrast-now').textContent(), {
        message: 'the contrast note gives the current palette’s lowest ratios',
      })
      .toMatch(/[\d.]+:1 on light and [\d.]+:1 on dark/);
    const cdp = await page.context().newCDPSession(page);
    const names = (await cdp.send('Accessibility.getFullAXTree')).nodes
      .filter(node => node.role?.value === 'heading' && !node.ignored)
      .map(node => node.name?.value ?? '');
    expect(names.length, 'the docs have headings').toBeGreaterThan(10);
    expect(
      names.filter(name => name.includes('Link to')),
      'no heading name includes its anchor link'
    ).toEqual([]);
  });

  test('Tap Tempo hands the speed back once the tapping stops, and announces the tempo once', async ({ page }) => {
    await open(page, { path: '/docs/' });
    const tap = page.locator('#tap');
    await tap.scrollIntoViewIfNeeded();
    for (let i = 0; i < 4; i++) await tap.click();
    const speed = () => page.evaluate(() => customElements.get('tiny-tell').timeScale);
    const status = page.locator('#funsies [role="status"]');
    expect(await speed(), 'quick taps speed the tells up').toBeGreaterThan(1);
    expect((await status.textContent()).trim(), 'nothing is announced while the taps keep coming').toBe('');
    await expect(status, 'the tempo is announced once the tapping stops').toContainText('BPM');
    await expect.poll(speed, { message: 'the speed eases back to 1 once tapping stops' }).toBe(1);
    await tap.click();
    await expect(status, 'a new round clears it, so the same tempo is announced again').toBeEmpty();
  });

  test('the Prompt install method shows the paste-in prompt, and the docs fall back to npm', async ({ page }) => {
    await open(page, { path: '/#install' });
    await page.locator('#b-method wa-radio[value="prompt"]').click();
    await expect(page.locator('#b-install'), 'the prompt replaces the install command').toContainText('llms.txt');
    await expect(
      page.locator('.self-host'),
      'self-hosting is beside the point once an assistant installs it'
    ).toBeHidden();

    await open(page, { path: '/docs/' });
    await expect
      .poll(() => page.evaluate(() => document.querySelector('#docs-install wa-tab-panel[name="npm"]').active), {
        message: 'the docs have no Prompt tab, so they open on npm instead of showing no panel',
      })
      .toBe(true);

    await open(page, { path: '/#install' });
    await expect(page.locator('#b-install'), 'visiting the docs keeps the landing on Prompt').toContainText('llms.txt');
  });

  test('a builder link restores the tag it was copied from, and ignores values it does not know', async ({ page }) => {
    const code = page.locator('.b-code');
    const link = () => page.evaluate(() => document.getElementById('b-link').value);
    const linkParams = async () => Object.fromEntries(new URL(await link()).searchParams);

    await open(page, { path: '/?tell=lens&state=done&size=24&words=Backed%20up%2012%20photos.#drop-one-in' });
    await expect(code, 'the linked tell').toContainText('tell="lens"');
    await expect(code, 'the linked state').toContainText('state="done"');
    await expect(code, 'the linked size').toContainText('--tell-size: 1.5rem');
    await expect(code, 'the linked words').toContainText('Backed up 12 photos.');
    await expect
      .poll(linkParams, { message: 'the copy link reproduces the same setup' })
      .toEqual({ tell: 'lens', state: 'done', size: '24', words: 'Backed up 12 photos.' });
    expect(new URL(await link()).hash, 'the copy link lands on the builder').toBe('#drop-one-in');
    await page.locator('#b-state wa-radio[value="error"]').click();
    await expect(code, 'linked words survive a state change').toContainText('Backed up 12 photos.');

    await open(page, { path: '/#drop-one-in' });
    await page.locator('#b-state wa-radio[value="done"]').click();
    const picked = await page.locator('#b-words').evaluate(el => el.value);
    await open(page, { path: new URL(await link()).pathname + new URL(await link()).search });
    await expect(code, 'a link copied after picking a state shows the same example words').toContainText(picked);

    await open(page, {
      path: '/?tell=nope&state=nope&size=999&words=%3Cimg%20src%3Dx%20onerror%3Dalert(1)%3E#drop-one-in',
    });
    await expect(code, 'an unknown tell falls back to the default').toContainText('tell="drones"');
    await expect(code, 'an unknown state falls back to working').toContainText('state="working"');
    await expect(code, 'an unknown size falls back to matching the text').not.toContainText('--tell-size');
    await expect(code, 'markup in linked words shows as text').toContainText('&lt;img src=x onerror=alert(1)&gt;');
    expect(await page.locator('#b-preview img').count(), 'markup in linked words never renders').toBe(0);
  });
});

// Firefox's scroll anchoring once kept a #section link from landing, so links run in every engine.
test.describe('docs links', { tag: '@engines' }, () => {
  test.beforeEach(offline);
  test.afterEach(noProblems);

  test('a docs link to a section lands where the section scrolls to, below the sticky header', async ({ page }) => {
    await open(page, { path: '/docs/#testing' });
    await revealed(page);
    const { landed, header, settled } = await page.evaluate(() => {
      const target = document.getElementById('testing');
      const landed = target.getBoundingClientRect().top;
      const header = document
        .querySelector('wa-page')
        .shadowRoot.querySelector('[part~="header"]')
        .getBoundingClientRect()
        .toJSON();
      target.scrollIntoView({ behavior: 'instant' });
      return { landed, header, settled: target.getBoundingClientRect().top };
    });
    expect(landed, 'the section is not under the header').toBeGreaterThanOrEqual(header.bottom - 1);
    expect(landed - header.bottom, 'the gap under the header doesn’t count the header twice').toBeLessThan(
      header.height
    );
    expect(Math.abs(landed - settled), 'the page opened where the section scrolls to').toBeLessThan(2);
  });
});

// WebKit's modal and scroll anchoring behave differently here, so the drawer runs in every engine.
test.describe('docs drawer', { tag: '@engines' }, () => {
  test.beforeEach(offline);
  test.afterEach(noProblems);

  test('the mobile docs drawer opens without moving the page, and a far link glides into place once it closes', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await open(page, { path: '/docs/#states' });
    await revealed(page);
    // Scrolling there again sets the baseline, whatever the load landed on.
    await page.evaluate(() => document.getElementById('states').scrollIntoView({ behavior: 'instant' }));
    const statesTop = () => page.evaluate(() => document.getElementById('states').getBoundingClientRect().top);
    const before = await statesTop();
    await page.evaluate(() => {
      window.order = [];
      addEventListener('hashchange', () => window.order.push('hash'));
      document.querySelector('wa-page').addEventListener('wa-after-hide', () => window.order.push('hidden'));
    });
    // A locator click scrolls the sticky toggle into view first, which moves the page on its own.
    await page.locator('.nav-toggle').dispatchEvent('click');
    const link = page.getByRole('navigation', { name: 'Docs' }).getByRole('link', { name: 'API' });
    await expect(link, 'the drawer opens').toBeVisible();
    expect(Math.abs((await statesTop()) - before), 'the page behind the open drawer stays put').toBeLessThan(2);
    await link.click();
    await expect(link, 'the drawer closes').toBeHidden();
    const apiTop = () => page.evaluate(() => document.getElementById('api').getBoundingClientRect().top);
    await expect
      .poll(async () => Math.abs((await apiTop()) - before), {
        message: 'the page glides the section into place once the drawer is gone',
      })
      .toBeLessThan(2);
    expect(await page.evaluate(() => window.order), 'the address changes only after the drawer is gone').toEqual([
      'hidden',
      'hash',
    ]);
    await expect(page, 'the link still updates the address').toHaveURL(/#api$/);
    const drift = await page.evaluate(() => {
      const target = document.getElementById('api'),
        landed = target.getBoundingClientRect().top;
      target.scrollIntoView({ behavior: 'instant' });
      return Math.abs(landed - target.getBoundingClientRect().top);
    });
    expect(drift, 'the section lands where it scrolls to').toBeLessThan(2);
    await expect(page.locator('#funsies-title'), 'sections set aside behind the drawer come back').toBeVisible();
  });
});
