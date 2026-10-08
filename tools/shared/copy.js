export const V1 = ['drones', 'flipdot', 'eyes', 'blot', 'dekatron', 'lens'];
export const NAMES = {
  drones: 'Drones',
  flipdot: 'Flipdot',
  eyes: 'Eyes',
  blot: 'Blot',
  dekatron: 'Dekatron',
  lens: 'Lens',
};
export const MODEL = {
  drones: {
    made: 'Four shaded balls over a floor in perspective. Their shadows shrink as they climb, and dark mode tints them with the state color.',
    notice: 'The squad leans toward your pointer. Drones in the air lean further than their shadows.',
    handoff:
      'Every change adds a small hop, with a wind-up and a curved flight path. The camera tilt blends over one beat.',
    fits: 'Dashboards, deploys, and sync, or anywhere a little showing off helps.',
    dance: 'Diagonal pairs take turns hopping while the whole squad sways.',
  },
  flipdot: {
    made: 'Twenty-five flat discs, with no gradients at any size. Off is a faint gray, dim is half color, and lit is full color.',
    notice: 'It doesn’t lean. One edge disc on your pointer’s side glows half lit.',
    handoff: 'No springs. Every disc that differs flips over in a diagonal ripple. Lit discs flip to show a new color.',
    fits: 'Terminals, build logs, and dense tables, or anywhere pixels belong.',
    dance: 'An equalizer, with five bars bouncing on the half beat.',
  },
  eyes: {
    made: 'A rounded visor of dark glass with two glowing eyes clipped to it. The glow drops out at 32px and under.',
    notice: 'The eyes look at your pointer, and the visor turns a moment after them.',
    handoff:
      'Twelve shape springs morph one mood into the next, and the visor springs too: it squashes and stretches into each new state.',
    fits: 'Chat and assistant UIs, where a face is welcome.',
    dance:
      'A head-bob groove. The visor dips on every beat and tilts across the bar; the eyes ride each dip and hop on alternate offbeats.',
  },
  blot: {
    made: 'Soft blobs that melt together when they touch, lit from the top with a sheen. Small sizes drop the sheen and keep the shadow.',
    notice: 'The whole drop slides a little toward your pointer.',
    handoff: 'Blobs swing on curved paths with a wind-up, so you see them merge and split mid-change.',
    fits: 'Friendly consumer UI and uploads. Anything that can afford to be a bit silly.',
    dance: 'One blob bounces on every beat and squashes on every landing.',
  },
  dekatron: {
    made: 'A ring of ten faint cathodes and one glow that stretches as it moves. Dark mode adds a soft halo. At 32px and under, the cathodes become one ring.',
    notice: 'A faint ghost glow sits on the ring at your pointer’s angle.',
    handoff: 'The glow springs the short way around the ring.',
    fits: 'Terminals, CLIs, queues, and counters: anything that counts.',
    dance: 'Two glows sweep opposite ways around the ring, then cross and flash at the top and bottom.',
  },
  lens: {
    made: 'A metal bezel around smoky glass, with a glowing iris. The glass stays dark in both schemes, and a soft bloom spills past the bezel.',
    notice: 'The iris turns toward your pointer while the bezel stays put.',
    handoff: 'The iris and its glow spring to the new state’s size and brightness.',
    fits: 'System monitors, background agents, and anything else that watches.',
    dance: 'The iris swings like a pendulum and pulses on the beat, with a ripple every other beat.',
  },
};
export const GOES = {
  drones: ['Dashboards', 'Deploys', 'Sync'],
  flipdot: ['Terminals', 'Build Logs', 'Dense Tables'],
  eyes: ['Chat', 'Assistant UIs'],
  blot: ['Consumer Apps', 'Uploads'],
  dekatron: ['Terminals and CLIs', 'Queues', 'Counters'],
  lens: ['System Monitors', 'Background Agents'],
};
export const NOTES = {
  drones: {
    working: 'Flies a new formation every beat: square, diamond, triangle, diagonal. Each landing overshoots a little.',
    done: 'The camera swings overhead. One by one they fly onto a check and drop into place.',
    error: 'They rush the middle and collide. Thrown clear, they fall, bounce, and go dim.',
    warning: 'One drone jumps to the middle while the others back off. It taps down twice.',
    idle: 'They sit parked, and each one lifts a little in turn.',
  },
  flipdot: {
    working: 'A five-disc snake with a bright head and a dim tail laps the edge.',
    done: 'A faint check, then it lights disc by disc and holds.',
    error: 'An X. Every lit disc spins over twice, rippling out from the center.',
    warning: 'An exclamation mark builds from the top down, and its dot blinks twice before it holds.',
    idle: 'Like a pilot light, the center disc lights once a loop.',
  },
  blot: {
    working: 'Three lobes circle the core, and one reaches out on every beat.',
    done: 'Three drops rush together. The bead hops, lands with a squash, and wobbles.',
    error: 'A drop falls and splats flat, droplets fly, and then everything gathers back up.',
    warning: 'Two drips form and fall. Then it sags on every beat like a third is coming.',
    idle: 'Two drops drift apart and back, bobbing out of step.',
  },
  lens: {
    working: 'The iris snaps open on every beat and eases back.',
    done: 'The iris pinches, springs wide, and wobbles while a ripple rolls out past the bezel.',
    error: 'Flares twice, then dims to an ember. It comes back just before the loop does.',
    warning: 'The iris squeezes to half and throbs twice.',
    idle: 'It sits nearly dark, taking one slow breath per loop.',
  },
  dekatron: {
    working: 'Counts around the ring with a fading trail. One lap per loop.',
    done: 'Races a full lap, lands on zero, and every cathode flashes.',
    error: 'It jams, lunges at the next count twice, and gets knocked back. Then it keeps creeping, dimmer each beat.',
    warning: 'Rocks one count each way and comes home. Then it pulses on the beat.',
    idle: 'Parked on zero, breathing slowly.',
  },
  eyes: {
    working:
      'While it thinks, it glances up and over with one eye squinting, blinks, and comes back, and the head follows.',
    done: 'It pops into proud crescents and hops, then rocks a little side to side.',
    error: 'Squeezes shut twice with a shake, then droops and sinks.',
    warning: 'A double take. Then “hm?” twice: one eye wide, one squinting.',
    idle: 'Its lids get heavy and it nods off, then it snaps awake, blinks, and settles.',
  },
};
