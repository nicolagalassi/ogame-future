# 2026-11-12 — Salta nel giro (raccolta spedizioni)

- `FleetSettings.skipBodies`: pianeti/lune che il giro (Ripeti, Salta) salta. Interruttore per corpo
  "Salta nel giro" nella riga delle regole della pagina flotta.
- `nextBody(..., { skipIds })`, `nextInRound(state, body, list, skipIds)`: il primo corpo del giro non
  viene mai saltato (il giro sa sempre dove finisce).
- Tile "Salta → prossimo" (tasto N) mentre è attivo un giro Luna / Raccolta trasporto / Raccolta
  schieramento; se non c'è niente da portare il messaggio lo indica e il fuoco va su Salta.
- Conformità: Salta è un cambio pagina con cp al click del giocatore (come la lista pianeti o I/O),
  non invia nulla; la pagina successiva viene solo preparata.
- Test: `tests/fleet.test.ts` (nextInRound con skip, tile e interruttore). Non provato in gioco (cloud).
