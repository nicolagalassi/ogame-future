---
name: Future
description: The player's board for OGame, printed in dark ink inside the game's own pages.
colors:
  bg: "#0F141B"
  raised: "#151C26"
  surface: "#1A2230"
  hover: "#212B3A"
  band: "#1B2A44"
  band-2: "#22314D"
  line: "#263142"
  line-soft: "#1D2531"
  line-strong: "#33415A"
  line-hover: "#56657C"
  faint: "#4A5566"
  text: "#ECE6D6"
  text-2: "#D2CCBE"
  label: "#A9B2BE"
  muted: "#9AA3AE"
  quiet: "#8A95A3"
  on-band: "#D3DAE4"
  link: "#8FB4D8"
  accent: "#F2D04A"
  accent-hi: "#F7DF7A"
  on-accent: "#1A1606"
  accent-soft: "#2A2614"
  accent-line: "#8A7420"
  ok: "#7BC47F"
  warn: "#F08A3C"
  bad: "#EF6A60"
  metal: "#B8C2CC"
  crystal: "#7FB8FF"
  deuterium: "#4FE0B0"
  dark-matter: "#B58CDB"
  q-building: "#FF8200"
  q-research: "#32FB2F"
  q-ship: "#FFEB00"
  q-lfbuilding: "#FF79BD"
  q-lfresearch: "#42AFFF"
  fresh: "#38C56E"
  warm: "#E3BB28"
  old: "#EF7676"
typography:
  display:
    fontFamily: "\"Future Barlow\", Bahnschrift, \"DIN Alternate\", \"Roboto Condensed\", \"sans-serif-condensed\", \"Liberation Sans Narrow\", \"Arial Narrow\", \"Open Sans Condensed\", \"Fira Sans Condensed\", \"DejaVu Sans Condensed\", sans-serif"
    fontSize: "19px"
    fontWeight: 600
    lineHeight: 1.2
  figure-lg:
    fontFamily: "\"Future Barlow\", Bahnschrift, \"DIN Alternate\", \"Roboto Condensed\", \"Arial Narrow\", sans-serif"
    fontSize: "22px"
    fontWeight: 600
    lineHeight: 1
    fontFeature: "tnum"
  figure:
    fontFamily: "\"Future Barlow\", Bahnschrift, \"DIN Alternate\", \"Roboto Condensed\", \"Arial Narrow\", sans-serif"
    fontSize: "18px"
    fontWeight: 600
    fontFeature: "tnum"
  headline:
    fontFamily: "\"Future Barlow\", Bahnschrift, \"DIN Alternate\", \"Roboto Condensed\", \"Arial Narrow\", sans-serif"
    fontSize: "15px"
    fontWeight: 600
    lineHeight: 1.2
  title:
    fontFamily: "\"Future Barlow\", Bahnschrift, \"DIN Alternate\", \"Roboto Condensed\", \"Arial Narrow\", sans-serif"
    fontSize: "14px"
    fontWeight: 600
  control:
    fontFamily: "\"Future Barlow\", Bahnschrift, \"DIN Alternate\", \"Roboto Condensed\", \"Arial Narrow\", sans-serif"
    fontSize: "13px"
    fontWeight: 600
  body:
    fontFamily: "\"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.4
  label:
    fontFamily: "\"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, sans-serif"
    fontSize: "12px"
    fontWeight: 400
  small:
    fontFamily: "\"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, sans-serif"
    fontSize: "11px"
    fontWeight: 400
rounded:
  mark: "3px"
  control: "4px"
  tab: "5px"
  panel: "6px"
  pill: "8px"
  disc: "50%"
spacing:
  seam: "2px"
  xs: "4px"
  sm: "8px"
  md: "12px"
  inset: "14px"
  lg: "16px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.on-accent}"
    typography: "{typography.control}"
    rounded: "{rounded.control}"
    padding: "0 12px"
    height: "26px"
  button-primary-hover:
    backgroundColor: "{colors.accent-hi}"
    textColor: "{colors.on-accent}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.text-2}"
    typography: "{typography.control}"
    rounded: "{rounded.control}"
    padding: "0 12px"
    height: "26px"
  button-ghost-hover:
    textColor: "{colors.text}"
  button-disabled:
    backgroundColor: "transparent"
    textColor: "{colors.quiet}"
  window-head:
    backgroundColor: "{colors.band}"
    textColor: "{colors.text}"
    typography: "{typography.display}"
    padding: "8px 10px 8px 18px"
    height: "48px"
  tab:
    backgroundColor: "{colors.band-2}"
    textColor: "{colors.on-band}"
    typography: "{typography.control}"
    rounded: "{rounded.tab}"
    padding: "0 16px"
    height: "34px"
  tab-active:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.text}"
  zone:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-2}"
    padding: "12px 14px"
  investment-rung:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.text}"
    typography: "{typography.title}"
    padding: "8px 10px"
  rung-number:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.on-accent}"
    rounded: "{rounded.disc}"
    size: "22px"
  planet-chip:
    backgroundColor: "transparent"
    textColor: "{colors.text-2}"
    typography: "{typography.label}"
    rounded: "{rounded.mark}"
    padding: "0 7px"
    height: "20px"
  resource-token:
    rounded: "{rounded.disc}"
    size: "11px"
  track-cell-filled:
    backgroundColor: "{colors.faint}"
    height: "18px"
  track-cell-pawn:
    backgroundColor: "{colors.accent}"
    height: "18px"
  track-cell-empty:
    backgroundColor: "{colors.raised}"
    height: "18px"
  check-item:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.text}"
    typography: "{typography.title}"
    padding: "10px 12px"
  queue-tape:
    backgroundColor: "{colors.line-soft}"
    height: "12px"
  key-figure:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    typography: "{typography.figure}"
    padding: "8px 12px 9px"
---

# Design System: Future

## Overview

**Creative North Star: "Plancia del giocatore" (the player's board)**

Future draws an OGame account as the player's own board from a strategy board game. Income is read on numbered tracks, every investment is a rung with its cost printed in resource tokens and its payback in days, and the queues run as tapes on one shared hour scale. The board is a dark printed sheet laid on a darker ground; its head and tab strip sit on a board-blue band; the ink is warm, like print on card, and the one yellow pawn says "you are here" or "this one".

The density is a player's, not a dashboard's: dozens of planets, many figures at once, nothing slower to read than the game itself. Zones are fields of flat colour separated by 2px seams of the board beneath them, never bordered boxes, and states are printed marks (a 3px edge, an outline, a strike-through) rather than glows or fills. The world refuses the equal-card SaaS grid and refuses sci-fi costume (HUD frames, neon glow, scanlines) even though the game around it is a space game: Future's identity coexists with OGame's art by being quieter than it.

Rollout status, recorded honestly (2026-11-17): the world is complete on the Dashboard window and has been carried into the in-page surfaces drawn since: the planet menu's totals and plan column, the production / plan bar, the dock under the game menu (Journal and Targets cards), the targets side bar, the tech pages (cost panel, level stepper, shipyard switch, amount field) and the touch shortcut bar. They use the band for heads, condensed figures in print ink, borderless fields and the state colours. Every other window (Plan, Journal, Settings, fleet rules) inherits the palette and chrome through `WINDOW_TOKENS`, but not the Dashboard's components: income tracks, investment ladder, queue tapes and the score line exist only on the Dashboard. The galaxy, the inbox tables, the plan hover card and the Dashboard's amount field still set figures in a Consolas / JetBrains Mono stack, and the inbox, fleet bar and Orion still speak the game's Verdana world through `PAGE_TOKENS`. Treat those as not yet migrated, not as alternative rules.

**Key Characteristics:**
- Dark printed board on a darker ground; a board-blue band for heads and tab strips.
- Warm print ink for text; one pawn yellow for position, selection, focus and the single primary action.
- Zones as flat colour fields on 2px seams; no bordered boxes, no card shadows.
- Condensed display face for heads and figures, system sans for prose; tabular numerals everywhere a number lines up.
- Bars measure real quantities on shared scales; each figure is printed and labelled once.
- Resource, queue and age colours are the game's own and never re-meant.

## Colors

A low-chroma blue-black board with warm ink, one saturated yellow, and the game's own fixed colour codes for resources, queues and data age.

### Primary
- **Pawn Yellow** (#F2D04A, `accent`): the player's pawn. The active tab's top edge, the pawn cell on an income track, the outline of the next rung, the rung number disc, the filled primary button, the switch when on, every focus ring, the selected state of segmented controls and pickers. It is position and choice, never warning.
- **Pawn Yellow Lit** (#F7DF7A, `accent-hi`): hover on the primary button and on planet links.
- **Pawn Ink** (#1A1606, `on-accent`): text and knobs on pawn yellow (12:1).
- **Pawn Wash** (#2A2614, `accent-soft`) and **Pawn Rule** (#8A7420, `accent-line`): the tinted background of a selected option, and the dashed edge of an estimated level.

### Secondary
- **Board Blue** (#1B2A44, `band`): the window head and the tab strip, the one coloured band on the board.
- **Board Blue Raised** (#22314D, `band-2`): idle tabs printed on the band, and hover on the band's close button.
- **Band Ink** (#D3DAE4, `on-band`): subtitle and idle tab text on the band.

### Tertiary (state)
- **Field Green** (#7BC47F, `ok`): fine, positive figures, "all good". Not the deuterium green.
- **Signal Orange** (#F08A3C, `warn`): look at it. Warning figures, the "act on it" edge of a to-check item, full deposits, tags.
- **Loss Red** (#EF6A60, `bad`): missing or lost; negative figures and the danger button.

### Product-truth colours (fixed, not design choices)
- **Resources**: Metal (#B8C2CC, `metal`, CSS `--m`), Crystal (#7FB8FF, `crystal`, `--c`), Deuterium (#4FE0B0, `deuterium`, `--d`), Dark Matter (#B58CDB, `dark-matter`, `--dm`). Used for resource tokens, resource columns and resource figures in the planet menu, windows and inbox alike.
- **Game queues** (`--q-*`): building (#FF8200), research (#32FB2F), ship (#FFEB00), lifeform building (#FF79BD), lifeform research (#42AFFF). The game's own queue colours, so a queue reads as it does in OGame; used for queue badges and the outline and wash of queue tapes.
- **Age of a reading**: fresh (#38C56E), warm (#E3BB28), old (#EF7676), for galaxy, targets and planet data age.

### Neutral
- **Ground** (#0F141B, `bg`): the darkest layer, under the board; segmented controls and popover menus sit on it.
- **Board** (#151C26, `raised`): the window sheet itself, the active tab, ladder rungs, to-check items, research tiles, empty track cells.
- **Field** (#1A2230, `surface`): zones laid on the board (production, investments, to-check, queues, research), key-figure tiles, inputs.
- **Row Hover** (#212B3A, `hover`): table row under the pointer.
- **Print Ink** (#ECE6D6, `text`): heads, figures, names. Warm, never pure white.
- **Print Ink Second** (#D2CCBE, `text-2`): running text, chip and ghost-button text.
- **Label Grey** (#A9B2BE, `label`): the label printed once beside a figure, table heads.
- **Muted Grey** (#9AA3AE, `muted`) and **Quiet Grey** (#8A95A3, `quiet`): coordinates, hints, scale marks, struck-through done items. Quiet is the floor: 5.6:1 on the board, 4.7:1 on the band.
- **Hairlines**: `line` (#263142) for table head rules and control outlines, `line-soft` (#1D2531) for row rules, tape troughs and image wells, `line-strong` (#33415A) for chips, ghost buttons and empty track cells, `line-hover` (#56657C) for their hover.
- **Spent Cell** (#4A5566, `faint`): filled track cells, the switch's off track, chart crosshair. A fill colour, not a text colour (2.3:1).
- **Link Blue** (#8FB4D8, `link`): links inside running text.

### Named Rules
**The One Pawn Rule.** Pawn yellow marks where the player stands, what is chosen, what has focus, or the one action on a view. If it is a warning, it is orange; if it is decoration, it is nothing.

**The Product Truth Rule.** Resource, queue and age colours belong to the game. Never restyle them, never borrow one to mean something else, and never introduce a new hue that could be mistaken for one.

**The Warm Ink Rule.** Text is printed in the warm ink ramp (`text`, `text-2`) and the grey ramp down to `quiet`; every text colour holds 4.5:1 on the surface it sits on. `faint` never carries text that must be read.

## Typography

**Display Font:** Barlow Semi Condensed, carried inside the script as `Future Barlow` (weights 400 and 600, latin, base64 in `src/core/fonts.ts`, SIL OFL 1.1), then Bahnschrift, DIN Alternate and the installed condensed faces as fallback for glyphs it lacks
**Body Font:** Segoe UI (with Roboto, Helvetica Neue, Arial, sans-serif)
**Label/Mono Font:** none distinct inside windows: `--mono` resolves to the display stack and alignment comes from `font-variant-numeric: tabular-nums`

**Character:** A condensed engineering face for everything printed on the board (heads, figures, tabs, buttons) against a plain system sans for the words around them. No font may come over the network, by product constraint; so the board's face travels inside the script and is declared once on the page (Chrome ignores `@font-face` inside a shadow root, but a document font reaches every window). Every player sees the same figures, whatever the system (before 2026-11-17 it was Bahnschrift on Windows, DIN on Mac, whatever was installed on Linux). Body prose stays on the system sans.

In the planet menu the whole row is in the board's face: the name 600 13px, coordinates and the fleet line 400 12px, the resource figures 600 12px, all tabular, three lines of 13 + 12 + 12px in the 40px row.

### Hierarchy
- **Display** (600 condensed, 19px, 1.2): the window title on the band.
- **Figure Large** (600 condensed, 22px, 1): payback days on an investment rung, the largest number on the board.
- **Figure** (600 condensed, 18-19px): key figures, the score line, income values, the daily total.
- **Headline** (600 condensed, 15px, 1.2): zone heads ("Produzione", "Da controllare").
- **Title** (600 condensed, 14px): rung names, resource names on tracks, to-check headlines, research levels, chart captions.
- **Control** (600 condensed, 12-13px): tabs (13px), buttons and the rung number (12px), table heads (12px).
- **Body** (400, 13px, 1.4): default text of a window.
- **Label** (400, 12px): the unit or label printed after a figure, hints, chips, meta lines.
- **Small** (400, 11px): scale marks under tracks and tapes, tags, queue badges. Chart axes and matrix column names go to 10px, the floor.

### Named Rules
**The Printed Once Rule.** Each figure appears once, in the display face, with its label in body sans at 12px in label grey after or above it. No figure is repeated in a second tile, chart or caption on the same view.

**The Ten Pixel Floor.** No text below 10px, anywhere.

## Layout

The window is a centred sheet (`--panel-w`, 860px by default, 1120px for the Dashboard, never wider than the viewport) over a dimmed page, 40px from the top. The head and tab strip run edge to edge on the band; everything below sits inside a 14px inset with 10px between blocks.

Inside, zones tile on a **2px seam**: the key-figure strip, the three-column board (`0.9fr / 1.4fr / 0.9fr`, the investment ladder widest in the centre), ladder rungs, to-check items, track cells and research tiles are all separated by 2px of the colour underneath. The seam is the board's only divider; whitespace inside zones is 12px vertical, 14px horizontal.

Spacing steps observed: 2 (seam), 4, 8, 12, 14 (inset), 16; wider gaps (22px between score-line figures) only to separate figures on one line.

Responsive: at 1100px the key figures fall to three columns; at 900px to two, and the three board columns stack into one. Tables scroll horizontally inside their zone with the first column sticky. In the phone review capture the game kept a desktop-width layout viewport, so the window rendered as the full three-column board scaled down.

## Elevation & Depth

The board is flat. Depth is tonal: ground (`bg`) under board (`raised`) under field (`surface`), with the band as the one coloured layer. Only things that genuinely float above the page cast a shadow. Inset box-shadows are used, but as printed marks (edges and outlines drawn inside a shape), not as depth.

### Shadow Vocabulary
- **Window lift** (`box-shadow: 0 24px 64px rgba(0,0,0,0.6)`): the window sheet over the dimmed game page (`rgba(4,6,10,0.74)` backdrop).
- **Popover lift** (`box-shadow: 0 10px 30px rgba(0,0,0,0.6)`): the body picker menu.
- **Printed top edge** (`box-shadow: inset 0 3px 0 <colour>`): the active tab (pawn), a to-check item (orange to act on), the needs strip (orange).
- **Printed underline** (`box-shadow: inset 0 -2px 0 var(--accent)`): selected segment, selected matrix column.
- **Printed outline** (`box-shadow: inset 0 0 0 1px <colour>`): empty track cells (`line-strong`), next-rung cell (1.5px pawn), queue tape fill, tags.

### Named Rules
**The Flat Board Rule.** Zones, rungs, tiles and tabs never cast shadows. Only the window and its popovers float.

**The Printed Edge Rule.** A state on a field is printed as an edge (3px top, 2px bottom) or a 1px outline, not as a full border, a glow or a coloured fill.

## Shapes

Small, firm corners on things you press; square corners on things that are printed. Zones, rungs, to-check items, key figures, track cells, tapes and research tiles are square: they are areas of the board, and the 2px seam between them is the shape. Pressable marks carry a slight radius: planet chips and tags 3px, buttons, chips and the close button 4px, tabs 5px on the top corners only (cut from the board), the window sheet 6px. Round forms are reserved for things that are pieces: the rung number (22px disc), the switch (8px pill with a round knob). Resources are the board's pieces themselves, drawn once in `core/res-icons.ts` (`RES_PATHS`, `resToken`): metal a cube, crystal a cut gem, deuterium a drop, each flat in its resource colour with the same three tones lit from the top left (lit face 1, side .72, shade .5). They are used at 11–14px in figures and costs and at 13px+ beside names, everywhere a resource is named: Dashboard, planet menu totals, fleet bar, inbox.

## Components

### Buttons
Printed marks: one filled, the rest outlined.
- **Shape:** gently squared (4px), 26px high, 12px side padding, display face 600 condensed 12px.
- **Primary:** pawn yellow fill and edge, pawn ink text. One per view.
- **Hover / Focus:** primary lightens to pawn yellow lit; focus is a 2px pawn outline at 2px offset; press scales to 0.97 over 140ms (none under reduced motion).
- **Ghost:** transparent with a 1px `line-strong` outline and `text-2` text at weight 500; hover lifts the outline to `line-hover` and text to `text`.
- **Danger:** `bad` outline and text, no fill.
- **Disabled:** struck through in quiet grey on a `line` outline. Disabled is struck, not faded.

### Chips
- **Planet chip:** 20px high, 3px corners, 1px `line-strong` outline, `text-2` 12px; links to the page where the step is built. Hover and focus turn the outline pawn yellow.
- **Estimated:** dashed `accent-line` edge; the reason is in the title.
- **Done:** dashed outline, struck through, quiet grey.
- **Filter chip:** 26px, 4px corners, same outline language, pawn outline on hover.

### Cards / Containers
- **Corner Style:** square.
- **Background:** `surface` field on the `raised` board; items inside a zone (rungs, to-check items, tiles) return to `raised`.
- **Shadow Strategy:** none (see Flat Board Rule).
- **Border:** none; the 2px seam divides.
- **Internal Padding:** 12px 14px for zones, 8px 10px for rungs, 10px 12px for to-check items, 8px 12px 9px for key figures.

### Inputs / Fields
- **Style:** 28px, 1px `line` outline, 6px corners, `surface` fill, 12px body text.
- **Focus:** outline turns pawn yellow.
- **In-page fields** (tech pages, plan bar, side bar): borderless, 26px, 4px corners, the board colour laid over the game's art (`rgba(21,28,38,0.92)`, hover `rgba(33,43,58,0.96)`), figures in display 600 condensed 15px right-aligned; focus is a 1px pawn inset outline. Over the game's pictures a field needs that near-opaque board, not a hairline.
- **Two-way switch** (Spaziale / Mecha shipyard): two board-coloured halves 2px apart, 4px outer corners; the chosen half takes `hover` with a 2px pawn top edge.
- **Switch:** 30 x 16px pill on `faint`, knob in `text-2`; on, the track is pawn yellow and the knob pawn ink, sliding 14px over 120ms.

### Navigation
- **Window head:** band, 48px, title in display 19px, subtitle in band ink 12px, a 30px close button that takes `band-2` on hover.
- **Tabs:** printed on the band, 34px, `band-2` with band ink text, 5px top corners. The tab in use is cut from the board: `raised` background, print ink text, a 3px pawn yellow top edge.

### Income Track (signature)
Twenty square cells on one scale shared by metal, crystal and deuterium, 18px high on a 2px gap. Spent cells are `faint`; the pawn cell (today's income) is pawn yellow; the next rung is a 1.5px pawn outline; empty cells are the board with a 1px `line-strong` outline. Above it, the resource token and name (title) left, the daily figure with its unit and the next-rung gain right; below the three tracks, a 0 / half / top scale in quiet 11px.

### Investment Ladder (signature)
One rung per step on the board colour, 2px apart: a pawn rung-number disc (in the full list), the game's picture (28px, 5px corners), the name with "level → level" in title type, planet chips, the cost as resource tokens with figures, and the payback in days as Figure Large on the right with its unit in label grey. With a fine pointer, hovering the ladder keeps the rung under the pointer full and steps the others down to 0.72 opacity over 140ms. A rung whose every planet is done drops to 0.55.

### To Check
A board-coloured item per finding, its kind printed as a 3px top edge: orange for "act on it". Headline in title type, the named bodies in label grey 12px. The build currently prints the second kind ("worth a look") with the crystal resource blue; that borrows a product-truth colour and is an open defect, not a rule. The informational edge still needs its own token.

### Queue Tapes
One hour scale shared by every running queue (0, a third, two thirds, the span), printed in quiet 11px above the tapes. Each tape is a 12px `line-soft` trough; the fill's length is the time still needed, washed at 30% of the game's queue colour with a 1px outline in the full colour.

### Level Stepper (tech pages)
Over the building's picture: `−`, the jump printed large (display 15px, "from → to" with the target level in pawn yellow), `+`, then the plan button. 26px board-coloured keys 2px apart, like a rung track. The plan button is filled pawn yellow to add (the one primary action) and turns to a pawn outline with a tick once the step is in the plan.

### Dock (under the game menu)
A 150px column of cards on `raised`, 6px corners, 6px apart. Each head sits on the band (28px, title 14px, its one count in band ink on the right). The Journal card prints today's net gain as a Figure (18px) beside its label, the net per resource under it as three resource-letter columns (letter in its resource colour, figure condensed 12px, a loss with the same − sign as the totals), then yesterday at 14px in `text-2` to compare. The Targets card prints one 26px chip per flag in use, in the flag's colour.

### Touch Bar (phones)
Fixed at the bottom on coarse pointers: `raised` with a 2px `line-strong` top edge, 46px flat keys on `surface` with ink icons, 2px apart, scrolling sideways under a 22px faded right edge. The one action (Next / Send) is pawn yellow; when it is not ready it is struck through in quiet grey on an outline, like every disabled button. Pressing changes the key's background; no hover.

### Score Line
The account's figures (points, rank, stock, fleet, defence) on one wrapping line under the tabs, 22px apart: the figure in Figure type, its label once after it in label grey 12px, detail in the title tooltip.

## Do's and Don'ts

### Do:
- **Do** take every colour from the shared tokens (`WINDOW_TOKENS`, `PAGE_TOKENS`, `STATE_COLORS`, `RES_COLORS`); a new role gets a new token, not a literal.
- **Do** divide zones with the 2px seam and tonal steps (`bg` / `raised` / `surface`), and print states as a 3px top edge, 2px underline or 1px outline.
- **Do** keep pawn yellow to position, selection, focus and the single primary action.
- **Do** set heads, figures, tabs and buttons in the condensed display stack at weight 600, prose in the system sans, and numbers with tabular numerals.
- **Do** make every bar's length an exact quantity on a scale shared with its neighbours (20-cell income tracks, one hour scale for queues).
- **Do** print each figure once with its label beside it in label grey.
- **Do** show disabled and done as struck through in quiet grey.
- **Do** honour reduced motion: the window fades instead of rising, press feedback and switch slides are removed.
- **Do** put hover behind `@media (hover: hover) and (pointer: fine)` on surfaces a phone can reach, and show pressing with `:active` (background step, or scale 0.97 on small keys), so a tap never leaves a stuck highlight.
- **Do** keep figures on the type ramp (22 / 18 / 15 / 14 / 13 / 12 / 11px); a size off the ramp is a new step that needs a reason here first.

### Don't:
- **Don't** draw bordered boxes or cast shadows on zones, rungs or tiles; only the window and its popovers float.
- **Don't** build an equal-card dashboard grid; the board's columns are weighted by what they carry.
- **Don't** dress the board in sci-fi costume: no HUD frames, neon glows, scanlines or gradients.
- **Don't** load any font over the network. The board's face travels inside the script (base64, OFL); any other face is a system stack. A new embedded face or weight has to fit the size budget in CONSTRAINTS.md.
- **Don't** restyle or borrow the resource, game-queue or age colours for any other meaning.
- **Don't** use pawn yellow for warnings (orange) or decoration.
- **Don't** set text below 10px or below 4.5:1 on its surface; `faint` is a fill, not a text colour.
- **Don't** use pure white or a cool grey for main text; the ink is warm (`text`).
