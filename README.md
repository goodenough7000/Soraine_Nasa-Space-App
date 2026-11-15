# Soraine · Flame in Freefall

NASA Space Apps 2026 webapp. A kitchen with no walls stands on a planet surface. Switching gravity (Earth, Mars, Moon, ISS) sends a scan wave out from the stove flame. Inside the wave the world is already under the new gravity: terrain, sky, lighting, the flame's shape, and loose props that react through a rigid-body sim. Outside it, the old gravity still applies.

## Run locally

Windows: double-click `start.bat`, then open http://localhost:5180.
Anywhere else: `python serve.py 5180`.
ES modules and GLB files need a real `http://` origin, so opening `index.html` straight from disk won't work.

## Layout

| Path | What |
|---|---|
| `index.html`, `kitchen/` | Front end: Three.js scene, scan post-pass, terrain, meadow, stars, props physics, pages |
| `data/scenarios.json` | Per-scenario gravity, sky, fog, flame parameters, terrain model and placement, facts with sources |
| `models/planet_surfaces/` | Earth meadow, Moon and Mars low-poly terrains (Blender) |
| `vendor/` | three.js 0.160, GLTFLoader, cannon-es 0.20, bundled so nothing loads from a CDN |
| `backend/` | `python -m backend check` validates data contracts. `python -m backend build <new-dir>` produces a static release (allowlisted files) |
| `tools/blender/` | Scripts that regenerate the terrain GLBs |
| [`dashboard/`](dashboard/README.md) | Live research observatory, planetary and material models, BigQuery API and deployment configuration |
| [`contributions/hogan/`](contributions/hogan/README.md) | Shared research, Jarvis navigator prototype, scene integration guides and SI log |

## Hogan: Research & Dashboard

The current dashboard lives in [`dashboard/`](dashboard/README.md) and is published at [soraine.vercel.app](https://soraine.vercel.app). The shared scene information pack, complete research archive and earlier Jarvis prototype are in [`contributions/hogan/`](contributions/hogan/README.md). Both are included on this branch.

- **[Shared information](contributions/hogan/research/README.md):** one JSON and lookup adapter for both scene teams, with 89 evidence records, 22 selectable cases, 52 sources and exact material/test conditions.
- **[Research navigator](contributions/hogan/navigator/README.md):** a runnable Jarvis-style prototype with an animated orb, Ultem Moon/Mars comparison, source links and evidence download.
- **[Connect to this kitchen app](contributions/hogan/REPO-INTEGRATION.md):** actual file locations, scene ID mapping and same-origin deployment requirements.
- **[Full research archive](contributions/hogan/research/archive/README.md):** Hogan, Ethan and Tony's merged research and contributor attribution.
- **[SI log](contributions/hogan/SI-LOG.md)** and **[validation](contributions/hogan/VALIDATION.md)** record the work and completed checks.

To run the navigator separately, use Node 22.12+ and pnpm:

```sh
cd contributions/hogan/navigator
pnpm install --frozen-lockfile
pnpm dev
```

Open http://127.0.0.1:4319. The current prototype has guided local commands and a finished Ultem comparison. The root kitchen app still runs through `start.bat` / `serve.py`; its detail panel and release build have not yet been connected to the navigator.

## Notes

- The flame shapes and the props' scan "kick" are visual heuristics, not combustion or measured data. Facts in `scenarios.json` carry a `src` field, and entries marked `schematic` or `unverified` are labelled as such in the UI.
- The terrains are procedural concept models. Their relief is not to scale.

## Shared research dashboard

[Open the public dashboard](https://soraine.vercel.app) · [Team integration guide](dashboard/TEAM-HANDOFF.md)

The Three.js research dashboard combines NASA planetary maps with material comparisons, searchable evidence and source links. Its Cloud Run backend reads the team-owned BigQuery copy. Source is in `dashboard/`; the scene code above remains independently editable.

Vercel publishes `dashboard/dist` from `codex/mission-control-cloud` and forwards data requests to Cloud Run. After this integration is merged, dashboard changes on the team repository's `main` branch run tests and deploy the Cloud Run service through GitHub Actions. See the team guide for Moon/Mars links, database access and module ownership.
