/* A player per tell. On a handoff it springs from current position and velocity into the next state, with anticipation, staggered starts, and an arc. */
import { BEAT, E, PERIOD, PHYS, bell, ink, labMix, mod, seg, springOff, tone } from './core.js';
import { TELLS } from './registry.js';

/* A wrapped key (dekatron's k) crosses its wrap point as a small step, not a jump back around the ring. The nudge makes an exact half-ring trip always go clockwise, so rounding noise can't pick the way. */
const unwrap = (sk, k, d, w = sk.wrap?.[k]) => (w ? mod(d + w / 2 + 1e-3, w) - w / 2 - 1e-3 : d);
/* A long trip on a wrapped key gets just enough extra damping to overshoot no more than the tell's maxOvershoot. */
const damping = (sk, key, z, d) => {
  const l = sk.wrap?.[key] && Math.log(sk.maxOvershoot / Math.abs(d));
  return l < 0 ? Math.max(z, -l / Math.hypot(Math.PI, l)) : z;
};

export class EPlayer {
  constructor(tell, id = 'working') {
    Object.assign(this, { tell, id, t0: 0, off: null, from: null });
  }
  base(id, tau) {
    return TELLS[this.tell].states[id](mod(tau, PERIOD[id]));
  }
  now(T) {
    const tau = T - this.t0,
      st = this.base(this.id, tau),
      sk = TELLS[this.tell];
    const from = this.from,
      k = from ? E.inOut(seg(tau, 0, BEAT)) : 1,
      color = from ? labMix(from.color, tone(this.id), k) : tone(this.id);
    const view = sk.view?.(from?.view, this.id, k);
    if (!this.off) return { ...st, color, view };
    const P = PHYS[this.id];
    const ents = st.ents.map((e, i) => {
      const o = { ...e },
        stg = i * 0.045,
        tt = tau - stg,
        d = this.off.d[i],
        v = this.off.v[i];
      sk.keys.forEach(key => {
        o[key] =
          tt < 0
            ? this.off.tg0[i][key] + d[key]
            : e[key] + springOff(d[key], v[key], tt, P.w, damping(sk, key, P.z, d[key]));
      });
      if (sk.pos.length === 2) {
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
    return { ...st, ents, color, view };
  }
  set(id, T) {
    if (id === this.id) return;
    const dt = 0.016,
      sk = TELLS[this.tell],
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
    this.from = a;
    this.id = id;
    this.t0 = T;
  }
  draw(cv, T) {
    const sk = TELLS[this.tell],
      s = this.now(T),
      s2 = sk.hasVel && this.now(T + 0.012),
      vel =
        s2 &&
        s.ents.map((e, i) => Object.fromEntries(sk.keys.map(k => [k, unwrap(sk, k, s2.ents[i][k] - e[k]) / 0.012])));
    sk.render(cv, s, ink || s.color, vel);
  }
}
const STILL = { working: 0.9, done: 1.2, error: 1.4, warning: 1, idle: 2 };
export const stillAt = (tell, id) => TELLS[tell].still?.[id] ?? STILL[id];
export const playerFor = (tell, id, t0 = 0) => Object.assign(TELLS[tell].player?.(id) || new EPlayer(tell, id), { t0 });
