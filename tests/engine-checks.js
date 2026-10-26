import '../src/dance.js';
import { DOZE_CLIPS, LEN } from '../src/doze.js';
import { playerFor, stillAt } from '../src/players.js';
import { TELLS } from '../src/registry.js';
import { PERIOD, PI, STATES, css, linear, withScene } from '../src/core.js';

const INSET = 0.08,
  FLASH_STEP = 0.1,
  FLASH_LIMIT = 3,
  FPS = 60,
  SEAM_MIN = 1,
  SEAM_RATIO = 2.5,
  CURRENT_INK = [0.2, 0.02, 260],
  INK_ALPHA = 25,
  INK_LIFT = 30,
  EDGE_SOLID = 230,
  EDGE_PX = 3,
  SOLID = 200 / 255,
  REACH = 0.05,
  SAME_SHAPE_LIMIT = 0.5,
  CUT_OUT_REACH = 1,
  CUT_OUT_MIN = 12;
// Their error still draws the idle shape in one ink. Each waits on its own fix, and then comes off this list.
const SAME_SHAPE = ['lens'];
// Every pair of their stills must differ in one ink. Tells drawn as filled shapes over-report here, so it's opt-in.
const EVERY_PAIR = ['dekatron'];
const ONE_INK = { isDark: false, palette: null, gaze: null, ink: CURRENT_INK };
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
// Solid is relative to the still's own darkest ink, so a dimmer copy of the same pose still counts as the same shape.
const solidInk = d => {
  let peak = 0;
  for (let i = 3; i < d.length; i += 4) peak = Math.max(peak, d[i]);
  return Uint8Array.from({ length: d.length / 4 }, (_, i) => d[i * 4 + 3] > peak * SOLID);
};
// Ink counts as shared within a small reach, so a camera change that moves the same pose a pixel or two still reads as the same shape.
const spread = (ink, W, reach = Math.max(1, Math.round(W * REACH))) =>
  ink.map((_, i) => {
    const x = i % W,
      y = Math.floor(i / W);
    for (let dy = -reach; dy <= reach; dy++)
      for (let dx = -reach; dx <= reach; dx++)
        if (x + dx >= 0 && x + dx < W && y + dy >= 0 && y + dy < W && ink[(y + dy) * W + x + dx]) return 1;
    return 0;
  });
const shared = (mine, theirs) => mine.filter((on, i) => on && theirs[i]).length;
const floodFrom = (starts, isOpen, W) => {
  const isReached = new Uint8Array(isOpen.length),
    reached = [],
    stack = [...starts];
  while (stack.length) {
    const i = stack.pop();
    if (isReached[i] || !isOpen[i]) continue;
    isReached[i] = 1;
    reached.push(i);
    const x = i % W;
    if (x > 0) stack.push(i - 1);
    if (x < W - 1) stack.push(i + 1);
    if (i >= W) stack.push(i - W);
    if (i < isOpen.length - W) stack.push(i + W);
  }
  return reached;
};
// Cut-outs are blank pixels the border can't reach. One under CUT_OUT_MIN is a stray gap: lens leaves 1 and 7px ones, and the smallest real eye is 17px.
const cutOutsOf = (ink, W) => {
  const border = [];
  for (let i = 0; i < W; i++) border.push(i, (W - 1) * W + i, i * W, i * W + W - 1);
  const unclaimed = ink.map(on => !on),
    cutOuts = new Uint8Array(ink.length);
  for (const i of floodFrom(border, unclaimed, W)) unclaimed[i] = 0;
  for (let i = 0; i < ink.length; i++) {
    if (!unclaimed[i]) continue;
    const hole = floodFrom([i], unclaimed, W);
    for (const j of hole) unclaimed[j] = 0;
    if (hole.length >= CUT_OUT_MIN) for (const j of hole) cutOuts[j] = 1;
  }
  return cutOuts;
};
// Two stills with no cut-outs match on cut-outs, so their ink alone decides.
const overlapOf = (a, b, W, reach) => {
  const count = [a, b].map(m => m.filter(Boolean).length);
  if (!count[0] && !count[1]) return 1;
  return (shared(a, spread(b, W, reach)) + shared(b, spread(a, W, reach))) / (count[0] + count[1]);
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
  swatch.fillStyle = css(CURRENT_INK);
  swatch.fillRect(0, 0, 1, 1);
  const [ir, ig, ib] = swatch.getImageData(0, 0, 1, 1).data,
    inkLum = (ir + ig + ib) / 3;
  for (const id of STATES) {
    let lightest = 0;
    for (let t = 0.05; t < PERIOD[id]; t += 0.1) {
      const d = draw(lens, 'lens', id, t, ONE_INK);
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
  // In forced colors every state draws in one ink, so error has to be a different shape from idle, not just a darker one (#124).
  const shape = document.createElement('canvas');
  shape.width = shape.height = 40;
  shape._css = 20;
  const stillInk = (tell, id) => solidInk(draw(shape, tell, id, stillAt(tell, id), ONE_INK));
  // Same shape means the ink and the cut-outs both match, so a filled body can't hide eyes that changed (#126).
  const compare = (a, b) => {
    const W = shape.width,
      ink = overlapOf(a, b, W),
      cutOuts = overlapOf(cutOutsOf(a, W), cutOutsOf(b, W), W, CUT_OUT_REACH),
      overlap = Math.min(ink, cutOuts);
    return { ink, cutOuts, overlap, isSame: !a.some(Boolean) || !b.some(Boolean) || overlap >= SAME_SHAPE_LIMIT };
  };
  for (const tell of Object.keys(TELLS)) {
    if (EVERY_PAIR.includes(tell)) continue;
    const { ink, cutOuts, overlap, isSame } = compare(stillInk(tell, 'error'), stillInk(tell, 'idle'));
    if (isSame !== SAME_SHAPE.includes(tell))
      failures.push(
        isSame
          ? `shape: ${tell} error and idle match ${overlap.toFixed(2)} in one ink (ink ${ink.toFixed(2)}, cut-outs ${cutOuts.toFixed(2)})`
          : `shape: ${tell} error is now its own shape in one ink, so take it off SAME_SHAPE`
      );
  }
  for (const tell of EVERY_PAIR) {
    const stills = Object.fromEntries(STATES.map(id => [id, stillInk(tell, id)]));
    STATES.forEach((a, i) =>
      STATES.slice(i + 1).forEach(b => {
        const { overlap, isSame } = compare(stills[a], stills[b]);
        if (isSame) failures.push(`shape: ${tell} ${a} and ${b} match ${overlap.toFixed(2)} in one ink`);
      })
    );
  }
  return { failures, flashes: rows };
};
