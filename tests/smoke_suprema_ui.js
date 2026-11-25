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
    const context=await browser.newContext({serviceWorkers:'block'});
    for (const width of [1280,390]) {
      const page=await context.newPage();
      const errors=[];
      page.on('pageerror',err=>errors.push(err.message));
      await page.setViewportSize({width,height:844});
      await page.route(/^https:/,route=>route.abort());
      await page.goto('http://127.0.0.1:'+server.address().port+'/app.html?release='+require('../release-manifest.json').version);
      await page.evaluate(async()=>{
        const UI=window.UniversumUI,S=window.UniversumSuprema;
        const u=await window.UniversumDB.create({name:'Test Fase 4',emperor:'Test',speed:1,botMode:'peaceful',startTier:'millionaire'});
        const p=u.planets[0];
        p.bacinoSpaziale={status:'active',invictusConstructions:[]};
        p.localResearches={...S.requirements};
        UI.startGame(u);
        UI.switchView('moon');
      });
      await page.getByRole('button',{name:'Costruisci Suprema',exact:true}).click();
      await page.getByText('0 / 40 rate',{exact:false}).waitFor();
      page.once('dialog',d=>d.accept());
      await page.getByRole('button',{name:'Annulla costruzione',exact:true}).click();
      await page.getByRole('button',{name:'Costruisci Suprema',exact:true}).waitFor();
      await page.evaluate(()=>{
        const UI=window.UniversumUI,S=window.UniversumSuprema,u=UI.state.currentUniverse,p=UI.getActivePlanet();
        p.resources={metal:30000000,crystal:30000000,deuterium:30000000};
        const start=Date.now()-40*S.DAY_MS;
        S.start(u,p,'ui-ship',start,0);
        S.settle(u,p,Date.now());
        p.fleet.lightFighter=10;
        UI.renderCurrentView();
      });
      await page.getByRole('button',{name:'Carica dal pianeta',exact:true}).click();
      await page.getByText('Hangar 1 / 600',{exact:false}).waitFor();
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      assert.deepEqual(errors,[]);
      console.log('Fase 4 UI',width,'px: avvio, annullamento, hangar e layout');
      await page.close();
    }
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>server.close());
