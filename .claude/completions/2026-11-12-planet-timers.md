# 2026-11-12 — Timer dei pianeti dalla visita, non dalla sincronizzazione

- `src/data/visits.ts`: `bodies.visitedAt` (id → ms), aggiornato in `main.ts` a ogni pagina caricata con quel corpo attivo.
- I badge d'età del menu pianeti leggono le visite, non `resourcesAt` (che sync e accountInfo al login riscrivono per tutti).
- Nessun badge sui corpi mai aperti dopo l'aggiornamento. Nessuna chiamata di rete.
