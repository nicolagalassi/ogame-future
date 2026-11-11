# Punto delle migliaia nei campi numerici (2026-11-11, 0.3.31)

- `core/format.ts`: `groupInt` (migliaia sempre raggruppate, anche sotto 10.000: l'italiano di suo lascia "5000"; `useGrouping: 'always'`) e `groupWhileTyping` (raggruppa mentre si scrive, il cursore resta dopo la stessa cifra; "2m"/"500k" restano come scritti e diventano numero all'uscita dal campo). Chi legge i campi usa `parseAmount`, che toglie i separatori.
- Applicato a: riserve navi e risorse, portale e navi del fleetsave nella finestra delle regole (`numberField` con locale; coordinate escluse), campo del portale nel dialogo del salto, risorse del pannello Trasporto/Schiera, quantità di navi/difese nel pannello costi.
- Test in `fleet.test.ts`.

## 0.3.32 — bug: scorciatoie mentre si scrive una nota
- Le scorciatoie ascoltano in cattura sul documento e controllavano `doc.activeElement`: dentro la barra Bersagli (Shadow DOM) l elemento attivo è il contenitore, non la casella della nota, quindi i tasti partivano. `typing()` ora guarda `composedPath()[0]` e scende negli `shadowRoot.activeElement`. Vale per ogni campo in Shadow DOM. Test in `fleet.test.ts`.
