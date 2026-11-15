import test from 'node:test';
import assert from 'node:assert/strict';
import {createResearchCache,decodeValue,PUBLIC_FIELDS,readPublicBundle} from '../server/research.mjs';

test('BigQuery decoding preserves null, exact decimals, booleans and arrays',()=>{
  assert.equal(decodeValue(null,{type:'FLOAT'}),null);
  assert.equal(decodeValue('0.000016',{type:'FLOAT'}),'0.000016');
  assert.equal(decodeValue('false',{type:'BOOLEAN'}),false);
  assert.deepEqual(decodeValue([{v:'m1'},{v:'m2'}],{type:'STRING',mode:'REPEATED'}),['m1','m2']);
});
test('refreshes are shared, cached, and retain the last complete result on failure',async()=>{
  let clock=100,calls=0,fail=false;
  const cache=createResearchCache({snapshot:{marker:'snapshot'},now:()=>clock,ttlMs:300000,refresh:async()=>{calls++;await new Promise(r=>setTimeout(r,10));if(fail)throw Error('denied');return {marker:'live',exportedAt:'2026-11-14T23:00:00Z'};}});
  const results=await Promise.all(Array.from({length:10},()=>cache()));
  assert.equal(calls,1);assert.ok(results.every(r=>r.delivery.mode==='bigquery'));
  await cache();assert.equal(calls,1);clock+=300001;fail=true;
  const stale=await cache();assert.equal(stale.marker,'live');assert.equal(stale.delivery.mode,'cached-stale');
  await cache();assert.equal(calls,2);
});
test('a failed first connection is honestly labelled as a saved snapshot',async()=>{
  const cache=createResearchCache({snapshot:{measurements:[]},refresh:async()=>{throw Error('denied')}});
  assert.equal((await cache()).delivery.mode,'snapshot');
});
test('public reads use only allowed columns and never query operational tables',async()=>{
  const urls=[];
  const request=async url=>{
    urls.push(url);const u=new URL(url);const table=u.pathname.split('/')[8];
    if(u.pathname.endsWith('/data'))return {rows:[]};
    return {etag:'a',numRows:'0',schema:{fields:[...PUBLIC_FIELDS[table].map(name=>({name,type:'STRING'})),{name:'private_path',type:'STRING'}]}};
  };
  const result=await readPublicBundle({request,project:'project-test',dataset:'research',snapshot:{tableCounts:{files:60866},exportedAt:'2026-11-14T00:00:00Z'}});
  assert.equal(result.measurements.length,0);
  for(const url of urls){assert.ok(!url.includes('private_path'));assert.ok(!/\/(files|raw_records|download_events)(\/|$)/.test(url));}
  assert.equal(result.tableCounts.files,60866);
});
test('incomplete or changing BigQuery exports never replace a valid bundle',async()=>{
  const request=async url=>url.endsWith('/data')?{rows:[]}:{etag:'a',numRows:'1',schema:{fields:[]}};
  await assert.rejects(readPublicBundle({request,project:'project-test',dataset:'research',snapshot:{tableCounts:{}}}));
});
