# Diario come rendiconto, colonne per ora/giorno, pannellino (2026-11-11, 0.3.30)

Scelta di Nicola dai mockup `docs/mockups/journal-options.html`: "1 Rendiconto" con le colonne della "2", anche per il giornaliero.

- `src/modules/messages/journal-view.ts`, scheda Spedizioni (`expeditionView`): guadagno netto grande del periodo, spedizioni / media / navi perse, barra della provenienza del valore (metallo, cristallo ×1,5, deuterio ×3, navi; `valueMix`) con le chiavi a simboli. Poi le colonne: una per ora con Oggi/Ieri (`hourSeries`), una per giorno con 7/30 giorni/Tutto (`daySeries`, 30 per i due lunghi), impilate per provenienza, netto sopra (≤14 colonne). Clic su una colonna = esiti e navi di quella ora/giorno ("Tutto il periodo" torna indietro); la riga del giorno si evidenzia in tabella. Esiti a barre orizzontali ordinate + normali/grandi/enormi; navi trovate e perse. Tabella dei giorni (solo periodi lunghi) con simboli nelle intestazioni e una barretta del netto. Missioni artefatti e Raid invariati.
- Pannellino Diario (`modules/dock`): Oggi grande (netto MSU, numero di spedizioni), sette colonnine degli ultimi 7 giorni (oggi in ciano), riga dei 7 giorni. `DockOptions.journal.days` da `daySeries` in `main.ts`.
- Test: serie per ora/giorno e `valueMix`, clic su una colonna, pannellino.
