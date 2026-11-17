# 2026-11-17 — Font della plancia incorporato (Barlow Semi Condensed)

- Confronto in gioco: sistema (Fira su Linux), Barlow Semi Condensed, Roboto Condensed, IBM Plex Sans Condensed, Fira. Nicola sceglie Barlow, applicato anche a nomi e coordinate.
- src/core/fonts.ts: 400 e 600 latin in base64 (loader esbuild '.woff2'), @font-face 'Future Barlow' dichiarata sulla pagina (Chrome ignora @font-face nello shadow root; verificato che vale nelle finestre). Nessuna rete.
- --display: 'Future Barlow' davanti alla catena di sistema. Menu pianeti: nome 600 13/13, coordinate e flotta 400 12/12, cifre 600 12: tre righe nei 40px.
- CONSTRAINTS.md: il controllo di leggibilità del dist esclude le righe di soli dati base64. Dist 1.02 MB (tetto 1.05 MB).
- OFL.txt in src/assets/fonts, nota in LICENSE e nell'intestazione dello script. DESIGN.md e sidecar aggiornati. Versione 0.3.121.
