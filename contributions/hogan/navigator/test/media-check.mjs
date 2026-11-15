import {chromium,baseUrl} from './browser-runtime.mjs';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}});
  await page.goto(baseUrl+'/',{waitUntil:'networkidle'});
  await page.waitForFunction(()=>document.querySelector('.orb video')?.currentTime>.3);
  const info=await page.locator('.orb video').evaluate(v=>({playing:!v.paused,muted:v.muted,loop:v.loop,width:v.videoWidth,duration:v.duration}));
  assert.equal(info.playing,true);assert.equal(info.muted,true);assert.equal(info.loop,true);assert.equal(info.width,512);assert.ok(info.duration<8);
  await page.screenshot({path:'qa/home.png',fullPage:true});
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.locator('.orb img').waitFor();assert.equal(await page.locator('.orb video').count(),0);
  await page.close();
  const fallback=await browser.newPage();await fallback.route('**/media/*',route=>route.abort());
  await fallback.goto(baseUrl+'/',{waitUntil:'networkidle'});
  await fallback.waitForFunction(()=>document.querySelector('.orb canvas')?.style.opacity==='1'&&!document.querySelector('.orb video'));
  const a=await fallback.locator('.orb canvas').evaluate(c=>c.toDataURL());await fallback.waitForTimeout(200);const b=await fallback.locator('.orb canvas').evaluate(c=>c.toDataURL());assert.notEqual(a,b);
  console.log(JSON.stringify({passed:true,media:info,checks:['Local video plays silently and loops','Reduced motion uses still poster','Failed media uses animated procedural fallback']}));
}finally{await browser.close();}
