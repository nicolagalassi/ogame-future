import { WINDOW_TOKENS } from '../../core/sheet';
/** Galaxy view: summary strip, row marks, debris values, target list and the scores card (prefixed classes). */
export const GALAXY_CSS = `
/* Window tokens (core/sheet.ts) for every surface this sheet styles. */
.fut-g-name, #galaxycomponent, .fut-g-bar, #galaxyContent, .fut-g-muted, .fut-g-inact, .fut-g-vac, .fut-g-deb, .fut-g-rank, #expeditionDebrisSlotDebrisContainer, .fut-g-dval, .fut-g-card { ${WINDOW_TOKENS} }
.fut-g-name { cursor: pointer; }
.fut-g-name:hover { text-decoration: underline; text-decoration-color: var(--accent); text-underline-offset: 2px; }
/* The game's own header, drawn as the first row of one card with Future's summary under it:
   same surface, dark fields, flat buttons. Nothing is moved or hidden, only its look changes. */
#galaxycomponent #galaxyHeader {
  box-sizing: border-box; display: flex !important; align-items: center; height: 36px !important; margin: 0 !important; padding: 0 8px !important;
  border: 1px solid var(--line) !important; border-radius: 7px 7px 0 0 !important; background: var(--raised) !important;
}
#galaxycomponent #galaxyHeader form { display: flex; align-items: center; gap: 3px; width: 100%; margin: 0; }
#galaxycomponent #galaxyHeader .galaxy_icons { flex: none; float: none !important; margin: 0 !important; }
#galaxycomponent #galaxyHeader .galaxy_icons.solarsystem { margin-left: 6px !important; }
#galaxycomponent #galaxyHeader input {
  box-sizing: border-box; float: none !important; width: 46px !important; height: 24px !important; margin: 0 !important; padding: 0 4px !important;
  border: 1px solid var(--line) !important; border-radius: 5px !important; background: var(--bg) !important; color: var(--text) !important;
  font: 700 13px/22px Consolas, "JetBrains Mono", monospace !important; text-align: center; box-shadow: none !important;
}
#galaxycomponent #galaxyHeader input:focus { outline: none; border-color: var(--accent) !important; }
#galaxycomponent #galaxyHeader .btn_blue {
  box-sizing: border-box; float: none !important; display: inline-flex !important; align-items: center; gap: 5px; height: 24px !important; margin: 0 !important; padding: 0 10px !important;
  border: 1px solid var(--accent-line) !important; border-radius: 5px !important; background: var(--accent-soft) !important; box-shadow: none !important; text-shadow: none !important;
  color: var(--text) !important; font: 700 11px/22px Verdana, Arial, sans-serif !important; white-space: nowrap; cursor: pointer;
}
#galaxycomponent #galaxyHeader .btn_blue:hover { border-color: var(--accent) !important; background: #16344A !important; }
#galaxycomponent #galaxyHeader .btn_blue[disabled] { border-color: var(--line) !important; background: var(--bg) !important; color: var(--muted) !important; font-weight: 400 !important; cursor: default; }
#galaxycomponent #galaxyHeader .btn_blue img { height: 14px; width: auto; margin: 0 !important; }
#galaxycomponent #galaxyHeader form > .btn_blue { flex: none; }
#galaxycomponent #galaxyHeader .systembuttons { float: none !important; display: flex; align-items: center; gap: 3px; min-width: 0; margin: 0 0 0 auto !important; position: static !important; }
#galaxycomponent #galaxyHeader .systembuttons .btn_blue { min-width: 0; padding: 0 6px !important; font-weight: 400 !important; overflow: hidden; }
.fut-g-bar {
  box-sizing: border-box; display: flex; flex-wrap: wrap; align-items: center; gap: 2px 14px; min-height: 28px; margin: 0 0 6px; padding: 4px 10px;
  border: 1px solid var(--line); border-top: 0; border-radius: 0 0 7px 7px; background: var(--bg);
  font: 11px/16px Verdana, Arial, sans-serif; color: var(--text-2); text-align: left;
}
/* The game's rows under the table (fleets in the system, colonised planets, legend): the same quiet strip. */
#galaxyContent .galaxyRow.ctGalaxyFleetInfo, #galaxyContent .galaxyRow.ctGalaxyFooter {
  box-sizing: border-box; background: var(--bg) !important; border: 1px solid var(--line) !important; color: var(--label) !important;
}
#galaxyContent .galaxyRow.ctGalaxyFleetInfo { border-bottom: 0 !important; border-radius: 7px 7px 0 0; margin-top: 6px; }
#galaxyContent .galaxyRow.ctGalaxyFooter { border-radius: 0 0 7px 7px; }
#galaxyContent .galaxyRow.ctGalaxyFooter #colonized { color: var(--label) !important; }
.fut-g-bar b { color: var(--text); font-family: Consolas, "JetBrains Mono", monospace; }
.fut-g-muted { color: var(--muted); }
.fut-g-inact { color: #9BE36D; }
.fut-g-vac { color: var(--c); }
.fut-g-deb { color: var(--warn); }
/* Dark table, as OGLight: flat dark cells on an almost black table, empty positions darker still.
   Row marks are inset shadows, so they sit over the cell's own background. */
#galaxycomponent .galaxyTable, #galaxyContent .expeditionDebrisSlotBox { background: var(--bg) !important; }
#galaxyContent .ctContentRow .galaxyCell { background: linear-gradient(192deg, var(--line-soft), var(--bg) 70%) !important; border-radius: 2px !important; }
#galaxyContent .ctContentRow[class*="filtered_filter_empty"] .galaxyCell { background: var(--bg) !important; }
#galaxyContent .ctContentRow .cellPlanetName { justify-content: flex-start !important; padding: 0 5px; box-sizing: border-box; }
#galaxyContent .galaxyRow.fut-g-inactive .galaxyCell { box-shadow: inset 0 0 0 100px rgba(155,227,109,0.06); }
#galaxyContent .galaxyRow.fut-g-own .galaxyCell { box-shadow: inset 0 0 0 100px rgba(79,209,232,0.07); }

/* The position the side bar (or the link) asked for: the planet menu's cyan frame. */
/* On the cells, not the row: a frame on the row showed between the cells as odd blue brackets. */
#galaxyContent .galaxyRow.fut-g-hl .galaxyCell { box-shadow: inset 0 0 0 100px rgba(79,209,232,0.10); }
#galaxyContent .galaxyRow.fut-g-hl .cellPosition { box-shadow: inset 3px 0 0 var(--accent), inset 0 0 0 100px rgba(79,209,232,0.18); color: var(--accent-hi); }

#galaxyContent .cellPlanetName { position: relative; }
/* Planet colour: at the right of the name, faint until the row is pointed at or the planet has one. */
.fut-g-rank:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }

/* Player column, as OGLight lays it out: status first, the name with all the room left, rank and
   flag on the right. The planet name gives up some width to the player name. */
#galaxyContent .galaxyRow .cellPlanetName { flex: 0.72 1 0% !important; }
#galaxyContent .galaxyRow .cellPlayerName { flex: 1.28 1 0% !important; }
#galaxyContent .galaxyRow.ctContentRow .cellPlayerName { justify-content: flex-start !important; gap: 3px; padding: 0 3px 0 5px; box-sizing: border-box; }
#galaxyContent .cellPlayerName > pre { order: -1; flex: none; margin: 0; }
#galaxyContent .cellPlayerName > .playerName { flex: 0 1 auto; min-width: 0; }
.fut-g-rank {
  margin-left: auto; flex: none; padding: 0 2px; border: 0; border-radius: 3px; background: none;
  color: var(--muted); font: 10px/14px Consolas, "JetBrains Mono", monospace; text-decoration: none; cursor: pointer;
}
.fut-g-rank:hover { background: var(--line); color: var(--text); }
/* The flag stays out of the way until the row is pointed at, or the player has one. */
#galaxyContent .cellPlayerName .fut-mk-flag { flex: none; width: 16px; height: 16px; margin: 0; border-color: transparent; background: none; opacity: 0; transition: opacity 120ms ease-out; }
#galaxyContent .galaxyRow:hover .fut-mk-flag, #galaxyContent .fut-mk-flag:focus-visible { opacity: 1; }
#galaxyContent .cellPlayerName .fut-mk-flag.on { opacity: 1; border-color: transparent; }
/* Debris: the number in place of the icon. The game's icon keeps its place and its tooltip (the
   way to send recyclers), only its picture is not drawn. */
#galaxyContent .cellDebris { position: relative; }
#galaxyContent .cellDebris .microdebris, #expeditionDebrisSlotDebrisContainer .microdebris { background-image: none !important; }
#galaxyContent .cellDebris > a, #galaxyContent .cellDebris .microdebris { position: absolute !important; inset: 0; width: auto !important; height: auto !important; margin: 0 !important; }
.fut-g-dval { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
  color: var(--text-2); font: 11px/12px Consolas, "JetBrains Mono", monospace; white-space: nowrap; pointer-events: none; }
.fut-g-dval.big { color: var(--warn); font-weight: 700; text-shadow: 0 0 6px rgba(245, 181, 71, 0.45); }
.fut-g-dval.deep { position: static; display: inline-flex; margin-left: 6px; font-size: 12px; }

.fut-g-card {
  position: fixed; z-index: 1000002; width: 250px; padding: 10px 12px; border: 1px solid var(--line-strong); border-radius: 8px;
  background: var(--bg); box-shadow: 0 10px 30px rgba(0,0,0,0.6); font: 12px/16px Arial, Helvetica, sans-serif; color: var(--text-2);
  text-align: left; pointer-events: none;
}
.fut-g-card h4 { margin: 0 0 6px; font-size: 12px; font-weight: 700; color: var(--text); }
.fut-g-card table { width: 100%; border-collapse: collapse; }
.fut-g-card td { padding: 2px 0; border-bottom: 1px solid var(--line-soft); font-variant-numeric: tabular-nums; white-space: nowrap; }
.fut-g-card td + td { text-align: right; font-family: Consolas, "JetBrains Mono", monospace; }
.fut-g-card td.r { color: var(--accent); padding-left: 10px; }
.fut-g-card p { margin: 6px 0 0; color: var(--muted); font-size: 11px; }
.fut-g-card .err { color: var(--bad); }
`;
