# 2026-11-17 — CONSTRAINTS.md (constraint-driven-development)

- CONSTRAINTS.md: floor (soppressioni, stub, test più facili, file stesso), conformità AGENTS.md (rete solo dal guard, guard.request solo in src/data, niente cp= nelle richieste, notifiche solo promemoria, niente setInterval nuovi, build non minificata, credito 2019 Oz, versione che sale e @version = package.json), numeri (copertura righe cambiate src/engines ≥ 80%, npm audit niente high+, dist ≤ 1050000 byte) in avviso fino al 2026-12-01.
- scripts/floor-guard.mjs (riferimento della skill, adattato), scripts/constraints.mjs + constraints.json, @vitest/coverage-v8 2.1.9, hook pre-push con `npm run hooks`.
- Prima del 2026-12-01: aggiornare Vitest a 5 (npm audit: 1 alta, 3 critiche nella catena di Vitest 2), altrimenti il pre-push si ferma.
- Versione 0.3.117.
