/** Cost panel (inside the game's details panel, prefixed classes) and planner window (Shadow DOM). */
export const TECH_CSS = `
/* The game's own cost list and detail lines give way to the panel (their data is in it). */
#technologydetails.fut-tp-on .content .costs,
#technologydetails.fut-tp-on .content .information > ul { display: none !important; }
/* The game's dark matter button ("Inizia con MO") is much bigger than the normal one. */
#technologydetails.fut-tp-on .build-it_wrap .build-it_premium { transform: scale(0.72); transform-origin: right bottom; }
#technologydetails.fut-tp-on .content .information .level { color: #4FD1E8; font-weight: 700; }
/* Units: shipyard choice on one line under the title, amount field over the build button. */
#technologydetails.fut-tp-unit .content .shipyardSelection { position: absolute; top: 28px; left: 6px; right: 158px; height: 16px;
  display: flex; align-items: center; gap: 4px; margin: 0; padding: 0; font-size: 10px; line-height: 16px; white-space: nowrap; overflow: hidden; }
#technologydetails.fut-tp-unit .content .shipyardSelection input { margin: 0 2px 0 6px; width: 11px; height: 11px; }
#technologydetails.fut-tp-unit .content .shipyardSelection label { float: none; margin: 0; padding: 0; width: auto; }
#technologydetails.fut-tp-unit .content .build_amount { position: absolute; top: 104px; right: 6px; width: 146px; height: 28px; margin: 0; padding: 0;
  display: flex; align-items: center; gap: 4px; }
#technologydetails.fut-tp-unit .content .build_amount label { display: none; }
#technologydetails.fut-tp-unit .content .build_amount input, #technologydetails.fut-tp-unit #build_amount { position: static; float: none; flex: 1; min-width: 0; width: auto; height: 26px; margin: 0; padding: 0 4px; box-sizing: border-box; font-size: 13px; }
#technologydetails.fut-tp-unit .content .build_amount .maximum { position: static; float: none; flex: none; width: auto; height: 26px; margin: 0; padding: 0 6px;
  background: #16202E none !important; border: 1px solid #2A3B55; border-radius: 5px; color: #C9D4E2; font-size: 11px; cursor: pointer; }
#technologydetails.fut-tp-unit .content .build_amount .maximum::before, #technologydetails.fut-tp-unit .content .build_amount .maximum::after { display: none !important; }
#technologydetails.fut-tp-unit .content .build_amount .maximum:hover { border-color: #4FD1E8; color: #fff; }
#technologydetails.fut-tp-unit .fut-tp { right: 158px; }
#technologydetails.fut-tp-unit:has(.shipyardSelection) .fut-tp { top: 48px; }
.fut-tp { position: absolute; top: 24px; left: 6px; right: 138px; bottom: 6px; display: flex; flex-direction: column; gap: 5px;
  font: 11px/14px Arial, Helvetica, sans-serif; color: #E6EDF5; text-align: left; }
.fut-tp-grid { display: grid; gap: 2px; align-content: start; }
.fut-tp-h:first-child { background: none; }
.fut-tp-h { padding: 2px 6px; border-radius: 4px; background: #16202E; color: #8A9BB0; font-size: 10px; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.fut-tp-k { padding: 2px 6px 2px 0; color: #8A9BB0; white-space: nowrap; }
.fut-tp-k.fut-m { color: #B8C2CC; } .fut-tp-k.fut-c { color: #7FB8FF; } .fut-tp-k.fut-d { color: #4FE0B0; } .fut-tp-k.fut-e { color: #F5D547; }
.fut-tp-v { padding: 2px 6px; border-radius: 4px; background: rgba(17,27,42,0.85); text-align: right;
  font-family: "JetBrains Mono", Consolas, monospace; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.fut-tp-sum { color: #4FD1E8; }
.fut-tp-short { color: #FF7A7A; }
.fut-tp-ok { color: #4FE0B0; text-align: center; display: flex; align-items: center; justify-content: center; }
.fut-tp-msu { color: #C9D4E2; font-size: 10px; }
.fut-tp-chips { display: flex; flex-wrap: wrap; gap: 4px; margin-top: auto; }
.fut-tp-chip { display: inline-flex; align-items: center; gap: 4px; padding: 2px 7px; border: 1px solid #1F2C40; border-radius: 10px;
  background: #0E1724; color: #C9D4E2; white-space: nowrap; max-width: 100%; overflow: hidden; text-overflow: ellipsis; }
.fut-tp-chip svg { flex: none; color: #8A9BB0; }
.fut-tp-energy svg { color: #F5D547; } .fut-tp-start svg { color: #4FD1E8; }
.fut-tp-disc { color: #8A9BB0; }
/* Tools over the picture, like OGLight. */
.fut-tp-tools { position: absolute; top: 4px; left: 4px; right: 4px; display: flex; gap: 4px; z-index: 2; }
#technologydetails .fut-tp-btn { flex: 1; height: 24px; display: flex; align-items: center; justify-content: center; padding: 0;
  border: 1px solid #2A3B55; border-radius: 5px; background: rgba(10,17,28,0.88); color: #C9D4E2; cursor: pointer; }
#technologydetails .fut-tp-btn:hover:not(:disabled) { border-color: #4FD1E8; color: #fff; }
#technologydetails .fut-tp-btn:disabled { opacity: 0.4; cursor: default; }
#technologydetails .fut-tp-plan.on { border-color: #2E7D5B; background: rgba(16,41,31,0.92); color: #4FE0B0; }
.fut-tp-amount { flex: 3; min-width: 0; height: 24px; box-sizing: border-box; padding: 0 6px; border: 1px solid #2A3B55; border-radius: 5px;
  background: rgba(10,17,28,0.92); color: #E6EDF5; font: 12px "JetBrains Mono", Consolas, monospace; text-align: right; }
.fut-tp-amount:focus { outline: none; border-color: #4FD1E8; }
`;

export const PLANNER_CSS = `
:host { --panel-w: 820px; }
.head .act { flex: none; }
.kpis { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.kpi-line { display: flex; gap: 12px; font: 700 14px/18px var(--mono); }
.kpi.warn .label { color: var(--warn); }
.kpi.ok .label { color: var(--ok); }
.okv { color: var(--ok); }
.groups { display: flex; flex-direction: column; gap: 3px; }
/* One tile per technology, the planet menu's rows. */
.group { border: 1px solid var(--line); border-radius: 7px; background: var(--raised); overflow: hidden; }
.ghead, .grow { display: grid; grid-template-columns: 28px minmax(0, 1fr) 70px 70px 70px 68px; gap: 8px; align-items: center; padding: 4px 6px; }
.grow { grid-template-columns: minmax(0, 1fr) 70px 70px 70px 68px; min-height: 26px; padding: 2px 6px 2px 42px; border-top: 1px solid var(--line-soft); background: var(--surface); }
.ghead.clickable .gname { cursor: pointer; }
.ghead.clickable .gname:hover .gtitle { color: var(--accent); }
.gname { display: flex; flex-direction: column; min-width: 0; }
.gtitle { font-weight: 700; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.gmeta { color: var(--muted); font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.gbody { display: flex; gap: 8px; align-items: baseline; min-width: 0; color: var(--text-2); }
.gbody > span:first-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.lv { color: var(--accent); font-size: 11px; white-space: nowrap; }
.num { text-align: right; font-family: var(--mono); white-space: nowrap; }
.num.short { color: var(--bad) !important; }
.acts { display: flex; justify-content: flex-end; align-items: center; gap: 2px; }
.ib, .x { width: 22px; height: 22px; padding: 0; display: inline-flex; align-items: center; justify-content: center; border: 1px solid transparent; border-radius: 5px; background: none; color: var(--muted); cursor: pointer; font: 11px Arial, sans-serif; }
.ib:hover { border-color: var(--accent); color: var(--text); }
.ib.bring { color: var(--warn); }
.x:hover { border-color: var(--bad); color: var(--bad); }
.sent { display: inline-flex; color: var(--accent); }
.okmark { display: inline-flex; width: 22px; justify-content: center; color: var(--ok); }
/* By planet | by technology. */
.seg { align-self: flex-start; display: inline-flex; border: 1px solid var(--line); border-radius: 7px; overflow: hidden; }
.seg button { height: 26px; padding: 0 12px; border: 0; background: var(--bg); color: var(--muted); font: 12px Arial, sans-serif; cursor: pointer; }
.seg button + button { border-left: 1px solid var(--line); }
.seg button:hover { color: var(--text); }
.seg button[aria-pressed="true"] { background: var(--accent-soft); color: var(--text); font-weight: 700; box-shadow: inset 0 -2px 0 var(--accent); }
/* Planet view: the head carries the one button that brings everything; rows are picked with a click. */
.group.body .ghead { grid-template-columns: 28px minmax(0, 1fr) 70px 70px 70px 170px; }
.group.body .grow { grid-template-columns: minmax(0, 1fr) 70px 70px 70px 170px; padding-left: 6px; }
.gmeta:empty { display: none; }
.bmark { display: inline-flex; justify-content: center; color: var(--accent); }
.bring-all { display: inline-flex; align-items: center; gap: 6px; height: 24px; padding: 0 10px; border: 1px solid var(--warn); border-radius: 6px; background: rgba(245, 181, 71, 0.1); color: var(--warn); font: 700 12px Arial, sans-serif; white-space: nowrap; cursor: pointer; }
.bring-all:hover { background: rgba(245, 181, 71, 0.2); color: var(--text); }
button.gbody { align-items: center; padding: 2px 6px 2px 2px; border: 1px solid transparent; border-radius: 5px; background: none; font: 12px Arial, sans-serif; text-align: left; cursor: pointer; }
button.gbody:hover { border-color: var(--line); color: var(--text); }
.grow.pick.on { background: var(--accent-soft); box-shadow: inset 3px 0 0 var(--accent); }
.grow.pick.on button.gbody { color: var(--text); font-weight: 700; }
@media (max-width: 640px) { .kpis { grid-template-columns: 1fr; } }
`;
