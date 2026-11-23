# 2026-11-23 — Il ping resta fisso

- Il ping era dentro `.OGameClock`, che il gioco riscrive ogni secondo: spariva dopo 1 s. Ora è un elemento accanto
  all'orologio (`li` se l'orologio è un `li`), fuori dalla parte che il gioco aggiorna. Test con l'orologio riscritto.
- Versione 0.3.139.
