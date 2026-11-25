UNIVERSUM — VERSIONE MODULARE
Revisione: 24/11/2026 — F01 fusione alimentata, 3% e Invictus (post depositi OGame)

Questo archivio contiene il gioco completo, non soltanto una patch.

CARTELLE PRINCIPALI
  modules/data/       Cataloghi di edifici, ricerche, navi e difese
  modules/engine/     Tempi, produzione, code e recupero offline
  modules/galaxy/     Generazione, combattimenti, flotte e BOT offline
  modules/offline/    Salvataggi IndexedDB e animazione lobby
  modules/online/     Firebase, PvP, sincronizzazione, chat e BOT online
  modules/ui/         Schermate e controlli di gioco
  documents/          Mappa tecnica, formule, changelog, audit e istruzioni
  tests/              Test locali con Node.js
  legacy/             Codice storico NON eseguito

FILE DI AVVIO
  index.html          Pagina principale, tag script in ordine
  style.css           Tema responsive
  sw.js               Cache PWA, tutte le risorse statiche
  firestore.rules     Regole da pubblicare a parte su Firebase

PUBBLICAZIONE SU GITHUB PAGES
  Carica TUTTO IL CONTENUTO della cartella universum-main nella directory
  dove si trova il tuo index.html pubblicato. Non omettere modules/.
  Se il repository ospita il sito nella radice, index.html deve restare
  nella radice: non aggiungere una cartella universum-main come nuovo livello.

FIREBASE
  Il file firestore.rules incluso è IDENTICO all'ultima versione
  aggiornata fornita. GitHub Pages NON applica queste regole: per renderle
  operative devi pubblicarle dalla Console Firebase, Firestore Database > Rules.
  Se avevi già pubblicato esattamente questa versione, non occorre ripubblicarla.

DOPO L'AGGIORNAMENTO
  La cache PWA usa un identificatore nuovo. Su dispositivi già installati
  riapri e aggiorna la pagina; se necessario chiudi e riapri la PWA.
  Prova una partita offline esistente e un universo online con due account.

TEST (Node.js, opzionale)
  node tests/test_moduli.js
  node tests/test_cache.js
  node tests/test_inbox.js
  node tests/test_moon_merchant.js
  node tests/test_security_static.js

IMPORTANTE
  Nessun dato offline viene cancellato dall'aggiornamento dei file.
  È comunque prudente esportare un salvataggio JSON prima di cambiare build.
  Sicurezza Firebase: le validazioni lato client non sono un anticheat
  completo. Per indicazioni tecniche consulta documents/mappa.txt e
  documents/audit sicurezza online.txt.

DEPOSITI INTERATTIVI (23/11/2026)
  Metallo, cristallo e deuterio nella barra superiore sono cliccabili:
  bordo stato, barra, percentuale, produzione e tempo fino al pieno.
  Il modulo e' in modules/ui/resource-deposits.js. Energia invariata.
  Le formule economiche e le regole Firestore non sono state modificate.
  Test: node tests/test_depositi.js
  Audit: documents/rapporto debug depositi.txt

FASE 1 — RICERCHE MISTE E BACINO (24/11/2026)
  Ricerche imperiali globali + singola ricerca planetaria indipendente per pianeta.
  Sei tecnologie locali (cinque Galattica e Ingegneria Megastrutturale).
  Rete Intergalattica conta solo laboratori liberi.
  Bacino nuovo con requisiti tecnologici, 20 giorni reali a rate invariati.
  Migrazione idempotente dai livelli Galattica globali; backup GitHub disponibile.
  Test: node tests/test_ricerche_miste.js
  Rapporto: documents/rapporto fase1 ricerche miste.txt

DEPOSITI OGAME (24/11/2026)
  Formula capacità ufficiale in data.js (Lv.0=10.000), uguale per i 3 depositi.
  Produzione online e offline applicano lo stesso helper di limitazione;
  non vengono cancellate le risorse preesistenti sopra soglia. Costi invariati.
  Test: node tests/test_depositi_ogame.js
  Rapporto: documents/rapporto depositi ogame.txt

F01 — FUSIONE, EFFICIENZA E INVICTUS (24/11/2026)
  Fusione nominale: floor(30 * L * (1.05 + 0.01 * energyTech)^L).
  L'energia della fusione dipende dal deuterio consumato realmente;
  se le riserve terminano, il tempo viene segmentato senza ricalcoli periodici extra.
  Minimo efficienza miniere: 3%, produzione base gratuita immutata.
  Invictus: fuelConsumption base 5000; viaggi e salti speciali con costi separati.
  Cache PWA aggiornata; nessuna modifica delle regole Firestore.
  Test: node tests/test_f01_fusion_invictus.js
  Audit: documents/rapporto f01 fusione e invictus.txt

AGGIORNAMENTI ATOMICI PWA (24 novembre 2026)
--------------------------------------------
Da questa versione, index.html e' un bootstrap leggero che controlla le
nuove release prima di aprire app.html. Il gioco originale e' in app.html.
La release e' identificata da un hash dei contenuti statici + codice del SW,
non dal commit Git: il badge mostra un ID univoco che inizia per 'r'.

Dopo ogni modifica al gioco e PRIMA di pubblicare:
  1) python3 tools/build_release.py
  2) node tests/test_cache.js
  3) node tests/test_auto_update.js
  4) node tests/test_update_client.js
  5) Esegui tutti gli altri tests/test_*.js.
  6) Pubblica insieme TUTTI i file, inclusi index.html, app.html,
     update-client.js, sw.js e release-manifest.json.

NON modificare manualmente l'ID in piu' file. Il generatore imposta manifest
e VERSIONE_RELEASE una sola volta, in modo riproducibile. La GitHub Action
verifica manifest e test; una pubblicazione con hash obsoleti viene rifiutata
in fase di installazione dal Service Worker (resta attiva la versione prima).

Per tornare alla versione precedente, usa il backup GitHub
backup/pre-auto-update-2026-11-24 o il relativo ZIP. Preferisci un nuovo
commit di revert invece di sovrascrivere la storia. NON cancellare i dati del
sito/IndexedDB e NON usare "Clear site data" per l'aggiornamento.

Guida: documents/rapporto aggiornamenti automatici.txt


AGGIORNAMENTO CPU E LOBBY — 24 novembre 2026
La lobby utilizza uno sfondo nero fisso (#000000): non carica piu' canvas o animazioni stellate.
Il pianeta mantiene il rendering originale con gradienti statici riutilizzati e RAF sospeso
fuori dalla panoramica o in background. Le code cantiere/difesa con durate intere vengono
avanzate per blocchi mantenendo tempi e quantita'; casi legacy restano sul percorso originale.
Laboratori e rendering UI evitano ricalcoli duplicati. Nessun cambiamento a formule,
combattimento, sincronizzazione online o IndexedDB.
Dopo ogni modifica a file statici: python3 tools/build_release.py, poi tutti i test.
Vedere documents/rapporto ottimizzazione cpu.txt.

FASE 3 — NAVI MADRE NORMALI (25/11/2026)
  Ogni Nave Madre normale conserva il proprio hangar ID, massimo 50 Caccia Leggeri.
  Carico/scarico manuali dalla schermata Flotta; caccia imbarcati fuori dallo stock
  orbitale ma sempre presenti nel punteggio. Incursione Planetaria: due battaglie
  indipendenti da massimo 3 round; bottino massimo 1000 x caccia recuperato,
  50% delle risorse non protette e stiva effettiva; ritorno automatico.
  Online: partenza/checkpoint revisionati, arrivo transazionale, ricevute
  inbox.hangarReturns e inbox.hangarLosses. Le regole firestore.rules aggiornate
  DEVONO essere pubblicate separatamente sul progetto Firebase operativo.
  Test: node tests/test_fase3_hangars.js, node tests/test_fase3_online.js
  Smoke visivo: python3 tests/smoke_fase3_ui.py (browser Chrome, DB simulato).
  Rapporto: documents/rapporto fase3 nave madre.txt
