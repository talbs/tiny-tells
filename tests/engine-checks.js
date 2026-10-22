import '../src/dance.js';
import { DOZE_CLIPS, LEN } from '../src/doze.js';
import { playerFor } from '../src/players.js';
import { TELLS } from '../src/registry.js';
import { PERIOD, PI, STATES, css, linear, withScene } from '../src/core.js';

const INSET = 0.08,
  FLASH_STEP = 0.1,
  FLASH_LIMIT = 3,
  FPS = 60,
  SEAM_MIN = 1,
  SEAM_RATIO = 2.5,
  LENS_INK = [0.2, 0.02, 260],
  INK_ALPHA = 25,
  INK_LIFT = 30,
  EDGE_SOLID = 230,
  EDGE_PX = 3;
const draw = (cv, tell, id, t, scene) =>
  withScene(scene, () => {
    playerFor(tell, id).draw(cv, t);
    return cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
  });
const LIN = Float64Array.from({ length: 256 }, (_, c) => linear(c));
const luminance = (d, bg) => {
  let sum = 0;
  for (let i = 0; i < d.length; i += 4) {
    const a = d[i + 3] / 255;
    sum += (1 - a) * bg + a * (0.2126 * LIN[d[i]] + 0.7152 * LIN[d[i + 1]] + 0.0722 * LIN[d[i + 2]]);
  }
  return sum / (d.length / 4);
};
const flashesPerSecond = series => {
  const turns = [];
  let dir = 0,
    ext = series[0];
  series.forEach((v, i) => {
    if (dir && (dir > 0 ? v > ext : v < ext)) ext = v;
    else if (Math.abs(v - ext) >= FLASH_STEP * Math.max(v, ext, 0.05)) {
      turns.push(i / FPS);
      dir = v > ext ? 1 : -1;
      ext = v;
    }
  });
  return Math.max(0, ...turns.map(t0 => turns.filter(t => t >= t0 && t < t0 + 1).length / 2));
};
const frames = (seconds, f) => Array.from({ length: Math.round(seconds * FPS) }, (_, i) => f(i / FPS));
export const runEngineChecks = () => {
  const failures = [],
    rows = [];
  const flicker = flashesPerSecond(frames(2, t => (Math.floor(t * 12) % 2 ? 0.8 : 0.1))),
    fade = flashesPerSecond(frames(4, t => 0.45 + 0.35 * Math.sin(t * PI)));
  if (flicker <= FLASH_LIMIT) failures.push(`flash detector: a 6 Hz flicker counts as ${flicker} flashes a second`);
  if (fade > 1) failures.push(`flash detector: a 0.5 Hz fade counts as ${fade} flashes a second`);
  for (const dark of [false, true]) {
    const still = { isDark: dark, palette: null, gaze: null };
    for (const tell of Object.keys(TELLS))
      for (const id of [...STATES, 'dance', ...DOZE_CLIPS]) {
        for (const px of [20, 48]) {
          const cv = document.createElement('canvas'),
            W = (cv.width = cv.height = px * 2);
          cv._css = px;
          let top = 1,
            bottom = 0,
            left = 1,
            right = 0;
          for (let t = 0.05, n = 0; t < PERIOD[id]; t += 0.1, n++) {
            const gaze = n % 2 ? { x: Math.cos((n * PI) / 4), y: Math.sin((n * PI) / 4) } : null;
            const d = draw(cv, tell, id, t, { ...still, gaze });
            for (let y = 0; y < W; y++)
              for (let x = 0; x < W; x++)
                if (d[(y * W + x) * 4 + 3] > 13) {
                  top = Math.min(top, y / W);
                  bottom = Math.max(bottom, (y + 1) / W);
                  left = Math.min(left, x / W);
                  right = Math.max(right, (x + 1) / W);
                }
          }
          const slack = 1 / W;
          if (top < INSET - slack || left < INSET - slack || bottom > 1 - INSET + slack || right > 1 - INSET + slack)
            failures.push(
              `live area: ${tell} ${id} ${px}px ${dark ? 'dark' : 'light'} spans ${top.toFixed(2)}–${bottom.toFixed(2)} × ${left.toFixed(2)}–${right.toFixed(2)}`
            );
        }
        if (!(id in LEN)) {
          const sc = document.createElement('canvas');
          sc.width = sc.height = 40;
          sc._css = 20;
          const P = PERIOD[id],
            step = (a, b) => {
              let d = 0;
              for (let i = 0; i < a.length; i += 4)
                d +=
                  (Math.abs(a[i + 3] - b[i + 3]) +
                    (((Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2])) / 3) *
                      Math.min(a[i + 3], b[i + 3])) /
                      255) /
                  255 /
                  4;
              return d;
            };
          const near = [-2, -1, 0, 1].map(k => draw(sc, tell, id, P + k / 60 + 0.0001, still));
          const seam = step(near[1], near[2]),
            around = Math.max(step(near[0], near[1]), step(near[2], near[3]));
          if (seam > SEAM_MIN && seam > SEAM_RATIO * around)
            failures.push(
              `loop seam: ${tell} ${id} ${dark ? 'dark' : 'light'} jumps ${seam.toFixed(1)} at the restart vs ${around.toFixed(1)} around it`
            );
        }
        const cv = document.createElement('canvas');
        cv.width = cv.height = 96;
        cv._css = 48;
        const bg = dark ? 0.01 : 0.87,
          worst = flashesPerSecond(frames(PERIOD[id], t => luminance(draw(cv, tell, id, t, still), bg)));
        rows.push(`${tell},${id},${dark ? 'dark' : 'light'},${worst}`);
        if (worst > FLASH_LIMIT)
          failures.push(`flashing: ${tell} ${id} ${dark ? 'dark' : 'light'} has ${worst} flashes in one second`);
      }
  }
  // Other tells tint color="current" on purpose. Lens draws only the ink, so anything lighter reads as a second tone.
  const lens = document.createElement('canvas');
  lens.width = lens.height = 96;
  lens._css = 48;
  const swatch = document.createElement('canvas').getContext('2d');
  swatch.fillStyle = css(LENS_INK);
  swatch.fillRect(0, 0, 1, 1);
  const [ir, ig, ib] = swatch.getImageData(0, 0, 1, 1).data,
    inkLum = (ir + ig + ib) / 3;
  for (const id of STATES) {
    let lightest = 0;
    for (let t = 0.05; t < PERIOD[id]; t += 0.1) {
      const d = draw(lens, 'lens', id, t, { isDark: false, palette: null, gaze: null, ink: LENS_INK });
      for (let i = 0; i < d.length; i += 4) {
        const lum = (d[i] + d[i + 1] + d[i + 2]) / 3;
        if (d[i + 3] > INK_ALPHA) lightest = Math.max(lightest, lum);
      }
    }
    if (lightest - inkLum > INK_LIFT)
      failures.push(
        `ink: lens ${id} light draws ${Math.round(lightest - inkLum)} lighter than its color="current" ink`
      );
  }
  const big = document.createElement('canvas'),
    B = (big.width = big.height = 164);
  big._css = B;
  const d = draw(big, 'blot', 'done', 0.05, { isDark: false, palette: null, gaze: null });
  let narrowest = Infinity;
  for (let y = Math.round(B * 0.3); y < B * 0.6; y++) {
    const firstOver = limit => {
        for (let x = 0; x < B >> 1; x++) if (d[(y * B + x) * 4 + 3] > limit) return x;
      },
      start = firstOver(INK_ALPHA),
      end = firstOver(EDGE_SOLID);
    if (start !== undefined && end !== undefined) narrowest = Math.min(narrowest, end - start);
  }
  if (!(narrowest <= EDGE_PX))
    failures.push(`edge: blot done at ${B}px goes from 10% to 90% over ${narrowest} pixels, not ${EDGE_PX} or fewer`);
  return { failures, flashes: rows };
};
