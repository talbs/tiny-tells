# Changelog

## Unreleased

Tells hand their colors to the canvas as `oklch()` instead of converting them to RGB first, which trims about 240 bytes. In Chromium, Lens's error highlight renders a touch brighter.

## 0.1.1

On 120Hz and faster displays, tells now draw at 60fps or a little above instead of on every display frame. They look the same and cost half the work, and the play bundle's glance eases at the same speed on every display.

Console warnings now link to the docs at tinytells.dev.

## 0.1.0

First public release, on npm as `tiny-tells`. Six tells (Drones, Flipdot, Eyes, Blot, Dekatron, Lens), five states, and the `<tiny-tell>` element, plus a play bundle that adds pointer notice, a five-tap dance, and the `tell-dance` and `tell-after-dance` events.
