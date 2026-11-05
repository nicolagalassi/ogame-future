# Future — istruzioni per gli agenti

- Leggi [AGENTS.md](AGENTS.md) prima di ogni feature: sono vincoli, non preferenze.
- Regole extra ricavate da OGLight: [docs/OGLIGHT-RULES.md](docs/OGLIGHT-RULES.md). API: [docs/API-NOTES.md](docs/API-NOTES.md).
- Ogni chiamata di rete passa da `src/core/guard.ts`. Mai `fetch` diretto altrove.
- Il codice pubblicato non si minifica (`scripts/build.mjs`).
- Prima di ogni push: `npm run check` (typecheck, test, build).
