import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
// This opens an isolated test browser, never the user's authenticated Chrome profile.
import {chromium,baseUrl} from './browser-runtime.mjs';
const browser=await chromium.launch({channel:'chrome',headless:true});
await mkdir('qa',{recursive:true});
const page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
try {
  const response=await page.goto(baseUrl+'/',{waitUntil:'networkidle'});
  assert.equal(response.status(),200);
  await page.getByRole('heading',{name:'Follow the evidence.'}).waitFor();
  await page.screenshot({path:'qa/home.png',fullPage:true});
  await page.getByRole('button',{name:'Ultem · Moon vs Mars'}).click();
  await page.getByRole('heading',{name:'One material. Two worlds.'}).waitFor();
  await page.locator('.evidence-card.mars').waitFor();
  await page.waitForTimeout(1000);
  await page.screenshot({path:'qa/comparison.png',fullPage:true});
  await page.getByRole('button',{name:'Explore Moon evidence'}).click();
  await page.getByRole('dialog').waitFor();
  await page.waitForTimeout(700);
  await page.screenshot({path:'qa/evidence.png',fullPage:true});
  assert.equal(errors.length,0,errors.join('\n'));
  console.log(JSON.stringify({ok:true,errors,title:await page.title()}));
} finally {await writeFile('qa/browser-errors.json',JSON.stringify(errors,null,2));await browser.close();}
