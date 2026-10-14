/* A player per skin. On a handoff it springs from current position and velocity into the next state, with anticipation, staggered starts, and an arc. */
import { BEAT, E, PERIOD, PHYS, bell, ink, labMix, mod, seg, springOff, tone } from './core.js';
import { SKINS } from './registry.js';

/* A wrapped key (dekatron's k) crosses its wrap point as a small step, not a jump back around the ring. */
const unwrap = (sk, k, d) => (sk.wrap?.[k] ? mod(d + sk.wrap[k] / 2, sk.wrap[k]) - sk.wrap[k] / 2 : d);

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
    const cam = sk.cam?.(this.cam0, this.id, k);
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
      sk.handoff?.(o, tt);
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
      d: a.ents.map((e, i) => Object.fromEntries(sk.keys.map(k => [k, unwrap(sk, k, e[k] - tg0[i][k])]))),
      v: a.ents.map((e, i) =>
        Object.fromEntries(
          sk.keys.map(k => [k, (unwrap(sk, k, e[k] - b.ents[i][k]) - unwrap(sk, k, tg1[i][k] - tg0[i][k])) / dt])
        )
      ),
    };
    this.col0 = a.color;
    this.cam0 = a.cam;
    this.id = id;
    this.t0 = T;
  }
  draw(cv, T) {
    const sk = SKINS[this.skin],
      s = this.now(T),
      s2 = sk.hasVel && this.now(T + 0.012),
      vel =
        s2 &&
        s.ents.map((e, i) => Object.fromEntries(sk.keys.map(k => [k, unwrap(sk, k, s2.ents[i][k] - e[k]) / 0.012])));
    sk.render(cv, s, ink || s.color, vel);
  }
}
export const playerFor = (skin, id) => SKINS[skin].player?.(id) || new EPlayer(skin, id);
