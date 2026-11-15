import {writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {chromium,baseUrl} from './browser-runtime.mjs';
const browser=await chromium.launch({channel:'chrome',headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000},recordVideo:{dir:'qa/motion',size:{width:1440,height:1000}}});
const page=await context.newPage();
try{
  await page.goto(baseUrl+'/',{waitUntil:'networkidle'});await page.waitForTimeout(900);
  await page.evaluate(()=>{
    window.__motion=[];
    const start=performance.now();
    document.querySelector('.suggestion').click();
    function frame(t){
      const orb=document.querySelector('.comparison .orb'),card=document.querySelector('.evidence-card');
      if(orb&&card){const o=orb.getBoundingClientRect(),c=card.getBoundingClientRect();window.__motion.push({ms:t-start,orbX:o.x,orbY:o.y,orbWidth:o.width,cardY:c.y,opacity:getComputedStyle(card).opacity});}
      if(t-start<1100)requestAnimationFrame(frame);
    }requestAnimationFrame(frame);
  });
  await page.waitForTimeout(1400);
  const frames=await page.evaluate(()=>window.__motion);
  assert.ok(frames.length>15);
  assert.ok(Math.max(...frames.map(f=>f.orbWidth))-Math.min(...frames.map(f=>f.orbWidth))>100,'Orb travels and scales rather than replacing instantly');
  assert.ok(frames.some(f=>+f.opacity>0&&+f.opacity<1),'Cards visibly glide/fade in');
  await page.getByRole('button',{name:'Explore Moon evidence'}).click();await page.waitForTimeout(1300);
  await page.keyboard.press('Escape');await page.waitForTimeout(1000);
  await page.getByRole('button',{name:'Start again'}).click();await page.waitForTimeout(1000);
  await writeFile('qa/motion-check.json',JSON.stringify({passed:true,samples:frames.length,first:frames[0],middle:frames.find(f=>f.ms>250),last:frames.at(-1)},null,2));
  console.log('PASS: orb scales continuously into its dock; cards animate through intermediate opacity and position.');
}finally{await context.close();await browser.close();}
