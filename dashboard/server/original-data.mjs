import {decodeValue} from './research.mjs';

// This reader cannot access the private file catalogue or ingestion paths.
export const ORIGINAL_PUBLIC_FIELDS = Object.freeze({
  dataset_id: 'STRING', title: 'STRING', source_id: 'STRING', source_url: 'STRING',
  source_sha256: 'STRING', headers: 'STRING', cells: 'STRING', record_id: 'STRING',
  csv_record_number: 'INTEGER', row_kind: 'STRING'
});
const DATASETS = Object.freeze({
  'bass': {title: 'BASS', source: 'CSV-67a3768509ed061032c125fb', investigation: 'PSI-26'},
  'bass-ii': {title: 'BASS-II', source: 'CSV-fa0a9a6e384c7e455825173a', investigation: 'PSI-25'},
  'saffire-i': {title: 'Saffire-I', source: 'CSV-6792c46eb7b6ff8e65037f3e', investigation: 'PSI-98'},
  'saffire-ii': {title: 'Saffire-II', source: 'CSV-e7a94940d9d2f3c035985141', investigation: 'PSI-99'},
  'saffire-iii': {title: 'Saffire-III', source: 'CSV-6792d422b7b6ff8e650381da', investigation: 'PSI-100'},
  'same-r': {title: 'SAME-R', source: 'CSV-679a9e2209ed061032c0cd23', investigation: 'PSI-101'}
});
const ROW_KINDS = new Set(['source_record', 'test_record', 'source_note', 'pretest_reference']);
const MAX_ROWS = 5000;
const privateContent = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}|[a-z]:[\\/](?:Users|home|Documents)[\\/]|\\\\[^\s\\]+\\/i;

function publicSourceUrl(value, investigation) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'psi.nasa.gov' &&
      !url.username && !url.password && !url.hash &&
      url.pathname === `/geode-py/ws/studies/${investigation}/download` &&
      /^[a-f0-9]{24}$/i.test(url.searchParams.get('file') || '') &&
      /^\d+$/.test(url.searchParams.get('version') || '') &&
      [...url.searchParams.keys()].every(key => key === 'file' || key === 'version');
  } catch {return false;}
}

function originalStrings(values) {
  return Array.isArray(values) && values.length > 0 && values.length <= 100 &&
    values.every(value => typeof value === 'string' && value.length <= 10000 && !privateContent.test(value));
}

function assemble(records) {
  const groups = new Map(), ids = new Set(), positions = new Set();
  for (const record of records) {
    const definition = DATASETS[record.dataset_id];
    if (!definition || record.title !== definition.title || record.source_id !== definition.source ||
        !publicSourceUrl(record.source_url, definition.investigation) ||
        !/^[a-f0-9]{64}$/i.test(record.source_sha256 || '')) {
      throw Error('Original data provenance is invalid');
    }
    const number = Number(record.csv_record_number);
    if (!/^[A-Za-z0-9:_-]{1,160}$/.test(record.record_id || '') ||
        !Number.isSafeInteger(number) || number < 2 || !ROW_KINDS.has(record.row_kind) ||
        !originalStrings(record.headers) || !originalStrings(record.cells) ||
        record.headers.length !== record.cells.length) {
      throw Error('Original CSV row is invalid');
    }
    const position = `${record.dataset_id}:${number}`;
    if (ids.has(record.record_id) || positions.has(position)) throw Error('Original CSV row is duplicated');
    ids.add(record.record_id); positions.add(position);

    if (!groups.has(record.dataset_id)) groups.set(record.dataset_id, {
      id: record.dataset_id, title: record.title, sourceId: record.source_id,
      sourceUrl: record.source_url, sha256: record.source_sha256,
      columns: [...record.headers], rows: []
    });
    const group = groups.get(record.dataset_id);
    if (group.sourceId !== record.source_id || group.sourceUrl !== record.source_url ||
        group.sha256 !== record.source_sha256 ||
        JSON.stringify(group.columns) !== JSON.stringify(record.headers)) {
      throw Error('Original CSV provenance changed within a dataset');
    }
    // Source strings, blanks, units, approximations and notes remain unchanged.
    group.rows.push({id: record.record_id, csvRecordNumber: number,
      cells: [...record.cells], rowKind: record.row_kind});
  }
  if (groups.size !== Object.keys(DATASETS).length) throw Error('Original datasets are incomplete');
  const datasets = [...groups.values()].sort((a, b) => a.id.localeCompare(b.id));
  for (const dataset of datasets) dataset.rows.sort((a, b) => a.csvRecordNumber - b.csvRecordNumber);
  return {exportedAt: new Date().toISOString(), datasets};
}

// The caller's separate createResearchCache owns snapshot fallback and retry timing.
export async function readOriginalBundle({request, project, dataset, snapshot}) {
  if (!/^[a-z][a-z0-9-]+$/.test(project) || !/^\w+$/.test(dataset)) {
    throw Error('Invalid original-data configuration');
  }
  const base = `https://bigquery.googleapis.com/bigquery/v2/projects/${project}/datasets/${dataset}/tables/public_experiment_rows`;
  const before = await request(base);
  const total = Number(before.numRows);
  if (!Number.isSafeInteger(total) || total < 1 || total > MAX_ROWS) throw Error('Original data exceeds public export limit');
  const fields = (before.schema?.fields || []).filter(field => Object.hasOwn(ORIGINAL_PUBLIC_FIELDS, field.name));
  if (fields.length !== Object.keys(ORIGINAL_PUBLIC_FIELDS).length ||
      fields.some(field => field.type !== ORIGINAL_PUBLIC_FIELDS[field.name] ||
        (['headers', 'cells'].includes(field.name) ? field.mode !== 'REPEATED' : field.mode === 'REPEATED'))) {
    throw Error('Original-data schema changed');
  }

  const records = [], tokens = new Set();
  let pageToken;
  do {
    const query = new URLSearchParams({maxResults: '1000', selectedFields: fields.map(field => field.name).join(',')});
    if (pageToken) query.set('pageToken', pageToken);
    const page = await request(`${base}/data?${query}`);
    for (const row of page.rows || []) {
      records.push(Object.fromEntries(fields.map((field, i) => [field.name, decodeValue(row.f?.[i]?.v, field)])));
    }
    if (records.length > MAX_ROWS) throw Error('Original data exceeds public export limit');
    pageToken = page.pageToken;
    if (pageToken) {
      if (tokens.has(pageToken)) throw Error('Original data pagination repeated');
      tokens.add(pageToken);
    }
  } while (pageToken);
  const after = await request(base);
  if (before.etag !== after.etag || total !== records.length || Number(after.numRows) !== records.length) {
    throw Error('Original data changed during refresh');
  }
  return assemble(records);
}
