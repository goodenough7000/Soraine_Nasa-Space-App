# Soraine Research Navigator

A working visual prototype: Jarvis-style orb → Ultem Moon/Mars comparison → source-backed evidence.

The interface uses React, assistant-ui's local runtime and Motion. Commands currently navigate a guided Ultem comparison using the shared research JSON. There is no external language model connected. An unrelated question gets a clear scope message instead of an invented answer.

## Run it

Requires Node 22.12+ and pnpm.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Open http://127.0.0.1:4319. Select **Ultem · Moon vs Mars**, or type the comparison. Select **Explore evidence** on either card. The detail panel contains the original NASA paper and an evidence download. Escape returns to the comparison. Ctrl/Cmd K focuses the command bar.

```sh
pnpm build
pnpm preview
pnpm test
```

The wave icon enables reduced motion. The operating system's reduced-motion preference also stops the orb and disables spatial transitions.

For the combined app, set `SORAINE_BASE_PATH=/research/` before building and serve `dist` at that route. See [the handoff guide](../MERGE-GUIDE.md) for PowerShell commands and the complete parent-page message flow. Keep this directory next to `../research`; that sibling folder is the single runtime data source.

## Connect Ethan's Moon scene and Johnson's Mars scene

The dashboard reads scene selections and leaves the scene's meshes, camera and physics alone. Published test conditions remain separate from the scene's illustrative atmosphere.

The easiest isolated integration is a same-origin iframe. Serve the built dashboard from its own route, and use that route as `src`. Wait for its `soraine:ready` message before sending a selection. Both sides must check the message origin and source.

```js
const frame = document.querySelector('#research-frame');
const selection = {
  objectId: 'sample-ultem',
  sceneId: 'moon', // Johnson uses 'mars'
  atmosphereId: 'illustrative-enriched',
  cabinOverrides: { oxygen_percent: 30, pressure_kpa_absolute: 70.3 }
};
frame.contentWindow.postMessage({ type: 'soraine:inspect', selection }, location.origin);

window.addEventListener('message', event => {
  if (event.origin !== location.origin || event.source !== frame.contentWindow) return;
  if (event.data.type === 'soraine:return-to-scene') {
    // Close your dashboard overlay and focus the original sample.
    focusSample(event.data.selection.objectId);
  }
});
```

`/integration-demo.html` is a small runnable host example. Incoming cabin settings are returned intact. They never overwrite the published oxygen endpoints.

For direct React composition, keep the sibling `research` folder, copy `src`, the media/font assets and their licenses into your app, install the dependencies, and mount the exported component:

```jsx
import { ResearchNavigator } from './research/main.jsx';

<ResearchNavigator onReturnToScene={selection => closeResearch(selection)} />
```

Then send the same selection through a same-window event after the component mounts:

```js
window.dispatchEvent(new CustomEvent('soraine:inspect', { detail: selection }));
```

The current stylesheet is a complete page style. Use the iframe for style isolation, or scope the CSS before embedding it into an existing scene layout. The standalone entry is separate in `src/entry.jsx`.

Deep links work too: `/?objectId=sample-ultem&sceneId=mars` opens Mars evidence. This prototype intentionally supports only the Ultem film comparison. Other materials should be added through the shared data adapter and their own validated views.

## Data and interpretation

`../research/soraine-information.json` is the team's original shared information pack. It includes Hogan, Ethan and Tony's attribution and provenance. `src/research.mjs` extracts the two cases; it does not simulate fire.

The comparison shows Ultem 1000 PEI film, 0.254 mm thick, at 10.2 psia (about 70.3 kPa absolute). The reported short-drop endpoints are:

| Nominal gravity | ULOI*: flame survived | MOC*: flame extinguished |
| --- | --- | --- |
| Moon, 0.16 g | 21% oxygen | 19.9% oxygen |
| Mars, 0.38 g | 22% oxygen | 21.1% oxygen |

These are the lowest tested oxygen concentration with survival and the highest tested oxygen concentration with extinction during the 5.18-second drop. They are not safe cabin limits, ignition thresholds or continuous predictions. Missing airflow remains missing.

[NASA source record](https://ntrs.nasa.gov/citations/20130010991), Table I, PDF page 6.

## Design and dependencies

The original interface artwork takes direction from the team's saved research references: [Zentra.AI by sandipdcc](https://dribbble.com/shots/27162960-Zentra-AI-Futuristic-AI-Workspace-Dashboard), [Next-Gen AI Interface by Gopal Chatterjee / Blend wrk](https://dribbble.com/shots/27106517-Next-Gen-AI-Interface-Dark-Mode-Dashboard), and [AI Dashboard by Digcy](https://dribbble.com/shots/26898396-AI-Dashboard). Their images are not included in this app.

- [assistant-ui](https://github.com/assistant-ui/assistant-ui), MIT: local conversation runtime.
- [Motion](https://github.com/motiondivision/motion), MIT: shared-element transitions.
- React and Vite, MIT: application and build tooling.
- Jost, SIL Open Font License: local font; license in `public/fonts`.

The orb and planet illustrations are decorative. They do not represent experimental measurements. The cinematic orb was generated with Higgsfield Seedance 2.5 using Hogan's unlimited allowance, then compressed into a 512-pixel, 7.4-second local MP4 (about 398 KiB) with a crossfaded loop seam. No generation credit spend was selected. The prompt and job ID are in `design/orb-generation.json`.

Reduced motion uses a still poster. If the media cannot load or play, the original procedural canvas orb takes over. Playback pauses in hidden tabs. The app makes no Higgsfield request at runtime.

The `test` folder also contains browser checks and a recorded motion check. These use Playwright from the host runtime, or a local `playwright` installation and installed Chrome. Set `SORAINE_TEST_URL` to test a production preview on a different port.

On another development machine, install the optional browser tooling with `pnpm add -D playwright` and install Google Chrome. With the app running, use `pnpm test:browser`, `pnpm test:media` and `pnpm test:motion`. For a subpath preview, set `SORAINE_TEST_URL` to a URL such as `http://127.0.0.1:4321/research` without a trailing slash. Browser screenshots and diagnostic recordings go into the ignored `qa` folder.
