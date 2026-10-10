# Changelog

## Unreleased

Eyes, Lens, and Blot no longer work out each frame's motion twice. Only Drones and Dekatron use the second pass, so the others draw with less work. A tell that switches away from Blot also lets go of Blot's offscreen canvases.

## 0.1.1

On 120Hz and faster displays, tells now draw at 60fps or a little above instead of on every display frame. They look the same and cost half the work, and the play bundle's glance eases at the same speed on every display.

Console warnings now link to the docs at tinytells.dev.

## 0.1.0

First public release, on npm as `tiny-tells`. Six tells (Drones, Flipdot, Eyes, Blot, Dekatron, Lens), five states, and the `<tiny-tell>` element, plus a play bundle that adds pointer notice, a five-tap dance, and the `tell-dance` and `tell-after-dance` events.
