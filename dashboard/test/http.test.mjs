import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {mkdtemp,writeFile,unlink,rmdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join,basename} from 'node:path';

test('public assets support conditional reads and HEAD without exposing server files',async t=>{
 const priorPort=process.env.PORT;process.env.PORT='0';
 const {server}=await import('../server/index.mjs');
 if(priorPort===undefined)delete process.env.PORT;else process.env.PORT=priorPort;
 t.after(()=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections()}));
 if(!server.listening)await once(server,'listening');
 const base=`http://127.0.0.1:${server.address().port}`;
 const first=await fetch(base+'/observatory.css');
 assert.equal(first.status,200);assert.match(first.headers.get('cache-control'),/must-revalidate/);
 const content=await first.text();assert.ok(content.includes('.mission-grid'));
 const unchanged=await fetch(base+'/observatory.css',{headers:{'If-None-Match':first.headers.get('etag')}});
 assert.equal(unchanged.status,304);assert.equal(await unchanged.text(),'');
 const head=await fetch(base+'/assets/moon-lroc-mobile.webp',{method:'HEAD'});
 assert.equal(head.status,200);assert.equal(head.headers.get('content-type'),'image/webp');
 assert.match(head.headers.get('cache-control'),/max-age=3600/);
 assert.ok(Number(head.headers.get('content-length'))>0);assert.equal(await head.text(),'');
 const wasm=await fetch(base+'/pkg/soraine_web_bg.wasm',{method:'HEAD'});
 assert.equal(wasm.status,200);assert.equal(wasm.headers.get('content-type'),'application/wasm');
 const privateFile=await fetch(base+'/server/index.mjs');assert.equal(privateFile.status,404);
 const mutation=await fetch(base+'/api/research',{method:'POST'});assert.equal(mutation.status,405);
 assert.equal(mutation.headers.get('allow'),'GET, HEAD');

 await t.test('original NASA endpoint serves all six selected CSVs without operational fields',async()=>{
   const response=await fetch(base+'/api/original-data');
   assert.equal(response.status,200);
   assert.equal(response.headers.get('content-type'),'application/json');
   assert.equal(response.headers.get('cache-control'),'public, max-age=30');
   const data=await response.json();
   assert.deepEqual(data.datasets.map(d=>[d.id,d.rows.length]),[['bass',122],['bass-ii',129],['saffire-i',4],['saffire-ii',15],['saffire-iii',2],['same-r',109]]);
   assert.ok(data.datasets.every(d=>d.rows.every(row=>row.cells.length===d.columns.length)));
   assert.equal(data.datasets.find(d=>d.id==='bass-ii').rows[1].cells[12],'1.6');
   assert.equal(data.datasets.find(d=>d.id==='saffire-ii').rows.filter(row=>row.rowKind==='source_note').length,4);
   assert.ok(!/local_path|source_file|download_events|object_key/.test(JSON.stringify(data)));
   const head=await fetch(base+'/api/original-data',{method:'HEAD'});
   assert.equal(head.status,200);assert.equal(await head.text(),'');
   const mutation=await fetch(base+'/api/original-data',{method:'POST'});
   assert.equal(mutation.status,405);
 });

 const fixtureDir=await mkdtemp(fileURLToPath(new URL('../dist/.http-audio-',import.meta.url)));
 const bytes=Buffer.from(Array.from({length:300},(_,i)=>i%256));
 const fixtures=['sample.wav','sample.ogg','sample.mp3','empty.wav'];
 t.after(async()=>{await Promise.all(fixtures.map(name=>unlink(join(fixtureDir,name))));await rmdir(fixtureDir)});
 await Promise.all(fixtures.map(name=>writeFile(join(fixtureDir,name),name==='empty.wav'?Buffer.alloc(0):bytes)));
 const audioUrl=`${base}/${basename(fixtureDir)}/sample.wav`;

 await t.test('audio has correct MIME, cache and full GET/HEAD bodies',async()=>{
   for(const [extension,mime] of [['wav','audio/wav'],['ogg','audio/ogg'],['mp3','audio/mpeg']]){
     const audio=await fetch(audioUrl.replace('.wav',`.${extension}`));
     assert.equal(audio.status,200);assert.equal(audio.headers.get('content-type'),mime);
     assert.equal(audio.headers.get('accept-ranges'),'bytes');
     assert.equal(audio.headers.get('cache-control'),'public, max-age=3600');
     assert.equal(audio.headers.get('content-length'),String(bytes.length));
     assert.deepEqual(Buffer.from(await audio.arrayBuffer()),bytes);
   }
   const head=await fetch(audioUrl,{method:'HEAD',headers:{Range:'bytes=20-29'}});
   assert.equal(head.status,200);assert.equal(head.headers.get('content-length'),String(bytes.length));
   assert.equal(head.headers.get('content-range'),null);assert.equal(head.headers.get('content-type'),'audio/wav');
   assert.equal((await head.arrayBuffer()).byteLength,0);
 });

 await t.test('single audio ranges return exactly the requested bytes',async()=>{
   for(const [range,start,end] of [
     ['bytes=0-0',0,0],['bytes=20-29',20,29],['bytes=295-',295,299],
     ['bytes=-7',293,299],['bytes=295-999999999999999999999',295,299],
     ['bytes=-999999999999999999999',0,299]
   ]){
     const response=await fetch(audioUrl,{headers:{Range:range}});
     assert.equal(response.status,206,range);
     assert.equal(response.headers.get('content-range'),`bytes ${start}-${end}/${bytes.length}`);
     assert.equal(response.headers.get('content-length'),String(end-start+1));
     assert.deepEqual(Buffer.from(await response.arrayBuffer()),bytes.subarray(start,end+1));
   }
 });

 await t.test('unsatisfiable audio ranges return 416 and malformed ranges are ignored',async()=>{
   for(const range of ['bytes=300-','bytes=900-1000','bytes=-0','bytes=999999999999999999999-']){
     const response=await fetch(audioUrl,{headers:{Range:range}});
     assert.equal(response.status,416,range);assert.equal(response.headers.get('content-range'),'bytes */300');
     assert.equal(response.headers.get('content-length'),'0');assert.equal((await response.arrayBuffer()).byteLength,0);
   }
   for(const range of ['bytes=abc','bytes=-','bytes=9-2','bytes=0-1,3-4','items=0-2']){
     const response=await fetch(audioUrl,{headers:{Range:range}});
     assert.equal(response.status,200,range);assert.equal(response.headers.get('content-range'),null);
     assert.deepEqual(Buffer.from(await response.arrayBuffer()),bytes);
   }
   const empty=await fetch(audioUrl.replace('sample.wav','empty.wav'),{headers:{Range:'bytes=0-'}});
   assert.equal(empty.status,416);assert.equal(empty.headers.get('content-range'),'bytes */0');
   assert.equal((await empty.arrayBuffer()).byteLength,0);
 });

 await t.test('audio range requests respect representation validators',async()=>{
   const head=await fetch(audioUrl,{method:'HEAD'});
   const unchanged=await fetch(audioUrl,{headers:{Range:'bytes=0-9','If-None-Match':head.headers.get('etag')}});
   assert.equal(unchanged.status,304);assert.equal((await unchanged.arrayBuffer()).byteLength,0);
   const matched=await fetch(audioUrl,{headers:{Range:'bytes=0-9','If-Range':head.headers.get('last-modified')}});
   assert.equal(matched.status,206);assert.deepEqual(Buffer.from(await matched.arrayBuffer()),bytes.subarray(0,10));
   for(const validator of ['Wed, 01 Jan 1997 00:00:00 GMT',head.headers.get('etag')]){
     const stale=await fetch(audioUrl,{headers:{Range:'bytes=0-9','If-Range':validator}});
     assert.equal(stale.status,200);assert.deepEqual(Buffer.from(await stale.arrayBuffer()),bytes);
   }
 });
});
