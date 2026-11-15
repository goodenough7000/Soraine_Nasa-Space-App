# Handoff validation

Checked on 2026-11-14 from the separate GitHub checkout, using Node 24.22.1, pnpm 11.25.0 and isolated Chrome.

| Check | Result |
| --- | --- |
| Frozen-lockfile install | Completed using the existing package cache |
| Shared information validator | Passed across 15 objects, 4 scenes, 22 cases and 89 evidence records |
| Navigator data and selection tests | 5 passed |
| Original runtime JSON SHA-256 | Exact match |
| Full research archive SHA-256 | Matches the original validation report |
| Production build at `/research/` | Passed |
| Desktop/mobile browser checks on that build | 18 passed; no JavaScript runtime errors |
| Moon and Mars iframe handoffs | Passed; cabin settings preserved on return |
| Generated orb video, reduced motion and failed-media fallback | Passed |

The browser checks cover command navigation, evidence selection, source links, JSON download, focus handling, keyboard shortcuts, responsive layout and deep links. The handoff tests confirm that a 30% oxygen scene setting does not change the published 21%/22% Ultem survival endpoints.

Vite reports a large initial JavaScript chunk: approximately 1.06 MB minified, 274 kB gzip. The full runtime research pack and current UI dependencies are bundled together. Splitting the research view for on-demand loading is a follow-up for the combined app, after its routing and layout are chosen.

Ethan's real Moon scene and Johnson's real Mars scene were not present in this checkout. The bridge was tested against the included host example. Final frame rate and camera behavior must be checked once those scenes are connected.

## Follow-up after Tony's kitchen upload

Tony's `main` commit `7d8ea73` was merged into the contribution branch. The existing `python -m backend check` passed for all four scenarios. The shared information validator and five navigator tests passed again, and 27 relative documentation links resolved. The proposed changes pass `git diff --check` against the updated `origin/main`.

The root README now links the contribution, and `REPO-INTEGRATION.md` describes the actual kitchen files. No kitchen renderer, physics, scenario data or release-builder code was changed in this follow-up. The runtime connection between that scene and the navigator is still a separate integration step.

Reproduction commands and optional browser tooling are in [navigator/README.md](navigator/README.md). Browser images and recordings are generated locally in the ignored `navigator/qa` directory.
