import { BEAT, INK, OFF_A, PI, TAU, css, ctxFor, fitFor, gaze, mod, seg } from '../core.js';

export const lv = fn => Array.from({ length: 5 }, (_, y) => Array.from({ length: 5 }, (_, x) => fn(x, y) | 0));
export const fromCells = (list, level = 2) => lv((x, y) => (list.some(([a, b]) => a === x && b === y) ? level : 0));
export const merge = (...g) => lv((x, y) => Math.max(...g.map(q => q[y][x])));
export const ZERO = lv(() => 0),
  B = n => n * BEAT;
export const PERIM = [
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
export const CHECK5 = [
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
  error: [[fromCells(CROSS3), B(4)]],
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
Object.entries(FLIP).forEach(([id, fr]) => {
  const durs = fr.map(([, h]) => Math.max(h, 0.1));
  FC[id] = { fr, durs, total: durs.reduce((a, b) => a + b, 0) };
});
export const frameAt = (id, u, from0) => {
  const { fr, durs, total } = FC[id],
    first = u < total;
  u = mod(u, total);
  let k = 0;
  while (k < fr.length - 1 && u >= durs[k]) {
    u -= durs[k];
    k++;
  }
  return { to: fr[k][0], from: k === 0 ? (first && from0 ? from0 : fr[fr.length - 1][0]) : fr[k - 1][0], u, k, first };
};
export const DISC_T = 0.1;
export const flipCells = (id, u, from0, recolor) => {
  const f = frameAt(id, u, from0),
    out = [];
  for (let y = 0; y < 5; y++)
    for (let x = 0; x < 5; x++) {
      const a = f.from[y][x],
        b = f.to[y][x],
        fresh = f.first && f.k === 0 && !!from0,
        d = (x + y) * 0.018;
      let lvl = b,
        s = 1,
        old = false;
      if (a !== b || (recolor && fresh && a > 0)) {
        const g = seg(f.u - d, 0, DISC_T);
        if (g < 1) {
          lvl = g < 0.5 ? a : b;
          s = Math.max(0.08, Math.abs(Math.cos(PI * g)));
          old = g < 0.5 && fresh;
        } else {
          const w = f.u - d - DISC_T,
            th = 0.55 * Math.exp(-w * 11) * Math.sin(w * 42);
          s = Math.abs(Math.cos(th));
        }
      }
      if (id === 'error' && b === 2 && !(fresh && f.u < 0.3)) {
        const p = mod(u, B(4)),
          dd = Math.hypot(x - 2, y - 2) * 0.05;
        [0.2, 0.5].forEach(t0 => {
          const g = seg(p - t0 - dd, 0, 0.2);
          if (g > 0 && g < 1) {
            s = Math.max(0.08, Math.abs(Math.cos(TAU * g)));
            lvl = g < 0.25 || g > 0.75 ? 2 : 0;
          }
        });
      }
      out.push({ x, y, lvl, s, old });
    }
  return { cells: out, bits: f.to };
};
export const renderFlip = (cv, cells, colOld, colNew) => {
  const { ctx, W, px } = ctxFor(cv),
    big = px > 40,
    cell = (W * fitFor('flipdot', px)) / 5,
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
      fill = c.lvl || cv._ink || look ? col : INK(),
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
