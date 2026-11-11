# Flotta: Trasporto/Schiera semplici, Raccolta spedizioni secondaria; icone piene; Dashboard (2026-11-11)

Versione 0.3.12.

## Flotta (`src/modules/fleet/`)
- **Trasporto (T) / Schiera (D)** ora sono le azioni normali del gioco, senza riserve: destinazione
  scritta in fleet1 (`g:s:p`, pianeta/luna, freccia = scegli tra i tuoi corpi) e risorse da portare
  (vuoto = tutto, 0 = niente, `2m`/`500k`). Riga `sendRow()`, salvata in `FleetSettings.sendTarget` /
  `sendPick`. Navi: quelle scelte a mano sui riquadri del gioco; altrimenti i cargo necessari
  (trasporto) o tutte (schiera). `prepareSend()` in `actions.ts`, `pickedLoad()` / `parseCoords()` in
  `engines/fleet.ts`. Non entrano in "Ripeti".
- **Raccolta spedizioni** (secondaria, a destra con la Luna): un riquadro che apre un menu con
  1 · Trasporto e 2 · Schieramento verso la luna principale (le vecchie T/D, con le riserve; tasti
  C e V, azioni `fleet.collect` / `fleet.collectDeploy`) e "una volta sola verso" un altro corpo.
  Modi interni rinominati `collect` / `collectDeploy` (anche nell'URL di "Ripeti").
- Icone: piene (`fill=currentColor`, seconda tinta con opacità), argento su ardesia; accento meno
  saturo (#6FB6C8) solo per interruttori e fuoco.

## Dashboard
- Forme di vita: `table-layout: fixed` con `<colgroup>`, colonne pianeta tutte uguali, nomi su due righe.
- Navi/Difese: icone pianeta e luna nel selettore Pianeti | Lune.

## Da verificare in gioco
- Riga destinazione/risorse alla larghezza reale della pagina flotta (prova in Chromium a 660px: una riga).
- Trasporto semplice con navi già selezionate a mano.

## Revisione (0.3.13, richiesta di Nicola)
- T / D non preparano più nulla da soli: accendono (e spengono) la modalità, che apre il pannello
  `sendPanel()` sotto i pulsanti. Coordinate in tre campi (incollare `1:234:5` li riempie tutti),
  risorse con i simboli M/C/D, a destra CL / CP con il numero di cargo che servono (contato mentre si
  scrive). CL / CP chiama `prepareSend(..., cargoShip)`: cargo di quel tipo per le risorse, dopo la
  capacità delle navi scelte a mano (che restano); avvisa se i cargo non bastano (`missing`).
- `FleetSettings.sendMode`; `SendTarget.galaxy/system` possono essere null; `cargoCount`, `resolveSend`.

## 0.3.14
- Vuoto = 0 (`pickedLoad`: null = niente). Il simbolo di ogni risorsa è un pulsante: riempie il campo
  con tutto quello che c'è sul corpo. "Tutto" → "Svuota".
- `readMissionLink()`: dai link Trasporto / Schiera del gioco (mission 3/4 + coordinate nell'URL) la
  pagina flotta accende T o D, scrive le coordinate e mette il fuoco sul metallo. Una volta per pagina
  (`data-fut-mission-link`). **Da verificare in gioco** che il link della galassia porti quei parametri.

## 0.3.15
- Modalità T/D, coordinate e risorse si azzerano a ogni nuova pagina (refresh, cambio corpo); restano tra i ridisegni della stessa pagina (`data-fut-send-page`).
