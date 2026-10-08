/* ---- Dance: a hidden fun state, one loop per tell. Only in the play bundle. ---- */
import { BEAT, E, PERIOD, PHYS, PI, STATE_COLOR, bell, mod, seg } from './core.js';
import { AERIAL, CORNERS, DRONES } from './tells/drones.js';
import { B, FC, FLIP, fromCells } from './tells/flipdot.js';
import { EP, EYES, pair } from './tells/eyes.js';
import { BLOT } from './tells/blot.js';
import { DEKATRON, DK } from './tells/dekatron.js';
import { LENS } from './tells/lens.js';

STATE_COLOR.dance = 'sky';
PERIOD.dance = 4 * BEAT;
PHYS.dance = PHYS.working;
DRONES.cam.dance = AERIAL;
const EQ = [
  [4, 2, 5, 2, 3],
  [2, 3, 2, 3, 2],
  [2, 5, 3, 4, 2],
  [3, 2, 3, 2, 3],
  [5, 2, 4, 2, 4],
  [2, 3, 2, 3, 2],
  [2, 4, 3, 5, 2],
  [3, 2, 3, 2, 3],
];
const bars = h => h.flatMap((n, x) => [...Array(n)].map((_, k) => [x, 4 - k]));
FLIP.dance = EQ.map(h => [fromCells(bars(h)), B(0.5)]);
FC.dance = { fr: FLIP.dance, durs: FLIP.dance.map(([, h]) => h), total: B(4) };
DRONES.states.dance = t => {
  const u4 = t / BEAT,
    step = Math.floor(u4),
    u = u4 % 1,
    sway = 0.12 * Math.sin(PI * u4);
  return {
    ents: CORNERS.map(([x, z], i) => ({
      x: x + sway,
      z,
      h: 0.14 + 0.3 * (i % 2 === step % 2 ? bell(seg(u, 0, 0.55)) : 0),
      a: 1,
      hit: 0,
    })),
  };
};
const EYES_DANCE_KEYS = () => [[0, EP({ sm: 0.35, ct: 0.45, gy: -0.02 })]];
/* A head-bob groove: the visor dips on every beat and tilts across the bar. The eyes ride each dip a moment late, hop on
   alternating offbeats, and look against the tilt. */
EYES.states.dance = t => ({
  ents: pair(EYES_DANCE_KEYS, t, (p, tt, sd) => {
    const u4 = mod(tt, 4 * BEAT) / BEAT,
      u = u4 % 1,
      pulse = x => Math.exp(-x * 7) * Math.min(1, x / 0.06),
      dip = pulse(u),
      late = u - 0.08,
      ride = late > 0 ? pulse(late) + 0.25 * Math.exp(-late * 6) * Math.sin(late * 22) : 0,
      tilt = Math.sin((PI * u4) / 2),
      isMine = sd > 0 === (Math.floor(u4) % 2 === 1),
      hopUp = isMine ? bell(seg(u, 0.35, 0.8)) : 0;
    p.hy += 0.07 * dip;
    p.vsy *= 1 - 0.1 * dip;
    p.vsx *= 1 + 0.08 * dip;
    p.roll += 0.14 * tilt;
    p.hx += 0.04 * tilt;
    p.gx -= 0.08 * tilt;
    p.gy += 0.07 * ride - 0.05 * hopUp;
    p.h *= (1 - 0.16 * dip) * (1 + 0.14 * hopUp);
    p.w *= (1 + 0.1 * dip) / (1 + 0.07 * hopUp);
    return p;
  }),
});
BLOT.states.dance = t => {
  const u4 = t / BEAT,
    u = u4 % 1,
    land = Math.exp(-u * 10) * Math.min(1, u / 0.05),
    st = 0.12 * Math.abs(Math.cos(PI * u)) * (1 - land),
    none = { x: 0, y: 0, r: 0, sx: 1, sy: 1 };
  return {
    ents: [
      {
        x: 0.08 * Math.sin(PI * u4),
        y: 0.1 - 0.24 * Math.sin(PI * u),
        r: 0.34,
        sx: (1 + 0.3 * land) / (1 + st),
        sy: (1 - 0.3 * land) * (1 + st),
      },
      none,
      none,
      none,
    ],
  };
};
DEKATRON.states.dance = t => {
  const u4 = t / BEAT,
    u = u4 % 1,
    k = 5 * (Math.floor(u4) + E.inOut(seg(u, 0.1, 0.9))),
    meet = Math.min(1, bell(seg(u, 0.85, 1)) + bell(seg(u, 0, 0.15)));
  return { flash: 0.6 * meet, twin: mod(-k, DK), ents: [{ k: mod(k, DK), g: 1 + 0.3 * meet }] };
};
LENS.states.dance = t => {
  const u4 = t / BEAT,
    u = u4 % 1,
    p = Math.exp(-u * 5) * Math.min(1, u / 0.06);
  return {
    rip: Math.floor(u4) % 2 ? 0 : seg(u, 0, 0.8),
    ents: [
      {
        glow: 0.75 + 0.35 * p,
        size: 0.62,
        flick: 0,
        ap: 0.4 + 0.14 * p,
        bloom: 0.3 * p,
        ox: 0.2 * Math.sin(PI * u4),
        oy: -0.08 * Math.abs(Math.sin(PI * u4)),
      },
    ],
  };
};
