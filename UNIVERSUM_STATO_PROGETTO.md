# UNIVERSUM — STATO DEL PROGETTO E PASSAGGIO DI CONSEGNE

**Revisione:** 1.9 — 26 novembre 2026  
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
| AT05 atomicità partenze | Candidata verificata, integrazione sospesa per T09/T10/T18 | 7099402d8596d3a179191b8ff2427ac3145df897 |
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
