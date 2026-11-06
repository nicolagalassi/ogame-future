# Quick Start

```bash
npm ci              # install
npm run check       # typecheck + vitest + build (run before every push)
npm test            # tests only (vitest + jsdom, fixtures in tests/)
npm run build       # writes dist/future.user.js (readable, not minified)
```

- Working branch: `feat/messages` (PRs #1–#6 are stacked; this one contains everything).
- Install `dist/future.user.js` in Tampermonkey to try it in game, or use the dev browser below.

## Testing in the real game (dev browser)

```bash
npm run dev            # build --watch + dedicated Chrome (CDP 9223, profile ~/.cache/future-dev-chrome)
                       # log in through the Pioneers lobby by hand, once; open a universe
npm run dev:reload     # reload the game tab once (after an edit: the rebuild applies on the next load)
npm run dev:goto -- 'index.php?page=ingame&component=fleetdispatch'
npm run dev:eval -- "document.querySelector('#planetList').children.length"
npm run dev:shot -- /tmp/future-shot.png   # then Read the PNG to see it
npm run dev:tabs
```

- The script runs without Tampermonkey (GM_* shim, see the top of `scripts/dev-browser.mjs`).
  Its GM storage is in the page's `localStorage` under `__futdev_gm:` keys, separate from Tampermonkey's.
- Script console output, errors with real line numbers of `dist/future.user.js`, and
  `devDump(label, value)` land in `devlog.jsonl` (git-ignored: live session data, never commit it).
- Loop: edit `src/` → `npm run dev:reload` → read `devlog.jsonl` / `dev:shot` / `dev:eval` → repeat.
- COMPLIANCE: reloads only on explicit command, never on a timer or on file save. Game actions
  (sending fleets, building) stay with Nicola: do not click them from the harness.
- State of the work and Nicola's decisions: `docs/HANDOFF.md`.
- UI text: add every key to `src/i18n/{it,en,fr,de}.json`.

**Last Updated**: 2026-11-05
