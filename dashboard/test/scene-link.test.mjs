import test from 'node:test';
import assert from 'node:assert/strict';
import {researchUrl,RESEARCH_SITE} from '../dist/scene-link.mjs';

test('scene links retain the exact material and normalize planet names',()=>{
 const url=new URL(researchUrl({world:'Lunar',material:'Nomex HT90-40',record:'E014',view:'evidence'}));
 assert.equal(url.origin,new URL(RESEARCH_SITE).origin);
 assert.equal(url.searchParams.get('world'),'moon');
 assert.equal(url.searchParams.get('material'),'Nomex HT90-40');
 assert.equal(url.searchParams.get('record'),'E014');
 assert.equal(url.hash,'#evidence');
});
test('the same scene contract supports local hosting under a subdirectory',()=>{
 const url=new URL(researchUrl({world:'Mars'},'http://localhost:5180/dashboard/dist/?old=1#overview'));
 assert.equal(url.pathname,'/dashboard/dist/');
 assert.equal(url.searchParams.get('world'),'mars');
 assert.equal(url.searchParams.has('old'),false);
 assert.equal(url.hash,'#compare');
});
test('scene links reject unsupported materials, contexts and unsafe schemes',()=>{
 for(const args of [{world:'venus'},{material:'spoon'},{view:'admin'},{record:'<script>'}])assert.throws(()=>researchUrl(args));
 assert.throws(()=>researchUrl({},'javascript:alert(1)'));
});

test('scene links can open original experimental records without changing context',()=>{
 const url=new URL(researchUrl({world:'moon',material:'Ultem 1000',view:'experiments'}));
 assert.equal(url.hash,'#experiments');
 assert.equal(url.searchParams.get('world'),'moon');
 assert.equal(url.searchParams.get('material'),'Ultem 1000');
});
