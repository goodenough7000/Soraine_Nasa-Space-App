import assert from 'node:assert/strict';
import {chromium,baseUrl} from './browser-runtime.mjs';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}});
  await page.goto(baseUrl+'/integration-demo.html');
  await page.getByText('Ready',{exact:true}).waitFor();
  const app=page.frameLocator('#research');
  for(const scene of ['Moon','Mars']){
    await page.getByRole('button',{name:`Inspect ${scene} Ultem`}).click();
    await app.getByRole('dialog').waitFor();
    assert.match(await app.getByRole('dialog').innerText(),scene==='Moon'?/0.16 g/:/0.38 g/);
    // Incoming 30% cabin oxygen must not replace either reported oxygen endpoint.
    assert.match(await app.getByRole('dialog').innerText(),scene==='Moon'?/19.9/:/21.1/);
    await app.getByRole('button',{name:`Return to ${scene} scene`}).click();
    await page.getByText(`Returned to ${scene.toLowerCase()} · 30% cabin oxygen`,{exact:true}).waitFor();
    const selection=await page.evaluate(()=>window.lastReturnedSelection);
    assert.equal(selection.objectId,'sample-ultem');assert.equal(selection.atmosphereId,'illustrative-enriched');assert.equal(selection.cabinOverrides.pressure_kpa_absolute,70.3);
    await app.getByRole('button',{name:'Back to comparison'}).click();
    await app.getByRole('dialog').waitFor({state:'hidden'});
  }
  console.log('PASS: both scene handoffs and return callbacks preserve cabin context without changing research values.');
}finally{await browser.close();}
