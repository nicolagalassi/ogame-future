# Nomi dei bersagli dalla Galassia, raid e detriti nel Diario (0.3.170)

## Nomi
- Nicola: la lista Bersagli mostrava il nome salvato quando si metteva la bandierina; la scheda del singolo giocatore quello attuale.
- `engines/marks.ts` `renamePlayers`: giocatori segnati e recenti prendono il nome visto; null se niente cambia. Chiamato in `modules/galaxy` (`remember`, ogni sistema che il gioco disegna) e nella scheda del giocatore (nome dell'API appena letto).

## Raid
- Nicola: un attacco di ieri non risultava; i detriti raccolti vanno contati.
- Causa: i raid arrivavano solo dall'import di OGLight; Future non registrava i propri rapporti di combattimento.
- `engines/expeditions.ts` `recordRaid` (rapporto di combattimento, lato attaccante, fuori dalla posizione 16 e dalle anomalie di Orione; esclusi i combattimenti con sole sonde perse e nessun bottino) e `recordHarvest` (raccolta detriti fuori dalla posizione 16, conta nel bottino ma non come raid). `raidStats` conta a parte i detriti (`debris`), mostrati nella scheda Raid come «di cui detriti».
- Si registrano quando il giocatore apre i rapporti nella posta (come le spedizioni): l'attacco di ieri entra se il rapporto è ancora in posta.

## Tetto peso
- Alzato a 1250000 (Nicola, scelta del 2026-11-27): build a circa 1152600.

## Test
- tests/marks.test.ts (rinomina), tests/messages.test.ts (raid, detriti, pirati a 16 fuori, sonde fuori, nessun doppio).
