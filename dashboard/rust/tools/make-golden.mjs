// Writes soraine-core/tests/golden.json: what the current JavaScript modules
// return for the published data. The Rust port must reproduce it exactly.
//   node tools/make-golden.mjs      (run from dashboard/rust)
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {MATERIALS, WORLDS, TYPES, joinResearch, getLimits, filterRows, csv, comparisonRows, number, esc, safeUrl} from '../../dist/data.mjs';
import {sourcesByResults, originalFilesByRelevance} from '../../dist/discovery.mjs';
import {readingSummary, comparisonContext} from '../../dist/reading.mjs';
import {researchUrl} from '../../dist/scene-link.mjs';
import {specimenHTML} from '../../dist/specimen.mjs';
import {definitions, term} from '../../dist/glossary.mjs';
import {loadApp} from './load-app.mjs';
const read = async path => JSON.parse((await readFile(new URL(path, import.meta.url), 'utf8')).replace(/^﻿/, ''));
const bundle = await read('../../dist/data/research.json'), original = await read('../../dist/data/original-data.json');
const rows = joinResearch(bundle), id = r => r?.measurement_id ?? null;
const filters = [{}, {query: 'Ultem Moon MOC'}, {query: '  MOON   uloi* '}, {query: 'ntrs'}, {query: 'kPa'}, {query: '21'}, {query: 'published limit'}, {query: 'zzz'}, {query: 'NOMEX'},
  ...WORLDS.flatMap(world => ['All', ...MATERIALS].map(material => ({world, material}))), ...Object.keys(TYPES).map(kind => ({kind})),
  {world: 'Moon', material: 'Ultem 1000', kind: 'reported_experimental_limit_aggregate'}, {world: 'Moon', kind: 'model_derived_compensation_from_experiments'}, {world: 'Venus'}];
const links = [[{}], [{world: 'Lunar', material: 'Nomex HT90-40', record: 'E014', view: 'evidence'}], [{world: 'Mars'}, 'http://localhost:5180/dashboard/dist/?old=1#overview'],
  [{world: 'ISS', material: 'Mylar G', view: 'sources'}], [{world: 'MARTIAN', view: 'experiments', record: 'E1234'}], [{world: 'venus'}], [{material: 'spoon'}], [{view: 'admin'}],
  [{record: '<script>'}], [{record: 'E01'}], [{record: 'E014 '}], [{}, 'javascript:alert(1)'], [{}, 'not a url'], [{world: 'moon'}, 'https://example.org/a b/?x=1']];
const numbers = [[null], [''], ['0'], ['0.000016', 6], ['1234567.891'], ['1234567.891', 2], ['2.5', 0], ['1.5', 0], ['0.5', 0], ['0.05'], ['-0.04'], ['-1234.5', 0], ['19.95'], ['1.005', 2],
  ['21.1'], ['999.95'], ['0.125', 2], ['abc'], ['1e21'], ['70.3'], [' 42 '], ['1.1000000000000014'], ['1000'], ['-0.06']];
const app = await loadApp(bundle);
const viewStates = MATERIALS.flatMap(material => WORLDS.map(world => ({material, world})));
const views = viewStates.map(({material, world}) => { Object.assign(app.state, {material, world}); const overview = app.overview(); return {material, world, materialPanel: app.materialPanel(), chart: app.chart(false), chartLarge: app.chart(true), chartPanel: app.chartPanel(false), chartPanelLarge: app.chartPanel(true), overview, specimenInstance: Number(/specimen-(\d+)/.exec(overview)[1])}; });
const compares = MATERIALS.flatMap(material => ['Earth', 'Moon'].map(world => { Object.assign(app.state, {material, world}); return {material, world, html: app.compare()}; }));
const evidenceFilters = [{}, {query: 'Ultem Moon MOC'}, {query: '<b> "x"'}, {world: 'Moon'}, {world: 'Earth-to-Moon model'}, {material: 'Nomex HT90-40', kind: 'reported_experimental_limit_aggregate'}, {kind: 'model_derived_compensation_from_experiments'}, {query: 'zzz'}, {world: 'Mars', material: 'Mylar G'}];
const evidenceCases = evidenceFilters.flatMap(filter => [0, 1, 5, 99].map(page => {
  Object.assign(app.state, {query: filter.query ?? '', filterWorld: filter.world ?? 'All', filterMaterial: filter.material ?? 'All', filterKind: filter.kind ?? 'All', page});
  const frame = app.evidence(); app.renderEvidenceRows();
  return {filter, page, frame, results: app.written('#evidence-results'), shownPage: app.state.page};
}));
const sourceTypes = ['All', ...new Set(bundle.sources.map(s => s.source_type))];
const sourceCases = ['', 'saffire', 'zzz', 'NTRS-2013', '  Flame ', '"<'].flatMap(query => sourceTypes.flatMap(type => [0, 3, 999].map(page => {
  Object.assign(app.state, {sourceQuery: query, sourceType: type, sourcePage: page});
  const frame = app.sourceView(); app.renderSources();
  return {query, type, page, frame, results: app.written('#source-results'), shownPage: app.state.sourcePage};
})));
const dialog = () => app.written('#detail-content');
const recordDialogs = rows.map(r => { app.openRecord(r.measurement_id); return [r.measurement_id, dialog()]; });
const dialogSources = [...new Set([...bundle.evidence.map(e => e.source_id), ...bundle.sources.slice(0, 12).map(s => s.source_id)])];
const sourceDialogs = dialogSources.map(id => { app.openSource(id); return [id, dialog()]; });
const aboutDialogs = [[undefined, bundle.exportedAt], ['bigquery', '2026-11-15T00:00:00.000Z'], ['cached-stale', '2026-01-02T23:59:59.999Z'], ['snapshot', '2026-11-15T12:05:09Z'], ['bigquery', 'nonsense']].map(([mode, exportedAt]) => {
  const next = {...bundle, exportedAt, ...(mode ? {delivery: {mode}} : {})};
  app.setData(next); app.showAbout();
  return {mode: mode ?? null, exportedAt, html: dialog()};
});
app.setData(bundle);
const defaults = {...app.state, view: 'overview', world: 'Earth', material: 'Ultem 1000', query: '', filterWorld: 'All', filterMaterial: 'All', filterKind: 'All', page: 0, sourceQuery: '', sourceType: 'All', sourcePage: 0, originalDataset: '', originalQuery: ''};
const reset = (changes = {}) => { for (const key of Object.keys(app.state)) delete app.state[key]; Object.assign(app.state, defaults, changes); };
const urlStates = [{}, {view: 'compare', world: 'Moon', material: 'Mylar G'}, {view: 'overview', world: 'Microgravity', material: 'Nomex HT90-40'},
  {view: 'evidence'}, {view: 'evidence', query: 'Ultem & "Moon"', filterWorld: 'Earth-to-Moon model', filterMaterial: 'P 213', filterKind: 'reported_fit_to_experimental_data'},
  {view: 'experiments'}, {view: 'experiments', originalDataset: 'saffire-ii', originalQuery: 'cotton 100%'}, {view: 'sources'}, {view: 'sources', sourceQuery: 'flame spread', sourceType: 'nasa_ntrs'}];
const urlBases = ['https://soraine.vercel.app/', 'https://soraine.vercel.app/?world=moon&utm=x%20y&record=E014&q=old#compare', 'http://localhost:4335/dashboard/dist/index.html?keep=1&material=Mylar+G&dataset=bass#sources'];
const syncUrls = urlStates.flatMap(changes => urlBases.map(href => { reset(changes); globalThis.location.href = href; app.syncURL(); return {state: changes, href, out: globalThis.__replaced}; }));
const restores = [['', ''], ['?world=MOON&material=Mylar%20G', '#compare'], ['?world=iss', '#overview'], ['?world=venus&material=spoon', '#nope'],
  ['?world=mars&material=Nomex+HT90-40&q=flame+tip&kind=reported_fit_to_experimental_data', '#evidence'], ['?world=earth-to-moon%20model&material=PMMA&kind=bogus', '#evidence'], ['?material=P%20213&record=E014', '#evidence'],
  ['?dataset=saffire-ii&q=cotton', '#experiments'], ['?q=saffire&collection=' + encodeURIComponent(bundle.sources[0].source_type), '#sources'], ['?collection=bogus&record=E001', '#sources'], ['?record=E002', '']]
  .map(([search, hash]) => { reset(); Object.assign(globalThis.location, {search, hash}); const params = app.restoreURLState(); return {search, hash, state: {...app.state}, record: params.get('record')}; });
const searches = ['', '   ', 'compare Ultem Moon Mars', 'original BASS', 'show original saffire data', 'find raw csv records for cotton', 'Ultem on Moon', 'mylar', 'PET in orbit', 'nomex vs earth', 'acrylic lunar', 'p213',
  'PMMA mars and moon', 'zero g', '1 g', 'micro-g flames', 'ISS', 'flame spread rate', 'Ultem 1000 versus Mylar G', '  What about Kapton?  ', 'P 213 earth', 'martian', 'NOMEX HT90-40 comparison']
  .map(query => { reset({view: 'sources', world: 'Mars', material: 'Mylar G', page: 3}); globalThis.__navigated.length = 0; app.routeGlobalSearch(query); return {query, state: {...app.state}, navigated: [...globalThis.__navigated]}; });
reset();
const labels = ['2026-11-15T16:17:04.123Z', '2026-01-02T00:00:00.000Z', '2026-02-09T09:05:00Z', '2026-03-31T23:59:59.999Z', '2026-04-01T12:00:00Z', '2026-05-20T01:02:03Z', '2026-06-30T10:10:10Z', '2026-07-04T04:04:04Z', '2026-08-08T08:08:08Z', '2026-09-09T19:09:09Z', '2026-10-10T10:10:10Z', '2026-12-25T22:22:22Z']
  .flatMap(exportedAt => [undefined, 'bigquery', 'cached-stale'].map(mode => ({exportedAt, mode: mode ?? null,
    snapshot: (mode === 'bigquery' ? 'Refreshed ' : 'Snapshot ') + new Date(exportedAt).toLocaleDateString('en-GB', {day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC'}) + ' · ' + new Date(exportedAt).toISOString().slice(11, 16) + ' UTC',
    connection: mode === 'bigquery' ? 'BigQuery connected' : mode === 'cached-stale' ? 'BigQuery cached' : 'Saved snapshot'})));
const metricNames = [...new Set(rows.map(r => r.metric)), 'ULOI', 'unknown <metric>'].map(metric => [metric, app.metricName(metric)]);
const specimens = [];
let specimenCase = 0;
for (const material of [...MATERIALS, 'Kapton', `<b>&"x"'`, '']) for (const world of [...WORLDS, '']) {
  for (const [uloi, moc, recordId] of [[null, null, null], ['23.5', '23', 'E002'], [21, 19.9, ''], ['', 'abc', 'E014'], [35, -1, null], ['0.125', 30, '<E>'], [30.004, 0, 'E100'], [' 7.5 ', '29.999', undefined]]) {
    if (specimenCase++ % 3) continue;   // a spread of cases, not the full product
    const html = specimenHTML({material, world, uloi, moc, recordId});
    specimens.push({material, world, uloi, moc, recordId: recordId ?? null, instance: Number(/specimen-(\d+)/.exec(html)[1]), html});
  }
}
const golden = {
  rowCount: rows.length,
  joined: rows.map(r => [r.measurement_id, r.kind.name, r.kind.color, r.experiment?.experiment_id ?? null, r.source?.source_id ?? null]),
  limits: MATERIALS.flatMap(material => WORLDS.map(world => { const l = getLimits(rows, material, world); return [material, world, id(l.uloi), id(l.moc)]; })),
  comparison: MATERIALS.map(material => comparisonRows(rows, material).map(c => [c.world, id(c.uloi), id(c.moc)])),
  filters: filters.map(filter => ({filter, ids: filterRows(rows, filter).map(id)})),
  csv: csv(rows),
  reading: MATERIALS.flatMap(material => WORLDS.map(world => [material, world, readingSummary(rows, material, world)])),
  context: MATERIALS.map(material => [material, comparisonContext(material)]),
  sources: sourcesByResults(bundle.sources, bundle.measurements).map(s => s.source_id),
  files: originalFilesByRelevance(original.datasets).map(d => d.id),
  links: links.map(([args, base]) => { try { return {args, base: base ?? null, out: base ? researchUrl(args, base) : researchUrl(args)}; } catch (error) { return {args, base: base ?? null, error: error.message}; } }),
  specimens,
  icons: Object.entries(app.paths),
  iconMarkup: [...Object.keys(app.paths), 'missing'].map(name => [name, app.icon(name)]),
  worldInfo: app.worldInfo,
  helpers: {
    sampleText: ['10 mil PEI film', 'PET (PETG) and PMMA_x', 'SPEIGHT PEI-2 <PET>', 'pei', ''].map(v => [v, app.sampleText(v)]),
    materialDescription: [...MATERIALS, 'Kapton'].map(v => [v, app.materialDescription(v)]),
    unitLabel: ['O2 molar percent', 'O2 percentage points', 'cm/s', 'kPa', '<x>'].map(v => [v, app.unitLabel(v)]),
    fieldLabel: ['Test pressure', 'Oxygen', 'Airflow', 'Gravity category', 'A & B'].map(v => [v, app.fieldLabel(v)]),
    evidenceLabel: rows.map(r => [r.measurement_id, app.evidenceLabel(r)]),
  },
  views,
  compares,
  evidenceCases,
  sourceCases,
  metricNames,
  syncUrls,
  restores,
  searches,
  labels,
  recordDialogs,
  sourceDialogs,
  aboutDialogs,
  options: [['All', 'All evidence', 'All'], ['a"b', '<x>', 'c'], ['Moon', 'Moon', 'Moon']].map(args => [...args, app.option(...args)]),
  glossary: Object.entries(definitions).map(([key, d]) => [key, d.title, d.description]),
  terms: [...Object.keys(definitions), 'not a term', '<b>'].flatMap(key => [[key, key, false, term(key)], [key, `${key} & "label"`, false, term(key, `${key} & "label"`)], [key, 'in a button', true, term(key, 'in a button', {passive: true})]]),
  numbers: numbers.map(([value, digits]) => [value, digits ?? null, digits === undefined ? number(value) : number(value, digits)]),
  esc: ['', 'plain', `<a href="x">Tom & 'Jerry'</a>`, 'é ✓ 月'].map(s => [s, esc(s)]),
  safeUrl: ['https://ntrs.nasa.gov/citations/20130010991', 'http://example.org/a b', 'javascript:alert(1)', 'data:text/html,x', 'ftp://example.org/', '/relative', '', 'HTTPS://EXAMPLE.org'].map(s => [s, safeUrl(s)]),
};
await writeFile(new URL('../soraine-core/tests/golden.json', import.meta.url), JSON.stringify(golden, null, 1) + '\n');
console.log('golden.json:', rows.length, 'rows,', golden.filters.length, 'filters,', golden.links.length, 'links,', golden.sources.length, 'sources');
