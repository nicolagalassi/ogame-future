# 2026-11-27 — Eventi: verifica su dati reali, niente attesa, dettagli al tocco

- Lettore delle righe verificato su una tabella eventi REALE (snapshot v12 di s269-it, da ogame-one/reference):
  `tests/event-list-v12.ts` + test: 28 righe, 14 spedizioni da lune contate una volta ciascuna (andata+ritorno),
  luna di partenza da `td.originFleet figure.moon`, destinazione con la figura dentro `span.tooltip`.
  Non verificati su dati reali: righe ostili (attacco/spionaggio) e la classe del campo detriti (`figure.tf`).
- La lettura al caricamento non blocca più il disegno: parte dentro la finestra di caricamento, dopo le altre,
  e il menu si ridisegna quando arriva (main.ts).
- Tocco su flotte in volo / simbolo rosso: dettagli (missione, quante, orari) invece di aprire il pianeta; sul
  telefono nel messaggio della barra touch, sul computer in una scheda accanto al pianeta.
- `position: relative` dei corpi attaccati solo nel menu di Future (nel layout del gioco la luna è assoluta).
- OGLIGHT-RULES.md regola 9: lettura dell'elenco eventi, «come OGLight» NON verificato; commenti corretti.
- Firefox Android: `-moz-text-size-adjust: none` nelle finestre.
- Prova di scrittura nell'emulatore con tastiera vera: finestra sopra la tastiera, salvataggio all'uscita dal campo.
- Versione 0.3.166.
- Revisione design (impeccable + emil, regole di DESIGN.md): frecce delle flotte e chiusura come icone SVG del
  sistema (non caratteri di testo), niente alone sul simbolo rosso, righe di «Pianeti e lune» in un'unica scheda
  con linee sottili come le altre righe delle Impostazioni. Il riquadro rosso pieno resta (richiesta esplicita
  di Nicola, «illuminare di rosso» come OGLight).
