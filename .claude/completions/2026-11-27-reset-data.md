# Dati: azzera statistiche e impostazioni (0.3.177)

- Impostazioni › Dati, due righe nuove: «Azzera le statistiche» e «Azzera le impostazioni». Prima pressione
  «Azzera», poi «Sì, azzera» (colore warn) o «Annulla»: niente parte con un solo click.
- Solo l'universo e il giocatore in uso (`src/engines/reset.ts`, `resetKeys`):
  - impostazioni = `CARRY_COPY` + `marks.view` + `fleet.settings` + `fleet.profiles` (regole e fleetsave dei corpi);
  - statistiche = `exp.journal`, `account.history`, `orion.archive`, `orion.mult`.
  - restano bersagli, note, posizioni, piani, dati letti dal gioco, guide (`future:tour.*`), `orion.imported`
    (così il calcolatore Orion non viene reimportato da solo).
- Storage: `KeyValueStore.delete`, `GM_deleteValue` (nuovo `@grant` in scripts/build.mjs).
- Dopo l'azzeramento il messaggio chiede di ricaricare la pagina (come «Porta qui»).
- Test: tests/reset.test.ts, tests/settings.test.ts. Screenshot di prova in scratchpad/reset. Non provato in gioco.
