import { BEAT } from '../../src/core.js';
import { DANCE } from '../../src/element.js';
import { V1 } from '../shared/copy.js';
import { $, holdAll, isStill, onMotionChange, tag } from './shared.js';

const BEAT_MS = BEAT * 1000;
const section = $('funsies');
const buttons = [...section.querySelectorAll('wa-button')];
const toys = [];
const fill = (host, count, skinAt) => {
  host.innerHTML = Array.from({ length: count }, (_, i) => tag(skinAt(i), 'state="idle" label=""')).join('');
  return [...host.children];
};
// The element re-sets its state right after this event fires, which would cancel a dance started inside it.
const keepDancing = (el, isOn) =>
  el.addEventListener('tell-after-dance', () => isOn() && queueMicrotask(() => isOn() && el[DANCE]()));
const syncMotion = () => {
  const isOff = isStill();
  $('funsies-still').hidden = !isOff;
  buttons.forEach(button => (button.disabled = isOff));
};
syncMotion();
onMotionChange(syncMotion);

const peanutsGo = $('peanuts-go');
let cast = [],
  isShowing = false,
  showTimers = [];
const clearShow = () => {
  showTimers.forEach(clearTimeout);
  showTimers = [];
};
const setShowing = next => {
  isShowing = next;
  peanutsGo.textContent = next ? 'Stop the Show' : 'Start the Show';
};
const startShow = () => {
  clearShow();
  cast.forEach(el => (el.state = 'idle'));
  setShowing(true);
  cast.forEach((el, i) => showTimers.push(setTimeout(() => isShowing && el[DANCE](), (i * BEAT_MS) / 6)));
};
const stopShow = ({ isBowing = true } = {}) => {
  clearShow();
  setShowing(false);
  if (!isBowing) return;
  cast.forEach(el => (el.state = 'done'));
  showTimers.push(setTimeout(() => cast.forEach(el => (el.state = 'idle')), BEAT_MS));
};
peanutsGo.addEventListener('click', () => (isShowing ? stopShow() : startShow()));
onMotionChange(() => isStill() && isShowing && stopShow({ isBowing: false }));
toys.push({
  build: () => {
    cast = fill($('peanuts'), 6, i => V1[i]);
    cast.forEach(el => keepDancing(el, () => isShowing));
  },
});
const tellClass = () => customElements.get('tiny-tell');
const readout = $('tempo-readout');
const REST = `Back to the ${BEAT}s beat (${Math.round(60 / BEAT)} BPM)`;
let band = [],
  taps = [],
  easing = 0,
  settleTimer = 0;
const settle = () => {
  const from = tellClass().timeScale,
    startedAt = performance.now();
  const step = now => {
    const k = Math.min(1, (now - startedAt) / 1000);
    tellClass().timeScale = from + (1 - from) * (1 - (1 - k) ** 3);
    if (k < 1) return void (easing = requestAnimationFrame(step));
    readout.textContent = REST;
    taps = [];
    band.forEach(el => (el.state = 'idle'));
  };
  easing = requestAnimationFrame(step);
};
$('tap').addEventListener('click', () => {
  cancelAnimationFrame(easing);
  clearTimeout(settleTimer);
  band.forEach(el => (el.state = 'working'));
  const now = performance.now();
  taps = taps
    .filter(t => now - t < 3000)
    .concat(now)
    .slice(-5);
  if (taps.length < 2) {
    readout.textContent = 'Keep tapping…';
    settleTimer = setTimeout(settle, 3000);
    return;
  }
  const gap = (taps.at(-1) - taps[0]) / (taps.length - 1) / 1000;
  tellClass().timeScale = Math.min(4, Math.max(0.25, BEAT / gap));
  readout.textContent = `${Math.round((60 / BEAT) * tellClass().timeScale)} BPM · ${tellClass().timeScale.toFixed(2)}× speed`;
  settleTimer = setTimeout(settle, gap * 2000);
});
toys.push({
  build: () => {
    band = fill($('tempo'), 4, i => ['drones', 'eyes', 'blot', 'lens'][i]);
  },
});
const SWEEPS = ['error', 'warning', 'done', 'working', 'idle'];
let crowdRow = [],
  waveTimers = [];
$('wave-go').addEventListener('click', () => {
  waveTimers.forEach(clearTimeout);
  crowdRow.forEach(el => (el.state = 'idle'));
  waveTimers = SWEEPS.flatMap((sweep, k) =>
    crowdRow.map((el, i) => setTimeout(() => (el.state = sweep), k * 2.5 * BEAT_MS + i * 140))
  );
});
toys.push({ build: () => (crowdRow = fill($('wave'), 6, i => V1.at(-1 - i))) });
let seats = [],
  boredTimer = 0,
  boredSteps = [];
const wake = () => {
  boredSteps.forEach(clearTimeout);
  boredSteps = [];
  clearTimeout(boredTimer);
  seats.forEach(el => (el.state = 'working'));
  boredTimer = setTimeout(
    () =>
      [...seats]
        .sort(() => Math.random() - 0.5)
        .forEach((el, i) => boredSteps.push(setTimeout(() => (el.state = 'idle'), i * 140))),
    3000
  );
};
$('audience-stage').addEventListener('pointermove', wake, { passive: true });
$('audience-stage').addEventListener('pointerdown', wake, { passive: true });
toys.push({ build: () => (seats = fill($('audience'), 24, () => 'eyes')) });

new IntersectionObserver(
  ([e], observer) => {
    if (!e.isIntersecting) return;
    observer.disconnect();
    toys.forEach(toy => toy.build());
    holdAll(section);
  },
  { rootMargin: '100% 0px' }
).observe(section);
