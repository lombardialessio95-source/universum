// Controlli statici: NON sostituiscono test delle Security Rules nell'emulatore Firebase.
const fs = require('fs');
const assert = require('assert');
const path = require('path');
const base = path.resolve(__dirname, '..');
const rules = fs.readFileSync(path.join(base, 'firestore.rules'), 'utf8');
const js = fs.readdirSync(path.join(base, 'modules/online')).filter(x => x.endsWith('.js'))
  .map(x => fs.readFileSync(path.join(base, 'modules/online', x), 'utf8')).join('\n');
const checks = [
  ['creazione flotta collegata a origine propria', /function validHumanFleetCreate\(uniId,fleetId,d\)/.test(rules) && /d\.originKey==canonicalFleetKey\(d\.originCoords\)/.test(rules) && /validFleetPlanetOrigin\(uniId,d,ordinary\)/.test(rules) && /before\.ownerUid==request\.auth\.uid/.test(rules) && /after\.ownerUid==request\.auth\.uid/.test(rules)],
  ['modifica flotta limitata ai partecipanti', /allow update: if signedIn\(\) && fleetParty\(\)/.test(rules)],
  ['missione immutabile salvo richiamo proprio', /request\.resource\.data\.mission == resource\.data\.mission/.test(rules) && /mission == 'recall'/.test(rules)],
  ['blocco creazione NPC raid su terzi', /function validNpcRaidCreate\(uniId, fleetId\)/.test(rules) && /\.data\.ownerUid == request\.auth\.uid/.test(rules)],
  ['prova di flotta arrivata per conquista', /function hasArrivalEvidence\(uniId, planetId\)/.test(rules) && /lastResolutionFleetId/.test(rules)],
  ['prova conquista nel client', /upd\.lastResolutionFleetId = resolutionFleetId/.test(js)],
  ['risoluzione flotte limitata ai partecipanti', /const authorizedDocs = allSnap\.docs\.filter/.test(js)],
  ['migrazione e riparazione limitate ai partecipanti', /raw\.attackerUid !== uid && raw\.defenderUid !== uid/.test(js) && /fleet\.attackerUid !== uid && fleet\.defenderUid !== uid/.test(js)],
  ['privacy rapporti: solo destinatario', /allow read: if signedIn\(\)\s*&& resource\.data\.recipientUid == request\.auth\.uid;/.test(rules)],
  ['cache PWA con versione valida e file depositi incluso', fs.readFileSync(path.join(base,'sw.js'),'utf8').includes('universum-static-release-') && !!JSON.parse(fs.readFileSync(path.join(base,'release-manifest.json'),'utf8')).files['modules/ui/resource-deposits.js']],
];
for(const [label, value] of checks){ assert(value, 'Fallito: '+label); console.log('✓',label); }
console.log(`Controlli statici: ${checks.length}/${checks.length} superati`);
