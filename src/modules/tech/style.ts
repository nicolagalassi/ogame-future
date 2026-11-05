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
:host { all: initial; }
* { box-sizing: border-box; }
.backdrop { position: fixed; inset: 0; z-index: 100000; display: flex; justify-content: center; align-items: flex-start;
  padding: 48px 16px; background: rgba(3,6,12,0.72); overflow-y: auto; font: 13px/1.4 Arial, Helvetica, sans-serif; color: #E6EDF5; }
.panel { width: min(760px, 100%); display: flex; flex-direction: column; gap: 12px; padding: 18px;
  border: 1px solid #1F2C40; border-radius: 14px; background: #0A111C; box-shadow: 0 20px 60px rgba(0,0,0,0.6); }
.head { display: flex; align-items: flex-start; gap: 12px; }
.titles { flex: 1; display: flex; flex-direction: column; gap: 2px; }
h2 { margin: 0; font-size: 20px; font-weight: 700; }
h3 { margin: 0; font-size: 14px; font-weight: 700; color: #C9D4E2; }
.sub { color: #8A9BB0; font-size: 12px; }
.close { width: 32px; height: 32px; border-radius: 8px; border: 1px solid #1F2C40; background: #111B2A; color: #B4C2D3; line-height: 1; cursor: pointer; }
.close:hover { border-color: #4FD1E8; color: #E6EDF5; }
.summary { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0; border: 1px solid #1F2C40; border-radius: 10px; background: #0D1522; overflow: hidden; }
.empty { grid-column: span 2; margin: 0; padding: 18px; text-align: center; color: #8A9BB0; border: 1px dashed #1F2C40; border-radius: 10px; }
.kpi { display: flex; flex-direction: column; gap: 4px; padding: 10px 12px; box-shadow: 1px 0 0 #1F2C40, 0 1px 0 #1F2C40; }
.kpi .label { color: #8A9BB0; font-size: 12px; }
.kpi-line { display: flex; gap: 14px; font-size: 16px; font-weight: 700; }
.kpi.warn .label { color: #F5B547; }
.card { display: flex; flex-direction: column; gap: 8px; padding: 12px 0 4px; border-top: 1px solid #1F2C40; }
.card-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.card-title { display: flex; align-items: baseline; gap: 8px; min-width: 0; }
.count { color: #8A9BB0; font-size: 12px; white-space: nowrap; }
.card-acts { display: flex; gap: 6px; flex: none; }
.act { padding: 5px 10px; border: 1px solid #2B6F7D; border-radius: 6px; background: #0F2A33; color: #E6EDF5; font: 700 12px Arial, sans-serif; cursor: pointer; }
.act:hover { border-color: #4FD1E8; }
.act.ghost { border-color: #1F2C40; background: none; color: #8A9BB0; font-weight: 400; }
.act.ghost:hover { border-color: #FF7A7A; color: #FF7A7A; }
.sums { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 0; border: 1px solid #1F2C40; border-radius: 8px; background: #0D1522; overflow: hidden; }
.sum.sent .label { color: #4FD1E8; }
.sum { display: flex; flex-direction: column; gap: 2px; padding: 8px 10px; box-shadow: 1px 0 0 #1F2C40, 0 1px 0 #1F2C40; }
.sum .label { color: #8A9BB0; font-size: 11px; }
.sum.warn .label { color: #F5B547; }
.sum.ok .label { color: #4FE0B0; font-size: 13px; font-weight: 700; }
.sum.muted .label { color: #8A9BB0; }
.triple { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
.sum .triple { font-size: 14px; font-weight: 700; }
.triple.short .num { color: #FF7A7A; }
.rows { display: flex; flex-direction: column; }
.row { display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(0, 1.6fr) 24px; gap: 10px; align-items: center; padding: 4px 0; border-top: 1px solid #172334; }
.row:first-child { border-top: 0; }
.name { display: flex; gap: 8px; align-items: baseline; min-width: 0; }
.name > span:first-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.lv { color: #4FD1E8; font-size: 11px; white-space: nowrap; }
.num { text-align: right; font-family: "JetBrains Mono", Consolas, monospace; white-space: nowrap; }
.m { color: #B8C2CC; } .c { color: #7FB8FF; } .d { color: #4FE0B0; }
.x { width: 22px; height: 22px; padding: 0; display: inline-flex; align-items: center; justify-content: center; border: 1px solid transparent; border-radius: 6px; background: none; color: #8A9BB0; cursor: pointer; }
.x:hover { border-color: #FF7A7A; color: #FF7A7A; }
@media (max-width: 560px) { .summary, .sums { grid-template-columns: 1fr; } .empty { grid-column: auto; } .card-head { flex-wrap: wrap; } }
`;
