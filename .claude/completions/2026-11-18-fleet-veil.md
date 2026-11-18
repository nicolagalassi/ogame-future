# 2026-11-18 — Flotta al passaggio del mouse: velo sul corpo, navi che partono

- Navi partite: dopo un invio accettato (`hookSend` → `recordLeft`) le navi mandate escono dallo snapshot (`shipsAfterSend` +
  `applyPageShips` in `src/engines/account.ts`); a ogni pagina Flotta le navi del corpo vengono rilette dalla pagina
  (`recordShipsHere`), così una flotta tornata ricompare. Nessuna richiesta.
- Non coperto: portale lunare (nessun aggancio all'esito), flotta tornata senza aprire la pagina Flotta (serve Sync o nuova sessione);
  il menu della pagina Flotta stessa si aggiorna alla pagina dopo.
- Velo: `.fut-fleet-peek` ora copre tutto il pianeta (`.fut-peek-planet`) o la luna (`.fut-peek-moon`), sfumato da sinistra,
  sotto età e code (z-index 1), pointer-events none, anche col focus; niente velo se il corpo non ha navi sue.
  Telefono invariato (terza riga). DESIGN.md e .impeccable/design.json aggiornati. Versione 0.3.126.
