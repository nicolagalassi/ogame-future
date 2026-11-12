# 2026-11-12 — Risorse in volo nei totali

- `src/data/flights.ts`: legge dalla lista eventi del gioco (#eventContent, solo DOM, MutationObserver) le flotte proprie (countDown "friendly") e il carico dal tooltip `.fleetinfo` (ultima sezione: metallo, cristallo, deuterio). Andata e ritorno della stessa flotta uniti (missione + coordinate + navi). Trasporto/schieramento contano fino all'arrivo, le altre fino al ritorno.
- Salvato in `fleet.inFlight`; il menu pianeti somma il carico alle righe Metallo/Cristallo/Deuterio/Totale e mostra "di cui in volo" (tooltip con il dettaglio).
- Markup del tooltip ricostruito a memoria (stesso che legge OGLight), NON verificato in gioco: controllare con il browser dev.
