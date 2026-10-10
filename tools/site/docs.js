import { BEAT, LABEL, STATES } from '../../src/core.js';
import { DANCE, HOOKS } from '../../src/element.js';
import API from '../../src/api.json';
import { V1 } from '../shared/copy.js';
import {
  $,
  bindPalettePickers,
  bindPaletteSelect,
  contrast,
  fillCode,
  holdAll,
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
} from './shared.js';
import './funsies.js';

const ATTR = Object.fromEntries(API.attributes.map(a => [a.name, a]));

$('tell-rows').innerHTML = V1.map(
  s =>
    `<tr><td class="tell-cell">${tag(s, 'label=""')}</td><th scope="row"><code>${s}</code></th><td>${ATTR.skin.values[s]}</td></tr>`
).join('');
const USE_IT = {
  working: 'For the whole wait, from the first step to the last.',
  done: 'Once the work is really finished, not just sent.',
  error: 'Always with words beside it that say what broke.',
  warning: 'When someone has to act on an approval, a conflict, or a sign-in, and nothing is broken.',
  idle: 'For anything ready, queued, or up to date, when nobody is waiting on it.',
};
$('state-rows').innerHTML = STATES.map(
  s =>
    `<tr><td class="tell-cell">${tag(page.skin, `state="${s}" label=""`)}</td><th scope="row"><code>${s}</code></th><td>${ATTR.state.values[s]}</td><td>${USE_IT[s]}</td></tr>`
).join('');
const GUIDE = {
  skin: '#tells',
  state: '#states',
  color: '#match-text',
  scheme: '#match-scheme',
  label: '#labels',
  paused: '#pausing',
};
$('attr-rows').innerHTML = API.attributes
  .map(
    a =>
      `<tr><th scope="row"><code>${a.name}</code></th><td>${
        a.name === 'skin'
          ? 'One of the six <a href="#tells">tells</a>'
          : a.name === 'state'
            ? 'One of the five <a href="#states">states</a>'
            : a.values
              ? Object.keys(a.values)
                  .map(v => `<code>${v}</code>`)
                  .join(', ')
              : a.type === 'boolean'
                ? 'boolean'
                : 'text'
      }<br><span class="wa-caption-s">${a.description} <a href="${GUIDE[a.name]}">How to use it</a>.</span></td><td>${a.default == null || a.default === false ? '—' : `<code>${a.default}</code>`}</td></tr>`
  )
  .join('');
const codeify = text => text.replace(/\b\w+\(\)/g, '<code>$&</code>');
$('event-rows').innerHTML = API.events
  .map(
    e =>
      `<tr><th scope="row"><code>${e.name}</code></th><td>${e.cancelable ? 'Yes' : 'No'}</td><td>${codeify(e.description)}</td></tr>`
  )
  .join('');
$('static-rows').innerHTML = API.statics
  .map(
    m =>
      `<tr><th scope="row"><span class="wa-cluster wa-gap-xs wa-flex-nowrap"><code>${API.class}.${m.name}</code>${m.readonly ? '<wa-tag class="studio" appearance="outlined" size="xs">Read-Only</wa-tag>' : ''}</span></th><td><code>${m.type}</code></td><td>${m.description}</td></tr>`
  )
  .join('');
$('schemes').innerHTML = ['wa-light', 'wa-dark']
  .map(
    c =>
      `<div class="${c} scheme-box wa-stack wa-gap-s"><p>${c === 'wa-light' ? 'In a light region' : 'In a dark region'}</p><div class="wa-cluster wa-gap-m">${['auto', 'light', 'dark', 'invert'].map(sc => `<figure class="wa-stack wa-gap-2xs wa-align-items-center">${tag(page.skin, `scheme="${sc}" data-follow`)}<figcaption><code>${sc}</code></figcaption></figure>`).join('')}</div></div>`
  )
  .join('');

const LABEL_CASES = [
  [null, 'no <code>label</code>'],
  ['Uploading photos', '<code>label="Uploading photos"</code>'],
  ['', '<code>label=""</code>'],
];
$('label-cases').innerHTML = LABEL_CASES.map(
  ([label, markup]) =>
    `<tr><td>${tag(page.skin, `data-follow${label === null ? '' : ` label="${label}"`}`)}</td><th scope="row">${markup}</th><td data-hears></td></tr>`
).join('');
const readLabels = () =>
  $('label-cases')
    .querySelectorAll('tr')
    .forEach(row => {
      const tell = row.querySelector('tiny-tell').shadowRoot?.querySelector('[part="tell"]');
      row.querySelector('[data-hears]').textContent =
        tell?.getAttribute('aria-hidden') === 'true'
          ? 'Nothing. The tell is hidden.'
          : `“${tell?.getAttribute('aria-label') ?? LABEL.working}”, an image`;
    });
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
  $('a11y').innerHTML = [
    ['A name', 'Shows up as an image named by its state, or by the <code>label</code> attribute.'],
    ['Reduced motion', 'Holds one still pose per state, and play turns off.'],
    ['Forced colors', 'Draws in the system text color under Windows high contrast.'],
    [
      'Contrast',
      `Meets 3:1 with the built-in palette. With the current one, the lowest state is ${worst[0].toFixed(1)}:1 on light and ${worst[1].toFixed(1)}:1 on dark.`,
    ],
    ['Flashing', 'Never flashes more than three times a second.'],
    ['Off-screen', 'Stops animating while it’s scrolled out of view.'],
    ['Pausing', 'Holds its current frame with the <code>paused</code> attribute.'],
  ]
    .map(([need, tell]) => `<li><strong>${need}.</strong> ${tell}</li>`)
    .join('');
};

$('dance').addEventListener('click', () => $('play-tell')[DANCE]?.());

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
$('events-dance').addEventListener('click', () => eventsTell[DANCE]?.());
reducedMotion.addEventListener('change', restingNote);
restingNote();
// The page runs play, so tells act as core by hand: everywhere when Core is picked, and always in the comparison.
let isCorePicked = true;
const isCore = el => el.matches('.is-core') || (isCorePicked && !el.closest('#play, #events-demo, #funsies'));
const playGaze = HOOKS.gaze;
HOOKS.gaze = el => (isCore(el) ? null : playGaze(el));
document.addEventListener(
  'pointerdown',
  e => {
    const tell = e.composedPath().find(n => n.localName === 'tiny-tell');
    if (tell && isCore(tell)) e.stopPropagation();
  },
  true
);

const renderStateTells = () => {
  document.querySelectorAll('#state-rows tiny-tell, tiny-tell[data-follow]').forEach(t => (t.skin = page.skin));
  document
    .querySelectorAll('[data-skin-code]')
    .forEach(code => fillCode(code, code.textContent.replace(/skin="[a-z]+"/, `skin="${page.skin}"`)));
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
shell.addEventListener('click', e => {
  if (e.target.closest('[slot^="navigation"] a[href^="#"]')) shell.hideNavigation();
});
syncInstallTabs([$('docs-install'), $('play-install'), $('reserve-install')]);

const bundled = [...document.querySelectorAll('[data-bundle]')].map(el => [el, el.textContent]);
const toPlay = text =>
  text.replace("'tiny-tells'", "'tiny-tells/play'").replace(/tiny-tells(\.min)?\.js/, 'tiny-tells-play$1.js');
const setBundle = isPlay => {
  isCorePicked = !isPlay;
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
document
  .querySelectorAll('main section[id] > h2, main section h3[id]')
  .forEach(h =>
    h.insertAdjacentHTML(
      'beforeend',
      `<a class="heading-anchor" href="#${h.localName === 'h2' ? h.parentElement.id : h.id}" aria-hidden="true" tabindex="-1"><wa-icon family="sharp" variant="regular" name="anchor" label="Link to ${h.textContent}"></wa-icon></a>`
    )
  );

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
new IntersectionObserver(
  ([e], observer) => {
    if (!e.isIntersecting) return;
    buildStress();
    observer.disconnect();
  },
  { rootMargin: '100% 0px' }
).observe($('stress-grid'));
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
requestAnimationFrame(() => {
  readLabels();
  measureTextSizes();
});

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

$('pause-demo-button').addEventListener('click', e => {
  const isPaused = e.currentTarget.getAttribute('aria-pressed') !== 'true';
  e.currentTarget.setAttribute('aria-pressed', isPaused);
  e.currentTarget.textContent = isPaused ? 'Play Animations' : 'Pause Animations';
  $('pause-demo')
    .querySelectorAll('tiny-tell')
    .forEach(tell => (tell.paused = isPaused));
});
