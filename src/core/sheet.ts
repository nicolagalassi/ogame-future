/**
 * The look shared by every Future window (Shadow DOM): colour tokens, the backdrop and panel,
 * the header with its close button, underline tabs, the key-number strip, sections, buttons,
 * empty states and the browser surfaces (focus, scrollbars, selection, numerals).
 * Each window adds only its own rules and sets its width with `--panel-w`.
 */
export const WINDOW_SHEET = `
:host {
  all: initial;
  --bg: #0A111C; --surface: #0D1522; --raised: #111B2A; --line: #1F2C40; --line-soft: #16202F;
  --text: #E6EDF5; --text-2: #C9D4E2; --muted: #8A9BB0; --faint: #4A5B72;
  --accent: #4FD1E8; --accent-soft: #12283A; --warn: #F5B547; --ok: #4FE0B0; --bad: #FF7A7A;
  --m: #B8C2CC; --c: #7FB8FF; --d: #4FE0B0; --dm: #B58CDB;
  --mono: "JetBrains Mono", Consolas, monospace;
  --panel-w: 860px;
}
* { box-sizing: border-box; }
.backdrop {
  position: fixed; inset: 0; z-index: 100000; display: flex; justify-content: center; align-items: flex-start;
  padding: 48px 16px; background: rgba(3,6,12,0.72); overflow-y: auto;
  font: 13px/1.4 Arial, Helvetica, sans-serif; color: var(--text);
}
.panel {
  width: min(var(--panel-w), 100%); display: flex; flex-direction: column; gap: 12px; padding: 18px;
  border: 1px solid var(--line); border-radius: 14px; background: var(--bg); box-shadow: 0 20px 60px rgba(0,0,0,0.6);
}
.head { display: flex; align-items: flex-start; gap: 12px; }
.titles { flex: 1; display: flex; flex-direction: column; gap: 2px; min-width: 0; }
h2 { margin: 0; font-size: 20px; font-weight: 700; }
h3 { margin: 0 0 8px; font-size: 14px; font-weight: 700; color: var(--text-2); }
h4 { margin: 12px 0 4px; font-size: 12px; font-weight: 700; color: var(--text-2); }
.sub { color: var(--muted); font-size: 12px; }
.close {
  flex: none; width: 32px; height: 32px; padding: 0; display: inline-flex; align-items: center; justify-content: center;
  border-radius: 8px; border: 1px solid var(--line); background: var(--raised); color: #B4C2D3; line-height: 1; cursor: pointer;
}
.close:hover { border-color: var(--accent); color: var(--text); }
.mono { font-family: var(--mono); }
.m { color: var(--m); } .c { color: var(--c); } .d { color: var(--d); } .dm { color: var(--dm); }
.neg { color: var(--bad); } .pos { color: var(--ok); }

/* Tabs: an underline under the one in use. */
.tabs { display: flex; flex-wrap: wrap; gap: 0; border-bottom: 1px solid var(--line); }
.tab { padding: 7px 12px; margin-bottom: -1px; border: 0; border-bottom: 2px solid transparent; background: none; color: var(--muted); font: 13px Arial, sans-serif; cursor: pointer; }
.tab:hover { color: var(--text); }
.tab[aria-pressed="true"] { border-bottom-color: var(--accent); color: var(--text); font-weight: 700; }

/* Key numbers: one strip split by hairlines. */
.kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 0; border: 1px solid var(--line); border-radius: 10px; background: var(--surface); overflow: hidden; }
.kpi { display: flex; flex-direction: column; gap: 3px; padding: 10px 12px; min-width: 0; box-shadow: 1px 0 0 var(--line), 0 1px 0 var(--line); }
.kpi .label { color: var(--muted); font-size: 12px; }
.kpi .value { font-size: 20px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.kpi .note, .kpi .detail { color: var(--muted); font-size: 11px; }
.kpi.accent .value { color: var(--accent); }
.kpi.warn .value { color: var(--warn); }

/* Sections, not cards inside the window: a hairline on top and air around. */
.card { padding: 12px 0 4px; border-top: 1px solid var(--line); min-width: 0; }
.hint { margin: 6px 0 0; color: var(--muted); font-size: 11px; }
.empty { margin: 0; padding: 18px; text-align: center; color: var(--muted); border: 1px dashed var(--line); border-radius: 10px; }

/* Buttons: one filled action, ghost for the rest. */
.act { padding: 5px 10px; border: 1px solid #2B6F7D; border-radius: 6px; background: #0F2A33; color: var(--text); font: 700 12px Arial, sans-serif; cursor: pointer; }
.act:hover { border-color: var(--accent); }
.act.ghost { border-color: var(--line); background: none; color: var(--muted); font-weight: 400; }
.act.ghost:hover, .act.danger { border-color: var(--bad); color: var(--bad); }

/* Browser surfaces. */
button:focus-visible, a:focus-visible, input:focus-visible, select:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
.backdrop, .scroll, .table-wrap { scrollbar-color: #2A3B55 var(--bg); scrollbar-width: thin; }
::selection { background: #2B6F7D; color: #fff; }
.num, td, .value, .kpi-line { font-variant-numeric: tabular-nums; }
`;
