# Regole ricavate da OGLight

OGLight 5.4.3 è tollerato. Queste regole emergono dal suo codice e valgono anche per Future, in aggiunta ad [AGENTS.md](../AGENTS.md).

1. **Fetch solo al caricamento pagina.** Nessun polling. Future va oltre: `accountInfo` una sola volta per sessione (AGENTS.md §4.1).
2. **Sync manuale:** l'aggiornamento forzato parte solo da un click del giocatore.
3. **Un click, un invio.** Anche le code di sonde nascono da click distinti.
4. **Notifiche solo su richiesta, per singola flotta,** attivate a mano dal giocatore.
5. **Salvataggio a giocatore inattivo** (10 secondi senza input).
6. **Nessuna UI alternativa:** si arricchiscono le pagine del gioco, non si sostituiscono.
7. **Servizi esterni dichiarati:** nessun dato esce dal PC senza consenso esplicito.

8. **Mercante colorato con l'import/export disponibile** (riferito da Nicola il 2026-11-23, **non verificato** nel codice di OGLight): l'etichetta «Mercante» del menu del gioco si colora di azzurro finché l'offerta del giorno è da usare. In Future cambia solo il colore del testo, ciano acceso con un leggero alone (classe su `<body>` e foglio di stile di Future), mai l'elemento del gioco; lo stato viene da `importExportInfo` letto una volta per sessione (come OGame Infinity). AGENTS.md §1.7 protegge il Mercante: segnata come area grigia nel codice.

9. **Flotte in volo per pianeta e attacchi evidenziati** (chiesto da Nicola il 2026-11-26, **non verificato** nel codice di OGLight se OGLight legga l'elenco eventi con una propria richiesta): Future legge la tabella eventi del gioco (`page=componentOnly&component=eventList&ajax=1`) **una volta al caricamento della pagina** (guard 'page-load', non prima di 10 s dalla lettura precedente, mai a timer), come già fa per le code di produzione (AGENTS.md §4); se la tabella è già aperta nella pagina la legge dal DOM senza chiamate. Il menu pianeti colora il corpo attaccato/spiato: nessuna notifica, nessun suono (§1.4). `src/data/events.ts`.

Da verificare con un ToolDev prima di copiarle: "Repeat x" sulla coda e la pulizia automatica dei report.
