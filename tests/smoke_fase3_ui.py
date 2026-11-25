#!/usr/bin/env python3
"""Chromium/Playwright: pannello hangar e incursione su desktop e mobile.
Isola il componente originale con motore/salvataggi simulati; NON prova Firebase reale.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
with sync_playwright() as pw:
    browser=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    for width in (1440,375,320):
        page=browser.new_page(viewport={'width':width,'height':850})
        page.set_content('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="viewport" style="max-width:100%;overflow-x:hidden"></div></body></html>')
        page.add_style_tag(path=str(root/'style.css'))
        page.evaluate('''() => {
          const planet={id:'terra',name:'Terra',coords:{g:1,s:1,p:2},fleet:{mothership:2,lightFighter:60},resources:{metal:50000,crystal:50000,deuterium:50000}};
          window.UniversumDB={save:async()=>{}};
          window.UniversumData={SHIPS:{mothership:{id:'mothership',name:'Nave Madre',cargo:50000},lightFighter:{id:'lightFighter',name:'Caccia Leggero',cargo:50}}};
          window.UniversumGalaxy={calculateDistance:()=>2000,getFleetSpeedAndFuel:()=>({fuelCost:500,durationSec:1000}),getInvictusJumpCost:()=>0};
          window.UniversumMissionsCore=null;
          window.UniversumSiege=null;
          const state={currentUniverse:{speed:1,galaxies:9,systemsPerGalaxy:499,planets:[planet],researches:{},fleetsInFlight:[]},
            fleetSelection:{mothership:1},fleetTarget:{g:1,s:2,p:2},fleetCargo:{metal:0,crystal:0,deuterium:0},
            fleetFuelPercent:100,fleetExploreHours:1,fleetMission:'incursion',fleetHangarIds:[],isMultiplayerMode:false};
          window.UniversumUI={state,escapeHTML:x=>String(x).replace(/[&<>\"]/g,''),formatNum:x=>String(x),
            formatDuration:x=>String(x),svgIcon:()=>'',artTag:()=>'',resIconTag:()=>'',
            getActivePlanet:()=>planet,getActivePlanetIndex:()=>0,
            updateTopBarNumbers(){},toast(){},renderCurrentView(){this.renderFleet(document.getElementById('viewport'))}};
        }''')
        page.add_script_tag(path=str(root/'modules/galaxy/hangars.js'))
        page.add_script_tag(path=str(root/'modules/ui/fleet.js'))
        page.evaluate('window.UniversumUI.renderCurrentView()')
        assert page.locator('.mother-hangar-row').count()==2
        assert page.locator('#flt-mission-select option[value="incursion"]').count()==1
        assert page.locator('.mother-hangar-load').count()==2
        assert page.locator('text=HANGAR NAVI MADRE').count()==1
        page.locator('.mother-hangar-amount').first.fill('20')
        page.locator('.mother-hangar-load').first.click()
        page.wait_for_timeout(50)
        result=page.evaluate('''()=>({fighters:window.UniversumUI.getActivePlanet().mothershipHangars[0].fighters,
          free:window.UniversumUI.getActivePlanet().fleet.lightFighter,
          overflow:document.documentElement.scrollWidth>innerWidth,
          selected:document.getElementById('flt-mission-select').value})''')
        assert result=={'fighters':20,'free':40,'overflow':False,'selected':'incursion'},(width,result)
        print('FASE 3 UI',width,'px: hangar/carica/missione OK, nessun overflow')
        page.close()
    browser.close()
