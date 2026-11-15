# Soraine in Rust: plan

**Goal.** One app, all program code in Rust: the research dashboard (soraine.vercel.app) stays the home page and gains a "3D" tab that hosts the kitchen, Moon, Mars and orbit scenes from `soraine-3d/`. The browser side is Rust compiled to WebAssembly; the server is a Rust binary. HTML, CSS and GLSL shader text stay as they are (they are not JavaScript).

**Rule for every stage.** The JavaScript in `dashboard/dist/` stays live and untouched until stage 6. Each ported piece must reproduce the JavaScript's output on the published data before the next piece starts. No citation, record ID, ULOI/MOC value or caveat text changes anywhere.

## Where things are

| Thing | Location |
|---|---|
| Live dashboard (JavaScript) | `dashboard/dist/`, published by Vercel from `codex/mission-control-cloud` on goodenough7000's repo |
| Node server and data contracts | `dashboard/server/` |
| 3D scenes to merge in | `soraine-3d/` on branch `physics-integration` of ethan-gobi's fork |
| Rust workspace | `dashboard/rust/` (this folder) |
| JavaScript reference outputs | `soraine-core/tests/golden.json`, written by `node tools/make-golden.mjs` |

## Stages

- [x] **0. Workspace, research logic and a working browser build.** `soraine-core` ports `data.mjs`, `discovery.mjs`, `reading.mjs` and `scene-link.mjs`; `soraine-web` exposes it to the page as WebAssembly. Checks: `cargo test` (11 tests) matches the JavaScript on all 59 results, 33 filters, the full CSV export, 307 sources and 14 scene links; `node tools/check-web.mjs` gets the same answers from the WebAssembly build running in Chrome.
- [x] **1. Touch gestures.** `soraine-core::gesture` ports `touch-orbit.mjs` as a state machine. Check: its unit tests reproduce the JavaScript figures (a flick glides for 58 frames and 177.8 px).
- [x] **2. `soraine-server`.** Rust replacement for `server/*.mjs`: public assets with validators and audio ranges, `/healthz`, `/api/research`, `/api/original-data`, the five-minute cache and the BigQuery data contracts. Checks: `node --test tools/check-server.mjs` runs the assertions of `test/http.test.mjs` unchanged against the Rust binary; `cargo test -p soraine-server` restates `test/server.test.mjs` and `test/original-data.test.mjs`; `test/planets.mjs` and `test/browser.mjs` give the same results on the Rust server as on Node. Not done yet: the `Dockerfile` and Cloud Run still start the Node server; switch them at stage 6. The live BigQuery path (runtime identity on Cloud Run) is ported but can only be exercised there.
- [ ] **3. The page.** Every view is rendered by a Rust function that returns the same HTML string as its JavaScript counterpart (`soraine-core::views`, `specimen`, `glossary`), so the current stylesheets and Playwright selectors keep working; `soraine-web` then puts the markup on the page and handles events. `tools/make-golden.mjs` loads the private functions of `app.mjs` against a stand-in document to record what they return.
  - [x] Specimen card (`specimen.mjs`): 80 cases match byte for byte.
  - [x] Glossary terms and term markup (`glossary.mjs` data half): 24 terms.
  - [x] App helpers, icons, world captions, material picker, oxygen-limit chart, chart panel and the whole **overview** view: all 12 material and gravity combinations match byte for byte, natively and from the WebAssembly build in Chrome.
  - [x] Compare, evidence (frame, table, paging) and sources (frame, table, paging) views; record, source and about dialogs. Byte for byte for 6 compare states, 36 evidence states, 126 source states, all 59 record dialogs, the source dialogs and the about dialog, natively and from the WebAssembly build in Chrome.
  - [ ] Original-data explorer (`original-data.mjs`). It updates the page piece by piece instead of returning one string, so port its filtering and paging to `soraine-core` and check the rest by comparing the page itself (next item).
  - [x] Page wiring (`soraine-web/src/page.rs`, logic in `soraine-core::app`): state, address-bar sync and restore, navigation, search routing, clicks, keyboard, filters, paging, dialogs, exports and the toast. `sh tools/build-site.sh` assembles the Rust-driven site in `site/`. Checks: `test/planets.mjs` and `test/browser.mjs` give the same results as on the JavaScript build, and `node tools/compare-sites.mjs` shows the same view, dialog, address, navigation state and toast after each of 38 steps.
  - [ ] Still loaded as JavaScript by the Rust page: the original-data explorer (`original-data.mjs`, `discovery.mjs`), the glossary tooltip (`glossary.mjs` `initGlossary`), the music player (`audio.mjs`), and the two 3D stages (`globe.mjs`, `material-model.mjs`, `touch-orbit.mjs`; stage 4). Port each, re-running `compare-sites.mjs`.
  - Check for the whole stage: `test/browser.mjs` passes against the Rust build; page text matches the JavaScript build view by view.
- [ ] **4. 3D in Rust.** WebGL2 from Rust for the planet (shaders from `planet-materials.mjs`), the orbital laboratory and the material specimen, driven by the gesture code from stage 1. The specimen's glass-like material is the hard part. Check: `test/planets.mjs` passes; screenshots of Earth, Moon, Mars and each specimen are compared with the JavaScript build.
- [ ] **5. The 3D tab.** Port the `soraine-3d` scenes and physics (cannon.js becomes the `rapier3d` crate) into the same renderer as a new `scenes` view, linked both ways with the research views. Check: each scene loads on desktop and at 390px; the flame and objects behave as in `soraine-3d` for all four worlds.
- [ ] **6. Cutover.** Remove the JavaScript, publish the built WebAssembly, and open the pull request against `codex/mission-control-cloud`. Check: all suites pass on the Rust build and on a physical phone.

## Known constraints

- **Building WebAssembly.** GitHub Actions (`.github/workflows/rust.yml`) tests, lints and builds the WebAssembly target on every push to `rust-rewrite`. Locally, `sh tools/build-web.sh` writes the browser package to `pkg/`; where the `wasm32-unknown-unknown` target cannot be installed it builds the standard library from the `rust-src` sources instead. `node tools/check-web.mjs` then runs the package in Chrome.
- **Vercel has no build step today.** Either commit the built `.wasm` into `dist/` or add a build command; decide at stage 3.
- **Download size.** The WebAssembly file is 1.7 MB before any size tuning, most of it Unicode sorting data. Shrink it (size-optimised build, `wasm-opt`, compression) before stage 6 so the phone experience does not regress.

## Do not touch

`dashboard/dist/data/`, `dashboard/source-data/`, the BigQuery scripts, and anything under `contributions/`.
