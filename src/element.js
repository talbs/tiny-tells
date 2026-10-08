/* ---- <tiny-tell>: one shared clock, per-element scheme and color, and the canvas contract. ---- */
import { LABEL, PERIOD, STATES, clamp, lerp, rgbToOklch, withScene } from './core.js';
import { TellAfterDanceEvent, TellDanceEvent } from './events.js';
import { SKINS } from './registry.js';
import { EPlayer, FPlayer } from './players.js';
import { BOX } from './box.js';

const VERSION = __TINY_TELLS_VERSION__;
const STILL = { working: 0.9, done: 1.2, error: 1.4, warning: 1, idle: 2 };
const SCHEMES = ['auto', 'light', 'dark', 'invert'];
const PROPS = ['skin', 'state', 'color', 'scheme', 'label', 'paused'];
const clock = { t: 0, last: 0, scale: 1, raf: 0, live: new Set() };
const all = new Set();
const TICK = Symbol('tick');
const HOOKS = {};
const DOCS = 'https://tinytells.dev/docs/#';
const DANCE = Symbol('dance');
let env = null,
  refresh = null,
  refreshSeen = null,
  recheckStill = null,
  pending = 0,
  rechecks = 0;
const fresh = new Set();
const stale = new WeakSet();

const frame = now => {
  clock.t += (clock.last ? clamp((now - clock.last) / 1000, 0, 0.1) : 0) * clock.scale;
  clock.last = now;
  clock.live.forEach(el => el[TICK]());
  clock.raf = clock.live.size ? requestAnimationFrame(frame) : 0;
  if (!clock.raf) clock.last = 0;
};
const wake = () => {
  if (!clock.raf && clock.live.size) clock.raf = requestAnimationFrame(frame);
};
const put = (el, name, v) => (v == null ? el.removeAttribute(name) : el.setAttribute(name, v));
const MAX_CANVAS = 2048;
const playerFor = (skin, state) => (skin === 'flipdot' ? new FPlayer(state) : new EPlayer(skin, state));

/* Browser-only setup waits for the first connected tell, so importing the module on a server is safe. */
const setup = () => {
  if (env) return env;
  /* Test DOMs like jsdom and happy-dom lack these. A tell there stays inert instead of throwing into someone's test run. */
  if (
    !['matchMedia', 'ResizeObserver', 'IntersectionObserver'].every(k => k in window) ||
    !document.createElement('canvas').getContext?.('2d')
  )
    return (env = { isInert: true });
  const refreshSoon = () => {
    pending ||= requestAnimationFrame(() => {
      pending = 0;
      refreshSeen();
    });
  };
  const watchDensity = () =>
    matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`).addEventListener(
      'change',
      () => {
        refreshSoon();
        watchDensity();
      },
      { once: true }
    );
  const swatch = Object.assign(document.createElement('canvas'), { width: 1, height: 1 }).getContext('2d', {
    willReadFrequently: true,
  });
  const toColor = str => {
    swatch.clearRect(0, 0, 1, 1);
    swatch.fillStyle = 'rgb(0 0 0 / 0)';
    swatch.fillStyle = str;
    swatch.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = swatch.getImageData(0, 0, 1, 1).data;
    return a < 8 ? null : rgbToOklch([r, g, b]);
  };
  const sheet = new CSSStyleSheet();
  const hasLightDark = CSS.supports('color', 'light-dark(#000, #fff)');
  sheet.replaceSync(`
      :host { ${BOX} contain: layout paint; }
      :host([hidden]) { display: none; }
      canvas { display: block; inline-size: 100%; aspect-ratio: 1; }
      .probe, .palette { position: absolute; inline-size: 0; block-size: 0; overflow: hidden; }
      .probe { color: ${hasLightDark ? 'light-dark(rgb(0 0 0), rgb(255 255 255))' : 'inherit'}; }
      .palette.is-light { color-scheme: light; }
      .palette.is-dark { color-scheme: dark; }
      ${STATES.map((s, i) => `.palette span:nth-child(${i + 1}) { color: var(--tell-color-${s}, transparent); }`).join('\n      ')}
    `);
  env = {
    sheet,
    hasLightDark,
    toColor,
    reduce: matchMedia('(prefers-reduced-motion: reduce)'),
    dark: matchMedia('(prefers-color-scheme: dark)'),
    forced: matchMedia('(forced-colors: active)'),
    seen: new IntersectionObserver(
      entries => {
        entries.forEach(e => e.target[TICK](false, e.isIntersecting));
        refresh(entries.filter(e => e.isIntersecting && stale.delete(e.target)).map(e => e.target));
      },
      { rootMargin: '64px' }
    ),
    sized: new ResizeObserver(entries => refresh(entries.map(e => e.target))),
  };
  new MutationObserver(refreshSoon).observe(document.documentElement, { attributes: true });
  env.reduce.addEventListener('change', refreshSoon);
  env.dark.addEventListener('change', refreshSoon);
  env.forced.addEventListener('change', refreshSoon);
  watchDensity();
  return env;
};

class TinyTell extends (typeof HTMLElement === 'undefined' ? class {} : HTMLElement) {
  static get version() {
    return VERSION;
  }
  static observedAttributes = PROPS;
  static get timeScale() {
    return clock.scale;
  }
  static set timeScale(v) {
    clock.scale = Math.max(0, +v || 0);
  }

  #canvas = Object.assign(document.createElement('canvas'), { width: 0, height: 0 });
  #probe = document.createElement('span');
  #palettes = ['is-light', 'is-dark'].map(c =>
    Object.assign(document.createElement('span'), { className: `palette ${c}` })
  );
  #colors = null;
  #states = null;
  #player = null;
  #isVisible = true;
  #isDark = false;
  #checked = 0;
  #size = 0;
  #gaze = null;
  #danceUntil = 0;
  #synced = '';
  #built = null;

  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    this.#probe.className = 'probe';
    this.#palettes.forEach(p => p.append(...STATES.map(() => document.createElement('span'))));
    this.#canvas.setAttribute('part', 'tell');
    this.#canvas.setAttribute('role', 'img');
    root.append(this.#probe, ...this.#palettes, this.#canvas);
    try {
      this.#states = this.attachInternals().states;
    } catch {}
  }

  get skin() {
    const s = this.getAttribute('skin');
    return Object.hasOwn(SKINS, s) ? s : 'drones';
  }
  set skin(v) {
    put(this, 'skin', v);
  }
  get state() {
    const s = this.getAttribute('state');
    return STATES.includes(s) ? s : 'working';
  }
  set state(v) {
    put(this, 'state', v);
  }
  get color() {
    return this.getAttribute('color') === 'current' ? 'current' : 'state';
  }
  set color(v) {
    put(this, 'color', v);
  }
  get scheme() {
    const s = this.getAttribute('scheme');
    return SCHEMES.includes(s) ? s : 'auto';
  }
  set scheme(v) {
    put(this, 'scheme', v);
  }
  get label() {
    return this.getAttribute('label');
  }
  set label(v) {
    put(this, 'label', v);
  }
  get paused() {
    return this.hasAttribute('paused');
  }
  set paused(v) {
    this.toggleAttribute('paused', !!v);
  }

  connectedCallback() {
    /* A framework may have set a property before this element was defined; that own property would hide the setter. */
    PROPS.forEach(p => {
      if (Object.prototype.hasOwnProperty.call(this, p)) {
        const v = this[p];
        delete this[p];
        this[p] = v;
      }
    });
    const { sheet, seen, sized, isInert } = setup();
    if (isInert) return;
    this.shadowRoot.adoptedStyleSheets = [sheet];
    all.add(this);
    seen.observe(this);
    sized.observe(this);
    if (this.#player && this.#built === this.skin) {
      this.#endDance();
      this.#within(() => this.#player.set(this.state, clock.t));
    } else this.#build();
    fresh.add(this);
    if (fresh.size === 1)
      queueMicrotask(() => {
        const list = [...fresh].filter(el => all.has(el));
        fresh.clear();
        refresh(list);
      });
  }

  disconnectedCallback() {
    all.delete(this);
    clock.live.delete(this);
    env?.seen?.unobserve(this);
    env?.sized?.unobserve(this);
  }

  attributeChangedCallback(name, before, after) {
    if (before === after || !all.has(this)) return;
    if (name === 'skin') {
      this.#endDance();
      this.#build();
    }
    if (name === 'state') {
      this.#validate();
      this.#endDance();
      this.#within(() => this.#player?.set(this.state, clock.t));
    }
    this[TICK](name === 'color' || name === 'scheme');
  }

  [TICK](isStale = false, isVisible = null) {
    /* An observer can deliver an entry queued before the tell was removed; ticking it would re-add it to the clock and draw it forever. */
    if (!all.has(this)) return void clock.live.delete(this);
    if (isVisible !== null) this.#isVisible = isVisible;
    const want = HOOKS.gaze && !this.paused && !env.reduce.matches ? HOOKS.gaze(this) : null,
      g = this.#gaze || { x: 0, y: 0 };
    const next = { x: lerp(g.x, want?.x || 0, 0.15), y: lerp(g.y, want?.y || 0, 0.15) };
    this.#gaze = want || Math.hypot(next.x, next.y) > 0.01 ? next : null;
    if (this.#danceUntil && clock.t > this.#danceUntil) {
      this.#endDance();
      this.#within(() => this.#player?.set(this.state, clock.t));
    }
    if (isStale || performance.now() - this.#checked > 1000) {
      this.#look();
      this.#fit();
    }
    this.#sync();
    this.#draw();
  }

  [DANCE]() {
    if (!this.#player || !PERIOD.dance || env.reduce.matches || this.paused || this.#danceUntil) return;
    if (!this.dispatchEvent(new TellDanceEvent())) return;
    this.#danceUntil = clock.t + 2 * PERIOD.dance;
    this.#within(() => this.#player.set('dance', clock.t));
  }

  #endDance() {
    if (!this.#danceUntil) return;
    this.#danceUntil = 0;
    this.dispatchEvent(new TellAfterDanceEvent());
  }

  #validate() {
    const s = this.getAttribute('state');
    if (s != null && !STATES.includes(s))
      console.warn(`<tiny-tell>: unknown state "${s}". Known: ${STATES.join(', ')}. Showing "working". ${DOCS}states`);
  }

  #build() {
    const skin = this.getAttribute('skin');
    if (skin && !Object.hasOwn(SKINS, skin))
      console.warn(
        `<tiny-tell>: unknown skin "${skin}". Known: ${Object.keys(SKINS).join(', ')}. Showing "drones". ${DOCS}tells`
      );
    this.#validate();
    this.#player = playerFor(this.skin, this.state);
    this.#player.t0 = clock.t;
    this.#built = this.skin;
  }

  #look() {
    const scheme = this.scheme,
      cv = this.#canvas,
      css = this.getBoundingClientRect().width,
      W = Math.min(Math.round(css * (window.devicePixelRatio || 1)), MAX_CANVAS);
    const isDarkAround = env.hasLightDark
      ? getComputedStyle(this.#probe).color === 'rgb(255, 255, 255)'
      : env.dark.matches;
    this.#isDark = scheme === 'dark' || (scheme === 'auto' && isDarkAround) || (scheme === 'invert' && !isDarkAround);
    const colors = STATES.map((s, i) => [
      s,
      env.toColor(getComputedStyle(this.#palettes[+this.#isDark].children[i]).color),
    ]).filter(([, c]) => c);
    this.#colors = colors.length ? Object.fromEntries(colors) : null;
    let from = this;
    while (from.assignedSlot) from = from.assignedSlot;
    cv._ink = this.color === 'current' || env.forced.matches ? env.toColor(getComputedStyle(from).color) : null;
    this.#size = css && W;
    if (css) cv._css = css;
    this.#checked = performance.now();
  }

  #scene() {
    return JSON.stringify([this.#isDark, this.#colors, this.#canvas._ink, this.#size]);
  }

  #fit() {
    const cv = this.#canvas,
      W = this.#size;
    if (W && cv.width !== W) {
      cv.width = W;
      cv.height = W;
    }
  }

  /* Reading layout after a write forces a fresh layout, so a batch does every read before any write. */
  static {
    refresh = list => {
      list.forEach(el => el.#look());
      list.forEach(el => el.#fit());
      list.forEach(el => el[TICK]());
    };
    refreshSeen = () => {
      const list = [];
      all.forEach(el => (el.#isVisible ? list.push(el) : stale.add(el)));
      refresh(list);
    };
    /* Moving tells re-read colors as they tick. Still and paused ones don't tick, so a timer does it for them. */
    recheckStill = () => {
      const list = [...all].filter(el => el.#isVisible && !clock.live.has(el));
      if (!list.length) {
        clearInterval(rechecks);
        rechecks = 0;
        return;
      }
      const before = list.map(el => el.#scene());
      list.forEach(el => el.#look());
      const changed = list.filter((el, i) => el.#scene() !== before[i]);
      changed.forEach(el => el.#fit());
      changed.forEach(el => el[TICK]());
    };
  }

  #sync() {
    const label = this.label,
      synced = JSON.stringify([this.state, label]);
    if (synced !== this.#synced) this.#mark(label);
    this.#synced = synced;
    const isMoving = this.#player && this.#isVisible && !this.paused && !env.reduce.matches;
    if (isMoving) {
      clock.live.add(this);
      wake();
    } else {
      clock.live.delete(this);
      if (this.#isVisible) rechecks ||= setInterval(recheckStill, 1000);
    }
  }

  #mark(label) {
    if (label === '') {
      this.#canvas.setAttribute('aria-hidden', 'true');
      this.#canvas.removeAttribute('aria-label');
    } else {
      this.#canvas.removeAttribute('aria-hidden');
      this.#canvas.setAttribute('aria-label', label ?? LABEL[this.state]);
    }
    if (this.#states)
      try {
        STATES.forEach(s => this.#states.delete(s));
        this.#states.add(this.state);
      } catch {}
  }

  #draw() {
    const cv = this.#canvas;
    if (!this.#player || cv.width < 2) return;
    const still = env.reduce.matches;
    if (still) this.#player = playerFor(this.skin, this.state);
    try {
      this.#within(() =>
        this.#player.draw(cv, still ? (SKINS[this.skin]?.still?.[this.state] ?? STILL[this.state]) : clock.t)
      );
    } catch (err) {
      clock.live.delete(this);
      console.error('<tiny-tell> failed to draw', err);
    }
  }

  /* The engine reads one shared scheme and palette, so every player call runs inside this tell's own. */
  #within(fn) {
    withScene({ isDark: this.#isDark, palette: this.#colors, gaze: this.#gaze }, fn);
  }
}

if (typeof customElements !== 'undefined') {
  const existing = customElements.get('tiny-tell');
  if (!existing) customElements.define('tiny-tell', TinyTell);
  else
    console.warn(
      `<tiny-tell>: already defined (version ${existing.version}), so this copy (${VERSION}) was not registered. Load tiny-tells or tiny-tells/play, not both. ${DOCS}play`
    );
}

export { DANCE, HOOKS, STILL, TinyTell };
