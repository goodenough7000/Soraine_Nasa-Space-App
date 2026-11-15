import {mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const definitions=[
 ['bass','BASS','PSI-26','67a3768509ed061032c125fb'],
 ['same-r','SAME-R','PSI-101','679a9e2209ed061032c0cd23'],
 ['saffire-i','Saffire-I','PSI-98','6792c46eb7b6ff8e65037f3e'],
 ['saffire-iii','Saffire-III','PSI-100','6792d422b7b6ff8e650381da']
];
const directory=new URL('../source-data/',import.meta.url);
await mkdir(directory,{recursive:true});
const manifest=[];
for(const [id,title,investigation,file] of definitions){
 const sourceUrl=`https://psi.nasa.gov/geode-py/ws/studies/${investigation}/download?file=${file}&version=1`;
 const response=await fetch(sourceUrl,{signal:AbortSignal.timeout(30000)});
 if(!response.ok)throw Error(`${id}: HTTP ${response.status}`);
 const bytes=Buffer.from(await response.arrayBuffer());
 if(bytes.length>100000||bytes.toString('utf8').trimStart().startsWith('<'))throw Error(`${id}: not a small CSV`);
 const sha256=createHash('sha256').update(bytes).digest('hex');
 await writeFile(new URL(id+'.csv',directory),bytes);
 manifest.push({id,title,investigation,sourceId:'CSV-'+file,sourceUrl,sha256,bytes:bytes.length,retrievedAt:new Date().toISOString()});
}
await writeFile(new URL('manifest.json',directory),JSON.stringify(manifest,null,2)+'\n');
console.log(manifest.map(({id,bytes,sha256})=>({id,bytes,sha256})));
