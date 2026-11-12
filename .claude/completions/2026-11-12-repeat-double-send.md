# 2026-11-12 — Ripeti: niente secondo invio dalla pagina che sta cambiando

- `hookSend` (repeat.ts): dopo un invio riuscito con cambio pagina preso da Future, la `submitFleet2` di quella pagina non fa più nulla. Prima, Invio premuto di nuovo mentre caricava il pianeta successivo rimandava la flotta con le navi rimaste (tutti i cargo).
- Causa dedotta dal codice, non riprodotta in gioco.
