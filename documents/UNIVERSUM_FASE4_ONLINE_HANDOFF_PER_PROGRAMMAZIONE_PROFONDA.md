# UNIVERSUM — Fase 4 online, Opzione C — Passaggio di consegne
**Data:** 25 novembre 2026  
**Stato:** candidata funzionale in ramo separato, **NON COLLAUDATA END-TO-END, NON PUBBLICABILE IN PRODUZIONE**.

## 1. Decisione del direttore
La Fase 4 online adotta **Opzione C — Fortezza Volante**: fino a tre Navi Madri Supreme, capienza **4.000 slot per Suprema ONLINE**, costruzione e rifornimento da inventario del giocatore, missione di attacco **singola** con una fase orbitale e una fase planetaria, poi rientro. Non ci sono assedi persistenti, ondate ripetute, Supporto Orbitale o Controffensiva speciale online. Il motore **OFFLINE** conserva integralmente le regole precedenti e **600 slot**.

## 2. Base, ramo, backup
Repository `lombardialessio95-source/universum`. Main controllato prima dell'intervento: `12a8d79f8802f06d2e22f11f4991094368bb4775`.
- Backup nuovo: `backup/pre-fase4-online-opzione-c-2026-11-25`, stesso SHA della base.
- Backup storico: `backup/pre-fase4-suprema-2026-11-25`, `a2692426ed4a4dd14f20e6cda0d5e89bb4b8fd3a`.
- Ramo candidato: `feature/fase4-online-opzione-c-2026-11-25`.
- `main` e il backup sono stati lasciati invariati. Nessun deploy Firebase o rilascio pubblico effettuato.
- Il file storico `UNIVERSUM_Fase4_Passaggio_Multiplayer.md` non era presente nel percorso previsto su `main`; consultati invece i rapporti di staging recupero/riservatezza presenti in `documents/`.

## 3. File aggiunti, modificati e invariati
**Aggiunti:** `services/suprema/option-c-inventory.js` (capienza, carico puro), `services/suprema/option-c-yard.js` (cantiere interno online), `services/suprema/option-c-battle.js` (attacco unico con il motore a 6 round), `services/suprema/option-c-service.js` (transazioni privilegiate), `modules/online/suprema-option-c.js` (client/pannello staging), `tests/test_suprema_option_c_inventory.js`, `tests/test_suprema_option_c_flow.js` e presente handoff.

**Modificati solo per integrazione Opzione C:** `services/suprema/engine.js` (esporta combattimento e volo esistenti), `services/suprema/functions.js` (callable protetta), `tools/package_suprema_staging.py` (include moduli nuovi), `firestore.rules` (nega browser su inventari, missioni e ricevute), `app.html` (carica modulo client), `modules/online/universes.js` (legge flag staging), `modules/ui/runtime.js` (recupero una volta al join), `modules/ui/fleet.js` (pulsante gestione Supreme in staging).

**Non modificati:** `modules/engine/suprema.js`, `modules/galaxy/suprema-siege.js`, moduli combattimento generale, salvataggi offline, Invictus, Crepuscolo, Galattiche, economia e grafica.

## 4. Servizi obsoleti da NON ripristinare
`services/suprema/launch.js`, `recover.js`, `modules/online/siege-recovery.js` e `suprema-staging-client.js` sono rimasti nel repository per confronto e compatibilità, ma rappresentano il vecchio modello di **assedi online periodici**. Non sono il backend della nuova Opzione C. Il nuovo servizio rifiuta universi di staging in cui sia ancora attivo `supremaRecoveryStaging`.

## 5. Inventario online, costruzione e isolamento dall'offline
La nuova collezione privata `supremaOptionCPrivate/{uid}` conserva `ships[]` e `constructions[]`. Le tre Supreme totali comprendono le costruzioni in corso. Ogni Suprema ha ID stabile, stato, pianeta/coordinate origine, tre ruoli (`escort`, `invasion`, `reserve`), depositi, cantiere e missione collegata. Peso slot: Caccia Leggero 1, Pesante 3, Incrociatore 8, Battaglia 18, Bombardiere 22. Capienza **4.000**, inclusi gli ordini di produzione ancora in coda. Lo schema offline rimane completamente separato.

Costruzione con Bacino attivo e ricerche locali dal motore Fase 4; 40 rate giornaliere REALI (500.000 metallo, 300.000 cristallo, 200.000 deuterio). Annullamento con rimborso 50% delle rate già pagate. Il cantiere interno al livello 12 usa la formula ordinaria della costruzione di unità e scala secondo la velocità economica; non crea navi quando manca capienza o pagamento.

**Limite P0:** l'occupazione esclusiva del Bacino online non è ancora integrata nell'intero checkpoint delle altre megastrutture. Non dichiarare pronta la costruzione fino alla prova di conflitto con Invictus/Crepuscolo/Galattica e controllo delle regole.

## 6. Flusso utente disponibile nella candidata
Entrando in un universo di staging abilitato, `Flotta` mostra `Gestisci Supreme`. L'interfaccia invoca `optionCSuprema`, che riceve solo ID e comandi dell'utente autenticato. Costruzione, carico dal pianeta con debit nell'inbox canonica, assegnazione dei ruoli, deposito risorse, cantiere livello 12, lancio e rientro sono operazioni transazionali lato Admin. Il viaggio usa velocità militare, motore iperspaziale e formula ordinaria con consumo base 50.000; andata e ritorno sono prenotati alla partenza. Per semplificazione iniziale, **una Suprema per missione**.

Al primo accesso di un partecipante dopo l'arrivo, la callable risolve **un solo** combattimento orbitale, poi il combattimento planetario se previsto, massimo 6 round ciascuno e statistiche base 350.000/50.000/9.000.000. Perdite e sopravvivenza sono attribuite alla singola Suprema. Bottino massimo 50% risorse non protette, vincolato dalla stiva sopravvissuta e dai depositi disponibili. Una ricevuta impedisce il replay dello stesso evento; il rientro è una transizione distinta. Il ritorno alternativo verso una colonia ancora posseduta è selezionabile a mano se l'origine è persa.

Nessun trasferimento di scarico nave dalla Suprema al pianeta nella prima candidata: opzionale per specifica, omesso per limitare rischi. Nessuna accelerazione dei 40 giorni reali introdotta.

## 7. Sicurezza e disconnessioni
Il progetto Cloud Functions per la prova NON deve essere `universum-online`. Servono `UNIVERSUM_SUPREMA_STAGING=true`, universo con `supremaOptionCStaging=true` e `supremaRecoveryStaging=false`. Le regole negano lettura/scrittura dal browser a inventario/missioni/ricevute private; la vista pubblica è leggibile solo dai partecipanti. UID e orologio sono presi dal contesto privilegiato; la callable calcola il combattimento senza fidarsi di esiti inviati dal browser. Addebiti planetari vengono scritti tramite l'inbox per il normale checkpoint del multiplayer.

**Limiti di affidabilità aperti (P0):** il Firestore ordinario del gioco mantiene ancora la possibilità per il proprietario di modificare lato client campi economici del proprio pianeta; non è stata dimostrata l'impossibilità di falsificare l'inventario planetario di origine usando percorsi legacy. Non è stata verificata la serializzazione con tutti i comandi ordinari e i checkpoint simultanei. Non è garantita la ricostruzione storica esatta del pianeta al timestamp di arrivo se entrambi restano disconnessi: il primo recupero usa lo stato canonico più recente disponibile, e il risultato viene confermato al momento del recupero, non retrodatato. Questi limiti NON vanno occultati.

## 8. Test effettivamente svolti
- **PASS (simulazione transazionale JS, non Firestore):** 20 asserzioni nel nuovo test `tests/test_suprema_option_c_flow.js`, eseguite con moduli ufficiali del motore ricostruiti dalla versione GitHub e Firestore simulato. Coperti: rate e addebiti totali, capienza, carico stock, replay, assegnazioni, cantiere, lancio, rifiuto doppio lancio, singola risoluzione dal difensore, 6 round massimi, bottino non duplicato, rientro univoco, proprietà, annullamento con rimborso 50%.
- **PASS (motore reale in esecuzione JS):** battaglia orbitale+planetaria singola con massimo 6 round, e prova separata di ripartizione proporzionale 5.000 unità di stiva (1.668/1.666/1.666 in uno scenario senza bunker).
- **PASS statico:** compilazione JavaScript dei moduli nuovi e integrazioni client, confronto mirato dei file GitHub, backup/versione.
- **NON ESEGUITI:** Firefox/Chromium mobile/desktop reali; Firebase Emulator delle nuove operazioni; Cloud Functions staging deploy; regole Firebase su un progetto reale; test con due account veri; race multiprocesso Firestore; regressione completa delle suite ufficiali; test costi reali Firebase; profiling CPU/GPU/memoria reale; build PWA completa.
- Il precedente test di staging del vecchio assedio NON certifica la nuova Opzione C.

## 9. Prestazioni e problemi ancora aperti
Inventario e code lavorano su aggregati per tipo/ruolo, senza 4.000 documenti per ciascuna Suprema. Il client usa una sola chiamata al join e un timer singolo per la prossima scadenza; nessun intervallo di polling o RAF aggiuntivo. Il combattimento usa l'espansione delle unità già esistente: non sono disponibili misurazioni con 12.000 slot complessivi (tre missioni), né misure di letture/scritture Firebase. Query dei rapporti storici pubblici non ancora limitata/paginata. Possibile crescita della cronologia.

P0: collaudo Firebase Emulator + due account staging, protezioni anti-manomissione dei dati planetari legacy, coerenza dei checkpoint concorrenti e del Bacino. P1: preparazione del rilascio PWA e cache versionata, performance reali e alert missioni nel normale pannello movimenti. P2: scaricamento facoltativo delle navi.

## 10. Stato rilascio, preparazione e rollback
**Non pubblicata.** Main invariato; backup nuovo preservato. Le modifiche alle regole Firestore NON sono state deployate. Per preparare lo staging autorizzato, da checkout del ramo candidato:

```sh
python tools/package_suprema_staging.py /cartella/nuova/stage-opzione-c
cd /cartella/nuova/stage-opzione-c/functions
npm ci
```

Configurare poi un **progetto Firebase di staging separato**, variabile di ambiente `UNIVERSUM_SUPREMA_STAGING=true`, deploy esplicitamente autorizzato del callable `optionCSuprema` e delle regole, e attivare sul documento universo SOLO `supremaOptionCStaging=true` lasciando `supremaRecoveryStaging=false`. Non copiare credenziali/progetti di produzione nello staging. La disponibilità del piano Firebase, i permessi e l'ambiente necessario NON sono stati verificati qui. È stato prodotto uno **ZIP integrale dei sorgenti della candidata** (153 file originali + avviso, snapshot esatto commit `4931f57c4b03ca12ab6247922f4f173ae3938ad1`), presente nel ramo di lavoro in `builds/UNIVERSUM_FASE4_ONLINE_OPZIONE_C_CANDIDATA_4931f57c4b03.zip`, 1.784.614 byte, blob GitHub `d5bd88b2632a4db8034c50b1e3b588639bc507d9`. Tutte le dimensioni originali dei 153 sorgenti sono state verificate prima della creazione dello ZIP. **Non è una build distributiva collaudata**: `build_release.py` non è stato eseguito e mancano i test end-to-end. Il ramo resta protetto; nessun merge su main.

Rollback: nessuna operazione su main da annullare. Disabilitare i flag dello staging e ridistribuire l'ultima release/Rules verificate se i test falliscono; non toccare salvataggi offline.

## 11. Consegna a Programmazione Profonda al rientro
**LEGGERE QUESTO RAPPORTO, VERIFICARE HEAD E NON RIPRISTINARE ONDATE MULTIPLAYER.** Conservare l'Opzione C online e l'offline precedente. Non sostituire i lavori già integrati senza controllarne dipendenze e test. Proseguire soltanto dai P0, con l'obiettivo di certificare sicurezza/concorrenza e collaudo con due account veri prima di un eventuale merge su main.

## Prove manuali semplici per il direttore
Con account A e B **nell'universo di staging autorizzato**, A costruisce una Suprema (40 giorni reali e 40 rate; per provare subito occorre una Suprema già completata legittimamente in staging), carica alcuni Caccia già costruiti sul pianeta e verifica che il loro numero diminuisca. Poi riempie fino a 4.000 slot, tenta un'unità oltre il limite (deve essere rifiutata), assegna navi a Scorta/Invasione/Riserva e lancia contro B. B controlla che il proprio pianeta riceva perdite e rapporto, A controlla il rientro e l'assenza di navi duplicate. Ripetere aprendo due schede o ricaricando prima/dopo l'arrivo. Ripetere con entrambi disconnessi e accesso solo di B, annotando che il recupero è differito. Infine aprire un universo OFFLINE: capienza ancora 600 e assedi/offline invariati.

**Riepilogo onesto:** implementazione candidata molto più estesa del precedente modulo di inventario; 20 prove simulate superate. Restano rischi P0 non risolti e nessuna prova reale Firebase con due account. **NON dichiarare ONLINE COMPLETATO.**