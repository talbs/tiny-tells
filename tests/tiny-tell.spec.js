import { readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const API = JSON.parse(readFileSync(new URL('../dist/custom-elements.json', import.meta.url))).modules[0]
  .declarations[0];
const valuesOf = name => [...API.attributes.find(a => a.name === name).type.text.matchAll(/'([^']+)'/g)].map(m => m[1]);
const SKINS = valuesOf('skin');
const STATES = valuesOf('state');

const pixels = (page, selector) =>
  page.$eval(selector, el => {
    const cv = el.shadowRoot.querySelector('[part="tell"]'),
      d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
    let alpha = 0,
      solid = 0,
      r = 0,
      g = 0,
      b = 0;
    for (let i = 0; i < d.length; i += 4) {
      alpha += d[i + 3];
      if (d[i + 3] > 200) {
        r += d[i];
        g += d[i + 1];
        b += d[i + 2];
        solid++;
      }
    }
    const n = solid || 1;
    return {
      alpha,
      r: r / n,
      g: g / n,
      b: b / n,
      lum: (r + g + b) / 3 / n,
      w: cv.width,
      h: cv.height,
      css: el.getBoundingClientRect().width,
      dpr: devicePixelRatio,
    };
  });
const frame = (page, selector) => page.$eval(selector, el => el.shadowRoot.querySelector('[part="tell"]').toDataURL());
const twoFrames = page => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
const drawn = page =>
  page.waitForFunction(() =>
    [...document.querySelectorAll('tiny-tell:not([hidden])')]
      .filter(el => el.getBoundingClientRect().width > 0)
      .every(el => el.shadowRoot?.querySelector('[part="tell"]')?.width > 1)
  );
const open = async (page, { still = false, forced = false, path = '/tests/fixture.html' } = {}) => {
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

const hue = (page, selector) =>
  page.$eval(selector, el => {
    const cv = el.shadowRoot.querySelector('[part="tell"]'),
      d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
    let most = -255;
    for (let i = 0; i < d.length; i += 4)
      if (d[i + 3] > 200) most = Math.max(most, d[i + 2] - Math.max(d[i], d[i + 1]));
    return most;
  });
const tap5 = async (page, selector) => {
  for (let i = 0; i < 5; i++) await page.locator(selector).click();
};

const settled = async (page, selector) => {
  let last = await frame(page, selector);
  for (let i = 0; i < 90; i++) {
    await twoFrames(page);
    const next = await frame(page, selector);
    if (next === last) return next;
    last = next;
  }
  throw new Error(`${selector} never settled`);
};

const noProblems = ({ page }) => expect(page.problems, 'no page errors or console errors').toEqual([]);

test.describe('in motion', () => {
  test.beforeEach(({ page }) => open(page));
  test.afterEach(noProblems);

  test('an unpaused tell moves', async ({ page }) => {
    const a = await frame(page, '[data-skin="drones"]');
    await expect
      .poll(() => frame(page, '[data-skin="drones"]'), { message: 'a running tell draws a new frame' })
      .not.toBe(a);
  });

  test('paused freezes the frame', async ({ page }) => {
    await page.$eval('[data-skin="drones"]', el => {
      el.paused = true;
    });
    const a = await frame(page, '[data-skin="drones"]');
    await twoFrames(page);
    expect(await frame(page, '[data-skin="drones"]'), 'a paused tell draws the same frame twice').toBe(a);
  });

  test('a property set before the element was defined still takes effect', async ({ page }) => {
    expect(await page.$eval('#early', el => el.getAttribute('state')), 'the early state reflects after upgrade').toBe(
      'error'
    );
    await expect(
      page.locator('#early').getByRole('img', { name: 'Error' }),
      'the early state names the tell'
    ).toHaveCount(1);
  });

  test('unknown skins and states warn and fall back to drones and working', async ({ page }) => {
    const warnings = [];
    page.on('console', msg => {
      if (msg.type() === 'warning') warnings.push(msg.text());
    });
    await page.evaluate(() =>
      document.body.insertAdjacentHTML('beforeend', '<tiny-tell id="typo" skin="nope"></tiny-tell>')
    );
    await page.$eval('[data-skin="eyes"]', el => {
      el.state = 'nope';
    });
    await expect.poll(() => warnings.join('\n'), 'an unknown skin warns').toContain('unknown skin "nope"');
    expect(warnings.join('\n'), 'an unknown state warns').toContain('unknown state "nope"');
    await drawn(page);
    expect((await pixels(page, '#typo')).alpha, 'an unknown skin still draws the fallback').toBeGreaterThan(0);
  });

  test('moving a tell keeps its animation going instead of restarting it', async ({ page }) => {
    // Run the clock a while first, so a restart would visibly jump back to the first pose.
    for (let i = 0; i < 20; i++) await twoFrames(page);
    await page.evaluate(() => {
      customElements.get('tiny-tell').timeScale = 0;
    });
    const before = await settled(page, '[data-skin="eyes"]');
    await page.$eval('[data-skin="eyes"]', el => el.parentElement.append(el));
    expect(await settled(page, '[data-skin="eyes"]'), 'a moved tell draws the same pose it had').toBe(before);
  });

  test('the core bundle ignores the pointer and taps', async ({ page }) => {
    await page.evaluate(() => {
      customElements.get('tiny-tell').timeScale = 0;
    });
    const before = await settled(page, '#sized');
    const box = await page.locator('#sized').boundingBox();
    await page.mouse.move(box.x - 40, box.y + box.height / 2);
    await tap5(page, '#sized');
    expect(await settled(page, '#sized'), 'pointer moves and five taps leave the frame unchanged').toBe(before);
  });
});

test.describe('still frames', () => {
  test.beforeEach(({ page }) => open(page, { still: true }));
  test.afterEach(noProblems);

  test('every skin draws in every state', async ({ page }) => {
    for (const skin of SKINS) {
      const selector = `[data-skin="${skin}"]`;
      let last = null;
      for (const state of STATES) {
        await page.$eval(
          selector,
          (el, s) => {
            el.state = s;
          },
          state
        );
        const next = await frame(page, selector);
        expect((await pixels(page, selector)).alpha, `${skin} draws in ${state}`).toBeGreaterThan(0);
        if (last) expect(next, `${skin} redraws for ${state}`).not.toBe(last);
        last = next;
      }
    }
  });

  test('reduced motion holds a still pose', async ({ page }) => {
    const a = await frame(page, '[data-skin="drones"]');
    await twoFrames(page);
    expect(await frame(page, '[data-skin="drones"]'), 'reduced motion draws the same frame twice').toBe(a);
  });

  test('default size follows clamp(20px, 1.43em, 48px)', async ({ page }) => {
    expect(
      await page.$eval('#inline tiny-tell', el => el.getBoundingClientRect().width),
      'an inline tell in 16px text is 1.43em wide'
    ).toBeCloseTo(16 * 1.43, 0);
  });

  test('scheme draws the dark palette: auto in a dark region, invert in a light one, dark anywhere', async ({
    page,
  }) => {
    const light = (await pixels(page, '#in-light')).lum;
    await page.evaluate(() =>
      document
        .querySelector('.light')
        .insertAdjacentHTML('beforeend', '<tiny-tell id="forced-dark" skin="drones" scheme="dark"></tiny-tell>')
    );
    await drawn(page);
    for (const [selector, claim] of [
      ['#in-dark', 'scheme auto inside a dark region'],
      ['#inverted', 'scheme invert inside a light region'],
      ['#forced-dark', 'scheme dark inside a light region'],
    ])
      expect((await pixels(page, selector)).lum, `${claim} draws the lighter, dark-scheme ink`).toBeGreaterThan(
        light + 10
      );
  });

  test('color current draws in the surrounding text color, including through a slot', async ({ page }) => {
    expect((await pixels(page, '#ink')).lum, 'color current takes white text color').toBeGreaterThan(230);
    expect(
      (await pixels(page, '#slotted tiny-tell')).lum,
      'color current takes white text color through a slot'
    ).toBeGreaterThan(230);
  });

  test('palette tokens recolor a state, light-dark() follows each tell’s scheme, and a still tell picks up a later change', async ({
    page,
  }) => {
    const red = await pixels(page, '#red-done'),
      light = await pixels(page, '#ld-light'),
      dark = await pixels(page, '#ld-dark');
    expect(red.r, '--tell-color-done turns done red').toBeGreaterThan(Math.max(red.g, red.b) + 60);
    expect(light.g, 'light-dark() picks green for a light tell').toBeGreaterThan(light.b + 40);
    expect(dark.b, 'light-dark() picks blue for a dark tell').toBeGreaterThan(dark.g + 40);
    await page.$eval('#red-done', el => el.parentElement.style.setProperty('--tell-color-done', 'rgb(0 0 230)'));
    await expect
      .poll(
        async () => {
          const { r, b } = await pixels(page, '#red-done');
          return b - r;
        },
        { message: 'the new --tell-color-done shows up without a reload' }
      )
      .toBeGreaterThan(60);
  });

  test('accessible name follows state, label overrides, empty label is decorative', async ({ page }) => {
    await page.$eval('[data-skin="drones"]', el => {
      el.state = 'error';
    });
    await expect(
      page.locator('[data-skin="drones"]').getByRole('img', { name: 'Error' }),
      'the state names the tell'
    ).toHaveCount(1);
    await expect(
      page.locator('#labeled').getByRole('img', { name: 'Deploying' }),
      'label overrides the state name'
    ).toHaveCount(1);
    await expect(page.locator('#decorative').getByRole('img'), 'an empty label hides the tell').toHaveCount(0);
    expect(
      await page.$eval('[data-skin="drones"]', el => el.matches(':state(error)')),
      'the state is exposed to :state()'
    ).toBe(true);
  });

  test('a hidden tell draws once it is shown', async ({ page }) => {
    await page.$eval('#hidden', el => {
      el.hidden = false;
    });
    await page.waitForFunction(
      () => document.getElementById('hidden').shadowRoot.querySelector('[part="tell"]').width > 1
    );
    expect((await pixels(page, '#hidden')).alpha, 'a shown tell draws').toBeGreaterThan(0);
  });

  test('a state set while a tell is detached applies when it comes back', async ({ page }) => {
    const before = await frame(page, '[data-skin="lens"]');
    await page.$eval('[data-skin="lens"]', el => {
      el.remove();
      el.state = 'error';
      document.body.append(el);
    });
    await expect(
      page.locator('[data-skin="lens"]').getByRole('img', { name: 'Error' }),
      'a state set while detached applies on re-add'
    ).toHaveCount(1);
    await expect
      .poll(() => frame(page, '[data-skin="lens"]'), { message: 'and the re-added tell draws the new state' })
      .not.toBe(before);
  });
});

test.describe('high density', () => {
  test.use({ deviceScaleFactor: 2 });
  test.beforeEach(({ page }) => open(page, { still: true }));
  test.afterEach(noProblems);

  test('the canvas is square and matches its box at device pixel ratio, even in a table cell (Safari drew it twice as tall)', async ({
    page,
  }) => {
    for (const selector of ['#sized', '[data-skin="eyes"]', '#inline tiny-tell', '#in-cell tiny-tell']) {
      const { w, h, css, dpr } = await pixels(page, selector);
      expect(dpr, 'the page runs at 2× density').toBe(2);
      expect(w, `${selector} has a square canvas`).toBe(h);
      expect(w, `${selector} canvas matches its box × density`).toBe(Math.round(css * dpr));
      const shown = await page.$eval(selector, t => {
        const box = t.getBoundingClientRect(),
          canvas = t.shadowRoot.querySelector('[part="tell"]').getBoundingClientRect();
        return [canvas.width - box.width, canvas.height - box.height].map(Math.round);
      });
      expect(shown, `${selector} canvas is drawn at the size of its box`).toEqual([0, 0]);
    }
    expect((await pixels(page, '#sized')).css, '--tell-size sets the box').toBe(48);
  });
});

test.describe('large sizes', () => {
  test.beforeEach(({ page }) => open(page, { still: true }));
  test.afterEach(noProblems);

  test('blot keeps a crisp edge when it is drawn large', async ({ page }) => {
    await page.evaluate(() =>
      document.body.insertAdjacentHTML(
        'beforeend',
        '<tiny-tell id="big-blot" skin="blot" state="done" label="" style="--tell-size: 164px"></tiny-tell>'
      )
    );
    await drawn(page);
    const edge = await page.$eval('#big-blot', el => {
      const cv = el.shadowRoot.querySelector('[part="tell"]'),
        W = cv.width,
        d = cv.getContext('2d').getImageData(0, 0, W, W).data;
      let narrowest = Infinity;
      for (let y = Math.round(W * 0.3); y < W * 0.6; y++) {
        const alpha = x => d[(y * W + x) * 4 + 3],
          start = [...Array(W >> 1).keys()].find(x => alpha(x) > 25),
          end = [...Array(W >> 1).keys()].find(x => alpha(x) > 230);
        if (start !== undefined && end !== undefined) narrowest = Math.min(narrowest, end - start);
      }
      return narrowest;
    });
    expect(edge, 'at 164px the edge goes from 10% to 90% within 3 device pixels').toBeLessThanOrEqual(3);
  });
});

test.describe('forced colors', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'Forced-colors emulation is Chromium-only');
  test.beforeEach(({ page }) => open(page, { still: true, forced: true }));
  test.afterEach(noProblems);

  test('forced colors draw in the system text color, not the state color', async ({ page }) => {
    await page.$eval('[data-skin="drones"]', el => {
      el.state = 'done';
    });
    const { r, g, b, alpha } = await pixels(page, '[data-skin="drones"]');
    expect(alpha, 'the tell still draws').toBeGreaterThan(0);
    expect(Math.max(r, g, b) - Math.min(r, g, b), 'the ink is gray, not the done color').toBeLessThan(20);
  });
});

test.describe('Chromium only', () => {
  test.skip(
    ({ browserName }) => browserName !== 'chromium',
    'Trusted Types and layout counts are Chromium-only; axe and the engine checks give the same answer in every engine'
  );

  test('renders under a Trusted Types policy', async ({ page }) => {
    await open(page, { path: '/tests/trusted-types.html' });
    expect(page.problems, 'no Trusted Types violations').toEqual([]);
    expect((await pixels(page, 'tiny-tell')).alpha, 'the tell draws under the policy').toBeGreaterThan(0);
  });

  test('adding hundreds of tells lays out the page a few times, not once per tell', async ({ page }) => {
    await open(page);
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Performance.enable');
    const layouts = async () =>
      (await cdp.send('Performance.getMetrics')).metrics.find(m => m.name === 'LayoutCount').value;
    const before = await layouts();
    await page.evaluate(() =>
      document.body.insertAdjacentHTML(
        'beforeend',
        `<table>${'<tr><td><tiny-tell skin="lens"></tiny-tell> Job</td></tr>'.repeat(300)}</table>`
      )
    );
    await drawn(page);
    expect((await layouts()) - before, '300 new tells cost under 20 layouts').toBeLessThan(20);
    noProblems({ page });
  });

  test('a moving tell redraws at 60fps on a 120Hz display, not every display frame (Dia stuttered)', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      const queue = [],
        draws = new Map();
      let now = 0;
      window.requestAnimationFrame = callback => queue.push(callback);
      window.cancelAnimationFrame = () => {};
      const clear = CanvasRenderingContext2D.prototype.clearRect;
      CanvasRenderingContext2D.prototype.clearRect = function (x, y, w, h) {
        if (w > 1) draws.set(this.canvas, (draws.get(this.canvas) || 0) + 1);
        return clear.call(this, x, y, w, h);
      };
      window.runDisplay = (hz, frames) => {
        draws.clear();
        for (let i = 0; i < frames; i++) {
          now += 1000 / hz;
          queue.splice(0).forEach(callback => callback(now));
        }
        return Math.max(0, ...draws.values());
      };
    });
    await page.goto('/tests/fixture.html');
    await page.waitForFunction(() => customElements.get('tiny-tell'));
    const second = hz => page.evaluate(hz => (window.runDisplay(hz, hz), window.runDisplay(hz, hz)), hz);
    expect(await second(120), 'a 120Hz display draws at least 58 frames a second').toBeGreaterThanOrEqual(58);
    expect(await second(120), 'a 120Hz display draws at most 62 frames a second').toBeLessThanOrEqual(62);
    expect(await second(60), 'a 60Hz display still draws every frame').toBeGreaterThanOrEqual(58);
  });

  test('axe finds no accessibility violations in tells', async ({ page }) => {
    await open(page, { still: true });
    const { violations, passes } = await new AxeBuilder({ page })
      .include('tiny-tell')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(
      violations.map(v => `${v.id}: ${v.nodes.length} node(s)`),
      'axe finds no WCAG 2.2 AA violations'
    ).toEqual([]);
    expect(
      passes.map(p => p.id),
      'axe actually checked the image names'
    ).toContain('role-img-alt');
  });

  test('every tell stays in its live area, loops without a seam, and never flashes more than 3 times a second', async ({
    page,
  }) => {
    test.setTimeout(120000);
    await page.goto('/tests/engine.html');
    const { failures, flashes } = await page
      .waitForFunction(() => window.engineChecks, null, { timeout: 110000 })
      .then(h => h.jsonValue());
    expect(flashes, 'every tell × state × scheme was checked for flashing').toHaveLength(
      SKINS.length * (STATES.length + 1) * 2
    );
    expect(failures, 'no live-area, seam, or flash failures').toEqual([]);
  });
});

test.describe('play bundle', () => {
  test.beforeEach(({ page }) => open(page, { path: '/tests/play.html' }));
  test.afterEach(noProblems);

  test('notice: a tell leans toward a nearby pointer and settles back when it leaves', async ({ page }) => {
    await page.evaluate(() => {
      customElements.get('tiny-tell').timeScale = 0;
    });
    const neutral = await settled(page, '#eyes');
    const box = await page.locator('#eyes').boundingBox(),
      cx = box.x + box.width / 2,
      cy = box.y + box.height / 2;
    await page.mouse.move(cx - 90, cy);
    const left = await settled(page, '#eyes');
    await page.mouse.move(cx + 90, cy);
    const right = await settled(page, '#eyes');
    expect(left, 'a pointer on the left moves the eyes').not.toBe(neutral);
    expect(right, 'a pointer on the right moves them again').not.toBe(left);
    await page.mouse.move(cx + 2000, cy + 2000);
    expect(await settled(page, '#eyes'), 'a far pointer lets the eyes settle back').toBe(neutral);
  });

  test('play stays off on a paused tell and under reduced motion', async ({ page }) => {
    await page.evaluate(() => {
      window.danced = 0;
      document.addEventListener('tell-dance', () => window.danced++);
      document.getElementById('eyes').paused = true;
    });
    await tap5(page, '#eyes');
    expect(await page.evaluate(() => window.danced), 'a paused tell ignores five taps').toBe(0);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.$eval('#eyes', el => (el.paused = false));
    await tap5(page, '#eyes');
    expect(await page.evaluate(() => window.danced), 'so does any tell under reduced motion').toBe(0);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await tap5(page, '#eyes');
    await expect.poll(() => page.evaluate(() => window.danced), { message: 'with both off, five taps dance' }).toBe(1);
  });

  test('the npm core and play entries share one element, so loading both is safe', async ({ page }) => {
    const warnings = [];
    page.on('console', msg => msg.type() === 'warning' && warnings.push(msg.text()));
    const isShared = await page.evaluate(
      async () => (await import('/dist/tiny-tells.js')).TinyTell === customElements.get('tiny-tell')
    );
    expect(isShared, 'importing the core after play returns the registered class').toBe(true);
    expect(warnings, 'and nothing warns').toEqual([]);
  });

  test('loading the standalone CDN core after play warns instead of registering twice', async ({ page }) => {
    const warnings = [];
    page.on('console', msg => msg.type() === 'warning' && warnings.push(msg.text()));
    await page.evaluate(() => import('/dist/tiny-tells.min.js'));
    await expect.poll(() => warnings.join('\n'), 'the second copy warns').toContain('already defined');
  });

  test('dance: five quick taps fire tell-dance, dance in the dance color, then fire tell-after-dance and return', async ({
    page,
  }) => {
    await page.evaluate(() => {
      customElements.get('tiny-tell').timeScale = 4;
      window.heard = [];
      for (const type of ['tell-dance', 'tell-after-dance'])
        document.addEventListener(type, e =>
          window.heard.push({
            type,
            bubbles: e.bubbles,
            composed: e.composed,
            cancelable: e.cancelable,
            id: e.target.id,
          })
        );
    });
    expect(await hue(page, '#eyes'), 'the tell starts without the dance color').toBeLessThan(20);
    await tap5(page, '#eyes');
    await expect
      .poll(() => hue(page, '#eyes'), { message: 'five taps start the dance', timeout: 3000 })
      .toBeGreaterThan(40);
    await expect(
      page.locator('#eyes').getByRole('img', { name: 'Idle' }),
      'the name stays on the real state while dancing'
    ).toHaveCount(1);
    await expect
      .poll(() => page.evaluate(() => window.heard.length), { message: 'the dance ends on its own', timeout: 5000 })
      .toBe(2);
    expect(await hue(page, '#eyes'), 'the dance color is gone once it ends').toBeLessThan(20);
    expect(
      await page.evaluate(() => window.heard),
      'both events reach the document, and only the first can be canceled'
    ).toEqual([
      { type: 'tell-dance', bubbles: true, composed: true, cancelable: true, id: 'eyes' },
      { type: 'tell-after-dance', bubbles: true, composed: true, cancelable: false, id: 'eyes' },
    ]);
  });

  test('dance events: canceling tell-dance keeps the tell from dancing', async ({ page }) => {
    await page.evaluate(() => {
      customElements.get('tiny-tell').timeScale = 4;
      window.canceled = false;
      window.ended = false;
      document.addEventListener('tell-dance', e => {
        e.preventDefault();
        window.canceled = true;
      });
      document.addEventListener('tell-after-dance', () => (window.ended = true));
    });
    await tap5(page, '#eyes');
    await expect.poll(() => page.evaluate(() => window.canceled), { message: 'five taps asked to dance' }).toBe(true);
    // Nothing signals a dance that didn't happen, so give one at 4× speed time to show its color first.
    for (let i = 0; i < 30; i++) await twoFrames(page);
    expect(await hue(page, '#eyes'), 'no dance color after a canceled dance').toBeLessThan(20);
    expect(await page.evaluate(() => window.ended), 'a dance that never started never ends').toBe(false);
  });

  test('dance events: a state or skin change mid-dance ends it with tell-after-dance', async ({ page }) => {
    await page.evaluate(() => {
      customElements.get('tiny-tell').timeScale = 0.25;
      window.ended = 0;
      document.addEventListener('tell-after-dance', () => window.ended++);
    });
    await tap5(page, '#eyes');
    await expect
      .poll(() => hue(page, '#eyes'), { message: 'the first dance starts', timeout: 8000 })
      .toBeGreaterThan(40);
    await page.$eval('#eyes', el => (el.state = 'done'));
    expect(await page.evaluate(() => window.ended), 'a state change reports the end right away').toBe(1);
    await tap5(page, '#eyes');
    await expect
      .poll(() => hue(page, '#eyes'), { message: 'the second dance starts', timeout: 8000 })
      .toBeGreaterThan(40);
    await page.$eval('#eyes', el => (el.skin = 'drones'));
    expect(await page.evaluate(() => window.ended), 'so does a skin change').toBe(2);
  });
});

test.describe('reserve.css', () => {
  test('an undefined tell takes the box it has once loaded, so the words beside it never move', async ({ page }) => {
    await page.goto('/tests/reserve.html');
    const layout = () =>
      page.evaluate(() =>
        Object.fromEntries(
          [...document.querySelectorAll('[data-case]')].map(row => {
            const box = el => [...Object.values(el.getBoundingClientRect().toJSON())].slice(0, 4).map(Math.round);
            return [
              row.dataset.case,
              { tell: box(row.querySelector('tiny-tell')), words: box(row.querySelector('span')) },
            ];
          })
        )
      );
    expect(
      await page.evaluate(() => customElements.get('tiny-tell')),
      'the element has not loaded yet'
    ).toBeUndefined();
    const before = await layout();
    const width = name => before[name].tell[2];
    expect(width('small text'), 'small text still gets the 20px minimum').toBe(20);
    expect(width('huge text'), 'huge text stops at the 48px maximum').toBe(48);
    expect(width('large text'), 'the reserved box tracks the text size').toBeGreaterThan(width('default'));
    expect(width('pinned on a container'), '--tell-size set on a container reaches the tell').toBe(24);
    expect(width('tight flex row'), 'a tight flex row does not squeeze the tell').toBe(width('default'));
    expect(width('hidden'), 'a hidden tell stays hidden').toBe(0);
    await page.addScriptTag({ type: 'module', url: '/dist/tiny-tells.js' });
    await page.waitForFunction(() => customElements.get('tiny-tell'));
    expect(await layout(), 'every tell, and the words after it, stays put when the element loads').toEqual(before);
  });
});

test.describe('site pages', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'the page wiring is the same in every engine');
  test.afterEach(noProblems);

  test('landing, docs, and 404 load and switch theme without errors', async ({ page }) => {
    await page.addInitScript(() => {
      window.windowErrors = [];
      addEventListener('error', e => window.windowErrors.push(e.message));
    });
    for (const path of ['/', '/docs/', '/404.html']) {
      await open(page, { path });
      const html = page.locator('html');
      await expect(html, `${path} applies a theme`).toHaveAttribute('data-theme', /^(light|dark)$/);
      const before = await html.getAttribute('data-theme');
      await page.locator('#theme').click();
      await expect(html, `${path} flips the theme`).not.toHaveAttribute('data-theme', before);
      expect(await page.evaluate(() => window.windowErrors), `${path} raises no window errors`).toEqual([]);
    }
  });

  test('picking a link in the mobile docs drawer closes the drawer', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await open(page, { path: '/docs/' });
    await page.locator('.nav-toggle').click();
    const link = page.getByRole('navigation', { name: 'Docs' }).getByRole('link', { name: 'Color' });
    await expect(link, 'the drawer opens').toBeVisible();
    await link.click();
    await expect(page, 'the link still jumps to its section').toHaveURL(/#color$/);
    await expect(link, 'the drawer closes').toBeHidden();
  });

  test('the tab underline slides on a first visit to a tab, not only on later ones', async ({ page }) => {
    await open(page, { path: '/docs/' });
    const group = page.locator('wa-tab-group:has(> .tab-bar)').first();
    await page.addStyleTag({ content: ':root, .wa-light, .wa-dark { --wa-transition-slow: 5s !important }' });
    await group.scrollIntoViewIfNeeded();
    await group.locator(':scope > wa-tab').nth(1).click();
    await expect(
      group.locator('wa-tab-panel[active] pre wa-copy-button'),
      'the new panel fills in its copy button'
    ).toBeAttached();
    const isSliding = () => group.evaluate(g => g.querySelector(':scope > .tab-bar').getAnimations().length > 0);
    expect(await isSliding(), 'the panel filling in mid-slide does not cut the slide short').toBe(true);
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
});
