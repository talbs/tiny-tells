/* ---- Eyes: eyes saccade and the head follows; every hit lands on the shared beat. Light can't leave the glass. ---- */
import { BEAT, E, G, TAU, bell, clamp, css, ctxFor, gaze, hop, isDark, lerp, mod, seg, springOff } from '../core.js';

export const GAZE = { gx: 1, gy: 1 };
/* Each keyframe springs from where the eye actually is, at the speed it is moving, so motion carries through instead of snapping. */
const run = (ks, from, to, t, slow, damp, [x0, v0]) => {
  const x = { ...x0 },
    v = { ...v0 };
  for (let s = from; s <= to; s++) {
    const [t0, cur, kw = 16, kz = 0.55] = ks[s],
      dt = (s < to ? ks[s + 1][0] : t) - t0;
    for (const k in cur) {
      const sac = GAZE[k] && slow === 1,
        w = sac ? Math.max(kw, 34) : kw * slow,
        z = (sac ? 0.72 : kz) * damp,
        d = x[k] - cur[k],
        p = springOff(d, v[k] || 0, dt, w, z);
      v[k] = (springOff(d, v[k] || 0, dt + 1e-4, w, z) - p) / 1e-4;
      x[k] = cur[k] + p;
    }
  }
  return [x, v];
};
export const tween = (fn, sd, t, slow = 1, P = 0, damp = 1) => {
  const { ks, b } = ((fn.cache ||= {})[`${sd},${slow},${P},${damp}`] ||= (() => {
    const ks = fn(sd),
      rest = [{ ...ks[ks.length - 1][1] }, {}],
      b = [P ? run(ks, 0, ks.length - 1, P, slow, damp, rest) : rest];
    for (let s = 1; s < ks.length; s++) b.push(run(ks, s - 1, s - 1, ks[s][0], slow, damp, b[s - 1]));
    return { ks, b };
  })());
  if (P) t = mod(t, P);
  let i = ks.length - 1;
  while (i > 0 && t < ks[i][0]) i--;
  return run(ks, i, i, t, slow, damp, b[i])[0];
};
export const blink = (p, t, t0) => {
  const k = E.in(seg(t, t0, t0 + 0.06)) * (1 - E.out(seg(t, t0 + 0.09, t0 + 0.21))),
    a = t - t0 - 0.21,
    os = a > 0 ? 0.06 * Math.exp(-a * 14) * Math.sin(a * 32) : 0;
  p.h *= 1 - 0.92 * k + os;
  p.w *= 1 + 0.1 * k;
  return p;
};
export const EP = (o = {}) => ({
  gx: 0,
  gy: 0,
  hx: 0,
  hy: 0,
  roll: 0,
  w: 1,
  h: 1,
  ct: 0.3,
  cb: 0.3,
  sm: 0,
  lid: 0,
  lt: 0,
  ...o,
});
/* The head trails the eyes on a softer, underdamped spring, so it overshoots. Keyframes are fixed in time, so it peeks at the next gaze and leans away first. */
const head = (ks, sd, t, P) => {
  const hd = tween(ks, sd, t - 0.06, 0.5, P, 0.55),
    now = tween(ks, sd, t, 1, P),
    soon = tween(ks, sd, t + 0.08, 1, P),
    hx = 0.42 * hd.gx - 0.25 * (soon.gx - now.gx),
    hy = 0.42 * hd.gy - 0.25 * (soon.gy - now.gy);
  return { hx, hy, roll: hd.roll + 0.3 * hx };
};
export const pair = (ks, t, fx, P = 4 * BEAT) =>
  [-1, 1].map((sd, i) => {
    const tt = t - (i ? 0.06 : 0),
      p = tween(ks, sd, tt, 1, P),
      h0 = head(ks, sd, t, P),
      h1 = head(ks, sd, t - 0.05, P),
      vx = (h0.hx - h1.hx) / 0.05,
      vy = (h0.hy - h1.hy) / 0.05;
    p.hx = h0.hx;
    p.hy = h0.hy + 0.006 * Math.sin((TAU * t) / (2 * BEAT));
    p.roll = h0.roll + 0.008 * Math.sin((TAU * t) / P);
    p.vsx = clamp(1 + 0.22 * Math.abs(vx) - 0.12 * Math.abs(vy), 0.95, 1.05);
    p.vsy = clamp(1 + 0.22 * Math.abs(vy) - 0.12 * Math.abs(vx), 0.95, 1.05);
    return fx ? fx(p, tt, sd) : p;
  });
export const hm = (sd, on) =>
  on
    ? sd > 0
      ? EP({ h: 1.28, w: 0.92, gy: -0.04, ct: 0.15, cb: 0.15, roll: -0.07 })
      : EP({ h: 0.8, lid: 0.32, lt: 0.35, gy: -0.03, roll: -0.07 })
    : EP({ h: 1.2, w: 0.93, gy: -0.04, ct: 0.15, cb: 0.15, roll: -0.03 });
const PROUD = EP({ sm: 1, ct: 0.85, w: 1.1, gy: -0.06 });
const WORKING_KEYS = sd => [
  [0, EP()],
  [0.08, EP({ gx: 0.12, gy: -0.1, lid: sd > 0 ? 0.22 : 0, lt: sd > 0 ? -0.3 : 0, roll: -0.06 })],
  [BEAT, EP({ gx: 0.14, gy: -0.08, lid: sd > 0 ? 0.26 : 0, lt: sd > 0 ? -0.3 : 0, roll: -0.07 }), 10, 0.7],
  [2 * BEAT, EP({ gx: -0.11, gy: -0.07, lid: sd < 0 ? 0.2 : 0, lt: sd < 0 ? 0.3 : 0, roll: 0.05 })],
  [3 * BEAT, EP({ lid: 0.1, h: 0.96 }), 12, 0.7],
];
const DONE_KEYS = () => [
  [0, EP()],
  [0.04, EP({ h: 0.74, w: 1.12, gy: 0.04 }), 28, 0.6],
  [0.14, { ...PROUD, h: 1.08, roll: 0.02 }, 16, 0.45],
  [BEAT, { ...PROUD, roll: 0.07 }, 14, 0.5],
  [1.5 * BEAT, { ...PROUD, roll: -0.06 }, 14, 0.5],
  [2 * BEAT, { ...PROUD, roll: 0.02 }, 9, 0.6],
  [3.5 * BEAT, EP({ sm: 0.4, ct: 0.5, gy: -0.02 }), 8, 0.8],
];
const ERROR_KEYS = sd => [
  [0, EP()],
  [0.1, EP({ h: 1.12, w: 0.95, gy: -0.02 }), 30, 0.6],
  [0.2, EP({ h: 0.14, w: 1.18, ct: 0, cb: 0 }), 34, 0.55],
  [0.38, EP({ h: 0.8 }), 24, 0.5],
  [0.5, EP({ h: 0.14, w: 1.18, ct: 0, cb: 0 }), 34, 0.55],
  [0.72, EP({ lid: 0.36, lt: sd * 0.4, gy: 0.06, h: 0.9, cb: 0.15, roll: 0.05 }), 9, 0.6],
  [2 * BEAT, EP({ lid: 0.46, lt: sd * 0.45, gy: 0.1, h: 0.86, cb: 0.15, roll: 0.08 }), 2.5, 1],
];
const WARNING_KEYS = sd => [
  [0, EP()],
  [0.04, EP({ gx: -0.12, gy: 0.02 }), 20, 0.6],
  [0.3, EP({ gx: -0.1, h: 0.72, w: 1.1, gy: 0.05 }), 28, 0.6],
  [0.42, EP({ gx: 0.02, h: 1.26, w: 0.92, gy: -0.04, ct: 0.15, cb: 0.15 }), 18, 0.5],
  [0.85, hm(sd, 1), 16, 0.5],
  [1.2, hm(sd, 0), 16, 0.5],
  [1.45, hm(sd, 1), 16, 0.5],
  [1.8, hm(sd, 0), 16, 0.5],
  [3.25 * BEAT, EP({ h: 1.16, w: 0.94, gy: -0.03, ct: 0.2, cb: 0.2 }), 8, 0.7],
];
const IDLE_KEYS = () => [
  [0, EP({ lid: 0.42, gy: 0.03 }), 4, 1],
  [1.5 * BEAT, EP({ lid: 0.62, gy: 0.09, roll: 0.06 }), 1.4, 1],
  [3.4, EP({ lid: 0.34, gy: 0.01, h: 1.05 }), 20, 0.4],
  [4, EP({ lid: 0.42, gy: 0.03 }), 4, 1],
];

export const EYES = {
  keys: ['gx', 'gy', 'hx', 'hy', 'roll', 'w', 'h', 'ct', 'cb', 'sm', 'lid', 'lt', 'vsx', 'vsy'],
  pos: [],
  states: {
    working: t => ({
      ents: pair(WORKING_KEYS, t, (p, tt) => blink(p, tt, 2 * BEAT - 0.03)),
    }),
    done: t => {
      const up = hop(0.12, t - 0.14),
        vy = (hop(0.12, t - 0.14) - hop(0.12, t - 0.15)) / 0.01,
        land = 0.14 + 2 * Math.sqrt((2 * 0.12) / G),
        sq = t > land ? Math.exp(-(t - land) * 14) : 0,
        st = clamp(Math.abs(vy) * 0.05, 0, 0.12);
      return {
        ents: pair(DONE_KEYS, t, p => {
          p.gy -= up;
          p.hy -= up;
          p.h *= (1 + st) * (1 - 0.12 * sq);
          p.w *= (1 + 0.08 * sq) / (1 + st);
          p.vsy *= (1 + 0.6 * st) * (1 - 0.1 * sq);
          p.vsx *= (1 + 0.08 * sq) / (1 + 0.6 * st);
          return p;
        }),
      };
    },
    error: t => ({
      shake: [0.025 * Math.sin(t * 90) * (bell(seg(t, 0.2, 0.32)) + bell(seg(t, 0.5, 0.62))), 0],
      ents: pair(ERROR_KEYS, t),
    }),
    warning: t => ({
      ents: pair(WARNING_KEYS, t),
    }),
    idle: t => ({
      ents: pair(IDLE_KEYS, t, (p, tt) => blink(p, tt, 3.7), 6 * BEAT),
    }),
  },
  render: (cv, s, color, vel, opts = {}) => {
    const { ctx, small, unit, o, dpr, px } = ctxFor(cv, 'eyes'),
      fit = seg(px, 24, 48),
      es = lerp(1, 0.78, fit),
      gap = lerp(0.39, 0.345, fit),
      sh = s.shake || [0, 0],
      [a, b] = s.ents,
      body = lerp(0.6, 1, fit),
      hx = (body * (a.hx + b.hx)) / 2,
      hy = (body * (a.hy + b.hy)) / 2,
      roll = (body * (a.roll + b.roll)) / 2,
      vsx = 1 + body * ((a.vsx + b.vsx) / 2 - 1),
      vsy = 1 + body * ((a.vsy + b.vsy) / 2 - 1);
    const ink = opts.ink,
      ec = ink || (isDark ? color : [Math.min(0.86, color[0] + 0.22), color[1] * 1.1, color[2]]),
      pw = 1,
      ph = 0.7,
      pr = 0.54,
      rim = isDark && !ink ? Math.max(dpr, 0.045 * unit) : 0;
    ctx.save();
    ctx.translate(o + (sh[0] + hx + 0.06 * (gaze?.x || 0)) * unit, o + (sh[1] + hy + 0.05 * (gaze?.y || 0)) * unit);
    ctx.rotate(roll);
    ctx.scale(vsx, vsy);
    const rr = (inset, r) => {
      ctx.beginPath();
      ctx.roundRect(
        -pw * unit + inset,
        -ph * unit + inset,
        2 * pw * unit - 2 * inset,
        2 * ph * unit - 2 * inset,
        Math.max(0, r * unit - inset)
      );
    };
    if (ink) ctx.fillStyle = 'transparent';
    else if (isDark) {
      const bz = ctx.createLinearGradient(0, -ph * unit, 0, ph * unit);
      bz.addColorStop(0, css([0.4, 0.008, 277]));
      bz.addColorStop(1, css([0.26, 0.008, 277]));
      ctx.fillStyle = bz;
      rr(0, pr);
      ctx.fill();
      ctx.fillStyle = css([0.13, 0.008, 277]);
    } else {
      const g = ctx.createLinearGradient(0, -ph * unit, 0, ph * unit);
      g.addColorStop(0, css([0.22, 0.012, 277]));
      g.addColorStop(0.6, css([0.32, 0.012, 277]));
      g.addColorStop(1, css([0.42, 0.01, 277]));
      ctx.fillStyle = g;
    }
    rr(rim, pr);
    ctx.fill();
    ctx.clip();
    s.ents.forEach((e, i) => {
      const sd = i ? 1 : -1,
        W = 0.245 * es * unit * e.w,
        H = 0.36 * es * unit * Math.max(0.02, e.h),
        N = 20,
        top = [],
        bot = [];
      for (let j = 0; j <= N; j++) {
        const u = -1 + (2 * j) / N,
          sq = Math.pow(1 - Math.pow(Math.abs(u), 4), 0.25);
        let tp = -H * (1 - e.ct * u * u),
          bt = lerp(H * (1 - e.cb * u * u), tp + 0.78 * H * (1 - u * u) + 0.04 * H, clamp(e.sm));
        tp = Math.max(tp, -H + 2 * H * e.lid + e.lt * H * u);
        const c = (tp + bt) / 2,
          hh = Math.max(0, (bt - tp) / 2) * sq;
        top.push([u * W, c - hh]);
        bot.push([u * W, c + hh]);
      }
      ctx.save();
      ctx.translate((sd * gap + e.gx - hx + 0.16 * (gaze?.x || 0)) * unit, (e.gy - hy + 0.12 * (gaze?.y || 0)) * unit);
      if (!small && !ink) {
        ctx.shadowColor = css(ec, 0.7);
        ctx.shadowBlur = 0.16 * unit;
      }
      ctx.beginPath();
      top.forEach(([x, y], j) => (j ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      for (let j = N; j >= 0; j--) ctx.lineTo(bot[j][0], bot[j][1]);
      ctx.closePath();
      ctx.fillStyle = css(ec);
      ctx.fill();
      ctx.restore();
    });
    ctx.restore();
  },
};
