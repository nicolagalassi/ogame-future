/** Cost panel (inside the game's details panel, prefixed classes) and planner window (Shadow DOM). */
export const TECH_CSS = `
#technologydetails.fut-tp-on > .description .txt_box .text { display: none; }
#technologydetails.fut-tp-on > .description .txt_box { position: absolute; right: 4px; top: 4px; width: auto; padding: 0; }
.fut-tp { display: flex; gap: 12px; box-sizing: border-box; height: 86px; padding: 6px 30px 6px 8px; border: 1px solid #1F2C40; border-radius: 6px;
  background: rgba(10,17,28,0.92); font: 11px/14px Arial, Helvetica, sans-serif; color: #E6EDF5; text-align: left; overflow: hidden; }
.fut-tp-side { flex: none; width: 142px; display: flex; flex-direction: column; gap: 4px; }
.fut-tp-head { display: flex; align-items: center; gap: 4px; }
.fut-tp-lv { font-size: 13px; font-weight: 700; color: #4FD1E8; white-space: nowrap; }
.fut-tp-head .fut-tp-lv { min-width: 52px; text-align: center; }
.fut-tp-from { color: #8A9BB0; font-size: 10px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
#technologydetails .fut-tp-step, #technologydetails .fut-tp-reset { width: 20px; height: 20px; padding: 0; border: 1px solid #1F2C40; border-radius: 5px; background: #111B2A;
  color: #C9D4E2; font: 700 13px/18px Arial, sans-serif; cursor: pointer; }
.fut-tp-reset { width: 16px; height: 16px; font-size: 11px; line-height: 14px; }
.fut-tp-step:hover:not(:disabled), .fut-tp-reset:hover { border-color: #4FD1E8; color: #fff; }
.fut-tp-step:disabled { opacity: 0.35; cursor: default; }
.fut-tp-grid { flex: 1; min-width: 0; display: grid; gap: 2px 10px; align-content: start; }
.fut-tp-h { color: #8A9BB0; font-size: 10px; text-align: right; white-space: nowrap; }
.fut-tp-h.fut-m { color: #B8C2CC; } .fut-tp-h.fut-c { color: #7FB8FF; } .fut-tp-h.fut-d { color: #4FE0B0; } .fut-tp-h.fut-e { color: #F5D547; }
.fut-tp-k { color: #8A9BB0; white-space: nowrap; }
.fut-tp-v { text-align: right; font-family: "JetBrains Mono", Consolas, monospace; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.fut-tp-sum { color: #4FD1E8; }
.fut-tp-short { color: #FF7A7A; }
.fut-tp-ok { color: #4FE0B0; }
#technologydetails .fut-tp-add { align-self: flex-start; margin-top: auto; padding: 3px 8px; border: 1px solid #2B6F7D; border-radius: 5px; background: #0F2A33; color: #E6EDF5;
  font: 700 11px Arial, sans-serif; cursor: pointer; white-space: nowrap; }
#technologydetails .fut-tp-add:hover { border-color: #4FD1E8; }
#technologydetails .fut-tp-add.on { border-color: #2E7D5B; background: #10291F; color: #4FE0B0; }
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
.close { width: 32px; height: 32px; border-radius: 8px; border: 1px solid #1F2C40; background: #111B2A; color: #B4C2D3; font-size: 20px; line-height: 1; cursor: pointer; }
.close:hover { border-color: #4FD1E8; color: #E6EDF5; }
.summary { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
.empty { grid-column: span 2; margin: 0; padding: 18px; text-align: center; color: #8A9BB0; border: 1px dashed #1F2C40; border-radius: 10px; }
.kpi { display: flex; flex-direction: column; gap: 4px; padding: 12px; border: 1px solid #1F2C40; border-radius: 10px; background: #111B2A; }
.kpi .label { color: #8A9BB0; font-size: 12px; }
.kpi-line { display: flex; gap: 14px; font-size: 16px; font-weight: 700; }
.kpi.warn .label { color: #F5B547; }
.card { padding: 12px 14px; border: 1px solid #1F2C40; border-radius: 10px; background: #111B2A; }
.card-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
.link { border: 0; background: none; color: #8A9BB0; font: 12px Arial, sans-serif; cursor: pointer; text-decoration: underline; }
.link:hover { color: #FF7A7A; }
.rows { display: flex; flex-direction: column; }
.row { display: grid; grid-template-columns: minmax(0, 2fr) repeat(3, minmax(0, 1fr)) 24px; gap: 8px; align-items: center; padding: 4px 0; border-top: 1px solid #172334; }
.row.hdr { border-top: 0; color: #8A9BB0; font-size: 11px; }
.row.sum { font-weight: 700; border-top-color: #2A3B55; }
.row.miss { color: #8A9BB0; }
.name { display: flex; gap: 8px; align-items: baseline; min-width: 0; }
.name > span:first-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.lv { color: #4FD1E8; font-size: 11px; white-space: nowrap; }
.num { text-align: right; font-family: "JetBrains Mono", Consolas, monospace; white-space: nowrap; }
.m { color: #B8C2CC; } .c { color: #7FB8FF; } .d { color: #4FE0B0; }
.short { color: #FF7A7A; }
.ok { text-align: right; color: #4FE0B0; }
.x { width: 22px; height: 22px; padding: 0; border: 1px solid transparent; border-radius: 6px; background: none; color: #8A9BB0; font-size: 15px; cursor: pointer; }
.x:hover { border-color: #FF7A7A; color: #FF7A7A; }
@media (max-width: 560px) { .summary { grid-template-columns: 1fr; } .empty { grid-column: auto; } }
`;
