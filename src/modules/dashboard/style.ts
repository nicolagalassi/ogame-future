/** Dashboard styles. They live inside the panel's Shadow DOM, so the game's CSS cannot reach them. */
export const DASHBOARD_CSS = `
:host { --panel-w: 1120px; }
/* The Dashboard is the tallest window: closer to the top of the screen than the others (40px), so a 1080p screen shows more of it. */
.backdrop { padding-top: 16px; padding-bottom: 16px; }
.moon-ico { margin-right: 4px; vertical-align: -1px; color: var(--muted); }
.kpis { grid-template-columns: repeat(6, minmax(0, 1fr)); }

.cols { display: grid; grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.4fr) minmax(0, 0.9fr); gap: 2px; }
/* Resource tokens: discs in the game's resource colours, the way a board game prints costs. */
.tok { display: inline-flex; flex: none; vertical-align: -2px; }
.tok svg { display: block; }
.tok.m { color: var(--m); } .tok.c { color: var(--c); } .tok.d { color: var(--d); }
/* Income tracks: 20 printed cells on one scale, the pawn on today's income, an outline on the next rung. */
.prod { margin-bottom: 14px; }
.prod-top { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; margin-bottom: 6px; }
.prod-name { display: inline-flex; align-items: center; gap: 7px; font: 600 condensed 14px var(--display); color: var(--text); }
.prod-val { font: 600 condensed 18px var(--display); color: var(--text); }
.prod-val small { margin-left: 2px; font: 12px var(--body); color: var(--label); }
.prod-val small.next { margin-left: 8px; }
.prod-total { margin: 14px 0 0; color: var(--label); font-size: 12px; }
.prod-total b { font: 600 condensed 18px var(--display); color: var(--text); margin-right: 2px; }
/* The account's figures as one printed score line, each labelled once. */
.facts { display: flex; flex-wrap: wrap; gap: 4px 22px; margin-top: 2px; margin-bottom: 0; color: var(--label); font-size: 12px; }
.facts b { font: 600 condensed 18px var(--display); color: var(--text); }
.fact { cursor: default; }
.track { display: grid; grid-template-columns: repeat(20, minmax(0, 1fr)); gap: 2px; height: 18px; }
.track i { background: var(--raised); box-shadow: inset 0 0 0 1px var(--line-strong); }
.track i.f { background: var(--faint); box-shadow: none; }
.track i.me { background: var(--accent); }
.track i.gh { box-shadow: inset 0 0 0 1.5px var(--accent); }
.scale { display: flex; justify-content: space-between; margin-top: -8px; color: var(--quiet); font-size: 11px; }
.ok { margin: 0; color: var(--ok); }
/* To check: a field each, its kind printed as the top edge (orange = act on it, blue = worth a look). */
.alert { display: flex; flex-direction: column; gap: 2px; margin-bottom: 2px; padding: 10px 12px; background: var(--raised); box-shadow: inset 0 3px 0 var(--c); }
.alert.warn { box-shadow: inset 0 3px 0 var(--warn); }
.alert .dot { display: none; }
.alert div { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.alert strong { font: 600 condensed 14px var(--display); color: var(--text); }
.alert span { color: var(--label); font-size: 12px; }

.table-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; }
.table-head h3 { margin: 0; }
.chip {
  height: 26px; padding: 0 10px; border-radius: 4px; border: 1px solid var(--line-strong); background: none;
  color: var(--text-2); font: 12px var(--body); cursor: pointer;
}
.chip:hover { border-color: var(--accent); color: var(--text); }
/* Quick scrap rates: the one in use outlined in pawn yellow, like a pressed filter chip. */
.scrap-rates { display: inline-flex; flex-wrap: wrap; gap: 4px; }
.rate-chip { padding: 0 8px; font: 600 12px var(--display); font-variant-numeric: tabular-nums; }
.rate-chip[aria-pressed="true"] { border-color: var(--accent); color: var(--text); background: var(--accent-soft); }
.table-wrap { overflow-x: auto; }
table { width: 100%; border-collapse: collapse; font-size: 12px; }
th { text-align: left; padding: 6px 8px; color: var(--label); font: 600 condensed 12px var(--display); border-bottom: 1px solid var(--line); white-space: nowrap; }
th.num, td.num { text-align: right; }
.sort { all: unset; cursor: pointer; }
.sort:hover { color: var(--text); }
td { padding: 5px 8px; border-bottom: 1px solid var(--line-soft); white-space: nowrap; }
tr.moon td { background: rgba(15,20,27,0.35); color: var(--text-2); }
tbody tr:hover td { background: var(--hover); }
td.name a { color: var(--text); text-decoration: none; font-weight: 700; }
td.name a:hover { color: var(--accent-hi); }
tr.moon td.name a { font-weight: 400; color: var(--text-2); }
.coords { margin-left: 6px; color: var(--muted); font: condensed 12px var(--display); }
.tag { margin-left: 6px; padding: 0 5px; border-radius: 3px; box-shadow: inset 0 0 0 1px var(--warn); color: var(--warn); font-size: 11px; }
td.m { color: var(--m); } td.c { color: var(--c); } td.d { color: var(--d); }
td.full { color: var(--warn) !important; font-weight: 700; }
.age.fresh { color: var(--fresh); } .age.warm { color: var(--warm); } .age.old { color: var(--old); }
tfoot td { border-top: 1px solid var(--line); border-bottom: 0; font-weight: 700; }

/* The investment ladder: one printed rung per step, its cost in tokens, the payback large on the right.
   The rung under the pointer stays full, the others step down a tone. */
.move { display: flex; align-items: center; gap: 10px; padding: 8px 10px; background: var(--raised); transition: opacity 140ms ease; }
.move + .move { margin-top: 2px; }
/* The full list (Investimenti): two columns, rungs packed, 2px seams. */
.ladder { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 2px; }
.ladder .move { margin: 0; padding: 7px 10px; }
.ladder .move .pic { width: 24px !important; height: 24px !important; }
.ladder .roi { font-size: 19px; }
@media (max-width: 900px) { .ladder { grid-template-columns: 1fr; } }
@media (hover: hover) and (pointer: fine) { .card:hover > .move:not(:hover) { opacity: 0.72; } }
.move .n { width: 22px; height: 22px; flex-shrink: 0; border-radius: 50%; background: var(--accent); color: var(--on-accent); font: 600 condensed 12px var(--display); display: flex; align-items: center; justify-content: center; }
.move-text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.move-text strong { font: 600 condensed 14px var(--display); color: var(--text); }
.move-text .meta { display: flex; align-items: center; flex-wrap: wrap; gap: 4px 6px; color: var(--label); font-size: 12px; white-space: nowrap; }
.cost { display: inline-flex; flex-wrap: wrap; gap: 4px 10px; }
.cost > span { display: inline-flex; align-items: center; gap: 4px; color: var(--text-2); }
.roi { flex: none; font: 600 condensed 22px/1 var(--display); color: var(--text); white-space: nowrap; text-align: right; }
.roi small { margin-left: 3px; font: 12px var(--body); color: var(--label); }
td.queue { white-space: nowrap; }
.q { display: inline-block; margin-right: 4px; padding: 1px 6px; border-radius: 4px; font-size: 11px; border: 1px solid color-mix(in srgb, currentColor 45%, transparent); background: none; }
.q-building { color: var(--q-building); } .q-research { color: var(--q-research); } .q-ship { color: var(--q-ship); }
.q-lfbuilding { color: var(--q-lfbuilding); } .q-lfresearch { color: var(--q-lfresearch); }
.tab-body { display: flex; flex-direction: column; gap: 12px; min-width: 0; }

/* Level tables: first column stays put while the rest scrolls. */
.matrix th.col { vertical-align: bottom; white-space: normal; min-width: 44px; max-width: 74px; padding: 6px 4px; line-height: 1.2; }
.matrix th.col .pic { margin-left: auto; }
/* The game's pictures: column heads, rows, tiles. */
.pic { display: block; flex: none; border-radius: 4px; object-fit: cover; background: var(--line-soft); }
span.pic { display: inline-block !important; }
.tech-label { display: flex; align-items: center; gap: 8px; min-width: 0; }
.tech-label span:not(.pic) { overflow: hidden; text-overflow: ellipsis; }
.tech-label small { color: var(--muted); font-size: 11px; }
.matrix .col-name { display: block; font-size: 10px; font-weight: 600; color: var(--muted); text-decoration: none; overflow-wrap: normal; hyphens: auto; }
.matrix a.col-name:hover { color: var(--text); }
.matrix th.col.on .col-name { color: var(--accent); }
.matrix th.col.on { box-shadow: inset 0 -2px 0 var(--accent); }
.matrix td { padding: 4px 6px; }
.matrix th.name, .matrix td.name { position: sticky; left: 0; z-index: 1; background: var(--raised); }
.matrix tr.moon td.name { background: var(--raised); }
.matrix td.tech { color: var(--text-2); font-weight: 400; max-width: 260px; overflow: hidden; text-overflow: ellipsis; }
td.zero { color: var(--faint); }
td.top { color: var(--accent); }
td.off { opacity: 0.55; }
td.guess { font-style: italic; opacity: 0.7; }
.unit-ico { width: 28px; height: 28px; border-radius: 4px; object-fit: cover; display: block; margin: 0 auto; background: var(--line-soft); }
.unit-ico-none { display: flex; align-items: center; justify-content: center; color: var(--muted); font-size: 10px; }

/* Lifeforms: same width for every planet, whatever its name; long names wrap on two lines at most. */
.matrix.lf { table-layout: fixed; min-width: calc(230px + var(--cols, 1) * 52px); }
.matrix.lf col.name-col { width: 230px; }
.matrix.lf th.col { min-width: 0; max-width: none; }
.matrix.lf .col-name { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; text-align: right; overflow-wrap: anywhere; hyphens: none; }
.matrix.lf td.tech { max-width: none; }
.matrix.lf td { padding-top: 2px; padding-bottom: 2px; }

/* Research: one tile per technology, its picture over its level. */
.levels { display: grid; grid-template-columns: repeat(auto-fill, minmax(52px, 1fr)); gap: 2px; }
.lv { display: flex; flex-direction: column; align-items: center; gap: 3px; padding: 6px 2px 5px; background: var(--raised); min-width: 0; }
.lv b { font: 600 condensed 14px var(--display); color: var(--text); }
.lv .lv-name { height: 40px; display: flex; align-items: center; text-align: center; color: var(--text-2); font-size: 10px; line-height: 1.15; overflow: hidden; }
.lv.zero { opacity: 0.45; } .lv.zero b { color: var(--muted); }
.move .pic { border-radius: 5px; }
.head-toggle { display: inline-flex; align-items: center; gap: 6px; padding: 0; border: 0; background: none; color: inherit; font: inherit; cursor: pointer; }
.head-toggle:hover, .head-toggle:focus-visible { color: var(--accent); }
.needs { margin: 0 0 8px; padding: 10px 12px; background: var(--surface); box-shadow: inset 0 3px 0 var(--warn); color: var(--text-2); font-size: 12px; }
.needs p { margin: 4px 0; display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
.needs .chip { display: inline-flex; align-items: center; height: 22px; text-decoration: none; }
.move-text .guess { color: var(--warm); font-style: normal; }
.move-text .ok { color: var(--fresh); font-style: normal; }
.move.done { opacity: 0.55; }
.pls { display: flex; flex-wrap: wrap; gap: 4px; margin: 3px 0 2px; }
.pl { display: inline-flex; align-items: center; height: 20px; padding: 0 7px; border: 1px solid var(--line-strong); border-radius: 3px; background: none; color: var(--text-2); font-size: 12px; text-decoration: none; white-space: nowrap; }
.pl.more { cursor: pointer; font: inherit; font-size: 12px; }
.pl:hover, .pl:focus-visible { border-color: var(--accent); color: var(--text); }
/* Estimated levels: a dashed amber edge (the title says why), the name stays readable. */
.move-text .pl.guess:not(.done) { border-style: dashed; border-color: var(--accent-line); color: var(--text-2); }
.move-text .pl.guess:not(.done):hover, .move-text .pl.guess:not(.done):focus-visible { border-color: var(--accent); color: var(--text); }
.pl.done { color: var(--quiet); text-decoration: line-through; border-style: dashed; }

/* Planets | moons switch on the ships and defence pages. */
.seg { display: inline-flex; border: 1px solid var(--line); border-radius: 7px; overflow: hidden; }
.seg button { display: inline-flex; align-items: center; gap: 6px; height: 28px; padding: 0 12px; border: 0; background: var(--bg); color: var(--muted); font: 12px var(--body); cursor: pointer; }
.seg button + button { border-left: 1px solid var(--line); }
.seg button i { font-style: normal; font-size: 11px; color: var(--muted); }
.seg button:hover { color: var(--text); }
.seg button[aria-pressed="true"] { background: var(--accent-soft); color: var(--text); font-weight: 700; box-shadow: inset 0 -2px 0 var(--accent); }
.seg button[aria-pressed="true"] i { color: var(--accent); font-weight: 400; }
.seg button i { margin-left: 2px; }
.seg .seg-ico { flex: none; color: var(--muted); }
.seg button[aria-pressed="true"] .seg-ico { color: var(--text); }


/* Scrap calculator */
.scrap-bar { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin: 8px 0; }
.field { height: 28px; padding: 0 8px; border: 1px solid var(--line); border-radius: 6px; background: var(--surface); color: var(--text); font: 12px var(--body); }
.field:focus { border-color: var(--accent); outline: none; }
.field-label { display: inline-flex; align-items: center; gap: 6px; color: var(--muted); font-size: 12px; }
.field.rate { width: 44px; text-align: center; }
.field.qty { width: 110px; text-align: right; font-family: "JetBrains Mono", Consolas, monospace; }
/* Rottamatore: ships and defences side by side, denser rows, one shared total underneath. */
.scrap-cols { display: grid; grid-template-columns: repeat(auto-fit, minmax(460px, 1fr)); gap: 12px; align-items: start; }
table.scrap { width: 100%; }
table.scrap th, table.scrap td { padding: 2px 6px; }
table.scrap .field.qty { width: 74px; height: 24px; }
table.scrap .unit-label span { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.scrap-total { display: flex; flex-wrap: wrap; align-items: baseline; gap: 6px 20px; margin-top: 8px; padding: 8px 10px; background: var(--raised); box-shadow: inset 0 2px 0 var(--accent); }
.scrap-total .name { font: 600 condensed 14px var(--display); color: var(--text); }
.scrap-total .part { display: inline-flex; align-items: baseline; gap: 6px; }
.scrap-total small { color: var(--label); font-size: 11px; }
.scrap-total b { font: 600 condensed 16px var(--display); }
.scrap-total b.m { color: var(--m); } .scrap-total b.c { color: var(--c); } .scrap-total b.d { color: var(--d); }
.scrap-total .msu { margin-left: auto; color: var(--text); }
table.scrap td.unit { padding: 1px 6px 1px 2px; }
table.scrap .unit-label { display: flex; align-items: center; gap: 8px; width: 100%; padding: 2px 8px 2px 2px; border: 1px solid transparent; border-radius: 6px; background: none; color: var(--text-2); font: 12px var(--body); text-align: left; cursor: pointer; }
table.scrap .unit-label:hover { border-color: var(--line); color: var(--text); }
table.scrap .unit-label[aria-pressed="true"] { border-color: var(--accent); background: var(--accent-soft); color: var(--text); }
.msu { color: var(--accent); margin-left: 4px; }
@media (max-width: 1100px) { .kpis { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
@media (max-width: 900px) {
  .kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .cols { grid-template-columns: 1fr; }
    }
.charts { grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 12px; margin-top: 12px; }
.chart { margin: 0; padding: 12px 14px; background: var(--surface); }
.chart figcaption { margin-bottom: 6px; color: var(--text); font: 600 condensed 14px var(--display); }
.plot { position: relative; }
.chart svg { display: block; width: 100%; height: auto; overflow: visible; }
.chart .grid { stroke: var(--line-soft); stroke-width: 1; }
.chart .axis { fill: var(--muted); font: 10px var(--mono); }
.chart .line { fill: none; stroke: var(--accent); stroke-width: 2; stroke-linejoin: round; stroke-linecap: round; }
.chart .cross { stroke: var(--faint); stroke-width: 1; }
.chart .dot { fill: var(--accent); stroke: var(--surface); stroke-width: 2; }
.chart .tip { position: absolute; top: -4px; transform: translateX(-50%); padding: 3px 7px; border-radius: 3px; background: var(--raised); border: 1px solid var(--line); color: var(--text); font: 11px var(--mono); white-space: nowrap; pointer-events: none; }
.kpi .value.neg, td.neg { color: var(--bad); }
td.pos { color: var(--ok); }
table.queues td.kind { color: var(--muted); }
/* Queues on one hour scale: the tape's length is the time still needed, in the game's queue colour. */
table.queues td.left, table.queues th.left { width: 38%; }
.tape { height: 12px; background: var(--line-soft); }
.tape i { display: block; height: 100%; background: color-mix(in srgb, currentColor 30%, transparent); box-shadow: inset 0 0 0 1px currentColor; }
.tape.q-building { color: var(--q-building); } .tape.q-research { color: var(--q-research); } .tape.q-ship { color: var(--q-ship); }
.tape.q-lfbuilding { color: var(--q-lfbuilding); } .tape.q-lfresearch { color: var(--q-lfresearch); }
.hours { display: flex; justify-content: space-between; color: var(--quiet); font: 11px var(--body); }
table.queues td.acts { width: 1%; text-align: right; }
.fut-bell { display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 24px; border-radius: 6px; border: 1px solid var(--line); background: var(--bg); color: var(--muted); cursor: pointer; }
.fut-bell:hover, .fut-bell:focus-visible { border-color: var(--accent); color: var(--text); }
.fut-bell.on { border-color: var(--accent); background: var(--accent-soft); color: var(--accent); }
`;
