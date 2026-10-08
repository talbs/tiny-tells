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

- Edit `src/`, then run `npm run build`. Built files (`dist/`, `site/`) aren't committed.
- `src/` is plain ES modules. `npm run lint` catches a missing import before it becomes a runtime error.
- Tests follow [tests/README.md](tests/README.md). Read it before adding one.
- `npx playwright test --repeat-each=3` should pass before a PR.
