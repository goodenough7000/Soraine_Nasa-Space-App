# SI assistance log

## Research and information layer

Hogan directed the research work and supplied the team's challenge notes, papers and contributor exports. Codex assisted with source reading, numerical extraction, source links, comparison of Hogan/Ethan/Tony datasets, normalization and the shared information schema. The merged archive retains the contributor records and review decisions. Scientific claims, experimental results and model estimates remain distinguishable.

Codex prepared the reusable JSON, lookup adapter, selection types, object information guide and concrete scene examples. Tests check source relationships, missing values, case selection and independence of illustrative cabin settings from published results.

## Dashboard prototype, 2026-11-14

Hogan selected the Jarvis direction and asked for a polished first interaction focused on Ultem Moon/Mars comparison. Codex implemented the React interface, assistant-ui local command runtime, Motion transitions, source-backed evidence dialog, keyboard interaction, exports and scene bridge. The guided commands do not call an external language model and do not predict fire behavior.

Hogan requested use of the Higgsfield unlimited allowance. Codex generated one Seedance 2.5 orb loop, inspected frames, crossfaded the seam and compressed the video. The local asset has a still-image reduced-motion mode and procedural fallback. Generation settings and job details are included under `navigator/design`. No paid-credit option was selected for this generation.

The original prototype was checked with data tests, a production build and isolated desktop/mobile browser tests, including motion, media fallback, keyboard controls, evidence download and both scene handoffs. Its detailed development record is in [navigator/SI-LOG.md](navigator/SI-LOG.md).

## GitHub consolidation, 2026-11-14

Hogan requested a pull request to combine this work with Ethan's scenes and Tony's design document. Codex gathered the finished navigator, shared information pack, complete research archive, source attribution, visual handoff and integration instructions under `contributions/hogan`.

The navigator now imports the shared research directory instead of carrying a second runtime JSON and adapter. Subpath-aware media URLs and a configurable Vite base support hosting the navigator at `/research/`. The team repository's root app configuration and scene modules are outside this contribution.

The original data files are retained unchanged. Local authentication details, Myco setup, downloaded reference artwork, dependency folders, old dashboard UI and generated build outputs are excluded. This contribution records SI assistance for the files it contains; teammates retain their own work logs.

The clean checkout passed the shared information validator, five navigator tests and a production build at `/research/`. Eighteen desktop/mobile browser checks passed with no runtime errors. Both scene handoffs and video/poster/procedural fallback checks passed. The shared TypeScript panel contract was completed with the material and selected/comparison case fields already returned by the adapter. See [VALIDATION.md](VALIDATION.md) for the tested scope and build-size limitation.

Hogan then asked which database the data needs. Codex measured the actual runtime pack and added a recommendation to keep JSON for the current demo, with SQLite as a possible later query layer. The explanation uses the official SQLite and Apache Hadoop documentation and distinguishes the curated pack from NASA's full raw archive.

Hogan also asked about Google BigQuery. Codex added its role as a possible future shared analytics backend, using Google's official overview and sandbox documentation. No Google Cloud resources or billing were configured.

## Repository upload review and section, 2026-11-14

Hogan asked Codex to review Tony's uploaded repository and give this contribution a clear section. Codex fetched `main` at `7d8ea73`, read the kitchen entry point, scenario and panel logic, props, data contracts and release builder, then merged that upstream commit into the contribution branch without conflicts.

Codex added the root README's “Hogan: Research & Dashboard” section and a repository-specific integration guide. The guide identifies the existing detail-panel integration point, maps `iss` to `microgravity`, separates acceleration units from nominal gravity, and explains the release allowlist and same-origin iframe requirement. Tony's scene code and configuration were preserved. His separate design Markdown was not present in the reviewed commit.

Validation after the update: the existing backend contract check passed for four scenarios, the shared information validator and five navigator tests passed, all 27 relative documentation links resolved, and the proposed diff passed whitespace checks against the updated upstream branch.
