# 2026-11-26 — Colori delle azioni anche sulla pagina flotta

- `MISSION_TONES` + `toneRules` in core/sheet.ts: un solo posto per i colori (Accentra verde, Spedizione blu,
  Fleetsave viola), usato dalla barra touch e dai pulsanti della pagina flotta (`.fut-fact[data-mode]`).
- Pagina flotta: icona e riga in basso nel colore, sfondo appena tinto; Accentra resta con il contorno del
  pulsante secondario più la riga verde; selezionato = riga gialla in alto più quella del colore.
- Verificato nell'emulatore. Versione 0.3.157.
