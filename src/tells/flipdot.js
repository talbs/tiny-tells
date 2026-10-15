import { BEAT, INK, OFF_A, PI, TAU, css, ctxFor, gaze, ink, mod, seg, tone } from '../core.js';

export const lv = fn => Array.from({ length: 5 }, (_, y) => Array.from({ length: 5 }, (_, x) => fn(x, y) | 0));
export const fromCells = (list, level = 2) => lv((x, y) => (list.some(([a, b]) => a === x && b === y) ? level : 0));
export const merge = (...g) => lv((x, y) => Math.max(...g.map(q => q[y][x])));
const ZERO = lv(() => 0);
export const B = n => n * BEAT;
const PERIM = [
  [0, 0],
  [1, 0],
  [2, 0],
  [3, 0],
  [4, 0],
  [4, 1],
  [4, 2],
  [4, 3],
  [4, 4],
  [3, 4],
  [2, 4],
  [1, 4],
  [0, 4],
  [0, 3],
  [0, 2],
  [0, 1],
];
const CHECK5 = [
    [1, 2],
    [2, 3],
    [3, 2],
    [4, 1],
  ],
  CROSS3 = [
    [1, 1],
    [3, 1],
    [2, 2],
    [1, 3],
    [3, 3],
  ],
  STEM = [
    [2, 0],
    [2, 1],
    [2, 2],
  ],
  DOT = [[2, 4]];
export const FLIP = {
  working: PERIM.map((_, k) => [
    lv((x, y) => {
      for (let j = 0; j < 5; j++) {
        const p = PERIM[(k - j + 32) % 16];
        if (p[0] === x && p[1] === y) return j < 2 ? 2 : 1;
      }
      return 0;
    }),
    B(0.25),
  ]),
  done: [
    [ZERO, B(0.25)],
    [fromCells(CHECK5, 1), B(0.25)],
    ...CHECK5.map((_, i) => [
      merge(fromCells(CHECK5, 1), fromCells(CHECK5.slice(0, i + 1))),
      i === 3 ? B(2.75) : B(0.125),
    ]),
    [fromCells(CHECK5, 1), B(0.375)],
  ],
  error: [
    [fromCells(CROSS3), 0.2, , 0.05],
    [ZERO, 0.17, , 0.05],
    [fromCells(CROSS3), 0.13, , 0.05],
    [ZERO, 0.17, , 0.05],
    [fromCells(CROSS3), B(4) - 0.67, , 0.05],
  ],
  warning: [
    [ZERO, B(0.25)],
    [fromCells(STEM.slice(0, 1)), B(0.125)],
    [fromCells(STEM.slice(0, 2)), B(0.125)],
    [fromCells(STEM), B(0.25)],
    [fromCells([...STEM, ...DOT]), B(0.5)],
    [fromCells(STEM), B(0.25)],
    [fromCells([...STEM, ...DOT]), B(0.5)],
    [fromCells(STEM), B(0.25)],
    [fromCells([...STEM, ...DOT]), B(1.25)],
    [fromCells([...STEM, ...DOT], 1), B(0.5)],
  ],
  idle: [
    [fromCells([[2, 2]], 1), B(4)],
    [fromCells([[2, 2]]), B(1)],
    [fromCells([[2, 2]], 1), B(1)],
  ],
};
export const FC = {};
export const timeline = fr => {
  const durs = fr.map(([, h]) => Math.max(h, 0.1));
  return { fr, durs, total: durs.reduce((a, b) => a + b, 0) };
};
Object.entries(FLIP).forEach(([id, fr]) => (FC[id] = timeline(fr)));
const frameAt = (id, u) => {
  const { fr, durs, total } = FC[id],
    first = u < total;
  u = mod(u, total);
  let k = 0;
  while (k < fr.length - 1 && u >= durs[k]) {
    u -= durs[k];
    k++;
  }
  return { to: fr[k][0], from: fr[(k || fr.length) - 1][0], u, k, first };
};
const DISC_T = 0.1;
/* cut is the last clip's drawn cells: a disc caught mid-turn (p) picks up from that phase, turning back if its new level differs from the one showing. */
export const flipCells = (id, u, cut, recolor) => {
  /* Frames are [cells, hold, flip?, ripple?]: flip is the turn time into the frame (default DISC_T); ripple staggers from the center, not the corner. */
  const f = frameAt(id, u),
    [, , T = DISC_T, rip] = FC[id].fr[f.k],
    out = [];
  for (let y = 0; y < 5; y++)
    for (let x = 0; x < 5; x++) {
      const c = f.first && !f.k && cut?.[out.length],
        a = c ? c.lvl : f.from[y][x],
        b = f.to[y][x],
        r = Math.hypot(x - 2, y - 2),
        h = c?.p && (c.p < 0.5 || a === b ? c.p : 1 - c.p),
        d = h ? -h * T : rip ? rip * r : (x + y) * 0.018;
      let lvl = b,
        s = 1,
        old,
        p;
      if (a !== b || h || (recolor && c && a > 0)) {
        const g = seg(f.u - d, 0, T);
        if (g < 1) {
          lvl = g < 0.5 ? a : b;
          s = Math.max(0.08, Math.abs(Math.cos(PI * g)));
          old = g < 0.5 && !!c;
          p = g;
        } else {
          const w = (f.u - d - T) / (T / DISC_T),
            th = 0.55 * Math.exp(-w * 11) * Math.sin(w * 42);
          s = Math.abs(Math.cos(th));
        }
      }
      out.push({ x, y, lvl, s, old, p });
    }
  return { cells: out, bits: f.to };
};
export const renderFlip = (cv, cells, colOld, colNew) => {
  const { ctx, W, px, k } = ctxFor(cv, FLIPDOT.fit),
    big = px > 40,
    cell = (W * k) / 5,
    off = (W - cell * 5) / 2;
  const near =
    gaze && Math.hypot(gaze.x, gaze.y) > 0.2
      ? [
          2 + Math.round((2 * gaze.x) / Math.max(Math.abs(gaze.x), Math.abs(gaze.y))),
          2 + Math.round((2 * gaze.y) / Math.max(Math.abs(gaze.x), Math.abs(gaze.y))),
        ]
      : null;
  cells.forEach(c => {
    const look = near && !c.lvl && c.x === near[0] && c.y === near[1],
      col = c.old ? colOld : colNew,
      fill = c.lvl || ink || look ? col : INK(),
      a = c.lvl === 2 ? 1 : c.lvl === 1 ? 0.45 : look ? 0.45 * Math.min(1, Math.hypot(gaze.x, gaze.y)) : OFF_A;
    const cx = off + (c.x + 0.5) * cell,
      cy = off + (c.y + 0.5) * cell,
      r = cell * (big ? 0.31 : 0.36);
    ctx.fillStyle = css(fill, a, c.s < 1 ? -0.08 * (1 - c.s) : 0);
    ctx.beginPath();
    ctx.ellipse(cx, cy, Math.max(0.5, r * c.s), r, 0, 0, TAU);
    ctx.fill();
  });
};
class FPlayer {
  constructor(id = 'working') {
    Object.assign(this, { id, t0: 0, snap: null, col0: null });
  }
  set(id, T) {
    if (id === this.id) return;
    this.snap = flipCells(this.id, T - this.t0, this.snap).cells;
    this.col0 = tone(this.id);
    this.id = id;
    this.t0 = T;
  }
  draw(cv, T) {
    const col = tone(this.id),
      recolor = this.col0?.some((v, i) => v !== col[i]);
    renderFlip(cv, flipCells(this.id, T - this.t0, this.snap, recolor).cells, ink || this.col0 || col, ink || col);
  }
}
export const FLIPDOT = { fit: () => 0.8, player: id => new FPlayer(id) };
