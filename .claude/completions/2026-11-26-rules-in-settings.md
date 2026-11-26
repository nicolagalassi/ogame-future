# 2026-11-26 — Regole dei corpi nella finestra Impostazioni

- Nicola: impostazioni sparse. Scelta: un'unica finestra. Nuova scheda «Pianeti e lune» (`bodyRulesPanel`,
  fleet/index.ts): elenco di tutti i corpi con riserva navi, risorse, portale (solo lune) e fleetsave, i vuoti
  «da impostare»; tocco = regole di quel corpo, «← Tutti i corpi» per tornare.
- Tolta la finestra Regole della flotta: «Regole» e il Fleetsave senza destinazione aprono le Impostazioni su
  quella scheda e sul corpo attuale (`onOpenSettings('bodies')`); «Impostazioni» apre la scheda Flotta.
- Salvataggio quando si lascia un campo (come il resto della finestra): niente più «Salva», niente modifiche perse.
- Fuori dalla pagina flotta le navi vengono da `FLEET_PAGE_SHIPS` (ordine letto dal gioco) con i nomi salvati
  (`ships.info`, poi tech names). Segnaposto galassia/sistema = coordinate del corpo modificato.
- `MODAL_CSS` → `RULES_CSS` (senza :host/.status/.body che si scontravano con la finestra Impostazioni).
- Da fare (consegna 2): Chrome Android ingrandisce da solo i paragrafi lunghi (font boosting) → schermo intero
  leggibile sul telefono. Consegna 3: ingranaggio nella barra touch.
- Versione 0.3.159.
