# Tiny Tells

- Source of truth is `src/`. `dist/` and `site/` are built by `npm run build` (`tools/build.mjs`) and aren't committed; never edit them by hand.
- Tests follow `tests/README.md`: necessary, non-brittle, public surface only, no sleeps. Read it before adding or changing a test.
- Custom properties use the `--tell-` prefix. Palette tokens are `--tell-color-{state}`.
- Web Awesome is only for page chrome (proofing, demos). Tiny Tells itself has no dependencies.
- The site loads Web Awesome as one bundle that `tools/build.mjs` generates from the `wa-*` tags the pages use, so a new tag needs no registration. Build `<wa-*>` markup from literal tags (`<wa-button`, `createElement('wa-button')`) so the scan sees it.
- Site CSS lives in `tools/site/css/`, one cascade layer per file. `tokens.css` declares the order: Web Awesome's layers, then `tokens`, `base`, `shell`, `components`, and `page` (shared by `landing.css`, `docs.css`, and `404.css`). A later layer wins regardless of specificity; with `!important`, an earlier one wins. The one exception: `base.css` keeps the `h2`, `h3`, and `p` margins in Web Awesome's `wa-base` layer so its utilities still beat them.
- A new rule goes in the first layer that fits: a value (`tokens`), a bare element (`base`), the page frame (`shell`), used on two or more pages (`components`), or one page (that page's file). When a page rule shows up on a second page, move it to `components`; when a component ends up on one page, move it to that page's file.
- Fix a losing rule by moving it to the layer it belongs in, not with an ID selector, `!important`, or extra specificity.
- `build --check` fails if a page's inline CSS passes its gzip budget (`CSS_BUDGET_KB` in `tools/build.mjs`).
- `src/api.json` is the source for the public API docs. The build generates `dist/custom-elements.json`, `dist/vscode.html-custom-data.json`, `dist/*.d.ts`, and the docs page's API, tells, and states tables from it. Never edit those by hand.
- `/llms.txt` is a public URL that assistants are told to read, and the paste-in prompt (`ASSISTANT_PROMPT` in `tools/shared/copy.js`, shown on the landing and in the docs) depends on its Rules list. The build writes it (`llmsTxt` in `tools/build.mjs`); its reference sections come from `src/api.json`, but its Rules are hand-written and mirror the docs' Your Part list, so change both together. The build fails if it links to a docs anchor that doesn't exist.
- `src/` is ES modules. The engine's shared scene (`isDark`, `palette`, `gaze`) is only ever set through `withScene` in `core.js`.
- Run `npm test` before calling anything done. It builds first, and `npm publish` runs it too.
- Commit messages are lowercase, present participle ("adding x", "fixing y"), subject line only.
- PRs don't edit `CHANGELOG.md`. The release PR writes the version's section from the PRs merged since the last tag, under Keep a Changelog's categories (Added, Changed, Deprecated, Removed, Fixed, Security), with any breaking change marked **Breaking** and listed first. `npm run check` fails if `CHANGELOG.md` has no section for `package.json`'s version.
- Links from the landing builder (`?tell=&state=&size=&words=#drop-one-in`) are public. Old links must keep loading; unknown values fall back to the defaults.
