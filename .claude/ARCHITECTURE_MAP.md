# Architecture Map

| Path | What |
|---|---|
| `src/main.ts` | bootstrap per game page: hydrate once, close the network window, mount modules |
| `src/core/` | `guard.ts` (only network door), `storage.ts` (GM storage per server), `i18n.ts`, `icons.ts` (SVG icons + `BASE_SHEET`), `format.ts` |
| `src/data/` | readers: accountInfo snapshot, planet list, queues, bonuses, tech pages, messages, fleet page, tech table and names |
| `src/engines/` | pure maths: resources, account summary, mine ROI, tech costs, planner, fleet, expedition journal |
| `src/modules/planet-menu` | side-by-side planet menu and the top toolbar (Dashboard / Piano / Diario) |
| `src/modules/dashboard` | Dashboard window (tabs: summary, mines, facilities, lifeforms, ships, defence, scrap) |
| `src/modules/tech` | cost panel on tech pages, planner window |
| `src/modules/fleet` | fleet page buttons, reserves, fleetsave, jump gate, repeat |
| `src/modules/messages` | inbox summaries, expedition journal window |
| `src/modules/shortcuts` | keyboard shortcuts |
| `src/i18n/` | it / en / fr / de strings |
| `tests/` | vitest specs and fixtures |
| `docs/` | `HANDOFF.md`, `API-NOTES.md`, `OGLIGHT-RULES.md` |

Windows live in Shadow DOM; menu and inbox styles are global and prefixed `fut-`.

**Last Updated**: 2026-11-05
