# 2026-11-19 — Campo quantità del cantiere e spiate cancellate

- Cantiere / difese: il campo quantità di Future si apre vuoto (prima 1) e con il mouse prende il focus (sul telefono no,
  aprirebbe la tastiera). Invio: la quantità (con i limiti di prima) va nel campo del gioco e preme una volta il suo
  «Costruisci»; Invio tenuto premuto o campo vuoto non fanno niente. Il piano scala come col click.
- Spiate: il cestino della tabella cancella anche il messaggio della spiata con il pulsante del gioco (`deleteReportInGame`,
  un messaggio per click, solo se è nella pagina e non è condiviso) e segna il bersaglio come tolto (`spy.dismissed`,
  `dismissSpy` in `engines/raids.ts`): rileggendo la posta un report non più nuovo non lo riporta in tabella.
  Segnato GRAY AREA (nessun precedente OGLight scritto). Tooltip del cestino aggiornato nelle 4 lingue.
- Non verificato in gioco: se il pulsante di cancellazione del gioco chiede conferma o reagisce al click simulato.
- Versione 0.3.130.
