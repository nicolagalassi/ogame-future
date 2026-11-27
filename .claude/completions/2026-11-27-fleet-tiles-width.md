# Tasti missione della flotta tutti larghi uguali (0.3.167)

- Richiesta di Nicola: i tasti Trasporto/Schiera/Spedizione/Fleetsave/Ultima/Su luna/Accentra avevano larghezze diverse (62–68 px, 75 in tedesco) perché ognuno si allargava sulla propria parola.
- `src/modules/fleet/style.ts`: `.fut-fact` da `min-width: 62px` a `width: 68px` (padding laterale 4px): la parola più lunga nelle quattro lingue (Stationieren, 59 px) ci sta; `.name` con ellissi come rete di sicurezza. Su touch tolta la larghezza a 48 px (le parole uscivano dal tasto), altezza 52.
- Verificato sul gioco vero (desktop, Roshar con luna): 7 tasti da 68×48, nessuna parola tagliata, Impostazioni resta sulla stessa riga. A 72 px la Destinazione andava a capo.
- Non verificato sul telefono: l'emulatore era spento.
