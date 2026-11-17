# 2026-11-17 — Flotta al passaggio del mouse nel menu pianeti

- Righe meno fitte: nome 600 14px + coordinate 400 12px; la flotta compare solo al passaggio del mouse (idea di Nicola, come fa un altro tool).
- Pianeta: le coordinate lasciano il posto a simbolo flotta + valore. Luna: le tre cifre lasciano il posto a simbolo sopra valore (.fut-fleet-peek). Anche col focus da tastiera.
- Corpo sotto il mouse su line-strong (prima velo azzurro 8% sul pianeta e un --hover più scuro del fondo sulla luna).
- Telefono (hover: none): la flotta resta terza riga come prima.
- Bug trovato dal test: .fut-fleet-peek si duplicava al ridisegno, aggiunto alla pulizia.
- Versione 0.3.123.
