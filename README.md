# Tiny Tells

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://tinytells.dev/readme-dark.gif">
  <img src="https://tinytells.dev/readme.gif" alt="The six Tiny Tells moving through working, done, error, warning, and idle.">
</picture>

Give your app's status a face. Six tiny characters drop in anywhere a spinner would go, and no two of them move the same way. People can tell at a glance whether things are working, done, broken, or waiting on them.

It's one custom element, `<tiny-tell>`, with no dependencies and about 14 KB min+gzip. It works in Chrome 111+, Firefox 113+, and Safari 16.4+.

**[See them live, and read the docs →](https://tinytells.dev/)**

**Pre-1.0.** It's tested, but names and defaults may change before 1.0, so pin a version.

## Use it

```bash
npm i tiny-tells
```

```js
import 'tiny-tells';
```

To skip the build step, use the CDN script tag from the [install guide](https://tinytells.dev/docs/#get-started), which always shows the current version.

Then add a tell, with words beside it that say what's happening:

```html
<p><tiny-tell skin="dekatron" state="working" label=""></tiny-tell> <span role="status">Syncing 3 files…</span></p>
```

Change the state and the tell springs into the new one:

```js
document.querySelector('tiny-tell').state = 'done';
```

The six tells are `drones`, `flipdot`, `eyes`, `blot`, `dekatron`, and `lens`. The five states are `working`, `done`, `error`, `warning` (waiting on a person), and `idle`. The [docs](https://tinytells.dev/docs/) cover sizing, color, accessibility, frameworks, agent status, testing, the play bundle, and the full API.

Building with an AI assistant? Point it at [llms.txt](https://tinytells.dev/llms.txt), or see [Build with AI](https://tinytells.dev/docs/#build-with-ai).

## Develop

Setup, builds, and tests live in [CONTRIBUTING.md](https://github.com/talbs/tiny-tells/blob/main/CONTRIBUTING.md#working-on-it).

## License

[MIT](LICENSE)
