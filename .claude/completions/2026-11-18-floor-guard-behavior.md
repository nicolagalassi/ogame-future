# 2026-11-18 — Asserzioni sostituibili quando cambia il comportamento

- Deciso da Nicola: «permetti di aggiornare i test quando cambia il comportamento».
- `CONSTRAINTS.md` (commit a parte con `Constraints-Approved`): nuova voce del floor.
- `scripts/floor-guard.mjs`: `assertion-removed` passa solo se un commit del branch ha
  `Behavior-Changed: <file di test>: <motivo>` e il file non perde asserzioni (aggiunte ≥ tolte); ognuna viene stampata.
- Provato su un branch di prova: sostituita senza riga → bloccata; con riga → passa e stampa; tolta senza sostituto
  con riga → bloccata; `.skip` con riga → bloccato. Versione 0.3.128.
