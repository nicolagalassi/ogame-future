import { RES_COLORS } from '../../core/sheet';

/** Cost panel (inside the game's details panel, prefixed classes) and planner window (Shadow DOM). */
export const TECH_CSS = `
/* The game's own cost list and detail lines give way to the panel (their data is in it). */
#technologydetails.fut-tp-on .content .costs,
#technologydetails.fut-tp-on .content .information > ul { display: none !important; }
/* The game's dark matter button ("Inizia con MO") is much bigger than the normal one. */
#technologydetails.fut-tp-on .build-it_wrap .build-it_premium { transform: scale(0.72); transform-origin: right bottom; }
#technologydetails.fut-tp-on .content .information .level { color: #4FD1E8; font-weight: 700; }
/* Units: shipyard choice on one line under the title, amount field over the build button. */
/* Shipyard choice: a two-way switch (the game's radios stay, hidden but focusable; the labels are the buttons). */
#technologydetails.fut-tp-unit .content .shipyardSelection { position: absolute; top: 26px; left: 6px; right: 158px; width: auto; height: 20px;
  display: flex; align-items: stretch; gap: 0; margin: 0; padding: 0; white-space: nowrap; overflow: hidden; }
#technologydetails.fut-tp-unit .content .shipyardSelection input { position: absolute; opacity: 0; width: 1px; height: 1px; margin: 0; pointer-events: none; }
#technologydetails.fut-tp-unit .content .shipyardSelection label { float: none; display: flex; align-items: center; margin: 0; padding: 0 10px; width: auto;
  border: 1px solid #2A3B55; background: rgba(9,15,24,0.82); color: #8A9BB0; font: 11px/18px Arial, Helvetica, sans-serif; cursor: pointer; }
#technologydetails.fut-tp-unit .content .shipyardSelection label::before, #technologydetails.fut-tp-unit .content .shipyardSelection label::after { display: none !important; }
#technologydetails.fut-tp-unit .content .shipyardSelection label:first-of-type { border-radius: 10px 0 0 10px; }
#technologydetails.fut-tp-unit .content .shipyardSelection label:last-of-type { border-radius: 0 10px 10px 0; }
#technologydetails.fut-tp-unit .content .shipyardSelection label + input + label { border-left: 0; }
#technologydetails.fut-tp-unit .content .shipyardSelection label:hover { color: #E6EDF5; }
#technologydetails.fut-tp-unit .content .shipyardSelection input:checked + label { background: #12283A; color: #E6EDF5; font-weight: 700; box-shadow: inset 0 -2px 0 #4FD1E8; }
#technologydetails.fut-tp-unit .content .shipyardSelection input:focus-visible + label { outline: 1px solid #4FD1E8; outline-offset: -1px; }
#technologydetails.fut-tp-unit .content .build_amount { position: absolute; top: 104px; right: 6px; width: 146px; height: 28px; margin: 0; padding: 0;
  display: flex; align-items: center; gap: 4px; }
#technologydetails.fut-tp-unit .content .build_amount label { display: none; }
#technologydetails.fut-tp-unit .content .build_amount input, #technologydetails.fut-tp-unit #build_amount { position: static; float: none; flex: 1; min-width: 0; width: auto; height: 26px; margin: 0; padding: 0 6px; box-sizing: border-box;
  border: 1px solid #2A3B55; border-radius: 5px; background: rgba(9,15,24,0.92) none; color: #E6EDF5; font: 700 13px Consolas, "JetBrains Mono", "DejaVu Sans Mono", monospace; text-align: right; box-shadow: none; }
#technologydetails.fut-tp-unit #build_amount:focus { outline: none; border-color: #4FD1E8; }
#technologydetails.fut-tp-unit .content .build_amount .maximum { position: static; float: none; flex: none; width: auto; height: 26px; margin: 0; padding: 0 6px;
  background: #16202E none !important; border: 1px solid #2A3B55; border-radius: 5px; color: #C9D4E2; font-size: 11px; cursor: pointer; }
#technologydetails.fut-tp-unit .content .build_amount .maximum::before, #technologydetails.fut-tp-unit .content .build_amount .maximum::after { display: none !important; }
#technologydetails.fut-tp-unit .content .build_amount .maximum:hover { border-color: #4FD1E8; color: #fff; }
#technologydetails.fut-tp-unit .fut-tp { right: 158px; }
#technologydetails.fut-tp-unit:has(.shipyardSelection) .fut-tp { top: 52px; }
.fut-tp, .fut-tp-tools {
  /* Future's window tokens (core/sheet.ts), here outside the Shadow DOM. */
  --line: #1F2C40; --line-soft: #16202F; --text: #E6EDF5; --text-2: #C9D4E2; --muted: #8A9BB0;
  --accent: #4FD1E8; --ok: #4FE0B0; --bad: #FF7A7A; --energy: #F5D547;
  --m: ${RES_COLORS.metal}; --c: ${RES_COLORS.crystal}; --d: ${RES_COLORS.deuterium};
  --mono: Consolas, "JetBrains Mono", "DejaVu Sans Mono", monospace;
}
.fut-tp { position: absolute; top: 24px; left: 6px; right: 138px; bottom: 6px; display: flex; flex-direction: column; gap: 6px;
  font: 11px/14px Arial, Helvetica, sans-serif; color: var(--text); text-align: left; }
/* The ledger: no boxes per cell, hairlines between rows, numbers right-aligned in one mono face. */
.fut-tp-grid { display: grid; align-content: start; border-radius: 6px; background: rgba(9,15,24,0.82); padding: 2px 0; }
.fut-tp-grid > span { min-width: 0; padding: 3px 8px; border-bottom: 1px solid var(--line-soft); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.fut-tp-h { color: var(--muted); font: 11px/14px Arial, Helvetica, sans-serif; text-align: right; }
.fut-tp-h:first-child { text-align: left; }
.fut-tp-k { display: flex; align-items: center; gap: 5px; font: 700 12px/16px Arial, Helvetica, sans-serif; color: var(--text-2); }
.fut-tp-k svg { flex: none; }
.fut-tp-k > span { overflow: hidden; text-overflow: ellipsis; }
.fut-tp-k.fut-m { color: var(--m); } .fut-tp-k.fut-c { color: var(--c); } .fut-tp-k.fut-d { color: var(--d); } .fut-tp-k.fut-e { color: var(--energy); }
.fut-tp-v { font: 700 13px/16px var(--mono); font-variant-numeric: tabular-nums; color: var(--text); text-align: right; }
.fut-tp-sum { color: var(--accent); }
.fut-tp-short { color: var(--bad); }
.fut-tp-ok { color: var(--ok); display: flex; align-items: center; justify-content: flex-end; }
/* The total row closes the ledger: a firmer rule above, no rule below. */
.fut-tp-grid > .fut-tp-total { border-top: 1px solid var(--line); border-bottom: 0; }
.fut-tp-k.fut-tp-msu { color: var(--muted); }
/* What is missing: a column band, red when something lacks, green when nothing does. */
.fut-tp-miss { background: rgba(255,122,122,0.08); }
.fut-tp-miss.fut-tp-none { background: rgba(79,224,176,0.06); }
.fut-tp-h.fut-tp-miss { color: var(--bad); } .fut-tp-h.fut-tp-none { color: var(--ok); }
.fut-tp-chips { display: flex; flex-wrap: wrap; gap: 4px; margin-top: auto; }
.fut-tp-chip { display: inline-flex; align-items: center; gap: 5px; height: 20px; box-sizing: border-box; padding: 0 8px; border: 1px solid var(--line); border-radius: 10px;
  background: rgba(9,15,24,0.82); color: var(--text-2); font: 12px/18px Arial, Helvetica, sans-serif; font-variant-numeric: tabular-nums; white-space: nowrap; max-width: 100%; overflow: hidden; text-overflow: ellipsis; }
.fut-tp-chip svg { flex: none; color: var(--muted); }
.fut-tp-energy svg { color: var(--energy); } .fut-tp-start svg { color: var(--accent); }
.fut-tp-disc { color: var(--muted); }
.fut-tp-pop svg { color: #E58CDB; }
.fut-tp-lack { border-color: var(--bad); color: var(--bad); } .fut-tp-lack svg { color: var(--bad); }
.fut-tp-sat { border-color: #6B5A1E; color: var(--energy); cursor: pointer; } .fut-tp-sat svg { color: var(--energy); }
.fut-tp-sat:hover { border-color: var(--energy); background: #1E1A0C; }
.fut-tp-sat-link { display: inline-flex; max-width: 100%; text-decoration: none; }
/* Tools over the picture, like OGLight. */
.fut-tp-tools { position: absolute; top: 4px; left: 4px; right: 4px; display: flex; gap: 4px; z-index: 2; }
#technologydetails .fut-tp-btn { flex: 1; height: 24px; display: flex; align-items: center; justify-content: center; padding: 0;
  border: 1px solid #2A3B55; border-radius: 5px; background: rgba(10,17,28,0.88); color: #C9D4E2; cursor: pointer; }
#technologydetails .fut-tp-btn:hover:not(:disabled) { border-color: #4FD1E8; color: #fff; }
#technologydetails .fut-tp-btn:disabled { opacity: 0.4; cursor: default; }
#technologydetails .fut-tp-plan.on { border-color: #2E7D5B; background: rgba(16,41,31,0.92); color: #4FE0B0; }
/* Our amount (for the plan) over the picture: same dark field as the game's one, beating the game's input skin. */
#technologydetails .fut-tp-tools .fut-tp-amount { flex: 3; min-width: 0; height: 24px; box-sizing: border-box; margin: 0; padding: 0 6px; border: 1px solid #2A3B55; border-radius: 5px;
  background: rgba(9,15,24,0.92) none; color: var(--text); font: 700 13px var(--mono); text-align: right; box-shadow: none; }
#technologydetails .fut-tp-tools .fut-tp-amount:focus { outline: none; border-color: #4FD1E8; }
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
/* Planet view: one line per planet. Who, what is planned (a picture and a level each, picked with a
   click), what it costs, the one button that brings it. Tiles sit flush, as rows of one list. */
.groups:has(.group.body) { gap: 0; border: 1px solid var(--line); border-radius: 7px; overflow: hidden; }
.group.body { border: 0; border-radius: 0; }
.group.body + .group.body { border-top: 1px solid var(--line-soft); }
.group.body .ghead, .group.body .grow { grid-template-columns: minmax(130px, 1fr) minmax(0, 1.1fr) 62px 62px 62px 158px; min-height: 32px; padding: 2px 6px 2px 10px; }
.group.body .ghead:hover { background: #16243A; }
.group.body .gtitle { display: flex; align-items: center; gap: 5px; font-weight: 700; }
.group.body .gtitle svg { flex: none; color: var(--muted); }
.pchips { display: flex; flex-wrap: wrap; align-items: center; gap: 3px; min-width: 0; }
.pchip { display: inline-flex; align-items: center; gap: 5px; height: 24px; padding: 0 7px 0 2px; border: 1px solid var(--line); border-radius: 5px; background: var(--surface); color: var(--text-2); font: 12px var(--mono); cursor: pointer; }
.pchip:hover { border-color: var(--accent); color: var(--text); }
.pchip[aria-pressed="true"] { border-color: var(--accent); background: var(--accent-soft); color: var(--text); font-weight: 700; }
.group.body .grow { background: var(--surface); border-top: 1px solid var(--line-soft); }
.group.body .grow .gbody { grid-column: 1 / span 1; }
.bring-all { display: inline-flex; align-items: center; gap: 6px; height: 24px; padding: 0 9px; border: 1px solid var(--warn); border-radius: 6px; background: rgba(245, 181, 71, 0.1); color: var(--warn); font: 700 12px Arial, sans-serif; white-space: nowrap; cursor: pointer; }
.bring-all:hover { background: rgba(245, 181, 71, 0.2); color: var(--text); }
button.gbody { align-items: center; padding: 2px 6px 2px 2px; border: 1px solid transparent; border-radius: 5px; background: none; font: 12px Arial, sans-serif; text-align: left; cursor: pointer; }
button.gbody:hover { border-color: var(--line); color: var(--text); }
.grow.pick.on { background: var(--accent-soft); box-shadow: inset 3px 0 0 var(--accent); }
.grow.pick.on button.gbody { color: var(--text); font-weight: 700; }
/* Planet view sections: to supply, arriving, unknown, ready. The caption says what the numbers are. */
.sec { display: grid; grid-template-columns: minmax(130px, 1fr) minmax(0, 1.1fr) 62px 62px 62px 158px; gap: 8px; align-items: center; padding: 5px 6px 4px 10px; background: var(--bg); color: var(--muted); font: 700 11px Arial, sans-serif; }
.group.body + .sec { border-top: 1px solid var(--line); }
.sec-name { grid-column: 1 / span 2; color: var(--text-2); }
.sec-missing .sec-name { color: var(--warn); }
.sec-ready .sec-name { color: var(--ok); }
.sec-arriving .sec-name { color: var(--accent); }
.sec-col { grid-column: 3 / span 3; text-align: right; font-weight: 400; }
/* The body whose badge opened the window. */
.group.body.focus { box-shadow: inset 3px 0 0 var(--accent); background: var(--accent-soft); }
.group.body.focus .gtitle { color: var(--accent); }
.group.body:focus { outline: none; }
.bring-all:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
/* Levels queued in the game, resources held back. */
.pchip.qchip { border-style: dashed; background: none; color: var(--muted); cursor: default; }
.pchip.qchip:hover { border-color: var(--line); color: var(--muted); }
.grow.queued .gbody { align-items: center; padding-left: 2px; color: var(--muted); white-space: nowrap; }
.grow.queued .gbody > span { white-space: nowrap; }
.qtag { padding: 0 5px; border: 1px dashed var(--line); border-radius: 4px; color: var(--muted); font-size: 10px; white-space: nowrap; }
@media (max-width: 640px) { .kpis { grid-template-columns: 1fr; } }
`;
