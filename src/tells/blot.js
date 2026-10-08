/* ---- Blot: liquid. Stretchy drops, necks, drips, splats, and a sheen. ---- */
import { BEAT, E, G, PI, SHADOW, TAU, bell, clamp, css, ctxFor, drop, gaze, hop, lerp, seg } from '../core.js';

export const BLOT = {
  keys: ['x', 'y', 'r', 'sx', 'sy'],
  still: { done: 1.6 },
  pos: ['x', 'y'],
  states: {
    working: t => {
      const p = t / (4 * BEAT),
        beat = Math.floor(p * 4),
        u = (p * 4) % 1,
        reach = bell(seg(u, 0.15, 0.85)),
        spin = (TAU / 3) * p;
      const lobes = [0, 1, 2].map(k => {
        const a = spin + (k * TAU) / 3,
          isOut = k === beat % 3,
          d = 0.2 + (isOut ? 0.28 * reach : 0);
        return {
          x: d * Math.cos(a),
          y: d * Math.sin(a),
          r: isOut ? 0.2 - 0.05 * reach : 0.2,
          sx: isOut ? 1 + 0.25 * reach : 1,
          sy: 1,
        };
      });
      return { ents: [{ x: 0, y: 0, r: 0.3, sx: 1, sy: 1 }, ...lobes] };
    },
    done: t => {
      /* Drops hold apart until 0.45s so a handoff lands on the split, then merge to hop on the first beat. u runs through the loop seam, so the hold before the merge keeps wobbling. */
      const m = E.in(seg(t, 0.45, 0.8)),
        out = E.inOut(seg(t, 2.75, 3.2)),
        u = t > 1.6 ? t - 3.2 : t,
        wob =
          u < -0.3
            ? 0
            : 0.08 * (1 - m) * clamp((u + 0.3) / 0.3) * Math.exp(-Math.max(u, 0) * 5) * Math.sin((u + 0.3) * 20),
        R = lerp(lerp(0.42 - 0.02 * E.inOut(seg(t, 0, 0.45)), 0, m), 0.42, out),
        up = hop(0.16, t - 0.8),
        v = (up - hop(0.16, t - 0.81)) / 0.01;
      const tl = t - 0.8 - 2 * Math.sqrt((2 * 0.16) / G),
        sq = tl > 0 ? Math.exp(-tl * 7) * Math.cos(tl * 26) : 0,
        st = clamp(Math.abs(v) * 0.06, 0, 0.25),
        sx = lerp((1 + 0.25 * sq) / (1 + st), 1, out) * (1 + wob),
        sy = lerp((1 + st) * (1 - 0.25 * sq), 1, out) * (1 - wob);
      return {
        ents: [90, 210, 330]
          .map(deg => {
            const a = (deg * PI) / 180;
            return { x: R * Math.cos(a), y: R * Math.sin(a) - up * (1 - out), r: 0.22, sx, sy };
          })
          .concat([{ x: 0, y: 0, r: 0, sx: 1, sy: 1 }]),
      };
    },
    error: t => {
      const fall = drop(0.66, t - 0.1),
        y = 0.3 - fall.h,
        impact = t > 0.1 + Math.sqrt((2 * 0.66) / G),
        ti = t - 0.1 - Math.sqrt((2 * 0.66) / G);
      const splat = impact ? Math.exp(-ti * 2.2) * (1 + 0.35 * Math.sin(ti * 18) * Math.exp(-ti * 5)) : 0,
        back = E.inOut(seg(t, 2.6, 3.15)),
        spread = impact ? 0.5 * (1 - Math.exp(-ti * 14)) * Math.exp(-ti * 1.6) : 0;
      const vy = impact ? 0 : Math.abs(fall.v);
      return {
        ents: [
          {
            x: 0,
            y: lerp(y, -0.36, back) + 0.12 * splat,
            r: 0.27,
            sx: (1 + 0.9 * splat) * (1 - 0.1 * clamp(vy * 0.2)),
            sy: (1 - 0.55 * splat) * (1 + 0.3 * clamp(vy * 0.2)),
          },
          {
            x: -spread * (1 - back),
            y: lerp(0.3, -0.05, back) + 0.02,
            r: impact ? 0.12 * (1 - back) : 0,
            sx: 1,
            sy: 1,
          },
          { x: spread * (1 - back), y: lerp(0.3, -0.05, back) + 0.02, r: impact ? 0.12 * (1 - back) : 0, sx: 1, sy: 1 },
          { x: 0, y: 0, r: 0, sx: 1, sy: 1 },
        ],
      };
    },
    warning: t => {
      const drip = t0 => {
        const tt = t - t0,
          form = seg(tt, 0, 0.35),
          fall = drop(0.36, tt - 0.35),
          gone = (0.36 - fall.h) / 0.36;
        return tt < 0
          ? null
          : tt < 0.35
            ? { x: 0, y: 0.08 + 0.26 * E.in(form), r: 0.12 * form, sx: 1, sy: 1 + 0.5 * form }
            : {
                x: 0,
                y: 0.34 + (0.36 - fall.h),
                r: 0.12 * (1 - gone * gone),
                sx: 1,
                sy: 1 + 0.6 * clamp(Math.abs(fall.v) * 0.2),
              };
      };
      const a = drip(0.5) || { x: 0, y: 0.08, r: 0, sx: 1, sy: 1 },
        b = drip(1.1) || { x: 0, y: 0.08, r: 0, sx: 1, sy: 1 },
        sag =
          bell(seg(t, 0.5, 0.85)) +
          bell(seg(t, 1.1, 1.45)) +
          (t > 1.6 ? 0.6 * bell(seg((t % BEAT) / BEAT, 0, 0.9)) : 0);
      return {
        ents: [
          { x: 0, y: -0.12 + 0.04 * sag, r: 0.36, sx: 1 - 0.06 * sag, sy: 1 + 0.1 * sag },
          a,
          b,
          { x: 0, y: 0, r: 0, sx: 1, sy: 1 },
        ],
      };
    },
    idle: t => {
      const p = t / (6 * BEAT),
        sep = 0.2 + 0.14 * Math.sin(TAU * p);
      return {
        ents: [
          { x: -sep, y: 0.04 * Math.sin(TAU * 2 * p), r: 0.24, sx: 1, sy: 1 },
          { x: sep, y: -0.04 * Math.sin(TAU * 2 * p), r: 0.2, sx: 1, sy: 1 },
          { x: 0, y: 0, r: 0, sx: 1, sy: 1 },
          { x: 0, y: 0, r: 0, sx: 1, sy: 1 },
        ],
      };
    },
  },
  render: (cv, s, color) => {
    const { ctx, W, small, unit, o } = ctxFor(cv, 'blot'),
      N = small ? 34 : Math.min(256, Math.round(W / 2));
    const off = cv._blot || (cv._blot = { a: document.createElement('canvas'), b: document.createElement('canvas') });
    off.a.width = off.a.height = N;
    off.b.width = off.b.height = W;
    const actx = off.a.getContext('2d'),
      img = actx.createImageData(N, N),
      blobs = s.ents.filter(b => b.r > 0.01);
    /* The edge fades over one sample, measured as a distance (field over its slope), so it stays crisp at any size. The slope only matters near the edge, so it's skipped elsewhere. */
    const sample = W / N / unit;
    for (let j = 0; j < N; j++)
      for (let i = 0; i < N; i++) {
        const x = (((i + 0.5) / N) * W - o) / unit - (gaze ? gaze.x * 0.05 : 0),
          y = (((j + 0.5) / N) * W - o) / unit - (gaze ? gaze.y * 0.05 : 0);
        let f = 0;
        blobs.forEach(b => {
          const dx = (x - b.x) / (b.sx || 1),
            dy = (y - b.y) / (b.sy || 1);
          f += (b.r * b.r) / (dx * dx + dy * dy + 1e-4);
        });
        let a = f > 1.05 ? 1 : 0;
        if (f > 0.5 && f < 2) {
          let gx = 0,
            gy = 0;
          blobs.forEach(b => {
            const sx = b.sx || 1,
              sy = b.sy || 1,
              dx = (x - b.x) / sx,
              dy = (y - b.y) / sy,
              d2 = dx * dx + dy * dy + 1e-4,
              v = (b.r * b.r) / d2;
            gx -= (2 * v * dx) / (d2 * sx);
            gy -= (2 * v * dy) / (d2 * sy);
          });
          a = clamp(0.5 + (f - 1.05) / (Math.hypot(gx, gy) + 1e-6) / sample);
        }
        const k = (j * N + i) * 4;
        img.data[k] = img.data[k + 1] = img.data[k + 2] = 255;
        img.data[k + 3] = a * 255;
      }
    actx.putImageData(img, 0, 0);
    const bctx = off.b.getContext('2d');
    bctx.clearRect(0, 0, W, W);
    bctx.imageSmoothingEnabled = true;
    bctx.drawImage(off.a, 0, 0, W, W);
    bctx.globalCompositeOperation = 'source-in';
    if (!small) {
      const g = bctx.createLinearGradient(0, o - 0.7 * unit, 0, o + 0.7 * unit);
      g.addColorStop(0, css(color, 1, 0.09));
      g.addColorStop(1, css(color, 1, -0.07));
      bctx.fillStyle = g;
    } else bctx.fillStyle = css(color);
    bctx.fillRect(0, 0, W, W);
    if (!small) {
      bctx.globalCompositeOperation = 'source-atop';
      blobs
        .filter(b => b.r > 0.18)
        .forEach(b => {
          const gx = o + (b.x - b.r * 0.35 * (b.sx || 1)) * unit,
            gy = o + (b.y - b.r * 0.45 * (b.sy || 1)) * unit,
            rr = b.r * 0.5 * unit,
            g = bctx.createRadialGradient(gx, gy, 0, gx, gy, rr);
          g.addColorStop(0, 'rgba(255,255,255,.45)');
          g.addColorStop(1, 'rgba(255,255,255,0)');
          bctx.fillStyle = g;
          bctx.fillRect(gx - rr, gy - rr, rr * 2, rr * 2);
        });
    }
    bctx.globalCompositeOperation = 'source-over';
    ctx.save();
    ctx.shadowColor = SHADOW(0.4, color);
    ctx.shadowBlur = W * (small ? 0.04 : 0.05);
    ctx.shadowOffsetY = W * 0.03;
    ctx.drawImage(off.b, 0, 0);
    ctx.restore();
  },
};
