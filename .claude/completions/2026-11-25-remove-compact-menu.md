# 2026-11-25 — Tolta la versione compatta del menu pianeti

Riprende il commit f2e0128 (17/11, mai pubblicato), riapplicato su main 0.3.142.

- Niente più modalità compatta: MenuMode, `mode` nelle impostazioni, CSS `.fut-mode-compact` (anche le regole aggiunte dopo il 17/11 per la flotta sulla luna), scelta «Vista del menu», 8 chiavi i18n (compresa `planetMenu.noRoom`, già inutilizzata).
- Schermo troppo stretto (secondo Nicola non capita, il gioco si adatta): la lista resta quella del gioco, non decorata; barra e totali restano sopra nella larghezza del gioco. Rete di sicurezza per AGENTS.md §1.7, con test (nessuna riga, cifra, colonna del piano o flotta).
- `onOpenSettings` passa solo `colonies` (`roomy` non serviva più).
- Il valore salvato `planetMenu.mode` resta nello storage ma non è più letto.
- Dimensione: circa 4 KB in meno. Il tetto di 1.050.000 byte resta stretto (vedi la nota nel messaggio a Nicola).
- Versione 0.3.143.
