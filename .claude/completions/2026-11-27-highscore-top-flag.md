# Classifica: bandierina nelle prime tre posizioni (0.3.175)

- Problema: nelle righe 1-3 (nome, titolo e foto più grandi) il click sulla bandierina apriva la Galassia.
- Causa probabile: solo le righe dalla 4 in giù stringevano `.highscoreNameAndTitleHolder` per lasciare posto
  alla bandierina; nelle prime tre il blocco del gioco (link alla galassia) restava sopra.
- Fix (`src/modules/highscore/index.ts`, CSS): restringimento su tutte le righe e `z-index: 3` sulla bandierina.
- Verifica: `npm run check` ok; non provato in gioco (browser dev non loggato), da confermare da Nicola.
