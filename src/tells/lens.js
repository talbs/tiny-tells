/* ---- Lens: an iris behind smoky glass. Core color always uses the bright step, because the glass is dark. ---- */
import { BEAT, E, PI, TAU, bell, clamp, css, ctxFor, deepen, gaze, isDark, lerp, seg, springOff } from '../core.js';

export const LENS = {
  keys: ['glow', 'size', 'flick', 'ap', 'bloom'],
  pos: [],
  states: {
    working: t => {
      const u = (t % BEAT) / BEAT,
        pulse = Math.exp(-u * 4.5) * (u < 0.06 ? u / 0.06 : 1);
      return { ents: [{ glow: 0.7 + 0.3 * pulse, size: 0.62, flick: 0, ap: 0.4 + 0.16 * pulse, bloom: 0.2 * pulse }] };
    },
    done: t => {
      const open = t < 0.12 ? 0.4 - 0.12 * bell(t / 0.12) : 0.8 + springOff(-0.52, 0, t - 0.12, 9, 0.32),
        out = E.inOut(seg(t, 2.8, 3.2));
      return {
        rip: seg(t, 0.14, 0.8),
        ents: [
          {
            glow: lerp(t < 0.12 ? 0.55 : 0.98, 0.7, out),
            size: 0.66,
            flick: 0,
            ap: lerp(open, 0.4, out),
            bloom: 0.65 * bell(seg(t, 0.12, 0.7)),
          },
        ],
      };
    },
    error: t => {
      const fl = (t0, tt = t - t0) => (tt < 0 ? 0 : tt < 0.06 ? tt / 0.06 : Math.exp(-(tt - 0.06) * 7)),
        f = fl(0.2) + fl(0.5),
        dim = E.inOut(seg(t, 0.85, 2.4)) * (1 - E.inOut(seg(t, 2.9, 3.2)));
      return {
        shake: [0.03 * f * Math.sin(t * 95), 0.018 * f * Math.cos(t * 80)],
        ents: [
          {
            glow: lerp(0.72, 0.2, dim) + 0.6 * f,
            size: 0.62 + 0.25 * f,
            flick: 0,
            ap: lerp(0.5, 0.32, dim) + 0.22 * f,
            bloom: 0.8 * clamp(f),
          },
        ],
      };
    },
    warning: t => {
      const th = bell(seg(t, 0.6, 1.1)) + bell(seg(t, 1.2, 1.7)),
        squeeze = E.back(seg(t, 0.1, 0.45), 2) * (1 - E.inOut(seg(t, 2.6, 3.1)));
      return {
        ents: [{ glow: 0.75 + 0.35 * th, size: 0.6, flick: 0, ap: 0.44 - 0.2 * squeeze + 0.07 * th, bloom: 0.35 * th }],
      };
    },
    idle: t => {
      const b = 0.5 + 0.5 * Math.sin((TAU * t) / (6 * BEAT) - PI / 2);
      return { ents: [{ glow: 0.1 + 0.45 * b, size: 0.55, flick: 0, ap: 0.36 + 0.08 * b, bloom: 0 }] };
    },
  },
  render: (cv, s, color, vel, opts = {}) => {
    const { ctx, small, unit, o, dpr } = ctxFor(cv, 'lens'),
      e = s.ents[0],
      sh = s.shake || [0, 0],
      Rb = 0.86 * unit,
      Rg = 0.74 * unit,
      ink = opts.ink,
      fix = !ink && !isDark && (opts.fix ?? true),
      spill = fix ? deepen(color) : null;
    color =
      ink || (isDark ? color : [Math.min(0.86, color[0] + (fix ? 0.22 : 0.18)), color[1] * (fix ? 1.1 : 1), color[2]]);
    const metal = isDark ? [0.42, 0.006, 277] : [0.86, 0.005, 277];
    ctx.save();
    ctx.translate(sh[0] * unit, sh[1] * unit);
    if (!ink) {
      const bz = ctx.createLinearGradient(0, o - Rb, 0, o + Rb);
      bz.addColorStop(0, css(metal, 1, 0.05));
      bz.addColorStop(1, css(metal, 1, -0.07));
      ctx.fillStyle = bz;
      ctx.beginPath();
      ctx.arc(o, o, Rb, 0, TAU);
      ctx.fill();
      if (isDark) ctx.fillStyle = css([0.13, 0.008, 277]);
      else {
        const sm = ctx.createLinearGradient(0, o - Rg, 0, o + Rg),
          k = fix ? -0.08 : 0;
        sm.addColorStop(0, css([0.3 + k, 0.012, 277]));
        sm.addColorStop(1, css([0.42 + k, 0.01, 277]));
        ctx.fillStyle = sm;
      }
      ctx.beginPath();
      ctx.arc(o, o, Rg, 0, TAU);
      ctx.fill();
    }
    const glow = clamp(e.glow * (1 - (e.flick || 0)), 0, 1.6),
      ap = clamp(e.ap, 0.12, 0.96) * Rg,
      rc = Math.max(1.5 * dpr, e.size * Rg);
    const cx = o + ((gaze ? gaze.x * 0.16 : 0) + (e.ox || 0)) * Rg,
      cy = o + ((gaze ? gaze.y * 0.16 : 0) + (e.oy || 0)) * Rg;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, ap, 0, TAU);
    ctx.clip();
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rc);
    g.addColorStop(0, css(color, Math.min(1, glow), 0.34 * Math.min(1, glow)));
    g.addColorStop(0.6, css(color, Math.min(1, glow * 0.7)));
    g.addColorStop(1, css(color, 0.1 * glow));
    ctx.fillStyle = g;
    ctx.fillRect(cx - rc, cy - rc, rc * 2, rc * 2);
    ctx.restore();
    ctx.strokeStyle = css(color, Math.min(1, 0.3 + 0.5 * glow), 0.12);
    ctx.lineWidth = Math.max(dpr * (small ? 0.9 : 1), 0.028 * unit);
    ctx.beginPath();
    ctx.arc(cx, cy, ap, 0, TAU);
    ctx.stroke();
    if (s.rip > 0 && s.rip < 1) {
      ctx.strokeStyle = spill ? css(spill, 0.9 * (1 - s.rip)) : css(color, 0.85 * (1 - s.rip), 0.15);
      ctx.lineWidth = Math.max(dpr, 0.05 * unit * (1 - s.rip));
      ctx.beginPath();
      ctx.arc(o, o, lerp(ap, Rb * 1.02, E.out(s.rip)), 0, TAU);
      ctx.stroke();
    }
    if (e.bloom > 0.02) {
      const hb = ctx.createRadialGradient(o, o, Rg * 0.6, o, o, Rb * 1.12);
      hb.addColorStop(0, css(color, 0));
      hb.addColorStop(0.55, spill ? css(spill, 0.4 * clamp(e.bloom)) : css(color, 0.35 * clamp(e.bloom), 0.1));
      hb.addColorStop(1, css(color, 0));
      ctx.fillStyle = hb;
      ctx.beginPath();
      ctx.arc(o, o, Rb * 1.12, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  },
};
