import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {getObjectPanel,getComparison} from './info-adapter.mjs';
const data=JSON.parse(readFileSync(new URL('./soraine-information.json',import.meta.url),'utf8'));
const unique=list=>assert.equal(new Set(list.map(r=>r.id)).size,list.length,'Duplicate ID');
['objects','materials','cards','cases','evidence_records','scenes','atmospheres'].forEach(k=>unique(data[k]));
const aliases=data.objects.flatMap(o=>[o.id,...o.aliases]);assert.equal(new Set(aliases).size,aliases.length,'Alias collision');
for(const record of data.evidence_records)assert.ok(data.sources[record.source_id],record.id);
for(const material of data.materials)for(const id of material.record_ids)assert.ok(data.evidence_records.some(r=>r.id===id),id);
for(const c of data.cases){assert.ok(data.materials.some(m=>m.id===c.material_id));for(const id of c.record_ids)assert.ok(data.evidence_records.some(r=>r.id===id));}
for(const card of data.cards){for(const id of card.source_ids)assert.ok(data.sources[id],id);for(const id of card.related_object_ids)assert.ok(data.objects.some(o=>o.id===id),id);}
for(const o of data.objects){assert.ok(data.cards.some(c=>c.id===o.card_id));for(const id of o.finding_ids)assert.ok(data.findings.some(f=>f.id===id));for(const s of data.scenes)getObjectPanel(data,{objectId:o.id,sceneId:s.id});}
const moon=getObjectPanel(data,{objectId:'sample-ultem',sceneId:'moon'});
const mars=getObjectPanel(data,{objectId:'sample-ultem',sceneId:'mars'});
assert.equal(moon.measurements.find(m=>m.metric==='ULOI*').value,21);
assert.equal(mars.measurements.find(m=>m.metric==='ULOI*').value,22);
assert.deepEqual(moon.sceneConditions.atmosphere,mars.sceneConditions.atmosphere);
const wire=getObjectPanel(data,{objectId:'sample-wire',sceneId:'mars'});
assert.equal(wire.measurements.find(m=>m.metric==='flame_spread_mm_s').value,1.38);
const absent=getObjectPanel(data,{objectId:'sample-wire',sceneId:'moon'});
assert.equal(absent.evidenceState,'no_matching_case');assert.equal(absent.measurements.length,0);
const changed=getObjectPanel(data,{objectId:'sample-wire',sceneId:'mars',cabinOverrides:{oxygen_percent:30,pressure_kpa_absolute:70.3}});
assert.deepEqual(changed.measurements,wire.measurements);assert.equal(changed.testConditions[0].conditions.oxygen_percent,19);
assert.equal(changed.sceneConditions.atmosphere.oxygen_percent,30);
const extinct=getObjectPanel(data,{objectId:'sample-wire',sceneId:'mars',caseId:'li2024-t1-u150-o18'});
assert.equal(extinct.measurements.find(m=>m.metric==='burning_outcome').value,'extinction');
assert.equal(extinct.measurements.find(m=>m.metric==='flame_spread_mm_s').value,null);
const noExperiment=getObjectPanel(data,{objectId:'sample-wire',sceneId:'mars',caseId:'li2024-t1-u60-o20'});
assert.equal(noExperiment.evidenceState,'no_experiment');
assert.throws(()=>getObjectPanel(data,{objectId:'sample-wire',sceneId:'moon',caseId:'li2024-t1-u150-o19'}));
assert.throws(()=>getObjectPanel(data,{objectId:'egg',sceneId:'moon',cabinOverrides:{oxygen_percent:120}}));
assert.equal(getComparison(data,'olson-ultem-moon','olson-nomex-moon').allowed,false);
assert.equal(getComparison(data,'olson-ultem-moon','olson-ultem-mars').allowPrediction,false);
assert.equal(getObjectPanel(data,{objectId:'egg',sceneId:'moon'}).measurements.length,0);
assert.equal(getObjectPanel(data,{objectId:'spatula',sceneId:'mars'}).objectId,'utensils');
const before=JSON.stringify(data);getObjectPanel(data,{objectId:'stove',sceneId:'moon',cabinOverrides:{oxygen_percent:30}});assert.equal(JSON.stringify(data),before);
mkdirSync(new URL('./examples/',import.meta.url),{recursive:true});
for(const [name,panel]of Object.entries({'moon-ultem':moon,'mars-wire':wire,'moon-wire-no-matching-case':absent}))writeFileSync(new URL(`./examples/${name}.json`,import.meta.url),JSON.stringify(panel,null,2)+'\n');
console.log(`PASS: ${data.objects.length} objects × ${data.scenes.length} scenes; ${data.cases.length} selectable cases; ${data.evidence_records.length} evidence records. References, values, missing data and scene/research isolation checked.`);
