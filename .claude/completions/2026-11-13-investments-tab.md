# Dashboard: scheda Investimenti, passi raggruppati (0.3.73)

- Nuova scheda «Investimenti» (dopo Riepilogo): tassi, link ai dati mancanti, sequenza di 60 passi raggruppata. Il riquadro del Riepilogo mostra i primi 5 gruppi; il titolo apre la scheda. Tolta la scheda espandibile.
- `groupSteps`: passi consecutivi con stessa tecnologia e stesso livello = una riga, un chip per pianeta (link alla pagina dove si costruisce, con cp=), costo totale, giorni min–max. Chip ambra = slot FV dedotto.
- Fatti: chip barrato quando il livello è in costruzione (code del gioco, per nome) o visto sulla pagina della tecnologia (`tech.seen`, scritto in main.ts da ogni pagina tecnologie). Al prossimo Sync il piano si ricalcola e i fatti escono.
- Provato su s808-en.
