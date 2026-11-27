# Galassia: niente tooltip del gioco sul nome, la scheda di Future al suo posto (0.3.187)

- Nicola: «sulla galassia però va rimosso il tooltip originale di ogame».
- `quietGameTooltip` (galaxy): via la classe `tooltipRel` (il gioco non lo aggancia più), `_tippy.disable()` subito
  e a ogni mouseenter/focus (se il gioco l'aveva già agganciato o lo aggancia dopo).
- `gameActions`: i `li` con link della `.ListLinks` del tooltip del gioco (esclusa la riga del rango) copiati nella
  scheda; la scheda diventa cliccabile (`.live`), resta aperta 200 ms mentre il puntatore passa dal nome alla
  scheda, si chiude uscendo dalla scheda o al click su un'azione (che resta del gioco: classi e data-* copiati).
- Regola annotata in docs/OGLIGHT-RULES.md (11). Test in galaxy.test.ts. Non provato in gioco: da verificare che
  il tooltip non compaia più e che «Scrivi» e «Richiesta amicizia» dalla scheda funzionino.
