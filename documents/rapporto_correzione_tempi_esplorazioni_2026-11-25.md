# UNIVERSUM — Rapporto completo: correzione tempi delle esplorazioni
**Data:** 25 novembre 2026 · **Priorità:** alta  
**Repository:** `lombardialessio95-source/universum`  
**HEAD ufficiale iniziale:** `12a8d79f8802f06d2e22f11f4991094368bb4775`  
**Backup:** `backup/pre-esplorazioni-tempi-2026-11-25` (stesso commit iniziale)  
**Sviluppo:** `feature/correzione-tempi-esplorazioni-2026-11-25`  
**Verifica GitHub:** [PR #2](https://github.com/lombardialessio95-source/universum/pull/2) · [CI completa superata](https://github.com/lombardialessio95-source/universum/actions/runs/45701470945)  
**Commit pubblicato su main:** da confermare dopo il merge (non anticipato).

## Problemi individuati
1. In `missions-core.js`, il richiamo somma le ore già trascorse in esplorazione al volo di ritorno.
2. `modules/online/fleet-control.js` ripete la stessa imprecisione e usa un aggiornamento non transazionale: due schede potrebbero riscrivere il rientro.
3. `modules/galaxy/fleet-dispatch.js` registra per le Galattiche solo andata e ritorno, non il tempo di permanenza; `modules/ui/ui-galattica.js` non lascia scegliere le ore.
4. Offline: `ore × 3600 / √velocità`. Online precedente: `ore × 3600 / velocità`.
5. Il resolver online, quando arriva in ritardo, aggiunge un nuovo tempo di ritorno dal momento di elaborazione.
6. Il movimento flotte continua a mostrare «ANDATA» durante lo stazionamento.

## Formula definitiva e timestamp
```text
durataEsplorazioneSecondi = max(15, floor(oreConsentite * 3600 / sqrt(velocitaEffettivaUniverso)))
arrivoZona                = partenza + durataAndata
fineEsplorazione          = arrivoZona + durataEsplorazione
rientroPrevisto           = fineEsplorazione + durataRitorno
```
- A **1x**: un'ora di andata + cinque ore in zona + un'ora di ritorno = **sette ore**.
- Il viaggio militare e i bonus propulsori NON cambiano.
- La durata selezionabile è **1 + livello expeditionTech**.
- Richiamo prima dell'arrivo: tempo equivalente alla distanza già coperta. Richiamo da zona esplorativa: **solo una tratta di ritorno**, nessuna ora di permanenza aggiunta.
- I nuovi voli persistono `travelDurationMs`, `returnTravelDurationMs`, `explorationHoldMs`, `zoneArrivalTime` ed `explorationEndTime`.
- Per compatibilità con il resolver preesistente, `arrivalTime` continua a indicare **la fine dello stazionamento**, mentre `returnTime` continua a indicare il rientro finale.

## Modifiche e perimetro
- `missions-core.js`: formula di permanenza unica, costruzione timeline, percorso di compatibilità con i vecchi timestamp, richiamo corretto.
- `siege-missions.js`: salva le fasi distinte per i lanci esplorativi dai pianeti senza cambiare ricompense.
- `modules/galaxy/fleet-dispatch.js`: integra la permanenza delle esplorazioni della Galattica, registrando il calendario completo.
- `modules/ui/ui-galattica.js`: scelta ore in base alla ricerca con stile grafico invariato.
- `modules/online/fleet-control.js`: formula online allineata all'offline; orari corretti sul timestamp `departureAt` quando disponibile; richiamo in transazione Firestore.
- `modules/online/combat-resolver.js`: se il resolver è in ritardo, preserva il ritorno originariamente previsto dalle esplorazioni.
- `ui-fleet-movements.js`: etichette **ANDATA**, **IN ESPLORAZIONE**, **RIENTRO** e orario previsto derivati dai dati reali.
- `firestore.rules`: autorizza esclusivamente la correzione aritmeticamente coerente di `zoneArrivalTime` e `explorationEndTime` nei voli di spedizione.
- `release-manifest.json` e `sw.js`: rigenerazione della release PWA ufficiale.
- `tests/test_exploration_timing.js`: test specifici, reali sorgenti del motore con Firebase simulato.

**Invariati:** altre missioni, motore di combattimento, costi, produzione, carburante ordinario, bonus militari, Invictus, Crepuscolo, Supreme e assedi. Non introdotti timer o listener ad alta frequenza.

## Vecchi salvataggi e voli attivi
- Nessuna migrazione distruttiva dei salvataggi, nessuna riscrittura delle flotte completate.
- I voli online già partiti conservano gli orari originali; la nuova formula si applica solo ai nuovi lanci.
- Per un vecchio volo, quando disponibili, la durata di una tratta viene ricavata da `returnTime - arrivalTime`, non dal tempo trascorso a esplorare.
- Le vecchie missioni Galattica che non avevano alcuna permanenza memorizzata non ricevono retroattivamente ore inventate.
- Un'esplorazione richiamata online passa a `recall` e non genera nuove ricompense esplorative.

## Test e controlli
**PASS:**
- **56 asserzioni dedicate** con motore reale JavaScript e Firestore simulato: 1x, 10x, 100x; 1 ora e massimo ricerca; esempio 7h; richiamo a metà andata, all'arrivo, dopo due/quattro ore, immediatamente prima e dopo fine permanenza; persistenza via JSON; dati legacy; partenza dalla Galattica; doppio richiamo online; nessuna modifica alle normali missioni.
- **GitHub Actions PR #2, `verify`, conclusione success**: `tools/build_release.py` con `git diff --exit-code` sul manifest/Service Worker, sintassi di tutti i `.js` e tutte le suite ufficiali `tests/test_*.js`.

**Non verificati su infrastruttura reale:** Firebase in produzione, due veri client simultanei, browser mobile fisici, perdita temporanea di connessione, misure hardware CPU/GPU/memoria. Il mock Firestore non certifica i permessi pubblicati.

## Aspetti residui e distribuzione
- Le regole `firestore.rules` presenti su GitHub devono essere pubblicate manualmente su Firebase dal proprietario: il solo merge GitHub non distribuisce Firestore. In assenza delle nuove regole la correzione opzionale degli orari sull'istante server può essere rifiutata, senza spostare retroattivamente i vecchi voli.
- Il resolver delle flotte online rimane orientato alla sincronizzazione dei client: a browser chiusi, il completamento effettivo può essere differito fino alla successiva sessione. L'orario di rientro pianificato, invece, non si allunga.
- Le gestioni dei superstiti e delle Galattiche spostate o distrutte restano nelle funzioni già esistenti, senza alterarle.
- Ripristino: confrontare con `backup/pre-esplorazioni-tempi-2026-11-25` e fare revert del commit della correzione, senza cancellare i salvataggi.

## Pacchetto completo
Il nuovo ZIP è una fotografia completa del repository corrispondente alla correzione, non il vecchio archivio `UNIVERSUM_ATTUALE.zip` che rappresenta una versione precedente. Il riferimento definitivo è identificato dallo SHA del commit della candidata.
