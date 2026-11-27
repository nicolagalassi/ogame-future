# PTRE, fase 0 + 1a (0.3.179)

Piano e regole in `docs/PTRE.md` (fasi, script, conformità). Decisioni di Nicola: bandierina nuova «PTRE»
(fase 1c), invii automatici dietro un interruttore a parte spento (fase 2), prova con la sua key di test.

- `src/core/guard.ts`: `PTRE_BASE`, `PTRE_SCRIPTS` (elenco degli script ammessi con il perché), `redactUrl`
  (team_key mascherata nel log), PTRE mai in 'page-load', chiamate con key solo 'user-sync'.
- `src/data/ptre.ts`: `TEAM_KEY`, `ERRORS_KEY`, `normalTeamKey`, `ptreCall` (tool=future, team_key, country,
  univers, version; errori salvati, ultimi 10), `ptreSaveSpyReport` (`oglight_import.php`, `sr_id`, POST).
- Impostazioni › PTRE: consenso, campo key (password, convalida TM+16), key mascherata, Rimuovi, ultimi errori.
- Tabella spiate: pulsante «Salva su PTRE» (upload → spunta / rosso col messaggio di PTRE), `ptre.sentReports`.
- Key fuori dal backup (`core/backup` SECRETS), dentro «Azzera le impostazioni»; `Store.delete`.
- Test: guard, tests/ptre-team.test.ts, backup, settings, spy-panel. Screenshot in scratchpad/ptre.
- Non provato contro PTRE vero: la prova la fa Nicola con la key del server di test (mai nel codice).
