# Tiny Tells

Give your app's status a face. Six tiny characters drop in anywhere a spinner would go, and no two of them move the same way. People can tell at a glance whether things are working, done, broken, or waiting on them.

It's one custom element, `<tiny-tell>`, with no dependencies and about 14 KB min+gzip. It works in Chrome 99+, Firefox 112+, and Safari 16.4+.

**[See them live, and read the docs →](https://talbs.github.io/tiny-tells/)**

**Pre-1.0.** It's tested, but names and defaults may change before 1.0, so pin a version.

## Use it

```bash
npm i tiny-tells
```

```js
import 'tiny-tells';
```

To skip the build step, use the CDN script tag from the [install guide](https://talbs.github.io/tiny-tells/docs/#get-started), which always shows the current version.

Then add a tell, with words beside it that say what's happening:

```html
<p><tiny-tell skin="dekatron" state="working" label=""></tiny-tell> <span role="status">Syncing 3 files…</span></p>
```

Change the state and the tell springs into the new one:

```js
document.querySelector('tiny-tell').state = 'done';
```

The six tells are `drones`, `flipdot`, `eyes`, `blot`, `dekatron`, and `lens`. The five states are `working`, `done`, `error`, `warning` (waiting on a person), and `idle`. The [docs](https://talbs.github.io/tiny-tells/docs/) cover sizing, color, accessibility, frameworks, testing, the play bundle, and the full API.

## Develop

```bash
npm install
npm test
```

- `src/` is the source of truth, as plain ES modules. `npm run build` builds `dist/` and the site in `site/`: the landing page, the docs, and the 404 page. Neither is committed, since CI builds them and the site deploys to GitHub Pages from `main`.
- `npm run serve` serves the built site at `http://127.0.0.1:4173/tiny-tells/`, the same path GitHub Pages uses, so the 404 page's absolute links work locally.
- `npm test` runs Prettier, ESLint, the size budgets, the test-DOM and server checks, and the Playwright tests in Chromium, Firefox, and WebKit, including the canvas checks for live area, flashing, and loop seams.
- The social card and the favicon PNGs are committed. After changing `tools/og/card.html` or `tools/favicon/favicon.svg`, run `npm run og` or `npm run icons` to render them again.
- Tests follow [tests/README.md](tests/README.md).

## License

[MIT](LICENSE)
