# Contributing

Tiny Tells is pre-1.0. Thanks for poking at it.

- **Bugs:** open an issue with the browser, the tell, the state, and what you saw. A screen recording helps a lot.
- **Changes:** open an issue before a PR, so we can agree on it first.
- **New tells:** not accepted yet. The internals are still moving. Fork away, though.
- **Security problems:** report them privately, as [SECURITY.md](SECURITY.md) explains.

Everyone here follows the [code of conduct](CODE_OF_CONDUCT.md).

## Working on it

```bash
npm install
npm test
```

- Edit `src/`, then run `npm run build`. It builds `dist/` and the site in `site/` (the landing page, the docs, and the 404 page). Neither is committed: CI builds them, and the site deploys to GitHub Pages from `main`.
- `npm run serve` serves the built site at `http://127.0.0.1:4173/`, the root it has on tinytells.dev, so the 404 page's absolute links work locally.
- `src/` is plain ES modules. `npm run lint` catches a missing import before it becomes a runtime error.
- `npm test` runs Prettier, ESLint, the size budgets, the test-DOM and server checks, and the Playwright tests in Chromium, Firefox, and WebKit, including the canvas checks for live area, flashing, and loop seams.
- Element tests live in `tests/element.spec.js` and site tests in `tests/site.spec.js`. While you work, run your half alone: `npx playwright test element` for a `src/` change, `npx playwright test site` for the site or docs.
- Playwright starts its own server on port 4173, so stop `npm run serve` (or a server from another checkout) first.
- Tests follow [tests/README.md](tests/README.md). Read it before adding one.
- The social card, the README strips, and the favicon PNGs are committed as finished images. Their renderers live in the private lab repo, so regenerating them after a tell changes is a manual step there.
- `npx playwright test --repeat-each=3` should pass before a PR.
