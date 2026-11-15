import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {ORIGINAL_PUBLIC_FIELDS, readOriginalBundle} from '../server/original-data.mjs';

const snapshot = JSON.parse((await readFile(new URL('../dist/data/original-data.json', import.meta.url), 'utf8')).replace(/^\uFEFF/, ''));
const records = snapshot.datasets.flatMap(dataset => dataset.rows.map(row => ({
  dataset_id: dataset.id, title: dataset.title, source_id: dataset.sourceId,
  source_url: dataset.sourceUrl, source_sha256: dataset.sha256,
  headers: dataset.columns, cells: row.cells, record_id: row.id,
  csv_record_number: String(row.csvRecordNumber), row_kind: row.rowKind
})));
const configuration = {project: 'project-89aca125-c9a5-4fdd-bb0', dataset: 'flame_in_freefall_2026', snapshot};

function mockRequest(rows, {changed = false, repeatedPage = false} = {}) {
  // Reverse order proves decoding follows the returned schema, not a hardcoded order.
  const fields = Object.entries(ORIGINAL_PUBLIC_FIELDS).reverse().map(([name, type]) => ({
    name, type, ...(['headers', 'cells'].includes(name) ? {mode: 'REPEATED'} : {})
  }));
  let metadataReads = 0;
  const urls = [];
  const request = async input => {
    urls.push(input);
    const url = new URL(input);
    assert.match(url.pathname, /\/tables\/public_experiment_rows(?:\/data)?$/);
    if (!url.pathname.endsWith('/data')) return {
      numRows: String(rows.length), etag: changed && metadataReads++ > 0 ? 'new' : 'original',
      schema: {fields: [...fields, {name: 'local_path', type: 'STRING'}]}
    };
    assert.deepEqual(url.searchParams.get('selectedFields').split(','), fields.map(field => field.name));
    const offset = Number(url.searchParams.get('pageToken') || 0);
    const page = rows.slice(offset, offset + 70);
    return {
      rows: page.map(row => ({f: fields.map(field => ({v: field.mode === 'REPEATED'
        ? row[field.name].map(value => ({v: value})) : row[field.name]}))})),
      ...(offset + 70 < rows.length ? {pageToken: repeatedPage ? '70' : String(offset + 70)} : {})
    };
  };
  return {request, urls};
}

test('serves every original CSV string and public provenance across paginated REST reads', async () => {
  const {request, urls} = mockRequest(records);
  const result = await readOriginalBundle({...configuration, request});
  assert.deepEqual(result.datasets, snapshot.datasets);
  assert.ok(Number.isFinite(Date.parse(result.exportedAt)));
  const data = Object.fromEntries(result.datasets.map(item => [item.id, item]));
  assert.deepEqual(Object.fromEntries(result.datasets.map(item => [item.id, item.rows.length])),
    {'bass':122, 'bass-ii':129, 'saffire-i':4, 'saffire-ii':15, 'saffire-iii':2, 'same-r':109});
  assert.equal(data['bass-ii'].rows[1].cells[12], '1.6');
  assert.equal(data['saffire-ii'].rows.filter(row => row.rowKind === 'source_note').length, 4);
  assert.equal(data['saffire-ii'].rows.filter(row => row.rowKind === 'pretest_reference').length, 2);
  assert.equal(data['saffire-i'].rows[1].cells[6], '~ 21.5');
  assert.equal(data['saffire-i'].rows[0].cells[9], '420');
  assert.equal(data['saffire-i'].rows.filter(row => row.rowKind === 'pretest_reference').length, 2);
  assert.equal(data['same-r'].rows[1].cells[7], '');
  assert.equal(data['same-r'].rows[24].cells[4], '0');
  assert.ok(!JSON.stringify(result).includes('local_path'));
  assert.equal(urls.filter(url => url.includes('/data?')).length, Math.ceil(records.length / 70));
});

test('rejects a refresh changed while paging, rather than returning a mixed snapshot', async () => {
  await assert.rejects(readOriginalBundle({...configuration, ...mockRequest(records, {changed: true})}), /changed during refresh/);
});

test('rejects duplicated source rows and missing cell positions', async () => {
  await assert.rejects(readOriginalBundle({...configuration, ...mockRequest([...records, records[0]])}), /duplicated/);
  const broken = structuredClone(records);
  broken[0].cells.pop();
  await assert.rejects(readOriginalBundle({...configuration, ...mockRequest(broken)}), /CSV row is invalid/);
});

test('rejects inconsistent headers and non-NASA provenance', async () => {
  const changedHeader = structuredClone(records);
  changedHeader[1].headers = [...changedHeader[1].headers];
  changedHeader[1].headers[0] = 'Changed column';
  await assert.rejects(readOriginalBundle({...configuration, ...mockRequest(changedHeader)}), /provenance changed/);
  const foreignSource = structuredClone(records);
  foreignSource[0].source_url = 'https://example.com/download';
  await assert.rejects(readOriginalBundle({...configuration, ...mockRequest(foreignSource)}), /provenance is invalid/);
});

test('does not publish private paths inserted into cells', async () => {
  const privateRow = structuredClone(records);
  privateRow[0].cells[0] = 'C:\\Users\\someone\\private.csv';
  await assert.rejects(readOriginalBundle({...configuration, ...mockRequest(privateRow)}), /CSV row is invalid/);
});

test('requires the selected datasets and stops repeated pagination tokens', async () => {
  await assert.rejects(readOriginalBundle({...configuration, ...mockRequest(records.filter(row => row.dataset_id === 'bass-ii'))}), /incomplete/);
  await assert.rejects(readOriginalBundle({...configuration, ...mockRequest(records, {repeatedPage: true})}), /pagination repeated/);
});

test('rejects malformed configuration before making a request', async () => {
  await assert.rejects(readOriginalBundle({...configuration, dataset: '../private', request: () => assert.fail('request should not occur')}), /Invalid original-data configuration/);
});
