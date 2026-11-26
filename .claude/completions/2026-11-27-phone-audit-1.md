# 2026-11-27 — Giro sul telefono: finestre (1)

- `revealActiveTabs` (core/viewport): le strisce di schede che scorrono portano in vista quella attiva
  (Impostazioni, Dashboard, Diario).
- Finestre adattate al telefono disegnate il 15% più grandi (`PHONE_TEXT`): testi 11–13px → 13–15px.
- Dashboard: i gruppi di scelte (`.seg`, es. Investimenti Metallo/Cristallo/…/Plasma) vanno a capo come pillole
  in una finestra stretta invece di uscire dal bordo; un ridisegno (cambio scheda) non rifà l'animazione di
  apertura (`.backdrop.again`).
- Controllate sul telefono: tutte le schede della Dashboard e delle Impostazioni. Test `tests/viewport.test.ts`.
- Versione 0.3.164.
