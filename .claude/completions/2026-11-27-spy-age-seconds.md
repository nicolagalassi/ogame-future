# Tabella spiate: età ordinata al secondo (0.3.169)

- Nicola: più spiate nello stesso minuto uscivano in ordine sbagliato ordinando per età.
- Causa: `sortRows` ordinava su `ageMinutes`, arrotondato al minuto; spiate dello stesso minuto risultavano pari e restavano nell'ordine d'ingresso.
- Fix: `src/modules/messages/spy-table.ts` ordina l'età su `entry.at` (timestamp del rapporto del gioco, al secondo, da `.rawMessageData`). La colonna mostra ancora i minuti.
- Test: tests/raids.test.ts, tre spiate in un minuto (05 s, 40 s, 20 s) in ordine b, c, a e al contrario; col vecchio ordinamento a e c erano pari.
