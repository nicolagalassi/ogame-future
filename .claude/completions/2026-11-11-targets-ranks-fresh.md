# Bersagli per classifica e stato, pianeti spariti, "appena lette" (2026-11-11, 0.3.33)

- **Appena lette** di nuovo nella scheda Spedizioni della posta (`messages/exp-fresh.ts`): solo il riquadro a scomparsa (10 s, pausa al passaggio), sopra i rapporti. Il riepilogo "Oggi" resta tolto.
- **Lista Bersagli** (`marks/side.ts`, `playersList`): ordinata per classifica generale (le liste per bandierina; "Recenti" resta in ordine di apertura). Classifiche di tutto l'universo da `/api/highscore.xml?category=1&type=0` (`data/universe-ranks.ts`, user-view, cache un'ora, una lettura alla volta), con le schede già lette come riserva. Stato da `players.xml` (cache un giorno): nome nel colore dello stato e lettere dell'API tra parentesi, tooltip in parole (`marks.st.*`).
- **Pianeti spariti**: la galassia batte l'API finché l'elenco dei pianeti dell'API non cambia (rilascio settimanale). `recordSystem` registra vuota anche una posizione mai memorizzata se una scheda già letta di un giocatore seguito la elenca (`keep(0, coords)`). `PlayerScores.planetsSince` = quando l'elenco è cambiato tra due letture (alla prima: una settimana prima del file); `planetsOf` nasconde i pianeti visti vuoti o di altri dopo quel momento.
- Test: posizioni (vuota mai vista, regola dell'elenco), classifiche e ordinamento con stato, riquadro "appena lette".

## 0.3.34 — pianeti colorati tolti ovunque (richiesta di Nicola)
- Modello (`engines/marks.ts`): via `TAGS`, `Tag`, `PlanetMark`, `tagPlanet`, `planetsInRange`, `planets` e `lastTag`; `loadMarks` carica solo giocatori, recenti e ultima bandierina (i pianeti salvati restano nello store ma non si leggono). `migrateOld` non converte più i vecchi bersagli della galassia.
- Galassia: niente pulsante colore né tinta delle righe. Barra Bersagli: niente scheda Pianeti (lista, filtri di intervallo, colori, stati). Pannellino: niente riga dei pianeti. Import OGLight: i tag dei pianeti non si importano. Memoria posizioni: non più legata ai pianeti colorati.
- Traduzioni orfane tolte; test aggiornati.
