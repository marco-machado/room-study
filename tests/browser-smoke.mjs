import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';

const output='/tmp/room-study-qa';
await fs.mkdir(output,{recursive:true});
const browser=await chromium.launch({
  executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,
  args:['--no-sandbox','--enable-unsafe-webgpu','--use-angle=swiftshader','--use-vulkan=swiftshader','--enable-features=Vulkan','--disable-vulkan-surface','--ignore-gpu-blocklist','--disable-gpu-watchdog','--disable-gpu-compositing'],
});
const page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1});
const errors=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('console',m=>{if(m.type()==='error'||(m.type()==='warning'&&/invalid|Error while parsing/.test(m.text())))errors.push(m.text())});
async function settled(){
  await page.waitForFunction(()=>window.roomViewer&&!window.roomViewer.transition&&!window.roomViewer.dirty&&!window.roomViewer.framePending,{timeout:60000});
}
async function snapshot(name){
  await settled();
  // Chromium's headless SwiftShader compositor omits WebGPU canvas layers in screenshots.
  // Read back the same rendered canvas for the screenshot, then restore the live viewer.
  await page.evaluate(()=>{
    const v=window.roomViewer;v.renderer.setAnimationLoop(null);v.renderFrame();
    const image=new Image();image.id='qa-readback';image.src=v.renderer.domElement.toDataURL();
    image.style.cssText='position:absolute;inset:0;width:100%;height:100%;pointer-events:none';
    document.querySelector('#viewport').append(image);
  });
  await page.screenshot({path:`${output}/${name}.png`});
  await page.evaluate(()=>{document.querySelector('#qa-readback').remove();window.roomViewer.renderer.setAnimationLoop(window.roomViewer.animate)});
}
try {
  await page.goto(process.env.APP_URL||'http://127.0.0.1:5173');
  await page.waitForSelector('body.ready',{state:'attached',timeout:60000});
  await page.waitForSelector('#loading',{state:'hidden'});
  assert.equal(await page.evaluate(()=>window.roomViewer.renderer.backend.isWebGPUBackend),true);
  assert.equal(await page.evaluate(()=>window.roomViewer.renderer._getFallback),null);
  await snapshot('entrance');
  console.log('PASS: WebGPU-only rendering and first view');
  for(const view of ['living','kitchen']){
    await page.locator(`[data-view="${view}"]`).click();await settled();
    assert.equal(await page.evaluate(()=>window.roomViewer.activeView),view);
    await snapshot(view);
  }
  console.log('PASS: viewpoint transitions');
  await page.locator('#plan-button').click();await settled();
  assert.equal(await page.evaluate(()=>window.roomViewer.mode),'plan');
  assert.equal(await page.evaluate(()=>window.roomViewer.room.overhead.visible),false);
  await snapshot('floor-plan');
  await page.locator('[data-view="entry"]').click();await settled();
  await page.locator('#light-button').click();await page.locator('#light-button').click();
  assert.equal(await page.locator('#light-name').innerText(),'Evening');
  await snapshot('evening');
  await page.locator('#light-button').click();
  await page.locator('#settings-button').click();
  await page.locator('#door-toggle').click();
  await page.waitForFunction(()=>window.roomViewer.room.door.rotation.y<0.01);
  assert.equal(await page.locator('#door-toggle').getAttribute('aria-checked'),'false');
  await page.locator('#light-range').fill('62');
  assert.equal(await page.locator('#light-value').innerText(),'62%');
  await page.locator('#door-toggle').click();
  await page.locator('#close-settings').click();
  console.log('PASS: floor plan, lighting, door and settings controls');
  await page.locator('#viewport canvas').click({position:{x:700,y:500}});
  const before=await page.evaluate(()=>window.roomViewer.camera.position.toArray());
  await page.keyboard.down('w');await page.waitForTimeout(400);await page.keyboard.up('w');
  const after=await page.evaluate(()=>window.roomViewer.camera.position.toArray());
  assert.ok(Math.hypot(before[0]-after[0],before[2]-after[2])>0.15);
  await page.locator('#reset-button').click();await settled();
  assert.ok(await page.evaluate(()=>Math.abs(window.roomViewer.camera.position.z-1.35)<0.001));
  await page.locator('#info-button').click();assert.equal(await page.locator('#about-panel').isVisible(),true);
  await page.keyboard.press('Escape');assert.equal(await page.locator('#about-panel').isVisible(),false);
  console.log('PASS: keyboard navigation, reset and information panel');
  await page.setViewportSize({width:390,height:844});await settled();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  assert.equal(await page.locator('.mobile-movement').isVisible(),true);
  await page.locator('[data-move="forward"]').click();
  await snapshot('mobile');
  console.log('PASS: responsive mobile layout and touch controls');
  assert.deepEqual(errors,[]);
  console.log('PASS: no browser or WebGPU validation errors');
  const unsupported=await browser.newPage();
  await unsupported.addInitScript(()=>Object.defineProperty(navigator,'gpu',{value:undefined,configurable:true}));
  await unsupported.goto(process.env.APP_URL||'http://127.0.0.1:5173');
  await unsupported.waitForSelector('#loading.error');
  assert.match(await unsupported.locator('#loading-message').innerText(),/WebGPU is not available/);
  assert.equal(await unsupported.locator('#viewport canvas').count(),0);
  await unsupported.close();
  console.log('PASS: clear unsupported-browser state without a WebGL fallback');
  console.log(`Screenshots: ${output}`);
}finally{await browser.close()}
