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

## 0.3.21 — rarità spedizioni
- Normale: nessun colore (RARITY[2] ora grigio, anche nei chip del riepilogo e del Diario). Grande (blu) ed enorme (viola) colorano tutto il messaggio del gioco (`.msg.fut-msgrar-N`: sfondo tinto, bordo pieno tutto intorno; pannelli interni trasparenti). Test in `messages.test.ts`.

## 0.3.22 — riepilogo distribuito sul messaggio (vista a schede)
- `spread()`: la pillola va nel piede del gioco (al centro, tra i pulsanti), il valore MSU accanto al titolo (più piccolo, con "grande/enorme"); la riga di Future tiene risorse e navi, al centro e più grandi (13px, icone 18/24px). Vista a lista invariata (il piede è nascosto finché non si apre). Test "card view".
