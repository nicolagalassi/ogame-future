# Icone risorse in un solo posto; messaggi (2026-11-11, 0.3.20)

- `src/core/res-icons.ts`: unico disegno di metallo, cristallo, deuterio, cibo, materia oscura
  (`RES_PATHS`, `resIconSvg`). Lo usano la barra flotta (`fleet/icons.ts` li include), i totali del
  menu pianeti, i riepiloghi in posta e il riquadro "appena lette" delle spedizioni. Cambiare un
  disegno lì lo cambia ovunque; i colori restano `RES_COLORS` in `core/sheet.ts`.
- Posta: al posto dei pallini con l'iniziale (M, C, D…) c'è il simbolo colorato. Il percorso
  (trasporto, schieramento, rientro, riciclaggio) prende la prima riga da solo: le risorse stanno
  tutte nella seconda.
- Rapporti di spionaggio: niente più riepilogo sul messaggio, c'è già la tabella spiate. Resta il
  riepilogo del controspionaggio (chi ti ha spiato). Chiavi `msg.abbr.*` tolte.
