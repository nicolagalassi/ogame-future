# 2026-11-17 — Colonnina del piano sempre visibile

- Menu pianeti (vista affiancata): la colonnina del piano c'è su ogni riga anche quando non c'è niente in programma.
  Pianeta o luna senza voci: quadratino bianco vuoto (`.fut-plan-empty`); pianeta senza luna: metà vuota senza quadratino.
- File: `src/modules/planet-menu/index.ts`, `style.ts`, `tests/planet-menu.test.ts`. Versione 0.3.109.
- Segnalato da Nicola: avviando una costruzione del piano sono sparite anche le altre voci. Riletti `startBuild`, `prune`,
  `pruneByQueues`, `releaseQueued`: nessun percorso toglie voci di altre tecnologie; sospetti (non confermati): livello
  di partenza gonfiato da un livello "in coda" vecchio (`queuedLevel`) che toglie più livelli della stessa struttura.
  In attesa di dettagli (pagina, cosa era in costruzione, voci sparite).

## Bug trovato (0.3.110)
- Causa: `isResearch` in `src/engines/planner.ts` contava come ricerca dell'account anche le ricerche delle forme di vita
  (id xx2xx), che invece sono per pianeta. Avviando lo stesso livello su un pianeta, `startBuild` / `prune` /
  `pruneByQueues` lo toglievano dal piano di tutti gli altri pianeti. (Contava anche le navi 202–219, senza effetti.)
- Ora solo gli id 101–199 valgono su tutto l'account. Test di regressione in `tests/tech.test.ts`.
