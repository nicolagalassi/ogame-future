# 2026-11-26 — Riserva navi in tutte le missioni tranne spedizione e fleetsave

- Nicola: la riserva navi deve valere ovunque tranne spedizione e fleetsave (che ha la sua).
- Prima la ignoravano: Trasporto / Schiera semplici (`prepareSend`, ora parametro `keep` dalla riserva attiva),
  la consegna del Piano (`prepareDelivery`, prima per scelta del 2026-11-13) e, di default, il trasporto della
  Raccolta e «Su luna» (`collectIgnoreShips` ora spento di default; resta l'impostazione).
- Le navi scelte a mano sul gioco restano come le sceglie il giocatore. Testo d'aiuto della riserva aggiornato.
- Versione 0.3.144.
- 0.3.145: anche dopo il pulsante arancione del gioco «seleziona tutte le navi» (`#sendall`) Future toglie la riserva
  navi dai campi (`keepReserveOnSelectAll`, come l'inversione: solo i campi del gioco), tranne durante un giro di
  spedizioni o di fleetsave e con l'interruttore della riserva spento. Selettore `#sendall` / `a.send_all` non verificato in gioco.
