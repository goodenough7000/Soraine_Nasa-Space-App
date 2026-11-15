import {originalFilesByRelevance} from './discovery.mjs';
const PAGE_SIZE = 20;
const datasetNotes = {
  'bass': 'A run log linking dates, test numbers, samples and fuel materials. This file does not report oxygen limits or flame-spread rates.',
  'bass-ii': 'Source test records with material, sample geometry and recorded test conditions. Read the original headings and notes before comparing runs.',
  'same-r': 'Smoke-test conditions: sample type, inlet velocity, duration and aging times. These are not detector sensitivity or fire-risk scores.',
  'saffire-i': 'SIBAL sample dimensions, airflow, oxygen settings, ignition power and recorded burn times. Two additional rows identify pre-test flow recordings.',
  'saffire-ii': 'Material-test records plus source notes and pre-test references. Notes are retained alongside the test rows.',
  'saffire-iii': 'Two SIBAL test configurations with dimensions, airflow direction and camera references. This table does not report burn times or oxygen limits.'
};
const mounts = new WeakMap();
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[character]);
const text = value => String(value ?? '');
const formatCount = value => Number(value).toLocaleString('en-US');
const sourceUrl = value => {
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) ? url.href : null;
  } catch { return null; }
};
const arrow = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 17 7M7 7h10v10"/></svg>';

export function originalDataHTML() {
  return `<section class="originals" data-original-data aria-labelledby="originals-title">
    <header class="originals-heading"><div><p class="originals-eyebrow">THE EXPERIMENT ARCHIVE</p><h2 id="originals-title">Original NASA records.</h2></div><p>Selected NASA experiment files, copied into BigQuery with their original values and notes. This is a focused collection, not the entire PSI archive.</p></header>
    <div class="originals-loading" role="status"><span aria-hidden="true"></span>Opening the experiment files…</div>
  </section>`;
}

function validBundle(bundle) {
  return bundle && Array.isArray(bundle.datasets) && bundle.datasets.every(dataset =>
    dataset && Array.isArray(dataset.columns) && Array.isArray(dataset.rows)
    && dataset.rows.every(row => row && Array.isArray(row.cells)));
}

async function getBundle(url, signal) {
  const response = await fetch(url, { signal, headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`The experiment files returned HTTP ${response.status}.`);
  const bundle = await response.json();
  if (!validBundle(bundle)) throw new Error('The experiment files could not be read.');
  return bundle;
}

/** Call only when the experiments view is opened. The returned function disposes it. */
export async function mountOriginalData(host, { datasetId = '', query = '', onStateChange } = {}) {
  const root = host?.matches?.('[data-original-data]') ? host : host?.querySelector?.('[data-original-data]');
  if (!root) return () => {};
  mounts.get(root)?.();
  const controller = new AbortController();
  let active = true;
  let timeout;
  let requestController;
  let observer;
  const dispose = () => {
    active = false;
    controller.abort();
    requestController?.abort();
    window.clearTimeout(timeout);
    observer?.disconnect();
    if (mounts.get(root) === dispose) mounts.delete(root);
  };
  mounts.set(root, dispose);
  const current = () => active && root.isConnected && mounts.get(root) === dispose;
  // Leaving the view also aborts a request that has not yet returned its cleanup.
  observer = new MutationObserver(() => { if (!root.isConnected) dispose(); });
  if (root.parentNode) observer.observe(root.parentNode, { childList: true });

  async function load() {
    requestController = new AbortController();
    const abort = () => requestController.abort();
    controller.signal.addEventListener('abort', abort, { once: true });
    timeout = window.setTimeout(abort, 15_000);
    let bundle;
    let fallback = false;
    try {
      try { bundle = await getBundle('./api/original-data', requestController.signal); }
      catch {
        if (!current()) return;
        window.clearTimeout(timeout);
        requestController = new AbortController();
        timeout = window.setTimeout(() => requestController.abort(), 15_000);
        bundle = await getBundle('./data/original-data.json', requestController.signal);
        fallback = true;
      }
      if (!current()) return;
      renderExplorer(bundle, fallback);
    } catch {
      if (!current()) return;
      root.innerHTML = `${originalDataHTMLHeader()}<div class="originals-empty" role="status"><h3>The experiment files could not be opened.</h3><p>Try loading the source records again.</p><button type="button" data-original-action="retry">Try again ${arrow}</button></div>`;
    } finally {
      window.clearTimeout(timeout);
      controller.signal.removeEventListener('abort', abort);
    }
  }

  function originalDataHTMLHeader() {
    return '<header class="originals-heading"><div><p class="originals-eyebrow">THE EXPERIMENT ARCHIVE</p><h2 id="originals-title">Original NASA records.</h2></div><p>Selected NASA experiment files, copied into BigQuery with their original values and notes. This is a focused collection, not the entire PSI archive.</p></header>';
  }

  let state;
  let datasets;
  let indexed;
  let nodes;

  function publishState() {
    if (current() && typeof onStateChange === 'function') {
      onStateChange({ datasetId: datasets[state.dataset].id, query: state.query });
    }
  }

  function renderExplorer(bundle, fallback) {
    datasets = originalFilesByRelevance(bundle.datasets);
    if (!datasets.length) {
      root.innerHTML = `${originalDataHTMLHeader()}<div class="originals-empty"><h3>No experiment files are available yet.</h3><p>The source archive will appear here when its files are available.</p></div>`;
      return;
    }
    indexed = datasets.map(dataset => dataset.rows.map((row, index) => ({
      ...row,
      index,
      searchable: [row.csvRecordNumber, ...row.cells].map(text).join('\n').toLocaleLowerCase()
    })));
    const datasetIndex = Math.max(0, datasets.findIndex(dataset => dataset.id === datasetId));
    state = { dataset: datasetIndex, query: text(query), page: 0, selected: 0, table: false };
    const deliveryMode = bundle.delivery?.mode;
    const deliveryText = fallback || !deliveryMode || deliveryMode === 'snapshot'
      ? 'Saved source-file snapshot'
      : deliveryMode === 'cached-stale' ? 'Last successful BigQuery copy'
      : deliveryMode === 'bigquery' ? 'Source records read from BigQuery'
      : deliveryMode === 'cached' ? 'Cached BigQuery source records'
      : 'Saved source-file snapshot';
    root.innerHTML = `${originalDataHTMLHeader()}
      <div class="originals-toolbar">
        <label class="originals-file-label">EXPERIMENT FILE<select data-original-input="dataset" aria-label="Choose an experiment CSV file">${datasets.map((dataset, index) => `<option value="${index}">${escapeHtml(dataset.title || dataset.id || `File ${index + 1}`)}</option>`).join('')}</select></label>
        <label class="originals-search"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg><input type="search" data-original-input="search" placeholder="Search every original value…" aria-label="Search within this CSV file" autocomplete="off"></label>
        <button type="button" class="originals-table-toggle" data-original-action="table" aria-pressed="false">Raw table</button>
      </div>
      <div class="originals-dataset-heading"><div><h3 data-original-title></h3><p data-original-count></p></div><div data-original-source></div></div>
      <p class="originals-explanation">Measurement-rich files first, then smoke-test conditions, configurations and run logs. Source row order is unchanged. A row count is not a count of experiments.</p>
      <p class="originals-explanation" data-original-purpose></p>
      <div class="originals-results-bar"><p data-original-status role="status" aria-live="polite"></p><span data-original-mode>RECORD EXPLORER</span></div>
      <div data-original-browser></div>
      <div class="originals-pagination"><button type="button" data-original-action="previous" aria-label="Previous 20 CSV rows">← Previous</button><span data-original-page></span><button type="button" data-original-action="next" aria-label="Next 20 CSV rows">Next →</button></div>
      <details class="originals-provenance"><summary>Source & provenance <span aria-hidden="true">+</span></summary><div data-original-provenance></div></details>
      <p class="originals-footnote">${escapeHtml(deliveryText)}. Blank cells appear as “Not recorded” here. The original CSV keeps its blank cells and exact text.</p>`;
    nodes = {
      title: root.querySelector('[data-original-title]'),
      count: root.querySelector('[data-original-count]'),
      source: root.querySelector('[data-original-source]'),
      status: root.querySelector('[data-original-status]'),
      browser: root.querySelector('[data-original-browser]'),
      page: root.querySelector('[data-original-page]'),
      mode: root.querySelector('[data-original-mode]'),
      provenance: root.querySelector('[data-original-provenance]')
    };
    root.querySelector('[data-original-input="dataset"]').value = String(state.dataset);
    root.querySelector('[data-original-input="search"]').value = state.query;
    renderDataset(bundle);
    publishState();
  }

  let archiveBundle;
  function renderDataset(bundle = archiveBundle) {
    archiveBundle = bundle;
    const dataset = datasets[state.dataset];
    root.querySelector('[data-original-purpose]').textContent = datasetNotes[dataset.id] || '';
    nodes.title.textContent = dataset.title || dataset.id || 'Experiment file';
    nodes.count.textContent = `${formatCount(dataset.rows.length)} CSV rows · ${formatCount(dataset.columns.length)} source columns`;
    const url = sourceUrl(dataset.sourceUrl);
    let linkLabel = 'Open source CSV';
    if (url && /(^|\.)nasa\.gov$/i.test(new URL(url).hostname)) linkLabel = 'Open original NASA CSV';
    nodes.source.innerHTML = url ? `<a class="originals-source-link" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${linkLabel} ${arrow}</a>` : '';
    nodes.provenance.innerHTML = `<dl>
      <div><dt>Source identifier</dt><dd>${escapeHtml(dataset.sourceId || dataset.id || 'Not supplied')}</dd></div>
      <div><dt>Original file</dt><dd>${url ? `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(url)}</a>` : 'Not supplied'}</dd></div>
      <div><dt>Source SHA-256</dt><dd><code>${escapeHtml(dataset.sha256 || 'Not supplied')}</code></dd></div>
      <div><dt>Snapshot timestamp</dt><dd>${escapeHtml(bundle.exportedAt || 'Not supplied')}</dd></div>
    </dl><p>The checksum identifies the source file. Record values are shown as text, with their original column headings. No missing values are filled in.</p>`;
    renderRecords();
  }

  function filteredRows() {
    const terms = state.query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
    return indexed[state.dataset].filter(row => terms.every(query => row.searchable.includes(query)));
  }

  const cellHTML = value => text(value) === '' ? '<span class="originals-blank">Not recorded</span>' : escapeHtml(value);
  const rowNumber = row => row.csvRecordNumber ?? row.index + 1;
  const columnLabel = (columns, index) => text(columns[index]) || `Column ${index + 1} (no source header)`;
  const isSourceNote = row => row.rowKind === 'source_note' || row.rowKind === 'note';
  const rowKindLabel = row => isSourceNote(row) ? 'Source note' : row.rowKind === 'pretest_reference' ? 'Pre-test reference' : '';
  function previewText(row, columns) {
    // These are existing source headers, not inferred measurements or new labels.
    const priorities = ['Test #', 'Sample Number', 'Fuel Sample Material', 'Material', 'Date'];
    const indices = priorities.map(label => columns.findIndex(column => text(column).trim() === label)).filter(index => index >= 0);
    const selected = indices.map(index => text(row.cells[index])).filter(value => value !== '');
    return (selected.length ? selected : row.cells.map(text).filter(value => value !== '')).slice(0, 3).join(' · ');
  }

  function renderRecords() {
    const dataset = datasets[state.dataset];
    const results = filteredRows();
    const pages = Math.max(1, Math.ceil(results.length / PAGE_SIZE));
    state.page = Math.max(0, Math.min(state.page, pages - 1));
    const start = state.page * PAGE_SIZE;
    const visible = results.slice(start, start + PAGE_SIZE);
    if (!visible.some(row => row.index === state.selected)) state.selected = visible[0]?.index ?? -1;
    nodes.status.textContent = results.length
      ? `${start + 1}–${Math.min(start + PAGE_SIZE, results.length)} of ${formatCount(results.length)} ${state.query.trim() ? 'matching ' : ''}CSV rows`
      : 'No CSV rows match this search.';
    nodes.page.textContent = `Page ${state.page + 1} of ${pages}`;
    root.querySelector('[data-original-action="previous"]').disabled = state.page === 0;
    root.querySelector('[data-original-action="next"]').disabled = state.page >= pages - 1;
    root.querySelector('[data-original-action="table"]').setAttribute('aria-pressed', String(state.table));
    root.querySelector('[data-original-action="table"]').textContent = state.table ? 'Record explorer' : 'Raw table';
    nodes.mode.textContent = state.table ? 'ORIGINAL COLUMNS' : 'RECORD EXPLORER';
    if (!visible.length) {
      nodes.browser.innerHTML = '<div class="originals-empty"><h3>No matching source values.</h3><p>Try a shorter search or choose another experiment file.</p><button type="button" data-original-action="clear">Clear search</button></div>';
      return;
    }
    if (state.table) {
      const width = Math.max(dataset.columns.length, ...visible.map(row => row.cells.length));
      nodes.browser.innerHTML = `<div class="originals-table-scroll" tabindex="0" role="region" aria-label="Original CSV values. Scroll horizontally for more columns."><table class="originals-table"><caption>${escapeHtml(dataset.title || dataset.id)} · original CSV values</caption><thead><tr><th scope="col">CSV record</th>${Array.from({ length: width }, (_, index) => `<th scope="col">${escapeHtml(columnLabel(dataset.columns, index))}</th>`).join('')}</tr></thead><tbody>${visible.map(row => `<tr><th scope="row"><button type="button" data-original-action="inspect" data-original-row="${row.index}" aria-label="Inspect CSV record ${escapeHtml(rowNumber(row))}">${escapeHtml(rowNumber(row))} ↗</button></th>${Array.from({ length: width }, (_, index) => `<td>${cellHTML(row.cells[index])}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
      return;
    }
    nodes.browser.innerHTML = `<div class="originals-record-layout"><nav class="originals-record-nav" aria-label="Choose a CSV record"><ol>${visible.map(row => {
      const preview = previewText(row, dataset.columns);
      return `<li><button type="button" class="originals-record-button" data-original-action="row" data-original-row="${row.index}"${row.index === state.selected ? ' aria-current="true"' : ''}><span class="originals-record-number">Record ${escapeHtml(rowNumber(row))}${rowKindLabel(row) ? `<small>${rowKindLabel(row)}</small>` : ''}<span aria-hidden="true">↗</span></span><span class="originals-record-preview">${escapeHtml(preview || 'Blank source record')}</span></button></li>`;
    }).join('')}</ol></nav><section class="originals-detail" data-original-detail aria-label="Selected original CSV record"></section></div>`;
    renderDetail();
  }

  function renderDetail() {
    const dataset = datasets[state.dataset];
    const row = indexed[state.dataset][state.selected];
    const detail = nodes.browser.querySelector('[data-original-detail]');
    if (!row || !detail) return;
    const note = isSourceNote(row);
    const visibleColumns = Array.from({ length: Math.max(dataset.columns.length, row.cells.length) }, (_, index) => index)
      .filter(index => !note || text(row.cells[index]) !== '');
    detail.innerHTML = `<header class="originals-detail-heading"><div><p>${rowKindLabel(row) ? `${rowKindLabel(row).toUpperCase()} · ORIGINAL CSV` : 'ORIGINAL CSV RECORD'}</p><h4>Record <span>${escapeHtml(rowNumber(row))}</span></h4></div><span>${formatCount(row.cells.length)} original cells</span></header><dl class="originals-fields">${visibleColumns.map(index => `<div><dt>${escapeHtml(columnLabel(dataset.columns, index))}</dt><dd>${cellHTML(row.cells[index])}</dd></div>`).join('')}</dl>${note ? '<p class="originals-footnote">Blank cells are omitted here; the raw table retains every cell.</p>' : ''}`;
    root.querySelectorAll('.originals-record-button').forEach(button => {
      if (Number(button.dataset.originalRow) === state.selected) button.setAttribute('aria-current', 'true');
      else button.removeAttribute('aria-current');
    });
  }

  root.addEventListener('click', event => {
    const button = event.target.closest?.('button[data-original-action]');
    if (!button || !root.contains(button)) return;
    event.stopPropagation();
    const action = button.dataset.originalAction;
    if (action === 'retry') {
      root.innerHTML = `${originalDataHTMLHeader()}<div class="originals-loading" role="status"><span aria-hidden="true"></span>Opening the experiment files…</div>`;
      void load();
      return;
    }
    if (!state) return;
    if (action === 'row') {
      state.selected = Number(button.dataset.originalRow);
      renderDetail();
    } else if (action === 'inspect') {
      state.selected = Number(button.dataset.originalRow);
      state.table = false;
      renderRecords();
      root.querySelector(`[data-original-action="row"][data-original-row="${state.selected}"]`)?.focus();
    } else if (action === 'table') {
      state.table = !state.table;
      renderRecords();
    } else if (action === 'previous' || action === 'next') {
      state.page += action === 'next' ? 1 : -1;
      renderRecords();
    } else if (action === 'clear') {
      state.query = '';
      state.page = 0;
      const input = root.querySelector('[data-original-input="search"]');
      input.value = '';
      renderRecords();
      publishState();
      input.focus();
    }
  }, { signal: controller.signal });
  root.addEventListener('input', event => {
    if (event.target.matches('[data-original-input="search"]') && state) {
      state.query = event.target.value;
      state.page = 0;
      renderRecords();
      publishState();
    }
  }, { signal: controller.signal });
  root.addEventListener('change', event => {
    if (event.target.matches('[data-original-input="dataset"]') && state) {
      const index = Number(event.target.value);
      if (!Number.isInteger(index) || !datasets[index]) return;
      Object.assign(state, { dataset: index, query: '', page: 0, selected: 0 });
      root.querySelector('[data-original-input="search"]').value = '';
      renderDataset();
      publishState();
    }
  }, { signal: controller.signal });
  await load();
  return dispose;
}
