/** Galaxy view: summary strip, row marks, debris values, target list and the scores card (prefixed classes). */
export const GALAXY_CSS = `
.fut-g-bar {
  display: flex; flex-wrap: wrap; align-items: center; gap: 4px 14px; margin: 4px 0 6px; padding: 6px 10px;
  border: 1px solid #1F2C40; border-radius: 8px; background: #0D1522;
  font: 12px/16px Arial, Helvetica, sans-serif; color: #C9D4E2; text-align: left;
}
.fut-g-bar b { color: #E6EDF5; font-family: Consolas, "JetBrains Mono", monospace; }
.fut-g-muted { color: #8A9BB0; }
.fut-g-inact { color: #9BE36D; }
.fut-g-vac { color: #7FB8FF; }
.fut-g-deb { color: #F5B547; }
.fut-g-tgtbtn {
  margin-left: auto; height: 24px; padding: 0 10px; display: inline-flex; align-items: center; gap: 6px;
  border: 1px solid #2A3B55; border-radius: 6px; background: #0A111C; color: #C9D4E2; font: 12px Arial, sans-serif; cursor: pointer;
}
.fut-g-tgtbtn:hover, .fut-g-tgtbtn[aria-expanded="true"] { border-color: #4FD1E8; color: #E6EDF5; }

/* Rows: a light tint on the cells, the game's own colours stay. */
#galaxyContent .galaxyRow.fut-g-inactive .galaxyCell { background-color: rgba(155,227,109,0.07); }
#galaxyContent .galaxyRow.fut-g-own .galaxyCell { background-color: rgba(79,209,232,0.08); }
#galaxyContent .galaxyRow.fut-g-tagged .cellPlanetName { box-shadow: inset 3px 0 0 var(--fut-tag); }

#galaxyContent .cellPlanetName { position: relative; }
/* Planet colour: at the right of the name, faint until the row is pointed at or the planet has one. */
#galaxyContent .cellPlanetName .fut-mk-tag { position: absolute; right: 3px; top: 50%; transform: translateY(-50%); margin: 0; opacity: 0; transition: opacity 120ms ease-out; }
#galaxyContent .galaxyRow:hover .fut-mk-tag, #galaxyContent .fut-mk-tag:focus-visible, #galaxyContent .fut-mk-tag.on { opacity: 1; }
#galaxyContent .cellPlayerName .fut-mk-flag { width: 16px; height: 16px; }
.fut-g-rank:focus-visible, .fut-g-tgtbtn:focus-visible { outline: 2px solid #4FD1E8; outline-offset: 1px; }

.fut-g-rank {
  margin-left: 4px; padding: 0 4px; border: 1px solid #2A3B55; border-radius: 4px; background: rgba(10,17,28,0.8);
  color: #C9D4E2; font: 10px/14px Consolas, "JetBrains Mono", monospace; cursor: help; vertical-align: 1px;
}
.fut-g-rank:hover { border-color: #4FD1E8; color: #E6EDF5; }
#galaxyContent .cellDebris { position: relative; }
.fut-g-dval { position: absolute; left: 50%; bottom: 0; transform: translateX(-50%); padding: 0 3px; border-radius: 3px; background: rgba(5,10,18,0.85);
  color: #C9D4E2; font: 10px/12px Consolas, "JetBrains Mono", monospace; white-space: nowrap; pointer-events: none; }
.fut-g-dval.big { color: #F5B547; font-weight: 700; }

.fut-g-card {
  position: fixed; z-index: 100001; width: 250px; padding: 10px 12px; border: 1px solid #2C3E57; border-radius: 8px;
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
