import '../../src/tiny-tells-play.js';
import { DANCE } from '../../src/element.js';
import { LABEL, QUIET, STATES, STATE_COLOR, toSrgb } from '../../src/core.js';
import { NAMES, V1 } from '../shared/copy.js';

export const $ = id => document.getElementById(id);
export const store = {
  get: k => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set: (k, v) => {
    try {
      v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v);
    } catch {}
  },
};
export const radios = (values, labels = values) =>
  values.map((v, i) => `<wa-radio appearance="button" value="${v}">${labels[i]}</wa-radio>`).join('');
export const tag = (skin, attrs = '') => `<tiny-tell skin="${skin}" ${attrs}></tiny-tell>`;
export const isDarkPage = () => document.documentElement.classList.contains('wa-dark');

const listeners = { skin: [], theme: [], pause: [], palette: [] };
export const on = (event, fn) => listeners[event].push(fn);
const emit = event => listeners[event].forEach(fn => fn());

export const page = {
  isPaused: false,
  skin: V1.includes(store.get('tells-site-skin')) ? store.get('tells-site-skin') : 'drones',
};
export const holdAll = root => root.querySelectorAll('tiny-tell').forEach(t => (t.paused = page.isPaused));

const systemDark = matchMedia('(prefers-color-scheme: dark)');
const applyTheme = () => {
  const override = store.get('tells-site-theme'),
    isDark = override ? override === 'dark' : systemDark.matches;
  document.documentElement.classList.toggle('wa-dark', isDark);
  document.documentElement.classList.toggle('wa-light', !isDark);
  document.documentElement.dataset.theme = isDark ? 'dark' : 'light';
  const [moon, lamp] = $('theme').querySelectorAll('wa-icon');
  moon.label = isDark ? '' : 'Switch to Dark';
  lamp.label = isDark ? 'Switch to Light' : '';
  emit('theme');
};
$('theme').addEventListener('click', () => {
  const next = isDarkPage() ? 'light' : 'dark';
  store.set('tells-site-theme', (next === 'dark') === systemDark.matches ? null : next);
  applyTheme();
});
systemDark.addEventListener('change', applyTheme);

$('pause').addEventListener('click', () => {
  page.isPaused = !page.isPaused;
  holdAll(document);
  const [pause, play] = $('pause').querySelectorAll('wa-icon');
  pause.label = page.isPaused ? '' : 'Pause All Motion';
  play.label = page.isPaused ? 'Play All Motion' : '';
  document.documentElement.classList.toggle('is-paused', page.isPaused);
  emit('pause');
});

$('page-tell')?.insertAdjacentHTML(
  'beforeend',
  V1.map(s => `<wa-option value="${s}">${NAMES[s]}</wa-option>`).join('')
);
export const setSkin = next => {
  page.skin = next;
  store.set('tells-site-skin', next === 'drones' ? null : next);
  if ($('page-tell')) $('page-tell').value = next;
  emit('skin');
};
$('page-tell')?.addEventListener('change', e => setSkin(e.target.value));

const swatch = Object.assign(document.createElement('canvas'), { width: 1, height: 1 }).getContext('2d', {
  willReadFrequently: true,
});
const toRgb = str => {
  swatch.clearRect(0, 0, 1, 1);
  swatch.fillStyle = 'rgb(0 0 0 / 0)';
  swatch.fillStyle = str;
  swatch.fillRect(0, 0, 1, 1);
  const [r, g, b, a] = swatch.getImageData(0, 0, 1, 1).data;
  return a < 8 ? null : [r, g, b];
};
const probe = document.createElement('div');
probe.className = 'palette-probe';
probe.setAttribute('aria-hidden', 'true');
probe.innerHTML = ['wa-light', 'wa-dark']
  .map(
    c =>
      `<div class="${c}">${STATES.map(s => `<span style="color: var(--tell-color-${s}, transparent)"></span>`).join('')}<i></i></div>`
  )
  .join('');
document.body.append(probe);
export const resolvedPalette = isDark => {
  const host = probe.children[+isDark],
    out = {};
  STATES.forEach((s, i) => {
    const rgb = toRgb(getComputedStyle(host.children[i]).color);
    out[s] = rgb ? { rgb, isCustom: true } : { rgb: toSrgb(QUIET[STATE_COLOR[s]][+isDark]), isCustom: false };
  });
  out.surface =
    toRgb(getComputedStyle(host.lastElementChild).backgroundColor) || (isDark ? [35, 38, 44] : [255, 255, 255]);
  return out;
};
const luminance = rgb =>
  rgb
    .map(c => ((c /= 255) <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
    .reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i], 0);
export const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
const ld = (light, dark) => `light-dark(${light}, ${dark})`;
const PRESETS = {
  default: { label: 'Built In', tokens: null },
  wa: {
    label: 'Web Awesome',
    tokens: {
      working: 'var(--wa-color-brand-fill-loud, #0071ec)',
      done: 'var(--wa-color-success-fill-loud, #00883c)',
      error: 'var(--wa-color-danger-fill-loud, #dc3146)',
      warning: 'var(--wa-color-warning-fill-loud, #b45f04)',
      idle: `var(--wa-color-neutral-fill-loud, ${ld('#2f323f', '#e4e5e9')})`,
    },
    code: {
      working: ld('var(--wa-color-brand-40)', 'var(--wa-color-brand-80)'),
      done: ld('var(--wa-color-success-40)', 'var(--wa-color-success-80)'),
      error: ld('var(--wa-color-danger-40)', 'var(--wa-color-danger-80)'),
      warning: ld('var(--wa-color-warning-40)', 'var(--wa-color-warning-80)'),
      idle: ld('var(--wa-color-neutral-40)', 'var(--wa-color-neutral-70)'),
    },
  },
  tailwind: {
    label: 'Tailwind',
    tokens: {
      working: ld('var(--color-indigo-600, #4f46e5)', 'var(--color-indigo-400, #818cf8)'),
      done: ld('var(--color-emerald-600, #059669)', 'var(--color-emerald-400, #34d399)'),
      error: ld('var(--color-red-600, #dc2626)', 'var(--color-red-400, #f87171)'),
      warning: ld('var(--color-amber-600, #d97706)', 'var(--color-amber-400, #fbbf24)'),
      idle: ld('var(--color-slate-500, #64748b)', 'var(--color-slate-400, #94a3b8)'),
    },
    code: {
      working: ld('#4338ca', '#a5b4fc'),
      done: ld('#047857', '#34d399'),
      error: ld('#b91c1c', '#f87171'),
      warning: ld('#b45309', '#fbbf24'),
      idle: ld('#475569', '#94a3b8'),
    },
  },
  bootstrap: {
    label: 'Bootstrap',
    tokens: {
      working: 'var(--bs-primary, #0d6efd)',
      done: 'var(--bs-success, #198754)',
      error: 'var(--bs-danger, #dc3545)',
      warning: 'var(--bs-warning, #ffc107)',
      idle: 'var(--bs-secondary, #6c757d)',
    },
    code: {
      working: ld('#0a58ca', '#6ea8fe'),
      done: ld('#146c43', '#75b798'),
      error: ld('#b02a37', '#ea868f'),
      warning: ld('#664d03', '#ffda6a'),
      idle: ld('#495057', '#adb5bd'),
    },
  },
  primer: {
    label: 'GitHub Primer',
    tokens: {
      working: `var(--fgColor-accent, ${ld('#0969da', '#4493f8')})`,
      done: `var(--fgColor-success, ${ld('#1a7f37', '#3fb950')})`,
      error: `var(--fgColor-danger, ${ld('#d1242f', '#f85149')})`,
      warning: `var(--fgColor-attention, ${ld('#9a6700', '#d29922')})`,
      idle: `var(--fgColor-muted, ${ld('#59636e', '#9198a1')})`,
    },
    code: {
      working: ld('#0969da', '#79c0ff'),
      done: ld('#1a7f37', '#3fb950'),
      error: ld('#d1242f', '#ff7b72'),
      warning: ld('#7d4e00', '#d29922'),
      idle: ld('#59636e', '#9198a1'),
    },
  },
  custom: { label: 'Your Own', tokens: null },
};
const savedPalette = (() => {
  try {
    return JSON.parse(store.get('tells-site-palette')) || {};
  } catch {
    return {};
  }
})();
export const palette = {
  preset: PRESETS[savedPalette.preset] ? savedPalette.preset : 'default',
  custom: savedPalette.custom || {},
};
const paletteSheet = document.head.appendChild(document.createElement('style'));
const paletteDecls = () => {
  const tokens = palette.preset === 'custom' ? palette.custom : PRESETS[palette.preset].tokens || {};
  return STATES.filter(s => tokens[s]).map(s => `--tell-color-${s}: ${tokens[s]};`);
};
const codeDecls = () => {
  if (palette.preset === 'custom')
    return STATES.filter(s => palette.custom[s]).map(
      s => `--code-${s}: color-mix(in oklab, ${palette.custom[s]} 65%, var(--code-ink));`
    );
  const code = PRESETS[palette.preset].code || {};
  return STATES.filter(s => code[s]).map(s => `--code-${s}: ${code[s]};`);
};
export const applyPalette = () => {
  const decls = [...paletteDecls(), ...codeDecls()];
  paletteSheet.textContent = decls.length ? `:root, .wa-light, .wa-dark { ${decls.join(' ')} }` : '';
  store.set(
    'tells-site-palette',
    palette.preset === 'default' ? null : JSON.stringify({ preset: palette.preset, custom: palette.custom })
  );
  emit('palette');
};

const hex = rgb => '#' + rgb.map(c => c.toString(16).padStart(2, '0')).join('');
// microlighter 2.2.0 skips attributes inside <script> and <style> opening tags, so add them each time it paints.
const EMBED_TAG = /<(?:script|style)\b([^>]*)>/gi;
const EMBED_ATTR = /([a-zA-Z_:][\w:.-]*)(?:\s*=\s*(["'])(.*?)\2)?/g;
const embedRanges = () => {
  const out = { 'attribute-name': [], 'attribute-value': [], punctuation: [] };
  document.querySelectorAll('pre > code.language-html').forEach(code => {
    const node = code.firstChild;
    if (node?.nodeType !== Node.TEXT_NODE) return;
    for (const tag of node.data.matchAll(EMBED_TAG)) {
      const base = tag.index + tag[0].indexOf(tag[1]);
      for (const attr of tag[1].matchAll(EMBED_ATTR)) {
        const at = base + attr.index;
        const add = (name, start, end) => {
          const r = new Range();
          r.setStart(node, start);
          r.setEnd(node, end);
          out[name].push(r);
        };
        add('attribute-name', at, at + attr[1].length);
        if (attr[2] === undefined) continue;
        const open = at + attr[0].indexOf(attr[2]);
        add('punctuation', open, open + 1);
        add('attribute-value', open + 1, open + 1 + attr[3].length);
        add('punctuation', open + 1 + attr[3].length, open + 2 + attr[3].length);
      }
    }
  });
  return out;
};
if (globalThis.CSS?.highlights) {
  const set = CSS.highlights.set.bind(CSS.highlights);
  CSS.highlights.set = (name, highlight) => {
    const extra = embedRanges();
    if (extra[name]) extra[name].forEach(r => highlight.add(r));
    set(name, highlight);
    if (name === 'tag')
      Object.entries(extra).forEach(([category, ranges]) => {
        if (!CSS.highlights.has(category)) set(category, new Highlight(...ranges));
      });
    return CSS.highlights;
  };
  document.dispatchEvent(new Event('syntax-highlight'));
}

export const fillCode = (code, text) => {
  code.textContent = text;
  const copy = code.closest('pre')?.querySelector('wa-copy-button');
  if (copy) copy.value = text;
  document.dispatchEvent(new Event('syntax-highlight'));
};
export const renderSwatchSheet = (sheet, code) => {
  const pals = [resolvedPalette(false), resolvedPalette(true)],
    isOwn = palette.preset === 'custom',
    tokens = isOwn ? palette.custom : PRESETS[palette.preset].tokens || {},
    well = (s, isDark) => {
      const ratio = contrast(pals[+isDark][s].rgb, pals[+isDark].surface),
        isLow = ratio < 3;
      return `<span class="sw-cell wa-cluster wa-gap-s wa-flex-nowrap" role="cell"><span class="sw-well ${isDark ? 'wa-dark' : 'wa-light'}">${tag(page.skin, `state="${s}" scheme="${isDark ? 'dark' : 'light'}" label=""`)}</span><span class="sw-ratio${isLow ? ' is-low' : ''}">${ratio.toFixed(1)}:1${isLow ? ' low' : ''}</span></span>`;
    },
    value = s => tokens[s] || `light-dark(${hex(pals[0][s].rgb)}, ${hex(pals[1][s].rgb)})`;
  sheet.innerHTML =
    `<div class="sw-row sw-heads" role="row"><span role="columnheader" class="label">State</span><span role="columnheader" class="label">Light</span><span role="columnheader" class="label">Dark</span></div>` +
    STATES.map(s => {
      const swatch = (isOwn && palette.custom[s]) || hex(pals[0][s].rgb),
        control = isOwn
          ? `<wa-color-picker size="s" label="${LABEL[s]} color" class="wa-visually-hidden-label" data-state="${s}" value="${swatch}"></wa-color-picker>`
          : `<span class="sw-chip" style="background: ${swatch}"></span>`;
      return `<div class="sw-row" role="row"><span class="sw-name wa-cluster wa-gap-s wa-flex-nowrap wa-font-size-s wa-font-weight-bold" role="rowheader">${control}${LABEL[s]}</span>${well(s, false)}${well(s, true)}</div>`;
    }).join('');
  const css = `:root {\n${STATES.map(s => `  --tell-color-${s}: ${value(s)};`).join('\n')}\n}`;
  fillCode(code, css);
  holdAll(sheet);
};
export const bindPaletteSelect = el => {
  const keys = Object.keys(PRESETS),
    labels = keys.map(k => PRESETS[k].label);
  el.insertAdjacentHTML(
    'beforeend',
    el.localName === 'wa-radio-group'
      ? radios(keys, labels)
      : keys.map((k, i) => `<wa-option value="${k}">${labels[i]}</wa-option>`).join('')
  );
  el.setAttribute('value', palette.preset);
  el.addEventListener('change', e => {
    if (e.target.value === palette.preset) return;
    palette.preset = e.target.value;
    applyPalette();
  });
  on('palette', () => el.value !== palette.preset && (el.value = palette.preset));
};
export const bindPalettePickers = host =>
  host.addEventListener('change', e => {
    const s = e.target.closest('wa-color-picker')?.dataset.state;
    if (!s) return;
    palette.custom[s] = e.target.value;
    applyPalette();
  });

export const PROMPT =
  '<span class="prompt" aria-hidden="true"><wa-icon family="sharp" variant="regular" name="house"></wa-icon>/app<wa-icon family="sharp" variant="regular" name="dollar-sign"></wa-icon></span>';
const addCopyButtons = () =>
  document.querySelectorAll('pre[data-copy]').forEach(pre => {
    const btn = document.createElement('wa-copy-button');
    btn.value = pre.textContent;
    pre.insertAdjacentHTML('afterbegin', PROMPT);
    pre.querySelector('code').insertAdjacentHTML('afterend', '<span class="caret" aria-hidden="true"></span>');
    btn.copyLabel = 'Copy';
    btn.successLabel = 'Copied';
    btn.tooltipPlacement = 'left';
    btn.innerHTML = ['copy:copy', 'success:check', 'error:xmark']
      .map(icon => icon.split(':'))
      .map(([slot, name]) => `<wa-icon slot="${slot}-icon" family="sharp" variant="regular" name="${name}"></wa-icon>`)
      .join('');
    pre.append(btn);
  });

export const syncInstallTabs = groups => {
  const set = name =>
    groups.forEach(g => {
      if (g.querySelector(`wa-tab-panel[name="${name}"]`) && g.active !== name) g.active = name;
    });
  groups.forEach(g =>
    g.addEventListener('wa-tab-show', e => {
      store.set('tells-site-install', e.detail.name === 'npm' ? null : e.detail.name);
      set(e.detail.name);
    })
  );
  /* wa-tab-group shows no panel until it scrolls into view, so the page grew under the reader. Opening the panel up front keeps its height fixed. */
  const open = name =>
    groups.forEach(g => {
      g.querySelectorAll('wa-tab').forEach(tab => (tab.active = tab.panel === name));
      g.querySelectorAll('wa-tab-panel').forEach(panel => (panel.active = panel.name === name));
    });
  customElements
    .whenDefined('wa-tab-group')
    .then(() => Promise.all(groups.map(g => g.updateComplete)))
    .then(() => {
      const name = store.get('tells-site-install') || 'npm';
      set(name);
      open(name);
    });
};

export const spy = (links, sections, { isFirstByDefault = false } = {}) => {
  const update = () => {
    const isBottom = innerHeight + scrollY >= document.documentElement.scrollHeight - 2,
      current = isBottom
        ? sections.at(-1)
        : (sections.filter(s => s.getBoundingClientRect().top <= innerHeight * 0.3).at(-1) ??
          (isFirstByDefault ? sections[0] : undefined));
    links.forEach(a =>
      a.hash === `#${current?.id}` ? a.setAttribute('aria-current', 'true') : a.removeAttribute('aria-current')
    );
  };
  let isQueued = false;
  addEventListener(
    'scroll',
    () => {
      if (isQueued) return;
      isQueued = true;
      requestAnimationFrame(() => {
        isQueued = false;
        update();
      });
    },
    { passive: true }
  );
  update();
};

const fitScrollPadding = async () => {
  const shell = document.querySelector('wa-page');
  await shell?.updateComplete;
  const header = shell?.shadowRoot?.querySelector('[part~="header"]');
  if (!header) return;
  new ResizeObserver(() => {
    document.documentElement.style.scrollPaddingTop = `${header.getBoundingClientRect().height + 16}px`;
  }).observe(header);
};

const tipText = el =>
  (
    [...el.querySelectorAll('wa-icon')].find(icon => icon.label && icon.checkVisibility?.() !== false) ??
    el.querySelector('wa-icon')
  )?.label;
const addTooltips = () =>
  [...document.querySelectorAll('a, button, wa-button')]
    .filter(el => !el.textContent.trim() && el.querySelector('wa-icon'))
    .forEach((el, i) => {
      el.id ||= `tip-target-${i}`;
      const tip = document.createElement('wa-tooltip');
      tip.setAttribute('for', el.id);
      const sync = () => (tip.textContent = tipText(el) ?? '');
      sync();
      new MutationObserver(sync).observe(el, { subtree: true, attributes: true });
      document.body.append(tip);
    });

const waLoader = document.querySelector('script[src$="webawesome.loader.js"]')?.src;
/* Serve Web Awesome's own icons (chevrons, the drawer's ×, checks) in sharp regular from the kit. */
const SYSTEM_ALIASES = { indeterminate: 'minus' };
if (waLoader)
  import(waLoader).then(({ registerIconLibrary, getKitCode }) =>
    registerIconLibrary('system', {
      resolver: name =>
        `https://ka-p.fontawesome.com/releases/v${__FA_VERSION__}/svgs/sharp-regular/${SYSTEM_ALIASES[name] ?? name}.svg?token=${encodeURIComponent(getKitCode())}`,
      mutator: svg => svg.hasAttribute('fill') || svg.setAttribute('fill', 'currentColor'),
    })
  );

export const start = async () => {
  applyPalette();
  applyTheme();
  await customElements.whenDefined('wa-page');
  await fitScrollPadding();
  if ($('page-tell')) $('page-tell').value = page.skin;
  addCopyButtons();
  addTooltips();
  reveal();
};

const frame = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

/* Content shows once the layout has loaded. Components that load later can shift the #hash target, so it's scrolled to again then, unless the reader has scrolled away. */
const reveal = async () => {
  const { dataset } = document.documentElement;
  const target = location.hash ? document.getElementById(location.hash.slice(1)) : null;
  await frame();
  target?.scrollIntoView({ behavior: 'instant' });
  delete dataset.loading;
  const top = scrollY;
  if (waLoader) await (await import(waLoader)).allDefined();
  await frame();
  if (scrollY === top) target?.scrollIntoView({ behavior: 'instant' });
  delete dataset.upgrading;
};

const mark = document.querySelector('.tb-name');
let markTaps = [];
mark?.addEventListener('pointerdown', () => {
  const now = performance.now();
  markTaps = markTaps.filter(t => now - t < 1500).concat(now);
  if (markTaps.length < 5) return;
  markTaps = [];
  document.querySelectorAll('tiny-tell').forEach(t => t[DANCE]?.());
});

$('made-with')?.addEventListener('click', e => e.currentTarget.querySelector('wa-random-content').randomize());

const docsLink = document.querySelector('.header-docs');
if (docsLink && new URL(docsLink.href).pathname === location.pathname) docsLink.setAttribute('aria-current', 'page');

export const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
export const isStill = () => page.isPaused || reducedMotion.matches;
export const onMotionChange = fn => {
  on('pause', fn);
  reducedMotion.addEventListener('change', fn);
};
const lift = () => (reducedMotion.matches ? 0 : 4);
export const settleIn = el => {
  if (page.isPaused || !el?.animate) return;
  el.animate(
    [
      { opacity: 0, transform: `translateY(${lift()}px)` },
      { opacity: 1, transform: 'none' },
    ],
    { duration: 220, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' }
  );
};
export const swapText = (el, text) => {
  if (el.textContent === text) return;
  if (page.isPaused || !el.animate) {
    el.textContent = text;
    return;
  }
  el.getAnimations().forEach(a => a.cancel());
  el.animate(
    [
      { opacity: 1, transform: 'none' },
      { opacity: 0, transform: `translateY(-${lift()}px)` },
    ],
    { duration: 120, easing: 'ease-in', fill: 'forwards' }
  ).finished.then(
    () => {
      el.textContent = text;
      el.getAnimations().forEach(a => a.cancel());
      settleIn(el);
    },
    () => {}
  );
};

let isScrollQueued = false;
const markScrolled = () => document.documentElement.classList.toggle('is-scrolled', scrollY > 4);
addEventListener(
  'scroll',
  () => {
    if (isScrollQueued) return;
    isScrollQueued = true;
    requestAnimationFrame(() => {
      isScrollQueued = false;
      markScrolled();
    });
  },
  { passive: true }
);
markScrolled();

const marker = (group, className, slot) => {
  let el = group.querySelector(`:scope > .${className}`);
  if (el) return el;
  el = Object.assign(document.createElement('span'), { className });
  el.setAttribute('aria-hidden', 'true');
  if (slot) el.slot = slot;
  group.prepend(el);
  return el;
};
const slide = (el, to, { isInstant, isWidthOnly }) => {
  const box = el.getBoundingClientRect(),
    now = new DOMMatrix(getComputedStyle(el).transform),
    target = to.getBoundingClientRect(),
    x = target.left - (box.left - now.m41),
    y = isWidthOnly ? 0 : target.top - (box.top - now.m42);
  if (isInstant || el.style.opacity !== '1') el.style.transition = 'none';
  Object.assign(el.style, {
    opacity: '1',
    transform: `translate(${x}px, ${y}px)`,
    inlineSize: `${target.width}px`,
    ...(isWidthOnly ? {} : { blockSize: `${target.height}px` }),
  });
  if (el.style.transition) requestAnimationFrame(() => (el.style.transition = ''));
};
const placePill = (group, isInstant) => {
  const on = [...group.querySelectorAll(':scope > wa-radio')].find(r => r.checked),
    pill = marker(group, 'seg-pill');
  group.toggleAttribute('data-pill', Boolean(on));
  if (!on) return (pill.style.opacity = '0');
  pill.style.borderRadius = getComputedStyle(on).borderRadius;
  slide(pill, on, { isInstant });
};
const placeTabBar = (group, isInstant) => {
  const on = group.querySelector(':scope > wa-tab[active]');
  if (on) slide(marker(group, 'tab-bar', 'nav'), on, { isInstant, isWidthOnly: true });
};
const follow = (group, items, attr, place) => {
  let isQueued = false;
  const queue = isInstant => {
    if (isQueued) return;
    isQueued = true;
    requestAnimationFrame(() => {
      isQueued = false;
      place(group, isInstant);
    });
  };
  const widths = new WeakMap();
  const sizes = new ResizeObserver(entries => {
    const isWider = entries.some(e => widths.get(e.target) !== e.contentRect.width);
    entries.forEach(e => widths.set(e.target, e.contentRect.width));
    if (isWider) queue(true);
  });
  const watch = () => [group, ...group.querySelectorAll(items)].forEach(el => sizes.observe(el));
  new MutationObserver(records => {
    const isNew = records.some(r => r.type === 'childList');
    if (isNew) watch();
    queue(isNew);
  }).observe(group, { childList: true, subtree: true, attributes: true, attributeFilter: [attr] });
  watch();
  document.fonts?.ready.then(() => queue(true));
  queue(true);
};
customElements
  .whenDefined('wa-radio')
  .then(() =>
    document
      .querySelectorAll('wa-radio-group:not(.cast-pick)')
      .forEach(group => follow(group, ':scope > wa-radio', 'aria-checked', placePill))
  );
customElements
  .whenDefined('wa-tab-group')
  .then(() =>
    document.querySelectorAll('wa-tab-group').forEach(group => follow(group, ':scope > wa-tab', 'active', placeTabBar))
  );

const TELL_ATTRS = ['skin', 'label', 'color', 'scheme', 'style'];
const syncAttrs = (from, to, names = [...new Set([...from.getAttributeNames(), ...to.getAttributeNames()])]) =>
  names.forEach(name => {
    const value = to.getAttribute(name);
    if (value === null) from.removeAttribute(name);
    else if (from.getAttribute(name) !== value) from.setAttribute(name, value);
  });
export const morph = (from, to, { isTextAnimated = true } = {}) => {
  if (from.nodeName !== to.nodeName) return from.replaceWith(to.cloneNode(true));
  if (from.nodeType === Node.TEXT_NODE) {
    if (from.data !== to.data) from.data = to.data;
    return;
  }
  if (from.localName === 'tiny-tell') {
    syncAttrs(from, to, TELL_ATTRS);
    from.state = to.getAttribute('state');
    return;
  }
  syncAttrs(from, to);
  const [a, b] = [[...from.childNodes], [...to.childNodes]];
  const isText = b.length === 1 && b[0].nodeType === Node.TEXT_NODE && a.length === 1;
  if (isText) {
    if (from.textContent !== to.textContent)
      isTextAnimated ? swapText(from, to.textContent) : (from.textContent = to.textContent);
    return;
  }
  if (a.length !== b.length || a.some((n, i) => n.nodeName !== b[i].nodeName))
    return from.replaceChildren(...b.map(n => n.cloneNode(true)));
  a.forEach((n, i) => morph(n, b[i], { isTextAnimated }));
};
export const morphInto = (host, html, options) => {
  const next = document.createElement('template');
  next.innerHTML = html;
  const nodes = [...next.content.childNodes];
  if (host.childNodes.length !== nodes.length) return host.replaceChildren(...nodes);
  [...host.childNodes].forEach((n, i) => morph(n, nodes[i], options));
};
