# Guide di Future sopra al gioco (0.3.168)

Richiesta di Nicola: tutorial «sopra al tool» che alla prima apertura di ogni funzione mostri 1 fai questo, 2 fai quest'altro, con riflettore, freccia e vignetta; un «?» sulle funzioni.

## Cosa c'è
- `src/core/tour.ts`: motore. Velo in 4 pannelli attorno al controllo, anello giallo, scudo che blocca i tocchi sul controllo illuminato, fumetto con freccia, traccia di avanzamento a celle, Avanti/Indietro/×, tasti ←/→/Esc (presi sulla window prima delle finestre). Telefono zoomato: fumetto agganciato al bordo opposto al controllo (core/viewport `top`, nuovo). `helpButton` per i «?».
- `src/modules/guide/index.ts`: 9 guide (plancia, flotta, impostazioni, dashboard, piano, diario, galassia, posta, costruzioni), invito alla prima apertura (angolo, non oscura né blocca nulla; Mostrami / Più tardi / No, grazie), osservatore DOM per superfici che arrivano dopo (galassia, posta, pannello costruzione), avvio da altra pagina con `?futguide=`, scheda Guida (primi passi con stato Fatto/Mostrami, tutte le guide, interruttore inviti, ripristino).
- «?» nella testata di Impostazioni, Dashboard, Piano, Diario; «?» accanto a Missione, Destinazione, Riserve, Giro nella flotta (spiega solo quella zona).
- Guide viste in uno Store globale (`future:tour.seen`), non per universo.

## Conformità
- Nessuna guida parte da sola: il velo copre anche Shop/Mercante/Ufficiali come le finestre, quindi solo da un clic. L'invito non oscura; sul telefono sta in basso (sopra la barra di Future), non in alto dove ci sono gli Ufficiali (§1.7).
- Avanti non tocca mai il gioco; il controllo illuminato è coperto da uno scudo. Scorciatoie sospese mentre la guida è aperta (`fut-tour` in WINDOWS).
- Nessuna chiamata di rete; l'osservatore legge solo il DOM.

## Peso
- Tetto 1150000 byte: build a 1149924. Per starci: output esbuild `charset: 'utf8'` (lettere accentate non più in escape, −4,6 KB su tutto lo script), CSS dei pulsanti condiviso, tolti due passi minori (Totali, Inverti), tolte due stringhe morte (`guard.refused`, `data.missing`; il test dei segnaposto usa `tour.count`).
- Il tetto è praticamente pieno: la prossima funzione chiede a Nicola di alzarlo o togliere peso.

## Verifiche
- 332 test (nuovo tests/tour.test.ts: ordine, salto, scudo, Esc prima delle finestre, tasti sospesi, inviti, No grazie/Più tardi/spento, «?» di zona, URL, scheda Guida, testi in 4 lingue).
- Gioco vero desktop: invito, guida plancia (9 passi), guida flotta (10), Impostazioni sopra la finestra, Avvia Dashboard dalla scheda Guida, Galassia con invito dopo il caricamento.
- Emulazione telefono (CDP, 412 px, zoom 0,38, tocco): fumetto agganciato, invito in basso, passo «Avanti e Invia» sulla barra, «?» Riserve. Firefox non provato.
- Dal vivo anche Piano (3 passi), Diario (4), Costruzioni (parte da `?futguide=tech` appena si apre un edificio), Posta (scheda spiate, `component=messages`).

## Seconda passata (dopo revisione)
- Invito sul telefono / con barra touch: sopra i tasti (setTouchNote), Avanti/Invia restano liberi; tolto dalla barra alla chiusura.
- «Più tardi» vale 6 ore per tutte le pagine (`future:tour.later`) e non apre subito un altro invito.
- Velo con sfocatura 2px (richiesta di Nicola), freccia gialla come l'anello.
- Se la pagina ridisegna il controllo durante la guida, l'anello ritrova il nuovo.
- Aprire una finestra non cancella le guide in attesa della pagina (galassia, edificio).
