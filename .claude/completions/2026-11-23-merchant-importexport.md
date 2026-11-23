# 2026-11-23 — Mercante azzurro con l'import/export disponibile

- Richiesta di Nicola («come OGLight»). Sorgente di OGLight non trovato; meccanismo preso da OGame Infinity
  (`importExportInfo`: `hasBought` / `gotItem` = false → offerta da usare) e da docs/API-NOTES.md.
- `src/data/import-export.ts`: una chiamata per sessione al caricamento (guard, `page-load`, niente cp), segnata prima
  della chiamata; nuova lettura dopo una pagina del Mercante (`component=trader…`) e con Sync. Risposte senza i campi
  lasciano lo stato salvato com'era.
- `src/modules/merchant`: classe `fut-ie-open` su `<body>` + regola nel foglio di Future sul testo dell'etichetta
  (`.menubutton[data-ipi-hint="ipiToolbarTrader"] .textlabel`, selettore di Infinity, non verificato qui). L'elemento
  del gioco non viene mai toccato. GRAY AREA (§1.7) nel codice; voce 8 in docs/OGLIGHT-RULES.md (non verificata).
- Versione 0.3.141.
