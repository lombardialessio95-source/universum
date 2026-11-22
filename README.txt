UNIVERSUM — VERSIONE MODULARE
Revisione: 22/11/2026

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
