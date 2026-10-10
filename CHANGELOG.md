# Changelog

## Unreleased

`reserve.css` no longer outranks your own styles for `<tiny-tell>`. A page rule that restyles the tell, like a different `vertical-align`, now applies before the element loads too, so nothing shifts when it does.

## 0.1.1

On 120Hz and faster displays, tells now draw at 60fps or a little above instead of on every display frame. They look the same and cost half the work, and the play bundle's glance eases at the same speed on every display.

Console warnings now link to the docs at tinytells.dev.

## 0.1.0

First public release, on npm as `tiny-tells`. Six tells (Drones, Flipdot, Eyes, Blot, Dekatron, Lens), five states, and the `<tiny-tell>` element, plus a play bundle that adds pointer notice, a five-tap dance, and the `tell-dance` and `tell-after-dance` events.
