# Lista pianeti: il piano su ogni corpo (0.3.41)

- `planStatus(items, have, pending, now)` in `engines/planner.ts`: ready / arriving / arrived / missing / unknown.
- `main.ts` → `planMarks()` calcola per ogni corpo con piano lo stato (stock stimato o barra risorse se è il corpo aperto,
  spedizioni in `plan.sent`), le voci raggruppate per livelli consecutivi; passato a `renderPlanetMenu`.
- Planet menu: `.fut-corner` in basso a sinistra (sulla luna in alto) con il badge `.fut-plan` (icona lista + numero di voci,
  colore per stato) e i pallini della coda. Tooltip con le voci e quantità mancanti / in viaggio con orario d'arrivo.
- Solo dati locali, nessuna chiamata di rete.

## 0.3.42
- Il segnalino nell'angolo dell'immagine era troppo piccolo: ora c'è una colonnina di 15px all'estremità destra
  della riga, fuori dalla luna (`.fut-plancol`), metà alta = pianeta, metà bassa = luna, colorata per stato.
  Presente solo se qualcosa è in piano; nascosta in vista compatta. `MENU_WIDTH` 228 → 242 per farle posto.

## 0.3.43
- Tooltip nativo sostituito da una scheda al passaggio del mouse in stile gioco (`#fut-plan-tip`): nome del corpo e coordinate,
  voci in piano, stato colorato, quantità con le icone risorse e orario d'arrivo. Clic / Invio sul tasto apre il piano.
- Colonnina 15 → 20px, numero 12px, icona 11px; `MENU_WIDTH` 242 → 247.
