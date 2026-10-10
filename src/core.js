export const TAU = Math.PI * 2,
  PI = Math.PI,
  BEAT = 0.8;
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const seg = (p, a, b) => clamp((p - a) / (b - a));
export const bell = s => Math.sin(PI * clamp(s));
export const mod = (a, n) => ((a % n) + n) % n;
export const E = {
  inOut: t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  out: t => 1 - Math.pow(1 - t, 3),
  in: t => t * t * t,
  back: (t, c = 1.5) => 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2),
};

/* Physics: an analytic damped spring, and one gravity with restitution for every drop. */
export const springOff = (d0, v0, t, w, z) => {
  if (t <= 0) return d0;
  const e = Math.exp(-z * w * t);
  if (z >= 1) return e * (d0 + (v0 + w * d0) * t);
  const wd = w * Math.sqrt(1 - z * z);
  return e * (d0 * Math.cos(wd * t) + ((v0 + z * w * d0) / wd) * Math.sin(wd * t));
};
export const G = 7,
  BOUNCE = 0.38;
export const drop = (h0, t) => {
  if (t <= 0) return { h: h0, hit: 0, v: 0 };
  let tt = t,
    v = Math.sqrt(2 * G * h0),
    tf = v / G;
  if (tt < tf) return { h: h0 - 0.5 * G * tt * tt, hit: 0, v: -G * tt };
  tt -= tf;
  for (let i = 0; i < 6; i++) {
    const speed = v;
    v *= BOUNCE;
    const dur = (2 * v) / G;
    if (tt < dur) return { h: v * tt - 0.5 * G * tt * tt, hit: (speed / 2.3) * Math.exp(-tt * 28), v: v - G * tt };
    tt -= dur;
  }
  return { h: 0, hit: 0, v: 0 };
};
export const PHYS = {
  working: { w: 13, z: 0.55 },
  done: { w: 11, z: 0.35 },
  error: { w: 18, z: 0.3 },
  warning: { w: 12, z: 0.5 },
  idle: { w: 6, z: 1 },
};

/* Quiet UI in OKLCH. Light uses step 600, dark uses step 400. */
export const QUIET = {
  brand: [
    [0.618, 0.12, 280.1],
    [0.791, 0.108, 280.7],
  ],
  emerald: [
    [0.591, 0.121, 153.7],
    [0.77, 0.111, 153.5],
  ],
  red: [
    [0.556, 0.16, 24.3],
    [0.737, 0.145, 24.2],
  ],
  amber: [
    [0.631, 0.127, 70.7],
    [0.805, 0.117, 70.6],
  ],
  sky: [
    [0.592, 0.11, 226.9],
    [0.77, 0.1, 227.3],
  ],
  zinc: [
    [0.542, 0.008, 277.1],
    [0.723, 0.009, 278.6],
  ],
};
export const STATE_COLOR = { working: 'brand', done: 'emerald', error: 'red', warning: 'amber', idle: 'zinc' };
export let isDark = false,
  palette = null,
  gaze = null;

/* The engine draws from one shared scene. Only this sets it, around a single draw. */
export const withScene = (scene, fn) => {
  const was = { isDark, palette, gaze };
  ({ isDark, palette, gaze } = scene);
  try {
    return fn();
  } finally {
    ({ isDark, palette, gaze } = was);
  }
};
export const deepen = c => [Math.max(0.3, c[0] - 0.05), c[1] * 1.18, c[2]];
export const hop = (h0, tt) => {
  if (tt <= 0) return 0;
  const tUp = Math.sqrt((2 * h0) / G);
  return tt < tUp ? h0 - 0.5 * G * (tUp - tt) ** 2 : drop(h0, tt - tUp).h;
};
export const tone = id => palette?.[id] || QUIET[STATE_COLOR[id]][isDark ? 1 : 0];
export const toSrgb = ([L, C, H]) => {
  const A = C * Math.cos((H * PI) / 180),
    B = C * Math.sin((H * PI) / 180);
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3,
    m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3,
    s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  const gamma = c => Math.round(255 * clamp(c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055));
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ].map(gamma);
};
export const css = ([L, C, H], a = 1, dl = 0) => `oklch(${clamp(L + dl)} ${Math.max(0, C)} ${H} / ${clamp(a)})`;
export const toLab = ([L, C, H]) => [L, C * Math.cos((H * PI) / 180), C * Math.sin((H * PI) / 180)];
export const rgbToOklch = ([r, g, b]) => {
  const lin = c => ((c /= 255) <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4),
    [R, G, B] = [r, g, b].map(lin);
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B),
    m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B),
    s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
  return fromLab([
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ]);
};
export const fromLab = ([L, a, b]) => {
  let H = (Math.atan2(b, a) * 180) / PI;
  if (H < 0) H += 360;
  return [L, Math.hypot(a, b), H];
};
export const labMix = (A, B, t) => {
  const a = toLab(A),
    b = toLab(B);
  return fromLab(a.map((v, i) => lerp(v, b[i], t)));
};
export const INK = () => (isDark ? [0.96, 0.005, 277] : [0.25, 0.01, 277]);
export const OFF_A = 0.13;
export const SHADOW = (a, color) =>
  isDark ? css(color, Math.min(1, a * 1.15), -0.33) : css([0.35, 0.02, 277], a * 0.55);
export const STATES = ['working', 'done', 'error', 'warning', 'idle'];
export const LABEL = { working: 'Working', done: 'Done', error: 'Error', warning: 'Warning', idle: 'Idle' };
export const PERIOD = { working: 4 * BEAT, done: 4 * BEAT, error: 4 * BEAT, warning: 4 * BEAT, idle: 6 * BEAT };

export const FIT = {
  flipdot: () => 0.8,
  eyes: px => (px <= 32 ? 0.82 : 0.88),
  lens: () => 0.92,
  blot: px => (px <= 32 ? 1.15 : 1.3),
  drones: px => (px <= 32 ? 0.92 : 1),
};
export const fitFor = (skin, px) => (FIT[skin] || (() => 1))(px);
export const ctxFor = (cv, skin) => {
  const ctx = cv.getContext('2d'),
    W = cv.width,
    px = cv._css || 100,
    k = fitFor(skin, px);
  ctx.clearRect(0, 0, W, W);
  return { ctx, W, px, small: px <= 32, unit: W * (px > 40 ? 0.4 : 0.46) * k, o: W / 2, dpr: W / px };
};
export const sphere = (ctx, x, y, rx, ry, color, a, small, rot = 0) => {
  const R = Math.max(rx, ry);
  if (!small && R > 3) {
    const g = ctx.createRadialGradient(x - R * 0.35, y - R * 0.4, R * 0.1, x, y, R);
    g.addColorStop(0, css(color, a, 0.14));
    g.addColorStop(0.55, css(color, a));
    g.addColorStop(1, css(color, a, -0.1));
    ctx.fillStyle = g;
  } else ctx.fillStyle = css(color, a);
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.6, rx), Math.max(0.6, ry), rot, 0, TAU);
  ctx.fill();
};
