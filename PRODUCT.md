# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Primary:** front-end developers adding status to AI agent and system UIs (chat runs, CI steps, uploads, step lists). They want to see the tells move, trust they're small and accessible, and copy an install line.
- **Secondary, at about half the weight:** designers and design-system folks deciding whether Tiny Tells fits a product or a system. They judge the craft and the theming as much as the install.

## Product Purpose

Tiny Tells is one custom element, `<tiny-tell>`, that shows what an app is up to: working, done, error, warning, or idle. Six small canvas characters (drones, flipdot, eyes, blot, dekatron, lens) play each state and hand off between states. Success: a developer installs it and ships a status mark people can read at 20px, and a designer trusts it in their system.

## Positioning

**Characters, not spinners.** Each tell is animated like a character off a model sheet: one shared 0.8s beat, anticipation, squash and stretch, and handoffs that spring from wherever the tell was instead of swapping icons. Small (under 14 KB min+gzip, no dependencies) and accessible are table stakes, not the headline.

## Operating Context

- Ships on npm as `tiny-tells`, plus a play bundle (`tiny-tells/play`) with pointer "notice" and a five-tap dance.
- Used inline in text, in buttons, sidebars, CI check lists, editor status bars, uploads, callouts, and step lists.
- Themed through `--tell-size`, `--tell-color-{state}` tokens, `color`, and `scheme`. It works with any design system's palette.
- Public site on GitHub Pages: the landing page at the root, the docs at `/docs/`, and a 404. The proofing bench lives in the private `tiny-tells-lab` repo.

## Capabilities and Constraints

- Attributes: `skin`, `state`, `color`, `scheme`, `label`, `paused`. Also `::part(tell)` and `:state()`. The play bundle fires `tell-dance` (cancelable) and `tell-after-dance`; the core fires no events.
- Accessibility: an image role named by its state (or `label`), `label=""` for decorative tells, reduced motion holds a still pose, forced colors draws in system colors, no flashing over 3 a second, the default palette meets 3:1. A state change does not announce; pair it with a `role="status"` region.
- Support floor: Chrome 99+, Firefox 112+, Safari 16.4+.
- Alpha (0.1.x). Names and defaults may change before 1.0. Custom tells aren't supported.
- The tells themselves have no dependencies and no Web Awesome references. Web Awesome is for site and demo chrome only.
- Console warnings link to docs anchors (`#states`, `#tells`, `#play`). Those URLs freeze into each published version.

## Brand Commitments

- Name: Tiny Tells. Element: `<tiny-tell>`.
- Voice: friendly, like an animation studio's lab team sharing its internal model sheets and lab notes with the public. It's inspired by that kind of studio culture, never a copy of it. No real studio names, characters, logos, or anything implying an endorsement.
- Site chrome is built on Web Awesome (components, utilities, theming layers), self-hosted from the npm package's `dist-cdn` build, which `npm run build` copies into `site/` (nothing is committed). Icons are Font Awesome via kit `3572f3662e`: Sharp Regular, plus Duotone Regular only where it carries meaning. Never cross colors in a duotone.
- Keep chrome minimal so the tells carry the page. An earlier proof page got too decorative.
- Copy goes through the ghost-writer and humanize passes.

## Evidence on Hand

- The live element itself, running on the page.
- The landing's In the Wild examples and measured numbers: bundle size, frame rate with 100 tells on screen, palette contrast ratios.
- Lab history: sketches and rounds from the private `tiny-tells-lab` repo may appear as lab notes. The repo stays private, so nothing links to it.
- The maker's byline: talbs.
- There are no users, testimonials, logos, download counts, or press. Don't invent them.

## Product Principles

1. Show, then tell. A tell moving does more than a sentence about it.
2. Every claim is something the page can prove live or with a measured number.
3. A developer goes from landing to a working tag in under a minute.
4. Personality lives in the motion and the voice. The chrome stays quiet.

## Accessibility & Inclusion

The site holds the same floor as the element: WCAG 2.2 AA, it works under reduced motion and forced colors, and nothing flashes. Motion on the page respects `prefers-reduced-motion`.
