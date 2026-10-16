import { BEAT, LABEL, STATES } from '../../src/core.js';
import { V1 } from '../shared/copy.js';
import {
  $,
  bindPalettePickers,
  bindPaletteSelect,
  contrast,
  fillCode,
  holdAll,
  keepCore,
  isStill,
  on,
  onMotionChange,
  page,
  radios,
  reducedMotion,
  renderSwatchSheet,
  resolvedPalette,
  spy,
  start,
  store,
  swapText,
  syncInstallTabs,
  tag,
  whenNear,
} from './shared.js';
import './funsies.js';

$('paused-switch').addEventListener('change', e => ($('paused-tell').paused = e.target.checked));

const anySize = () => Number($('any-size').value) || Number($('any-size').getAttribute('value'));
const anySizeRem = () => `${+(anySize() / 16).toFixed(3)}rem`;
const renderAnySize = () => {
  $('any-size-stage').innerHTML =
    `${tag(page.skin, `style="--tell-size: ${anySize()}px"`)}<span>${anySize()}px · ${anySizeRem()}</span>`;
  holdAll($('any-size-stage'));
};
let anySizeFrame = 0;
$('any-size').addEventListener('input', () => {
  $('any-size-stage').querySelector('tiny-tell').style.setProperty('--tell-size', `${anySize()}px`);
  $('any-size-stage').querySelector('span').textContent = `${anySize()}px · ${anySizeRem()}`;
  cancelAnimationFrame(anySizeFrame);
  anySizeFrame = requestAnimationFrame(() =>
    fillCode($('any-size-css'), `tiny-tell { --tell-size: ${anySizeRem()}; }`)
  );
});

const renderPalette = () => {
  renderSwatchSheet($('palette'), $('palette-css'));
  describeA11y();
};
bindPaletteSelect($('palette-preset'));
bindPaletteSelect($('examples-palette'));
bindPalettePickers($('palette'));

const describeA11y = () => {
  const worst = [false, true].map(isDark => {
    const pal = resolvedPalette(isDark);
    return Math.min(...STATES.map(s => contrast(pal[s].rgb, pal.surface)));
  });
  $('a11y-contrast-now').textContent =
    ` With the current one, the lowest state is ${worst[0].toFixed(1)}:1 on light and ${worst[1].toFixed(1)}:1 on dark.`;
};

$('dance').addEventListener('click', () => $('play-tell').dance());

const eventsTell = $('events-tell'),
  eventsStatus = $('events-status');
const restingNote = () =>
  (eventsStatus.textContent = reducedMotion.matches
    ? 'Reduced motion is on, so tells don’t dance.'
    : 'Tap it five times, or press Dance.');
eventsTell.addEventListener('tell-dance', event => {
  if ($('events-hold').checked) {
    event.preventDefault();
    eventsStatus.textContent = 'Asked to dance, and held still.';
  } else {
    eventsStatus.textContent = 'Dancing…';
  }
});
eventsTell.addEventListener('tell-after-dance', event => {
  eventsStatus.textContent = `Back to ${event.target.state}.`;
});
$('events-dance').addEventListener('click', () => eventsTell.dance());
reducedMotion.addEventListener('change', restingNote);
restingNote();

const renderStateTells = () => {
  document.querySelectorAll('#state-rows tiny-tell, tiny-tell[data-follow]').forEach(t => (t.skin = page.skin));
  document
    .querySelectorAll('[data-skin-code]')
    .forEach(code => fillCode(code, code.textContent.replace(/skin="[a-z]+"/g, `skin="${page.skin}"`)));
};
const measureTextSizes = () =>
  document.querySelectorAll('.text-sizes p').forEach(p => {
    const text = parseFloat(getComputedStyle(p).fontSize),
      tell = Math.round(p.querySelector('tiny-tell').getBoundingClientRect().width);
    p.querySelector('[data-measure]').textContent = `${text}px text, ${tell}px tell`;
  });

on('skin', () => {
  renderStateTells();
  renderAnySize();
  renderPalette();
});
on('palette', renderPalette);
on('theme', renderPalette);
const links = [...document.querySelectorAll('.docs-index a')];
spy(
  links,
  links.map(a => $(a.hash.slice(1))),
  { isFirstByDefault: true }
);
const shell = document.querySelector('wa-page');
const sections = [...document.querySelectorAll('.wa-prose > section')];
const restore = section => {
  section.style.blockSize = '';
  delete section.dataset.offstage;
};
// WebKit's modal does work across the whole page, ~1.6 s on these docs, so the drawer opens over only the sections on screen. Each keeps its height so nothing moves.
shell.addEventListener('wa-show', e => {
  if (e.target !== shell) return;
  const rects = sections.map(section => section.getBoundingClientRect());
  sections.forEach((section, i) => {
    const { top, bottom, height } = rects[i];
    if (bottom > 0 && top < innerHeight) return;
    section.style.blockSize = `${height}px`;
    section.dataset.offstage = '';
  });
});
let pendingHash = '';
// WebKit's scroll anchoring can jump thousands of pixels as the sections come back, so the one on screen is held in place.
shell.addEventListener('wa-after-hide', e => {
  if (e.target !== shell) return;
  const anchor = sections.find(section => section.getBoundingClientRect().bottom > 0);
  const top = anchor?.getBoundingClientRect().top;
  sections.forEach(restore);
  if (anchor) scrollBy({ top: anchor.getBoundingClientRect().top - top, behavior: 'instant' });
  if (!pendingHash) return;
  const hash = pendingHash;
  pendingHash = '';
  // Web Awesome hands focus back to the toggle on a timer after this event, and that focus scrolls the page in Chromium and WebKit, so the glide queues behind it.
  setTimeout(() => {
    if (location.hash === hash) $(hash.slice(1))?.scrollIntoView();
    else location.hash = hash;
  });
});
// A drawer link waits for the drawer to close, so the glide starts once every section is back and the page is settled.
shell.addEventListener('click', e => {
  const link = e.target.closest('[slot^="navigation"] a[href^="#"]');
  if (!link) return;
  const isPlain = !(e.metaKey || e.ctrlKey || e.shiftKey || e.altKey);
  if (isPlain && (shell.navOpen || pendingHash)) {
    e.preventDefault();
    pendingHash = link.hash;
  }
  shell.hideNavigation();
});
syncInstallTabs([$('docs-install'), $('play-install'), $('reserve-install')]);

let isCorePicked = true;
const refreshCore = keepCore(
  el => el.matches('.is-core') || (isCorePicked && !el.closest('#play, #events-demo, #funsies'))
);
const bundled = [...document.querySelectorAll('[data-bundle]')].map(el => [el, el.textContent]);
const toPlay = text =>
  text.replace("'tiny-tells'", "'tiny-tells/play'").replace(/tiny-tells(\.min)?\.js/, 'tiny-tells-play$1.js');
const setBundle = isPlay => {
  isCorePicked = !isPlay;
  refreshCore();
  bundled.forEach(([el, text]) => {
    const next = isPlay ? toPlay(text) : text;
    if (el.textContent === next) return;
    if (el.closest('pre')) fillCode(el, next);
    else swapText(el, next);
  });
  $('docs-bundle').checked = isPlay;
  $('examples-play').value = isPlay ? 'play' : 'core';
};
const pickBundle = isPlay => {
  store.set('tells-site-bundle', isPlay ? 'play' : null);
  setBundle(isPlay);
};
$('docs-bundle').addEventListener('change', e => pickBundle(e.target.checked));
$('examples-play').addEventListener('change', e => pickBundle(e.target.value === 'play'));
setBundle(store.get('tells-site-bundle') === 'play');

let beatStart = 0,
  beatOn = -1,
  beatFrame = 0,
  isBeatVisible = false;
const restartBeat = () => {
  $('beat-row').innerHTML = V1.map(s => tag(s, 'label=""')).join('');
  holdAll($('beat-row'));
  beatStart = performance.now();
};
const stepBeat = now => {
  const lit = isStill() ? -1 : Math.floor((now - beatStart) / (BEAT * 1000)) % 4;
  if (lit !== beatOn) [...$('beat-bar').children].forEach((li, i) => li.toggleAttribute('data-on', i === lit));
  beatOn = lit;
  beatFrame = isBeatVisible && lit !== -1 ? requestAnimationFrame(stepBeat) : 0;
};
const runBeat = () => (beatFrame ||= requestAnimationFrame(stepBeat));
// The shared clock stops while tells are off-screen or the tab is hidden, so the bar restarts with them.
restartBeat();
new IntersectionObserver(([e]) => {
  isBeatVisible = e.isIntersecting;
  if (isBeatVisible) restartBeat();
  runBeat();
}).observe($('beat-row'));
document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && restartBeat());
$('beat-restart').addEventListener('click', restartBeat);
on('pause', () => page.isPaused || restartBeat());
onMotionChange(runBeat);

$('handoff-state').innerHTML = radios(STATES);
const cut = state => ($('cut-slot').innerHTML = tag(page.skin, `state="${state}" data-follow label=""`));
$('handoff-state').addEventListener('change', e => {
  cut(e.target.value);
  holdAll($('cut-slot'));
  $('handoff-tell').state = e.target.value;
});
cut('working');

const SIZES = [20, 24, 32, 48];
$('size-ladder').innerHTML = ['eyes', 'dekatron']
  .map(
    s =>
      `<div class="size-row"><code>${s}</code>${SIZES.map(px => `<figure class="${px > 32 ? 'is-full' : ''}">${tag(s, `style="--tell-size: ${px}px" label=""`)}<figcaption>${px}</figcaption></figure>`).join('')}</div>`
  )
  .join('');

/* The grid holds over half the page's tells, so it fills in only as a reader nears it. Same-size cells keep its space until then. */
$('stress-grid').innerHTML = '<i class="stress-cell"></i>'.repeat(100);
let isStressBuilt = false;
const buildStress = () => {
  if (isStressBuilt) return;
  isStressBuilt = true;
  $('stress-grid').innerHTML = Array.from({ length: 100 }, (_, i) =>
    tag(V1[i % V1.length], `state="${STATES[Math.floor(i / V1.length) % STATES.length]}" label="" paused`)
  ).join('');
};
whenNear([$('stress-grid')], buildStress);
let isStressRunning = false,
  frames = 0,
  since = 0,
  counter = 0;
const countFrames = now => {
  frames++;
  if (now - since >= 1000) {
    $('stress-fps').textContent = `${Math.round((frames * 1000) / (now - since))} fps with 100 tells moving`;
    frames = 0;
    since = now;
  }
  counter = requestAnimationFrame(countFrames);
};
const holdStress = () => {
  const isMoving = isStressRunning && !isStill();
  $('stress-grid')
    .querySelectorAll('tiny-tell')
    .forEach(t => (t.paused = !isMoving));
  cancelAnimationFrame(counter);
  $('stress-run').textContent = isStressRunning ? 'Hold Still' : 'Run All 100';
  if (!isStressRunning) $('stress-fps').textContent = 'Held still for now.';
  else if (!isMoving) $('stress-fps').textContent = 'Motion is off on this page, so they hold still.';
  else {
    $('stress-fps').textContent = 'Measuring…';
    frames = 0;
    since = performance.now();
    counter = requestAnimationFrame(countFrames);
  }
};
$('stress-run').addEventListener('click', () => {
  buildStress();
  isStressRunning = !isStressRunning;
  holdStress();
});
onMotionChange(holdStress);

start();
renderAnySize();
renderStateTells();
requestAnimationFrame(measureTextSizes);

const startTell = $('start-tell');
let startTimer = 0;
$('start-run').addEventListener('click', () => {
  clearTimeout(startTimer);
  startTell.state = 'done';
  $('start-status').textContent = 'Synced 3 files.';
  startTimer = setTimeout(() => {
    startTell.state = 'working';
    $('start-status').textContent = 'Syncing 3 files…';
  }, 2400);
});

const saveTell = $('wa-save-tell'),
  saveLabel = $('wa-save-label');
let saveTimers = [];
$('wa-save').addEventListener('click', () => {
  saveTimers.forEach(clearTimeout);
  saveTell.state = 'working';
  saveLabel.textContent = 'Saving…';
  saveTimers = [
    setTimeout(() => {
      saveTell.state = 'done';
      saveLabel.textContent = 'Saved';
    }, 1600),
    setTimeout(() => {
      saveTell.state = 'idle';
      saveLabel.textContent = 'Save';
    }, 4000),
  ];
});

const SYSTEM_TOKENS = {
  working: ['accent', 'brand'],
  done: ['success', 'success'],
  error: ['danger', 'danger'],
  warning: ['warning', 'warning'],
  idle: ['neutral', 'neutral'],
};
document.querySelectorAll('.system-well').forEach(well => {
  well.setAttribute(
    'style',
    STATES.map(s => {
      const [name, wa] = SYSTEM_TOKENS[s];
      return `--color-${name}: var(--wa-color-${wa}-fill-loud); --tell-color-${s}: var(--color-${name});`;
    }).join(' ')
  );
  well.innerHTML = STATES.map(s => tag(page.skin, `state="${s}" data-follow label="${LABEL[s]}"`)).join('');
});

let isDemoPaused = false;
$('pause-demo-button').addEventListener('click', e => {
  isDemoPaused = !isDemoPaused;
  e.currentTarget.textContent = isDemoPaused ? 'Play Animations' : 'Pause Animations';
  $('pause-demo')
    .querySelectorAll('tiny-tell')
    .forEach(tell => (tell.paused = isDemoPaused));
});
