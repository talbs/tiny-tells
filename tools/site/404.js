import { PERIOD, QUIET } from '../../src/core.js';
import { V1 } from '../shared/copy.js';
import { $, isStill, on, onMotionChange, page, start, tag } from './shared.js';

const GLYPHS = {
  4: ['101', '101', '111', '001', '001'],
  0: ['111', '101', '101', '101', '111'],
};
const WORD = '404',
  WIDE = WORD.length * 4 - 1,
  TALL = 5;
const isLit = (col, row) => {
  const glyph = WORD[Math.floor(col / 4)];
  return (
    col >= 0 && row >= 0 && row < TALL && col % 4 < 3 && glyph !== undefined && GLYPHS[glyph][row][col % 4] === '1'
  );
};

const wall = $('wall');
let ripple = [];

/* A skin that differs from the cells to its left and above, so no stripes form. */
const pick = (skins, i, cols) => {
  const options = V1.filter(s => s !== skins[i - 1] && s !== skins[i - cols]);
  return options[Math.floor(Math.random() * options.length)];
};

const build = () => {
  const width = wall.clientWidth,
    height = innerHeight - wall.getBoundingClientRect().top - scrollY - $('lost-note').offsetHeight;
  const pitch = Math.min(52, Math.floor(Math.min(width / (WIDE + 2), height / (TALL + 2))));
  const cols = Math.floor(width / pitch),
    rows = Math.max(TALL + 2, Math.floor(height / pitch));
  const left = Math.floor((cols - WIDE) / 2),
    top = Math.floor((rows - TALL) / 2);
  wall.parentElement.style.setProperty('--cols', cols);
  wall.parentElement.style.setProperty('--pitch', `${pitch}px`);
  const skins = [];
  wall.innerHTML = Array.from({ length: cols * rows }, (_, i) => {
    skins[i] = pick(skins, i, cols);
    const lit = isLit((i % cols) - left, Math.floor(i / cols) - top) ? ' data-lit' : '';
    return `<span class="cell"${lit}>${tag(skins[i], `state="idle" label="" paused${lit ? '' : ' color="current"'}`)}</span>`;
  }).join('');
  ripple.forEach(clearTimeout);
  ripple = [...wall.querySelectorAll('[data-lit] tiny-tell')].map((el, i) =>
    setTimeout(
      () => {
        el.state = 'error';
        el.paused = page.isPaused;
      },
      400 + i * 40
    )
  );
};

/* A tapped tell stays awake long enough to finish a dance or an error. */
const naps = new Map();
const wake = el => {
  if (page.isPaused) return;
  el.paused = false;
  el.removeAttribute('color');
  clearTimeout(naps.get(el));
  naps.set(
    el,
    setTimeout(
      () => {
        if (el.state !== 'idle' || el.parentElement.hasAttribute('data-lit')) return;
        el.paused = true;
        el.setAttribute('color', 'current');
      },
      Math.max(2 * (PERIOD.dance ?? 0), PERIOD.error) * 1000 + 400
    )
  );
};

const [skyLight, skyDark] = QUIET.sky;
wall.style.setProperty('--dance', `light-dark(oklch(${skyLight.join(' ')}), oklch(${skyDark.join(' ')}))`);
wall.addEventListener('tell-dance', e => (e.target.parentElement.dataset.mood = 'dance'));
wall.addEventListener('tell-after-dance', e => {
  const cell = e.target.parentElement;
  if (cell.dataset.mood === 'dance') delete cell.dataset.mood;
});

/* Five taps dance (the play bundle's); ten throw an error for one loop. */
const taps = new WeakMap();
wall.addEventListener('pointerdown', e => {
  const el = e.target.closest('tiny-tell');
  if (!el) return;
  wake(el);
  const cell = el.parentElement;
  if (cell.hasAttribute('data-lit')) return;
  const now = performance.now(),
    log = (taps.get(el) || []).filter(t => now - t < 3000).concat(now);
  if (log.length < 10) return taps.set(el, log);
  taps.delete(el);
  el.state = 'error';
  cell.dataset.mood = 'error';
  setTimeout(() => {
    el.state = 'idle';
    delete cell.dataset.mood;
    wake(el);
  }, PERIOD.error * 1000);
});

const lines = $('lost-lines');
const rotateLines = () => (lines.autoplay = !isStill());
onMotionChange(rotateLines);
rotateLines();

on('pause', () => wall.querySelectorAll('tiny-tell').forEach(el => (el.paused = page.isPaused || el.state === 'idle')));

let lastWidth = innerWidth,
  rebuild = 0;
addEventListener('resize', () => {
  if (innerWidth === lastWidth) return;
  lastWidth = innerWidth;
  clearTimeout(rebuild);
  rebuild = setTimeout(build, 200);
});

start();
/* The wall sizes itself from the room left above the note, so it measures only once the note's components have upgraded. */
Promise.all(['wa-page', 'wa-random-content', 'wa-button'].map(tag => customElements.whenDefined(tag))).then(() =>
  requestAnimationFrame(build)
);
