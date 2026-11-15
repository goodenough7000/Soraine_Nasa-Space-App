// Drives the JavaScript build and the Rust build with the same steps and
// compares what each shows after every step: the view, the dialog, the address,
// the navigation state and the toast. The 3D canvases are left out.
//   SORAINE_JS_URL=http://127.0.0.1:4335 SORAINE_RUST_URL=http://127.0.0.1:4336 node tools/compare-sites.mjs
import assert from 'node:assert/strict';
import {dirname, resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
let playwright;
try { playwright = await import('playwright'); }
catch { playwright = await import(pathToFileURL(resolve(dirname(process.execPath), '../node_modules/playwright/index.mjs'))); }
const bases = {js: process.env.SORAINE_JS_URL || 'http://127.0.0.1:4335', rust: process.env.SORAINE_RUST_URL || 'http://127.0.0.1:4336'};
const browser = await playwright.chromium.launch({channel: 'chrome', headless: true});
const pages = {};
const errors = {js: [], rust: []};
for (const side of ['js', 'rust']) {
  pages[side] = await browser.newPage({viewport: {width: 1280, height: 900}, reducedMotion: 'reduce', acceptDownloads: true});
  pages[side].on('pageerror', error => errors[side].push(error.message));
  pages[side].setDefaultTimeout(5000);
}
const snapshot = page => page.evaluate(() => {
  const clean = element => {
    const copy = element.cloneNode(true);
    copy.querySelectorAll('canvas, [data-globe-status]').forEach(node => node.remove());
    for (const node of [copy, ...copy.querySelectorAll('*')]) for (const name of ['data-globe-state', 'data-globe-night', 'aria-busy', 'data-model-state', 'data-model-material', 'style', 'aria-describedby'])
      if (name !== 'style' || node.closest?.('#globe, .material-model') || node.matches?.('#globe, .material-model')) node.removeAttribute(name);
    return copy.innerHTML;
  };
  const dialog = document.querySelector('#detail-dialog');
  return {
    view: clean(document.querySelector('#view')), bodyView: document.body.dataset.view ?? null,
    address: location.pathname + location.search + location.hash,
    dialog: dialog.open ? clean(document.querySelector('#detail-content')) : null,
    nav: [...document.querySelectorAll('[data-view]')].map(b => [b.dataset.view, b.classList.contains('active'), b.getAttribute('aria-current')].join(':')).join(' '),
    header: document.querySelector('.connection').innerHTML + ' | ' + document.querySelector('#snapshot-date').textContent.replace(/\d\d:\d\d UTC/, 'HH:MM UTC').replace(/\d\d \w+ \d{4}/, 'DATE'),
    toast: document.querySelector('#toast').textContent, focus: document.activeElement?.id || document.activeElement?.tagName,
  };
});
const steps = [
  ['open the overview', p => p.goto('/')],
  ['choose the Moon', p => p.click('[data-world="Moon"]')],
  ['choose Mylar G', p => p.click('[data-material="Mylar G"]')],
  ['open a chart row source', p => p.locator('.limit-row').nth(1).click().catch(() => {})],
  ['close the dialog', p => p.keyboard.press('Escape')],
  ['go to compare', p => p.click('.main-nav [data-view="compare"]')],
  ['choose Nomex in compare', p => p.click('[data-material="Nomex HT90-40"]')],
  ['export the comparison', p => p.click('#export-comparison')],
  ['go to evidence', p => p.click('.main-nav [data-view="evidence"]')],
  ['search evidence', p => p.fill('#record-search', 'flame')],
  ['filter by Moon', p => p.selectOption('#world-filter', 'Moon')],
  ['filter by fitted results', p => p.selectOption('#kind-filter', 'reported_fit_to_experimental_data')],
  ['reset filters', p => p.click('#clear-filters')],
  ['next evidence page', p => p.click('[data-page="1"]')],
  ['open a record', p => p.locator('tr[data-record]').nth(2).click()],
  ['close with the button', p => p.click('.dialog-close')],
  ['open a record with the keyboard', async p => { await p.locator('tr[data-record]').first().focus(); await p.keyboard.press('Enter'); }],
  ['download the record', p => p.click('[data-download-record]')],
  ['close the dialog again', p => p.keyboard.press('Escape')],
  ['go to sources', p => p.click('.main-nav [data-view="sources"]')],
  ['search sources', p => p.fill('#source-search', 'saffire')],
  ['next source page', p => p.click('[data-source-page="1"]').catch(() => {})],
  ['open a source', p => p.locator('[data-source]').first().click()],
  ['close the source', p => p.keyboard.press('Escape')],
  ['clear the source search and pick a collection', async p => { await p.fill('#source-search', ''); await p.selectOption('#source-type', {index: 1}); }],
  ['open about', p => p.click('#about-btn')],
  ['close about', p => p.keyboard.press('Escape')],
  ['ask: compare Ultem Moon Mars', async p => { await p.fill('#global-search', 'compare Ultem Moon Mars'); await p.press('#global-search', 'Enter'); }],
  ['ask: acrylic lunar', async p => { await p.fill('#global-search', 'acrylic lunar'); await p.press('#global-search', 'Enter'); }],
  ['ask: flame spread rate', async p => { await p.fill('#global-search', 'flame spread rate'); await p.press('#global-search', 'Enter'); }],
  ['ask: zero g', async p => { await p.fill('#global-search', 'zero g'); await p.press('#global-search', 'Enter'); }],
  ['browse all materials', p => p.click('[data-browse-materials]')],
  ['press slash to search', async p => { await p.locator('body').click({position: {x: 5, y: 5}}); await p.keyboard.press('/'); }],
  ['back to the overview', p => p.click('.brand')],
  ['shortcut: BASS-II records', p => p.click('[data-research-question="original BASS"]')],
  ['open a compare link', p => p.goto('/?world=mars&material=Nomex+HT90-40#compare')],
  ['open a record link', p => p.goto('/?record=E014&world=moon&material=Ultem+1000&q=moc#evidence')],
  ['open a sources link', p => p.goto('/?q=flame&collection=bogus#sources')],
];
const differences = [];
try {
  for (const [name, action] of steps) {
    const shown = {};
    for (const side of ['js', 'rust']) {
      const page = pages[side];
      const relative = {...page, goto: path => page.goto(bases[side] + path, {waitUntil: 'networkidle'})};
      for (const method of ['click', 'fill', 'selectOption', 'press', 'locator']) relative[method] = page[method].bind(page);
      relative.keyboard = page.keyboard;
      await action(relative);
      await page.waitForTimeout(name.includes('BASS') ? 1200 : 200);
      shown[side] = await snapshot(page);
    }
    for (const key of Object.keys(shown.js)) if (shown.js[key] !== shown.rust[key]) {
      const [a, b] = [String(shown.js[key]), String(shown.rust[key])];
      let at = 0; while (at < a.length && a[at] === b[at]) at++;
      differences.push(`${name} / ${key} at ${at}:\n    js:   ${JSON.stringify(a.slice(Math.max(0, at - 50), at + 70))}\n    rust: ${JSON.stringify(b.slice(Math.max(0, at - 50), at + 70))}`);
    }
  }
} finally { await browser.close(); }
if (differences.length) console.log(differences.slice(0, 8).join('\n'));
assert.deepEqual(errors, {js: [], rust: []});
assert.equal(differences.length, 0, `${differences.length} differences`);
console.log(`The Rust build showed the same page as the JavaScript build after each of ${steps.length} steps.`);
