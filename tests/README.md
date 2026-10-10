# Testing standards

A test earns its place by protecting something a user would notice. Fewer, sturdier tests beat more of them.

Every figure here carries the date it was measured. A number without a date has gone stale without saying so, so re-measure before citing it.

## Gate 0: the budget

Set the number before writing the first test for a feature. Judging each test on its own comes too late: every test has a defensible reason, and that's how a suite outgrows the code it protects.

- **Count contract surfaces, not behaviors.** One test per thing someone outside `src/` depends on: an attribute, a token, the accessible name, the play gestures. Examples of the same thing go in a table inside one test.
- **Compare against something shipped.** If a new attribute wants more tests than `scheme` has, stop and ask why.
- **Over budget?** Make it table-driven first, then cut.
- **Gate 1 beats the number.** If a real contract would go unprotected, the budget is wrong, not the test.

Measured 2026-10-10: 35 browser tests (run in up to three engines), 2 node scripts (the test-DOM one runs twice, for jsdom and happy-dom), and 1 node test file.

## Gate 1: should this test exist?

All three must pass.

- **Would its failure tell you something ESLint and the types can't?** Re-asserting a type is free to delete.
- **Does it guard a contract someone depends on?** An attribute, a token, the accessible name, a bug we actually hit (name it in the title). Not an internal detail.
- **Would you notice if it silently stopped running?** If not, it isn't protecting anything.

Delete a test when its behavior is removed. If two tests would fail for the same reason, merge them.

## Gate 2: which layer

If the answer doesn't depend on a real browser, it doesn't go in one. A browser test earns its cost for pixels, real layout, focus, and pointer input.

| Concern | Where |
|---|---|
| Canvas geometry (live area, centering), flashing, and loop seams (no jump when a state's loop restarts) | Playwright, `tests/engine.html` (Chromium, every tell × state × scheme, imports `src/` directly) |
| The public surface matches `custom-elements.json` (names, defaults, reflection) | `node --test tests/public-surface.test.mjs` (happy-dom) |
| Element behavior that needs pixels, layout, or input | Playwright, `tests/tiny-tell.spec.js` (Chromium, Firefox, WebKit) |
| Bundle size (min + gzip ≤ `budgetKb` in `tools/build.mjs`) | `node tools/build.mjs --check` |
| A missing import or unused name | `eslint .` |
| Importing on a server (both bundles) | `node tests/server-import.mjs` |
| The landing, docs, and 404 load and switch theme without errors, the docs drawer and tabs behave, and Tap Tempo hands the speed back | Playwright, `tests/tiny-tell.spec.js` "site pages" (Chromium, Font Awesome's icons stubbed so it runs offline on any port) |
| Rendering in test DOMs (jsdom, happy-dom) without throwing or logging | `node tests/fake-dom.mjs jsdom` and `… happy-dom` |

Don't repeat a layer's job in another layer.

## How to write one

- **Public surface only:** attributes and properties, the accessible role and name, CSS custom properties, and the rendered pixels of `::part(tell)`. Never private fields or internal markup.
- **Group with `describe`.** No loose top-level tests. Skip unsupported browsers at the group level (`test.skip(({ browserName }) => …)`), so hooks don't run against a page that was never opened.
- **Every assertion says its claim.** `expect(x, 'paused holds the frame')`, not a bare diff. The message is what you read when it fails in CI.
- **Node tests use `node:test` and `node:assert/strict`.** Loose `assert.equal` is `==`, so `'1' == 1` passes.
- **No sleeps.** No `waitForTimeout`, no `setTimeout`. Wait on a condition (`waitForFunction`, `expect.poll`) or a frame (`requestAnimationFrame`). If there's honestly no signal to wait on, a timer is allowed with a comment saying why.
- **Poll for the change, not a value that may already hold.** If the end state can be true before the action runs, the test passes without the action doing anything.
- **Set the state you measure.** Don't lean on a default that someone might change.
- **Freeze time when reading pixels.** Use reduced motion (`still: true` in the spec) so every frame is deterministic.
- **Assert big differences, not exact values.** "Red beats green by 60," not "pixel 12 is #dc0000." No screenshot comparisons until the visuals stop changing.
- **Test what motion does, not its curve.** The motion is the product here, so the engine checks do test it: stays in the live area, no seam at the loop, no flashing over 3 a second. They never pin a spring constant or a keyframe value. Those change every time a tell gets tuned.
- **Fixtures are shared and small.** Add a tag to `tests/fixture.html` before writing a new page. Look tells up by id or `data-skin`, never by position.
- **The public-surface test is a tripwire.** If adding API breaks it, update it on purpose.
- **Run the harder condition once instead of both.** For example, canvas sizing runs at 2× density only, because 1× is the easy case.

## Patterns that break suites

From webawesome-app, where each one actually happened. Watch for them here.

- **Measuring mid-animation.** A scaled or moving ancestor skews every box read beneath it. Measure after it settles.
- **Reading `::part()` style right after mutating the host.** Chromium can return the old value. Read from an element you never mutate.
- **A selector that never matches.** `#foo` written for a class doesn't throw; it times out 30 seconds later. Check the fixture.
- **Loop-generated tests that silently vanish.** A loop that builds tests can stop producing them and nothing fails. Prefer one test with a loop of assertions inside it.
- **Two tests asserting different models.** Both stay green because neither runs the other's case.

## Done means

`npm test` runs every layer. A change isn't done until the browser suite passes three times in a row: `npx playwright test --repeat-each=3`.
