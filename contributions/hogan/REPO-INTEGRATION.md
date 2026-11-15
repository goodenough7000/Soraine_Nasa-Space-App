# Connect Hogan's module to Tony's kitchen

Reviewed against the kitchen upload on `main`, commit `7d8ea73` (PR #2). This note maps the existing code to the shared information module. It does not replace Tony's design direction or change the scene implementation.

## What is already in the repository

| Existing file | Responsibility | Connection to the research module |
| --- | --- | --- |
| `kitchen/main.js` | Renderer, camera rigs, scenario selection, animation loop | Hold the current scene selection and open/close the research view |
| `kitchen/pages.js` | Observe/Detail/About panels and scenario buttons | Render shared object information in the detail panel |
| `kitchen/props.js` | Named loose props, rigid-body physics and pointer dragging | Attach research IDs to selected props without replacing the drag behavior |
| `data/scenarios.json` | Gravity in m/s², visual settings and scene facts | Keep visual parameters separate from published test records |
| `models/planet_surfaces/` | Earth, Moon and Mars terrain models | No research dependency |
| `backend/release.py` | Explicit list of public files copied into a release | Must include any research assets used by the combined app |

The current detail panel ends with a message saying the evidence case and material comparison still need to be wired in. That is the available integration point. The flame shapes and scan impulse are illustrative settings; the research layer supplies experiment evidence, not numerical flame predictions.

## Match identifiers and units

| Kitchen scenario slug | Research scene ID |
| --- | --- |
| `earth` | `earth` |
| `moon` | `moon` |
| `mars` | `mars` |
| `iss` | `microgravity` |

The kitchen's `g` values are acceleration in **m/s²**. The research records use their reported **nominal fraction of Earth gravity**. Select the research scene by ID; do not copy `scenario.g` into `gravity_nominal_g` or overwrite an experiment's recorded gravity.

Named props such as `spoon`, `knife` and `chopstick` can open the generic `utensils` explanation. The existing eggs can open `egg`. A dedicated, labelled Ultem sample should open `sample-ultem`; a generic pan handle is not evidence of the tested film grade and thickness. Check the object registry for the other supported IDs before connecting a mesh.

## Small panels in the existing vanilla JavaScript app

The shared adapter uses ordinary ES modules and can be imported from `kitchen/pages.js` without React:

```js
import { getObjectPanel } from '../contributions/hogan/research/info-adapter.mjs';

const sceneIds = { earth: 'earth', moon: 'moon', mars: 'mars', iss: 'microgravity' };
const response = await fetch('contributions/hogan/research/soraine-information.json');
if (!response.ok) throw new Error('Research data could not be loaded.');
const information = await response.json();

// Inside the existing scenario/object selection handler:
const panel = getObjectPanel(information, {
  objectId: 'sample-ultem',
  sceneId: sceneIds[scenario.slug],
  atmosphereId: 'illustrative-air'
});
```

`scenario` is the selected scenario already passed to `Pages.setScenario`. Load the JSON once, then reuse it. Use text nodes or `textContent` when inserting research copy into DOM elements. Display `sceneConditions` separately from `measurements` and `testConditions`.

The scene's exterior sky and terrain are visual context. The information pack's oxygen and pressure presets describe an illustrative air-filled cabin; they are not the Moon's or Mars's outside atmosphere.

## Full Jarvis navigator

The kitchen app is vanilla Three.js; the navigator is a separate React/Vite app. A same-origin iframe lets the existing page open the navigator without adopting its CSS or React runtime.

Build with `SORAINE_BASE_PATH=/research/` as described in [MERGE-GUIDE.md](MERGE-GUIDE.md), then place the contents of `navigator/dist` in a generated root `research/` directory. Serve it through the same origin as the kitchen, for example `http://localhost:5180/research/`. The separate Vite development port is a different origin and is not accepted by the iframe message bridge.

For the current prototype, open `sample-ultem` in `moon` or `mars`. Use the pure adapter for other objects. Listen for `soraine:ready` before sending `soraine:inspect`; on `soraine:return-to-scene`, restore the scene's selected object. Those messages are documented and exercised in the existing sample host.

## Release work when the team connects the UI

`backend/release.py` copies only its `FILES` and `GLOBS` allowlists. Adding a folder to the Git repository does not make it part of that release.

- If the kitchen uses small research panels, explicitly include the runtime JSON and adapter in the release.
- If it embeds the full navigator, build it first and add its generated HTML, JavaScript, CSS, font/license and media files to the release process.
- Keep the contributor archive, developer tests and documentation outside the site's runtime bundle.
- Run the existing backend contract check and test the built release, including a selection and return from both Moon and Mars.

This PR adds the organized contribution and integration documentation. The kitchen entry point, detail rendering, physics, scenario facts and release allowlist remain as uploaded by Tony.
