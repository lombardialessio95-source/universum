# Fase 4 · Riservatezza del recupero

La decisione del direttore prevede che gli assedi in multiplayer recuperino gli arretrati quando un partecipante riapre il gioco. Nessuna elaborazione viene programmata mentre tutti sono assenti.

Il motore candidato calcola quali flotte del difensore sono intercettabili, riduce il carico alla capacità dei superstiti, valida la relazione tra difensore e alleato tramite una fonte di autorizzazione esterna alla missione e restituisce al comandante della controffensiva la flotta superstite con catture e bottino. Lo spionaggio riusa la formula e le soglie della flotta ordinaria per attribuire informazioni. La vista pubblica contiene le sole informazioni condivisibili.

## Incompatibilità da risolvere prima del rilascio online

Per riprodurre le conseguenze di un evento il risolutore deve conoscere i partecipanti, il loro stato privato e i limiti di movimento. Per esempio, dopo la perdita di una Suprema la modalità Prudente ordina il rientro delle superstiti, mentre Offensiva consente la prosecuzione. Il browser del difensore non può risolvere questo caso mentre l’attaccante è assente senza conoscere la modalità o ricevere un risultato da un contesto privilegiato.

Le regole di Firestore proteggono letture di documenti interi. Se il difensore può leggere il documento contenente la modalità, la vede anche quando viene esclusa dall’interfaccia e dai rapporti. Separare il documento dei dati privati preserva il segreto, ma rende il browser del difensore incapace di calcolare l’intera transizione. Il test con emulator e regole isolate verifica entrambe le configurazioni. La documentazione Firebase è disponibile all’indirizzo https://firebase.google.com/docs/firestore/security/rules-fields#allowing_read_access_only_for_specific_fields.

La soluzione minima che conserva entrambe le regole è un risolutore privilegiato su richiesta, chiamato dalla riconnessione con l’identità verificata. Il risolutore può eseguire le transazioni atomiche e restituire una proiezione pubblica o specialistica, senza schedulazioni in background. Richiede una componente eseguibile esterna al browser, un ambiente di prova e autorizzazione alla relativa configurazione. Se il direttore esclude qualsiasi componente privilegiata, occorre modificare la regola funzionale e limitare il recupero al rientro dell’aggressore. Quella scelta lascia inoltre i risultati nel modello di fiducia client-side già presente.

## Verifiche

- Tutte le 20 suite JavaScript sono passate, incluse le prove per la provenienza delle navi, il bersaglio supporto, l’alleato autorizzato, il carico superstite, lo spionaggio e la proiezione pubblica.
- La prova di riservatezza è stata eseguita con il Firestore Emulator, usando regole di test isolate. Non sono state pubblicate modifiche a Firebase e nessun account reale ha partecipato a questa simulazione.
- Il rilascio online resta sospeso. Le transizioni non sono ancora collegate alla missione online, alle regole di produzione o all’accesso con due account reali.
