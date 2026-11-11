# Lista pianeti: il piano su ogni corpo (0.3.41)

- `planStatus(items, have, pending, now)` in `engines/planner.ts`: ready / arriving / arrived / missing / unknown.
- `main.ts` → `planMarks()` calcola per ogni corpo con piano lo stato (stock stimato o barra risorse se è il corpo aperto,
  spedizioni in `plan.sent`), le voci raggruppate per livelli consecutivi; passato a `renderPlanetMenu`.
- Planet menu: `.fut-corner` in basso a sinistra (sulla luna in alto) con il badge `.fut-plan` (icona lista + numero di voci,
  colore per stato) e i pallini della coda. Tooltip con le voci e quantità mancanti / in viaggio con orario d'arrivo.
- Solo dati locali, nessuna chiamata di rete.
