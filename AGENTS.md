# Tiny Tells

- Source of truth is `src/`. `dist/` and `site/` are built by `npm run build` (`tools/build.mjs`) and aren't committed; never edit them by hand.
- Tests follow `tests/README.md`: necessary, non-brittle, public surface only, no sleeps. Read it before adding or changing a test.
- Custom properties use the `--tell-` prefix. Palette tokens are `--tell-color-{state}`.
- Web Awesome is only for page chrome (proofing, demos). Tiny Tells itself has no dependencies.
- `src/api.json` is the source for the public API docs. The build generates `dist/custom-elements.json`, `dist/vscode.html-custom-data.json`, and `dist/*.d.ts` from it. Never edit those by hand.
- `src/` is ES modules. The engine's shared scene (`isDark`, `palette`, `gaze`) is only ever set through `withScene` in `core.js`.
- Run `npm test` before calling anything done. It builds first, and `npm publish` runs it too.
- Commit messages are lowercase, present participle ("adding x", "fixing y"), subject line only.
- PRs don't edit `CHANGELOG.md`. The release PR writes the version's section from the PRs merged since the last tag, under Keep a Changelog's categories (Added, Changed, Deprecated, Removed, Fixed, Security), with any breaking change marked **Breaking** and listed first. `npm run check` fails if `CHANGELOG.md` has no section for `package.json`'s version.
- Links from the landing builder (`?tell=&state=&size=&words=#drop-one-in`) are public. Old links must keep loading; unknown values fall back to the defaults.
