import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {joinResearch} from '../dist/data.mjs';
import {readingSummary,comparisonContext} from '../dist/reading.mjs';
const bundle=JSON.parse(await readFile(new URL('../dist/data/research.json',import.meta.url),'utf8'));
const rows=joinResearch(bundle);
test('interpretation uses percentage points and preserves material-specific comparison direction',()=>{
 assert.match(readingSummary(rows,'Ultem 1000','Moon'),/lunar-gravity.*1 percentage point lower/);
 assert.match(readingSummary(rows,'Nomex HT90-40','Moon'),/Martian-gravity.*1.1 percentage points lower/);
 assert.match(comparisonContext('Mylar G'),/Melinex 515.*Mylar G/);
});
test('missing evidence never becomes a numerical comparison',()=>{
 assert.match(readingSummary([],'Ultem 1000','Moon'),/No matching published/);
});
