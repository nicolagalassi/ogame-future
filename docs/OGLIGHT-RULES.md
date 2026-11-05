# Regole ricavate da OGLight

OGLight 5.4.3 è tollerato. Queste regole emergono dal suo codice e valgono anche per Future, in aggiunta ad [AGENTS.md](../AGENTS.md).

1. **Fetch solo al caricamento pagina.** Nessun polling. Future va oltre: `accountInfo` una sola volta per sessione (AGENTS.md §4.1).
2. **Sync manuale:** l'aggiornamento forzato parte solo da un click del giocatore.
3. **Un click, un invio.** Anche le code di sonde nascono da click distinti.
4. **Notifiche solo su richiesta, per singola flotta,** attivate a mano dal giocatore.
5. **Salvataggio a giocatore inattivo** (10 secondi senza input).
6. **Nessuna UI alternativa:** si arricchiscono le pagine del gioco, non si sostituiscono.
7. **Servizi esterni dichiarati:** nessun dato esce dal PC senza consenso esplicito.

Da verificare con un ToolDev prima di copiarle: "Repeat x" sulla coda e la pulizia automatica dei report.
