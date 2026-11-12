# 2026-11-13 — Spedizioni: tabella per i punti del primo giocatore

- `expeditionMax` riceveva sempre `topScore` vuoto, quindi usava la riga oltre 100M punti (5M × fattore) anche negli universi più piccoli.
- Sulla pagina flotta, al caricamento, `universeRanks` (highscore pubblico, cache 1 ora) fornisce i punti del primo giocatore; `prepareExpedition` li passa a `expeditionMax`. Se non ancora noti, resta la riga oltre 100M.
