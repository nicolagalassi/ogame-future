# 2026-11-23 — Giro delle spedizioni, pagina flotta vuota, ping

- «Salta nelle spedizioni» (era «Salta nel giro»): vale solo per le spedizioni (`nextInRound`), le altre azioni non guardano più l'elenco.
- Giro delle spedizioni circolare: dall'ultimo corpo si torna al primo; finisce quando l'invio prende l'ultimo slot libero
  (`hookSend`). «Salta» (tasto N) disponibile anche nel giro delle spedizioni.
- Pagina flotta senza navi (nessun elenco navi del gioco, quindi niente barra): striscia ridotta `.fut-fempty` con
  l'interruttore e, durante un giro, «Salta». Struttura della pagina vuota non verificata nel gioco (cercato `#fleet1`
  senza `#technologies`, altrimenti `#fleetdispatchcomponent`).
- Ping come OGLight: `responseStart − requestStart` della pagina aperta (Navigation Timing, nessuna richiesta), dopo
  l'orologio del gioco (`.OGameClock`, altrimenti piè di pagina), verde < 400 ms, giallo < 1 s, rosso oltre; nel tooltip
  anche il caricamento completo. Letto una volta per pagina.
- Versione 0.3.138.
- floor-guard: il controllo «test reso più facile» (.skip/.only/.todo) guarda solo i file di test (deciso da Nicola), commit a parte; un .skip in un test resta bloccato (provato).
