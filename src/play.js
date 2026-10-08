/* ---- Play: tells notice a nearby pointer, and dance after five quick taps. Only in the play bundle; the core leaves HOOKS empty. ---- */
import { DANCE, HOOKS } from './element.js';

const pointer = { x: 0, y: 0, isHere: false };
if (typeof window !== 'undefined') {
  addEventListener(
    'pointermove',
    e => {
      if (e.pointerType === 'touch') return;
      pointer.x = e.clientX;
      pointer.y = e.clientY;
      pointer.isHere = true;
    },
    { passive: true }
  );
  document.documentElement.addEventListener('pointerleave', () => {
    pointer.isHere = false;
  });
}
HOOKS.gaze = el => {
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
const taps = new WeakMap();
if (typeof window !== 'undefined')
  addEventListener(
    'pointerdown',
    e => {
      const el = e.composedPath().find(n => n.localName === 'tiny-tell');
      if (!el) return;
      const now = performance.now(),
        log = (taps.get(el) || []).filter(t => now - t < 1500).concat(now);
      if (log.length < 5) return taps.set(el, log);
      taps.delete(el);
      el[DANCE]();
    },
    { passive: true }
  );
