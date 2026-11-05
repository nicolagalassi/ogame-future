/** Cost panel (inside the game's details panel, prefixed classes) and planner window (Shadow DOM). */
export const TECH_CSS = `
.fut-tp { margin: 8px 0 4px; padding: 8px 10px; border: 1px solid #1F2C40; border-radius: 8px; background: rgba(10,17,28,0.92);
  font: 11px/1.35 Arial, Helvetica, sans-serif; color: #E6EDF5; text-align: left; clear: both; }
.fut-tp-head { display: flex; align-items: center; gap: 6px; margin-bottom: 6px; }
.fut-tp-range { flex: 1; display: flex; align-items: baseline; gap: 6px; min-width: 0; }
.fut-tp-lv { font-size: 13px; font-weight: 700; color: #4FD1E8; }
.fut-tp-from { color: #8A9BB0; }
.fut-tp-step, .fut-tp-reset { width: 22px; height: 22px; padding: 0; border: 1px solid #1F2C40; border-radius: 6px; background: #111B2A;
  color: #C9D4E2; font: 700 14px/20px Arial, sans-serif; cursor: pointer; }
.fut-tp-reset { width: 18px; height: 18px; font-size: 12px; line-height: 16px; }
.fut-tp-step:hover:not(:disabled), .fut-tp-reset:hover { border-color: #4FD1E8; color: #fff; }
.fut-tp-step:disabled { opacity: 0.35; cursor: default; }
.fut-tp-grid { display: grid; grid-template-columns: auto 1fr 1fr 1fr; gap: 2px 10px; align-items: baseline; }
.fut-tp-h { color: #8A9BB0; font-size: 10px; text-align: right; }
.fut-tp-k { color: #8A9BB0; }
.fut-tp-k.fut-m { color: #B8C2CC; } .fut-tp-k.fut-c { color: #7FB8FF; } .fut-tp-k.fut-d { color: #4FE0B0; } .fut-tp-k.fut-e { color: #F5D547; }
.fut-tp-v { text-align: right; font-family: "JetBrains Mono", Consolas, monospace; white-space: nowrap; }
.fut-tp-sum { color: #4FD1E8; }
.fut-tp-short { color: #FF7A7A; }
.fut-tp-ok { color: #4FE0B0; }
.fut-tp-actions { display: flex; align-items: center; gap: 8px; margin-top: 8px; }
.fut-tp-add { padding: 4px 10px; border: 1px solid #2B6F7D; border-radius: 6px; background: #0F2A33; color: #E6EDF5;
  font: 700 11px Arial, sans-serif; cursor: pointer; }
.fut-tp-add:hover { border-color: #4FD1E8; }
.fut-tp-add.on { border-color: #2E7D5B; background: #10291F; color: #4FE0B0; }
.fut-tp-note { color: #8A9BB0; font-size: 10px; }
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
