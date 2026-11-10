# 2026-11-10 — Posta ridisegnata, tabella spiate, finestra Impostazioni

- Riepiloghi: una riga a 4 colonne per ogni rapporto (pillola · contenuto · MSU · azioni), Verdana con cifre fisse.
  Grandezza spedizione come rarità: normale verde, grande blu, enorme viola (`RARITY` in messages/style.ts).
- "Oggi" + "Appena lette" (10 s, si ferma al passaggio del mouse) in testa alla scheda Spedizioni (`exp-recap.ts`).
- Diario: sezione "Risorse trovate" grande, navi compatte.
- Tabella spiate: Bottino (risorse, non MSU), Flotta, Difesa; tolto MSU/ora. Nome = rapporto completo nella finestra
  del gioco (`<a class="overlay">` con URL ASSOLUTO `page=ajax&component=messagedetails`: con URL relativo il gioco
  non apre niente). Attacca (con `am<nave>=n`), Simula (un solo strumento), ✕.
- Spiate condivise: Comunicazione › "Rapporti di spionaggio condiv." = sottoscheda 11; `SpyEntry.shared`, badge "ally",
  opzione per toglierle.
- Simulatore: Osims o OGame Simulator (`sim.tool`), link e prefill come OGLight (bonus Generale + forme di vita,
  Guerrieri +1, booster classe, bonus navi da speciesBonuses). I bonus navi si riempiono al prossimo Sync.
- Impostazioni: finestra (ingranaggio) con sezioni Menu pianeti / Posta e spiate / Dati; tolto il pannellino a tendina.
- Audit impeccable fatto prima di queste modifiche (12/20); P1 ancora aperti: riga ripiegata da tastiera, iniziali risorse.
