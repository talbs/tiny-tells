/* ---- Doze: an idle tell left alone nods off, sleeps, and wakes. Three clips per tell. Only in the play bundle. ---- */
import { ALIAS, BEAT, E, PERIOD, PHYS, TAU, bell, hop, lerp, mod, seg } from './core.js';
import { AERIAL, CORNERS, DRONES } from './tells/drones.js';
import { B, FC, FLIP, fromCells, lv, timeline } from './tells/flipdot.js';
import { EP, EYES, pair } from './tells/eyes.js';
import { BLOT } from './tells/blot.js';
import { DEKATRON, DK } from './tells/dekatron.js';
import { LENS } from './tells/lens.js';

export const DOZE_CLIPS = ['nod', 'doze', 'wake'];
/* A once clip holds its end pose for a quarter beat past its timer, so the frame drawn as the timer fires never wraps back to its start. */
export const LEN = { nod: 2 * BEAT, wake: BEAT };
const SLOW = 4 * BEAT,
  phase = t => mod(t, SLOW) / SLOW;
const breathe = t => 0.5 - 0.5 * Math.cos((TAU * t) / SLOW);
PERIOD.nod = LEN.nod + B(0.25);
PERIOD.wake = LEN.wake + B(0.25);
PERIOD.doze = 8 * BEAT;
PHYS.nod = PHYS.doze = PHYS.idle;
PHYS.wake = { w: 14, z: 0.45 };
for (const id of DOZE_CLIPS) {
  ALIAS[id] = 'idle';
  DRONES.cam[id] = AERIAL;
}
const held = (t, id) => Math.min(t, LEN[id] - 1e-3);

/* Asleep is lids nearly shut from the top, not done's proud arcs (sm) or error's flat squint. */
const SLEEP = EP({ lid: 0.88, gy: 0.08 });
const EYES_NOD = () => [
  [0, EP({ lid: 0.42, gy: 0.03 }), 4, 1],
  [0.5, EP({ lid: 0.8, gy: 0.12, roll: 0.08 }), 3, 1],
  [0.75, EP({ lid: 0.1, h: 1.15, gy: -0.02 }), 26, 0.5],
  [1, SLEEP, 2.5, 1],
];
const EYES_DOZE = () => [
  [0, SLEEP, 2, 1],
  [SLOW, { ...SLEEP, gy: 0.1, roll: 0.04 }, 1.2, 1],
];
const EYES_WAKE = () => [
  [0, SLEEP],
  [0.06, EP({ h: 1.22, w: 0.93, gy: -0.05, ct: 0.15, cb: 0.15 }), 30, 0.5],
  [0.45, EP({ lid: 0.42, gy: 0.03 }), 8, 0.8],
];
EYES.states.nod = t => ({ ents: pair(EYES_NOD, held(t, 'nod'), null, LEN.nod) });
EYES.states.doze = t => ({ ents: pair(EYES_DOZE, t, null, PERIOD.doze) });
EYES.states.wake = t => {
  const u = held(t, 'wake');
  return {
    ents: pair(
      EYES_WAKE,
      u,
      p => {
        const up = hop(0.06, u - 0.06);
        p.gy -= up;
        p.hy -= up;
        return p;
      },
      LEN.wake
    ),
  };
};

/* Three sleepers in an L with clear floor between them at 20px, and a sentry off its open corner that sinks and jerks awake. */
const SENTRY = 1,
  BUNK = [
    [-0.32, -0.28],
    [0.34, -0.24],
    [0.16, 0.32],
    [-0.32, 0.32],
  ],
  FLOOR = 0.005,
  HOVER = 0.09,
  WATCH = 0.44,
  JOLT = 0.16,
  POP = 0.14,
  SINK_ORDER = [1, -1, 2, 0],
  droop = (t, at, len, depth) =>
    depth * E.inOut(seg(t, at, at + len)) * (1 - E.back(seg(t, at + len + 0.25, at + len + 0.55), 2.2));
DRONES.states.nod = t => ({
  ents: CORNERS.map(([cx, cz], i) => {
    const up = lerp(FLOOR, HOVER, E.out(seg(t, 0, 0.3))),
      k = E.inOut(seg(t, 0.1 + 0.08 * i, 0.9 + 0.08 * i)),
      at = 0.85 + 0.2 * SINK_ORDER[i];
    return {
      x: lerp(cx, BUNK[i][0], k),
      z: lerp(cz, BUNK[i][1], k),
      h: i === SENTRY ? lerp(up, WATCH, E.inOut(seg(t, 0.4, 1.4))) : lerp(up, 0, E.inOut(seg(t, at, at + 0.3))),
      a: 0.85,
      hit: 0,
    };
  }),
});
DRONES.states.doze = t => ({
  ents: BUNK.map(([x, z], i) => ({
    x: x,
    z: z,
    h: i === SENTRY ? WATCH - droop(t, 0.2, 1.7, 0.26) - droop(t, 3, 2, 0.38) : 0,
    a: 0.85,
    hit: 0,
  })),
});
/* The roll call is the handoff hop into idle, so wake only springs them back past the square. */
DRONES.states.wake = t => {
  const out = E.back(seg(t, 0.08, 0.42), 1.7);
  return {
    ents: CORNERS.map(([cx, cz], i) => {
      const h =
        i === SENTRY
          ? lerp(WATCH + POP * E.out(seg(t, 0, 0.14)), FLOOR, E.inOut(seg(t, 0.14, 0.42)))
          : lerp(JOLT * E.out(seg(t, 0.08, 0.2)), FLOOR, E.inOut(seg(t, 0.2, 0.42)));
      return { x: lerp(BUNK[i][0], cx, out), z: lerp(BUNK[i][1], cz, out), h, a: 0.85, hit: 0 };
    }),
  };
};

const [[CURSOR], [BRIGHT]] = FLIP.idle,
  Z = [[0, 1, 2, 3], [2], [1], [0, 1, 2, 3]],
  glyphAt = (rows, ox, oy) => fromCells(rows.flatMap((xs, r) => xs.map(x => [x + ox, r + oy])));
FLIP.nod = [
  [CURSOR, B(0.125)],
  [BRIGHT, B(0.375), 0.15],
  [CURSOR, B(0.375), 0.22],
  [BRIGHT, B(0.5), 0.3],
  [CURSOR, B(0.875), 0.4],
];
const drift = [0.75, 0.75, 0.625, 0.625].map((h, i) => [glyphAt(Z, i, 1 - i), B(h), 0.25]);
FLIP.doze = [[CURSOR, B(1)], ...drift, [CURSOR, B(0.625), 0.25], ...drift, [CURSOR, B(0.875), 0.25]];
FLIP.wake = [
  [lv(() => 2), B(0.375), , 0.04],
  [CURSOR, B(0.875), , 0.04],
];
for (const id of DOZE_CLIPS) FC[id] = timeline(FLIP[id]);

/* The dome stays rounder than error's splat (sx 1.9, sy 0.45), and the bead always leaves and fades, so it never reads as splitting. */
const DOME = { x: 0, y: 0.12, r: 0.34, sx: 1.25, sy: 0.8 },
  NONE = { x: 0, y: 0, r: 0, sx: 1, sy: 1 };
BLOT.states.nod = t => {
  const k = E.inOut(seg(t, 0, LEN.nod)),
    land = bell(seg(t, 1.25, LEN.nod));
  return {
    ents: [
      {
        x: lerp(-0.2, 0, k),
        y: lerp(0, DOME.y, k),
        r: lerp(0.24, DOME.r, k),
        sx: lerp(1, DOME.sx, k) * (1 + 0.06 * land),
        sy: lerp(1, DOME.sy, k) * (1 - 0.1 * land),
      },
      { x: lerp(0.2, 0, k), y: lerp(0, DOME.y, k), r: 0.2 * (1 - k), sx: 1, sy: 1 },
      NONE,
      NONE,
    ],
  };
};
BLOT.states.doze = t => {
  const u = phase(t),
    pinch = bell(seg(u, 0, 0.25));
  return {
    ents: [
      { ...DOME, sy: DOME.sy * (1 - 0.04 * pinch) },
      {
        x: 0.02 * Math.sin(TAU * u),
        y: lerp(-0.12, -0.5, E.out(seg(u, 0.15, 0.85))),
        r: 0.12 * Math.min(1, u / 0.15) * (1 - E.in(seg(u, 0.6, 0.9))),
        sx: 1,
        sy: 1,
      },
      NONE,
      NONE,
    ],
  };
};
BLOT.states.wake = t => {
  const up = bell(seg(t, 0, 0.55)),
    k = E.out(seg(t, 0.4, 0.8)),
    rise = seg(t, 0, 0.3);
  return {
    ents: [
      {
        x: -0.2 * k,
        y: lerp(DOME.y, 0, seg(t, 0, 0.4)) - 0.18 * up,
        r: lerp(DOME.r, 0.24, k),
        sx: lerp(DOME.sx, 1, rise) / (1 + 0.35 * up),
        sy: lerp(DOME.sy, 1, rise) * (1 + 0.6 * up),
      },
      { x: 0.2 * k, y: 0, r: 0.2 * k, sx: 1, sy: 1 },
      NONE,
      NONE,
    ],
  };
};

/* At 20px only the glow's position reads, so asleep sits at the bottom. A tailU of 1 / 0.6 fades the trail to nothing, so it's always passed. */
const sink = t => 0.5 * E.out(seg(t, 0.15, 0.55)) + 4.5 * E.in(seg(t, 0.8, 1.35)) + 0.3 * bell(seg(t, 1.35, LEN.nod));
DEKATRON.states.nod = t => ({
  tail: [sink(t - 0.05), sink(t - 0.1)],
  tailU: (1 - bell(seg(t, 1, 1.6))) / 0.6,
  ents: [{ k: sink(t), g: lerp(0.25, 0.38, seg(t, 0, LEN.nod)) }],
});
DEKATRON.states.doze = t => ({
  ents: [{ k: 5 + 0.08 * Math.sin(TAU * seg(phase(t), 0, 0.1)), g: 0.38 + 0.22 * breathe(t) }],
});
DEKATRON.states.wake = t => {
  const flash = bell(seg(t, 0.3, 0.65));
  return {
    flash,
    ents: [{ k: mod(5 + 5 * E.inOut(seg(t, 0, 0.35)), DK), g: lerp(0.38, 0.25, seg(t, 0.5, 0.8)) + 0.8 * flash }],
  };
};

/* The iris shuts to its smallest circle (ap clamps at 0.12), and that small, slow pulse is the standby light. */
LENS.states.nod = t => {
  const shut = E.inOut(seg(t, 0.1, 0.9));
  return {
    ents: [
      {
        glow: 0.1 + 0.1 * E.inOut(seg(t, 1.1, LEN.nod)),
        size: lerp(0.55, 0.2, shut),
        ox: 0,
        ap: lerp(0.36, 0.12, shut),
        bloom: 0,
      },
    ],
  };
};
LENS.states.doze = t => {
  const b = breathe(t);
  return { ents: [{ glow: 0.2 + 0.3 * b, size: 0.2, ox: 0, ap: 0.12, bloom: 0.2 * b }] };
};
LENS.states.wake = t => {
  const open = E.out(seg(t, 0, 0.3)),
    wide = bell(seg(t, 0.05, 0.5));
  return {
    rip: seg(t, 0.05, 0.65),
    ents: [
      {
        glow: lerp(0.2, 0.1, seg(t, 0.5, 0.8)) + 0.55 * wide,
        size: lerp(0.2, 0.55, open),
        ox: 0,
        ap: lerp(0.12, 0.36, open) + 0.22 * wide,
        bloom: 0.3 * bell(seg(t, 0.05, 0.4)),
      },
    ],
  };
};
