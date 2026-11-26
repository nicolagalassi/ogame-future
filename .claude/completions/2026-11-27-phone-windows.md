# 2026-11-27 — Finestre di Future leggibili sul telefono; Pianeti/Lune nelle regole

- `src/core/viewport.ts`: `followViewport(doc, el, 'bottom' | 'cover')` — un solo calcolo del visual viewport
  (prima solo nella barra touch). 'cover' su Impostazioni, Dashboard, Piano, Diario: con la pagina rimpicciolita
  (zoom < 0,95) la finestra copre lo schermo alla grandezza del telefono; a zoom 1 (computer) non cambia nulla.
- WINDOW_SHEET: `text-size-adjust: 100%` (Chrome Android ingrandiva da solo i paragrafi lunghi); finestra a
  bordo pieno, testata fissa in alto, schede che scorrono di lato (flex: none: prima venivano schiacciate a 0),
  chiudi 44px. `.panel` è un container: le regole strette delle finestre ora sono `@container` (la pagina è
  larga 980px anche sul telefono, la finestra ~400).
- «Pianeti e lune»: selettore Pianeti (n) / Lune (n) come la Dashboard (Nicola: viste coerenti); Portale solo
  sulle lune; sul telefono nome sopra e valori affiancati con l'etichetta sopra.
- Verificato nell'emulatore (Impostazioni, Dashboard). Versione 0.3.162.
- Da guardare: icone delle tecnologie in Dashboard vuote sul telefono (quadrati scuri).
