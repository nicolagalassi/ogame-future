# Classifica: bandierina in riga con la "i" (0.3.36)

- Dall'HTML reale: la cella `td.sendmsg` contiene `div.sendmsg_content` (blocco) → la bandierina finiva sopra la "i".
  Ora bandierina e `.sendmsg_content` sono inline-flex sulla stessa riga, allineate a destra.
- Riga propria (`myrank`): il blu del gioco attenuato come le altre righe, con una barretta blu a sinistra.

## 0.3.37
- Il cambio di display/width su `.sendmsg_content` faceva sparire la "i" (il suo box ha dimensioni proprie).
  Ora la "i" del gioco non si tocca: la cella ha 22px di padding a sinistra e la bandierina è posizionata lì in assoluto.

## 0.3.38
- Nella cella della "i" la bandierina finiva comunque sopra (il gioco impagina quella cella a modo suo).
  Ora la cella della "i" non si tocca più: la bandierina sta al bordo destro della cella del nome (`td.name.fut-hs-fl`),
  subito accanto alla colonna della "i"; nome e punti onore lasciano 54px liberi.
