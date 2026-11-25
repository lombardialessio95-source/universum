# UNIVERSUM — Fase 4 online: handoff per Programmazione Profonda
25 novembre 2026 — **STATO: CANDIDATA PARZIALE, NON PUBBLICABILE**

## 1. Decisione del direttore
Opzione C «Fortezza Volante» online sostituisce espressamente l'assedio persistente multiplayer: UNA missione, UNA risoluzione orbitale/planetaria, UNA sequenza di rientro. 4.000 slot per Suprema ONLINE. Offline: 600 slot, assedio e tutte le meccaniche già pubblicate invariati. Non reintrodurre ondate, Supporto Orbitale, Controffensiva speciale e intercettazioni di assedio online. Nessun bonus artificiale ai danni.

## 2. Versioni e backup
Repository: lombardialessio95-source/universum.
main HEAD verificato: `12a8d79f8802f06d2e22f11f4991094368bb4775`.
Backup storico preservato: `backup/pre-fase4-suprema-2026-11-25` (a2692426...).
Nuovo backup: `backup/pre-fase4-online-opzione-c-2026-11-25` (12a8d79...).
Sviluppo: `feature/fase4-online-opzione-c-2026-11-25`.
La fonte `UNIVERSUM_Fase4_Passaggio_Multiplayer.md` non è stata trovata in documents/main; sono stati consultati gli altri rapporti di staging e privacy disponibili.

## 3. File modificati e invariati
Aggiunto `services/suprema/option-c-inventory.js`: modello PURO dell'hangar online condiviso a 4.000 posti; validazione delle quantità e pianificazione del caricamento stock planetario -> riserva della Suprema con risultato a snapshot immutati in input.
Aggiunto `tests/test_suprema_option_c_inventory.js`: test per vincoli e stock.
Aggiunto questo report.
NON MODIFICATI: motore offline, motore combattimento, Firestore rules, UI, PWA, servizi preesistenti, salvataggi.

## 4. Servizi precedenti: riuso/disattivazione
`services/suprema/launch.js` lancia ancora assedi di staging da `supremaInventoryPrivate` predisposto, con mode/hours, blocco bersaglio e wave-0.
`services/suprema/recover.js` e `modules/online/siege-recovery.js` applicano ondate periodiche e rientri.
`modules/online/suprema-staging-client.js` limita il prototipo a staging e ne esclude la produzione.
Non riutilizzarli come missione Opzione C. Sono rimasti intatti per non rompere vecchi test e offline; obsoleti PER ONLINE, non autorizzati alla produzione.

## 5. Inventario/migrazioni
`option-c-inventory.js` supporta solo lightFighter(1), heavyFighter(3), cruiser(8), battleship(18), bomber(22), aggregati in escort/invasion/reserve, massimo 4.000 per Suprema online. Il modello non è ancora agganciato alle costruzioni e ai salvataggi; nessuna migrazione e nessuna operazione Firestore introdotta. Offline non importa questa libreria ed è rimasto invariato.

## 6. Percorso end-to-end
Costruzione/produzione online: NON IMPLEMENTATE.
Caricamento effettivo da UI con transazione: NON IMPLEMENTATO; solo `planLoad` puro.
Lancio singolo/combattimento 6 round/bottino/rientro: NON IMPLEMENTATI.
UI/richieste/rapporti Opzione C: NON IMPLEMENTATI.
Il prototipo staging storico non equivale a questo percorso.

## 7. Sicurezza e recupero offline
La nuova libreria non è un arbitro: NON controlla uid, revisione, timestamp, ricevute, privacy e idempotenza transazionale. Un servizio privilegiato dovrà leggere snapshot canonici e applicare origine/manifest/ricevute in una transazione. Per giocatori entrambi disconnessi, dichiarare recupero differito se non è attivo un trigger affidabile. Nessun deploy su produzione.

## 8. Test realmente eseguiti
PASS: prova Node del modulo copiato localmente con test di slot esatti, overflow, quantità negative/frazionarie, classi sconosciute, assenza mutazioni e ruoli; prova diretta con il codice esatto letto da GitHub: 4.000 Caccia Leggeri caricati e stock ridotto a zero nel risultato del piano.
NON ESEGUITI: test end-to-end, emulator integrato Opzione C, due account reali, intera suite ufficiale, browser, mobile, PWA, regressioni online/offline, benchmark reale, test regole Firestore.

## 9. Prestazioni / bug
Il nuovo modulo è O(5 classi x 3 ruoli) su aggregati: zero timer, listener, RAF, polling e documenti per singola nave. Nessuna metrica di lettura/scrittura Firebase disponibile. Bloccanti P0: costruzione e inventario online reali; transazioni e ricevute; arrivo e battaglia affidabili; saldo, loot, ritorno; privacy; prove su due account. P1: UI. P2: scarico facoltativo.

## 10. Rilascio e rollback
Candidata PARZIALE in ramo separato; `main` invariato, Rules e Cloud Functions NON deployati. Non esiste una nuova ZIP distributiva completata o verificata. Backup nuovo e storico preservati; nessun rollback necessario su main. Non cancellare dati utenti o cache per correggere errori.

## 11. Consegne a Programmazione Profonda
**LEGGERE QUESTO REPORT PRIMA DI QUALSIASI EDIT. VERIFICARE HEAD PRIMA DI SCRIVERE.** Non ripristinare ondate multiplayer o rami obsoleti; non rifare codice funzionante e non modificare l'offline. Continuare solo dai P0: integrare le risorse canoniche della produzione, idempotenza del caricamento, attacco unico autorevole, restituzione, regole e UI; eseguire vere prove Firestore staging con due account, controlli prestazioni e regressioni. Non pubblicare senza verifiche reali.

**RIEPILOGO ONESTO**: implementato soltanto un modulo PURO preliminare con test limitati. Nessun nuovo comando Opzione C funziona nel gioco; il multiplayer online **non è completato**.
