# Working together on Soraine

The shared dashboard source lives in `dashboard/` and the public site is [soraine.vercel.app](https://soraine.vercel.app). Make a branch, change the relevant module, run the checks, then open a pull request. Vercel currently publishes `dashboard/dist` from `codex/mission-control-cloud`; its two data routes use the existing Cloud Run backend. Once this integration is merged, accepted dashboard changes on the team repository's `main` are deployed to Cloud Run by `.github/workflows/dashboard-deploy.yml`.

The same branch includes the scene information pack, full contributor research archive and earlier Jarvis prototype in [`../contributions/hogan/`](../contributions/hogan/README.md). Use the information adapter there for object-level panels, or the scene-link helper below to open the current dashboard.

## Shared cloud project and data

- Hosting/data project: `project-89aca125-c9a5-4fdd-bb0` (Soraine Dashboard)
- Region: `us-central1`; BigQuery dataset location: `US`
- Dataset: `flame_in_freefall_2026`
- Cloud Run service: `soraine-dashboard`
- [Open BigQuery](https://console.cloud.google.com/bigquery?project=project-89aca125-c9a5-4fdd-bb0)
- [Open the hosting project](https://console.cloud.google.com/run?project=project-89aca125-c9a5-4fdd-bb0)

The database is an independent copy of the original eight tables and three views. It is not continuously synchronized with the original project. The copied views refer to tables in this project. Coordinate research edits here to keep the team on one version.

The three accounts Hogan approved can edit this dataset and run queries. They can also develop Cloud Run services, view builds/logs, and deploy with the dedicated runtime identity. Project ownership and billing administration remain with Hogan. GitHub access is separate; Tony manages collaborator permissions and merging in the team repository.

The public research backend reads `sources`, `experiments`, `measurements`, and `evidence`, with explicit column lists. A separate original-data endpoint reads `public_experiment_rows`: 381 source CSV rows across BASS, BASS-II, Saffire I/II/III and SAME-R. Both endpoints cache complete exports for five minutes per instance. The service uses its Cloud Run identity, with no downloaded service-account keys. Complete raw tables, file manifests and download logs stay in BigQuery. Catalogue totals come from the dated fallback export. See [the dashboard update](REFACTOR-NOTES.md) for source coverage, interface changes and checks.

## Connect a Moon or Mars scene

Use the shared helper from either scene. Copy or import this module with `data.mjs` from the same directory:

```js
import {researchUrl} from './dashboard/dist/scene-link.mjs';

// Run from a user click on the selected material's “View research” control.
window.open(researchUrl({
  world: 'moon', // earth, moon, mars, iss, microgravity
  material: 'Ultem 1000', // Ultem 1000, Mylar G, Nomex HT90-40
  view: 'compare' // overview, compare, experiments, evidence, sources
}), '_blank', 'noopener');
```

For a local scene, link to `dashboard/dist/` when serving the complete repository statically. Static hosting reads the saved research JSON; Cloud Run provides `/api/research`. Do not place Google credentials in scene JavaScript.

For an exact result, add `record: 'E014'`. Its source-and-conditions drawer opens on arrival. With `view: 'evidence'`, the supplied environment and material also filter the table. Use the same helper with `world: 'mars'` for Johnson's scene. The helper accepts an optional second argument for a local dashboard base URL.

The inspected `models-only` and `physics-integration` branches in Ethan's repository use `kitchen/pages.js` for the detail panel and `selectScenario()` in `kitchen/main.js` for scene selection. Wire a normal link or click handler into that detail panel using `this.scenario.slug` as the environment. Keep the material tied to a real experimental sample; a kitchen object such as a spoon is not automatically an Ultem sample. These branches have been inspected, not merged into this contribution.

The reusable data functions are in `dist/data.mjs`: `joinResearch`, `filterRows`, `getLimits`, and `comparisonRows`. Environment selection describes experimental gravity; it does not automatically set a cabin's pressure or oxygen fraction. No Google login or database credentials are needed by the scene renderer.

## Module ownership

| Work | Files |
|---|---|
| Research layout, navigation and details | `dist/app.mjs`, `dist/observatory.css`, `dist/observatory-responsive.css`, `dist/index.html` |
| Scene links and brand rules | `dist/scene-link.mjs`, `DESIGN.md` |
| Planet rendering and shaders | `dist/globe.mjs`, `dist/planet-materials.mjs` |
| Orbital laboratory illustration | `dist/microgravity-scene.mjs` |
| 3D material rendering and controls | `dist/material-model.mjs` |
| Touch, mouse and pinch gestures for both 3D stages | `dist/touch-orbit.mjs` |
| Phone layout, dividers, type weights and touch targets (loaded last) | `dist/mobile-polish.css` |
| Specimen layout, SVG fallback and oxygen markers | `dist/specimen.mjs`, `dist/specimen.css` |
| Scientific term definitions | `dist/glossary.mjs`, `dist/glossary.css` |
| Original NASA CSV explorer | `dist/original-data.mjs`, `dist/original-data.css` |
| Research filtering and comparison | `dist/data.mjs` |
| Public data contract, caching and API | `server/research.mjs`, `server/index.mjs` |
| Original CSV contract and publication | `server/original-data.mjs`, `scripts/publish-original-data.sql` |
| Deployment | `Dockerfile`, `.github/workflows/dashboard-deploy.yml` |

`createMaterialModel(host, material)` provides `setMaterial`, `zoom`, `reset` and `dispose`. The overview retains this renderer while changing materials and disposes it on exit. It renders on demand and supports pointer, touch and keyboard controls. `specimen.mjs` supplies the SVG fallback and the separate oxygen-limit display. The procedural forms and physical shading illustrate Ultem, Mylar and Nomex; they do not calculate fire behaviour or represent measured optical properties. Keep this visual module independent of scene physics and source values.

Run `node server/index.mjs` and open `http://localhost:4335`. Local development uses the bundled snapshot. Run `node --test test/*.test.mjs` before a PR. Browser checks live in `test/browser.mjs` and use Playwright with an isolated Chrome profile.

GitHub deployment uses Workload Identity Federation restricted to this exact repository, `main`, and the dashboard workflow. Pull requests run tests but cannot obtain deployment credentials. Cloud Run scales to zero when idle and has a maximum of two instances. Hosting, builds and database usage can incur Google Cloud charges.
## Compact overview layout

The desktop overview is styled by `dist/command-deck.css`, loaded after the existing stylesheets. Its structural wrappers are `mission-overview`, `focus-inspector-grid` and `mission-evidence` in `dist/app.mjs`. It shares the same renderers, data state, source dialogs and scene links. Use the existing action attributes when connecting scene controls; the layout does not introduce a second state model.
