# 2026-11-20 — Galassia: il numero di classifica apre la classifica

- Il badge «#61» accanto al giocatore nella galassia ora è un link alla classifica giocatori, alla pagina dove
  c'è il giocatore (`site=ceil(rank/100)`, `searchRelId`): stessa forma della barra Bersagli, ora in `core/game-links.ts`
  (`highscoreHref`), usata anche lì. Il passaggio del mouse mostra ancora la scheda dei punti.
- `isOurs` nella galassia usa `nodeType` invece di `instanceof Element` (errore di un osservatore che scatta tardi).
- Richiesta di dividere «Militare» in flotta e difese: l'API pubblica dà solo il totale militare e il numero di navi;
  non fatto, alternativa proposta a Nicola. Versione 0.3.133.
