# 2026-11-27 — Ingranaggio nella barra touch

- `setTouchSettings(doc, open)` (shortcuts): tasto «Impostazioni» fisso a destra della barra touch su ogni pagina
  tranne la flotta (barra piena; la pagina ha il suo pulsante Impostazioni). main.ts lo collega a
  `openFutureSettings()`.
- Galassia: le frecce dei pianeti non stanno più nella barra (identiche a quelle del sistema, spingevano fuori
  l'ultima freccia); restano bersaglio, ← → ↓ ↑ della galassia e l'ingranaggio.
- Verificato nell'emulatore (panoramica, galassia; tocco sull'ingranaggio apre le Impostazioni). Versione 0.3.163.
