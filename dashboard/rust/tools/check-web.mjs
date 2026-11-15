// Loads the WebAssembly build in headless Chrome and checks that it returns
// what golden.json (the JavaScript reference) expects.
//   sh tools/build-web.sh && node tools/check-web.mjs      (needs Playwright and Chrome)
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {dirname, extname, join, resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
let playwright;
try { playwright = await import('playwright'); }
catch { playwright = await import(pathToFileURL(resolve(dirname(process.execPath), '../node_modules/playwright/index.mjs'))); }
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');   // dashboard/
const types = {'.js': 'text/javascript', '.mjs': 'text/javascript', '.wasm': 'application/wasm', '.json': 'application/json', '.html': 'text/html'};
const server = createServer(async (request, response) => {
  const path = resolve(join(root, decodeURIComponent(new URL(request.url, 'http://x').pathname)));
  if (request.url === '/') { response.writeHead(200, {'content-type': 'text/html'}).end('<!doctype html><title>soraine-web check</title>'); return; }
  if (!path.startsWith(root)) { response.writeHead(403).end(); return; }
  let body;
  try { body = await readFile(path); } catch { response.writeHead(404).end(); return; }
  response.writeHead(200, {'content-type': types[extname(path)] || 'application/octet-stream'}).end(body);
}).listen(0, '127.0.0.1');
await new Promise(done => server.once('listening', done));
const base = `http://127.0.0.1:${server.address().port}`;
const golden = JSON.parse(await readFile(join(root, 'rust/soraine-core/tests/golden.json'), 'utf8'));
const browser = await playwright.chromium.launch({channel: 'chrome', headless: true});
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(base);
  const actual = await page.evaluate(async golden => {
    const wasm = await import('/rust/pkg/soraine_web.js');
    await wasm.default();
    const research = new wasm.Research(await (await fetch('/dist/data/research.json')).text());
    const text = value => value || null;
    return {
      rowCount: research.rowCount,
      limits: golden.limits.map(([material, world]) => [material, world, ...research.limitIds(material, world).map(text)]),
      filters: golden.filters.map(({filter}) => research.filterIds(filter.query ?? '', filter.world ?? 'All', filter.material ?? 'All', filter.kind ?? 'All')),
      csv: research.csv(),
      reading: golden.reading.map(([material, world]) => [material, world, research.readingSummary(material, world)]),
      context: golden.context.map(([material]) => [material, wasm.comparisonContext(material)]),
      sourceOrder: research.sourceOrder(),
      links: golden.links.map(({args, base}) => { try { return wasm.researchUrl(args.world, args.material, args.view, args.record, base ?? undefined); } catch (error) { return {error: error.message}; } }),
      views: golden.views.map(view => ({overview: research.overviewHtml(view.material, view.world, view.specimenInstance), chartPanel: research.chartPanelHtml(view.material, view.world, false), chartPanelLarge: research.chartPanelHtml(view.material, view.world, true)})),
      compares: golden.compares.map(c => research.compareHtml(c.material, c.world)),
      evidence: golden.evidenceCases.map(c => { const f = c.filter, args = [f.query ?? '', f.world ?? 'All', f.material ?? 'All', f.kind ?? 'All']; return [research.evidenceHtml(...args), research.evidenceResultsHtml(...args, c.page)]; }),
      sources: golden.sourceCases.map(c => [research.sourceViewHtml(c.query, c.type), research.sourceResultsHtml(c.query, c.type, c.page)]),
      records: golden.recordDialogs.map(([id]) => research.recordDialogHtml(id)),
      sourceDialogs: golden.sourceDialogs.map(([id]) => research.sourceDialogHtml(id)),
      about: research.aboutDialogHtml(),
      unknownRecord: research.recordDialogHtml('nope') ?? null,
      numbers: golden.numbers.map(([value, digits]) => wasm.formatNumber(value ?? undefined, digits ?? undefined)),
    };
  }, golden);
  assert.deepEqual(errors, []);
  assert.equal(actual.rowCount, golden.rowCount);
  assert.deepEqual(actual.limits, golden.limits);
  assert.deepEqual(actual.filters, golden.filters.map(f => f.ids));
  assert.equal(actual.csv, golden.csv);
  assert.deepEqual(actual.reading, golden.reading);
  assert.deepEqual(actual.context, golden.context);
  assert.deepEqual(actual.sourceOrder, golden.sources);
  assert.deepEqual(actual.links, golden.links.map(link => link.out ?? {error: link.error}));
  assert.deepEqual(actual.numbers, golden.numbers.map(n => n[2]));
  assert.deepEqual(actual.views, golden.views.map(view => ({overview: view.overview, chartPanel: view.chartPanel, chartPanelLarge: view.chartPanelLarge})));
  assert.deepEqual(actual.compares, golden.compares.map(c => c.html));
  assert.deepEqual(actual.evidence, golden.evidenceCases.map(c => [c.frame, c.results]));
  assert.deepEqual(actual.sources, golden.sourceCases.map(c => [c.frame, c.results]));
  assert.deepEqual(actual.records, golden.recordDialogs.map(d => d[1]));
  assert.deepEqual(actual.sourceDialogs, golden.sourceDialogs.map(d => d[1]));
  assert.equal(actual.about, golden.aboutDialogs[0].html);
  assert.equal(actual.unknownRecord, null);
  console.log(`WebAssembly build matches the JavaScript reference in Chrome: ${actual.rowCount} results, ${actual.filters.length} filters, ${actual.sourceOrder.length} sources, ${actual.links.length} links, ${actual.numbers.length} numbers, ${actual.views.length} overview and chart views, ${actual.compares.length} compare views, ${actual.evidence.length} evidence states, ${actual.sources.length} source states, ${actual.records.length + actual.sourceDialogs.length + 1} dialogs.`);
} finally { await browser.close(); server.close(); }
