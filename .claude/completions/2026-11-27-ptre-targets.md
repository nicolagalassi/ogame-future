# PTRE, fase 1c: bandierina e bersagli del team (0.3.182)

- `src/engines/marks.ts`: flag `ptre` in `FLAGS`, `ptreTargets`, `mergePtreTargets` (chi torna da PTRE prende la
  bandierina PTRE solo se non ne ha già una; nome aggiornato).
- `src/data/ptre.ts`: `ptreSyncTargets` (POST `api_sync_target_list.php`, corpo JSON stringa senza Content-Type,
  come OGLight), `PTRE_TARGETS_PAGE`. Guard: script aggiunto a `PTRE_SCRIPTS`.
- Picker: bandierina PTRE (icona team, #3FC9A0) solo con team key o se il giocatore ce l'ha già.
- Barra laterale: scheda PTRE solo con key o se ci sono giocatori con la bandierina; «Sincronizza con PTRE»
  e «Gestisci su PTRE»; messaggio con quanti bersagli ha il team e quanti nuovi.
- Consenso aggiornato: elenca rapporto, info giocatore, bersagli.
- Test in tests/marks.test.ts «PTRE targets». Screenshot scratchpad/ptre3/list.png. Non provato contro PTRE.
- 0.3.183: dopo «Sincronizza con PTRE» il messaggio aggiunge le parole di PTRE (Nicola: «0 bersagli» dopo una sincronizzazione con Pain marcato PTRE).
