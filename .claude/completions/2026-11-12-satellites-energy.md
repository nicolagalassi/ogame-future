# 2026-11-12 — Satelliti solari necessari sul pannello delle strutture

- Nuovo `src/engines/energy.ts`: consumo delle miniere (10·L·1,1^L, deuterio 20·L·1,1^L, verificato in gioco: 41→42 = 2.589, 45→46 = 4.082), satelliti necessari, energia per satellite.
- `readCurrentEnergy` (bilancio con segno da `#resources_energy`) e `currentMaxTemperature` (tooltip della lista pianeti) in `planet-list.ts`.
- `tech-details.ts`: `energyNeed` (`li.additional_energy_consumption`) ed `energyProduction` (`li.energy_production` del satellite: totale + numero).
- Pannello: aprendo il Satellite Solare Future impara l'energia di un satellite su quel pianeta (totale / numero, 55,09 su Roshar) e la salva in `satEnergy`. Sui pianeti mai aperti la stima è (Tmax+140)/6 × i bonus visti sull'ultimo pianeta imparato, mostrata con "≈".
- Chip giallo "N sat. · energia": sulle miniere quando i livelli scelti superano l'energia rimasta (anche su un intervallo, con ‹ ›); sul Satellite Solare quando il pianeta è in negativo. Nessun chip se l'energia basta.
- Solo lettura del DOM, nessuna richiesta di rete, nessuna azione di gioco.
- 0.3.52: clic sul chip. Sul Satellite Solare scrive il numero nella quantità del gioco; su una miniera è un link a `component=shipyard&openTech=212&futSat=N`, e il pannello del satellite scrive N all'apertura. Solo compilazione: "Costruisci" resta un clic del giocatore. Provato in gioco.
- 0.3.53: dalla miniera il clic apre il satellite nella pagina Risorse (stessa pagina: clic sul riquadro del gioco, senza ricaricare; altrimenti link `component=supplies&openTech=212&futSat=N`), non più nel Cantiere.
- 0.3.54: pannello costi ridisegnato come registro: niente riquadri per cella, righe separate da filetti, totale MSU sotto una riga più marcata, colonna "Mancano" come banda (rossa se manca qualcosa, verde se no). Font uniformati ai token di Future (core/sheet.ts): parole in Arial, numeri in Consolas grassetto 13px tabellari come nel menu pianeti; chip in Arial 12px. Simboli delle risorse (res-icons) davanti ai nomi.
- 0.3.55: Cantiere / Cantiere Mecha come interruttore a due posizioni (radio del gioco nascosti ma attivi, etichette come pulsanti, quella scelta evidenziata); campo quantità per il piano e campo quantità del gioco scuri, numeri in Consolas grassetto come la tabella.
