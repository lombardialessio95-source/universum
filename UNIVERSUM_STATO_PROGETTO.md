# UNIVERSUM — STATO DEL PROGETTO E PASSAGGIO DI CONSEGNE

**Revisione:** 1.28 — 26 novembre 2026  
**Tipo:** documento di continuità per ChatGPT, Codex e il proprietario del progetto  
**Repository:** https://github.com/lombardialessio95-source/universum  
**Riferimento verificato:** branch `main`, commit `67f71b7f2662ad2c345b0e3e8f2ba4ab4202c099` (25 novembre 2026, 21:24 UTC)  
**Stato del documento:** registro permanente CONTROLLO autorizzato dal proprietario; sezione 11 aggiornata, sezioni precedenti conservate come storico. I dati tecnici devono essere riverificati.

> **IMPORTANTE:** questo documento è una fotografia del progetto al 26/11/2026, non la prova che tutte le funzioni descritte siano complete o collaudate. Ogni nuova sessione deve controllare per prima cosa l'HEAD di `main` e le PR aperte. Le decisioni del proprietario non sono modificabili autonomamente da una chat.

## 1. Identità del progetto e ruolo di GitHub

UNIVERSUM è un gioco strategico spaziale con modalità offline e multiplayer online, comprensivo di economia, edifici, ricerche, flotte, combattimenti, missioni, esplorazioni, BOT, Galattiche e navi speciali.

**Decisione esplicita del proprietario:** GitHub Pages è un **ambiente pubblico di test**, potenzialmente frequentato da giocatori reali. **Non è il lancio commerciale/ufficiale definitivo.** Un eventuale dominio personalizzato verrà acquistato soltanto quando e se il proprietario lo desidererà. L'acquisto del dominio non comporta automaticamente un server diverso. Anche nella fase di test pubblico, la perdita di dati e gli exploit restano problemi gravi.

La versione ufficiale del codice da consultare è sempre l'ultima versione sul branch `main`, non un file ZIP vecchio, una candidata non integrata o il codice ricordato da una conversazione. Gli interventi vanno preparati su branch separati e integrati solo dopo revisione e approvazione.

## 2. Decisioni di gameplay già confermate

1. **L'offline è il riferimento principale per il gameplay desiderato:** è generalmente più avanti e riflette meglio le idee del proprietario. Non è però automaticamente privo di errori.
2. **Obiettivo di parità del gameplay online/offline:** stesse navi, caratteristiche, costi, formule, economia, missioni, esplorazioni, ricompense, combattimenti e meccaniche speciali, compresa la Nave Madre Suprema.
3. **Le semplificazioni introdotte online per facilitare la programmazione non diventano regole permanenti.** Sono divergenze da eliminare progressivamente, a meno di una nuova decisione esplicita del proprietario.
4. **Sono ammesse differenze infrastrutturali, non differenze arbitrarie nel risultato di gioco:** offline usa persistenza locale e simulazione sul dispositivo; online necessita di autenticazione, transazioni, sincronizzazione, autorizzazione e talvolta servizi server.
5. **La regola ufficiale prevale su entrambe le implementazioni.** Se l'offline è sbagliato, si corregge l'offline; non si copia il bug online. Le eccezioni di gioco vanno documentate con motivazione e approvazione.
6. **Prima allineamento, poi debug sistematico.** I bug critici scoperti durante l'allineamento si correggono immediatamente; non si attende la fase finale.
7. **Sospendere per quanto possibile l'aggiunta di grandi nuove funzionalità** fino a parità e stabilizzazione, salvo correzioni imprescindibili.
8. **Firebase rimane il backend scelto.** Al momento non è prevista una migrazione per motivi puramente economici.

Esempi di regole e punti da mantenere nei test, **da confermare nel codice attuale prima di applicare modifiche**:
- tempi di esplorazione = andata + permanenza effettiva nella zona + ritorno; la permanenza non è tempo extra di viaggio di ritorno;
- Invictus e Crepuscolo hanno regole di provenienza e rientro legate al Bacino di nascita quando previsto dalla missione; non devono essere trattate come navi ordinarie in tutti i casi;
- velocità economica e velocità militare non devono essere uniformate indebitamente;
- la Suprema richiede parità di capacità, assedi e controffensive, ma alcuni eventi online persistenti richiedono architettura server affidabile.

Le regole complete e le eccezioni vanno ricostruite dal codice e dai documenti esistenti, **senza inventare comportamenti mancanti**. Per scelte di bilanciamento nuove o particolarmente complesse, consultare il proprietario.

## 3. Struttura tecnica verificata

- `index.html`, `app.html`, `sw.js`, `release-manifest.json`: applicazione web/PWA distribuita mediante GitHub Pages.
- `modules/data/`: cataloghi di edifici, ricerche, navi, difese e megastrutture.
- `modules/engine/`: produzione, tempi, progressione, ricerche e meccaniche del motore.
- `modules/galaxy/`: flotte, combattimenti, Galattiche e meccaniche spaziali principalmente offline.
- `modules/offline/storage.js` e `db.js`: persistenza offline tramite IndexedDB.
- `modules/online/` e `multiplayer.js`: autenticazione/partite online, Firestore, sincronizzazione, missioni, BOT, battaglie e comunicazioni.
- `firestore.rules`: regole di sicurezza conservate nel repository; pubblicarle nella console Firebase è un'azione separata dalla pubblicazione su GitHub Pages.
- `services/suprema/`: codice per un servizio privilegiato della Suprema in ambito di staging; **non presumere che sia attivo nella produzione**.
- `tests/`: suite di test Node.js e alcuni test browser/Python; leggere `tests/LEGGIMI.txt`.

I test con Firestore simulato **non equivalgono** a una verifica con Firebase Emulator, regole realmente pubblicate, due account reali o client concorrenti.

## 4. Stato verificato del repository al 26/11/2026

- Branch `main`: commit `67f71b7f2662ad2c345b0e3e8f2ba4ab4202c099`, oggetto della verifica iniziale.
- È presente una PR **#1 in bozza**, «Fase 4 multiplayer · cronologia delle difese in staging», branch `candidate/fase4-online-2026-11-25`. **Non è parte automaticamente di `main`.**
- Il documento `documents/fase4 servizio di recupero staging.md` chiarisce che il servizio di recupero della Suprema è limitato allo staging e non ancora collegato interamente a lancio multiplayer, pianeti, flotte, hangar e inventari canonici.
- Il documento `documents/audit sicurezza online.txt` segnala rischi **critici ancora aperti** legati a risorse, navi, ricerca e risoluzioni di combattimento falsificabili dal client. Non dichiarare il multiplayer resistente ai cheat solo perché le regole Firestore superano controlli statici.
- Le correzioni sull'esplorazione sono descritte in `documents/rapporto_correzione_tempi_esplorazioni_2026-11-25.md`. Verificare sempre l'effettiva presenza del comportamento in `main`, anziché considerare sufficiente il rapporto.
- I documenti storici possono riferirsi a commit precedenti; sono evidenza di intenti e interventi, non sostituiscono l'ispezione del codice attuale.

**Non verificato in questa ricognizione:** stato effettivo del progetto Firebase in console, regole attualmente pubblicate, funzionamento con due account reali, costo reale di rete/database, compatibilità completa dei salvataggi di tutti gli utenti e copertura esaustiva di ogni meccanica.

## 5. Firebase, costi e ambiente

Firebase/Firestore è il backend online scelto. Il plugin ufficiale Firebase risulta installato e abilitato nell'account ChatGPT, ma **l'accesso effettivo al progetto `universum-online` non è stato verificato in questa chat**. Non confondere installazione del plugin con accesso autorizzato al database.

La simulazione `tests/estimate_firestore_spark.js` riguarda profili sintetici di carico e non consumi misurati. In conversazione si è discusso di circa 1.000 utenti attivi/giorno (100 intensi, 300 medi, 600 occasionali) e di una bolletta ipotetica nell'ordine di una decina di dollari; **non è un tetto garantito**, e trasferimenti, spazio, funzioni server e traffico reale possono far variare il prezzo.

Passare a Blaze e introdurre Cloud Functions sono decisioni distinte, da valutare e approvare prima del deploy. Gli avvisi di budget non sono un blocco automatico della spesa.

## 6. Architettura obiettivo

```text
                 REGOLE DI GIOCO CONDIVISE
       navi / economia / missioni / combattimenti
                        |
             +----------+----------+
             |                     |
           OFFLINE                ONLINE
       IndexedDB locale       Firebase + regole
       recupero locale        transazioni / server
```

Obiettivo: gli stessi dati iniziali e le stesse azioni producono gli stessi esiti di gameplay a parità di parametri e casualità controllata. Conservare le separazioni necessarie all'autenticazione, alla sicurezza, alla persistenza e agli eventi online.

**Non riscrivere tutto il gioco e non copiare direttamente l'offline dentro l'online.** Procedere per moduli e test. Il combattimento multiplayer, le risorse e le ondate persistenti della Suprema richiedono particolare attenzione al controllo server autorevole e all'idempotenza degli eventi.

## 7. Piano di lavoro, ordine operativo

**FASE 0 — Ricognizione e protezione**
- Verificare `main`, candidati e PR; creare backup recuperabile; inventariare salvataggi e test esistenti.
- Preparare una matrice per ogni meccanica: offline, online, regola desiderata, differenza, gravità, riferimenti ai file, prove disponibili.
- Distinguere: uguale / errore / semplificazione temporanea / differenza tecnica necessaria / decisione del proprietario.
- Nessuna modifica al gameplay durante l'audit.

**FASE 1 — Rete di sicurezza**
- Test deterministici di parità per formule, costi, flotte, esplorazioni, missioni e combattimenti.
- Test di compatibilità salvataggi offline e online, comprese partite esistenti e missioni in corso.
- Per Firebase: emulator e test a due account dove applicabili; distinguere mock, emulazione e prove reali.

**FASE 2 — Allineamento progressivo dell'online all'offline desiderato**
1. Cataloghi di navi, difese, edifici e ricerche.
2. Economia, produzione, energia, depositi e tempi; rispettare le velocità distinte.
3. Costruzioni, code e cancellazioni.
4. Flotte, viaggi, carburante, schieramento, richiamo e ritorni speciali.
5. Esplorazioni, permanenza in zona, rischio e ricompense.
6. Combattimenti, perdite, detriti, bottini, conquista e assedi.
7. Galattiche, Invictus, Crepuscolo degli Dei e Nave Madre normale.
8. Nave Madre Suprema, hangar, invasione, ondate persistenti, intercettazioni e controffensiva; progetto tecnico dedicato se occorre un arbitro server.
9. Test di integrazione di tutti i sistemi.

**FASE 3 — Stabilizzazione**
- Nessuna funzionalità nuova durante i test finali della candidata.
- Verifica salvataggi, progressione a gioco chiuso, doppie transazioni, client concorrenti, UI e performance.
- ZIP completo, rapporto dettagliato e backup della precedente versione funzionante prima dell'integrazione.

**FASE 4 — Debug profondo**
- Salvataggi → economia/code → flotte/missioni → combattimenti/supernavi → sicurezza multiplayer/BOT → interfaccia/CPU/GPU/memoria.
- Un errore critico si corregge prima della successiva pubblicazione, anche durante l'allineamento.

Il cronoprogramma discusso (13 settimane, 30/11/2026–26/02/2027) è **orientativo**, non una promessa. Le fasi si considerano concluse sulla base di prove, non del calendario.

## 8. Metodo di lavoro con ChatGPT Plus e Codex

Il proprietario **non programma**: decide le meccaniche e verifica i comportamenti in gioco. ChatGPT prepara specifiche e analizza report. Codex modifica il codice in branch separati. GitHub e i test forniscono le prove tecniche.

Le varie chat denominate CONTROLLO, DIVERGENZE, FORMULE, PROGRAMMAZIONE ORDINARIA, PROGRAMMAZIONE PROFONDA, SALVATAGGI sono **ruoli di lavoro, non agenti automaticamente sincronizzati**. Non assegnare in parallelo modifiche agli stessi sistemi. Fare una modifica principale alla volta; non presumere risorse illimitate su Plus.

**Protocollo obbligatorio per ogni intervento di codice:**
1. Verificare l'ultima versione ufficiale `main` e i branch concorrenti.
2. Creare backup recuperabile della precedente versione funzionante; lavorare su branch dedicato.
3. Scrivere ambito, criteri di accettazione, eccezioni e test prima della modifica.
4. Non modificare meccaniche non richieste o stile grafico senza approvazione.
5. Ottimizzare CPU, GPU, memoria e traffico Firebase, evitando ricalcoli inutili.
6. Eseguire lint/sintassi e test unitari, di parità, regressione, integrazione e salvataggio pertinenti; riferire esattamente quali sono mock e quali reali.
7. Consegnare **nuovo ZIP completo**, report dettagliato, elenco dei file cambiati, errori trovati, test superati/falliti e limiti della verifica.
8. Mantenere la versione precedente funzionante come backup. Nessun merge/deploy senza verifica e approvazione.

**Priorità:** P0 = perdita progressi, duplicazioni, exploit gravi, missioni irrecuperabili; P1 = divergenze di gameplay; P2 = rifiniture. Le P0 interrompono il piano ordinario.

## 9. Questioni aperte da non nascondere

- Audit sistematico e verificato di **tutte** le divergenze online/offline ancora da completare.
- Definizione del regolamento condiviso, con offline come riferimento principale e correzione dei suoi eventuali errori.
- Collaudo reale multiplayer con due account e regole Firestore effettivamente pubblicate.
- Sicurezza server-autorevole per risorse, flotte, combattimenti, bottini e conquiste: problemi critici dichiarati nell'audit esistente.
- Parità completa della Suprema e corretta gestione degli eventi quando i giocatori sono disconnessi; staging non equivale a produzione.
- Verifica della compatibilità dei salvataggi preesistenti dopo ogni intervento.
- Misurazione reale di traffico e costi Firebase prima di affidarsi a stime di spesa.

## 10. Procedura di passaggio a una nuova chat CONTROLLO

Quando questa conversazione diventa troppo lunga:
1. Aprire una nuova chat nel progetto UNIVERSUM e fornire il link a **questo documento**.
2. Richiedere la verifica del commit HEAD di `main` e delle PR aperte: le informazioni del 26/11/2026 potrebbero essere superate.
3. Leggere prima **Decisioni di gameplay**, **Stato verificato**, **Questioni aperte** e **Metodo di lavoro**.
4. Non trattare come completate le attività solo assegnate o presenti in rapporti storici.
5. Riprendere dall'ultimo incarico effettivamente verificato, indicando in modo esplicito se il risultato è su `main`, su branch candidato o solo in staging.
6. Aggiornare questo documento dopo ogni decisione significativa o integrazione rilevante, con data, nuovo commit di riferimento e cambiamenti di stato; **non cancellare la storia delle decisioni** senza conferma del proprietario.

**Primo prossimo incarico suggerito:** audit in sola lettura delle divergenze tra offline e online, classificazione e graduatoria delle correzioni. Nessun refactoring globale e nessun deploy in questa fase.

---

### Fonti interne principali consultate
- `README.txt`
- `documents/mappa.txt`
- `documents/audit sicurezza online.txt`
- `documents/ottimizzazione online firestore spark.txt`
- `documents/fase4 servizio di recupero staging.md`
- `documents/rapporto preliminare fase4 suprema 2026-11-25.txt`
- `documents/rapporto_correzione_tempi_esplorazioni_2026-11-25.md`
- `tests/LEGGIMI.txt`
- `tests/estimate_firestore_spark.js`
- Decisioni esplicite del proprietario raccolte nelle conversazioni del progetto fino al 26 novembre 2026.

**Regola finale:** non dichiarare alcuna modifica conclusa se non è stata verificata. In caso di dubbi, indicare «da verificare» e preservare il gioco funzionante.


---

## 11. Registro operativo permanente — aggiornamento 26 novembre 2026

Questa sezione prevale sui riferimenti storici incompatibili delle sezioni precedenti. Il ramo documentale dedicato è la memoria di CONTROLLO; non è il ramo di gioco. Consultarlo direttamente anche se la PR #3 resta in bozza. Non spostare main per aggiornamenti documentali durante una candidata in corso.

**Main verificato:** `ca38720f144993a805f84790e15519b7340525cc` (AT21).
**Candidata integrata su main:** AT02-I01, `8c13541b33ebd1b5d7b98c9dfa02267100f28ff4`, PR #6, Actions 45890267403 verde. Backup `backup/pre-AT02-I01-2026-11-26` verificato sul main D26.

| Micropasso | Stato | SHA / evidenza |
|---|---|---|
| D05-D06-I01 | Integrato, residui aperti | 7e33137e40b56d06d82402eaccb6afeb23edec42 |
| D07 pianeta madre online, 14 edifici zero | Integrato | 9fc3ee5df79ef12f1f3cdcff5e2d3862a800cde1 |
| D25 risorse colonia 1000/1000/500 + carico | Integrato | 1012b2d6b59b951feb2755706bf0447166d8b79e |
| RELEASE-FIX-01 manifest/SW | Integrato | 51200529c2ef07b5df39936549bb265ac2cb17f8 |
| TEST-FIX-01 confronto VM rigoroso | Integrato | 8847c1350d254ced4415b9443caf1b9608373edf |
| D26 edifici colonie online zero | Integrato | b0eecb037b6049c4f76fac9e66668bdc77d050ba |
| AT02-I01 chiusura forzata senza accredito | Integrato | 8c13541b33ebd1b5d7b98c9dfa02267100f28ff4 |
| AT21 chiusura missioni dopo errore | Integrato | ca38720f144993a805f84790e15519b7340525cc |
| AT05 atomicità partenze | I03 approvato su candidata, integrazione sospesa per T09/T10/T18 | f70b772f2bebc3b33f170fa5210ac9aca3d24446 |
| AT03/AT04 validazione creazione/modifica flotte | Aperti | — |

AT02: diff in modules/online/fleet-control.js, impedisce chiusura se manca destinazione valida o se transazione fallisce; verifica proprietà del pianeta in transazione; elimina fallback di chiusura autonoma. Cinque scenari dichiarati superati con Firestore simulato, pipeline verde verificata; non collaudato Firebase reale. AT02-I02: integrazione confermata dal controllo HEAD main. Actions candidata verde; pipeline post-merge e Pages non verificate indipendentemente in questo controllo. Prossimo incarico AT21-I01: prima riproduzione e verifica sovrapposizioni con AT02, senza correzioni ridondanti.

Backup storici: 67f71b7f2662ad2c345b0e3e8f2ba4ab4202c099 (pre D05/D06); backup/pre-ripresa-d05-d06-2026-11-26; backup/pre-D07-I01-2026-11-26; backup/pre-D25-I01-2026-11-26; backup/pre-RELEASE-FIX-01-2026-11-26; backup/pre-TEST-FIX-01-2026-11-26; backup/pre-D26-R01-2026-11-26. D05/D06 residui: distruzione orbitale tra imperi, concorrenza riscatto/liberazione/carburante embargo, recupero client legacy. Rules pubblicate manualmente secondo rapporto del reparto, non verificate direttamente in console.

### Piano e regole permanenti

I 31 macro-punti e le cinque fasi originali restano immutati; si aggiornano stati e micropassi, non si rinumerano. Fase 0 e 1 parzialmente svolte; Fase 2 in corso (economia iniziale 2.2: D07/D25/D26; flotte 2.4: D05/D06 e AT02); Fasi 3 e 4 non concluse. Nessuna percentuale certificata. La numerazione integrale dei 31 punti va recuperata dal piano originale di passaggio consegne, non ricostruita a memoria. Audit originali: UNIVERSUM_formule_e_divergenze_AUDIT_26-11-2026.xlsx e UNIVERSUM_Report_Collegamenti_2026-11-26.docx. Consultare prima di assegnare nuovi ID.

Ordinaria è reparto principale; Profonda riserva per problemi non ragionevolmente scomponibili. CONTROLLO analizza, prepara prompt, verifica e aggiorna questo ramo documentale; non modifica gameplay. Formule, Divergenze, Tecnico, Collegamenti, Salvataggi e Idee conservano i rispettivi compiti. Un micropasso alla volta, test proporzionati al rischio (ambiente pubblico di test), backup/ZIP/report/SHA, niente modifiche estranee o deploy Firebase automatico. Rules solo pubblicazione manuale del proprietario, se necessaria.

Protocollo di pubblicazione: verificare main, backup, ramo separato, modifiche minime, rigenerare manifest e SW con python3 tools/build_release.py PRIMA del push, test locali se disponibili, evitare push intermedi incompleti, CI candidata verde, approvazione CONTROLLO, integrazione, CI main e Pages. Dichiarare se test locali indisponibili. Non disabilitare test, notifiche o modificare workflow autonomamente; segnalare eventuali pubblicazioni Pages premature. Aggiornare questo documento dopo ogni rapporto rilevante distinguendo candidata e integrazione.

**Direttiva proprietario:** al punto formule di velocità flotte usare formule originali OGame (verificare fonte/versione, bonus propulsione, nave più lenta, durata e parità online/offline). Non cambiare automaticamente consumo carburante. **STOP obbligatorio prima delle migliorie grafiche:** avvertire il proprietario e raccogliere modifiche grafiche obbligatorie prima di assegnare incarichi.

### Nuova Suprema (decisione progettuale del proprietario, sostituisce il vecchio punto 2.8)

Revocati assedi persistenti, invasioni, ondate, supporto/controffensiva orbitale speciale, cattura, cantiere interno, depositi e carburante operativo dedicati. Non riprendere PR #1 di vecchio staging come implementazione attiva; preservare storia/backup. Suprema diventa supertrasporto con inventario unico, 4000 slot, max 4 Morti Nere (1000 slot ciascuna), max 3 Supreme per impero. Attacco 350000, scudi 50000, integrità 9000000, velocità 125, propulsore iperspaziale, consumo base 50000 D. Costruzione Bacino idoneo, 40 giorni/rate, 20M M/12M C/8M D, requisiti locali invariati.
Slot: sonda 1, caccia leggero 1, cargo leggero 2, caccia pesante 3, cargo pesante 5, incrociatore 8, riciclatrice 10, colonizzatrice 16, nave battaglia 18, incrociatore battaglia 20, bombardiere 22, Forgia di Efesto 25, Oracolo di Prometeo 25, Morte Nera 1000. Esclusi Madre normale, Suprema, satellite solare, Invictus, Crepuscolo. Verificare catalogo completo. Caricamento/scaricamento su pianeti amici atomico, identità individuale e nessuna duplicazione. Riutilizzare missioni ordinarie Madre normale, carico non combattente salvo regola esistente verificata; Morte Nera imbarcata non attiva distruzione luna.
S00 revisione parziale: engine/suprema.js attuale 600 slot, tre ruoli e cantiere; galaxy/hangars.js Madre normale 50 caccia, incursione esclusiva Madre normale; fleet-dispatch.js manifest Madre normale; vecchi servizi staging separati. Costruzione largamente riutilizzabile. Da decidere con proprietario: Incursione esclusa o solo caccia leggeri; migrazione risorse/carburante e unità pagate, rientro sicuro missioni esistenti. Non cancellare beni o salvataggi. Nessuna implementazione Suprema autorizzata ora.
Micropassi proposti S01 migrazione, S02 disattivazione missioni, S03 cantiere, S04 depositi/carburante, S05 inventario, S06 slot, S07/S08 carico/scarico offline, S09/S10 online, S11 partenze, S12 arrivi, S13 rientri, S14 perdite, S15 missioni, S16 UI, S17 dismissione codice esclusivo, S18 parità finale. Rivedere ordine per mantenere ogni candidata funzionante; non eliminare meccaniche condivise di embargo/riscatto. Priorità attuale AT21, non Suprema.


### Aggiornamento AT21-I01 — 26 novembre 2026
Main verificato 8c13541b33ebd1b5d7b98c9dfa02267100f28ff4. Candidata ca38720f144993a805f84790e15519b7340525cc, PR #7 in bozza, un solo commit, backup pre-AT21-I01-2026-11-26 verificato sul main. Diff verificato: in modules/online/combat-resolver.js rimosso il cleanup automatico nel catch generico per missioni scadute oltre 60 secondi; recupero esplicito AT02 invariato. Test AT21 quattro scenari, Firestore simulato, Actions 45894409372 verde, manifest/SW verificati; nessun collaudo Firebase reale. Checkout completo locale indisponibile per script Python pre-push. Rules e workflow invariati. Candidata approvata, non integrata. Prossimo AT21-I02: fast-forward da main verificato, verifica Actions e Pages, poi AT05. Eventuali errori persistenti possono lasciare missioni aperte e richiedono diagnosi, non chiusura automatica. Direttiva Firebase ribadita: avvertire il proprietario prima di qualsiasi modifica Rules, fornire regole complete e ordine di pubblicazione manuale; niente deploy automatico.


### Aggiornamento AT21-I02 — 26 novembre 2026
HEAD main ca38720f144993a805f84790e15519b7340525cc verificato; Actions 45894943987 e Pages 45894942848 entrambi success su main e sullo stesso SHA, verificati direttamente. AT21 concluso nei limiti del collaudo simulato. Prossimo AT05-I01, partenze ordinarie online: in modules/online/fleet-control.js righe 144–154 sottrazione locale e sync separati dalla creazione documento flotta (216–222); percorsi speciali usano già dispatch in syncPlayerState. Esaminare sync.js e Rules, riprodurre guasto, riutilizzare transazione esistente se compatibile; niente modifiche alle partenze speciali o altre meccaniche. Se Rules necessitano modifica, fermarsi e informare proprietario prima di integrare. AT03/AT04 successivi separati. Nessun deploy Firebase.


### Aggiornamento AT05-I01 — rapporto intermedio
Main verificato: ca38720f144993a805f84790e15519b7340525cc. Ordinaria riferisce verifica base e backup, percorso tecnico individuato, implementazione e collaudi non completati; Rules realmente pubblicate non confermate. Nessuna candidata approvata. Prossimo AT05-R01: sola diagnosi circoscritta e test riproduzione, confronto dispatch esistente e Rules repository; indicare eventuale modifica necessaria e non integrare prima di conferma compatibilità. Nessun deploy automatico, nessun intervento su altri ID. Profonda resta riserva. Backup riferito ma non verificato indipendentemente in questo aggiornamento.


### Aggiornamento AT05-R01 — analisi statica Rules
Main verificato: ca38720f144993a805f84790e15519b7340525cc. Ordinaria riferisce compatibilità statica di validHumanFleetCreate, validOwnerCheckpoint, aggiornamento pianeta proprietario, revisione giocatore e creazione flotta nella stessa transazione; getAfter già previsto; timestamp e percorsi speciali invariati. Nessuna modifica alle Rules del repository individuata nell'analisi riferita. Non verificati indipendentemente tutti i risultati statici, Rules pubblicate, limiti letture Rules o emulatore. Rapporto parziale: manca esito test riproduzione e proposta tecnica precisa per dispatch; richiedere completamento AT05-R01 prima di autorizzare implementazione. Nessuna candidata approvata, nessun deploy. Avvertire proprietario se emergono modifiche Rules.


### AT05-R01 — diagnosi conclusa, 26 novembre 2026
Main e backup/AT05-I01-ca38720 verificati entrambi a ca38720f144993a805f84790e15519b7340525cc. Riproduzione riferita con mock: 10 caccia, M/C/D 1000 ciascuno, partenza 3 caccia, M100 C50 D20 + carburante40. Creazione fallita lascia 7 caccia, 900/950/940 e zero flotte; retry lascia 4 caccia, 800/900/880 e una flotta. Sync fallita lascia addebito locale ma database invariato. CONTROLLO ha verificato staticamente i punti dispatch in sync.js, non rieseguito il test. Autorizzato AT05-I02 su candidata: A rimuovere addebito e sync anticipati; B usare dispatch anche per ordinarie con flag interno ordinary, costo identico incl. buco nero; C escludere ordinary dall'attivazione autonoma checkCapacity, mantenendo trigger code/speciali; D escludere ordinary dalla validazione destinazione propria riservata ai percorsi speciali; E non aggiungere ordinary a specialistFlights, preservando registro e controlli esistenti. Nessuna modifica schema o formule. Test atomici, retry transazione, destinazioni valide e regressioni speciali; separare collaudo risposta persa dopo commit e concorrenza client se non risolti, non dichiarare AT05 completo né integrare prima di approvazione. Rules repository compatibili secondo analisi Ordinaria; Rules pubblicate non verificate, emulatore e limiti letture ancora aperti. Client legacy rischio separato. Nessun deploy Firebase. Prossimo AT05-I02, poi collaudo residuo se necessario. AT03/AT04 e Suprema invariati.


### AT05-I02 — 27 novembre 2026
Main e backup/AT05-I01-ca38720 verificati a ca38720f144993a805f84790e15519b7340525cc. Candidata candidate/AT05-I02, SHA 7099402d8596d3a179191b8ff2427ac3145df897, PR #8 in bozza, CI 45903485030 verde verificata; PWA ra1e66ab4bb5c27e075ee. Diff verificato: A–E conformi, approvati adeguamenti complementari pointState dopo addebito e skip settlePlanet per ordinary, mock exploration aggiornato al contratto dispatch. Nessuna modifica Rules. Test prioritari simulati dichiarati superati; due scenari diagnostici mostrano duplicazione possibile nel percorso senza revisione. T09/T10 parziali, T18 emulatore non eseguito, ZIP binario non verificato. Candidata conservata, NON integrare. Controllo statico: sync.js versioned = Number.isSafeInteger(universeObj.serviceRevision), playerSnap e confronto revisione condizionali; universes.js e sync.js inizializzano da profilo con fallback 0, ma non dimostrano raggiungibilità esclusa. Prossimo AT05-R02: sola diagnosi di tutti i percorsi online che possono arrivare a launchOnlineFleet/saveCheckpoint senza revisione valida; test mirato di caricamento legacy, ripresa/reload e risposta persa, verificare come impedire dispatch ordinary non versionato senza effetti su offline o speciali. Nessun fix automatico, niente nuovi sistemi di idempotenza senza approvazione. T18 resta aperto; distinguere limiti ambiente da risultato negativo. Non ripetere suite già superate. Nessuna modifica Rules o deploy; avvertire proprietario se necessario. AT03/AT04 e Suprema restano sospesi.


### AT05-R02 — 27 novembre 2026
Main ca38720f144993a805f84790e15519b7340525cc, candidata 7099402d8596d3a179191b8ff2427ac3145df897 e backup/AT05-I01-ca38720 verificati direttamente. Diagnosi statica approvata: joinOnlineUniverse usa playerState.serviceRevision || 0, conserva valori truthy non validi; saveCheckpoint condiziona lettura e confronto revisione a Number.isSafeInteger. Percorso senza revisione riprodotto precedentemente con mock, raggiungibilità reale e reload dopo commit incerto non dimostrati. Autorizzato AT05-I03 sulla candidata esistente: guardia esclusiva dispatch.ordinary in saveCheckpoint, prima della normalizzazione/mutazioni e transazione; Number.isSafeInteger(rev) && rev >= 0 && rev < Number.MAX_SAFE_INTEGER; rifiuto esplicito senza azzeramento o conversione. Test mirati su valori invalidi, zero/legacy, revisione valida, assenza di scritture e regressione percorsi speciali. Conservare comportamento del caricamento e altri checkpoint. Nessuna nuova logica idempotenza, nessuna modifica Rules. T09 reload e T18 emulatore ancora aperti; T10 concorrenza reale non certificata. CI verde e release rigenerata prima del push; backup candidata precedente, ZIP/report/SHA. Non integrare su main. Diagnosi R02 nuova esecuzione incompleta; CONTROLLO ha letto codice, non eseguito test. Prossimo AT05-I03, poi valutazione rischi residui.


### AT05-I03 — 27 novembre 2026
Main ca38720f144993a805f84790e15519b7340525cc e backup/AT05-I02-7099402 (7099402d8596d3a179191b8ff2427ac3145df897) verificati. Nuova candidata f70b772f2bebc3b33f170fa5210ac9aca3d24446, candidate/AT05-I03, PR #9 in bozza, CI 45917887025 completata success sullo SHA esatto. Diff rispetto a I02: un commit, quattro righe operative in sync.js prima della normalizzazione e transazione, guardia dispatch?.ordinary con intero sicuro non negativo e incrementabile; test_atomic_dispatch.js, manifest e SW. Test I03 14/14 riferiti, suite CI verde verificata; codice test conferma rifiuti prima di scritture/normalizzazione, revisioni valide, checkpoint e partenze speciali legacy invariati. Release rcb95dd87e6811388701c riferita. Approvato I03 sulla candidata, NON integrare. T09 diagnostico ancora mostra commit avvenuto con risposta persa e stato locale obsoleto; T10 test sequenziale con revisione obsoleta, non concorrenza reale; T18 non eseguito. Prossimo AT05-R03: sola diagnosi T09, tracciare UI chiamante e gestione errore/ricaricamento; valutare verifica server del documento con ID della partenza già generato, distinguere commit confermato, fallimento certo ed esito incerto; non equiparare nuova partenza deliberata dopo reload a retry della stessa richiesta. Proporre soluzione minima, senza modifiche operative o nuovi sistemi/idempotenza persistente non autorizzati. Non ripetere suite. T10/T18 successivi; nessuna modifica Rules o deploy, avvertire proprietario se necessario. ZIP binari e Firebase reale non verificati da CONTROLLO. AT03/AT04 e Suprema restano sospesi.


### AT05-R03 — diagnosi T09 approvata, 27 novembre 2026
Main ca38720f144993a805f84790e15519b7340525cc e candidata f70b772f2bebc3b33f170fa5210ac9aca3d24446 verificati. CONTROLLO ha letto fleet-control.js e UI fleet.js: ID generato prima di dispatch, eccezione interrompe restituzione, UI distingue solo successo/errore. Diagnosi approvata, nessun nuovo test eseguito. Decisione CONTROLLO: I04 riconciliazione durante sessione, I05 persistenza minima dopo reload/chiusura da progettare separatamente. I04: solo partenze ordinary; mantenere ID e contesto utente/universo, impedire invii concorrenti/ripetizioni durante verifica anche dopo rerender/ricaricamento interno; lettura server del documento originale e verifica attributi stabili; assenza o errore lettura non provano fallimento; solo fallimento dimostrato libera richiesta; documento corrispondente conferma commit, riallineare stato autorevole senza salvataggio obsoleto o secondo addebito, senza riattivare missioni concluse né riscrivere timestamp. Se riallineamento fallisce mantenere blocco e distinguere commit confermato da stato locale non riallineato. Verifica esplicita, niente polling continuo, niente retry automatico con nuovo ID. Distinguere errori pre-commit dimostrabili, post-commit e ambigui; non classificare per generico errore di rete. UI minima coerente, nessuna grafica nuova, offline/speciali invariati; non perdere contesto quando syncPlayerState ricarica internamente per conflitto. Test T09-01–06 e 08–12 in sessione, T09-07 rinviato a I05; verificare anche lettura positiva con riallineamento fallito, ID non corrispondente, doppio click. Nessuna garanzia di soluzione di tutti i casi se documento eliminato; documentare limite e proposta di risoluzione senza sbloccare automaticamente. Nessun nuovo registro/schema/Rules, nessun deploy. Conservare candidata, ZIP, report, manifest/SW rigenerati e CI verde; non integrare. T10/T18 restano aperti.


### AT05-I04 — 27 novembre 2026
Main ca38720f144993a805f84790e15519b7340525cc e backup/AT05-I03-f70b772 verificati; candidata 86d774941567ce4b24a4b3c82fe2fcf10a0f6a8b, PR #10 draft, un commit e otto file rispetto a I03, CI 45918699132 success sullo SHA esatto. 37 scenari simulati riferiti, ZIP binari e browser/emulatore non verificati. Diff esaminato: Map per account/universo, lettura server, blocco checkpoint, recupero serverOnly, UI verifica. Candidata conservata, approvazione definitiva I04 sospesa. Criticità: blocco checkpoint senza blocco mutazioni locali può perdere progressi; caricamento serverOnly legge profilo e pianeti/flotte/Galattiche separatamente, possibile snapshot incoerente con revisioni concorrenti; verificare anche eccezioni post-commit fuori catch e rilascio del blocco. Prossimo AT05-R04 solo diagnosi mirata: identificare azioni mutanti durante pending, meccanismo minimo per sospenderle senza bloccare verifica/uscita e senza toccare offline; verificare coerenza del recupero e gestione errori post-commit, proporre test riproducibili. Non ampliare automaticamente il lavoro né ripetere suite. I05 persistenza rinviato fino alla valutazione R04. T09/T10/T18 aperti. Nessun merge, Rules o deploy; nessuna modifica al codice da CONTROLLO.


### AT05-R04 — diagnosi statica, 27 novembre 2026
Main ca38720f144993a805f84790e15519b7340525cc e candidata 86d774941567ce4b24a4b3c82fe2fcf10a0f6a8b verificati. CONTROLLO ha verificato direttamente runtime.js e ui-core.js: tick mutante non sospeso e persistUniverseState termina su false. Rapporto R04 individua cinque criticità: azioni mutanti durante blocco, progressione temporale, letture server-only non coerenti, eccezioni post-commit fuori catch con busy bloccato, installazione UI parziale. Zero nuovi test eseguiti. Diagnosi statica accettata, I04 non approvato definitivamente. Decisione CONTROLLO: trasferire esclusivamente diagnosi e progettazione sicurezza sessione a Programmazione profonda (riserva architetturale); Ordinaria sospende AT05, non lavorare in parallelo. Prossimo AT05-R04B: test diagnostici riproducibili R04-T01–T10, prioritari post-commit, mutazioni e tick; verificare azioni già in corso e listener/callback; proposta minima a micropassi, con doppia lettura profilo e verifica pianeti valutata come controllo parziale non snapshot atomico, gestione aggiornamenti indipendenti dalla revisione; nessuna modifica codice operativo, nessuna implementazione I05, nessuna integrazione. Se impossibile eseguire un test, indicare limite preciso e alternativa. Nessuna modifica Rules/deploy. T09/T10/T18 aperti. CONTROLLO non ha eseguito test né verificato ambiente reale.


### AT05-R04B — 27 novembre 2026
Rapporto Profonda approvato: 13 prove diagnostiche riferite su candidata 86d774941567ce4b24a4b3c82fe2fcf10a0f6a8b; main e candidata verificati da CONTROLLO. Cinque criticità confermate con mock: azioni mutanti non salvate, tick e recupero temporale non equivalente (tre secondi senza produzione nel recupero non esatto), letture incoerenti (profilo rev3/pianeta rev4), eccezione post-commit con busy=true e confirmed=false, UI parziale. Callback sintetica e listener pianeti tardivi riprodotti; ricerca non salvata ma perdita finale non dimostrata nella fixture. T08 uscita e T09 rilascio dopo fallimento certo positivi da preservare. Nessuna certificazione browser/emulatore/produzione. Piano approvato in ordine: AT05-I04A finalizzazione sicura; B protezione mutazioni prima dell'azione; C callback/listener e operazioni già in corso; D recupero temporale senza perdite/duplicazioni; E validazione letture server-only (doppia revisione non prova snapshot globale); F installazione UI sicura. Solo I04A autorizzato ora a Ordinaria, Profonda torna riserva. I04A: mantenere ID e commit confermato, estendere gestione errori all'intera fase successiva al commit, busy=false a fine tentativo anche su eccezioni; conservare pending se recupero incompleto; eliminare solo a successo completo o fallimento certo. Test R04-T06/T09, eccezioni post-commit, seconda verifica stesso ID, nessun addebito doppio, successo e speciali invariati. Backup candidata, manifest/SW rigenerati prima del push, ZIP, report e CI verde. B–F non autorizzati ancora, I05 rinviato, T09/T10/T18 aperti, no merge/Rules/deploy. Nessuna modifica operativa da CONTROLLO; test diagnostici non rieseguiti indipendentemente.


### AT05-I04A — 27 novembre 2026
Main ca38720f144993a805f84790e15519b7340525cc e backup/AT05-I04-86d7749 verificati. Candidata bbee52e2b38039f8a25d6bd6b3edda96fda75ac0, candidate/AT05-I04A, PR #11 draft; CI 45920257390 completed/success sullo SHA esatto. Diff un commit, quattro file, solo fleet-control.js operativo: conferma commit prima della finalizzazione, catch esteso, finally busy=false, richiesta mantenuta se recupero incompleto. Approvato I04A; 48/48 test simulati riferiti (11 nuovi), non rieseguiti da CONTROLLO; ZIP binari non verificati. Nessun merge. Autorizzato solo I04B a Ordinaria: proteggere nuove azioni volontarie mutanti prima della mutazione durante pending, usare stato già esistente per utente/universo, mantenere verifica e uscita esplicita senza salvataggio obsoleto; niente falsa conferma successo; protezione non solo grafica, mantenere offline e meccaniche invariate. Test R04-T01/T02/T03/T08, annullamenti, operazioni lunari/orbitali, commercio/trasferimenti, rientro e ricostruzione UI; controllare azioni consentite dopo successo/fallimento certo. Documentare percorsi non coperti, non estendere a callback già avviate (C), tick/recupero temporale (D), coerenza letture (E), installazione UI (F), persistenza I05. Backup candidata, manifest/SW prima del push, SHA/ZIP/report/CI verde. T09/T10/T18 aperti, no merge/Rules/deploy. Nessuna modifica operativa da CONTROLLO.


### AT05-I04B — rapporto intermedio, 27 novembre 2026
Main ca38720f144993a805f84790e15519b7340525cc, candidata bbee52e2b38039f8a25d6bd6b3edda96fda75ac0 e backup/AT05-I04A-bbee52e verificati direttamente. Ordinaria riferisce analisi preliminare dei gestori mutanti (costruzioni, ricerca, cantiere, ordini, lune/Bacino/portali, Galattiche, diplomazia/commercio, navigation, lobby, hangar, movimenti flotte/riscatti/assedi, eliminazione rapporti). Proposta approvata: ordinaryDepartureStatus unica fonte, controllo condiviso prima di mutazioni locali e richieste remote volontarie nell'universo online interessato; verifica accessibile, uscita esplicitamente senza checkpoint obsoleto e rientro nella stessa pagina con richiesta conservata. Nessuna nuova implementazione pubblicata, zero nuovi test, nessun nuovo SHA/ZIP/CI. I04B rimane aperto e autorizzato a Ordinaria. Riprendere senza ripetere diagnosi; se necessario suddividere internamente la realizzazione per gruppi di gestori, senza push intermedi incompleti; test già prescritti, includere isolamento account/universo e offline, documentare percorsi non protetti. C–F e I05 non autorizzati. Nessun merge, Rules o deploy. CONTROLLO ha verificato riferimenti ma non rieseguito diagnosi o test; nessuna modifica al codice operativo.


### AT05-I04B — secondo rapporto intermedio, 27 novembre 2026
Main ca38720f144993a805f84790e15519b7340525cc, candidata bbee52e2b38039f8a25d6bd6b3edda96fda75ac0 e backup/AT05-I04A-bbee52e verificati direttamente. Ordinaria riferisce 36 guardie preventive, pannello verifica/uscita, uscita senza checkpoint e recupero server-only al rientro, sintassi di 14 moduli modificati in memoria; nessun sorgente modificato pubblicato o consegnato, nessun nuovo test funzionale, SHA, ZIP o CI. Non considerare implementazione consolidata né approvata. Decisione CONTROLLO: mantenere I04B a Ordinaria, recuperare subito le modifiche se ancora disponibili e conservarle in patch/ZIP locale scaricabile chiaramente marcato WIP non verificato, con base SHA e inventario; se non recuperabili, ricostruire per gruppi limitati conservando checkpoint locali e test mirati, senza push incompleti. Completare tutti i collaudi I04B, isolamento account/universo e offline, ricostruzione UI, uscita/rientro, nessuna falsa conferma. Segnalare percorsi mutanti esclusi, incluse eventuali operazioni Suprema: non modificarne meccaniche e non presumere copertura. Recupero server-only già predisposto da verificare senza ampliare E/F. Soltanto candidata completa con manifest/SW rigenerati, SHA, ZIP, report e CI verde. C–F e I05 non autorizzati. Nessun merge, Rules o deploy. CONTROLLO non ha accesso alle modifiche in memoria e non ha verificato sintassi o test dichiarati.


### AT05-I04B — terzo rapporto intermedio, 27 novembre 2026
Main ca38720f144993a805f84790e15519b7340525cc, candidata bbee52e2b38039f8a25d6bd6b3edda96fda75ac0 e backup/AT05-I04A-bbee52e verificati direttamente. Ordinaria riferisce perdita del lavoro temporaneo e ricostruzione in AT05-I04B_WIP.py, generatore di patch con controllo SHA e sintassi Python verificata, ma applicazione e test non completati. File non ispezionato da CONTROLLO; nessun nuovo SHA, ZIP candidata o CI. I04B non approvato. Decisione CONTROLLO: suddividere I04B in B1 controllo condiviso e costruzioni/ricerche/cantiere; B2 ordini/annullamenti/lune; B3 Galattiche/commercio e restanti percorsi volontari; B4 pannello verifica/uscita/rientro; B5 collaudo integrato e pubblicazione. Solo B1 autorizzato a Ordinaria. Recuperare generatore WIP, ispezionare e applicare esclusivamente gruppo B1 a copia della base verificata, preservare altri gruppi come WIP separato; test R04-T01–T03, isolamento account/universo e offline, nessuna falsa conferma, rilascio dopo esito certo. Consegnare patch applicabile o ZIP locale verificato del gruppo B1, inventario, risultati e limiti; salvare prima di ulteriore elaborazione. Nessun push di candidata incompleta, nessuna integrazione main; release e CI al completamento B5. B2–B5, C–F e I05 non autorizzati ancora. Nessuna modifica Rules/deploy o meccaniche estranee. CONTROLLO non ha eseguito il generatore né testato la ricostruzione.


### AT05-I04B1 — 27 novembre 2026
Main ca38720f144993a805f84790e15519b7340525cc, candidata bbee52e2b38039f8a25d6bd6b3edda96fda75ac0 e backup/AT05-I04A-bbee52e verificati direttamente. Ordinaria consegna rapporto B1: patch locale UNIVERSUM_AT05-I04B1.patch, SHA-256 dichiarato 39b02dd5fce46f38e2dd12b782aed4a4e7e38527b1e1171a064118399d9b3d8f, quattro file e 15 aggiunte (ui-core.js, ui-buildings.js, ui-research.js, ui-shipyard.js). UI.pendingDeparture e UI.blockPendingMutation derivano da ordinaryDepartureStatus; guardie prima di Engine.startBuilding/startResearch/buildUnits. 10/10 test simulati riferiti: R04-T01/T02/T03A/T03B, quattro percorsi offline, isolamento, ripristino dopo fallimento certo; nessuna falsa conferma. Patch non disponibile direttamente a CONTROLLO, hash e contenuto non verificati, git apply --numstat riferito ma git apply --check su checkout completo non eseguito. Approvazione funzionale condizionata alla verifica della patch. Autorizzato B2 a Ordinaria soltanto dopo recupero file, verifica hash, git apply --check e applicazione B1 su base esatta, preservando B1. B2 esclusivamente ordini/annullamenti e operazioni lunari (incl. Bacino/portale se pertinenti), guardie condivise prima di mutazioni o richieste remote volontarie; non modificare meccaniche. Test mirati sospensione, nessun addebito/scrittura/falso successo, isolamento account/universo, offline e rilascio, regressione B1 mirata. Consegnare patch cumulativa B1+B2 applicabile alla base originaria con hash e inventario, conservare B1 separatamente; se base/patch non verificabili non procedere e dichiarare limite. B3–B5, C–F e I05 non autorizzati. Nessun push intermedio, merge, Rules o deploy; manifest/SW/CI definitiva a B5. CONTROLLO non ha eseguito test né modificato codice operativo.


### AT05-I04B2 — 27 novembre 2026
Main ca38720f144993a805f84790e15519b7340525cc, candidata bbee52e2b38039f8a25d6bd6b3edda96fda75ac0 e backup/AT05-I04A-bbee52e verificati direttamente. Ordinaria riferisce verifica SHA-256 B1 e git apply --check/apply su otto sorgenti completi con blob Git ufficiali verificati; clone integrale impedito da DNS. Patch cumulativa UNIVERSUM_AT05-I04B1_B2.patch, SHA-256 dichiarato d9e334912bfad97d239529660d28a7f0da6d5990930056e5731544ed3a85074e, 8 file +28/-1, da applicare una sola volta alla base originaria pulita, non sopra B1. Banco UNIVERSUM_AT05-I04B2_tests.js e registro UNIVERSUM_AT05-I04B2_test_results.txt riferiti. Test 75 locali +4 integrazione simulata =79/79 finali; sintassi 8/8, diff --check e seconda applicazione byte-identica riferiti. Approvati B1/B2 sulla base del rapporto, inclusa rimozione rerender dal guard (assegnazione workId legacy), protezione helper changeWorkOrder, ordini/lune/Bacino/portale, rinomina luna e mercante di lune circoscritti. CONTROLLO non ha accesso ai file patch/test né verificato personalmente hash o esecuzione. Autorizzato B3 a Ordinaria: recuperare cumulativa B1+B2, verificare SHA-256 e applicabilità ai sorgenti esatti; proteggere gestione Galattiche esistenti, commercio/contratti/trasferimenti, hangar, rinomina pianeti, richiami/riscatti e altre azioni volontarie mutanti già individuate (navigation, lobby-online, fleet, ui-fleet-movements, ui-social), senza cambiare meccaniche Suprema; segnalare eventuali percorsi esclusi e distinguere azioni già in corso (C), tick (D), verifica/uscita/rientro (B4). Se troppo esteso suddividere B3 in gruppi locali recuperabili senza push. Test guard prima di mutazione/richiesta, nessuna falsa conferma, isolamento, offline, ripresa e regressione B1/B2 mirata. Consegnare patch cumulativa B1+B2+B3 con SHA-256, inventario, test riproducibili, conservare B1 e B1+B2. B4/B5, C–F e I05 non autorizzati; nessun push, merge, Rules o deploy. Manifest/SW/CI definitiva a B5. Nessun collaudo browser/emulatore/produzione certificato.


### AT05-I04B3 — rapporto intermedio
Ordinaria riferisce recupero cumulativa B1+B2, hash conforme e applicazione riuscita ai sorgenti verificati, copia separata e identificativi blob aggiuntivi recuperati. Nessuna nuova protezione o test B3, nessuna patch B3. Main e candidata verificati da CONTROLLO invariati. Decisione: suddividere B3 in B3A gestione Galattiche già costruite, B3B commercio/contratti/trasferimenti, B3C hangar/rinomina pianeti/richiami/riscatti/rapporti e restanti gestori volontari. Solo B3A autorizzato; recuperare sorgenti esatti con verifica blob, usare guard condiviso prima di mutazione o richiesta remota, test mirati blocco/ripresa/isolamento/offline e regressione B1+B2 pertinente. Conservare patch cumulativa B1+B2+B3A applicabile alla base pulita bbee52e2b38039f8a25d6bd6b3edda96fda75ac0 con SHA-256 e banco riproducibile, mantenere patch precedenti. Nessun push, merge, Rules o deploy; B3B/C, B4/B5, C–F e I05 non autorizzati. CONTROLLO non ha verificato direttamente patch o test locali.


### AT05-I04B3A — 27 novembre 2026
Main ca38720f144993a805f84790e15519b7340525cc, candidata bbee52e2b38039f8a25d6bd6b3edda96fda75ac0 e backup/AT05-I04A-bbee52e verificati direttamente. Ordinaria riferisce cinque sole aggiunte in modules/ui/ui-galattica.js (blob base f1137871f4cc02e9465408c717da68e5e0c6757c): guard UI.blockPendingMutation prima di upgrade, produzione difese/navi, salto e dispatch. Cumulativa UNIVERSUM_AT05-I04B1_B2_B3A.patch SHA-256 dichiarato 820220c9c9d0e8bedbabd846bed57243e07dd6d3d1608672703488921e73d222, 9 file +33/-1, B1+B2 byte-identici. Applicazione/reverse check e sintassi su nove file hash-identici riferiti; non clone integrale. Test 48/48 B3A +75/75 regressione B1/B2 =123/123 locali simulati riferiti; non ripetute 4 prove integrazione B2, nessun browser/emulatore/Firebase reale. Banco UNIVERSUM_AT05-I04B3A_tests.js hash dichiarato 66375e9ff0f5cbbbd525570be988cec831ac95fbeda77b5a478898ec5b2ca6ae. Approvato B3A sulla base del rapporto, senza certificare API dirette o barriera server. CONTROLLO non ha ispezionato patch o rieseguito test. Solo B3B autorizzato a Ordinaria: recuperare cumulativa B3A, verificare hash/applicabilità ai sorgenti esatti; proteggere commercio, contratti e trasferimenti volontari prima di qualsiasi mutazione o richiesta remota, inclusi submit di moduli già aperti; preservare Mercante di Lune e portali già protetti, non alterare formule o meccaniche. Test mirati blocco, risorse/inventari/contratti invariati, nessuna scrittura o falso successo, ripresa, isolamento e offline, regressioni dei percorsi condivisi interessati; non ripetere inutilmente intera suite. Consegnare cumulativa B1+B2+B3A+B3B applicabile alla base pulita, SHA-256 e banco riproducibile, conservare precedenti. B3C, B4/B5, C–F e I05 non autorizzati. Nessun push, merge, Rules o deploy; manifest/SW/CI a B5.


### AT05-I04B3B — 27 novembre 2026
Main ca38720f144993a805f84790e15519b7340525cc, candidata bbee52e2b38039f8a25d6bd6b3edda96fda75ac0 e backup/AT05-I04A-bbee52e verificati direttamente. Ordinaria riferisce 10 aggiunte in diplomacy.js e navigation.js (blob originale navigation 2cee2db6d2202e17bc81cc110e455a8e2876e910), sei guardie per mercato nero, scambi BOT, contratto BOT, conferma commerciale online, accredito scansione evento, più controllo identità currentUniverse e modalità multiplayer sul submit commerciale obsoleto. Approvato controllo identità per nuova azione volontaria, non callback post-await (C); riferimento da valutare per altri gestori obsoleti, non certificazione generale. Alcuni percorsi testati forzando flag modalità, non nuova disponibilità gameplay. Trasporti ordinari mantengono possibilità di verifica stesso ID, portale/Mercante/Galattica invariati. Patch cumulativa UNIVERSUM_AT05-I04B1_B2_B3A_B3B.patch SHA-256 dichiarato 715389be14919dc844b0b0f55af699a398254c1280a3cafd1ab51c2a3ea4e3ae, 10 file +43/-1. Applicabilità e sintassi riferite su 10 blob completi verificati, non clone integrale. Test riferiti 29 locali (strict unhandled rejections dopo correzione banco), 15 regressioni mirate, 3 integrazione Firestore simulato, totale 47/47. Approvato B3B sulla base del rapporto; CONTROLLO non ha ispezionato patch, verificato hash o rieseguito test; non browser/emulatore/produzione. Autorizzato solo B3C a Ordinaria: recuperare cumulativa B3B, verificare SHA-256 e applicabilità; proteggere hangar, rinomina pianeti, richiami (incluse flotte Galattiche), riscatti, eliminazione rapporti, riparazione manuale missioni e salvataggio manuale o altre azioni volontarie mutanti residue individuate. Distinguere uscita/abbandono definitivo server: non implementare uscita/rientro B4; impedire eventuale abbandono distruttivo durante pending senza bloccare verifica/uscita sicura, documentare se necessario rimandare alla B4. Proteggere conferme di moduli aperti prima del pending, rifiutare gestori obsoleti dove pertinente; non modificare meccaniche Suprema/assedi, segnalare percorsi esclusi. Non bloccare verifica partenza; no callback già avviate/listener/tick. Suddividere internamente se necessario, conservare checkpoint locali. Test mirati zero mutazioni/scritture/falso successo, isolamento, offline, ripresa, regressioni condivise, inventario dei gestori residui con motivazione. Consegna cumulativa UNIVERSUM_AT05-I04B1_B2_B3A_B3B_B3C.patch sulla base originale pulita, SHA-256, banco riproducibile, rapporto, conservare tutte precedenti. B4/B5, C–F e I05 non autorizzati. Nessun push, merge, Rules o deploy; manifest/SW/CI a B5.


### AT05-I04B3C — 27 novembre 2026
Main ca38720f144993a805f84790e15519b7340525cc, candidata bbee52e2b38039f8a25d6bd6b3edda96fda75ac0 e backup/AT05-I04A-bbee52e verificati direttamente. Ordinaria riferisce 78 aggiunte in cinque file (fleet.js, lobby-online.js, navigation.js, ui-fleet-movements.js, ui-social.js), guardie preventive hangar/rinomine/richiami/ritiro assedi/attacco orbitale/riscatti/rapporti/turbo/riparazione e salvataggio manuali/abbandono distruttivo e cancellazione server, identità gestori obsoleti compresa rinomina luna, controllo diretto ordinaryDepartureStatus({id:uniId}) e account catturato per conferma abbandono da lobby. Verifica partenza conservata, exitActiveGameToLobby non modificata. Patch cumulativa UNIVERSUM_AT05-I04B1_B2_B3A_B3B_B3C.patch SHA-256 dichiarato dad6c34d8cfa2162c02564c31e21253a4ec9698977709409ed377971c46462e9, 13 file +121/-1, applicabilità/reverse/sintassi/hash blob riferiti su 13 file completi, non clone integrale (DNS). Test riferiti 90 locali +14 regressioni +4 integrazione simulata eseguite tramite connettore =108/108. CONTROLLO non ha ispezionato patch, verificato hash o rieseguito test; niente browser/emulatore/Firebase reale. Approvato B3C sulla base del rapporto; B3 concluso a livello locale, non release. Comunicazioni sociali e consultazione/navigazione rimangono utilizzabili; no modifica Suprema; riesaminare rischio gestori obsoleti generali in C/F e normalizzazioni rendering C–F. Nessuna certificazione barriera server/API dirette. Solo B4 autorizzato a Ordinaria: recuperare cumulativa B3C, verificarne hash e applicabilità ai blob esatti; rendere verifica pendente e uscita esplicita accessibili indipendentemente dalla schermata e dopo ricostruzione UI, con stile esistente e senza timer/polling aggiuntivi. Uscita dalla partita durante pending deve evitare checkpoint obsoleto e conservare richiesta, ID, conferma e stato di busy senza cancellarla; usare arresto ordinario loop/listener senza riscrivere loro logica, non interrompere arbitrariamente richieste in corso, gestire uscita mentre verifica occupata in modo esplicito e sicuro. Rientro stesso account/universo nella stessa pagina: non installare/salvare stato non riconciliato, offrire verifica medesimo ID con percorso server-only esistente prima di riabilitare gioco; se indisponibile mantenere richiesta e accesso a verifica/uscita, nessun nuovo dispatch, nessuna deduzione di fallimento da documento assente. Altro account/universo e offline non bloccati, ritorno all'originale ripristina sospensione. Conservare guardie B1–B3C, normale uscita/rientro senza pending, no modifiche grafiche decorative. Test R04-T08, ricostruzione UI, uscita/rientro, busy/indisponibilità, esito positivo e fallimento certo, isolamento, nessun checkpoint obsoleto/doppio addebito, regressioni mirate. B4 non risolve callback già avviate C, progressione D, coerenza E, installazione F o persistenza reload I05. Consegnare patch cumulativa UNIVERSUM_AT05-I04B1_B2_B3A_B3B_B3C_B4.patch, SHA-256, banco riproducibile, rapporto e limiti; conservare precedenti. B5, C–F, I05 non autorizzati. Nessun push, merge, Rules o deploy; manifest/SW/CI a B5.


### AT05-I04B4 — rapporto intermedio
Main e candidata I04A verificati invariati. Ordinaria riferisce nessuna implementazione B4, nessun test o patch nuova; patch precedenti conservate. Rischio individuato: riconciliazione asincrona già avviata potrebbe riaprire partita dopo uscita volontaria. Decisione CONTROLLO: per B4 preferire rifiuto temporaneo esplicito dell'uscita volontaria mentre verifica busy, con avviso, senza checkpoint o cancellazione richiesta; uscita nuovamente accessibile al termine del tentativo anche fallito. Verificare tutti i percorsi volontari di uscita pertinenti, incluso eventuale cambio account/sessione; non bloccare logout di sicurezza o navigazione del browser, documentare rischi residui da affrontare in C/F/I05. Non assumere che busy termini entro tempo certo: se non risolto o aggirabile, segnalare e non dichiarare collaudo riuscito; niente timeout che liberi busy mentre operazione ancora attiva. Test successo/errore, tentativo uscita mentre busy, nessuna riapertura involontaria, uscita con richiesta pendente non busy e rientro stesso ID; mantenere altri requisiti B4. Solo B4 resta autorizzato; nessun push, merge, Rules/deploy o avvio B5/C–F/I05. CONTROLLO non ha verificato sperimentalmente il rischio, né modificato sorgenti.


### AT05-I04B4 — secondo rapporto intermedio
Main e candidata I04A verificati invariati da CONTROLLO. Ordinaria riferisce verifica hash della cumulativa B3C e recupero sorgenti, recepimento distinzione busy/pending non busy/normale; implementazione e test non completati. Nessuna nuova patch verificata. Decisione CONTROLLO: suddividere B4 in B4A uscita sicura e busy; B4B rientro e riconciliazione server-only; B4C interfaccia generale e collaudo integrato. Solo B4A autorizzato a Ordinaria. Base bbee52e2b38039f8a25d6bd6b3edda96fda75ac0, cumulativa B3C SHA-256 dichiarato dad6c34d8cfa2162c02564c31e21253a4ec9698977709409ed377971c46462e9. Riutilizzare preparazione, proteggere percorsi volontari di uscita pertinenti: busy rifiuto esplicito temporaneo senza checkpoint o cancellazione; pending non busy uscita senza checkpoint obsoleto e richiesta originale mantenuta, arresto ordinario loop/listener; normale uscita invariata. Nessun timeout che liberi busy prematuramente, nessun blocco logout sicurezza/chiusura browser. Test R04-T08, busy successo/errore, uscita dopo entrambi, nessuna riapertura involontaria, normale uscita e isolamento/offline; dichiarare eventuali percorsi aggirabili o busy indefinito. Consegnare patch cumulativa B1+B2+B3A+B3B+B3C+B4A applicabile alla base pulita, SHA-256 e test riproducibili; conservare precedenti. B4B/C, B5, C–F e I05 non autorizzati. Nessun push, merge, Rules o deploy. CONTROLLO non ha ispezionato i sorgenti locali o rieseguito verifiche dichiarate.


### AT05-I04B4A — 27 novembre 2026
Main ca38720f144993a805f84790e15519b7340525cc, candidata bbee52e2b38039f8a25d6bd6b3edda96fda75ac0 e backup/AT05-I04A-bbee52e verificati direttamente. Ordinaria riferisce delta runtime.js 11 aggiunte/3 eliminazioni esclusivamente UI.exitActiveGameToLobby: busy rifiuta uscita prima di effetti, pending non busy consente arresto originale saltando persistUniverseState, normale percorso invariato. Approvata omissione del segnale esplicito UniversumUpdater.onSafeLobby solo durante uscita pending, per evitare sollecito di reload PWA che perderebbe registro volatile; non garantisce contro attivazioni indipendenti, refresh o chiusura (I05). Logout e rimozione server non bloccati, nessun timeout. Patch cumulativa UNIVERSUM_AT05-I04B1_B2_B3A_B3B_B3C_B4A.patch SHA-256 dichiarato ab4ba833ed61b6b0566a5f6a8fc0a16ce5ed36089c50c71d2f76d89a61e3a5e2, 14 file +132/-4; applicabilità/reverse/sintassi/hash blob riferiti su 14 sorgenti esatti non clone integrale. Test riferiti 15 locali +6 integrazione Firestore simulata (dopo correzione adattatori mock) =21/21; CONTROLLO non ha ispezionato patch, verificato hash o rieseguito test. Approvato B4A sulla base del rapporto. Residui: busy indefinito, gara uscita normale già in attesa di checkpoint con nuova partenza, logout/cambio sessione e callback già avviate C/F; nessun browser/emulatore/aggiornamento PWA reale. Solo B4B autorizzato a Ordinaria: recuperare cumulativa B4A, verificare SHA-256/applicabilità ai blob esatti; intercettare rientro stesso account/universo nella stessa pagina prima del join ordinario o installazione/salvataggio obsoleto, riutilizzare richiesta e ID originali e riconciliazione server-only, non creare nuovo dispatch. Busy: non avviare verifica concorrente; indisponibilità o assenza documento non è fallimento certo, mantenere richiesta, consentire nuovo tentativo dalla lobby e accesso ad altri universi/account/offline. Nessuna installazione di stato non riconciliato, nessun checkpoint obsoleto; verificare successo, fallimento certo già gestito, errore, retry, isolamento, doppio click/ingresso concorrente e conservazione B4A. Non introdurre polling, timeout, nuova persistenza o riscrittura join; se percorso attuale richiede universo attivo, diagnosticare e adattare minimamente senza anticipare C–F, segnalare eventuale impedimento architetturale. UI minima di esito/riprova in lobby ammessa, pannello generale B4C escluso. Consegnare cumulativa UNIVERSUM_AT05-I04B1_B2_B3A_B3B_B3C_B4A_B4B.patch, hash, banco riproducibile, rapporto; conservare precedenti. B4C/B5, C–F e I05 non autorizzati; nessun push, merge, Rules/deploy; manifest/SW/CI a B5.


### AT05-I04B4B — rapporto intermedio
Main ca38720f144993a805f84790e15519b7340525cc, candidata bbee52e2b38039f8a25d6bd6b3edda96fda75ac0 e backup/AT05-I04A-bbee52e verificati direttamente. Ordinaria riferisce verifica SHA-256 cumulativa B4A, conservazione precedenti e recupero differenze per ricostruire fleet-control.js autorizzato; implementazione rientro non completata, nessun test o patch B4B. CONTROLLO mantiene esclusivamente B4B autorizzato, senza ulteriore suddivisione per ora: riprendere dalla preparazione già effettuata, verificare blob dei sorgenti ricostruiti, implementare intercettazione rientro prima del normale join/installazione e riuso richiesta/ID e riconciliazione server-only, preservare busy, isolamento e uscita B4A. Conservare patch effettiva appena applicata, collaudare tutti i requisiti B4B già assegnati; se vincolo architetturale impedisce il recupero senza universo attivo, documentare punto esatto e test riproduttivo invece di ampliare il perimetro. Consegnare cumulativa, hash e banco riproducibile; nessuna approvazione B4B. B4C/B5, C–F e I05 non autorizzati; nessun push, merge, Rules/deploy. CONTROLLO non ha ispezionato patch o sorgenti locali né eseguito test.
