# Changelog

Each release groups its changes under Added, Changed, Deprecated, Removed, Fixed, and Security. A breaking change is marked **Breaking** and listed first.

## Unreleased

### Changed

- Eyes, Lens, and Blot draw each frame with less work. They no longer work out its motion twice, a pass only Drones and Dekatron need. A tell that switches away from Blot also frees Blot's offscreen canvases.
- Tells hand their colors to the canvas as `oklch()` instead of converting them to RGB first, which trims about 240 bytes. In Chromium, Lens's error highlight renders a touch brighter.

### Fixed

- `reserve.css` no longer outranks your own styles for `<tiny-tell>`. A page rule that restyles the tell, like a different `vertical-align`, now applies before the element loads too, so nothing shifts when it does.

## 0.1.1 · 2026-10-08

### Changed

- On 120Hz and faster displays, tells now draw at 60fps or a little above instead of on every display frame. They look the same and cost half the work, and the play bundle's glance eases at the same speed on every display.
- Console warnings now link to the docs at tinytells.dev.

## 0.1.0 · 2026-10-08

### Added

- First public release, on npm as `tiny-tells`. Six tells (Drones, Flipdot, Eyes, Blot, Dekatron, Lens), five states, and the `<tiny-tell>` element, plus a play bundle that adds pointer notice, a five-tap dance, and the `tell-dance` and `tell-after-dance` events.
