/**
 * The look shared by every Future window (Shadow DOM): colour tokens, the backdrop and panel,
 * the header with its close button, underline tabs, the key-number strip, sections, buttons,
 * empty states and the browser surfaces (focus, scrollbars, selection, numerals).
 * Each window adds only its own rules and sets its width with `--panel-w`.
 */
/** Resource colours, the same in the planet menu, the windows and the inbox. */
export const RES_COLORS = { metal: '#B8C2CC', crystal: '#7FB8FF', deuterium: '#4FE0B0', darkMatter: '#B58CDB', food: '#D6A8C8' };

/** State colours, one value each everywhere: cyan = chosen, green = fine (not the deuterium green), amber = look at it, red = missing or lost. */
export const STATE_COLORS = { accent: '#4FD1E8', ok: '#7BC47F', warn: '#F5B547', bad: '#F07A6E' };

/**
 * The tokens of what Future draws inside the game's own pages (inbox, fleet bar, Orion): the game's
 * Verdana 11px world, text at 4.5:1 or more on the game's dark panels. Each surface adds its own
 * --line and extras; these names and values are shared.
 */
export const PAGE_TOKENS = `--hi: #F1F4F7; --txt: #C9D2DC; --mute: #A3AFBD; --dim: #8592A1;
  --accent: ${STATE_COLORS.accent}; --ok: ${STATE_COLORS.ok}; --warn: ${STATE_COLORS.warn}; --neg: ${STATE_COLORS.bad};`;

/**
 * The window palette: the planet menu's dark tiles, grey labels, cyan for what is chosen.
 * Text greys from bright to quiet: --text, --text-2, --label, --muted, --quiet (every one 4.5:1 or more on --raised).
 * Age of a reading (galaxy, targets, planets): --fresh, --warm, --old.
 * Queue kinds use the game's own queue colours (--q-*), so they read as they do in OGame.
 */
const SURFACE_TOKENS = '--bg: #0B121D; --surface: #0D1522; --raised: #111B2A;';
const LINE_TOKENS = '--line: #1F2C40; --line-soft: #16202F; --faint: #4A5B72;';
/** Hairline a step stronger, for tooltips and badges that sit on a tile. */
const STRONG_LINE = '--line-strong: #2C3E57; --line-hover: #47607D; --accent-line: #2C5A73; --hover: #1D3350;';
const TEXT_TOKENS = `--text: #E6EDF5; --text-2: #C9D4E2; --label: #9AA9BC; --muted: #8A9BB0; --quiet: #708A9D;
  --accent-hi: #8BE4F2; --link: #6F9FC8;
  --q-building: #FF8200; --q-research: #32FB2F; --q-ship: #FFEB00; --q-lfbuilding: #FF79BD; --q-lfresearch: #42AFFF;
  --m: ${RES_COLORS.metal}; --c: ${RES_COLORS.crystal}; --d: ${RES_COLORS.deuterium}; --dm: ${RES_COLORS.darkMatter};
  --fresh: #38C56E; --warm: #E3BB28; --old: #EF7676;
  --accent: ${STATE_COLORS.accent}; --accent-soft: #12283A; --warn: ${STATE_COLORS.warn}; --ok: ${STATE_COLORS.ok}; --bad: ${STATE_COLORS.bad};
  --ease-out: cubic-bezier(0.23, 1, 0.32, 1);`;
/** Every window token, for surfaces outside the windows that speak the same language (planet menu, galaxy, side bar). */
export const WINDOW_TOKENS = `${SURFACE_TOKENS} ${LINE_TOKENS} ${STRONG_LINE}
  ${TEXT_TOKENS}`;
/** The same without the hairline tokens, for surfaces that keep their own --line (inbox, fleet bar, Orion). */
export const WINDOW_TOKENS_NO_LINES = `${SURFACE_TOKENS} ${STRONG_LINE}
  ${TEXT_TOKENS}`;

export const WINDOW_SHEET = `
:host {
  all: initial;
  ${WINDOW_TOKENS}
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
  animation: fut-panel-in 200ms var(--ease-out);
}
/* Opening: the window settles in from just below, the page dims behind it. Closing is instant. */
.backdrop { animation: fut-fade-in 160ms var(--ease-out); }
@keyframes fut-panel-in { from { opacity: 0; transform: translateY(6px) scale(0.985); } }
@keyframes fut-fade-in { from { opacity: 0; } }
@media (prefers-reduced-motion: reduce) { .panel { animation-name: fut-fade-in; } }
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
.kpi .label { color: var(--muted); font-size: 11px; }
.kpi .value { font: 700 15px/18px var(--mono); color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.kpi .note, .kpi .detail { color: var(--muted); font-size: 11px; }
.kpi.accent .value { color: var(--accent); }
.kpi.warn .value { color: var(--warn); }

/* Sections: tiles, like the planet rows. */
.card { padding: 8px 10px; border: 1px solid var(--line); border-radius: 7px; background: var(--raised); min-width: 0; }
/* On/off switch: a track with a knob, lit and to the right when on (a checked input before it, or aria-checked on its button). */
.sw-track { position: relative; flex: none; width: 30px; height: 16px; border-radius: 8px; background: var(--faint); transition: background-color 120ms ease-out; }
.sw-track::after { content: ""; position: absolute; top: 2px; left: 2px; width: 12px; height: 12px; border-radius: 50%; background: var(--text-2); transition: transform 120ms ease-out; }
input:checked + .sw-track, [aria-checked="true"] > .sw-track { background: var(--accent); }
input:checked + .sw-track::after, [aria-checked="true"] > .sw-track::after { transform: translateX(14px); background: var(--bg); }
@media (prefers-reduced-motion: reduce) { .sw-track, .sw-track::after { transition: none; } }
.hint { margin: 6px 0 0; color: var(--muted); font-size: 11px; }
.empty { margin: 0; padding: 14px; text-align: center; color: var(--muted); border: 1px dashed var(--line); border-radius: 7px; }

/* Buttons: the settings chips. One filled action, ghost for the rest. */
.act { height: 24px; padding: 0 10px; border: 1px solid #2B6F7D; border-radius: 5px; background: var(--accent-soft); color: var(--text); font: 700 11px Arial, sans-serif; cursor: pointer; }
.act:hover { border-color: var(--accent); }
.act.ghost { border-color: var(--line); background: #0A111C; color: #B4C2D3; font-weight: 400; }
.act.ghost:hover, .act.danger { border-color: var(--bad); color: var(--bad); }
/* Press feedback: anything pressable gives a little under the pointer. */
.act, .tab, .close, .seg button { transition: transform 140ms var(--ease-out); }
.act:active, .tab:active, .close:active, .seg button:active { transform: scale(0.97); }
@media (prefers-reduced-motion: reduce) { .act:active, .tab:active, .close:active, .seg button:active { transform: none; } }
/* A checkbox drawn as the switch: the input stays for keyboard and screen readers, the track shows. */
input.sw { position: absolute; opacity: 0; pointer-events: none; }
input.sw:focus-visible + .sw-track { outline: 2px solid var(--accent); outline-offset: 2px; }

/* Browser surfaces. */
button:focus-visible, a:focus-visible, input:focus-visible, select:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.backdrop, .scroll, .table-wrap { scrollbar-color: #2A3B55 var(--bg); scrollbar-width: thin; }
::selection { background: #2B6F7D; color: #fff; }
.num, td, .value, .kpi-line { font-variant-numeric: tabular-nums; }
`;
