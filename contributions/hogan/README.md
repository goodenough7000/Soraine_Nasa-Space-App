# Hogan's research and dashboard handoff

This contribution connects our research to Ethan's Moon scene and Johnson's Mars scene. It contains the shared information pack, contributor archive and earlier Jarvis prototype.

The current research dashboard is live at [soraine.vercel.app](https://soraine.vercel.app). Its source, BigQuery backend and deployment configuration are in [`../../dashboard/`](../../dashboard/README.md). Use the [dashboard team handoff](../../dashboard/TEAM-HANDOFF.md) to link a scene directly to a material or source record. The navigator below remains an optional earlier prototype.

| Start here | What it contains |
| --- | --- |
| [MERGE-GUIDE.md](MERGE-GUIDE.md) | How the scene teams connect their objects and keep their current UI |
| [REPO-INTEGRATION.md](REPO-INTEGRATION.md) | How this contribution fits Tony's uploaded kitchen app |
| [research/](research/README.md) | One shared information JSON, lookup adapter, types and examples |
| [navigator/](navigator/README.md) | Runnable Jarvis prototype with orb, smooth transitions and the Ultem comparison |
| [research/archive/](research/archive/README.md) | Complete merged research and the original Hogan/Ethan/Tony contributor records |
| [VISUAL-HANDOFF.md](VISUAL-HANDOFF.md) | Current visual direction and the boundary between finished and paused work |
| [SI-LOG.md](SI-LOG.md) | SI assistance, source attribution and validation record |
| [VALIDATION.md](VALIDATION.md) | Checks completed on this packaged contribution and remaining integration limits |

## Run the prototype

Requires Node 22.12+ and pnpm. From the repository root:

```sh
cd contributions/hogan/navigator
pnpm install --frozen-lockfile
pnpm test
pnpm dev
```

Open `http://127.0.0.1:4319`. Choose **Ultem · Moon vs Mars**, then open either evidence card. `pnpm build` creates the production files.

The prototype has a guided command interface, not a connected language model. Its finished comparison covers Ultem film on the Moon and Mars. The shared research layer supports 15 objects and 22 selectable test cases; those additional views have not all been built into this interface.

## Team boundaries

- Ethan owns the Moon scene; Johnson owns the Mars scene.
- Tony's design document guides the combined product. This visual prototype is available to adapt.
- Hogan's layer owns research copy, source links, object IDs and published results.
- The app shell chooses when to show a scene, a small information panel or the full navigator.

The research JSON and adapter do not move a camera, change a mesh or calculate fire physics. Changing a cabin slider never rewrites the published experiment values. The same source can support a simple scene tooltip or a detailed dashboard.

Downloaded reference art, generated build folders, dependency folders and Myco configuration are not needed to run this contribution. They remain outside this handoff.

Tony's kitchen upload is now included in the PR branch. The root README links this section; the navigator and shared data remain separate from the kitchen's camera, physics and scenario code until the team connects them.
