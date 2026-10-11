# Changelog

Each release groups its changes under Added, Changed, Deprecated, Removed, Fixed, and Security. A breaking change is marked **Breaking** and listed first.

## 0.1.2 · 2026-10-11

### Changed

- Eyes, Lens, and Blot draw each frame with less work. They no longer work out its motion twice, a pass only Drones and Dekatron need. A tell that switches away from Blot also frees Blot's offscreen canvases.
- A 164px Blot now churns about 1 MB of memory every 10 seconds, down from about 28 MB. It reuses its offscreen canvases and pixel buffer instead of rebuilding them each frame.
- The core bundle is 190 bytes smaller than 0.1.1, mostly because tells hand their colors to the canvas as `oklch()` instead of converting to RGB. In Chromium, Lens's error highlight renders a touch brighter.

### Fixed

- `reserve.css` no longer outranks your own styles for `<tiny-tell>`. A page rule that restyles the tell, like a different `vertical-align`, now applies before the element loads too, so nothing shifts when it does.
- Setting `TinyTell.timeScale` to `Infinity`, or anything that isn't a finite number, stops the tells the way `0` does. It used to crash them until the page reloaded.
- Removing a tell in the middle of a dance now fires `tell-after-dance`. The tell is already off the page by then, so only listeners on the tell itself hear it.
- Dekatron's glow no longer over-stretches for a frame each time it passes the top of its ring. Its handoff from error to done no longer jolts.

## 0.1.1 · 2026-10-08

### Changed

- On 120Hz and faster displays, tells now draw at 60fps or a little above instead of on every display frame. They look the same and cost half the work, and the play bundle's glance eases at the same speed on every display.
- Console warnings now link to the docs at tinytells.dev.

## 0.1.0 · 2026-10-08

### Added

- First public release, on npm as `tiny-tells`. Six tells (Drones, Flipdot, Eyes, Blot, Dekatron, Lens), five states, and the `<tiny-tell>` element, plus a play bundle that adds pointer notice, a five-tap dance, and the `tell-dance` and `tell-after-dance` events.
