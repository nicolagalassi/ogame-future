# 2026-11-13 — Piano: coda del gioco, invio, finestra per stato

- Trasporto del piano senza riserva navi (`prepareDelivery`, param `hold` per le risorse in coda della partenza).
- Badge del piano → finestra aperta sul corpo (`focus`), in cima ed evidenziato, «Porta tutto» a fuoco.
- Vista per pianeta in sezioni (Da rifornire / In arrivo / Risorse non note / Pronti).
- Livelli in coda nel gioco tenuti da parte (`plan.queued`): `queueKindOf`, `holdQueued`, `releaseQueued`,
  `reservedFor`, `lessReserved`, `withQueued` in `engines/planner.ts`; click «Sviluppa» in `modules/tech/index.ts`.
- Test in `tests/tech.test.ts` e `tests/fleet.test.ts`. Da verificare in gioco con il Comandante.
