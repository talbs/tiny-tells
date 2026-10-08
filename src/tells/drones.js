import { BEAT, E, PI, SHADOW, TAU, bell, clamp, ctxFor, drop, gaze, lerp, seg, sphere } from '../core.js';

export const rotX = ([x, y, z], a) => [x, y * Math.cos(a) - z * Math.sin(a), y * Math.sin(a) + z * Math.cos(a)];
export const rotY = ([x, y, z], a) => [x * Math.cos(a) + z * Math.sin(a), y, -x * Math.sin(a) + z * Math.cos(a)];
export const AERIAL = { pitch: 1.05, yaw: 0, lift: 0.08 },
  FLAT = { pitch: PI / 2 - 0.001, yaw: 0, lift: 0 };
export const camMix = (A, B, t) => ({
  pitch: lerp(A.pitch, B.pitch, t),
  yaw: lerp(A.yaw, B.yaw, t),
  lift: lerp(A.lift, B.lift, t),
});
export const project = (p, cam) => {
  const [x, y, z] = rotX(rotY(p, cam.yaw), cam.pitch),
    f = 3.2 / (3.2 - z);
  return [x * f, -(y - cam.lift) * f, z, f];
};
export const CORNERS = [
  [-0.42, -0.42],
  [0.42, -0.42],
  [0.42, 0.42],
  [-0.42, 0.42],
];
export const CHECK = [
  [-0.62, 0.02],
  [-0.18, 0.46],
  [0.64, -0.42],
];
export const along = (pl, d) => {
  for (let i = 1; i < pl.length; i++) {
    const l = Math.hypot(pl[i][0] - pl[i - 1][0], pl[i][1] - pl[i - 1][1]);
    if (d <= l || i === pl.length - 1) {
      const t = clamp(d / l);
      return [lerp(pl[i - 1][0], pl[i][0], t), lerp(pl[i - 1][1], pl[i][1], t)];
    }
    d -= l;
  }
};
const CHECK_SHORT = Math.hypot(CHECK[1][0] - CHECK[0][0], CHECK[1][1] - CHECK[0][1]),
  CHECK_LONG = Math.hypot(CHECK[2][0] - CHECK[1][0], CHECK[2][1] - CHECK[1][1]);
export const CHECK_SLOTS = [0, CHECK_SHORT, CHECK_SHORT + CHECK_LONG / 2, CHECK_SHORT + CHECK_LONG].map(d =>
  along(CHECK, d).map(v => v * 0.85)
);
export const FORMS = [
  [
    [-0.42, -0.42],
    [0.42, -0.42],
    [0.42, 0.42],
    [-0.42, 0.42],
  ],
  [
    [0, -0.6],
    [0.6, 0],
    [0, 0.6],
    [-0.6, 0],
  ],
  [
    [0, -0.6],
    [0.55, 0.42],
    [0, 0.05],
    [-0.55, 0.42],
  ],
  [
    [-0.6, -0.6],
    [0.2, 0.2],
    [0.6, 0.6],
    [-0.2, -0.2],
  ],
];
export const DRONES = {
  keys: ['x', 'z', 'h', 'a'],
  pos: ['x', 'z'],
  cam: { working: AERIAL, done: FLAT, error: FLAT, warning: AERIAL, idle: AERIAL },
  states: {
    working: t => {
      const u4 = t / BEAT,
        step = Math.floor(u4) % 4,
        u = u4 % 1,
        from = FORMS[step],
        to = FORMS[(step + 1) % 4];
      return {
        ents: [0, 1, 2, 3].map(i => {
          const pr = seg(u, 0.25 + i * 0.06, 0.7 + i * 0.06),
            e = E.back(pr, 1.3);
          return {
            x: lerp(from[i][0], to[i][0], e),
            z: lerp(from[i][1], to[i][1], e),
            h: 0.16 + 0.2 * bell(pr),
            a: 1,
            hit: 0,
          };
        }),
      };
    },
    done: t => ({
      ents: [0, 1, 2, 3].map(j => {
        const start = [
            [-0.15, -0.15],
            [0.15, -0.15],
            [0.15, 0.15],
            [-0.15, 0.15],
          ][j],
          to = CHECK_SLOTS[j],
          t0 = 0.06 + j * 0.11,
          pr = seg(t, t0, t0 + 0.32),
          e = E.out(pr),
          out = seg(t, 2.85, 3.2);
        const dr = drop(0.33, t - t0 - 0.32),
          h = pr < 1 ? 0.35 + 0.1 * bell(pr) ** 2 : lerp(0.02 + dr.h, 0.35, E.inOut(out));
        return {
          x: lerp(lerp(start[0], to[0], e), start[0], E.inOut(out)),
          z: lerp(lerp(start[1], to[1], e), start[1], E.inOut(out)),
          h,
          a: 1,
          hit: pr < 1 ? 0 : dr.hit * (1 - out),
        };
      }),
    }),
    error: t => {
      const shake =
        t > 0.5 && t < 1
          ? [0.05 * Math.sin(t * 80) * (1 - seg(t, 0.5, 1)), 0.04 * Math.cos(t * 97) * (1 - seg(t, 0.5, 1))]
          : [0, 0];
      return {
        shake,
        flash: bell(seg(t, 0.48, 0.8)),
        ents: CORNERS.map(([cx, cz]) => {
          const inn = E.in(seg(t, 0.2, 0.5)),
            back = E.out(seg(t, 0.5, 1.05)),
            r = t < 0.5 ? lerp(1, 0.32, inn) : lerp(0.32, 1.1, back) - 0.1 * E.inOut(seg(t, 1.05, 1.6));
          const dr = drop(0.25, t - 0.95),
            up = seg(t, 2.85, 3.2),
            h = t < 0.95 ? 0.27 : lerp(0.02 + dr.h, 0.27, E.inOut(up));
          return {
            x: cx * r,
            z: cz * r,
            h,
            a: 1 - 0.4 * E.inOut(seg(t, 1.3, 1.6)) * (1 - E.inOut(seg(t, 2.8, 3.1))),
            hit: (t > 0.76 && t < 0.86 ? 1 : 0) + dr.hit * (1 - up),
          };
        }),
      };
    },
    warning: t => {
      const k = E.back(seg(t, 0.1, 0.7), 1.6) * (1 - E.inOut(seg(t, 2.6, 3.05))),
        taps = bell(seg(t, 0.7, 1)) + bell(seg(t, 1.3, 1.6));
      return {
        ents: CORNERS.map(([x, z], i) =>
          i === 2
            ? { x: lerp(x, 0, k), z: lerp(z, 0, k), h: 0.22 + 0.5 * k - 0.3 * taps, a: 1, hit: 0.7 * taps ** 4 }
            : { x: x * (1 + 0.12 * k), z: z * (1 + 0.12 * k), h: 0.22 - 0.1 * k, a: 1, hit: 0 }
        ),
      };
    },
    idle: t => ({
      ents: CORNERS.map(([x, z], i) => ({
        x,
        z,
        h: 0.005 + 0.07 * bell(seg(t, i * 1.05, i * 1.05 + 0.95)),
        a: 0.85,
        hit: 0,
      })),
    }),
  },
  render: (cv, s, color, vel) => {
    const { ctx, small, unit, o } = ctxFor(cv, 'drones'),
      cam = s.cam,
      sh = s.shake || [0, 0],
      r = 0.12,
      sq = Math.max(0.25, Math.sin(cam.pitch));
    const P = p => {
      const [x, y, z, f] = project(p, cam),
        lean = gaze ? 0.04 + 0.2 * p[1] : 0;
      return [o + (x + sh[0] + lean * (gaze?.x || 0)) * unit, o + (y + sh[1] + lean * (gaze?.y || 0)) * unit, z, f];
    };
    s.ents.forEach(d => {
      const [x, y, , f] = P([d.x + 0.32 * d.h, 0, d.z + 0.26 * d.h]),
        rr = Math.max(0.6, r * f * unit * (1.05 - 0.3 * clamp(d.h / 0.5)) * (1 + 0.3 * clamp(d.hit || 0)));
      ctx.fillStyle = SHADOW(
        (small ? 0.5 : 0.38) * (1 - 0.55 * clamp(d.h / 0.7)) * (d.a ?? 1) * (1 + 0.8 * (s.flash || 0)),
        color
      );
      ctx.beginPath();
      ctx.ellipse(x, y, rr, rr * sq, 0, 0, TAU);
      ctx.fill();
    });
    s.ents
      .map((d, i) => ({ d, v: vel[i], z: project([d.x, d.h + r, d.z], cam)[2] }))
      .sort((a, b) => a.z - b.z)
      .forEach(({ d, v }) => {
        const [x, y, , f] = P([d.x, d.h + r, d.z]),
          R = r * f * unit,
          hit = clamp(d.hit || 0),
          vs = clamp(Math.abs(v.h) * 0.06, 0, 0.3);
        const sy = (1 - 0.35 * hit) * (1 + vs),
          sx = 1 / sy;
        sphere(ctx, x, y + R * (1 - sy) * 0.5, R * sx, R * sy, color, d.a ?? 1, small);
      });
  },
};
