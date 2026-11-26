# 2026-11-26 — Domanda sulla velocità del fleetsave nella barra touch

- Nicola: su telefono, a pagina zoomata, il riquadro fisso della domanda «anche per i prossimi fleetsave del giro?»
  si perdeva per la pagina.
- `setTouchNote` (shortcuts): un messaggio portato dalla barra touch, appoggiato sopra i suoi tasti; si muove e si
  ridimensiona con la barra (che segue il `visualViewport`). La domanda di fleet/index.ts usa quello quando la barra
  touch c'è (Sì → conferma per 3 s, No → via); sul computer resta nella barra in pagina 2. Tolti `placeAboveTouchBar`
  e il riquadro fisso su touch.
- Verificato nell'emulatore Android, anche dopo uno zoom con due dita (scala 0,38 → 0,96): domanda sopra la barra, in vista.
- Versione 0.3.154.
