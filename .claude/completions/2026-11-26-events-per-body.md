# 2026-11-26 — Attacchi/spionaggi e flotte in volo per pianeta (come OGLight)

- `src/data/events.ts`: legge la tabella eventi del gioco (#eventContent): dalla pagina se aperta, altrimenti
  UNA lettura al caricamento (`page=componentOnly&component=eventList&ajax=1`, guard 'page-load', non prima di
  10 s dalla precedente, come OGLight); `syncEventsOnUserClick` dal pulsante Sincronizza; `watchPageEvents`
  segue la tabella quando il giocatore la apre (DOM, nessuna chiamata). Nessun timer: l'attacco si vede al
  caricamento di una pagina (richiesta di Nicola).
- `eventsByBody`: per corpo (`coords|p`/`coords|m`) attacco (1, 2, 9) e spionaggio (6) nemici col primo arrivo;
  flotte proprie raggruppate (andata+ritorno = una flotta): → in uscita, ← in rientro, ↓ in arrivo (trasporto
  o schieramento verso un altro corpo proprio).
- Menu pianeti: riquadro rosso (attacco) o rosso più tenue (spionaggio) con spada/occhio e orario nel tooltip;
  terza riga sotto il nome con le flotte (icona e colore della missione, freccia, numero; luna dopo ☾),
  condivisa con il valore flotta su touch. Provato nell'emulatore con righe finte nella tabella del gioco.
- Versione 0.3.161.
