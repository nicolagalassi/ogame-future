/** Galaxy view: summary strip, row marks, debris values, target list and the scores card (prefixed classes). */
export const GALAXY_CSS = `
.fut-g-name { cursor: pointer; }
.fut-g-name:hover { text-decoration: underline; text-decoration-color: #4FD1E8; text-underline-offset: 2px; }
/* The game's own header, drawn as the first row of one card with Future's summary under it:
   same surface, dark fields, flat buttons. Nothing is moved or hidden, only its look changes. */
#galaxycomponent #galaxyHeader {
  box-sizing: border-box; display: flex !important; align-items: center; height: 36px !important; margin: 0 !important; padding: 0 8px !important;
  border: 1px solid #1F2C40 !important; border-radius: 7px 7px 0 0 !important; background: #111B2A !important;
}
#galaxycomponent #galaxyHeader form { display: flex; align-items: center; gap: 3px; width: 100%; margin: 0; }
#galaxycomponent #galaxyHeader .galaxy_icons { flex: none; float: none !important; margin: 0 !important; }
#galaxycomponent #galaxyHeader .galaxy_icons.solarsystem { margin-left: 6px !important; }
#galaxycomponent #galaxyHeader input {
  box-sizing: border-box; float: none !important; width: 46px !important; height: 24px !important; margin: 0 !important; padding: 0 4px !important;
  border: 1px solid #24344B !important; border-radius: 5px !important; background: #0A111C !important; color: #E6EDF5 !important;
  font: 700 13px/22px Consolas, "JetBrains Mono", monospace !important; text-align: center; box-shadow: none !important;
}
#galaxycomponent #galaxyHeader input:focus { outline: none; border-color: #4FD1E8 !important; }
#galaxycomponent #galaxyHeader .btn_blue {
  box-sizing: border-box; float: none !important; display: inline-flex !important; align-items: center; gap: 5px; height: 24px !important; margin: 0 !important; padding: 0 10px !important;
  border: 1px solid #2C5A73 !important; border-radius: 5px !important; background: #12283A !important; box-shadow: none !important; text-shadow: none !important;
  color: #E6EDF5 !important; font: 700 11px/22px Verdana, Arial, sans-serif !important; white-space: nowrap; cursor: pointer;
}
#galaxycomponent #galaxyHeader .btn_blue:hover { border-color: #4FD1E8 !important; background: #16344A !important; }
#galaxycomponent #galaxyHeader .btn_blue[disabled] { border-color: #1F2C40 !important; background: #0B121D !important; color: #8592A1 !important; font-weight: 400 !important; cursor: default; }
#galaxycomponent #galaxyHeader .btn_blue img { height: 14px; width: auto; margin: 0 !important; }
#galaxycomponent #galaxyHeader form > .btn_blue { flex: none; }
#galaxycomponent #galaxyHeader .systembuttons { float: none !important; display: flex; align-items: center; gap: 3px; min-width: 0; margin: 0 0 0 auto !important; position: static !important; }
#galaxycomponent #galaxyHeader .systembuttons .btn_blue { min-width: 0; padding: 0 6px !important; font-weight: 400 !important; overflow: hidden; }
.fut-g-bar {
  box-sizing: border-box; display: flex; flex-wrap: wrap; align-items: center; gap: 2px 14px; min-height: 28px; margin: 0 0 6px; padding: 4px 10px;
  border: 1px solid #1F2C40; border-top: 0; border-radius: 0 0 7px 7px; background: #0B121D;
  font: 11px/16px Verdana, Arial, sans-serif; color: #C9D4E2; text-align: left;
}
/* The game's rows under the table (fleets in the system, colonised planets, legend): the same quiet strip. */
#galaxyContent .galaxyRow.ctGalaxyFleetInfo, #galaxyContent .galaxyRow.ctGalaxyFooter {
  box-sizing: border-box; background: #0B121D !important; border: 1px solid #1F2C40 !important; color: #A3AFBD !important;
}
#galaxyContent .galaxyRow.ctGalaxyFleetInfo { border-bottom: 0 !important; border-radius: 7px 7px 0 0; margin-top: 6px; }
#galaxyContent .galaxyRow.ctGalaxyFooter { border-radius: 0 0 7px 7px; }
#galaxyContent .galaxyRow.ctGalaxyFooter #colonized { color: #A3AFBD !important; }
.fut-g-bar b { color: #E6EDF5; font-family: Consolas, "JetBrains Mono", monospace; }
.fut-g-muted { color: #8A9BB0; }
.fut-g-inact { color: #9BE36D; }
.fut-g-vac { color: #7FB8FF; }
.fut-g-deb { color: #F5B547; }
/* Dark table, as OGLight: flat dark cells on an almost black table, empty positions darker still.
   Row marks are inset shadows, so they sit over the cell's own background. */
#galaxycomponent .galaxyTable, #galaxyContent .expeditionDebrisSlotBox { background: #0C1117 !important; }
#galaxyContent .ctContentRow .galaxyCell { background: linear-gradient(192deg, #1C2430, #131920 70%) !important; border-radius: 2px !important; }
#galaxyContent .ctContentRow[class*="filtered_filter_empty"] .galaxyCell { background: #10151B !important; }
#galaxyContent .ctContentRow .cellPlanetName { justify-content: flex-start !important; padding: 0 5px; box-sizing: border-box; }
#galaxyContent .galaxyRow.fut-g-inactive .galaxyCell { box-shadow: inset 0 0 0 100px rgba(155,227,109,0.06); }
#galaxyContent .galaxyRow.fut-g-own .galaxyCell { box-shadow: inset 0 0 0 100px rgba(79,209,232,0.07); }
#galaxyContent .galaxyRow.fut-g-tagged .galaxyCell { box-shadow: inset 0 0 40px color-mix(in srgb, var(--fut-tag) 22%, transparent); }
#galaxyContent .galaxyRow.fut-g-tagged .cellPlanetName { box-shadow: inset 3px 0 0 var(--fut-tag), inset 0 0 40px color-mix(in srgb, var(--fut-tag) 22%, transparent); }

/* The position the side bar (or the link) asked for: the planet menu's cyan frame. */
/* On the cells, not the row: a frame on the row showed between the cells as odd blue brackets. */
#galaxyContent .galaxyRow.fut-g-hl .galaxyCell { box-shadow: inset 0 0 0 100px rgba(79,209,232,0.10); }
#galaxyContent .galaxyRow.fut-g-hl .cellPosition { box-shadow: inset 3px 0 0 #4FD1E8, inset 0 0 0 100px rgba(79,209,232,0.18); color: #8BE4F2; }

#galaxyContent .cellPlanetName { position: relative; }
/* Planet colour: at the right of the name, faint until the row is pointed at or the planet has one. */
#galaxyContent .cellPlanetName .fut-mk-tag { position: absolute; right: 3px; top: 50%; transform: translateY(-50%); margin: 0; opacity: 0; transition: opacity 120ms ease-out; }
#galaxyContent .galaxyRow:hover .fut-mk-tag, #galaxyContent .fut-mk-tag:focus-visible, #galaxyContent .fut-mk-tag.on { opacity: 1; }
.fut-g-rank:focus-visible { outline: 2px solid #4FD1E8; outline-offset: 1px; }

/* Player column, as OGLight lays it out: status first, the name with all the room left, rank and
   flag on the right. The planet name gives up some width to the player name. */
#galaxyContent .galaxyRow .cellPlanetName { flex: 0.72 1 0% !important; }
#galaxyContent .galaxyRow .cellPlayerName { flex: 1.28 1 0% !important; }
#galaxyContent .galaxyRow.ctContentRow .cellPlayerName { justify-content: flex-start !important; gap: 3px; padding: 0 3px 0 5px; box-sizing: border-box; }
#galaxyContent .cellPlayerName > pre { order: -1; flex: none; margin: 0; }
#galaxyContent .cellPlayerName > .playerName { flex: 0 1 auto; min-width: 0; }
.fut-g-rank {
  margin-left: auto; flex: none; padding: 0 2px; border: 0; border-radius: 3px; background: none;
  color: #8A9BB0; font: 10px/14px Consolas, "JetBrains Mono", monospace; cursor: help;
}
.fut-g-rank:hover { background: #16243A; color: #E6EDF5; }
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
  color: #C9D4E2; font: 11px/12px Consolas, "JetBrains Mono", monospace; white-space: nowrap; pointer-events: none; }
.fut-g-dval.big { color: #F5B547; font-weight: 700; text-shadow: 0 0 6px rgba(245, 181, 71, 0.45); }
.fut-g-dval.deep { position: static; display: inline-flex; margin-left: 6px; font-size: 12px; }

.fut-g-card {
  position: fixed; z-index: 1000002; width: 250px; padding: 10px 12px; border: 1px solid #2C3E57; border-radius: 8px;
  background: #0A111C; box-shadow: 0 10px 30px rgba(0,0,0,0.6); font: 12px/16px Arial, Helvetica, sans-serif; color: #C9D4E2;
  text-align: left; pointer-events: none;
}
.fut-g-card h4 { margin: 0 0 6px; font-size: 12px; font-weight: 700; color: #E6EDF5; }
.fut-g-card table { width: 100%; border-collapse: collapse; }
.fut-g-card td { padding: 2px 0; border-bottom: 1px solid #16202F; font-variant-numeric: tabular-nums; white-space: nowrap; }
.fut-g-card td + td { text-align: right; font-family: Consolas, "JetBrains Mono", monospace; }
.fut-g-card td.r { color: #4FD1E8; padding-left: 10px; }
.fut-g-card p { margin: 6px 0 0; color: #8A9BB0; font-size: 11px; }
.fut-g-card .err { color: #FF7A7A; }
`;
