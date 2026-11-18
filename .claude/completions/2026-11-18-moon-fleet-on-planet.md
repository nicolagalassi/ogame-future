# 2026-11-18 — Flotta della luna sul velo del pianeta

- Sulla luna la manina copriva il valore della flotta. Ora, passando sulla luna, il suo velo (`.fut-peek-moon`, sempre dentro
  `a.moonlink`) si disegna a sinistra sopra il pianeta (`right: calc(100% + 1px)`, larghezza del pianeta impostata su
  mouseenter/focus), col simbolo luna. Vale anche nella vista compatta. Misurato: bordi del velo = bordi del pianeta.
- Prima versione (velo della luna dentro il link del pianeta) bloccata da floor-guard: cambiava due asserzioni esistenti.
  Il layout attuale le lascia valide; la regola blocca qualsiasi modifica di comportamento che invalidi un'asserzione.
- Lo storico giornaliero resta com'è (deciso da Nicola: serve il valore presente in quel momento). Versione 0.3.127.
