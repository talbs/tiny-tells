import { LABEL, STATES } from '../../src/core.js';
import { DANCE, HOOKS } from '../../src/element.js';
import API from '../../src/api.json';
import { version as VERSION } from '../../package.json';
import { GOES, MODEL, NAMES, NOTES, V1 } from '../shared/copy.js';
import { onionSkin } from '../shared/onion.js';
import {
  $,
  PROMPT,
  applyPalette,
  bindPalettePickers,
  bindPaletteSelect,
  fillCode,
  holdAll,
  isStill,
  morphInto,
  on,
  onMotionChange,
  page,
  palette,
  radios,
  renderSwatchSheet,
  setSkin,
  spy,
  start,
  store,
  swapText,
  tag,
} from './shared.js';

const renderSheet = () => renderSwatchSheet($('palette'), $('palette-css'));
const SKIN_BLURB = API.attributes.find(a => a.name === 'skin').values;
const HERO_SAY = {
  working: 'Checking with Monk’s Café…',
  done: 'Booked. Monk’s Café, Friday at 7:30, the usual booth.',
  error: 'Monk’s is full on Friday. Try Saturday?',
  warning: 'Monk’s needs a card to hold the booth. Add one?',
  idle: 'Ready when you are.',
};
const UPLOAD_PCT = { working: 40, done: 100, error: 40, warning: 100, idle: 0 };
const CELS = [
  {
    name: 'chat',
    skin: 'eyes',
    say: HERO_SAY,
    html: (t, c) =>
      `<p class="cel-ask">Can you book a table for four on Friday?</p><div class="cel-reply wa-cluster wa-flex-nowrap">${t}<p data-say>${c}</p></div>`,
  },
  {
    name: 'files',
    skin: 'blot',
    say: {
      working: 'Uploading, 40%',
      done: 'Uploaded.',
      error: 'Upload failed. Try again?',
      warning: 'Replace the older copy?',
      idle: 'Drop a file to upload.',
    },
    html: (t, c, s) =>
      `${t}<p class="cel-file">trip-photos.zip<span>48 MB</span></p><span class="cel-bar"><i style="inline-size: ${UPLOAD_PCT[s]}%"></i></span><p data-say>${c}</p>`,
  },
  {
    name: 'terminal',
    skin: 'flipdot',
    say: {
      working: 'Running 59 tests…',
      done: '59 passed.',
      error: '2 failed. See the log.',
      warning: 'A snapshot changed. Update it?',
      idle: 'Watching for changes.',
    },
    html: (t, c) =>
      `<p class="cel-cmd">${PROMPT}npm test</p><div class="cel-out wa-cluster wa-gap-s wa-flex-nowrap">${t}<p data-say>${c}</p></div>`,
  },
  {
    name: 'ci',
    skin: 'drones',
    say: {
      working: 'Running',
      done: 'Passed',
      error: 'Failed',
      warning: 'Needs approval',
      idle: 'Queued',
    },
    html: (t, c) =>
      `<p class="cel-ci-title">Checks</p><ul class="ci-list wa-list-plain"><li>${tag('drones', 'state="done" label=""')}<span>Lint</span><em>Passed</em></li><li>${t}<span>Unit tests</span><em data-say>${c}</em></li><li>${tag('drones', 'state="idle" label=""')}<span>Deploy preview</span><em>Queued</em></li></ul>`,
  },
];
const heroCels = CELS.map((cel, i) => ({ ...cel, at: (i * 2) % STATES.length, timer: 0 }));
$('hero-cast').innerHTML = heroCels
  .map(cel => {
    const s = STATES[cel.at],
      scheme = cel.name === 'terminal' ? ' scheme="dark"' : '';
    return `<figure class="cel cel-${cel.name}${cel.name === 'terminal' ? ' studio force-dark wa-dark' : ''}">${cel.html(tag(cel.skin, `state="${s}" label="" data-cycle${scheme}`), cel.say[s], s)}</figure>`;
  })
  .join('');
const stepCel = (cel, el) => {
  cel.at = (cel.at + 1) % STATES.length;
  const s = STATES[cel.at];
  el.querySelector('[data-cycle]').state = s;
  swapText(el.querySelector('[data-say]'), cel.say[s]);
  const bar = el.querySelector('.cel-bar i');
  if (bar) bar.style.inlineSize = `${UPLOAD_PCT[s]}%`;
};
const runCels = isOn =>
  heroCels.forEach((cel, i) => {
    clearTimeout(cel.timer);
    clearInterval(cel.timer);
    if (!isOn) return;
    const el = $('hero-cast').children[i];
    cel.timer = setTimeout(
      () => {
        stepCel(cel, el);
        cel.timer = setInterval(() => stepCel(cel, el), 3200);
      },
      1600 + i * 530
    );
  });
runCels(!isStill());
onMotionChange(() => runCels(!isStill()));
const cast = $('hero-cast'),
  dots = $('cast-dots');
dots.innerHTML = ['Chat', 'File upload', 'Terminal', 'CI checks']
  .map(name => `<button type="button" aria-label="${name}"></button>`)
  .join('');
dots.addEventListener('click', e => {
  const i = [...dots.children].indexOf(e.target);
  if (i < 0) return;
  const el = cast.children[i];
  cast.scrollTo({ left: el.offsetLeft - cast.firstElementChild.offsetLeft, behavior: isStill() ? 'auto' : 'smooth' });
});
const markDot = () => {
  const step = cast.children[1].offsetLeft - cast.firstElementChild.offsetLeft,
    isAtEnd = cast.scrollLeft >= cast.scrollWidth - cast.clientWidth - 2,
    at = isAtEnd ? dots.children.length - 1 : Math.round(cast.scrollLeft / step);
  [...dots.children].forEach((dot, i) => dot.setAttribute('aria-current', i === at));
};
cast.addEventListener('scroll', markDot, { passive: true });
markDot();
const stage = document.querySelector('.hero-stage'),
  notes = stage.querySelector('.hand-notes');
const offsetIn = el => {
  let x = el.offsetWidth / 2,
    y = el.offsetHeight / 2;
  for (let n = el; n && n !== stage; n = n.offsetParent) {
    x += n.offsetLeft;
    y += n.offsetTop;
  }
  return [x, y];
};
const placeNotes = () =>
  [
    ['eyes', '.cel-reply tiny-tell'],
    ['flip', '.cel-out tiny-tell'],
  ].forEach(([name, sel]) => {
    const [x, y] = offsetIn(stage.querySelector(sel));
    notes.style.setProperty(`--${name}-x`, `${x}px`);
    notes.style.setProperty(`--${name}-y`, `${y}px`);
    notes.dataset.placed = '';
  });
new ResizeObserver(placeNotes).observe(stage);

let castState = 'working',
  anySize = 36;
const live = (skin, attrs = '') => tag(skin, `state="${castState}" data-live ${attrs}`);
const placeNotesHl = isInstant => {
  const hl = $('notes').querySelector('.notes-hl'),
    on = $('notes').querySelector('[aria-pressed="true"]');
  if (!hl || !on) return;
  if (isInstant) hl.style.transition = 'none';
  hl.style.transform = `translateY(${on.offsetTop}px)`;
  hl.style.blockSize = `${on.offsetHeight}px`;
  if (isInstant) requestAnimationFrame(() => (hl.style.transition = ''));
};
new ResizeObserver(() => placeNotesHl(true)).observe($('notes'));
const setCastState = s => {
  castState = s;
  document.querySelectorAll('tiny-tell[data-live]').forEach(t => (t.state = s));
  $('notes')
    .querySelectorAll('[data-state]')
    .forEach(b => b.setAttribute('aria-pressed', b.dataset.state === s));
  placeNotesHl();
  if ($('wild-state').value !== s) $('wild-state').value = s;
  renderWild();
};
$('wild-state').innerHTML = radios(
  STATES,
  STATES.map(s => LABEL[s])
);
$('wild-state').value = castState;
$('wild-state').addEventListener('change', e => setCastState(e.target.value));

$('cast-pick').innerHTML = V1.map(
  s =>
    `<wa-radio appearance="button" value="${s}"><span class="wa-stack wa-gap-s"><span class="cast-name">${NAMES[s]}</span><span class="cast-field">${tag(s, 'label=""')}</span></span></wa-radio>`
).join('');
$('cast-pick').addEventListener('change', e => setSkin(e.target.value));
const renderCast = () => {
  const skin = page.skin,
    m = MODEL[skin];
  $('cast-pick').value = skin;
  $('cast-name').textContent = NAMES[skin];
  $('cast-who').textContent = SKIN_BLURB[skin];
  $('play-tell').skin = skin;
  $('stage').innerHTML = live(skin);
  $('stage-ship').innerHTML = [48, 32, 24, 20]
    .map(z => `<figure>${live(skin, `style="--tell-size: ${z}px" label=""`)}<figcaption>${z}</figcaption></figure>`)
    .join('');
  $('any-size-tell').innerHTML = live(skin, `style="--tell-size: ${anySize}px" label=""`);
  $('cast-goes').innerHTML =
    `<span class="goes-label">Best for<span class="wa-visually-hidden">: </span></span>${GOES[skin].map((use, i) => `<wa-tag appearance="outlined" size="xs">${i ? '<span class="wa-visually-hidden">, </span>' : ''}${use}</wa-tag>`).join('')}`;
  $('notes').innerHTML =
    '<span class="notes-hl" aria-hidden="true"></span>' +
    STATES.map(
      s =>
        `<button type="button" data-state="${s}" aria-pressed="${s === castState}">${tag(skin, `state="${s}" label=""`)}<span class="notes-key">${LABEL[s]}</span><span>${NOTES[skin][s]}</span></button>`
    ).join('');
  placeNotesHl(true);
  $('cast-build').innerHTML = [
    ['Made of', m.made],
    ['Notices You', m.notice],
    ['Handoff', m.handoff],
    ['Dance', m.dance],
  ]
    .map(([k, v]) => `<div class="wa-stack wa-gap-2xs"><dt>${k}</dt><dd>${v}</dd></div>`)
    .join('');
  holdAll($('tells'));
  holdAll($('install'));
};
$('notes').addEventListener('click', e => {
  const btn = e.target.closest('[data-state]');
  if (btn) setCastState(btn.dataset.state);
});

const onion = { isOn: false, skin: onionSkin() };
const onionFrame = () => {
  const ghost = $('onion'),
    src = $('stage').querySelector('tiny-tell')?.shadowRoot?.querySelector('[part="tell"]');
  if (!onion.isOn) return ghost.getContext('2d').clearRect(0, 0, ghost.width, ghost.height);
  requestAnimationFrame(onionFrame);
  if (!src || src.width < 2) return;
  const tell = src.getBoundingClientRect(),
    sheet = ghost.parentElement.getBoundingClientRect();
  Object.assign(ghost.style, {
    inset: 'auto',
    left: `${tell.left - sheet.left}px`,
    top: `${tell.top - sheet.top}px`,
    width: `${tell.width}px`,
    height: `${tell.height}px`,
  });
  onion.skin.draw(ghost, src, getComputedStyle(ghost).getPropertyValue('--guide').trim() || '#4f9fd6');
};
$('onion-toggle').addEventListener('change', e => {
  onion.isOn = e.target.checked;
  onion.skin.reset();
  onionFrame();
});
let isGuides = true;
const applyGuides = () => document.querySelectorAll('.studio').forEach(el => el.classList.toggle('is-bare', !isGuides));
$('guides-toggle').checked = isGuides;
applyGuides();
let isCastPlay = true;
const playGaze = HOOKS.gaze;
HOOKS.gaze = el => (!isCastPlay && el.closest('#tells') ? null : playGaze?.(el));
$('tells').addEventListener('pointerdown', e => isCastPlay || e.stopPropagation());
$('play-toggle').addEventListener('change', e => (isCastPlay = e.target.checked));
$('guides-toggle').addEventListener('change', e => {
  isGuides = e.target.checked;
  applyGuides();
});
$('any-size').value = anySize;
$('any-size-value').textContent = anySize;
$('any-size').addEventListener('input', e => {
  anySize = Number(e.target.value);
  $('any-size-value').textContent = anySize;
  $('any-size-tell').querySelector('tiny-tell')?.style.setProperty('--tell-size', `${anySize}px`);
});

bindPaletteSelect($('palette-preset'));
bindPaletteSelect($('palette-preset-select'));
bindPalettePickers($('palette'));
const WILD = [
  {
    name: 'Assistant Reply',
    skin: 'eyes',
    copy: {
      working: 'Reading your notes…',
      done: 'Done. Three things need you.',
      error: 'Two files wouldn’t open. Resend?',
      warning: 'One note is private. Read it?',
      idle: 'Ask me anything.',
    },
    html: (t, c) =>
      `<div class="wild-chat"><p class="cel-ask">Summarize this week’s notes?</p><p class="wa-cluster wa-gap-xs wa-flex-nowrap">${t}<span role="status">${c}</span></p><p class="wild-composer" aria-hidden="true">Reply…</p></div>`,
  },
  {
    name: 'CI Checks',
    skin: 'flipdot',
    copy: { working: 'Running', done: 'Passed', error: 'Failed', warning: 'Needs approval', idle: 'Queued' },
    html: (t, c, sk) =>
      `<div class="wild-ci"><p class="cel-ci-title">Checks</p><ul class="ci-list wa-list-plain"><li>${tag(sk, 'state="done" label=""')}<span>Lint</span><em>Passed</em></li><li>${t}<span>Unit tests</span><em role="status">${c}</em></li><li>${tag(sk, 'state="idle" label=""')}<span>Deploy preview</span><em>Queued</em></li></ul></div>`,
  },
  {
    name: 'File Upload',
    skin: 'blot',
    copy: {
      working: 'Uploading, 62%',
      done: 'Uploaded',
      error: 'Upload failed. Try again?',
      warning: 'This file is over 10 MB. Compress it?',
      idle: 'Ready to upload',
    },
    html: (t, c, sk, s) =>
      `<div class="wild-upload"><p class="wild-file wa-cluster wa-gap-xs wa-flex-nowrap"><wa-icon family="sharp" variant="regular" name="file-pdf"></wa-icon><strong>resume.pdf</strong><span>240 KB</span>${t}</p><wa-progress-bar value="${{ working: 62, done: 100, error: 62, warning: 0, idle: 0 }[s]}" label="Upload progress"></wa-progress-bar><p class="wild-say" role="status">${c}</p></div>`,
  },
  {
    name: 'Status Bar',
    skin: 'lens',
    copy: {
      working: 'Saving…',
      done: 'Saved',
      error: 'Retrying save…',
      warning: 'Offline. Not saved',
      idle: 'No changes',
    },
    html: (t, c) =>
      `<div class="wild-editor"><div class="wild-doc" aria-hidden="true"><i></i><i></i><i></i></div><p class="statusbar wa-cluster wa-gap-m wa-flex-nowrap"><span>Draft</span><span>1,204 words</span><span class="statusbar-save wa-cluster wa-gap-xs wa-flex-nowrap">${t}<span role="status">${c}</span></span></p></div>`,
  },
  {
    name: 'Button',
    skin: 'drones',
    copy: {
      working: 'Downloading 12 songs…',
      done: 'Ready to play offline',
      error: 'Download failed. Retry',
      warning: 'Not on Wi-Fi. Download anyway?',
      idle: 'Download album',
    },
    html: (t, c) =>
      `<wa-button>${t.replace('<tiny-tell', '<tiny-tell slot="start" color="current"')}<span>${c}</span></wa-button>`,
  },
  {
    name: 'Inline in Text',
    skin: 'dekatron',
    copy: {
      working: 'On its way. About 20 minutes.',
      done: 'Delivered. Enjoy!',
      error: 'Canceled. You’ve been refunded.',
      warning: 'Which door? Add a delivery note.',
      idle: 'Waiting for a driver.',
    },
    html: (t, c) =>
      `<div class="wild-order"><p class="wild-order-head wa-split"><span>Order #4821</span><span>2 items</span></p><p class="wild-order-say">${t} <span>${c}</span></p></div>`,
  },
];
const wildBody = (ex, s) => ex.html(tag(ex.skin, `state="${s}" label="${ex.copy[s]}"`), ex.copy[s], ex.skin, s);
const wildHTML = () =>
  WILD.map(
    ex =>
      `<article class="wild-card"><div class="wild-screen">${wildBody(ex, castState)}</div><footer class="wild-meta"><h3 class="label wa-text-truncate">${ex.name}</h3></footer></article>`
  ).join('');
const renderWild = () => {
  morphInto($('wild-grid'), wildHTML());
  holdAll($('wild-grid'));
};

const builder = { tell: page.skin, state: 'working', size: 'text', words: 'Syncing 3 files…' };
const esc = t => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const builderHTML = () => {
  const { tell, state, size } = builder,
    words = builder.words.trim(),
    attrs = [`skin="${tell}"`, `state="${state}"`];
  if (size !== 'text') attrs.push(`style="--tell-size: ${size / 16}rem"`);
  if (words) attrs.push('label=""');
  const el = pad => `<tiny-tell\n${attrs.map(x => `${pad}  ${x}`).join('\n')}\n${pad}></tiny-tell>`;
  return words ? `<p>\n  ${el('  ')}\n  <span role="status">${esc(words)}</span>\n</p>` : el('');
};
const renderBuilder = ({ isTyping = false } = {}) => {
  const html = builderHTML();
  document.querySelectorAll('.b-code').forEach(code => fillCode(code, html));
  morphInto($('b-preview'), html, { isTextAnimated: !isTyping });
  holdAll($('b-preview'));
};
$('b-tell').innerHTML = radios(
  V1,
  V1.map(s => NAMES[s])
);
$('b-tell').setAttribute('value', builder.tell);
$('b-state').innerHTML = radios(
  STATES,
  STATES.map(s => LABEL[s])
);
$('b-state').value = builder.state;
$('b-size').innerHTML = radios(['text', '20', '24', '32', '48'], ['Match Text', '20', '24', '32', '48']);
$('b-size').value = builder.size;
[
  ['b-tell', 'tell', 'change'],
  ['b-size', 'size', 'change'],
].forEach(([id, key, type]) =>
  $(id).addEventListener(type, () => {
    builder[key] = $(id).value;
    renderBuilder();
  })
);
const ideas = state => $('b-ideas').querySelector(`[data-state="${state}"]`);
const setWords = text => {
  builder.words = $('b-words').value = text;
  builder.isCanned = true;
};
builder.isCanned = true;
$('b-words').addEventListener('input', e => {
  builder.words = e.target.value;
  builder.isCanned = false;
  renderBuilder({ isTyping: true });
});
$('b-state').addEventListener('change', e => {
  builder.state = e.target.value;
  if (builder.isCanned) setWords(ideas(builder.state).querySelector(':scope > :not([hidden])').textContent);
  renderBuilder();
});
$('b-shuffle').addEventListener('click', () => {
  const current = builder.words;
  let [pick] = ideas(builder.state).randomize();
  if (pick?.textContent === current) [pick] = ideas(builder.state).randomize();
  if (!pick) return;
  setWords(pick.textContent);
  renderBuilder();
});

const INSTALL = {
  npm: {
    lang: 'bash',
    code: 'npm i tiny-tells',
    play: "import 'tiny-tells/play'; // instead of 'tiny-tells'",
    note: 'Then import it once in your app: <code>import \'tiny-tells\'</code>, or <a href="#play">the play bundle</a> for extras.',
  },
  cdn: {
    lang: 'html',
    code: `<script type="module" src="https://cdn.jsdelivr.net/npm/tiny-tells@${VERSION}/dist/tiny-tells.min.js"></script>`,
    play: `<script type="module" src="https://cdn.jsdelivr.net/npm/tiny-tells@${VERSION}/dist/tiny-tells-play.min.js"></script>`,
    note: 'Add it to your page once, or load <a href="#play">the play bundle</a> instead for extras.',
  },
};
$('b-method').innerHTML = radios(['npm', 'cdn'], ['npm', 'CDN']);
const setMethod = method => {
  const m = INSTALL[method] || INSTALL.npm,
    code = $('b-install');
  code.className = `language-${m.lang}`;
  fillCode(code, m.code);
  $('play-install').className = method === 'cdn' ? 'language-html' : 'language-javascript';
  fillCode($('play-install'), m.play);
  $('b-install-note').innerHTML = m.note;
  $('b-method').value = method;
};
$('b-method').addEventListener('change', e => {
  store.set('tells-site-install', e.target.value === 'npm' ? null : e.target.value);
  setMethod(e.target.value);
});

on('skin', () => {
  builder.tell = page.skin;
  $('b-tell').value = page.skin;
  renderBuilder();
});
on('skin', renderCast);
on('skin', renderSheet);
on('palette', renderSheet);
on('theme', renderSheet);
spy([...document.querySelectorAll('.sections a[href*="#"]')], ['tells', 'color', 'wild', 'install'].map($));
start();
setMethod(store.get('tells-site-install') === 'cdn' ? 'cdn' : 'npm');
renderCast();
renderWild();
renderBuilder();
const syncPaletteFoot = () => {
  $('palette-note').hidden = !['wa', 'tailwind', 'bootstrap', 'primer'].includes(palette.preset);
  $('palette-reset').hidden = palette.preset !== 'custom' || !Object.keys(palette.custom).length;
};
$('palette-reset').addEventListener('click', () => {
  palette.custom = {};
  applyPalette();
});
on('palette', syncPaletteFoot);
syncPaletteFoot();
$('play-dance').addEventListener('click', () => $('play-tell')[DANCE]?.());
