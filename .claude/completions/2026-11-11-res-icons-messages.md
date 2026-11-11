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

## 0.3.23
- Niente più parola "grande/enorme" accanto al valore (resta il colore del messaggio).
- Pillola solo dove serve: niente per risorse, navi, materia oscura, artefatti, esperienza forme di vita (`SELF_EVIDENT`); resta per ritardo, anticipo, niente, oggetto (col nome nella riga), mercante, pirati, alieni, buco nero, scoperte. Il trattino del valore (niente trovato) non sale accanto al titolo.

## 0.3.25 — proposta C ("In testa") per tutta la posta
- Vista a schede: il riepilogo va DENTRO `.msgHead`, sulla riga del mittente, a destra (esito solo se serve, risorse/navi, valore). Chiuso (predefinito), la scheda è solo l intestazione: testo e pulsanti del gioco nascosti; un clic sull intestazione (non sui suoi link/pulsanti) apre e chiude. Trasporti/rientri/riciclaggi: niente parola (la dice il titolo), percorso con i soli nomi.
- Tolto `spread()` (pillola nel piede, valore accanto al titolo). Vista a lista invariata.
- Proposte in `docs/mockups/messages-options.html`.
- Da verificare sul markup vero: che la riga del mittente sia l ultima di `.msgHead` (il riepilogo è ancorato in basso a destra).

## 0.3.26 — C sul markup vero
- Markup di Nicola: `.msgHead` > `.msgHeadItem` (titolo + `.underTitle` col mittente) | `.msgHeadItem` (`.msgDate`) | `.msgHeadItem.delActions` | `br`. Il riepilogo è un elemento in più, prima della data (`place`); l intestazione diventa flex. Chiuso: `.underTitle` nascosto, una riga per rapporto. Niente più sovrapposizione col cestino; tolti trattino e tacche di esaurimento nell intestazione. Test col markup vero (`HEAD`).

## 0.3.27 — proposta B ("Bottino") per tutta la posta
- Tolta la C (riepilogo nell intestazione). Il riepilogo torna sotto `.msgHead` (o sotto la riga della vista a lista) con classe `fut-msg-b`: tessere per risorse, navi e note (simbolo sopra, numero sotto), valore a destra dopo una riga verticale, grande. Esiti non evidenti: tessera larga con la parola e una frase (`msg.say.*`; per gli oggetti il nome dell oggetto). Trasporti/rientri: percorso sopra, nessuna parola d esito. Raro/epico: bordo colorato sulle tessere e valore colorato. Chiuso: solo il testo del gioco è nascosto, pulsanti visibili.

## 0.3.28
- Bug: senza tessera d esito la griglia scalava di una colonna e le tessere finivano sotto il valore (molte navi). Colonne fisse (`grid-column` per pillcell/body/val/acts).
- Colonna del valore: tacche di esaurimento in alto, numero, "MSU" sotto (`depletion()` ora va nel valore, chiamata dopo `value()`).
- Navi: tessere più piccole (52px, immagine 22px), vanno a capo su più righe; le risorse restano a tessere grandi (al massimo tre).

## 0.3.29
- Tolto il riepilogo "Oggi" e il riquadro "appena lette" in cima alla scheda Spedizioni della posta (`exp-recap.ts` eliminato, CSS `.fut-recap`/`.fut-fresh` tolti, test relativi rimossi). Il Diario resta nella barra laterale e nella sua finestra.
