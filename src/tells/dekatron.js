/* ---- Dekatron: a glow that hops around a ring of ten cathodes, like the old counting tubes. ---- */
import { BEAT, E, PI, TAU, bell, clamp, css, ctxFor, gaze, isDark, lerp, mod, seg, springOff } from '../core.js';

export const DK = 10,
  dkAt = k => -PI / 2 + (TAU * k) / DK;
export const DEKATRON = {
  keys: ['k', 'g'],
  vel: true,
  pos: [],
  wrap: { k: DK },
  states: {
    working: t => {
      const per = (4 * BEAT) / DK,
        n = Math.floor(t / per),
        u = (t % per) / per;
      return { tail: [n, n - 1], tailU: u, ents: [{ k: mod(n + E.back(seg(u, 0, 0.45), 1.6), DK), g: 1 }] };
    },
    done: t => {
      const spin = t < 0.55,
        k = spin ? 10 * E.in(seg(t, 0, 0.55)) : 10,
        flash = bell(seg(t, 0.5, 1)),
        out = seg(t, 2.8, 3.2);
      return {
        tail: spin && t > 0.15 ? [k - 0.7, k - 1.4] : [],
        tailU: 0,
        flash: flash * (1 - out),
        ents: [{ k: mod(k, DK), g: 1 + 0.5 * flash }],
      };
    },
    error: t => {
      const lunge = t0 => {
        const tt = t - t0;
        return tt < 0 ? 0 : tt < 0.08 ? 0.8 * E.out(tt / 0.08) : springOff(0.8, 0, tt - 0.08, 28, 0.3);
      };
      const hit = bell(seg(t, 0.2, 0.3)) + bell(seg(t, 0.5, 0.6)),
        u = (t % BEAT) / BEAT,
        strain = t > 0.9 ? 0.38 * bell(seg(u, 0.1, 0.5)) : 0;
      return {
        shake: [0.025 * hit * Math.sin(t * 90), 0.015 * hit * Math.cos(t * 70)],
        ents: [{ k: mod(lunge(0.2) + lunge(0.5) + strain, DK), g: 0.85 + 0.35 * hit - 0.25 * strain }],
      };
    },
    warning: t => {
      const nudge = bell(seg(t, 0.6, 1.1)) - bell(seg(t, 1.2, 1.7));
      return {
        ents: [
          {
            k: mod(0.9 * nudge, DK),
            g: 0.9 + 0.35 * Math.abs(nudge) + (t > 1.7 ? 0.25 * bell(seg((t % BEAT) / BEAT, 0, 0.6)) : 0),
          },
        ],
      };
    },
    idle: t => {
      const b = 0.5 + 0.5 * Math.sin((TAU * t) / (6 * BEAT) - PI / 2);
      return { ents: [{ k: 0, g: 0.25 + 0.45 * b }] };
    },
  },
  render: (cv, s, color, vel) => {
    const { ctx, small, unit, o, dpr } = ctxFor(cv),
      e = s.ents[0],
      sh = s.shake || [0, 0],
      R = 0.66 * unit,
      dot = (small ? 0.2 : 0.17) * unit,
      g = clamp(e.g, 0, 1.6);
    ctx.save();
    ctx.translate(sh[0] * unit, sh[1] * unit);
    const pos = k => [o + R * Math.cos(dkAt(k)), o + R * Math.sin(dkAt(k))];
    const flash = s.flash || 0;
    if (small) {
      ctx.strokeStyle = css(color, lerp(0.25, 1, flash));
      ctx.lineWidth = Math.max(dpr, 0.07 * unit);
      ctx.beginPath();
      ctx.arc(o, o, R, 0, TAU);
      ctx.stroke();
    } else
      for (let k = 0; k < DK; k++) {
        const [x, y] = pos(k);
        ctx.fillStyle = css(color, lerp(0.2, 1, flash));
        ctx.beginPath();
        ctx.arc(x, y, 0.065 * unit * (1 + 0.5 * flash), 0, TAU);
        ctx.fill();
      }
    if (gaze) {
      const a = Math.min(1, Math.hypot(gaze.x, gaze.y)),
        at = Math.atan2(gaze.y, gaze.x);
      if (a > 0.05) {
        ctx.fillStyle = css(color, 0.55 * a);
        ctx.beginPath();
        ctx.arc(o + R * Math.cos(at), o + R * Math.sin(at), dot * 0.6, 0, TAU);
        ctx.fill();
      }
    }
    (s.tail || []).forEach((k, j) => {
      const a = (j ? 0.2 : 0.42) * (1 - (s.tailU || 0) * 0.6),
        [x, y] = pos(mod(k, DK));
      ctx.fillStyle = css(color, a * Math.min(1, g));
      ctx.beginPath();
      ctx.arc(x, y, dot * (j ? 0.55 : 0.75), 0, TAU);
      ctx.fill();
    });
    const draw = k => {
      const [x, y] = pos(k),
        v = Math.abs(vel[0].k),
        st = 1 + clamp(v * 0.05, 0, 0.5),
        ang = dkAt(k) + PI / 2;
      if (isDark && !small && g > 0.05) {
        const hg = ctx.createRadialGradient(x, y, 0, x, y, dot * 2.6);
        hg.addColorStop(0, css(color, 0.45 * Math.min(1, g)));
        hg.addColorStop(1, css(color, 0));
        ctx.fillStyle = hg;
        ctx.beginPath();
        ctx.arc(x, y, dot * 2.6, 0, TAU);
        ctx.fill();
      }
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(ang);
      ctx.fillStyle = css(color, Math.min(1, g), isDark ? 0.08 * Math.max(0, g - 1) : 0);
      ctx.beginPath();
      ctx.ellipse(0, 0, dot * st, dot / Math.sqrt(st), 0, 0, TAU);
      ctx.fill();
      ctx.restore();
    };
    if (g > 0.02) draw(e.k);
    if (s.twin != null) draw(s.twin);
    ctx.restore();
  },
};
