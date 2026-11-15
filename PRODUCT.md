# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

OGame players in any universe and language (it, en, fr, de), the same audience as OGLight, OGame Infinity or InfoCompte. They play in a desktop browser with the game open for long sessions, switching planets and pages many times an hour; some also play on a phone (a touch bar exists for that). The job: run and grow an account with dozens of planets and moons without spreadsheets or a second tool.

## Product Purpose

Future is a userscript (Tampermonkey today, a browser extension later) that sits inside the game's own pages and adds what a serious player needs to decide and act. Success: the player decides what to build and where to send fleets faster and with less doubt, and never has to leave the game to do it.

## Positioning

Four things together, which no neighbouring tool offers as one:

- **Planning and ROI**: a development plan, the cheapest investments, amortisation and MSU, so the player knows what to build next.
- **OGLight's comforts, redesigned**: planet menu, fleet bar, inbox summaries, galaxy, targets, made clearer and faster.
- **Journal and analysis**: expedition journal, Project Orion, account history, so the player understands how the account is doing.
- **Strict compliance**: it follows the OGame team's rules (AGENTS.md) by construction: no automation, network only through one guard, data stays in the browser.

## Operating Context

- Runs on the game's pages, next to the game's own UI (planet list, left menu, inbox, fleet dispatch, galaxy, tech pages). What Future draws inside a page must live with OGame's art and layout without clashing; Future's own windows (Dashboard, Plan, Journal, Settings, fleet rules) open over the page in Shadow DOM.
- Other tools may be installed at the same time (OGLight, OGame Tracker, Infinity); Future steps aside where they already decorate.
- Data comes from what the game shows and from accountInfo once per session; no background polling.

## Capabilities and Constraints

- Every network call goes through `src/core/guard.ts`; background calls only at page load (once per session) or from the Sync click; never `cp=` in background.
- One click = one game action: Future prepares forms, the player presses Send.
- No probing outside inbox and galaxy, no notifications for game events, private data stays local (AGENTS.md §1.4, §1.5.1, §1.9). Exception: what OGLight already does is allowed.
- Published code is readable, never minified or obfuscated.
- UI text in four languages (`src/i18n/{it,en,fr,de}.json`).
- Name "Future" is provisional.

## Brand Commitments

- OGLight credit kept where its code or assets are reused: "© 2019 Oz" (MIT).
- Inside game pages: an identity of its own that coexists with OGame's look (confirmed 2026-11-15).

## Evidence on Hand

No users, reviews, download counts or testimonials yet; do not invent any. Real account data exists only in the developer's own game sessions.

## Product Principles

1. Decide faster: every surface answers "what should I do next" with numbers the player can trust.
2. Never act for the player: prepare, explain, then let them click.
3. Live inside the game: no second tool, no context switch, no clash with the game's pages.
4. Dense but legible: many planets and figures at once, readable at a glance.

## Accessibility & Inclusion

Text at least 10px and 4.5:1 contrast; keyboard focus visible; reduced motion respected; works with mouse, keyboard shortcuts and touch.
