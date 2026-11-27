# Tecnologie: con una ricerca in corso il pannello parte dal livello dopo (0.3.178)

- Problema: con Astrofisica 25 → 26 in corso il pannello mostrava 25 → 26 (il gioco mostra costo e tempo del
  livello in corso, e `matchShownLevel` lo sceglieva).
- Fix (`src/modules/tech/index.ts`, `startLevel`): se la lista ha un livello obiettivo oltre il costruito, si
  parte da obiettivo + 1 con lo stesso sconto; nuovo campo `shown` (livello delle cifre del gioco) usato come
  base di `scaleDuration`.
- Edifici in costruzione: il gioco mostra già il livello dopo, nessun cambiamento (test esistente).
- Test: tests/tech.test.ts «a research under way…» (fallisce senza fix). Non provato in gioco.
