import { WINDOW_TOKENS } from '../../core/sheet';

/** Cost panel (inside the game's details panel, prefixed classes) and planner window (Shadow DOM). */
export const TECH_CSS = `
/* Window tokens (core/sheet.ts) for every surface this sheet styles. */
#technologydetails, .fut-tp, .fut-tp-tools, .fut-tp-grid, .fut-tp-h, .fut-tp-k, .fut-tp-v, .fut-tp-sum, .fut-tp-short, .fut-tp-ok, .fut-tp-miss, .fut-tp-chips, .fut-tp-chip, .fut-tp-energy, .fut-tp-start, .fut-tp-disc, .fut-tp-pop, .fut-tp-lack, .fut-tp-sat, .fut-tp-lab, .fut-tp-sat-link { ${WINDOW_TOKENS} }
/* The game's own cost list and detail lines give way to the panel (their data is in it). */
#technologydetails.fut-tp-on .content .costs,
#technologydetails.fut-tp-on .content .information > ul { display: none !important; }
/* The game's dark matter button ("Inizia con MO") is much bigger than the normal one. */
#technologydetails.fut-tp-on .build-it_wrap .build-it_premium { transform: scale(0.72); transform-origin: right bottom; }
#technologydetails.fut-tp-on .content .information .level { color: var(--accent); font-weight: 700; }
/* Units: shipyard choice on one line under the title, amount field over the build button. */
/* Shipyard choice: a two-way switch (the game's radios stay, hidden but focusable; the labels are the buttons). */
#technologydetails.fut-tp-unit .content .shipyardSelection { position: absolute; top: 26px; left: 6px; right: 158px; width: auto; height: 20px;
  display: flex; align-items: stretch; gap: 0; margin: 0; padding: 0; white-space: nowrap; overflow: hidden; }
#technologydetails.fut-tp-unit .content .shipyardSelection input { position: absolute; opacity: 0; width: 1px; height: 1px; margin: 0; pointer-events: none; }
#technologydetails.fut-tp-unit .content .shipyardSelection label { float: none; display: flex; align-items: center; margin: 0; padding: 0 10px; width: auto;
  border: 0; background: rgba(21,28,38,0.92); color: var(--label); font: 600 condensed 13px/20px var(--display); cursor: pointer; }
#technologydetails.fut-tp-unit .content .shipyardSelection label::before, #technologydetails.fut-tp-unit .content .shipyardSelection label::after { display: none !important; }
#technologydetails.fut-tp-unit .content .shipyardSelection label:first-of-type { border-radius: 4px 0 0 4px; }
#technologydetails.fut-tp-unit .content .shipyardSelection label:last-of-type { border-radius: 0 4px 4px 0; }
#technologydetails.fut-tp-unit .content .shipyardSelection label + input + label { margin-left: 2px; }
#technologydetails.fut-tp-unit .content .shipyardSelection label:hover { color: var(--text); }
#technologydetails.fut-tp-unit .content .shipyardSelection input:checked + label { background: rgba(33,43,58,0.96); color: var(--text); box-shadow: inset 0 2px 0 var(--accent); }
#technologydetails.fut-tp-unit .content .shipyardSelection input:focus-visible + label { outline: 2px solid var(--accent); outline-offset: -2px; }
#technologydetails.fut-tp-unit .content .build_amount { position: absolute; top: 104px; right: 6px; width: 146px; height: 28px; margin: 0; padding: 0;
  display: flex; align-items: center; gap: 4px; }
#technologydetails.fut-tp-unit .content .build_amount label { display: none; }
#technologydetails.fut-tp-unit .content .build_amount input, #technologydetails.fut-tp-unit #build_amount { position: static; float: none; flex: 1; min-width: 0; width: auto; height: 26px; margin: 0; padding: 0 6px; box-sizing: border-box;
  border: 0; border-radius: 4px; background: rgba(21,28,38,0.92) none; color: var(--text); font: 600 condensed 15px var(--display); text-align: right; box-shadow: none; }
#technologydetails.fut-tp-unit #build_amount:focus { outline: none; box-shadow: inset 0 0 0 1px var(--accent); }
#technologydetails.fut-tp-unit .content .build_amount .maximum { position: static; float: none; flex: none; width: auto; height: 26px; margin: 0; padding: 0 6px;
  background: rgba(21,28,38,0.92) none !important; border: 0; border-radius: 4px; color: var(--label); font: 12px var(--body); cursor: pointer; }
#technologydetails.fut-tp-unit .content .build_amount .maximum::before, #technologydetails.fut-tp-unit .content .build_amount .maximum::after { display: none !important; }
#technologydetails.fut-tp-unit .content .build_amount .maximum:hover { background: rgba(33,43,58,0.96) none !important; color: var(--text); }
#technologydetails.fut-tp-unit .fut-tp { right: 158px; }
#technologydetails.fut-tp-unit:has(.shipyardSelection) .fut-tp { top: 52px; }
.fut-tp, .fut-tp-tools {
  /* The window tokens come from the block at the top (core/sheet.ts); only energy is the tech page's own. */
  --energy: #F5D547; --mono: var(--display);
}
.fut-tp { position: absolute; top: 24px; left: 6px; right: 138px; bottom: 6px; display: flex; flex-direction: column; gap: 6px;
  font: 12px/15px var(--body); color: var(--text); text-align: left; }
/* The ledger, printed on the board: hairlines between rows, figures right-aligned in the board's face. */
.fut-tp-grid { display: grid; align-content: start; border-radius: 4px; background: rgba(21,28,38,0.92); padding: 2px 0; }
.fut-tp-grid > span { min-width: 0; padding: 3px 8px; border-bottom: 1px solid var(--line-soft); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.fut-tp-h { color: var(--label); font: 12px/15px var(--body); text-align: right; }
.fut-tp-h:first-child { text-align: left; }
.fut-tp-k { display: flex; align-items: center; gap: 6px; font: 600 condensed 14px/16px var(--display); color: var(--text-2); }
.fut-tp-k svg { flex: none; }
.fut-tp-k > span { overflow: hidden; text-overflow: ellipsis; }
.fut-tp-k.fut-m { color: var(--m); } .fut-tp-k.fut-c { color: var(--c); } .fut-tp-k.fut-d { color: var(--d); } .fut-tp-k.fut-e { color: var(--energy); }
.fut-tp-v { font: 600 condensed 14px/16px var(--display); font-variant-numeric: tabular-nums; color: var(--text-2); text-align: right; }
.fut-tp-sum { color: var(--text); }
.fut-tp-short { color: var(--warn); }
.fut-tp-ok { color: var(--ok); display: flex; align-items: center; justify-content: flex-end; }
/* The total row closes the ledger: a firmer rule above, no rule below. */
.fut-tp-grid > .fut-tp-total { border-top: 1px solid var(--line); border-bottom: 0; }
.fut-tp-k.fut-tp-msu { color: var(--label); }
/* What is missing: a column band, orange when something lacks (to do, as in the Plan), green when nothing does. */
.fut-tp-miss { background: rgba(240,138,60,0.08); }
.fut-tp-miss.fut-tp-none { background: rgba(123,196,127,0.07); }
.fut-tp-h.fut-tp-miss { color: var(--warn); } .fut-tp-h.fut-tp-none { color: var(--ok); }
.fut-tp-chips { display: flex; flex-wrap: wrap; gap: 4px; margin-top: auto; }
.fut-tp-chip { display: inline-flex; align-items: center; gap: 5px; height: 22px; box-sizing: border-box; padding: 0 8px; border: 1px solid transparent; border-radius: 4px;
  background: rgba(21,28,38,0.92); color: var(--text-2); font: 12px/20px var(--body); font-variant-numeric: tabular-nums; white-space: nowrap; max-width: 100%; overflow: hidden; text-overflow: ellipsis; }
.fut-tp-chip svg { flex: none; color: var(--muted); }
.fut-tp-energy svg { color: var(--energy); } .fut-tp-start svg { color: var(--accent); }
.fut-tp-disc { color: var(--muted); }
.fut-tp-pop svg { color: #E58CDB; }
.fut-tp-lack { border-color: var(--warn); color: var(--warn); } .fut-tp-lack svg { color: var(--warn); }
.fut-tp-sat { border-color: rgba(245,213,71,0.35); color: var(--energy); cursor: pointer; } .fut-tp-sat svg { color: var(--energy); }
.fut-tp-sat:hover { border-color: var(--energy); }
.fut-tp-lab { border-color: var(--accent-line); color: var(--text, var(--text-2)); }
.fut-tp-sat-link { display: inline-flex; max-width: 100%; text-decoration: none; }
/* Tools over the picture: one stepper (− / the jump printed large / +) and the plan button with its word,
   as the board's rung track. Filled pawn yellow to add; outlined with a tick once it is in the plan. */
.fut-tp-tools { position: absolute; top: 4px; left: 4px; right: 4px; display: flex; gap: 4px; z-index: 2; }
#technologydetails .fut-tp-btn { height: 26px; display: flex; align-items: center; justify-content: center; gap: 4px; padding: 0 6px; margin: 0;
  border: 0; border-radius: 4px; background: rgba(21,28,38,0.92); color: var(--text-2); font: 600 condensed 13px var(--display); cursor: pointer; }
#technologydetails .fut-tp-btn:hover:not(:disabled) { background: rgba(33,43,58,0.96); color: var(--text); }
#technologydetails .fut-tp-btn:disabled { color: var(--quiet); cursor: default; }
#technologydetails .fut-tp-btn:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
#technologydetails .fut-tp-stepper { flex: 1; min-width: 0; display: flex; gap: 2px; }
#technologydetails .fut-tp-step { flex: none; width: 26px; padding: 0; }
#technologydetails .fut-tp-range { flex: 1; min-width: 0; gap: 5px; color: var(--text); }
#technologydetails .fut-tp-range:disabled { color: var(--text); }
#technologydetails .fut-tp-range b { font: 600 condensed 15px var(--display); }
#technologydetails .fut-tp-range .fut-tp-arrow { color: var(--label); font-weight: 400; }
#technologydetails .fut-tp-range .fut-tp-to { color: var(--accent); }
#technologydetails .fut-tp-plan { flex: none; padding: 0 9px 0 7px; background: var(--accent); color: var(--on-accent); }
#technologydetails .fut-tp-plan:hover:not(:disabled) { background: var(--accent-hi); color: var(--on-accent); }
#technologydetails .fut-tp-plan.on { background: rgba(21,28,38,0.92); box-shadow: inset 0 0 0 1px var(--accent); color: var(--accent); }
#technologydetails .fut-tp-plan.on:hover { background: rgba(33,43,58,0.96); color: var(--accent); }
/* Our amount (for the plan) over the picture: same dark field as the game's one, beating the game's input skin. */
/* The game's field stays (it is what the game reads to build) but ours is the one shown. */
#technologydetails .fut-tp-gamefield { display: none !important; }
#technologydetails .fut-tp-tools .fut-tp-amount, #technologydetails .build_amount .fut-tp-amount { flex: 1; min-width: 0; height: 26px; box-sizing: border-box; margin: 0; padding: 0 6px; border: 0; border-radius: 4px;
  background: rgba(21,28,38,0.92) none; color: var(--text); font: 600 condensed 15px var(--display); text-align: right; box-shadow: none; }
#technologydetails .fut-tp-tools .fut-tp-amount:focus, #technologydetails .build_amount .fut-tp-amount:focus { outline: none; box-shadow: inset 0 0 0 1px var(--accent); }
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
.num.short { color: var(--warn) !important; }
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
.group.body .ghead:hover { background: var(--line); }
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
