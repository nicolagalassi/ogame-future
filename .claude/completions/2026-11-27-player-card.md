# Scheda giocatore in galassia e in classifica (0.3.186)

- Nicola: specchietto di OGLight sul nome (punti e posizione per classifica); «miglioriamo questo aspetto sulla
  galassia e mettiamolo nella classifica».
- Nuovo `src/modules/player-card/index.ts` (`attachPlayerCard`, `openPlayerCard`, `closePlayerCard`): titolo con
  nome e posizione generale; Generale, Economia, Ricerca, Forme di vita, Militare (ordine OGLight) con icona e
  colore come la scheda della barra, punti e posizione; Flotta e Difese stimate sotto Militare; navi ed età API.
  Pausa di 180 ms al passaggio del mouse (niente chiamata per ogni riga attraversata), subito al focus.
  Caratteri del sistema (--display per i numeri, --body), al posto di Consolas (avviso del hook impeccable).
- Galassia: la vecchia `openCard`/`closeCard` e il CSS `.fut-g-card` tolti; scheda sul badge della posizione e
  sul nome. Classifica: scheda sul nome di ogni riga (serve `guard`, già passato da main).
- Dati: API pubblica playerData.xml (user-view, in cache), come prima.
- Test: galaxy.test.ts (ordine e pausa: Behavior-Changed), highscore.test.ts. Screenshot scratchpad/card/card2.png.
