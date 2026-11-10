# 2026-11-10 — Sync, risorse, bonus spedizione, riepilogo posta

- Causa comune: due chiamate di sessione insieme → il gioco ne risponde una con `{"components":[],"newAjaxToken":…}`
  (provato su s269-it). Il guard ora mette in fila le chiamate al gioco (`src/core/guard.ts`, body letto in coda).
- speciesBonuses: risposta senza `data.expedition` = errore, non bonus 0 (stessa regola di accountInfo).
  Su Nembus la stiva spedizione passa da 235,9M a 521,9M (ResultBooster 1,212).
- Pulsante Sync: diventa rosso con un messaggio se accountInfo fallisce (`sync.failed`).
- Snapshot: il salvataggio unisce per corpo le risorse più recenti (`mergeNewerResources`), più schede non si cancellano a vicenda.
- Posta: riquadro "Oggi" nella scheda Spedizioni (`src/modules/messages/exp-recap.ts`), si aggiorna a ogni rapporto letto;
  "Diario oggi" nella barra si ridisegna con `onJournal`. Verificato con la scheda vuota su s808; con rapporti veri solo nei test.
- Aperto: grafica che sparisce (sonda nel browser dev, nessuna rimozione vista finora); carburante non sottratto dalla stiva.
