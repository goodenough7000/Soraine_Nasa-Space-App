# Dashboard update, November 15

The dashboard keeps its blue theme, planetary and material models, research routes and cited measurements. Overview now focuses on one environment and specimen. Compare owns the gravity comparison; Original data owns NASA CSV records; Evidence provides the paper-result index; Sources provides the bibliography.

## Interface files

- `dist/app.mjs`: compact comparison rows, interpretation text, distinct page contents and source ordering.
- `dist/index.html`: stylesheets, shorter research shortcuts and accessible navigation labels.
- `dist/research-flow.css`: scrolling layout, compact chart and responsive model placement.
- `dist/layout-polish.css`: wrapping header, larger typography, translucent surfaces, subtle planet textures and phone/tablet layouts.
- `dist/discovery.mjs`: source result-count sorting and explicit source-file relevance ordering.
- `dist/reading.mjs`: material-specific comparison wording with the original scientific qualifications.
- `dist/original-data.mjs`: source-file explanations, relevance ordering and coverage wording.
- `dist/globe.mjs`: coalesced drag rendering, smaller mobile drawing buffers and a rendering pause during phone scrolling.
- `dist/material-model.mjs`: smaller mobile drawing buffers, scrolling pause and smoother zoom scheduling.

The existing canvas geometry, scientific measurement values, query/hash routes and citation targets remain intact. Planet textures behind comparison rows are decorative. Graph points are reported endpoints, not predictions or a continuous gravity response curve.

## Original NASA data

Four source files were downloaded directly from NASA PSI, retaining their bytes and SHA-256 checksums in `source-data/`. The additive BigQuery transaction inserted 237 rows and verified that every existing row was unchanged. The public collection now contains 381 rows in six files:

| File | Source rows | Contents |
| --- | ---: | --- |
| BASS | 122 | Run identifiers and fuel materials |
| BASS-II | 129 | Run records and recorded gas concentrations |
| Saffire-I | 4 | Two test configurations with burn times, plus two pre-test references |
| Saffire-II | 15 | Material records, notes and pre-test references |
| Saffire-III | 2 | Test geometry, airflow and camera references |
| SAME-R | 109 | Smoke-test sample, flow, duration and aging conditions |

These row counts are not counts of independent experiments. Missing cells remain blank, and approximate values remain approximate. Published paper results remain a separate, labelled collection in the same BigQuery dataset.

Additional changed files: `dist/data/original-data.json`, `server/original-data.mjs`, `.gitignore`, `scripts/publish-original-data.sql`, `scripts/extend-original-data.sql`, `scripts/fetch-nasa-csv.mjs`, `scripts/import-nasa-csv.py`, `source-data/manifest.json`, `source-data/bigquery-schema.json`, the four source CSVs, `test/http.test.mjs`, `test/original-data.test.mjs`, `test/discovery.test.mjs`, `test/reading.test.mjs`, `test/browser.mjs`, `README.md`, `TEAM-HANDOFF.md`, `SI-LOG.md` and this report.

## Verification

- 31 automated tests passed, including source-string preservation, missing values, provenance, API contracts and sorting.
- All five views checked at widths 320, 390, 768 and 1280 pixels without horizontal page overflow.
- Original record values render at 16 px; research table text at 15 px or larger; chart numbers at 20–26 px.
- Checked visible translucent chart surfaces, source ordering and the Moon result's source drawer.
- The deployed API returned `delivery.mode = bigquery`; its six datasets matched the local source bundle exactly.
- Browser viewport checks do not establish frame-rate performance on Hogan's physical phone. The in-app browser could not synthesize touch swipes, so real-device gesture validation remains separate from the completed layout checks.

No teammate game, physics branch, model asset or pending merge was changed.
