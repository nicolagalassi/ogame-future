/**
 * The look shared by every Future window (Shadow DOM): colour tokens, the backdrop and panel,
 * the header with its close button, underline tabs, the key-number strip, sections, buttons,
 * empty states and the browser surfaces (focus, scrollbars, selection, numerals).
 * Each window adds only its own rules and sets its width with `--panel-w`.
 */
export const WINDOW_SHEET = `
:host {
  all: initial;
  --bg: #0B121D; --surface: #0D1522; --raised: #111B2A; --line: #1F2C40; --line-soft: #16202F;
  --text: #E6EDF5; --text-2: #C9D4E2; --muted: #8A9BB0; --faint: #4A5B72;
  --accent: #4FD1E8; --accent-soft: #12283A; --warn: #F5B547; --ok: #4FE0B0; --bad: #FF7A7A;
  --m: #B8C2CC; --c: #7FB8FF; --d: #4FE0B0; --dm: #B58CDB;
  --mono: Consolas, "JetBrains Mono", monospace;
  --panel-w: 860px;
}
* { box-sizing: border-box; }
.backdrop {
  position: fixed; inset: 0; z-index: 1000001; display: flex; justify-content: center; align-items: flex-start;
  padding: 40px 16px; background: rgba(3,6,12,0.72); overflow-y: auto;
  font: 12px/1.35 Arial, Helvetica, sans-serif; color: var(--text-2);
}
/* The planet menu's language: a dark column of tiles (#111B2A, hairline #1F2C40, 6-7px corners),
   small grey labels, monospace numbers, cyan for what is selected. */
.panel {
  width: min(var(--panel-w), 100%); display: flex; flex-direction: column; gap: 8px; padding: 8px;
  border: 1px solid var(--line); border-radius: 9px; background: var(--bg); box-shadow: 0 20px 60px rgba(0,0,0,0.6);
}
.head { display: flex; align-items: center; gap: 10px; min-height: 38px; padding: 4px 4px 4px 12px; border: 1px solid var(--line); border-radius: 7px; background: var(--raised); }
.titles { flex: 1; display: flex; align-items: baseline; flex-wrap: wrap; gap: 2px 10px; min-width: 0; }
h2 { margin: 0; font-size: 14px; font-weight: 700; color: var(--text); }
h3 { margin: 0 0 6px; font-size: 12px; font-weight: 700; color: var(--text); }
h4 { margin: 10px 0 4px; font-size: 11px; font-weight: 700; color: var(--text-2); }
.sub { color: var(--muted); font-size: 11px; }
.close {
  flex: none; width: 28px; height: 28px; padding: 0; display: inline-flex; align-items: center; justify-content: center;
  border-radius: 5px; border: 0; background: none; color: var(--muted); line-height: 1; cursor: pointer;
}
.close:hover { background: #16243A; color: var(--text); }
.mono { font-family: var(--mono); }
.m { color: var(--m); } .c { color: var(--c); } .d { color: var(--d); } .dm { color: var(--dm); }
.neg { color: var(--bad); } .pos { color: var(--ok); }

/* Tabs: one segmented strip, the one in use lit like the selected planet. */
.tabs { display: flex; flex-wrap: wrap; gap: 0; border: 1px solid var(--line); border-radius: 7px; background: var(--bg); overflow: hidden; }
.tab { flex: 1 0 auto; height: 28px; padding: 0 12px; border: 0; border-right: 1px solid var(--line); background: none; color: var(--muted); font: 12px Arial, sans-serif; cursor: pointer; }
.tab:last-child { border-right: 0; }
.tab:hover { background: #111D2D; color: var(--text); }
.tab[aria-pressed="true"] { background: var(--accent-soft); color: var(--text); font-weight: 700; box-shadow: inset 0 -2px 0 var(--accent); }

/* Key numbers: the planet menu toolbar, one cell each. */
.kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 0; border: 1px solid var(--line); border-radius: 7px; background: var(--raised); overflow: hidden; }
.kpi { display: flex; flex-direction: column; gap: 1px; padding: 6px 10px 7px; min-width: 0; box-shadow: 1px 0 0 var(--line), 0 1px 0 var(--line); }
.kpi .label { color: var(--muted); font-size: 10px; }
.kpi .value { font: 700 15px/18px var(--mono); color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.kpi .note, .kpi .detail { color: var(--muted); font-size: 10px; }
.kpi.accent .value { color: var(--accent); }
.kpi.warn .value { color: var(--warn); }

/* Sections: tiles, like the planet rows. */
.card { padding: 8px 10px; border: 1px solid var(--line); border-radius: 7px; background: var(--raised); min-width: 0; }
.hint { margin: 6px 0 0; color: var(--muted); font-size: 10px; }
.empty { margin: 0; padding: 14px; text-align: center; color: var(--muted); border: 1px dashed var(--line); border-radius: 7px; }

/* Buttons: the settings chips. One filled action, ghost for the rest. */
.act { height: 24px; padding: 0 10px; border: 1px solid #2B6F7D; border-radius: 5px; background: var(--accent-soft); color: var(--text); font: 700 11px Arial, sans-serif; cursor: pointer; }
.act:hover { border-color: var(--accent); }
.act.ghost { border-color: var(--line); background: #0A111C; color: #B4C2D3; font-weight: 400; }
.act.ghost:hover, .act.danger { border-color: var(--bad); color: var(--bad); }

/* Browser surfaces. */
button:focus-visible, a:focus-visible, input:focus-visible, select:focus-visible { outline: 1px solid var(--accent); outline-offset: 1px; }
.backdrop, .scroll, .table-wrap { scrollbar-color: #2A3B55 var(--bg); scrollbar-width: thin; }
::selection { background: #2B6F7D; color: #fff; }
.num, td, .value, .kpi-line { font-variant-numeric: tabular-nums; }
`;
