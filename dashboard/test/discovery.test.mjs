import test from 'node:test';
import assert from 'node:assert/strict';
import {sourcesByResults,originalFilesByRelevance} from '../dist/discovery.mjs';
test('sources with extracted results come first without mutating source records',()=>{
 const sources=[{source_id:'empty',title:'A'},{source_id:'one',title:'B'},{source_id:'two',title:'C'}];
 assert.deepEqual(sourcesByResults(sources,[{source_id:'two'},{source_id:'one'},{source_id:'two'}]).map(x=>x.source_id),['two','one','empty']);
 assert.equal(sources[0].source_id,'empty');
});
test('file relevance does not mistake run-log size for measurement coverage',()=>{
 const files=[{id:'bass',title:'BASS',rows:Array(122).fill({})},{id:'saffire-ii',title:'Saffire-II',rows:[{}]}];
 const sorted=originalFilesByRelevance(files);
 assert.equal(sorted[0].id,'saffire-ii');
 assert.equal(sorted[1],files[0]);
});
