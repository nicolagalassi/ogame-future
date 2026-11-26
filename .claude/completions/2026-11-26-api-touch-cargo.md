# 2026-11-26 — API copiata ovunque, pulsanti su smartphone, stiva in evidenza

- API: con l'HTML vero del pulsante (`button.msgApiKeyBtn.icon_apikey`, chiave in `data-tooltip-title` dentro
  `<input value='sr-…'>`) un solo ascoltatore per pagina (cattura) copia la chiave da qualsiasi pulsante API
  (elenco o dettaglio, spiate e battaglie) e non apre il tooltip. Tolto il vecchio `apiButton`.
- Smartphone (pointer: coarse): solo Spedizione, Fleetsave e due pulsanti diretti della Raccolta («Raccogli» e
  «Schiera» verso le destinazioni preferite, `.fut-touch`), più grandi. Trasporto / Schiera semplici, Ultima, Su luna
  e il menu Raccolta restano sul computer.
- «Stiva»: etichetta col giallo pedina (bordo, icona cargo, alone leggero).
- Aperti (chiesti dettagli a Nicola): velocità del fleetsave su smartphone che va a 10 e si blocca (ipotesi: la
  barra percentuale del gioco su mobile vuole valori diversi da `setSpeedBar`), glitch rossi su riepilogo flotta e ufficiali.
- Versione 0.3.149.
- 0.3.150 (smartphone): la domanda sulla velocità del fleetsave (pagina 2) su touch è fissa in fondo allo schermo
  (`.fut-faskbar`, position: fixed) — ipotesi: comparendo sopra «Invia» spostava la barra della velocità sotto il dito,
  che finiva al 10% e restava incastrata. Variabili di colore di Future solo sulle campanelle della lista eventi
  (prima su tutto `#eventContent`: ipotesi per il rosso su mobile). Non verificato su telefono.
- 0.3.151: dagli screenshot di Nicola — su telefono la velocità è una fila di pulsanti 10…100: `setSpeedBar` su touch preme
  il pulsante della percentuale (`speedButton`, cerca la fila attorno a «100») invece di `setValue(passo)`, che
  selezionava 10 e bloccava la barra. Barra in alto tornata com'era (i pulsanti telefono erano quelli in basso);
  barra touch in basso: solo Raccogli / Schiera / Spedizione / Fleetsave con icone diverse e nome sotto
  (`touchName`, `keysOnly` per gli altri); nella pagina Flotta niente frecce pianeta. Verificato a 390 e 420 px.
