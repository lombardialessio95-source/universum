#!/usr/bin/env python3
"""Collaudo opzionale con Chromium/Playwright: grafica identica, lobby nera.
Uso: python3 tests/verify_browser_cpu.py /percorso/backup/universum-main
Il confronto pixel-per-pixel necessita del checkout del commit precedente.
Non fa parte delle suite Node/GitHub Actions e non richiede rete.
"""
from pathlib import Path
from sys import argv
import re
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
BASE = Path(argv[1]).resolve() if len(argv) > 1 else None


def sanitized_app(root):
    html = (root/'app.html').read_text(encoding='utf-8')
    html = re.sub(r'<script\b[^>]*>.*?</script>', '', html, flags=re.S | re.I)
    return re.sub(r'<link\b[^>]*>', '', html, flags=re.I)


def capture(browser, root, planet):
    page = browser.new_page(viewport={'width': 375, 'height': 812})
    page.set_content('<html><body><section id="screen-game"><canvas id="overview-planet-canvas" width="170" height="170"></canvas></section></body></html>')
    page.evaluate('''() => {
      window.UniversumUI={state:{planetAnimId:null,planetAnimAngle:0,currentView:'overview'}};
      let next=1;const slots=new Map();
      window.requestAnimationFrame=cb=>{const id=next++;slots.set(id,cb);return id;};
      window.cancelAnimationFrame=id=>slots.delete(id);
      window.__step=ts=>{const item=slots.entries().next().value;if(item){slots.delete(item[0]);item[1](ts);}};
      window.__pending=()=>slots.size;
    }''')
    page.add_script_tag(path=str(root/'modules/ui/planet-canvas.js'))
    page.evaluate('(planet)=>window.UniversumUI.startPlanetCanvas(planet)', planet)
    frames=[]
    for ts in [100,145,190,235,280,325,370]:
        page.evaluate('(ts)=>window.__step(ts)', ts)
        frames.append(page.locator('#overview-planet-canvas').evaluate('(el)=>el.toDataURL("image/png")'))
    if root == ROOT:
        page.evaluate('''() => {Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));}''')
        assert page.evaluate('window.__pending()') == 0, 'RAF deve fermarsi in background'
        page.evaluate('''() => {Object.defineProperty(document,'hidden',{configurable:true,get:()=>false});document.dispatchEvent(new Event('visibilitychange'));}''')
        assert page.evaluate('window.__pending()') == 1, 'RAF deve riprendere una sola volta'
        page.evaluate('''() => {document.dispatchEvent(new Event('visibilitychange'));}''')
        assert page.evaluate('window.__pending()') == 1, 'nessun RAF duplicato'
        page.evaluate('window.UniversumUI.stopPlanetCanvas()')
        assert page.evaluate('window.__pending()') == 0, 'cleanup frame'
    page.close()
    return frames


def main():
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True, executable_path='/usr/bin/chromium', args=['--no-sandbox'])
        variants=[('standard',{'maxTemp':25,'fieldsMax':210}),
                  ('freddo con Luna',{'maxTemp':-35,'fieldsMax':300,'moon':{'name':'Luna'}}),
                  ('caldo con Bacino',{'maxTemp':75,'fieldsMax':275,'bacinoSpaziale':{'status':'active'}})]
        if BASE:
            for name,planet in variants:
                assert capture(browser, BASE, planet)==capture(browser, ROOT, planet), f'Differenza grafica: {name}'
                print('PIXEL IDENTICI:',name,'7 frame')
        for width in [1440,375,320]:
            page=browser.new_page(viewport={'width':width,'height':812})
            page.set_content(sanitized_app(ROOT),wait_until='domcontentloaded',timeout=8000)
            page.add_style_tag(path=str(ROOT/'style.css'))
            info=page.evaluate('''()=>({background:getComputedStyle(document.body).backgroundColor,
              starfield:!!document.querySelector('#starfield'),overflow:document.documentElement.scrollWidth>innerWidth})''')
            assert info=={'background':'rgb(0, 0, 0)','starfield':False,'overflow':False}, (width,info)
            print('LOBBY NERA',width,info)
            page.close()
        # Entrata offline e online in runtime reale con servizi simulati: nessun RAF stellato.
        page=browser.new_page()
        page.set_content('<html><body class="lobby-black"><section id="screen-lobby"></section><section id="screen-game" class="hidden"></section></body></html>')
        page.evaluate('''() => {
          window.__raf=0;
          window.requestAnimationFrame=()=>{window.__raf++;return window.__raf;};
          window.cancelAnimationFrame=()=>{};
          window.UniversumUI={state:{currentView:'overview',planetAnimId:null},
            stopChatListeners(){},updateCommBadges(){},playSound(){},
            refreshPlanetSelector(){},updateTopBarNumbers(){},switchView(){},
            startGameLoop(){},toast(){},renderCurrentView(){}};
          window.UniversumEngine={processOfflineProgress:()=>({offlineSeconds:0})};
          window.UniversumGalaxy={processFleetsAndBots(){}};
        }''')
        page.add_script_tag(path=str(ROOT/'modules/ui/runtime.js'))
        for multiplayer in [False, True]:
            result=page.evaluate('''(multiplayer)=>{
              const universe={id:'test',speed:1,planets:[{id:'earth',coords:{g:1,s:1,p:1}}],incomingAttacks:[]};
              window.UniversumUI[multiplayer?'startOnlineGame':'startGame'](universe);
              return {backgroundClass:document.body.classList.contains('lobby-black'),starfield:!!document.getElementById('starfield'),raf:window.__raf};
            }''', multiplayer)
            assert result=={'backgroundClass':False,'starfield':False,'raf':0},result
            print('INGRESSO', 'MULTIPLAYER' if multiplayer else 'OFFLINE', 'RAF stellato 0 (mock servizi)')
        page.close()
        browser.close()
    print('CHROMIUM: test terminati con successo (no Firebase reale).')


if __name__=='__main__': main()
