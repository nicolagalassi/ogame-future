# 2026-11-12 — Ripeti: niente secondo invio dalla pagina che sta cambiando

- `hookSend` (repeat.ts): dopo un invio riuscito con cambio pagina preso da Future, la `submitFleet2` di quella pagina non fa più nulla. Prima, Invio premuto di nuovo mentre caricava il pianeta successivo rimandava la flotta con le navi rimaste (tutti i cargo).
- Causa dedotta dal codice, non riprodotta in gioco.
- Nicola: le navi in più vengono selezionate sulla luna successiva. Aggiunto `holdContinue`: sulla pagina aperta da Ripeti, Invio e clic su Avanti / Invia flotta sono trattenuti finché la preparazione non è finita (al massimo 8 s).
