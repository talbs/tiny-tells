---
name: tiny-tells
description: "Adds and configures the tiny-tell web component (npm: tiny-tells), small animated status indicators for working, done, error, warning (waiting on a person), and idle. Use when the project depends on tiny-tells or uses tiny-tell elements, when the user mentions Tiny Tells, or when replacing a spinner or status indicator in such a project."
---

# Tiny Tells

> `<tiny-tell>` is one custom element for app status: working, done, error, warning, or idle. Pick from 6 small animated characters. No dependencies. Chrome 111+, Firefox 113+, Safari 16.4+.

This file describes version 0.5.0. Tiny Tells is pre-1.0, so pin the version.

If `node_modules/tiny-tells/package.json` has a different version, trust `node_modules/tiny-tells/dist/custom-elements.json` over this file.

## Install

With a bundler:

```bash
npm i tiny-tells
```

```js
import 'tiny-tells';
```

Without one:

```html
<script type="module" src="https://cdn.jsdelivr.net/npm/tiny-tells@0.5.0/dist/tiny-tells.min.js"></script>
```

The play bundle adds a glance at a nearby pointer and a five-tap dance. Leave an idle tell alone for 30 seconds and it dozes off until the pointer comes back. Use it only if asked. Import `tiny-tells/play` instead of `tiny-tells`, or load `tiny-tells-play.min.js` from the same CDN path. Types ship with the package, and the element class is exported as `TinyTell`.

## Use

```html
<p><tiny-tell tell="dekatron" state="working" label=""></tiny-tell> <span role="status">Syncing 3 files…</span></p>
```

```js
document.querySelector('tiny-tell').state = 'done';
document.querySelector('[role="status"]').textContent = 'Synced 3 files.';
```

Rules:

- Put words next to every tell. Keep them out of the tag: text in there hides once the tell loads.
- If the status can change while someone's on the page, put the words in a `role="status"` region. A state change doesn't announce on its own. Keep the region in the page from the start, and hide what's inside it, not the region. Keep the tell out of the region, or its name gets read with every update. Lists and tables get one region for the summary, not one per row.
- When the words beside it already say the state, set `label=""`. Otherwise give it a more specific `label`, like `label="Uploading photos"`.
- `warning` means stuck until a person acts. Not for soft errors.
- Size follows the text. Set `--tell-size` to pin it.
- If a tell can move for more than five seconds, add a pause button that sets `paused`.
- `paused` is a boolean attribute. Any value pauses, `paused="false"` included. Remove it to resume.
- With the play bundle, put `noplay` on tells in dense lists or tables, so only the ones meant to play do. They still animate their state.
- If you override `--tell-color-*`, keep 3:1 contrast against the surface behind it.
- Reduced motion and forced colors are handled for you.
- Custom tells aren't supported.

## Attributes

- `tell` (default `drones`): Which tell to draw.
  - `drones`: A squad of four drones running drills, keen and prone to pile-ups. Their shadows are the floor.
  - `flipdot`: A 5×5 flip-disc board, like the ones on old bus signs. Every disc clacks over and wobbles before it settles. All business.
  - `eyes`: Two eyes on a dark visor, and the most human of the six. The eyes dart first, the head catches up, and every mood morphs into the next.
  - `blot`: A drop of cartoon liquid that reaches, drips, splats, and pulls itself back together, with real gravity and generous squash and stretch.
  - `dekatron`: A 1950s counting tube. One glow hops around a ring of ten. Precise and steady, right up until it jams.
  - `lens`: One calm, watchful eye behind smoky glass in a metal bezel. The iris does all the talking.
- `state` (default `working`): What the tell is reporting. Changing it hands off into the new state.
  - `working`: Busy and making progress.
  - `done`: Finished, and it worked.
  - `error`: Failed.
  - `warning`: Stuck until a person acts.
  - `idle`: Nothing in progress.
- `color` (default `state`): Where the color comes from.
  - `state`: The state colors.
  - `current`: The surrounding text color, including inside other components' slots.
- `scheme` (default `auto`): Light or dark drawing.
  - `auto`: Reads the color-scheme around the tell.
  - `light`: Always light.
  - `dark`: Always dark.
  - `invert`: The opposite of the color-scheme around the tell.
- `label`: Accessible name. Defaults to the state. Set it to an empty string when nearby text already says the state.
- `paused`: Holds the current frame.
- `noplay`, play bundle only: Turns play off for this tell. It won’t glance at the pointer, dance to five taps, or doze, but it still animates its state. Set it in markup or with toggleAttribute('noplay').

## Methods

- `dance()`, play bundle only: Dances once, same as five quick taps. Works on a noplay tell too. Returns false when it can’t: paused, reduced motion, already dancing, off the page, or tell-dance canceled.

## CSS

- `--tell-size` (default `clamp(20px, 1.43em, 48px)`): Width and height. Tuned for 20 to 48px.
- `--tell-color-working`: Working color. Any CSS color, including light-dark().
- `--tell-color-done`: Done color. Any CSS color, including light-dark().
- `--tell-color-error`: Error color. Any CSS color, including light-dark().
- `--tell-color-warning`: Warning color. Any CSS color, including light-dark().
- `--tell-color-idle`: Idle color. Any CSS color, including light-dark().
- `--tell-color-dance`, play bundle only: Dance color. Any CSS color, including light-dark(). Unlike the state colors, it applies even with color="current".
- `::part(tell)`: The canvas.

## Statics

- `TinyTell.version`: The version that’s loaded.
- `TinyTell.timeScale`: Experimental. Multiplies every tell’s clock: 1 is normal, 0.5 is half speed, 2 is double. 0, a negative, or anything that isn’t a finite number stops them.

## Events

- `tell-dance` (cancelable), play bundle only: Fires before a tell dances. Call preventDefault() to keep it still.
- `tell-after-dance`, play bundle only: Fires when a dance ends, or when a state change, a switch to another tell, or removing it cuts it short. A removed tell is off the page, so only listeners on the tell itself hear that one.

## Docs

- [Get Started](https://tinytells.dev/docs/#get-started)
- [Build with AI](https://tinytells.dev/docs/#build-with-ai)
- [Play Bundle](https://tinytells.dev/docs/#play)
- [States](https://tinytells.dev/docs/#states)
- [Accessibility](https://tinytells.dev/docs/#accessibility)
- [Pausing](https://tinytells.dev/docs/#pausing)
- [Size](https://tinytells.dev/docs/#size)
- [Color](https://tinytells.dev/docs/#color)
- [Frameworks and Editors](https://tinytells.dev/docs/#frameworks-and-editors)
- [React](https://tinytells.dev/docs/#react)
- [Agent Status](https://tinytells.dev/docs/#agent-status)
- [Testing Your App](https://tinytells.dev/docs/#testing)
- [Before It Loads](https://tinytells.dev/docs/#before-it-loads)
- [API](https://tinytells.dev/docs/#api)
