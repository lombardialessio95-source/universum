# UNIVERSUM — STATO DEL PROGETTO E PASSAGGIO DI CONSEGNE

**Revisione:** 1.0 — 26 novembre 2026  
**Tipo:** documento di continuità per ChatGPT, Codex e il proprietario del progetto  
**Repository:** https://github.com/lombardialessio95-source/universum  
**Riferimento verificato:** branch `main`, commit `67f71b7f2662ad2c345b0e3e8f2ba4ab4202c099` (25 novembre 2026, 21:24 UTC)  
**Stato del documento:** proposta di documentazione; i dati tecnici devono essere riverificati prima di ogni nuovo incarico.

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
