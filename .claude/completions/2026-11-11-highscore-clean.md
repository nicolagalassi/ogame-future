# Classifica più pulita, stile OGLight (2026-11-11, 0.3.35)

- `modules/highscore`: niente bordi di cella, una linea sottile tra le righe; i colori di riga del gioco (tua, alleanza) restano ma attenuati da un velo scuro (la tua un po' meno); tutte le righe compatte con immagine piccola (anche le prime tre, titolo sotto il nome in piccolo); punti onore tenuti ma più discreti.
- Bandierina dei Bersagli nella cella del pulsante "i" del gioco (la cella dopo il nome), prima della "i", come il pin di OGLight; senza quella cella resta dopo il nome.
- **Da verificare in gioco**: la cella della "i" è riconosciuta come la cella subito dopo `td.name` (classe ignota): se il gioco ha un'altra cella in mezzo, la bandierina finisce lì.
