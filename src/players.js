/* A player per skin. On a handoff it springs from current position and velocity into the next state, with anticipation, staggered starts, and an arc. */
import { BEAT, E, PERIOD, PHYS, bell, labMix, mod, seg, springOff, tone } from './core.js';
import { camMix } from './tells/drones.js';
import { flipCells, frameAt, renderFlip } from './tells/flipdot.js';
import { SKINS } from './registry.js';

export class EPlayer {
  constructor(skin, id = 'working', mode = 'x') {
    Object.assign(this, { skin, id, mode, t0: 0, off: null, col0: null, cam0: null });
  }
  base(id, tau) {
    return SKINS[this.skin].states[id](mod(tau, PERIOD[id]));
  }
  now(T) {
    const tau = T - this.t0,
      st = this.base(this.id, tau),
      sk = SKINS[this.skin];
    const k = this.col0 ? E.inOut(seg(tau, 0, BEAT)) : 1,
      color = this.col0 ? labMix(this.col0, tone(this.id), k) : tone(this.id);
    const cam = sk.cam ? camMix(this.cam0 || sk.cam[this.id], sk.cam[this.id], this.cam0 ? k : 1) : null;
    if (!this.off) return { ...st, color, cam };
    const P = PHYS[this.id],
      full = this.mode === 'x';
    const ents = st.ents.map((e, i) => {
      const o = { ...e },
        stg = full ? i * 0.045 : 0,
        tt = tau - stg,
        d = this.off.d[i],
        v = this.off.v[i];
      sk.keys.forEach(key => {
        o[key] = tt < 0 ? this.off.tg0[i][key] + d[key] : e[key] + springOff(d[key], v[key], tt, P.w, P.z);
      });
      if (full && sk.pos.length === 2) {
        const [ka, kb] = sk.pos,
          dist = Math.hypot(d[ka], d[kb]);
        if (dist > 0.02) {
          const ux = d[ka] / dist,
            uy = d[kb] / dist,
            ant = 0.06 * Math.min(1, dist) * bell(seg(tt, 0, 0.14)),
            arc = 0.22 * Math.min(0.6, dist) * bell(seg(tt, 0.04, 0.6));
          o[ka] += ux * ant - uy * arc;
          o[kb] += uy * ant + ux * arc;
        }
      }
      if (sk.cam) o.h += 0.14 * bell(seg(tt, 0, 0.7));
      return o;
    });
    return { ...st, ents, color, cam };
  }
  set(id, T) {
    if (id === this.id) return;
    const dt = 0.016,
      sk = SKINS[this.skin],
      a = this.now(T),
      b = this.now(T - dt),
      tg0 = this.base(id, 0).ents,
      tg1 = this.base(id, dt).ents;
    this.off = {
      tg0,
      d: a.ents.map((e, i) => Object.fromEntries(sk.keys.map(k => [k, e[k] - tg0[i][k]]))),
      v: a.ents.map((e, i) =>
        Object.fromEntries(sk.keys.map(k => [k, (e[k] - b.ents[i][k]) / dt - (tg1[i][k] - tg0[i][k]) / dt]))
      ),
    };
    Object.entries(sk.wrap || {}).forEach(([k, w]) =>
      this.off.d.forEach(d => {
        d[k] = mod(d[k] + w / 2, w) - w / 2;
      })
    );
    this.col0 = a.color;
    this.cam0 = a.cam;
    this.id = id;
    this.t0 = T;
  }
  draw(cv, T, opts) {
    const s = this.now(T),
      s2 = SKINS[this.skin].vel && this.now(T + 0.012),
      vel =
        s2 &&
        s.ents.map((e, i) => Object.fromEntries(SKINS[this.skin].keys.map(k => [k, (s2.ents[i][k] - e[k]) / 0.012])));
    SKINS[this.skin].render(cv, s, cv._ink || s.color, vel, cv._ink ? { ...opts, ink: cv._ink } : opts);
  }
}
export class FPlayer {
  constructor(id = 'working') {
    Object.assign(this, { id, t0: 0, snap: null, col0: null });
  }
  set(id, T) {
    if (id === this.id) return;
    this.snap = frameAt(this.id, T - this.t0, this.snap).to;
    this.col0 = tone(this.id);
    this.id = id;
    this.t0 = T;
  }
  draw(cv, T) {
    const col = tone(this.id),
      recolor = !!this.col0 && this.col0.join() !== col.join();
    renderFlip(
      cv,
      flipCells(this.id, T - this.t0, this.snap, recolor).cells,
      cv._ink || this.col0 || col,
      cv._ink || col
    );
  }
}
