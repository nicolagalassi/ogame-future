# 2026-11-20 — Link a ostats.eu

- Piè di pagina del gioco (`#siteFooter .content .fright`, dove OGLight mette i suoi): «|ostats.eu» in fondo alla riga,
  verso la pagina dell'universo (`https://ostats.eu/universes/s269-it`), nuova scheda. Modulo `src/modules/footer-links`.
- Barra Bersagli, scheda del giocatore: quarta azione «ostats» → `https://ostats.eu/universes/<uni>/player/<id OGame>`.
- Formato verificato leggendo ostats.eu (link `/universes/s269-it/player/100247`), dopo che Nicola ha aperto l'host.
- La scheda del giocatore non ha test d'insieme (serve la barra con i dati del giocatore): testati gli indirizzi e il piè di pagina.
- Versione 0.3.132.
