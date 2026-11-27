# Flotta: Riserve e Giro allineati (0.3.176)

- Problema: «Riserve ?» e «Giro ?» hanno larghezze diverse, i chip delle due righe partivano in punti diversi;
  «Regole» stava a metà altezza di una riga di chip andata a capo.
- Fix (`src/modules/fleet/style.ts`): nella striscia `.fut-freserves` le regole sono una griglia a due colonne
  (etichette `max-content`, chip `1fr`) e ogni gruppo usa `subgrid`; «Regole» `align-self: flex-start`.
- La striscia vuota (corpo senza navi) non cambia: lì il gruppo non sta dentro `.fut-frules`.
- Verifica: pagina di prova in scratchpad/resv (screenshot), `npm run check` ok. Non provato in gioco.
