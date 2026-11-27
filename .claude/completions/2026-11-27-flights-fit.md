# Menu pianeti: missioni in volo che non ci stanno (0.3.173)

**Problema (Nicola):** con tante missioni la terza riga sotto nome e coordinate tagliava l'ultimo chip a metà (numero mozzato).

**Fatto:**
- `src/modules/planet-menu/index.ts` `fitFlights`: se la riga trabocca, prima i chip si avvicinano (`fut-fl-tight`), poi gli ultimi lasciano il posto a «+N» (N = flotte escluse, la luna e il suo segno spariscono insieme). Tooltip e tocco elencano sempre tutto.
- Misurato a menu disegnato per intero (la luna e i badge cambiano la larghezza) e di nuovo una volta a font caricato (`doc.fonts.ready`), niente timer.
- `style.ts`: `.fut-fl-tight`, `.fut-fl-more`, `[hidden]` (il `display: inline-flex` dei chip vinceva sull'attributo).
- Test: `tests/planet-menu.test.ts` con larghezze finte (jsdom non ha layout).

**Verifica:** pagina demo locale con il menu vero a 225px: prima Fusilli tagliava il terzo chip, dopo «🧭→11 🚀→ +17». Non provato sul gioco vero (browser di prova da riloggare).
