# Changelog

Each release groups its changes under Added, Changed, Deprecated, Removed, Fixed, and Security. A breaking change is marked **Breaking** and listed first.

## 0.5.0 · 2026-10-16

### Changed

- **Breaking:** The attribute that picks a character is `tell`, not `skin`: `<tiny-tell tell="eyes">`. The `.skin` property is `.tell`, the console warning says "unknown tell", and the TypeScript type `TellSkin` is `TellName`. There’s no alias, so a leftover `skin="…"` draws Drones with no warning. Everything else already called it a tell.

## 0.4.0 · 2026-10-15

### Added

- `--tell-color-dance`, in the play bundle. Sets the color the dance draws in, with any CSS color, `light-dark()` included. Unlike the state colors, it also applies with `color="current"`. Leave it unset and the dance stays sky blue.

## 0.3.0 · 2026-10-14

### Added

- `el.dance()`, in the play bundle. One dance, same as five quick taps. Returns `false` when the tell can't dance right now: paused, reduced motion, already dancing, off the page, or `tell-dance` canceled.
- `noplay`, in the play bundle. The tell stops following the pointer, dancing to taps, and dozing. It still animates its state. There's no property, because one would break if play loaded late. Set it in markup or with `toggleAttribute('noplay')`.

### Changed

- States show more of what each tell is made of. Flipdot's error X lands from the center out. Drones' error stops short of a pile-up and stays at full brightness. Lens's pan and Drones' bob are small enough that you'll only see them at 48px.

### Fixed

- `color="current"` broke Eyes and Lens. Eyes lost its visor and looked like a typing indicator. Lens shrank to a faint dot that looked like a status bullet. Both now fill with the text color and cut the eyes or iris out, and Lens keeps its halo. Eyes is heavier at 16 to 20px: a solid pill, not two dots.
- Blot was blurry. It drew at half resolution and stretched to fit. Now it draws at full resolution, 2 to 4 times sharper from 20px to 128px. Above 128px on 2× screens it still stretches.

## 0.2.0 · 2026-10-14

### Changed

- **Breaking:** `<tiny-tell>` itself is now the image, named through `ElementInternals`, so an `aria-label` or `aria-labelledby` on the tag finally works. Playwright's `getByRole` and axe can't see that role yet, so tests that find tells by role stop finding them. Look them up by tag or `id` instead. Chrome before 103 and Firefox before 119 still label the canvas.
- The play bundle now costs under 2.5 KB more than the core, up from under 1 KB. Doze is most of that.
- Tells skip redraws that changed nothing: a script writing to `<html>` every frame, or a stopped clock.
- The README and docs now give the real browser floor: Chrome 111 and Firefox 113.

### Added

- Doze, in the play bundle. An idle tell the mouse leaves alone for 30 seconds nods off, and wakes when the pointer comes back. It fires no events, the state stays `idle`, and touch screens never doze. Reduced motion and `paused` turn it off.

### Fixed

- Loading the CDN core and then CDN play no longer throws on every fifth tap. Subclasses under their own tag now dance too, and warnings name the real tag.
- Dekatron's dance no longer flashes 5 times a second in dark mode. Its meet flash is one pulse now.
- Setter types now allow `null`, as the setters always did. `custom-elements.json` now lists the two play event classes.

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
