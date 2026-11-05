# Quick Start

```bash
npm ci              # install
npm run check       # typecheck + vitest + build (run before every push)
npm test            # tests only (vitest + jsdom, fixtures in tests/)
npm run build       # writes dist/future.user.js (readable, not minified)
```

- Working branch: `feat/messages` (PRs #1–#6 are stacked; this one contains everything).
- Install `dist/future.user.js` in Tampermonkey to try it in game.
- State of the work and Nicola's decisions: `docs/HANDOFF.md`.
- UI text: add every key to `src/i18n/{it,en,fr,de}.json`.

**Last Updated**: 2026-11-05
