# Menu pianeti: barra in alto a riquadri, valore flotta nella colonna del nome (2026-11-11, 0.3.17)

- `src/modules/planet-menu`: la barra (Produzione → Dashboard, Piano) passa da due righe impilate a due
  riquadri affiancati: icona e nome sopra, numero sotto (Piano: "−1,2G" in ambra = quanto manca, "mancano"
  nel tooltip). Sync e impostazioni restano impilati a destra. A larghezza del gioco solo icona e numero.
- Flotta: niente più pillola sotto le risorse (rendeva ogni riga alta 52px). Ora è una terza riga sotto
  nome e coordinate: valore del pianeta e, con l'icona luna, quello della luna. Righe sempre a 40px.
  In vista compatta solo il valore del pianeta.
