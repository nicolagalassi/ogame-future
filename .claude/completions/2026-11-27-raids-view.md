# Scheda Raid del Diario nello stile delle spedizioni (0.3.171)

- Nicola: «miglioriamo un po' nello stile spedizioni la tabella dei raid».
- `modules/messages/journal-view.ts` `raidView`: riquadro grande col netto del periodo (raid e media a raid), bottino e detriti (con «di cui detriti»), navi perse; barra del bottino per risorsa in MSU; grafico per ora (oggi/ieri) o per giorno, colonna cliccabile che filtra i riquadri sotto; «Bersagli migliori» (coordinate con link alla galassia, numero di raid, bottino) accanto alle navi perse; tabella dei giorni con raid.
- `engines/expeditions.ts`: `raidHours`, `raidDays`, `raidTargets`. Tolte le chiavi morte `exp.raidCount`, `exp.raids`; nuove `exp.raidHeroCount`, `exp.raidAvg`, `exp.raidTargets`.
- Verificato con una pagina locale col vero codice del Diario e una settimana di raid di prova (nessun dato scritto nel gioco); test in tests/messages.test.ts.
