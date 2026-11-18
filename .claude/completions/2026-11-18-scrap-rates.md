# 2026-11-18 — Rottamatore: tendina intera e percentuali rapide

- Tendina dei pianeti tagliata a sinistra: `.bmenu` era allineata a destra del pulsante e, più larga di lui, usciva dalla
  finestra. Opzione `align: 'left'` nel selettore condiviso (`core/body-picker.ts`, default invariato), usata dalla Dashboard;
  all'apertura la lista scorre in vista (`scrollIntoView` nearest) per le tabelle corte. Misurato in Chromium a 1280 e 760px.
- Percentuali rapide 75/81/83/85/87/90 accanto al campo (che resta libero); quella in uso evidenziata. Tetto del calcolo
  portato da 75 a 90 (`SCRAP_MAX`), testo d'aiuto riscritto nelle 4 lingue. Il massimo reale del gioco va chiesto a Nicola.
- Prima modifica che usa `Behavior-Changed` (test del tetto). Versione 0.3.129.
