/* ---- Play: tells notice a nearby pointer, dance after five quick taps, and doze when left alone. Only in the play bundle; the core leaves HOOKS empty. ---- */
import { LEN } from './doze.js';
import { DANCE, HOOKS, MOOD, TinyTell } from './element.js';

TinyTell.prototype.dance = function () {
  return this.isConnected && this[DANCE]();
};

const pointer = { x: 0, y: 0, isHere: false, hasMouse: false };
if (typeof window !== 'undefined') {
  addEventListener(
    'pointermove',
    e => {
      if (e.pointerType === 'touch') return;
      pointer.x = e.clientX;
      pointer.y = e.clientY;
      pointer.isHere = pointer.hasMouse = true;
    },
    { passive: true }
  );
  document.documentElement.addEventListener('pointerleave', () => {
    pointer.isHere = false;
  });
}
const near = el => {
  if (!pointer.isHere) return null;
  const r = el.getBoundingClientRect(),
    dx = pointer.x - (r.left + r.width / 2),
    dy = pointer.y - (r.top + r.height / 2),
    d = Math.hypot(dx, dy),
    reach = Math.max(160, r.width * 4);
  if (d > reach) return null;
  const a = Math.sqrt(1 - d / reach),
    n = Math.max(d, r.width / 2);
  return { x: (dx / n) * a, y: (dy / n) * a };
};
const rest = new WeakMap(),
  restFor = el => rest.get(el) || rest.set(el, { away: 0, at: 0, mood: null, isNear: false }).get(el);
const isOff = el => {
  if (!el.hasAttribute('noplay')) return false;
  rest.delete(el);
  return true;
};
HOOKS.gaze = el => {
  if (isOff(el)) return null;
  const g = near(el);
  restFor(el).isNear = !!g;
  return g;
};
const AWAY = 30;
HOOKS.tick = (el, dt, t) => {
  if (isOff(el)) return void (el[MOOD] = null);
  const r = restFor(el),
    mood = el[MOOD],
    isIdle = el.state === 'idle';
  /* The core can end a mood on its own (state change, pause, dance, reduced motion), so any change restarts both timers. */
  if (mood !== r.mood) Object.assign(r, { mood, at: t, away: 0 });
  if (!isIdle || r.isNear) r.away = 0;
  let next;
  if (mood === 'nod' && t - r.at >= LEN.nod) next = 'doze';
  else if (mood === 'wake' && t - r.at >= LEN.wake) next = null;
  else if (r.isNear && (mood === 'nod' || mood === 'doze')) next = 'wake';
  else if (!mood && isIdle && !r.isNear && pointer.hasMouse && (r.away += dt) >= AWAY) next = 'nod';
  else return;
  el[MOOD] = next;
  Object.assign(r, { mood: el[MOOD], at: t, away: 0 });
};
const taps = new WeakMap();
if (typeof window !== 'undefined')
  addEventListener(
    'pointerdown',
    e => {
      const el = e.composedPath().find(n => n instanceof TinyTell);
      if (!el || el.hasAttribute('noplay')) return;
      const now = performance.now(),
        log = (taps.get(el) || []).filter(t => now - t < 1500).concat(now);
      if (log.length < 5) return taps.set(el, log);
      taps.delete(el);
      el[DANCE]();
    },
    { passive: true }
  );
