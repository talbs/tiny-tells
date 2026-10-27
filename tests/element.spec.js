import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { DOZE_CLIPS } from '../src/doze.js';
import { STATES, TELLS, drawn, noProblems, open } from './helpers.js';

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
const RED = 0,
  BLUE = 2;
const hue = (page, selector, ch = BLUE) =>
  page.$eval(
    selector,
    (el, ch) => {
      const cv = el.shadowRoot.querySelector('[part="tell"]'),
        d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
      let most = -255;
      for (let i = 0; i < d.length; i += 4)
        if (d[i + 3] > 200) most = Math.max(most, d[i + ch] - Math.max(d[i + ((ch + 1) % 3)], d[i + ((ch + 2) % 3)]));
      return most;
    },
    ch
  );
const center = async (page, selector) => {
  const box = await page.locator(selector).boundingBox();
  return [box.x + box.width / 2, box.y + box.height / 2];
};
// Five real clicks can span more than play's 1.5s tap window on a busy machine, so they're dispatched in one go.
const tap5 = (page, selector) =>
  page.$eval(selector, el => {
    for (let i = 0; i < 5; i++) el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
  });

const peakOpen = (page, selector, frames = 20) =>
  page.$eval(
    selector,
    async (el, n) => {
      const cv = el.shadowRoot.querySelector('[part="tell"]');
      let most = 0;
      for (let f = 0; f < n; f++) {
        await new Promise(r => requestAnimationFrame(r));
        const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
        let lit = 0;
        for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 200 && d[i] + d[i + 1] + d[i + 2] > 450) lit++;
        most = Math.max(most, lit);
      }
      return most;
    },
    frames
  );

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

const fakeDisplay = page =>
  page.addInitScript(() => {
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

test.describe('in motion', () => {
  test.beforeEach(({ page }) => open(page));
  test.afterEach(noProblems);

  test('a tell moves unless it is paused or reduced motion is on', async ({ page }) => {
    const selector = '[data-tell="drones"]';
    const holds = async () => {
      await twoFrames(page);
      const a = await frame(page, selector);
      await twoFrames(page);
      return (await frame(page, selector)) === a;
    };
    const before = await frame(page, selector);
    await expect.poll(() => frame(page, selector), { message: 'a running tell draws a new frame' }).not.toBe(before);
    await page.$eval(selector, el => (el.paused = true));
    expect(await holds(), 'a paused tell draws the same frame twice').toBe(true);
    await page.$eval(selector, el => (el.paused = false));
    await page.emulateMedia({ reducedMotion: 'reduce' });
    expect(await holds(), 'reduced motion holds a still pose').toBe(true);
  });

  test('a property set before the element was defined still takes effect', async ({ page }) => {
    expect(await page.$eval('#early', el => el.getAttribute('state')), 'the early state reflects after upgrade').toBe(
      'error'
    );
    await expect
      .poll(() => page.$eval('#early', el => el.matches(':state(error)')), { message: 'the early state applies' })
      .toBe(true);
  });

  test('unknown tells and states warn and fall back to drones and working', async ({ page }) => {
    const warnings = [];
    page.on('console', msg => {
      if (msg.type() === 'warning') warnings.push(msg.text());
    });
    await page.evaluate(() =>
      document.body.insertAdjacentHTML('beforeend', '<tiny-tell id="typo" tell="nope"></tiny-tell>')
    );
    await page.$eval('[data-tell="eyes"]', el => {
      el.state = 'nope';
    });
    await expect.poll(() => warnings.join('\n'), 'an unknown tell warns').toContain('unknown tell "nope"');
    expect(warnings.join('\n'), 'an unknown state warns').toContain('unknown state "nope"');
    await drawn(page);
    expect((await pixels(page, '#typo')).alpha, 'an unknown tell still draws the fallback').toBeGreaterThan(0);
  });

  test('a tell with no label beside or inside a live region hints once per page, and correct pages stay quiet', async ({
    page,
  }) => {
    const span = '<span role="status">Syncing</span>';
    const ROWS = [
      {
        name: 'bare tell, status span after',
        html: `<p><tiny-tell id="a" tell="dekatron" state="done"></tiny-tell>${span}</p>`,
        hint: [
          '<tiny-tell id="a" tell="dekatron">',
          'next to <span role="status">',
          '"Done"',
          'label=""',
          'tinytells.dev/docs/#labels',
        ],
      },
      {
        name: 'two such tells',
        html: `<p><tiny-tell id="a"></tiny-tell>${span}</p><p><tiny-tell id="b"></tiny-tell>${span}</p>`,
        hint: ['<tiny-tell id="a">'],
      },
      {
        name: 'inside a status paragraph',
        html: '<p id="r" role="status"><tiny-tell id="a"></tiny-tell> Syncing</p>',
        hint: ['<p id="r" role="status">'],
      },
      {
        name: 'after an <output>',
        html: '<p><output>3 files</output><tiny-tell id="a"></tiny-tell></p>',
        hint: ['next to <output>'],
      },
      {
        name: 'beside aria-live="polite"',
        html: '<div><tiny-tell id="a"></tiny-tell><div aria-live="polite">Syncing</div></div>',
        hint: ['<div aria-live="polite">'],
      },
      {
        name: 'aria-live="off" neighbor',
        html: '<div><tiny-tell id="a"></tiny-tell><div aria-live="off">Syncing</div></div>',
        hint: null,
      },
      { name: 'label=""', html: `<p><tiny-tell id="a" label=""></tiny-tell>${span}</p>`, hint: null },
      { name: 'label="Uploading"', html: `<p><tiny-tell id="a" label="Uploading"></tiny-tell>${span}</p>`, hint: null },
      {
        name: 'aria-label on the tag',
        html: `<p><tiny-tell id="a" aria-label="Sync"></tiny-tell>${span}</p>`,
        hint: null,
      },
      { name: 'hidden tell', html: `<p><tiny-tell id="a" hidden></tiny-tell>${span}</p>`, hint: null },
      {
        name: 'status span not an immediate neighbor',
        html: `<p><tiny-tell id="a"></tiny-tell><span>3 files</span>${span}</p>`,
        hint: null,
      },
    ];
    let warnings = [];
    page.on('console', msg => msg.type() === 'warning' && warnings.push(msg.text()));
    for (const { name, html, hint } of ROWS) {
      // The hint is once per page, so every row gets a fresh one.
      await open(page);
      warnings = [];
      await page.evaluate(async html => {
        document.body.insertAdjacentHTML('beforeend', html);
        await new Promise(requestAnimationFrame);
        console.warn('row done');
      }, html);
      await expect.poll(() => warnings.includes('row done'), { message: `${name}: the row ran` }).toBe(true);
      const hints = warnings.filter(text => text.includes(': no label, next to'));
      expect(hints.length, `${name}: ${hint ? 'hints once' : 'stays quiet'}`).toBe(hint ? 1 : 0);
      for (const fragment of hint ?? []) expect(hints[0], `${name}: the hint says ${fragment}`).toContain(fragment);
      expect(page.problems, `${name}: no page errors`).toEqual([]);
    }
  });

  test('moving a tell keeps its animation going instead of restarting it', async ({ page }) => {
    // Run the clock a while first, so a restart would visibly jump back to the first pose.
    for (let i = 0; i < 20; i++) await twoFrames(page);
    await page.evaluate(() => {
      customElements.get('tiny-tell').timeScale = 0;
    });
    const before = await settled(page, '[data-tell="eyes"]');
    await page.$eval('[data-tell="eyes"]', el => el.parentElement.append(el));
    expect(await settled(page, '[data-tell="eyes"]'), 'a moved tell draws the same pose it had').toBe(before);
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

  test('every tell draws in every state', async ({ page }) => {
    for (const tell of TELLS) {
      const selector = `[data-tell="${tell}"]`;
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
        expect((await pixels(page, selector)).alpha, `${tell} draws in ${state}`).toBeGreaterThan(0);
        if (last) expect(next, `${tell} redraws for ${state}`).not.toBe(last);
        last = next;
      }
    }
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
        .insertAdjacentHTML('beforeend', '<tiny-tell id="forced-dark" tell="drones" scheme="dark"></tiny-tell>')
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
    const before = await frame(page, '[data-tell="lens"]');
    await page.$eval('[data-tell="lens"]', el => {
      el.remove();
      el.state = 'error';
      document.body.append(el);
    });
    await expect
      .poll(() => page.$eval('[data-tell="lens"]', el => el.matches(':state(error)')), {
        message: 'a state set while detached applies on re-add',
      })
      .toBe(true);
    await expect
      .poll(() => frame(page, '[data-tell="lens"]'), { message: 'and the re-added tell draws the new state' })
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
    for (const selector of ['#sized', '[data-tell="eyes"]', '#inline tiny-tell', '#in-cell tiny-tell']) {
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

test.describe('forced colors', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'Forced-colors emulation is Chromium-only');
  test.beforeEach(({ page }) => open(page, { still: true, forced: true }));
  test.afterEach(noProblems);

  test('forced colors draw in the system text color, not the state color', async ({ page }) => {
    await page.$eval('[data-tell="drones"]', el => {
      el.state = 'done';
    });
    const { r, g, b, alpha } = await pixels(page, '[data-tell="drones"]');
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
        `<table>${'<tr><td><tiny-tell tell="lens"></tiny-tell> Job</td></tr>'.repeat(300)}</table>`
      )
    );
    await drawn(page);
    expect((await layouts()) - before, '300 new tells cost under 20 layouts').toBeLessThan(20);
    noProblems({ page });
  });

  test('a moving tell redraws at 60fps on a 120Hz display, not every display frame (Dia stuttered)', async ({
    page,
  }) => {
    await fakeDisplay(page);
    await page.goto('/tests/fixture.html');
    await page.waitForFunction(() => customElements.get('tiny-tell'));
    const second = hz => page.evaluate(hz => (window.runDisplay(hz, hz), window.runDisplay(hz, hz)), hz);
    expect(await second(120), 'a 120Hz display draws at least 58 frames a second').toBeGreaterThanOrEqual(58);
    expect(await second(120), 'a 120Hz display draws at most 62 frames a second').toBeLessThanOrEqual(62);
    expect(await second(60), 'a 60Hz display still draws every frame').toBeGreaterThanOrEqual(58);
  });

  test('a tell stops redrawing when timeScale is 0, and moves again when it goes back up', async ({ page }) => {
    await fakeDisplay(page);
    await page.goto('/tests/fixture.html');
    await page.waitForFunction(() => customElements.get('tiny-tell'));
    await page.evaluate(() => window.runDisplay(60, 10));
    await page.evaluate(() => (customElements.get('tiny-tell').timeScale = 0));
    await page.evaluate(() => window.runDisplay(60, 10));
    expect(await page.evaluate(() => window.runDisplay(60, 60)), 'a stopped clock draws nothing').toBe(0);
    await page.evaluate(() => (customElements.get('tiny-tell').timeScale = 1));
    expect(await page.evaluate(() => window.runDisplay(60, 60)), 'a restarted clock draws again').toBeGreaterThan(50);
  });

  test('a script writing to <html> every frame doesn’t make every tell re-read its colors', async ({ page }) => {
    await open(page);
    const { reads, frames } = await page.evaluate(async () => {
      /* Every tell re-reads its colors a second after its last look. Start all of them fresh, then stay well inside that second: a slow runner's 60 frames can take longer. */
      document.documentElement.setAttribute('data-fresh', '');
      await new Promise(r => requestAnimationFrame(r));
      await new Promise(r => requestAnimationFrame(r));
      const read = window.getComputedStyle;
      let count = 0,
        frames = 0;
      window.getComputedStyle = (...args) => (count++, read(...args));
      const t0 = performance.now();
      while (frames < 60 && performance.now() - t0 < 600) {
        document.documentElement.style.setProperty('--scroll', String(frames++));
        await new Promise(r => requestAnimationFrame(r));
      }
      window.getComputedStyle = read;
      return { reads: count, frames };
    });
    expect(frames, 'enough frames ran to measure').toBeGreaterThan(9);
    expect(reads, '<html> writes cost a few reads a frame, not a pass over every tell').toBeLessThan(5 * frames);
  });

  test('the tell is one img named by its state, its label, or an aria-label on the tag; an empty label hides it', async ({
    page,
  }) => {
    await open(page);
    const cdp = await page.context().newCDPSession(page);
    const images = async () =>
      (await cdp.send('Accessibility.getFullAXTree')).nodes
        .filter(n => !n.ignored && n.role?.value === 'image')
        .map(n => n.name?.value);
    const before = await images();
    await page.$eval('[data-tell="drones"]', el => {
      el.state = 'error';
    });
    await page.$eval('[data-tell="lens"]', el => el.setAttribute('aria-label', 'Uploading'));
    await twoFrames(page);
    const after = await images();
    const errors = names => names.filter(n => n === 'Error').length;
    expect(errors(after), 'the state names the tell').toBe(errors(before) + 1);
    expect(after, 'label overrides the state name').toContain('Deploying');
    expect(
      after.filter(n => n === 'Uploading'),
      'an aria-label on the tag names it'
    ).toHaveLength(1);
    expect(after, 'an aria-label replaces the name instead of adding a second img').toHaveLength(before.length);
    await page.evaluate(() => {
      document.querySelector('[data-tell="lens"]').removeAttribute('aria-label');
      document.body.insertAdjacentHTML('beforeend', '<span id="sync-words">Syncing</span>');
      document.querySelector('[data-tell="dekatron"]').setAttribute('aria-labelledby', 'sync-words');
    });
    await twoFrames(page);
    const relabeled = await images();
    expect(relabeled, 'removing the aria-label goes back to the state name').not.toContain('Uploading');
    expect(relabeled, 'an aria-labelledby on the tag names it').toContain('Syncing');
    expect(relabeled, 'neither change adds or drops an img').toHaveLength(before.length);
    expect(
      after.filter(n => !n),
      'an empty label hides the tell'
    ).toHaveLength(0);
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
      'axe actually checked the hidden canvas'
    ).toContain('aria-hidden-focus');
  });

  test('every tell stays in its live area, loops without a seam, never flashes more than 3 times a second, draws error as a different shape from idle in one ink (#124) and every Dekatron state as its own shape (#132), Lens keeps to its color="current" ink (#98), and Blot keeps a crisp edge drawn large (#92)', async ({
    page,
  }) => {
    test.setTimeout(120000);
    await page.goto('/tests/engine.html');
    const { failures, flashes } = await page
      .waitForFunction(() => window.engineChecks, null, { timeout: 110000 })
      .then(h => h.jsonValue());
    expect(flashes, 'every tell × state × scheme was checked for flashing').toHaveLength(
      TELLS.length * (STATES.length + 1 + DOZE_CLIPS.length) * 2 // the 1 is dance
    );
    expect(failures, 'no live-area, seam, flash, ink, edge, or shape failures').toEqual([]);
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
    const [cx, cy] = await center(page, '#eyes');
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
    await twoFrames(page);
    await page.$eval('#eyes', el => (el.paused = false));
    await tap5(page, '#eyes');
    expect(await page.evaluate(() => window.danced), 'so does any tell under reduced motion').toBe(0);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await twoFrames(page);
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
      addEventListener(
        'pointerdown',
        e => (window.isTapOnTell = e.composedPath().includes(document.getElementById('eyes'))),
        { once: true }
      );
    });
    expect(await hue(page, '#eyes'), 'the tell starts without the dance color').toBeLessThan(20);
    await page.locator('#eyes').click();
    expect(await page.evaluate(() => window.isTapOnTell), 'a real click reaches the tell').toBe(true);
    await tap5(page, '#eyes');
    await expect
      .poll(() => hue(page, '#eyes'), { message: 'five taps start the dance', timeout: 3000 })
      .toBeGreaterThan(40);
    await expect
      .poll(() => page.$eval('#eyes', el => el.matches(':state(idle)')), {
        message: 'the exposed state stays the real one while dancing',
      })
      .toBe(true);
    await expect
      .poll(() => page.evaluate(() => window.heard.length), { message: 'the dance ends on its own', timeout: 5000 })
      .toBe(2);
    await expect.poll(() => hue(page, '#eyes'), { message: 'the dance color is gone once it ends' }).toBeLessThan(20);
    expect(
      await page.evaluate(() => window.heard),
      'both events reach the document, and only the first can be canceled'
    ).toEqual([
      { type: 'tell-dance', bubbles: true, composed: true, cancelable: true, id: 'eyes' },
      { type: 'tell-after-dance', bubbles: true, composed: true, cancelable: false, id: 'eyes' },
    ]);
  });

  test('--tell-color-dance recolors the dance in both color modes', async ({ page }) => {
    await page.evaluate(() => (customElements.get('tiny-tell').timeScale = 4));
    for (const id of ['#dance-state', '#dance-current']) {
      expect(await hue(page, id, RED), `${id} starts without red`).toBeLessThan(20);
      expect(await page.$eval(id, el => el.dance()), `${id} dances`).toBe(true);
      await expect
        .poll(() => hue(page, id, RED), { message: `${id} dances in --tell-color-dance`, timeout: 3000 })
        .toBeGreaterThan(60);
    }
  });

  test('doze: an idle tell left alone nods off, wakes when the pointer comes back, and never covers a real state', async ({
    page,
  }) => {
    const [cx, cy] = await center(page, '#eyes');
    await page.mouse.move(cx, cy);
    await page.mouse.move(cx + 2000, cy + 2000);
    const awake = await peakOpen(page, '#eyes'),
      busy = await peakOpen(page, '#busy');
    await page.evaluate(() => (customElements.get('tiny-tell').timeScale = 60));
    await expect
      .poll(() => peakOpen(page, '#eyes'), { message: 'an idle tell left alone closes its eyes', timeout: 5000 })
      .toBeLessThan(awake * 0.5);
    expect(await peakOpen(page, '#busy'), 'a working tell left alone stays awake').toBeGreaterThan(busy * 0.7);
    expect(
      await page.$eval('#eyes', el => el.matches(':state(idle)')),
      'the exposed state stays idle while it sleeps'
    ).toBe(true);
    await page.mouse.move(cx, cy);
    await expect
      .poll(() => peakOpen(page, '#eyes'), { message: 'the pointer coming back wakes it' })
      .toBeGreaterThan(awake * 0.8);
  });

  test('a subclass under its own tag dances and names its own tag in warnings', async ({ page }) => {
    const warnings = [];
    page.on('console', msg => {
      if (msg.type() === 'warning') warnings.push(msg.text());
    });
    await page.evaluate(() => {
      customElements.define('sub-tell', class extends customElements.get('tiny-tell') {});
      document.body.insertAdjacentHTML('beforeend', '<sub-tell id="sub" style="--tell-size: 48px"></sub-tell>');
      window.danced = false;
      document.addEventListener('tell-dance', e => (window.danced = e.target.id === 'sub'));
    });
    await drawn(page);
    await tap5(page, '#sub');
    await expect.poll(() => page.evaluate(() => window.danced), { message: 'five taps make it dance' }).toBe(true);
    await page.$eval('#sub', el => (el.state = 'nope'));
    await expect
      .poll(() => warnings.join('\n'), { message: 'the warning names the subclass tag' })
      .toContain('<sub-tell>: unknown state "nope"');
  });

  test('dance events: a state or tell change mid-dance ends it with tell-after-dance', async ({ page }) => {
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
    await page.$eval('#eyes', el => (el.tell = 'drones'));
    expect(await page.evaluate(() => window.ended), 'so does a tell change').toBe(2);
  });

  test('dance events: removing a tell mid-dance ends it with tell-after-dance on the tell', async ({ page }) => {
    await page.evaluate(() => {
      window.danced = false;
      window.ended = 0;
      const el = document.getElementById('eyes');
      el.addEventListener('tell-dance', () => (window.danced = true));
      el.addEventListener('tell-after-dance', () => window.ended++);
    });
    await tap5(page, '#eyes');
    await expect.poll(() => page.evaluate(() => window.danced), { message: 'five taps start the dance' }).toBe(true);
    expect(await page.evaluate(() => window.ended), 'the dance is still going').toBe(0);
    await page.evaluate(() => document.getElementById('eyes').remove());
    expect(await page.evaluate(() => window.ended), 'removing the tell reports the end right away').toBe(1);
  });

  test('dance(): starts a dance and says so, and returns false when it can’t', async ({ page }) => {
    const result = await page.evaluate(() => {
      const el = document.getElementById('eyes'),
        fired = [];
      let ended = 0;
      el.addEventListener('tell-dance', e => fired.push(e.type));
      el.addEventListener('tell-after-dance', () => ended++);
      const first = el.dance(),
        again = el.dance();
      el.state = 'done';
      el.paused = true;
      const paused = el.dance();
      el.paused = false;
      el.addEventListener('tell-dance', e => e.preventDefault(), { once: true });
      const canceled = el.dance();
      const gone = document.createElement('tiny-tell');
      document.body.append(gone);
      gone.remove();
      return { first, again, paused, canceled, removed: gone.dance(), fired: fired.length, ended };
    });
    expect(result.first, 'a free tell starts dancing').toBe(true);
    expect(result.again, 'a dancing tell refuses a second dance').toBe(false);
    expect(result.paused, 'a paused tell refuses').toBe(false);
    expect(result.canceled, 'a canceled tell-dance refuses').toBe(false);
    expect(result.removed, 'a tell off the page refuses').toBe(false);
    expect(result.fired, 'tell-dance fired for the first dance and the canceled one only').toBe(2);
    expect(result.ended, 'only the dance that started reports an end').toBe(1);
  });

  test('noplay: a tell ignores the pointer and five taps, still dances on dance(), and plays again without it', async ({
    page,
  }) => {
    await page.evaluate(() => {
      customElements.get('tiny-tell').timeScale = 0;
      window.danced = 0;
      document.addEventListener('tell-dance', () => window.danced++);
    });
    const neutral = await settled(page, '#eyes');
    const [cx, cy] = await center(page, '#eyes');
    await page.$eval('#eyes', el => el.toggleAttribute('noplay', true));
    await page.mouse.move(cx - 90, cy);
    expect(await settled(page, '#eyes'), 'a noplay tell doesn’t look at a nearby pointer').toBe(neutral);
    await tap5(page, '#eyes');
    expect(await page.evaluate(() => window.danced), 'five taps don’t dance it').toBe(0);
    expect(await page.$eval('#eyes', el => el.dance()), 'dance() still works on it').toBe(true);
    await page.$eval('#eyes', el => {
      el.state = 'done';
      el.state = 'idle';
      el.toggleAttribute('noplay', false);
    });
    await page.mouse.move(cx + 90, cy);
    expect(await settled(page, '#eyes'), 'without noplay it looks again').not.toBe(neutral);
  });

  test('noplay: adding it wakes a dozing tell, and a noplay tell stays awake', async ({ page }) => {
    const [cx, cy] = await center(page, '#eyes');
    await page.mouse.move(cx, cy);
    await page.mouse.move(cx + 2000, cy + 2000);
    const awake = await peakOpen(page, '#eyes');
    await page.evaluate(() => (customElements.get('tiny-tell').timeScale = 60));
    await expect
      .poll(() => peakOpen(page, '#eyes'), { message: 'left alone, it dozes', timeout: 5000 })
      .toBeLessThan(awake * 0.5);
    await page.$eval('#eyes', el => el.toggleAttribute('noplay', true));
    await expect.poll(() => peakOpen(page, '#eyes'), { message: 'noplay wakes it' }).toBeGreaterThan(awake * 0.8);
    // At 60× speed, 60 frame pairs cover well past the 30s doze timer.
    for (let i = 0; i < 60; i++) await twoFrames(page);
    expect(await peakOpen(page, '#eyes'), 'a noplay tell never dozes').toBeGreaterThan(awake * 0.8);
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
