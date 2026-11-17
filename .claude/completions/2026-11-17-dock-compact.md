# 2026-11-17 — Diario del dock più compatto

- Card Diario sotto il menu: tolte le 7 colonnine e la riga "7 giorni".
- Ora: Oggi +X (MSU netto), sotto M/C/D netti del giorno (risorse + costo navi trovate − perse, `netRes` in `engines/expeditions.ts`), poi Ieri come confronto. Numero spedizioni di oggi nell'intestazione.
- Chiavi i18n tolte: dock.week, dock.todayCount, dock.count.
- Versione 0.3.114.

## Revisione impeccable + Emil (0.3.115)
- Oggi a 18px (scala Figure di DESIGN.md, il detector segnalava 17px fuori scala).
- Hover solo con puntatore fine (niente hover incollato su telefono); su tocco lo sfondo cambia alla pressione; i chip dei bersagli scalano a 0.97 (tolto con riduzione movimento).
- I valori M/C/D negativi usano lo stesso segno − dei totali. Tolta la regola `.line:hover` rimasta senza elemento.
- Visto in gioco con dev:shot (valori finti nel DOM).
