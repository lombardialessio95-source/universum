'use strict';
const assert=require('node:assert/strict');
const http=require('node:http');
const path=require('node:path');
const {chromium}=require('playwright');
const {initializeApp,deleteApp}=require('firebase-admin/app');
const {getFirestore}=require('firebase-admin/firestore');
(async()=>{
  assert.equal(process.env.FIRESTORE_EMULATOR_HOST,'127.0.0.1:8080');
  const app=initializeApp({projectId:'demo-universum'});
  try {await getFirestore(app).doc('_diagnostic_preflight/availability').get();}
  finally {await deleteApp(app);}
  const server=http.createServer((req,res)=>{res.setHeader('content-type','text/html');res.end('<!doctype html><title>Preflight</title>');});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  let browser;
  try {
    browser=await chromium.launch({executablePath:process.env.CHROME_BIN,args:['--no-sandbox','--no-zygote','--single-process','--disable-dev-shm-usage']});
    const ctx=await browser.newContext({serviceWorkers:'block'});
    const page=await ctx.newPage();
    await page.route(/^https:/,route=>route.abort());
    await page.goto('http://127.0.0.1:'+server.address().port);
    assert(await page.evaluate(async()=>{
      if(!isSecureContext || typeof crypto.randomUUID!=='function')return false;
      await new Promise((ok,fail)=>{const req=indexedDB.open('diagnostic-preflight',1);req.onsuccess=()=>{req.result.close();ok();};req.onerror=()=>fail(req.error);});
      return true;
    }));
    for(const name of ['firebase-app-compat.js','firebase-firestore-compat.js'])
      await page.addScriptTag({path:path.join(process.env.FIREBASE_SDK_DIR,name)});
    await page.evaluate(async()=>{
      const db=firebase.initializeApp({projectId:'demo-universum',apiKey:'demo'},'preflight').firestore();
      db.settings({experimentalForceLongPolling:true});
      db.useEmulator('127.0.0.1',8080,{mockUserToken:{sub:'preflight',user_id:'preflight'}});
      const result=await db.collection('online_universes').limit(1).get({source:'server'});
      if(result.metadata.fromCache||result.metadata.hasPendingWrites)throw Error('Non-authoritative emulator read');
      await db.terminate();
    });
    console.log('PASS environment: localhost, secure context, IndexedDB, Chromium, Firebase Admin, SDK compat, authenticated Rules read');
  } finally {if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error(e);process.exitCode=1;});
