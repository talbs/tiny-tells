import '../src/dance.js';
import { EPlayer } from '../src/players.js';
import { SKINS } from '../src/registry.js';
import { FC, flipCells, renderFlip } from '../src/tells/flipdot.js';
import { PERIOD, PI, STATES, mod, tone, withScene } from '../src/core.js';

const INSET = 0.08,
  FLASH_STEP = 0.1,
  FLASH_LIMIT = 3,
  SEAM_MIN = 1,
  SEAM_RATIO = 2.5;
const draw = (cv, skin, id, t, scene) =>
  withScene(scene, () => {
    if (skin === 'flipdot') {
      const total = FC[id].total;
      renderFlip(cv, flipCells(id, mod(t, total) + total).cells, tone(id), tone(id));
    } else new EPlayer(skin, id).draw(cv, t);
    return cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
  });
const luminance = (d, bg) => {
  let sum = 0;
  for (let i = 0; i < d.length; i += 4) {
    const a = d[i + 3] / 255,
      lin = c => {
        c /= 255;
        return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      };
    sum += (1 - a) * bg + a * (0.2126 * lin(d[i]) + 0.7152 * lin(d[i + 1]) + 0.0722 * lin(d[i + 2]));
  }
  return sum / (d.length / 4);
};
export const runEngineChecks = () => {
  const failures = [],
    rows = [];
  for (const dark of [false, true]) {
    const still = { isDark: dark, palette: null, gaze: null };
    for (const skin of Object.keys(SKINS))
      for (const id of [...STATES, ...(PERIOD.dance ? ['dance'] : [])]) {
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
            const d = draw(cv, skin, id, t, { ...still, gaze });
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
              `live area: ${skin} ${id} ${px}px ${dark ? 'dark' : 'light'} spans ${top.toFixed(2)}–${bottom.toFixed(2)} × ${left.toFixed(2)}–${right.toFixed(2)}`
            );
        }
        const sc = document.createElement('canvas');
        sc.width = sc.height = 40;
        sc._css = 20;
        const P = skin === 'flipdot' ? FC[id].total : PERIOD[id],
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
        const near = [-2, -1, 0, 1].map(k => draw(sc, skin, id, P + k / 60 + 0.0001, still));
        const seam = step(near[1], near[2]),
          around = Math.max(step(near[0], near[1]), step(near[2], near[3]));
        if (seam > SEAM_MIN && seam > SEAM_RATIO * around)
          failures.push(
            `loop seam: ${skin} ${id} ${dark ? 'dark' : 'light'} jumps ${seam.toFixed(1)} at the restart vs ${around.toFixed(1)} around it`
          );
        const cv = document.createElement('canvas');
        cv.width = cv.height = 96;
        cv._css = 48;
        const bg = dark ? 0.01 : 0.87,
          series = [];
        for (let t = 0; t < PERIOD[id]; t += 1 / 60) series.push(luminance(draw(cv, skin, id, t, still), bg));
        let turns = [],
          dir = 0,
          ext = series[0];
        series.forEach((v, i) => {
          if (dir >= 0 && v > ext) ext = v;
          else if (dir <= 0 && v < ext) ext = v;
          if (Math.abs(v - ext) >= FLASH_STEP * Math.max(v, ext, 0.05)) {
            turns.push(i / 60);
            dir = v > ext ? 1 : -1;
            ext = v;
          }
        });
        let worst = 0;
        turns.forEach(t0 => {
          worst = Math.max(worst, turns.filter(t => t >= t0 && t < t0 + 1).length / 2);
        });
        rows.push(`${skin},${id},${dark ? 'dark' : 'light'},${worst}`);
        if (worst > FLASH_LIMIT)
          failures.push(`flashing: ${skin} ${id} ${dark ? 'dark' : 'light'} has ${worst} flashes in one second`);
      }
  }
  return { failures, flashes: rows };
};
