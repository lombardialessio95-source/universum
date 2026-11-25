/** Avviare con Playwright e un Chromium installati; nessuna connessione a Firebase. */
'use strict';
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const {chromium} = require('playwright');
const root = path.resolve(__dirname,'..');
const server = http.createServer((req,res)=>{
  const file=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname);
  if (!file.startsWith(root+path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {res.writeHead(404).end();return;}
  res.setHeader('Content-Type',({'.js':'application/javascript','.html':'text/html','.css':'text/css','.json':'application/json'})[path.extname(file)] || 'application/octet-stream');
  fs.createReadStream(file).pipe(res);
});
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const browser=await chromium.launch({executablePath:process.env.CHROME_BIN || undefined,args:['--no-sandbox','--no-zygote','--single-process','--disable-dev-shm-usage']});
  try {
    const ctx=await browser.newContext({serviceWorkers:'block'});
    for(const [width,height] of [[1280,800],[390,844]]) {
      const page=await ctx.newPage({});await page.setViewportSize({width,height});
      const errors=[];page.on('pageerror',error=>errors.push(error.message));
      await page.route(/^https:/,route=>route.abort());
      await page.goto('http://127.0.0.1:'+server.address().port+'/app.html?release='+require('../release-manifest.json').version);
      await page.evaluate(async()=>{
        const UI=window.UniversumUI,E=window.UniversumEngine;
        const u=await window.UniversumDB.create({name:'Test Fase 2',emperor:'Test',speed:1,botMode:'peaceful',startTier:'millionaire'});
        const p=u.planets[0];Object.assign(p.buildings,{shipyard:8,roboticsFactory:8,researchLab:10});
        Object.assign(u.researches,{computerTech:8,impulseDrive:3,combustionDrive:1});
        p.fleet.hephaestusForge=1;p.fleet.prometheusOracle=1;
        E.startBuilding(u,0,'metalStorage');E.buildUnits(u,0,'lightFighter',25);E.buildUnits(u,0,'lightFighter',75);
        UI.startGame(u);UI.switchView('shipyard');
        const art1=UI.artTag('hephaestusForge'),art2=UI.artTag('prometheusOracle');
        if(art1===art2 || !art1.includes('data:image') || art1!==UI.artTag('hephaestusForge')) throw Error('Asset non valido');
        UI.switchView('overview');
      });
      const panel=page.locator('#work-orders');if (width<=640) {
        await panel.locator('select[data-choice="hephaestusForge"]').selectOption('crystalStorage');
      } else {
        const trigger=panel.locator('.uni-select-trigger').first();
        await trigger.scrollIntoViewIfNeeded();await trigger.click();
        await page.locator('.uni-select-menu.open .uni-select-option').filter({hasText:'Deposito di Cristallo'}).click();
      }
      await panel.locator('[data-add="hephaestusForge"]').click();
      await panel.getByText('In attesa',{exact:false}).first().waitFor();
      assert(await panel.getByText('75 residue',{exact:false}).count());
      page.once('dialog',d=>d.accept());
      await panel.locator('[data-action=cancel][data-paid=false]').click();
      await page.waitForFunction(()=>!document.querySelector('[data-action=cancel][data-paid=false]'));
      await page.evaluate(()=>{
        window.frameBaseline={canvas:document.querySelector('#overview-planet-canvas'),row:document.querySelector('[data-orders] > .glass-panel'),raster:0,
          text:document.querySelector('#work-orders .live-timer').textContent};
        const original=HTMLCanvasElement.prototype.toDataURL;
        HTMLCanvasElement.prototype.toDataURL=function(...a){window.frameBaseline.raster++;return original.apply(this,a);};
      });
      const cdp=await ctx.newCDPSession(page);await cdp.send('Performance.enable');
      const metrics=async()=>Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(x=>[x.name,x.value]));
      const start=await metrics();
      await page.waitForFunction(()=>window.frameBaseline.text!==document.querySelector('#work-orders .live-timer').textContent);
      await page.waitForTimeout(2200);
      const end=await metrics();
      const result=await page.evaluate(()=>({
        canvas:document.querySelector('#overview-planet-canvas')===window.frameBaseline.canvas,
        row:document.querySelector('[data-orders] > .glass-panel')===window.frameBaseline.row,
        regenerated:window.frameBaseline.raster,
        overflow:document.documentElement.scrollWidth>window.innerWidth,
        timers:document.querySelectorAll('#work-orders .live-timer').length
      }));
      assert(result.canvas && result.row && !result.overflow && result.timers>=3);assert.equal(result.regenerated,0);assert.deepEqual(errors,[]);
      console.log(width+'x'+height,JSON.stringify({...result,taskMs:Math.round((end.TaskDuration-start.TaskDuration)*1000),heapDelta:end.JSHeapUsedSize-start.JSHeapUsedSize}));
      await page.close();
    }
    if (process.env.FIRESTORE_EMULATOR_HOST) await require('./helpers/multiplayer-smoke')(ctx,
      'http://127.0.0.1:'+server.address().port+'/app.html?release='+require('../release-manifest.json').version);
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>server.close());
