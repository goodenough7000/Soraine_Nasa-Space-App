import http from 'node:http';
import {createReadStream} from 'node:fs';
import {readFile, stat} from 'node:fs/promises';
import {pipeline} from 'node:stream/promises';
import {resolve, extname, sep, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createResearchCache, readPublicBundle} from './research.mjs';
import {readOriginalBundle} from './original-data.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../dist');
const snapshot = JSON.parse((await readFile(resolve(root,'data/research.json'),'utf8')).replace(/^\uFEFF/,''));
const originalSnapshot = JSON.parse((await readFile(resolve(root,'data/original-data.json'),'utf8')).replace(/^\uFEFF/,''));
const project = process.env.BQ_PROJECT || 'project-89aca125-c9a5-4fdd-bb0';
const dataset = process.env.BQ_DATASET || 'flame_in_freefall_2026';
let credential, credentialExpires=0;
async function accessToken(){
  if(!process.env.K_SERVICE) throw Error('Local snapshot mode');
  if(credential && Date.now()<credentialExpires) return credential;
  const response=await fetch('http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token',{headers:{'Metadata-Flavor':'Google'},signal:AbortSignal.timeout(3000)});
  if(!response.ok) throw Error('Runtime identity unavailable');
  const token=await response.json(); credential=token.access_token;credentialExpires=Date.now()+Math.max(0,token.expires_in-60)*1000;
  return credential;
}
async function request(url){
  const response=await fetch(url,{headers:{Authorization:`Bearer ${await accessToken()}`},signal:AbortSignal.timeout(8000)});
  if(!response.ok) throw Error(`Research read failed: ${response.status}`);
  return response.json();
}
const research = createResearchCache({snapshot,refresh:()=>readPublicBundle({request,project,dataset,snapshot}).catch(error=>{console.warn('Research refresh:',error.message);throw error})});
const originalData = createResearchCache({snapshot:originalSnapshot,refresh:()=>readOriginalBundle({request,project,dataset,snapshot:originalSnapshot}).catch(error=>{console.warn('Original data refresh:',error.message);throw error})});
const types={'.html':'text/html; charset=utf-8','.m4a':'audio/mp4','.mjs':'text/javascript','.js':'text/javascript','.wasm':'application/wasm','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.jpg':'image/jpeg','.png':'image/png','.webp':'image/webp','.woff2':'font/woff2','.wav':'audio/wav','.ogg':'audio/ogg','.mp3':'audio/mpeg'};
// Ignore malformed or multipart requests; a valid range outside the file is 416.
function audioRange(header,size){
  const match=/^bytes=(\d*)-(\d*)$/i.exec((header||'').trim());
  if(!match||(!match[1]&&!match[2]))return null;
  const length=BigInt(size);
  if(!match[1]){
    const suffix=BigInt(match[2]);
    if(!length||!suffix)return false;
    return {start:Number(suffix>=length?0n:length-suffix),end:size-1};
  }
  const start=BigInt(match[1]),requestedEnd=match[2]?BigInt(match[2]):null;
  if(requestedEnd!==null&&requestedEnd<start)return null;
  if(start>=length)return false;
  return {start:Number(start),end:Number(requestedEnd===null||requestedEnd>=length?length-1n:requestedEnd)};
}
const server=http.createServer(async(req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=()');
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405,{Allow:'GET, HEAD'}).end();return;}
  try{
    const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    if(pathname==='/healthz'){res.writeHead(200,{'Content-Type':'application/json'}).end(req.method==='HEAD'?undefined:'{"status":"ok"}');return;}
    if(pathname==='/api/research'){
      const data=await research();res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'public, max-age=30'});res.end(req.method==='HEAD'?undefined:JSON.stringify(data));return;
    }
    if(pathname==='/api/original-data'){
      const data=await originalData();res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'public, max-age=30'});res.end(req.method==='HEAD'?undefined:JSON.stringify(data));return;
    }
    // Restrict serving to public assets, never repository, cloud config or source.
    let file=resolve(root,'.'+pathname);
    if(file!==root&&!file.startsWith(root+sep)){res.writeHead(403).end();return;}
    let info=await stat(file);
    if(info.isDirectory()){file=resolve(file,'index.html');info=await stat(file);}
    const etag='W/"'+info.size.toString(16)+'-'+Math.trunc(info.mtimeMs).toString(16)+'"';
    const extension=extname(file).toLowerCase(),audioAsset=['.wav','.ogg','.mp3','.m4a'].includes(extension);
    const stableAsset=audioAsset||/\.(png|jpg|webp|woff2|svg)$/.test(file);
    res.setHeader('Cache-Control',stableAsset?'public, max-age=3600':'public, max-age=0, must-revalidate');
    res.setHeader('ETag',etag);
    res.setHeader('Last-Modified',info.mtime.toUTCString());
    if(audioAsset)res.setHeader('Accept-Ranges','bytes');
    if((req.headers['if-none-match']||'').split(',').map(v=>v.trim()).includes(etag)){res.writeHead(304).end();return;}
    res.setHeader('Content-Type',types[extension]||'application/octet-stream');
    res.setHeader('Content-Length',info.size);
    // Range applies to GET only. HEAD reports the full representation's headers.
    if(req.method==='HEAD'){res.writeHead(200).end();return;}
    if(audioAsset){
      const ifRange=req.headers['if-range'];
      // Our validator is weak, so If-Range can match only a modification date.
      const rangeAllowed=!ifRange||Date.parse(ifRange)>=Math.floor(info.mtimeMs/1000)*1000;
      const range=rangeAllowed?audioRange(req.headers.range,info.size):null;
      if(range===false){
        res.writeHead(416,{'Content-Range':`bytes */${info.size}`,'Content-Length':0}).end();return;
      }
      if(range){
        res.writeHead(206,{'Content-Range':`bytes ${range.start}-${range.end}/${info.size}`,'Content-Length':range.end-range.start+1});
      }else res.writeHead(200);
      await pipeline(createReadStream(file,range||undefined),res);
      return;
    }
    res.writeHead(200);
    res.end(await readFile(file));
  }catch{
    if(res.headersSent){res.destroy();return;}
    res.removeHeader('Content-Length');res.removeHeader('Content-Range');
    res.writeHead(404,{'Content-Type':'text/plain'}).end(req.method==='HEAD'?undefined:'Not found');
  }
});
export {server};
server.listen(Number(process.env.PORT||4335),'0.0.0.0',()=>console.log('Soraine dashboard ready'));
process.on('SIGTERM',()=>server.close());
