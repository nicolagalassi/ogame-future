# 2026-11-13 — Fleetsave in giro: velocità cambiata a mano, solo per il resto del giro

- Pagina 2 della flotta: se durante un giro di fleetsave (solo fleetsave, non spedizioni o raccolte: Nicola) con Ripeti attivo e un prossimo corpo, il giocatore cambia la velocità rispetto a quella preparata, nella barra di Future compare "Velocità X% anche per i prossimi fleetsave del giro? Sì / No".
- Sì: `RepeatState.speed` = X, portato nell'URL del giro (`futspeed`); sulle pagine successive il fleetsave usa X al posto della velocità del preset. Le impostazioni non cambiano; finito il giro, X sparisce.
- Rilevamento: click sulla barra `#speedPercentage` del gioco, poi lettura di `fleetDispatcher.speedPercent`. `pageState.prepared` = velocità dell'ultima preparazione di Future sulla pagina.
- Provato in gioco nella prima versione (giro di spedizioni, senza inviare): domanda mostrata, Sì conferma, `futspeed` prepara alla velocità scelta. Poi limitato al fleetsave; su questo account il pianeta di prova non ha un fleetsave impostato, quindi il caso fleetsave è verificato solo da codice e test.
