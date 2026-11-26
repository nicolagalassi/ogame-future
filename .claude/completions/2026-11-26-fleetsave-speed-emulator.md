# 2026-11-26 — Velocità del fleetsave su telefono, provata nell'emulatore Android

- Prova con l'emulatore Android di Nicola (Chrome, `adb forward tcp:9223 localabstract:chrome_devtools_remote`,
  `FUTDEV_CDP_PORT=9223 node scripts/dev-browser.mjs start`, tocchi veri via CDP `Input.dispatchTouchEvent`).
- Scoperte: sul telefono la barra della velocità è la stessa del computer (`.percentageBar`, `.step[data-step]`);
  `document.createTouch` non esiste più, quindi usa i gestori del mouse e decide dalla posizione del puntatore.
  Un `.briefing_overlay` del gioco la copre finché la missione non è scelta.
- Corretto: tolto `speedButton` (0.3.151, il click sulle caselle non fa niente: la barra restava su 100 mentre
  Future impostava 30); `setSpeedBar` torna a `setValue` ovunque. La domanda «anche per i prossimi?» mostrava il
  riquadro del primo disegno (sostituito da un ridisegno): ora usa quello della pagina (`box.closest`). Su telefono
  è sopra la barra touch, alla sua stessa scala (`placeAboveTouchBar`); riga messaggi vuota nascosta.
- Verificato nell'emulatore: 30 in pagina 2, tocco su 40 → 40, domanda visibile, «Sì» → giro al 40%.
- Il blocco «va a 10» del telefono di Nicola non si riproduce in Chrome sull'emulatore: probabile browser diverso
  (chiesto quale). Versione 0.3.152.
