# Connect the Moon and Mars scenes

Keep this whole folder together initially. The navigator imports the sibling `research` folder directly, so the data exists in one place. No root package file, shared routing or scene component has been changed by this contribution.

## 1. Use the shared data for any clicked object

From either scene app, import the files using the appropriate relative path:

```js
import data from './path/to/contributions/hogan/research/soraine-information.json';
import { getObjectPanel } from './path/to/contributions/hogan/research/info-adapter.mjs';

const selection = {
  objectId: 'sample-ultem',
  sceneId: 'moon', // Johnson uses 'mars'
  atmosphereId: 'illustrative-enriched',
  cabinOverrides: { oxygen_percent: 30, pressure_kpa_absolute: 70.3 }
};
const panel = getObjectPanel(data, selection);
```

Pass `panel` to your own information panel. `panel.sceneConditions` describes the scene; `panel.measurements` and `panel.testConditions` describe the published test. Keep those sections separate.

Attach the canonical ID to `mesh.userData.infoId`. IDs such as `stove`, `pan`, `egg`, `sample-ultem`, `sample-nomex` and `sample-wire` are shared by both scenes. The complete registry is in the JSON; [INTEGRATION.md](research/INTEGRATION.md) explains each object and its data. Kitchen props get explanations, not invented material test results.

## 2. Open the full navigator for the Ultem comparison

The current navigator supports `sample-ultem` with `sceneId: 'moon'` or `'mars'`. Use your regular information panel for the other objects until their dashboard views are added.

The simplest integration is a same-origin iframe mounted above the scene. Build the navigator with the route where it will be served:

```powershell
# From contributions/hogan/navigator
$env:SORAINE_BASE_PATH = '/research/'
pnpm build
```

On macOS/Linux: `SORAINE_BASE_PATH=/research/ pnpm build`.

Copy the contents of `navigator/dist` into the combined app's public `research` directory. In Tony's current static app, that is a generated `research/` directory at the repository root, next to `index.html`. The host must serve `/research/` as that directory's `index.html`. Keep the trailing slash in the base path. The build includes the orb, poster and font locally and makes no Higgsfield request at runtime. The release builder has an explicit file allowlist; see [REPO-INTEGRATION.md](REPO-INTEGRATION.md) before publishing a combined build.

```js
const frame = document.querySelector('#research-frame');
let pendingSelection = selection;
let ready = false;

function showResearch(nextSelection) {
  pendingSelection = nextSelection;
  frame.hidden = false;
  if (ready) frame.contentWindow.postMessage({
    type: 'soraine:inspect', selection: pendingSelection
  }, location.origin);
}

window.addEventListener('message', event => {
  if (event.origin !== location.origin || event.source !== frame.contentWindow) return;
  if (event.data?.type === 'soraine:ready') {
    ready = true;
    if (pendingSelection) showResearch(pendingSelection);
  }
  if (event.data?.type === 'soraine:return-to-scene') {
    frame.hidden = true;
    // Restore focus/camera through your scene's existing selection handler.
    restoreSceneSelection(event.data.selection);
  }
});
```

Install the listener before assigning `frame.src = '/research/'`. The ready message ensures the selection is not lost while the iframe loads. The supplied `navigator/public/integration-demo.html` is a runnable host example with Moon and Mars buttons.

Direct React composition is also supported through the exported `ResearchNavigator` component. Its stylesheet currently styles the whole page, so scope the styles before placing it inside a scene layout. The iframe keeps that styling separate while the teams combine their work.

## 3. Check the handoff

1. Select Moon Ultem. The published endpoints show 21% and 19.9% oxygen at 10.2 psia.
2. Select Mars Ultem. They show 22% and 21.1% at the same reported pressure.
3. Change the illustrative cabin to 30% oxygen. The published endpoints stay unchanged.
4. Return to the scene. The object, destination and cabin settings come back intact.
5. Open the NASA source or download the selected evidence.
6. Check the final app on the team laptop with the 3D scene running. The isolated prototype tests do not measure that combined workload.

Tony's kitchen upload was reviewed at `7d8ea73` and brought into this contribution branch. Its vanilla Three.js entry is `kitchen/main.js`; panel rendering is in `kitchen/pages.js`. The repository-specific integration notes map those files to this module. Tony's separate design Markdown was not present in that commit.
