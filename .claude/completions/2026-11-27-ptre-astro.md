# PTRE: astrofisica nella scheda giocatore (0.3.185)

- Nicola: «Sì questo sarebbe carino, con magari tra parentesi numero colonie».
- `src/data/ptre.ts`: `ASTRO_KEY` (`ptre.astro`, id → livello e quando), `coloniesFor` (ceil(livello/2));
  `ptrePlayerPlanets` conserva `last_astro_level_seen` / `_timestamp` della stessa risposta (nessuna chiamata in più).
- Scheda (`side.ts`): piè «Pianeti N · lune M · Astrofisica L (C colonie)», tooltip con la data e i pianeti
  massimi compreso quello madre; l'età dell'API passa a destra nello stesso piè.
- Arriva solo con «Invii mentre giochi» acceso (la lettura dei pianeti PTRE è dietro l'interruttore).
- Test: ptre-auto.test.ts, marks.test.ts. Screenshot scratchpad/ptre2/astro.png.
