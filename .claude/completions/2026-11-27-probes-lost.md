# Sonde abbattute (controspionaggio) non sono attacchi (0.3.172)

- Nicola (screenshot posta): i messaggi «È stato perso il contatto con la flotta attaccante» delle sonde abbattute mentre si spia comparivano come combattimento perso («Persa, Perdite 45,0k», −45,0k MSU) e non vanno né colorati né contati nei raid.
- `src/data/messages.ts` `spyingOnly`: un combattimento lato attaccante senza bottino con sole sonde spia (210) perse è controspionaggio → il lettore restituisce null: nessun riassunto sul messaggio, niente diario. Vale per il tipo 48 e per il rapporto di combattimento completo.
- Un tipo 48 con navi vere (attacco distrutto al primo round) resta un combattimento perso.
- Test: tests/messages.test.ts. Non provato sulla posta vera: il browser di prova chiedeva un nuovo login.
