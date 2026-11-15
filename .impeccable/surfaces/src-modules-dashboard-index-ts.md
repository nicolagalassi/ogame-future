---
version: 1
slug: "src-modules-dashboard-index-ts"
primary_target: "src/modules/dashboard/index.ts"
related_targets: []
---

# Dashboard (Plancia): surface brief

Scope: Future's Dashboard window, first surface of the redesign; the world then extends to every window and in-page surface. Mode: Operate.
Audience and task: an OGame player reads in seconds what the account produces, what to build next and what needs attention, across dozens of planets.
Constraints: density kept, resource colours kept (metal grey, crystal blue, deuterium green), dark theme kept; no SaaS card grid, no sci-fi costume, never slower to read. System fonts only (no network for fonts). Text at least 10px and 4.5:1.

## Direction contract

THESIS: the account is the player's own board from a strategy board game: income read on numbered tracks, every investment a rung with its cost printed in resource tokens and its payback in days. It refuses the equal-card dashboard grid.
OWN-WORLD: dark printed board #151C26 on ground #0F141B, a board-blue band #1B2A44 for the window's head and printed tab strip, warm print ink #ECE6D6, label grey #A9B2BE, the yellow player pawn #F2D04A for "you are here" and selection, orange #F08A3C for warnings. Zones divided by flat colour fields, never bordered boxes. Resource tokens are discs in the game's resource colours. Condensed display face (Bahnschrift, Roboto Condensed, Arial Narrow) for heads and figures, system sans for prose.
STORY: the player sees where their income stands, which rung to climb next and how long it takes to pay back, then what to fix (full deposits, idle planets), and acts from there.
FIRST VIEWPORT: blue band with title, player and close; printed tabs below it on the band, the active one the board's colour with a pawn-yellow top edge. Three zones: income tracks left (metal, crystal, deuterium on 20-cell tracks, pawn on today's value, outline on the next rung), the investment ladder centre (rung = name, level → level, planet chips, M/C/D tokens, payback days large on the right), "to check" right. Queues at the bottom as bars on one shared hour scale.
FORM: Plancia del giocatore, candidate 6 of my ordered list; seed:82e2ec79b5a6d90d. Raises: colour fields not boxes (zoo map); states as printed marks (centre rail); bar length is exact time (Labanotation); each figure labelled once (Factory catalogue); the row in focus stays full, others step down a tone (streaming wall).
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
