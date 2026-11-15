import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {buildComparison,parseSceneSelection,routeCommand} from '../src/research.mjs';
const raw=readFileSync(new URL('../../research/soraine-information.json',import.meta.url));
const bundle=JSON.parse(raw);

test('published endpoints retain their units, conditions and evidence IDs',()=>{
  const [moon,mars]=buildComparison(bundle);
  assert.deepEqual([moon.survived.value,moon.extinguished.value,mars.survived.value,mars.extinguished.value],[21,19.9,22,21.1]);
  assert.deepEqual([moon.gravity,mars.gravity],[.16,.38]);
  for(const row of [moon,mars]){
    assert.equal(row.survived.unit,'% O2');assert.equal(row.pressurePsia,10.2);
    assert.equal(row.thickness,.254);assert.equal(row.duration,5.18);
    assert.equal(row.airflow,null);assert.equal(row.source.id,'NTRS-20130010991');
    assert.equal(row.evidenceIds.length,2);
  }
});
test('the input research pack is unchanged from the team information pack',()=>{
  // Hash recorded directly from the canonical team handoff on 2026-11-14.
  assert.equal(createHash('sha256').update(raw).digest('hex'),'fabb3723191a685eea9edda152ba9481e3455ca86e075399983f0c14cdd88088');
});
test('scene links reject another material or an incompatible case',()=>{
  assert.equal(parseSceneSelection({objectId:'sample-nomex',sceneId:'moon'}),null);
  assert.equal(parseSceneSelection({objectId:'sample-ultem',sceneId:'earth'}),null);
  assert.equal(parseSceneSelection({objectId:'sample-ultem',sceneId:'moon',caseId:'olson-ultem-mars'}),null);
  assert.equal(parseSceneSelection({objectId:'sample-ultem',sceneId:'mars'}).caseId,'olson-ultem-mars');
});
test('scene context is returned intact but does not modify published results',()=>{
  const input={objectId:'sample-ultem',sceneId:'moon',atmosphereId:'illustrative-enriched',cabinOverrides:{oxygen_percent:30,pressure_kpa_absolute:70.3}};
  const selected=parseSceneSelection(input);
  assert.equal(selected.atmosphereId,'illustrative-enriched');assert.deepEqual(selected.cabinOverrides,input.cabinOverrides);
  assert.equal(buildComparison(bundle)[0].survived.value,21);
  assert.equal(parseSceneSelection({...input,cabinOverrides:{oxygen_percent:110}}),null);
});
test('the guided navigator has an explicit unsupported route',()=>{
  assert.equal(routeCommand('What is the weather?'),'unsupported');
  assert.equal(routeCommand('Compare Ultem on Moon and Mars'),'compare');
  assert.equal(routeCommand('Show the source'),'source');
  assert.equal(routeCommand('start over'),'home');
});
