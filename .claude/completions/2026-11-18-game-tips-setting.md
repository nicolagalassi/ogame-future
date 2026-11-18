# 2026-11-18 — «Scheda del gioco sui pianeti» non restava spenta

- Causa: `src/main.ts` salvava e rileggeva mode / totals / fleet / totalView del menu pianeti, ma non `gameTips`:
  spenta funzionava fino al refresh, poi tornava attiva (valore di default).
- Ora salvata in `planetMenu.gameTips` e riletta al caricamento (default acceso). Versione 0.3.125.
