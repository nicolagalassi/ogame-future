# Dati da un altro universo (fusioni) — 0.3.174

**Richiesta (Nicola):** con le fusioni gli universi si trasferiscono e le statistiche si perdono; importare su un altro universo solo configurazione e statistiche, senza coordinate.

**Fatto:**
- `src/engines/carry-over.ts`: `carrySources(data, ns)` elenca gli altri universi/giocatori in un backup o nella memoria di Tampermonkey; `carryOver(data, from, here, now)` dice cosa scrivere qui. Allowlist: una chiave non nominata non passa mai.
  - Copiate (sostituiscono): viste e scelte (`planetMenu.*`, `keys.*`, `msg.*`, `spy.view`, `spy.shared`, `galaxy.bigDebris`, `exp.kind/period`, `settings.tab`, `sim.tool`, `remind.desktop`, `dash.*`), `marks.view` senza il giocatore aperto, `fleet.settings` (letto con `settingsFrom`) senza preferiti, destinazione scritta, modalità accesa e corpi saltati.
  - Unite (le cose di qui vincono): `exp.journal` (coords null, id con `@<universo>`), `account.history` (per giorno), `orion.mult`, `orion.archive` (id con `@<universo>`, coords vuote, anomalie aperte chiuse).
  - Restano là: `satEnergy`, `lf.locked`, `tech.icons` (per corpo o riletti dal gioco), bersagli, posizioni, piani, regole dei pianeti, profili, snapshot, code, spiate, galassia, ledger Orion.
  - Idempotente; un id messaggio riusato dal nuovo server viene comunque registrato.
- `src/core/backup.ts`: `backupData(text)` (stessa validazione dell'import).
- Impostazioni › Dati: riga «Da un altro universo» con «Da questo browser» / «Da un backup», poi una riga per universo con «Porta qui».
- `scripts/constraints.mjs`: `maxBuffer` 64MB per `git diff`: col dist riordinato il diff superava 1MB e il controllo delle righe cambiate non girava.

**Verifica:** test `tests/carry-over.test.ts` (niente `\d+:\d+:\d+` né id dei corpi scritti, doppio import, id riusato), `tests/settings.test.ts`; demo locale del pannello Dati. Non provato sul gioco (browser di prova da riloggare).
