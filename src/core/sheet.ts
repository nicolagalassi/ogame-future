/**
 * The look shared by every Future window (Shadow DOM): colour tokens, the backdrop and panel,
 * the header with its close button, underline tabs, the key-number strip, sections, buttons,
 * empty states and the browser surfaces (focus, scrollbars, selection, numerals).
 * Each window adds only its own rules and sets its width with `--panel-w`.
 */
/** Resource colours, the same in the planet menu, the windows and the inbox. */
export const RES_COLORS = { metal: '#B8C2CC', crystal: '#7FB8FF', deuterium: '#4FE0B0', darkMatter: '#B58CDB', food: '#D6A8C8' };

/** State colours, one value each everywhere: the player's yellow pawn = chosen / you are here, green = fine (not the deuterium green), orange = look at it, red = missing or lost. */
export const STATE_COLORS = { accent: '#F2D04A', ok: '#7BC47F', warn: '#F08A3C', bad: '#EF6A60' };

/**
 * The tokens of what Future draws inside the game's own pages (inbox, fleet bar, Orion): the game's
 * Verdana 11px world, text at 4.5:1 or more on the game's dark panels. Each surface adds its own
 * --line and extras; these names and values are shared.
 */
export const PAGE_TOKENS = `--hi: #F1F4F7; --txt: #C9D2DC; --mute: #A3AFBD; --dim: #8592A1;
  --accent: ${STATE_COLORS.accent}; --ok: ${STATE_COLORS.ok}; --warn: ${STATE_COLORS.warn}; --neg: ${STATE_COLORS.bad};`;

/**
 * The player's board (DESIGN: «Plancia del giocatore»): a dark printed board on a darker ground, a board-blue
 * band for heads and tab strips, warm print ink, the yellow pawn for what is chosen. Zones are fields of
 * colour, never bordered boxes.
 * Text greys from bright to quiet: --text, --text-2, --label, --muted, --quiet (every one 4.5:1 or more on --raised).
 * Age of a reading (galaxy, targets, planets): --fresh, --warm, --old.
 * Queue kinds use the game's own queue colours (--q-*), so they read as they do in OGame.
 */
const SURFACE_TOKENS = '--bg: #0F141B; --surface: #1A2230; --raised: #151C26; --band: #1B2A44; --band-2: #22314D;';
const LINE_TOKENS = '--line: #263142; --line-soft: #1D2531; --faint: #4A5566;';
/** Hairline a step stronger, for tooltips and badges that sit on a tile. */
const STRONG_LINE = '--line-strong: #33415A; --line-hover: #56657C; --accent-line: #8A7420; --hover: #212B3A;';
const TEXT_TOKENS = `--text: #ECE6D6; --text-2: #D2CCBE; --label: #A9B2BE; --muted: #9AA3AE; --quiet: #8A95A3; --on-band: #D3DAE4;
  --accent-hi: #F7DF7A; --on-accent: #1A1606; --link: #8FB4D8;
  --q-building: #FF8200; --q-research: #32FB2F; --q-ship: #FFEB00; --q-lfbuilding: #FF79BD; --q-lfresearch: #42AFFF;
  --m: ${RES_COLORS.metal}; --c: ${RES_COLORS.crystal}; --d: ${RES_COLORS.deuterium}; --dm: ${RES_COLORS.darkMatter};
  --fresh: #38C56E; --warm: #E3BB28; --old: #EF7676;
  --accent: ${STATE_COLORS.accent}; --accent-soft: #2A2614; --warn: ${STATE_COLORS.warn}; --ok: ${STATE_COLORS.ok}; --bad: ${STATE_COLORS.bad};
  --ease-out: cubic-bezier(0.23, 1, 0.32, 1);
  --display: 'Future Barlow', Bahnschrift, "DIN Alternate", "Roboto Condensed", "sans-serif-condensed", "Liberation Sans Narrow", "Arial Narrow", "Open Sans Condensed", "Fira Sans Condensed", "DejaVu Sans Condensed", sans-serif;
  --body: "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;`;
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
  --mono: var(--display);
  --panel-w: 860px;
}
* { box-sizing: border-box; }
.backdrop {
  position: fixed; inset: 0; z-index: 1000001; display: flex; justify-content: center; align-items: flex-start;
  padding: 40px 16px; background: rgba(4,6,10,0.74); overflow-y: auto;
  font: 13px/1.4 var(--body); color: var(--text-2);
}
/* The board: one printed sheet, its head and tab strip on the board-blue band, the zones below as fields of colour. */
.panel {
  width: min(var(--panel-w), 100%); display: flex; flex-direction: column; gap: 10px; padding: 0 0 14px;
  border-radius: 6px; background: var(--raised); box-shadow: 0 24px 64px rgba(0,0,0,0.6); overflow: hidden;
  animation: fut-panel-in 200ms var(--ease-out);
}
.panel > :not(.head):not(.tabs) { margin-left: 14px; margin-right: 14px; }
/* Opening: the window settles in from just below, the page dims behind it. Closing is instant. */
.backdrop { animation: fut-fade-in 160ms var(--ease-out); }
@keyframes fut-panel-in { from { opacity: 0; transform: translateY(6px) scale(0.985); } }
@keyframes fut-fade-in { from { opacity: 0; } }
@media (prefers-reduced-motion: reduce) { .panel { animation-name: fut-fade-in; } }
.head { display: flex; align-items: center; gap: 12px; min-height: 48px; padding: 8px 10px 8px 18px; background: var(--band); }
.head + .tabs { margin-top: -10px; }
.titles { flex: 1; display: flex; align-items: baseline; flex-wrap: wrap; gap: 2px 14px; min-width: 0; }
h2 { margin: 0; font: 600 condensed 19px/1.2 var(--display); color: var(--text); }
h3 { margin: 0 0 8px; font: 600 condensed 15px/1.2 var(--display); color: var(--text); }
h4 { margin: 12px 0 4px; font: 600 condensed 13px/1.2 var(--display); color: var(--text-2); }
.sub { color: var(--on-band); font-size: 12px; }
.close {
  flex: none; width: 30px; height: 30px; padding: 0; display: inline-flex; align-items: center; justify-content: center;
  border-radius: 4px; border: 0; background: none; color: var(--on-band); line-height: 1; cursor: pointer;
}
.close:hover { background: var(--band-2); color: var(--text); }
.mono { font-family: var(--mono); }
.m { color: var(--m); } .c { color: var(--c); } .d { color: var(--d); } .dm { color: var(--dm); }
.neg { color: var(--bad); } .pos { color: var(--ok); }

/* Tabs: printed tabs on the band; the one in use is cut from the board itself, its top edge in pawn yellow. */
.tabs { display: flex; flex-wrap: wrap; gap: 2px; padding: 0 14px; background: var(--band); }
.tab { flex: 0 1 auto; height: 34px; padding: 0 16px; border: 0; border-radius: 5px 5px 0 0; background: var(--band-2); color: var(--on-band); font: 600 condensed 13px var(--display); cursor: pointer; }
.tab:hover { color: var(--text); background: #29395A; }
.tab[aria-pressed="true"] { background: var(--raised); color: var(--text); box-shadow: inset 0 3px 0 var(--accent); }

/* Key numbers: each one printed once, label above, figure in the board's display face. */
.kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 2px; }
.kpi { display: flex; flex-direction: column; gap: 2px; padding: 8px 12px 9px; min-width: 0; background: var(--surface); }
.kpi .label { color: var(--label); font-size: 12px; }
.kpi .value { font: 600 condensed 19px/22px var(--display); color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.kpi .note, .kpi .detail { color: var(--muted); font-size: 12px; }
.kpi.accent .value { color: var(--text); }
.kpi.warn .value { color: var(--warn); }

/* Zones: fields of colour on the board, never bordered boxes. */
.card { padding: 12px 14px; background: var(--surface); min-width: 0; }
/* On/off switch: a track with a knob, lit and to the right when on (a checked input before it, or aria-checked on its button). */
.sw-track { position: relative; flex: none; width: 30px; height: 16px; border-radius: 8px; background: var(--faint); transition: background-color 120ms ease-out; }
.sw-track::after { content: ""; position: absolute; top: 2px; left: 2px; width: 12px; height: 12px; border-radius: 50%; background: var(--text-2); transition: transform 120ms ease-out; }
input:checked + .sw-track, [aria-checked="true"] > .sw-track { background: var(--accent); }
input:checked + .sw-track::after, [aria-checked="true"] > .sw-track::after { transform: translateX(14px); background: var(--on-accent); }
@media (prefers-reduced-motion: reduce) { .sw-track, .sw-track::after { transition: none; } }
.hint { margin: 6px 0 0; color: var(--muted); font-size: 12px; }
.empty { margin: 0; padding: 16px; text-align: center; color: var(--muted); background: var(--surface); }

/* Buttons as printed marks: the one action filled in pawn yellow, the rest a 1px outline; pressed fills, disabled is struck. */
.act { height: 26px; padding: 0 12px; border: 1px solid var(--accent); border-radius: 4px; background: var(--accent); color: var(--on-accent); font: 600 condensed 12px var(--display); cursor: pointer; }
.act:hover { background: var(--accent-hi); border-color: var(--accent-hi); }
.act.ghost { border-color: var(--line-strong); background: none; color: var(--text-2); font-weight: 500; }
.act.ghost:hover { border-color: var(--line-hover); color: var(--text); }
.act.danger, .act.ghost.danger:hover { border-color: var(--bad); background: none; color: var(--bad); }
.act:disabled { border-color: var(--line); background: none; color: var(--quiet); text-decoration: line-through; cursor: default; }
/* Press feedback: anything pressable gives a little under the pointer. */
.act, .tab, .close, .seg button { transition: transform 140ms var(--ease-out); }
.act:active, .tab:active, .close:active, .seg button:active { transform: scale(0.97); }
@media (prefers-reduced-motion: reduce) { .act:active, .tab:active, .close:active, .seg button:active { transform: none; } }
/* A checkbox drawn as the switch: the input stays for keyboard and screen readers, the track shows. */
input.sw { position: absolute; opacity: 0; pointer-events: none; }
input.sw:focus-visible + .sw-track { outline: 2px solid var(--accent); outline-offset: 2px; }

/* Planet / moon picker (core/body-picker.ts): the chosen body on a button, a list with each planet and its moon beside it. */
.bpick { position: relative; display: inline-block; }
.bpick-btn { display: inline-flex; align-items: center; gap: 8px; height: 30px; min-width: 220px; padding: 0 8px 0 10px; border: 1px solid var(--line-strong); border-radius: 4px; background: var(--surface); color: var(--text); font: 13px var(--body); cursor: pointer; }
.bpick-btn b { font-weight: 600; }
.bpick-btn b.none { font-weight: 400; color: var(--muted); }
.bpick-btn small { margin-left: auto; color: var(--muted); font: condensed 12px var(--display); }
.bpick-btn:hover, .bpick-btn[aria-expanded="true"] { border-color: var(--line-hover); }
.bmenu { position: absolute; z-index: 5; top: 34px; right: 0; min-width: 260px; max-height: 320px; overflow-y: auto; overscroll-behavior: contain; display: grid; grid-template-columns: minmax(0, 1fr) 40px; gap: 2px; padding: 4px; border-radius: 4px; background: var(--bg); box-shadow: 0 10px 30px rgba(0,0,0,0.6); }
.bmenu[hidden] { display: none; }
.bmenu.left { left: 0; right: auto; }
.bmenu button { display: flex; align-items: center; gap: 8px; min-height: 30px; padding: 0 8px; border: 0; border-radius: 3px; background: var(--surface); color: var(--text-2); font: 13px var(--body); text-align: left; white-space: nowrap; cursor: pointer; }
.bmenu button.clear { grid-column: 1 / -1; color: var(--muted); }
.bmenu button small { margin-left: auto; color: var(--muted); font: condensed 12px var(--display); }
.bmenu button.moon { justify-content: center; padding: 0; color: var(--muted); }
.bmenu button:hover { background: var(--hover); color: var(--text); }
.bmenu button.on { box-shadow: inset 0 0 0 1px var(--accent); color: var(--text); }
.bmenu button.moon.on { color: var(--accent); }
.bmenu button:disabled { background: none; color: var(--faint); cursor: default; }

/* Browser surfaces. */
/* Number fields without the browser's spin arrows (the keyboard's up / down still step). */
input[type="number"] { appearance: textfield; -moz-appearance: textfield; }
input[type="number"]::-webkit-inner-spin-button, input[type="number"]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
button:focus-visible, a:focus-visible, input:focus-visible, select:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.backdrop, .scroll, .table-wrap { scrollbar-color: var(--line-strong) var(--raised); scrollbar-width: thin; }
::selection { background: #5A4E1A; color: var(--text); }
.num, td, .value, .kpi-line, .roi, .prod-val, .cost, .scale, .hours, .facts { font-variant-numeric: tabular-nums; }
`;
