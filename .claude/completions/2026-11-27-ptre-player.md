# PTRE, fase 1b: info giocatore (0.3.181)

- Prova di Nicola: «Salva su PTRE» funziona sul suo universo (PTRE accetta tool=future); sul PTS i team non vanno.
- `src/data/ptre.ts`: `PTRE_FRAMES`, `parsePtrePlayer` (come OGLight: activity_array/check_array in JSON,
  top_sr_*, fleet_json; link accettato solo se su ptre.chez.gg), `ptrePlayerInfo`, `ptreProfileUrl`.
- Guard: `oglight_get_player_infos.php` in `PTRE_SCRIPTS`.
- Scheda giocatore (`src/modules/marks/side.ts`): pulsante «PTRE» (solo con team key), pannello con periodi
  (24h…mese), barre dell'attività per ora (altezza = attività, opacità = quanto è controllata l'ora), miglior
  rapporto del team (data, punti flotta, navi), link al rapporto e al profilo su PTRE. Una chiamata per
  giocatore e periodo per pagina, solo da click.
- Revisione Emil: chip dei periodi distinguibili dal fondo, :active scale(0.97) su azioni e pulsante PTRE.
- Test: tests/marks.test.ts «PTRE on the player sheet». Screenshot scratchpad/ptre2/side.png.
