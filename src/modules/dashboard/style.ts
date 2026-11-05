/** Dashboard styles. They live inside the panel's Shadow DOM, so the game's CSS cannot reach them. */
export const DASHBOARD_CSS = `
:host { all: initial; }
* { box-sizing: border-box; }
.backdrop {
  position: fixed; inset: 0; z-index: 100000; display: flex; justify-content: center; align-items: flex-start;
  padding: 48px 16px; background: rgba(3,6,12,0.72); overflow-y: auto;
  font: 13px/1.4 Arial, Helvetica, sans-serif; color: #E6EDF5;
}
.panel {
  width: min(1120px, 100%); display: flex; flex-direction: column; gap: 12px; padding: 18px;
  border: 1px solid #1F2C40; border-radius: 14px; background: #0A111C; box-shadow: 0 20px 60px rgba(0,0,0,0.6);
}
.head { display: flex; align-items: flex-start; gap: 12px; }
.titles { flex: 1; display: flex; flex-direction: column; gap: 2px; }
h2 { margin: 0; font-size: 20px; font-weight: 700; letter-spacing: 0.01em; }
h3 { margin: 0 0 8px; font-size: 14px; font-weight: 700; color: #C9D4E2; }
.sub { color: #8A9BB0; font-size: 12px; }
.close {
  width: 32px; height: 32px; border-radius: 8px; border: 1px solid #1F2C40; background: #111B2A;
  color: #B4C2D3; line-height: 1; cursor: pointer;
}
.moon-ico { margin-right: 4px; vertical-align: -1px; color: #8A9BB0; }
.close:hover { border-color: #4FD1E8; color: #E6EDF5; }
.mono { font-family: "JetBrains Mono", Consolas, monospace; }

/* Key numbers: one strip split by hairlines (same language as the planet-menu toolbar). */
.kpis { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 0; border: 1px solid #1F2C40; border-radius: 10px; background: #0D1522; overflow: hidden; }
.kpi { display: flex; flex-direction: column; gap: 3px; padding: 10px 12px; min-width: 0; box-shadow: 1px 0 0 #1F2C40, 0 1px 0 #1F2C40; }
.kpi .label { color: #8A9BB0; font-size: 12px; }
.kpi .value { font-size: 20px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.kpi .note { color: #8A9BB0; font-size: 11px; }
.kpi.accent .value { color: #4FD1E8; }
.kpi.warn .value { color: #F5B547; }

.cols { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0 24px; }
/* Sections, not cards inside the window: a hairline on top and air around. */
.card { padding: 12px 0 4px; border-top: 1px solid #1F2C40; min-width: 0; }
.prod { margin-bottom: 10px; }
.prod-top { display: flex; justify-content: space-between; gap: 8px; margin-bottom: 4px; font-size: 12px; }
.track { height: 6px; border-radius: 3px; background: #1A2638; overflow: hidden; }
.fill { height: 100%; border-radius: 3px; background: currentColor; }
.prod.m { color: #B8C2CC; } .prod.c { color: #7FB8FF; } .prod.d { color: #4FE0B0; }
.prod .prod-top span:first-child { color: #E6EDF5; }
.hint { margin: 6px 0 0; color: #8A9BB0; font-size: 11px; }
.ok { margin: 0; color: #38C56E; }
.alert { display: flex; gap: 8px; padding: 6px 0; border-top: 1px solid #1A2638; }
.alert:first-of-type { border-top: 0; }
.alert .dot { flex-shrink: 0; width: 8px; height: 8px; margin-top: 5px; border-radius: 50%; background: #7FB8FF; }
.alert.warn .dot { background: #F5B547; }
.alert div { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
.alert strong { font-size: 13px; }
.alert span { color: #8A9BB0; font-size: 12px; }

.table-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; }
.table-head h3 { margin: 0; }
.chip {
  height: 26px; padding: 0 10px; border-radius: 7px; border: 1px solid #1F2C40; background: #0A111C;
  color: #B4C2D3; font: 12px Arial, sans-serif; cursor: pointer;
}
.chip:hover { border-color: #4FD1E8; color: #E6EDF5; }
.table-wrap { overflow-x: auto; }
table { width: 100%; border-collapse: collapse; font-size: 12px; }
th { text-align: left; padding: 6px 8px; color: #8A9BB0; font-weight: 600; border-bottom: 1px solid #1F2C40; white-space: nowrap; }
th.num, td.num { text-align: right; }
.sort { all: unset; cursor: pointer; }
.sort:hover { color: #E6EDF5; }
td { padding: 5px 8px; border-bottom: 1px solid #16202F; white-space: nowrap; }
tr.moon td { background: rgba(22,36,58,0.5); color: #C9D4E2; }
tbody tr:hover td { background: rgba(79,209,232,0.07); }
td.name a { color: #E6EDF5; text-decoration: none; font-weight: 700; }
td.name a:hover { color: #8BE4F2; }
tr.moon td.name a { font-weight: 400; color: #C9D4E2; }
.coords { margin-left: 6px; color: #8A9BB0; font-family: "JetBrains Mono", Consolas, monospace; font-size: 11px; }
.tag { margin-left: 6px; padding: 0 5px; border-radius: 4px; background: rgba(245,181,71,0.15); color: #F5B547; font-size: 10px; }
td.m { color: #B8C2CC; } td.c { color: #7FB8FF; } td.d { color: #4FE0B0; }
td.full { color: #F5B547 !important; font-weight: 700; }
.warnText { color: #F5B547; }
.age.fresh { color: #38C56E; } .age.warm { color: #E3BB28; } .age.old { color: #EF7676; }
tfoot td { border-top: 1px solid #1F2C40; border-bottom: 0; font-weight: 700; }

.move { display: flex; align-items: center; gap: 8px; padding: 5px 0; border-top: 1px solid #1A2638; }
.move:first-of-type { border-top: 0; }
.move .n { width: 20px; height: 20px; flex-shrink: 0; border-radius: 50%; background: #12283A; color: #4FD1E8; font-size: 11px; font-weight: 700; display: flex; align-items: center; justify-content: center; }
.move-text { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.move-text strong { font-size: 13px; }
.move-text span { color: #8A9BB0; font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.roi { color: #4FD1E8; font-weight: 700; white-space: nowrap; }
td.queue { white-space: nowrap; }
.q { display: inline-block; margin-right: 4px; padding: 1px 6px; border-radius: 4px; font-size: 11px; border: 1px solid color-mix(in srgb, currentColor 45%, transparent); background: none; }
.q-building { color: #FF8200; } .q-research { color: #32FB2F; } .q-ship { color: #FFEB00; }
.q-lfbuilding { color: #FF79BD; } .q-lfresearch { color: #42AFFF; }
/* Tabs: underline, as in the journal. */
.tabs { display: flex; flex-wrap: wrap; gap: 0; border-bottom: 1px solid #1F2C40; }
.tab { padding: 7px 12px; margin-bottom: -1px; border: 0; border-bottom: 2px solid transparent; background: none; color: #8A9BB0; font: 13px Arial, sans-serif; cursor: pointer; }
.tab:hover { color: #E6EDF5; }
.tab[aria-pressed="true"] { border-bottom-color: #4FD1E8; color: #E6EDF5; font-weight: 700; }
.sub-tabs .tab { font-size: 12px; padding: 5px 10px; }
.tab-body { display: flex; flex-direction: column; gap: 12px; min-width: 0; }
.empty { margin: 0; padding: 18px; text-align: center; color: #8A9BB0; border: 1px dashed #1F2C40; border-radius: 10px; }
h4 { margin: 12px 0 4px; font-size: 12px; font-weight: 700; color: #C9D4E2; }

/* Level tables: first column stays put while the rest scrolls. */
.matrix th.col { vertical-align: bottom; white-space: normal; min-width: 44px; max-width: 74px; padding: 6px 4px; line-height: 1.2; }
.matrix .col-name { display: block; font-size: 10px; font-weight: 600; color: #8A9BB0; text-decoration: none; word-break: break-word; hyphens: auto; }
.matrix a.col-name:hover { color: #E6EDF5; }
.matrix th.col.on .col-name { color: #4FD1E8; }
.matrix th.col.on { box-shadow: inset 0 -2px 0 #4FD1E8; }
.matrix td { padding: 4px 6px; }
.matrix th.name, .matrix td.name { position: sticky; left: 0; z-index: 1; background: #0A111C; }
.matrix tr.moon td.name { background: #0F1828; }
.matrix td.tech { color: #C9D4E2; font-weight: 400; max-width: 260px; overflow: hidden; text-overflow: ellipsis; }
td.zero { color: #3A4A60; }
td.top { color: #4FD1E8; }
td.off { opacity: 0.55; }
.unit-ico { width: 28px; height: 28px; border-radius: 4px; object-fit: cover; display: block; margin: 0 auto; background: #16202E; }
.unit-ico-none { display: flex; align-items: center; justify-content: center; color: #8A9BB0; font-size: 10px; }

/* Research: name and level in a compact grid. */
.levels { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 0 20px; }
.lv { display: flex; justify-content: space-between; gap: 8px; padding: 4px 0; border-bottom: 1px solid #16202F; font-size: 12px; }
.lv span { color: #C9D4E2; } .lv.zero b { color: #3A4A60; }

/* Scrap calculator */
.scrap-bar { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin: 8px 0; }
.field { height: 28px; padding: 0 8px; border: 1px solid #1F2C40; border-radius: 6px; background: #0D1522; color: #E6EDF5; font: 12px Arial, sans-serif; }
.field:focus { border-color: #4FD1E8; outline: none; }
.field-label { display: inline-flex; align-items: center; gap: 6px; color: #8A9BB0; font-size: 12px; }
.field.rate { width: 64px; text-align: right; }
.field.qty { width: 110px; text-align: right; font-family: "JetBrains Mono", Consolas, monospace; }
table.scrap .unit-label { display: flex; align-items: center; gap: 8px; }
table.scrap td.unit .unit-ico { margin: 0; width: 24px; height: 24px; }
.msu { color: #4FD1E8; margin-left: 4px; }
@media (max-width: 900px) { .kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 1100px) { .kpis { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
@media (max-width: 900px) {
  .kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .cols { grid-template-columns: 1fr; }
}
`;
