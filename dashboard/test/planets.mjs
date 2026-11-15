import {mkdir, writeFile} from 'node:fs/promises';
import {dirname, resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
let playwright;
try { playwright=await import('playwright'); }
catch { playwright=await import(pathToFileURL(resolve(dirname(process.execPath),'../node_modules/playwright/index.mjs'))); }
const browser=await playwright.chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1536,height:1080},reducedMotion:'reduce'});
const errors=[],failedAssets=[],checks=[];
page.on('pageerror',error=>errors.push(error.message));
page.on('console',msg=>{if(msg.type()==='error')errors.push(msg.text());});
page.on('response',response=>{if(response.url().includes('/assets/')&&!response.ok())failedAssets.push(response.url());});
await mkdir('qa',{recursive:true});
try {
  for (const world of ['earth','moon','mars']) {
    await page.goto((process.env.SORAINE_TEST_URL||'http://127.0.0.1:4335')+'/?world='+world,{waitUntil:'networkidle'});
    await page.locator('#globe canvas').waitFor();
    await page.waitForTimeout(500);
    assert.equal(await page.locator('#rotate-toggle').getAttribute('aria-label'),'Resume rotation');
    await page.screenshot({path:`qa/planet-${world}.png`,fullPage:true});
    const before=await page.locator('#globe').screenshot();
    await page.getByRole('button',{name:'Zoom in',exact:true}).click();
    const after=await page.locator('#globe').screenshot();
    assert.notDeepEqual(before,after,world+' responds to zoom');
    await page.getByRole('button',{name:'Reset globe',exact:true}).click();
    checks.push(world+' renders and zooms without shader errors');
  }
  // A cached environment switch must keep the actual canvas/context and perform
  // no further image requests. Exercise both planetary and orbital contexts.
  await page.evaluate(()=>{window.planetCanvas=document.querySelector('#globe canvas');window.planetContextLosses=0;window.planetCanvas.addEventListener('webglcontextlost',()=>window.planetContextLosses++)});
  for(const world of ['Earth','Moon','Mars','Microgravity']){
    await page.getByRole('button',{name:world,exact:true}).click();
    await page.locator(`#globe[data-globe-world="${world}"][data-globe-state="ready"]`).waitFor();
  }
  const resourceCount=await page.evaluate(()=>performance.getEntriesByType('resource').filter(r=>r.name.includes('/assets/')).length);
  for(const world of ['Moon','Mars','Earth','Microgravity','Moon','Mars']){
    await page.getByRole('button',{name:world,exact:true}).click();
    await page.locator(`#globe[data-globe-world="${world}"][data-globe-state="ready"]`).waitFor();
    assert.equal(await page.evaluate(()=>window.planetCanvas===document.querySelector('#globe canvas')),true);
  }
  assert.equal(await page.evaluate(()=>window.planetContextLosses),0);
  assert.equal(await page.evaluate(()=>performance.getEntriesByType('resource').filter(r=>r.name.includes('/assets/')).length),resourceCount);
  checks.push('all four environments reuse one canvas without repeat asset requests or context loss');
  assert.deepEqual(failedAssets,[]);
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({checks,errors,failedAssets},null,2));
} finally {
  await writeFile('qa/planets-report.json',JSON.stringify({checks,errors,failedAssets},null,2));
  await browser.close();
}
