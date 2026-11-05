/** Inbox summaries (global classes, all prefixed) and expedition journal (Shadow DOM). */

/** Outcome colours, shared by the inbox chips and the journal. */
export const OUTCOME_COLORS: Record<string, string> = {
  resource: '#4FD1E8',
  darkmatter: '#B58CDB',
  ship: '#4FE0B0',
  nothing: '#8A9BB0',
  trader: '#F59E4B',
  item: '#D08A5B',
  blackhole: '#9AA3AD',
  early: '#7FA7FF',
  late: '#E06A6A',
  pirate: '#F5D547',
  alien: '#7EE05A',
  artefact: '#D4A93A',
  lifeform: '#E07BC8',
  unknown: '#5B6B80',
};

const outcomeCss = Object.entries(OUTCOME_COLORS)
  .map(([k, c]) => `.fut-msg .fut-out-${k} { color: ${c}; border-color: ${c}55; background: ${c}14; }`)
  .join('\n');

export const MESSAGES_CSS = `
.fut-msg { display: flex; flex-wrap: wrap; gap: 4px; align-items: center; margin: 6px 8px; padding: 5px 6px;
  border: 1px solid #1F2C40; border-radius: 8px; background: rgba(10,17,28,0.92); cursor: pointer;
  font: 11px/14px Arial, Helvetica, sans-serif; color: #E6EDF5; text-align: left; }
.fut-msg:hover { border-color: #2B6F7D; }
.fut-msg-chip { display: inline-flex; align-items: center; padding: 1px 7px; border: 1px solid #1F2C40; border-radius: 10px;
  background: #0E1724; white-space: nowrap; }
.fut-msg-out { font-weight: 700; }
.fut-msg-res, .fut-msg-msu, .fut-msg-loot { font-family: "JetBrains Mono", Consolas, monospace; }
.fut-msg-m { color: #B8C2CC; } .fut-msg-c { color: #7FB8FF; } .fut-msg-d { color: #4FE0B0; } .fut-msg-f { color: #D6A8C8; } .fut-msg-dm { color: #B58CDB; }
.fut-msg-msu { color: #C9D4E2; } .fut-msg-loot { color: #4FD1E8; }
.fut-msg-ship { color: #4FE0B0; gap: 4px; padding-left: 2px; font-family: "JetBrains Mono", Consolas, monospace; }
.fut-msg-icon { width: 18px; height: 18px; border-radius: 50%; object-fit: cover; flex: none; }
.fut-msg-icon-none { font-size: 9px; color: #8A9BB0; } .fut-msg-item { color: #D08A5B; } .fut-msg-lf { color: #E07BC8; } .fut-msg-art { color: #D4A93A; }
.fut-msg-route { color: #C9D4E2; }
.fut-msg-warn { color: #F5B547; } .fut-msg-muted { color: #8A9BB0; }
.fut-msg .fut-msg-neg { color: #FF7A7A; border-color: #FF7A7A44; }
${outcomeCss}
.fut-msg.fut-msg-rows { flex-direction: column; flex-wrap: nowrap; align-items: stretch; gap: 5px; border-left-width: 3px; }
.fut-msg-row { display: flex; flex-wrap: wrap; gap: 4px; align-items: center; }
.fut-msg-found { justify-content: center; }
.fut-msg-foot { justify-content: center; }
.fut-msg-foot .fut-msg-chip { border-color: transparent; background: none; font-size: 10px; padding: 0 4px; }
.fut-msg-big { font-size: 12px; font-weight: 700; }
.fut-msg-top .fut-msg-size { margin-left: auto; }
/* Size: normal = grey, big = cyan, huge = gold (frame and label). */
.fut-msg.fut-size-2 { border-color: #2A3B55; }
.fut-msg.fut-size-1 { border-color: #4FD1E8aa; }
.fut-msg.fut-size-0 { border-color: #F5D547cc; box-shadow: 0 0 8px #F5D54733; }
.fut-msg-chip.fut-size-2 { color: #8A9BB0; }
.fut-msg-chip.fut-size-1 { color: #4FD1E8; border-color: #4FD1E855; }
.fut-msg-chip.fut-size-0 { color: #F5D547; border-color: #F5D54777; font-weight: 700; }
.msg.fut-msg-folded .msgContent, .msg.fut-msg-folded .msg_content, .msg.fut-msg-folded > .content-box { display: none !important; }
`;

export const JOURNAL_CSS = `
:host { all: initial; }
* { box-sizing: border-box; }
.backdrop { position: fixed; inset: 0; z-index: 100000; display: flex; justify-content: center; align-items: flex-start;
  padding: 40px 16px; background: rgba(3,6,12,0.72); overflow-y: auto; font: 13px/1.4 Arial, Helvetica, sans-serif; color: #E6EDF5; }
.panel { width: min(860px, 100%); display: flex; flex-direction: column; gap: 12px; padding: 18px;
  border: 1px solid #1F2C40; border-radius: 14px; background: #0A111C; box-shadow: 0 20px 60px rgba(0,0,0,0.6); }
.head { display: flex; align-items: flex-start; gap: 12px; }
.titles { flex: 1; display: flex; flex-direction: column; gap: 2px; }
h2 { margin: 0; font-size: 20px; font-weight: 700; }
h3 { margin: 0 0 6px; font-size: 13px; font-weight: 700; color: #C9D4E2; }
.sub { color: #8A9BB0; font-size: 12px; }
.close { width: 32px; height: 32px; border-radius: 8px; border: 1px solid #1F2C40; background: #111B2A; color: #B4C2D3; font-size: 20px; line-height: 1; cursor: pointer; }
.close:hover { border-color: #4FD1E8; color: #E6EDF5; }
.tabs { display: flex; flex-wrap: wrap; gap: 6px; }
.tab { padding: 5px 12px; border: 1px solid #1F2C40; border-radius: 16px; background: #111B2A; color: #B4C2D3; font: 12px Arial, sans-serif; cursor: pointer; }
.tab[aria-pressed="true"] { border-color: #4FD1E8; background: #0F2A33; color: #E6EDF5; font-weight: 700; }
.kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 8px; }
.kpi { display: flex; flex-direction: column; gap: 3px; padding: 10px 12px; border: 1px solid #1F2C40; border-radius: 10px; background: #111B2A; min-width: 0; }
.kpi .label { color: #8A9BB0; font-size: 11px; }
.kpi .value { font-size: 18px; font-weight: 700; font-family: "JetBrains Mono", Consolas, monospace; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.kpi .detail { color: #8A9BB0; font-size: 11px; display: flex; flex-wrap: wrap; gap: 8px; }
.neg { color: #FF7A7A; } .pos { color: #4FE0B0; }
.m { color: #B8C2CC; } .c { color: #7FB8FF; } .d { color: #4FE0B0; } .dm { color: #B58CDB; }
.card { padding: 12px 14px; border: 1px solid #1F2C40; border-radius: 10px; background: #111B2A; }
.bar { display: flex; height: 12px; border-radius: 6px; overflow: hidden; background: #0D1522; gap: 2px; }
.bar span { display: block; height: 100%; min-width: 2px; }
.legend { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 4px 12px; margin-top: 8px; font-size: 12px; }
.legend div { display: flex; align-items: center; gap: 6px; }
.dot { width: 9px; height: 9px; border-radius: 50%; flex: none; }
.legend .n { margin-left: auto; font-family: "JetBrains Mono", Consolas, monospace; color: #C9D4E2; }
.legend .pct { color: #8A9BB0; font-size: 11px; min-width: 38px; text-align: right; }
table { width: 100%; border-collapse: collapse; font-size: 12px; }
th { text-align: right; color: #8A9BB0; font-weight: 400; padding: 3px 6px; border-bottom: 1px solid #1F2C40; white-space: nowrap; }
th:first-child, td:first-child { text-align: left; }
td { text-align: right; padding: 3px 6px; border-bottom: 1px solid #172334; font-family: "JetBrains Mono", Consolas, monospace; white-space: nowrap; }
td:first-child { font-family: Arial, sans-serif; color: #C9D4E2; }
.scroll { overflow-x: auto; }
.ships { display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 6px; }
.ship { display: flex; align-items: center; gap: 8px; padding: 4px; border: 1px solid #1F2C40; border-radius: 8px; background: #0D1522; min-width: 0; }
.ships.lost .ship { border-color: #FF7A7A33; }
.ship-img { width: 44px; height: 44px; flex: none; border-radius: 6px; object-fit: cover; background: #16202E; }
.ship-img-none { display: flex; align-items: center; justify-content: center; color: #8A9BB0; font-size: 11px; }
.ship-info { display: flex; flex-direction: column; min-width: 0; }
.ship-info b { font-family: "JetBrains Mono", Consolas, monospace; font-size: 14px; }
.ship-name { color: #B4C2D3; font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
h4 { margin: 10px 0 6px; font-size: 12px; font-weight: 700; color: #FF7A7A; }
.foot { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; justify-content: space-between; }
.opt { display: flex; gap: 6px; align-items: center; color: #B4C2D3; font-size: 12px; cursor: pointer; }
.acts { display: flex; gap: 6px; }
.act { padding: 5px 10px; border: 1px solid #2B6F7D; border-radius: 6px; background: #0F2A33; color: #E6EDF5; font: 700 12px Arial, sans-serif; cursor: pointer; }
.act:hover { border-color: #4FD1E8; }
.act.ghost { border-color: #1F2C40; background: none; color: #8A9BB0; font-weight: 400; }
.act.ghost:hover, .act.danger { border-color: #FF7A7A; color: #FF7A7A; }
.empty { margin: 0; padding: 18px; text-align: center; color: #8A9BB0; border: 1px dashed #1F2C40; border-radius: 10px; }
@media (max-width: 560px) { .kpi .value { font-size: 15px; } }
`;
