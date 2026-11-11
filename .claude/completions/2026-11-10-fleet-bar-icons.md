# Fleet bar redesign: icon-only actions, rule switches (2026-11-10)

Not committed, version not bumped (still 0.3.9): bump on push.

## What changed
- `src/modules/fleet/index.ts`: bar in two rows. Row 1: icon-only action tiles (key letter in the
  corner, dashed = still to set up) and two icon tools (this body's rules, Future settings).
  Row 2: rule switches (`role="switch"`, icon + track) and the readout (`readout()`): last outcome
  (`role="status"`) or, on hover/focus, what the control does. `tile()`, `ruleSwitch()` replace the
  old text tile and chip. Page 2 bar: one icon tile + readout.
- `src/modules/fleet/icons.ts`: transport = crate with arrow, deploy = anchor, all = `»` with a
  minus, new `rules` (sliders), `settings` drawn as a cog.
- Rules window: each rule shows its bar icon and a real switch instead of the "Attiva" checkbox.
- `src/core/sheet.ts`: shared `.sw-track` switch (`.track` is taken by the Dashboard bars).
- Settings: rows that follow each other join into one card; group headings carry an icon and
  are no longer in capitals; yes/no rows are switches (`.switch`, labelled by the row name).
- Touch bar: 48px buttons, 24px icons, key letter in the corner and hidden on coarse pointers.
- i18n: `fleet.actionsLabel`, `fleet.editRulesHint` in it/en/fr/de.

## Audit (impeccable) fixed here
- Text under 11px (key letters) raised to 11px; split-button arrow widened to 24px.
- Switch state was announced twice (label + aria-checked); `role="toolbar"` without arrow keys
  became `role="group"`; hard-coded switch colours became tokens.
- Keys section: fleet glyphs misaligned in their rows; "frecce del gioco" on its own line.

## Left open
- On touch there is no hover: an icon explains itself only after the tap (the readout then says
  what was prepared). A long-press hint is the likely fix.
- Destination menu has `aria-haspopup="menu"` on its arrow but no `role="menu"` on the list;
  settings tabs carry both `aria-selected` and `aria-pressed`. Both were there before.

## 2026-11-11: destination menu, planet menu toolbar, totals, dock
- Destination menu of Trasporto / Schiera: two columns (planet | its moon), scrolls with the wheel
  (it closed on its own scroll: now only a scroll of the page behind closes it).
- Planet menu toolbar: two lines, "Produzione +x MSU/g" (Dashboard) and "Piano · n mancano x";
  sync and settings stacked on the right. Journal and targets left the toolbar.
- Totals: a table (In cassa / Al giorno), numbers in one bright colour, MSU row set apart.
- New `src/modules/dock`: panel appended to `#links`, under the game's left menu (fallback
  `#myPlanets`). Journal card (today, 7 days: count and net MSU) and targets card (one chip per
  flag in use, coloured planets); chips open the side bar on that list. The game's menu is not
  moved or covered (§1.7). Drawn from `drawDock` in `main.ts`, together with the planet menu.
- Trap met: `style.ts` of the planet menu has `.fut-totals {` early on (width rule); anchor edits
  on the last occurrence.

## 2026-11-11 (2): dashboard, plan by planet, planet rows, galaxy name click
- Dashboard: the game's pictures as column heads, in lifeform rows, on the research tiles and the
  ROI list (`ctx.pic`, from `tech.icons`; ships from `SHIP_ICONS`). A picture never seen falls
  back to the name: Future learns them when the player opens that page (planet facilities and
  lifeforms need a planet, each species its own planets). Ships / defence: planets and moons on
  separate pages (`unitScope`). Scrap: two-column body picker like the fleet bar's, a click on a
  unit's picture or name = all of it (again = none). Hints moved to heading tooltips.
- Plan: opens "by planet" (`view`), one tile per body with "Porta tutto"; a click on rows picks
  them and the button carries only those (`picked`, cleared on every save). "By technology" kept.
- Planet menu: `showFleet` (pill with the ships' value, `engines/account.fleetValue`), `resView`
  ('res' | 'msu', rows and totals), row height from `--fut-row-h`. Compact: coordinates over the
  skin, no name, resources shown, moon as a 22px square (moon numbers not shown in compact).
- Galaxy: a click on a player's name opens the side bar on that player (`onPlayer`); the game's
  own tooltip on the name is not prevented.
- Not done: the targets side bar was checked (works, opens from the name) but not redrawn.

## 2026-11-11 (3): after 0.3.10, not committed
- Targets side bar redrawn (`marks/side.ts`): lists as one card with hairlines, labelled scores,
  labelled links, a note per flagged player (`PlayerMark.note`, `notePlayer`), home planet marked
  (lowest planet id in the API list), planet names. Width follows the room left of `#middle`
  (300–390px, `fitWidth`, container query under 350px). Never opened on `component=empire`.
- Galaxy debris: the number alone (the game's icon keeps its place and tooltip, picture not
  drawn), lit from `galaxy.bigDebris` up (Settings → Galassia, default 1M); same for deep space
  (`#expeditionDebrisSlotDebrisContainer`: not seen live, no debris there when tested).
- Lifeform buildings: population needed (`.costs .population`) read into `TechDetails.population`
  and shown as a chip, red when the game marks it insufficient. The game gives it for the level on
  its panel only: no formula for later levels.
- Fleet: T/D arrow = one-off destination, default only from the settings; "Tutte − riserva"
  removed; invert button on each ship; jump gate rule editable in the gate dialog.
- Planet menu: wrench replaced by queue dots; "Segna pianeti senza costruzioni" removed.
