# 2026-11-20 — Militare diviso in flotta e difese

- Regole delle classifiche (date da Nicola): le difese contano sia in Economia sia in Militare, una volta nel Generale.
  `src/engines/military.ts`: difese = Economia + Ricerca + Militare + Forme di vita − Generale (tra 0 e Militare), flotta = Militare − difese.
  Verificato sui numeri reali del test (Dalinar, en808): senza Forme di vita verrebbe negativo; con, 1,68M difese su 2,76M.
- Scheda della galassia: sotto «Militare» le righe «Flotta» e «Difese» (rientrate, senza posizione, con spiegazione al passaggio).
- La barra Bersagli mostra ancora solo «Militare». Versione 0.3.134.
