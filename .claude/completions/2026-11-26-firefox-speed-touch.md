# 2026-11-26 — Velocità del fleetsave su Firefox per Android

- Nicola usa Firefox + Tampermonkey sul telefono. Lì la barra della velocità del gioco prende il percorso touch
  (`document.createTouch` esiste) e in `onTouchEnd` legge `e.originalEvent.pageX`, che un TouchEvent non ha:
  `calcValue(undefined)` → valore 0, la barra al minimo, ogni tocco uguale («va a 10 e si blocca»).
- Riprodotto nell'emulatore Android collegando alla barra i gestori touch del gioco e toccando con un tocco reale
  via CDP: 0.3.152 → speedPercent 0; con la correzione → 4, poi 7 e 2 ai tocchi successivi.
- `fixSpeedBarTouch` (fleet/index.ts): ascoltatore in cattura su `touchend` dentro `.percentageBar` che completa
  `pageX`/`pageY` dall'`changedTouches[0]` prima che il gioco li legga. Chrome (percorso mouse) non cambia.
- Versione 0.3.153.
