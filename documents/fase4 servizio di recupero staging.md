# Fase 4 · Recupero privilegiato su richiesta

La riconnessione di uno dei partecipanti può chiedere la risoluzione delle ondate arretrate. Il servizio usa l'identità autenticata, il proprio timestamp e lo stesso motore di combattimento del gioco. La richiesta contiene solo gli ID di universo e assedio. La transazione applica ondata, checkpoint, vista pubblica e ricevuta. Nessun job periodico o polling aggiuntivo.

Il client esegue una query per gli assedi del partecipante al join di un universo con `supremaRecoveryStaging` attivo. Il flag predefinito è disattivato e l'integrazione esclude esplicitamente il progetto di produzione `universum-online`. In staging il callable richiede anche `UNIVERSUM_SUPREMA_STAGING=true`. I documenti privati e le ricevute sono inaccessibili ai browser. Solo i due giocatori possono leggere la vista pubblica e ogni scrittura passa dal contesto privilegiato.

## Collaudo riproducibile

- Installare in locale da lockfile con `npm --prefix services/suprema ci`.
- Eseguire `FIRESTORE_EMULATOR_JAR=/percorso/emulator.jar python tools/test_suprema_staging.py`. Il test usa l'Admin SDK contro un Firestore locale, sotto le regole del repository, con assedio predisposto e identità separate. Verifica recupero richiesto solo dal difensore, contesa del secondo evento, ricevuta unica per ondata, carburante, risorse, replay e rifiuto delle scritture browser. Il collaudo locale è stato eseguito con Node 24. Il pacchetto Functions dichiara Node 22.
- Generare il pacchetto separato con `python tools/package_suprema_staging.py /nuova/cartella`. Il comando prepara i file e non esegue un deploy. L'adattatore usa il protocollo ufficiale Firebase Callable: https://firebase.google.com/docs/functions/callable-reference.

## Ambito della candidata

Il recupero collaudato risolve ondate su istantanee di prova create da un contesto amministrativo. È assente il collegamento al lancio multiplayer e ai documenti canonici di pianeti, flotte, hangar e inventari. Restano aperti il ritorno dopo la fine dell'assedio, controffensive, intercettazioni, spionaggio, compatibilità con le mutazioni ordinarie e la prova end-to-end del callable con browser reali. Il repository contiene il codice e le regole candidate. Non è stato eseguito un deploy su Firebase.
