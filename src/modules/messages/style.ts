/** Inbox summaries (global classes, all prefixed) and expedition journal (Shadow DOM). */
import { RES_COLORS } from '../../core/sheet';

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

/**
 * Pills: tinted outline by default; a bigger find fills the pill (size 1 tinted, size 0 solid),
 * so the brighter the pill, the bigger the find.
 */
/** Expedition size as game rarity, by size index (0 huge, 1 big, 2 normal): epic, rare, common. */
export const RARITY = ['#B57BFF', '#4AA3FF', '#6BD66B'];

const outcomeCss = Object.entries(OUTCOME_COLORS)
  .map(([k, c]) => `.fut-out-${k} { --tone: ${c}; }`)
  .join('\n');

/*
 * One grammar for every report and for today's recap, in the game's own type (Verdana) with
 * tabular figures: [pill] [what it holds] [value in MSU, right-aligned] [actions].
 */
export const MESSAGES_CSS = `
/* One set of tokens for the summaries, the "just read" panel and the spy table. Text tokens keep
   at least 4.5:1 on every background they sit on; --faint is for decoration only (ticks, tracks). */
.fut-msg, .fut-fresh, #fut-spypanel {
  --hi: #F1F4F7; --txt: #C9D2DC; --mute: #A3AFBD; --dim: #8592A1; --faint: #4E5B6A; --line: #2E4356;
  --link: #6F9FC8; --accent: #4FD1E8; --neg: #F07A6E; --warn: #E3B341; --ok: #7BC47F; --ship: #4FE0B0; --on-tone: #0D1116;
}
.fut-msg { display: grid; grid-template-columns: 124px minmax(0, 1fr) minmax(84px, auto) auto; align-items: center; column-gap: 10px;
  box-sizing: border-box; margin: 4px 0 6px; padding: 5px 16px; min-height: 30px;
  border-radius: 0; background: rgba(120, 150, 180, 0.06); cursor: pointer; text-align: left;
  font: 11px/16px Verdana, Arial, Helvetica, sans-serif; color: var(--txt); font-variant-numeric: tabular-nums; }
.fut-msg:hover { background: rgba(120, 150, 180, 0.11); }
.fut-msg:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
.fut-msg-pillcell { display: flex; min-width: 0; }
.fut-pill { --tone: #8A9BB0; display: inline-block; max-width: 100%; box-sizing: border-box; padding: 1px 8px; border-radius: 9px;
  border: 1px solid color-mix(in srgb, var(--tone) 55%, transparent); background: color-mix(in srgb, var(--tone) 9%, transparent);
  color: color-mix(in srgb, var(--tone) 78%, #fff); font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
/* Expedition size as game rarity, on the whole row: an edge, a tint, the value in the colour, the word for big and huge. */
${RARITY.map((c, i) => `.fut-rar-${i} { --rar: ${c}; }`).join(' ')}
.fut-msg[class*="fut-rar-"] { box-shadow: inset 0 1px 0 color-mix(in srgb, var(--rar) 30%, transparent), inset 0 -1px 0 color-mix(in srgb, var(--rar) 30%, transparent); background: color-mix(in srgb, var(--rar) 7%, transparent); }
.fut-msg[class*="fut-rar-"]:hover { background: color-mix(in srgb, var(--rar) 12%, transparent); }
.fut-msg[class*="fut-rar-"] .fut-msg-val b { color: var(--rar); }
.fut-msg.fut-rar-1 { background: color-mix(in srgb, var(--rar) 12%, transparent); box-shadow: inset 0 1px 0 color-mix(in srgb, var(--rar) 60%, transparent), inset 0 -1px 0 color-mix(in srgb, var(--rar) 60%, transparent); }
.fut-msg.fut-rar-0 { background: color-mix(in srgb, var(--rar) 19%, transparent); box-shadow: inset 0 1px 0 var(--rar), inset 0 -1px 0 var(--rar); }
.fut-msg.fut-rar-0 .fut-msg-val b { font-size: 14px; }
.fut-rar-tag { margin-right: 4px; color: var(--rar); font-weight: 700; }
${outcomeCss}
.fut-msg-body { display: flex; flex-wrap: wrap; align-items: center; gap: 2px 12px; min-width: 0; }
/* Resources: the initial in a badge of the resource's colour, so colour is never the only cue. */
.fut-r { display: inline-flex; align-items: center; gap: 5px; white-space: nowrap; }
.fut-r::before { content: attr(data-k); box-sizing: border-box; display: inline-flex; align-items: center; justify-content: center; flex: none;
  min-width: 16px; height: 16px; padding: 0 3px; border-radius: 8px; background: var(--dot); color: var(--on-tone); font-size: 10px; font-weight: 700; line-height: 1; }
.fut-r-m { --dot: ${RES_COLORS.metal}; } .fut-r-c { --dot: ${RES_COLORS.crystal}; } .fut-r-d { --dot: ${RES_COLORS.deuterium}; } .fut-r-f { --dot: ${RES_COLORS.food}; } .fut-r-dm { --dot: ${RES_COLORS.darkMatter}; }
.fut-u { display: inline-flex; align-items: center; gap: 4px; white-space: nowrap; }
.fut-msg-icon { width: 18px; height: 18px; border-radius: 50%; object-fit: cover; flex: none; }
.fut-msg-icon-none { display: inline-flex; align-items: center; justify-content: center; width: 18px; height: 18px; border-radius: 50%; background: #1A2733; font-size: 8px; color: var(--mute); }
.fut-note { white-space: nowrap; color: var(--txt); }
.fut-msg .fut-muted { color: var(--mute); } .fut-msg .fut-warn { color: var(--warn); } .fut-msg .fut-neg { color: var(--neg); }
.fut-msg .fut-item { color: #D08A5B; } .fut-msg .fut-lf { color: #E07BC8; } .fut-msg .fut-art { color: #D4A93A; }
.fut-route { display: inline-flex; flex-wrap: wrap; align-items: center; gap: 0 6px; color: var(--txt); }
.fut-place { display: inline-flex; align-items: center; gap: 3px; white-space: nowrap; }
.fut-msg .fut-coords { color: var(--link); text-decoration: none; }
.fut-msg a.fut-coords:hover, .fut-msg a.fut-coords:focus-visible { color: var(--hi); }
.fut-arrow { flex: none; color: var(--mute); }
.fut-msg-moon { color: var(--mute); }
.fut-depl { display: inline-flex; gap: 2px; margin-left: auto; padding: 2px 0; }
.fut-depl i { width: 4px; height: 10px; border-radius: 1px; background: #26323F; }
.fut-depl i.on { background: var(--mute); }
.fut-msg-val { justify-self: end; display: flex; align-items: baseline; gap: 4px; white-space: nowrap; }
.fut-msg-val b { font-size: 13px; color: var(--hi); }
.fut-msg-val b.fut-neg { color: var(--neg); }
.fut-msg-val b.fut-dm { color: ${RES_COLORS.darkMatter}; }
.fut-msg-val small { font-size: 11px; color: var(--mute); }
.fut-dash { color: var(--dim); }
.fut-msg-acts { display: flex; gap: 4px; }
.fut-msg-acts:empty { display: none; }
.fut-msg a.fut-msg-link { display: inline-flex; align-items: center; height: 24px; padding: 0 10px; border-radius: 12px; border: 1px solid var(--line);
  color: #8FB6D8; text-decoration: none; font-size: 11px; font-weight: 700; white-space: nowrap; }
.fut-msg a.fut-msg-link:hover, .fut-msg a.fut-msg-link:focus-visible { border-color: var(--link); color: var(--hi); outline: none; }
/* Today's recap heads the Expeditions tab with the same columns as the reports below. */
.fut-msg.fut-recap { margin: 0 0 8px; padding: 8px 16px; background: rgba(79, 209, 232, 0.08); box-shadow: inset 0 1px 0 rgba(79, 209, 232, 0.4), inset 0 -1px 0 rgba(79, 209, 232, 0.4); }
.fut-msg.fut-recap:hover { background: rgba(79, 209, 232, 0.13); }
.fut-recap .fut-msg-val b { font-size: 14px; }
/* "Just read": under today's recap, gone after a countdown (paused on hover / focus). */
.fut-fresh { box-sizing: border-box; margin: -8px 0 10px; padding: 0 16px 10px; border-radius: 0; overflow: hidden;
  background: #0E151C; font: 11px/1.35 Verdana, Arial, sans-serif; color: var(--txt); font-variant-numeric: tabular-nums; }
.fut-fresh-timer { height: 3px; margin: 0 -16px 8px; background: #1A2530; }
.fut-fresh-timer i { display: block; height: 100%; background: #F5A623; transform-origin: left center; animation: fut-fresh-countdown linear forwards; }
.fut-fresh:hover .fut-fresh-timer i, .fut-fresh:focus-within .fut-fresh-timer i { animation-play-state: paused; }
@keyframes fut-fresh-countdown { from { transform: scaleX(1); } to { transform: scaleX(0); } }
.fut-fresh-head { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 10px; margin-bottom: 8px; }
.fut-fresh-head > b { font-size: 12px; color: var(--hi); }
.fut-fresh-count { color: var(--mute); }
.fut-rar-chip { padding: 0 7px; border-radius: 9px; border: 1px solid color-mix(in srgb, var(--rar) 60%, transparent);
  background: color-mix(in srgb, var(--rar) 14%, transparent); color: var(--rar); font-weight: 700; white-space: nowrap; }
.fut-fresh-total { margin-left: auto; display: flex; align-items: baseline; gap: 4px; }
.fut-fresh-total b { font-size: 15px; color: var(--hi); }
.fut-fresh-total.fut-neg b { color: var(--neg); }
.fut-fresh-total small { color: var(--mute); font-size: 11px; }
.fut-fresh-close { display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 24px; padding: 0; border: 0; border-radius: 50%; background: none; color: var(--mute); cursor: pointer; }
.fut-fresh-close:hover, .fut-fresh-close:focus-visible { color: var(--hi); background: rgba(120, 150, 180, 0.14); outline: none; }
.fut-fresh-close:focus-visible { outline: 2px solid var(--accent); }
.fut-fresh-res { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 6px; }
.fut-fresh-tile { display: flex; flex-direction: column; gap: 2px; min-width: 0; padding: 7px 9px; border-radius: 4px; background: rgba(120, 150, 180, 0.07); }
.fut-fresh-name { display: flex; align-items: center; gap: 5px; color: var(--mute); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.fut-fresh-name::before { content: ''; width: 7px; height: 7px; border-radius: 50%; background: var(--dot); flex: none; }
.fut-fresh-tile b { font-size: 16px; line-height: 1.2; color: var(--dot); white-space: nowrap; }
.fut-fresh-tile.zero b { color: var(--dim); }
.fut-fresh-ships { display: flex; flex-wrap: wrap; gap: 4px 12px; margin-top: 8px; }
.fut-fresh-ship { display: inline-flex; align-items: center; gap: 4px; white-space: nowrap; color: var(--ship); }
.fut-fresh-ship.fut-neg { color: var(--neg); }
@media (max-width: 640px) { .fut-fresh-res { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 640px) {
  .fut-msg { grid-template-columns: auto minmax(0, 1fr) auto; row-gap: 4px; }
  .fut-msg-body { grid-column: 1 / -1; grid-row: 2; }
  .fut-msg-acts { grid-column: 1 / -1; grid-row: 3; }
}
.msg.fut-msg-folded .msgContent, .msg.fut-msg-folded .msg_content, .msg.fut-msg-folded > .content-box { display: none !important; }

/* Spy table, above the Espionage reports. Same type, tokens and pills as the summaries. */
#fut-spypanel { margin: 0 0 8px; padding: 8px; border-radius: 4px; background: #0A0F14; font: 11px/1.35 Verdana, Arial, sans-serif; color: var(--txt);
  font-variant-numeric: tabular-nums; }
#fut-spypanel button { font: inherit; cursor: pointer; }
#fut-spypanel button:focus-visible, #fut-spypanel a:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
.fut-sp-head { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
#fut-spypanel .fut-sp-title { display: flex; align-items: baseline; gap: 8px; flex: 1 0 100%; box-sizing: border-box; min-height: 28px; padding: 4px 6px;
  border: 0; border-radius: 4px; background: none; color: var(--hi); }
#fut-spypanel .fut-sp-title:hover { background: rgba(120, 150, 180, 0.08); }
.fut-sp-title b { font-size: 13px; }
.fut-sp-title span { color: var(--mute); }
.fut-sp-chev { align-self: center; color: var(--mute); transition: transform 120ms ease-out; }
.fut-sp-title[aria-expanded="false"] .fut-sp-chev { transform: rotate(-90deg); }
@media (prefers-reduced-motion: reduce) { .fut-sp-chev { transition: none; } }
.fut-sp-group { display: inline-flex; }
#fut-spypanel .fut-sp-chip { height: 24px; padding: 0 10px; border: 1px solid var(--line); border-radius: 12px; background: none; color: var(--mute); white-space: nowrap; }
#fut-spypanel .fut-sp-group .fut-sp-chip { border-radius: 0; }
#fut-spypanel .fut-sp-group .fut-sp-chip:first-child { border-radius: 12px 0 0 12px; }
#fut-spypanel .fut-sp-group .fut-sp-chip + .fut-sp-chip { border-left: 0; }
#fut-spypanel .fut-sp-group .fut-sp-chip:last-child { border-radius: 0 12px 12px 0; }
#fut-spypanel .fut-sp-chip:hover { color: var(--hi); border-color: #4A6A86; }
#fut-spypanel .fut-sp-chip[aria-pressed="true"] { background: rgba(79, 209, 232, 0.14); border-color: var(--accent); color: #CFF5FC; }
.fut-sp-row { display: grid; grid-template-columns: minmax(0, 1fr) 62px 80px 56px 56px 156px; gap: 8px; align-items: center;
  min-height: 38px; padding: 4px 8px; border-radius: 4px; }
.fut-sp-list { display: flex; flex-direction: column; gap: 2px; margin-top: 2px; }
.fut-sp-list .fut-sp-row { background: rgba(120, 150, 180, 0.05); }
.fut-sp-list .fut-sp-row:hover { background: rgba(120, 150, 180, 0.1); }
.fut-sp-cols { min-height: 0; margin-top: 8px; padding-top: 0; padding-bottom: 2px; }
.fut-sp-cols > [role="columnheader"] { display: flex; justify-content: flex-end; min-width: 0; }
.fut-sp-cols > [role="columnheader"]:first-child { justify-content: flex-start; }
#fut-spypanel .fut-sp-h { display: inline-flex; align-items: center; gap: 3px; min-height: 24px; padding: 0 2px; border: 0; background: none; color: var(--mute);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
#fut-spypanel button.fut-sp-h:hover { color: var(--hi); }
#fut-spypanel .fut-sp-h.sortBy { color: #CFF5FC; }
[aria-sort="ascending"] > .fut-sp-h .fut-sp-sort { transform: rotate(180deg); }
.fut-sp-who { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
.fut-sp-line { display: flex; align-items: center; gap: 4px; min-width: 0; }
#fut-spypanel a.fut-sp-name { color: var(--hi); font-size: 12px; font-weight: 700; text-decoration: none; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
#fut-spypanel a.fut-sp-name:hover, #fut-spypanel a.fut-sp-name:focus-visible { color: var(--accent); text-decoration: underline; }
#fut-spypanel .fut-mk-flag { min-width: 24px; min-height: 24px; }
.fut-sp-st { padding: 0 5px; border-radius: 8px; background: #1A2733; font-size: 11px; line-height: 16px; color: var(--txt); white-space: nowrap; }
.fut-sp-st.st-inactive, .fut-sp-st.st-longinactive { color: var(--ok); }
.fut-sp-st.st-vacation { color: #7FB8FF; }
.fut-sp-st.st-shared { color: #D2B8FF; background: rgba(181, 123, 255, 0.16); }
.fut-sp-st.st-noob, .fut-sp-st.st-strong, .fut-sp-st.st-honorableTarget { color: var(--warn); }
#fut-spypanel a.fut-sp-coords { color: var(--link); text-decoration: none; white-space: nowrap; }
#fut-spypanel a.fut-sp-coords:hover { color: var(--hi); }
.fut-sp-moon { margin-right: 3px; vertical-align: -1px; }
.fut-sp-num { display: flex; flex-direction: column; align-items: flex-end; gap: 1px; white-space: nowrap; min-width: 0; }
.fut-sp-num b { color: var(--hi); font-size: 12px; }
.fut-sp-num small { font-size: 11px; color: var(--mute); overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
.fut-sp-num small .fut-msg-icon { width: 14px; height: 14px; vertical-align: -3px; margin-right: 3px; }
#fut-spypanel .fresh { color: var(--ok); } #fut-spypanel .warm { color: var(--warn); } #fut-spypanel .old, #fut-spypanel .bad { color: var(--neg); }
#fut-spypanel .zero { color: var(--dim); }
.fut-sp-acts { display: flex; align-items: center; justify-content: flex-end; gap: 6px; }
#fut-spypanel .fut-sp-attack { height: 24px; padding: 0 10px; border: 1px solid #C0533F; border-radius: 12px; background: rgba(192, 83, 63, 0.18); color: #FFD9D2; font-weight: 700; }
#fut-spypanel .fut-sp-attack:hover { background: rgba(192, 83, 63, 0.34); }
#fut-spypanel .fut-sp-sim { height: 24px; padding: 0 10px; border: 1px solid var(--line); border-radius: 12px; background: none; color: #8FB6D8; font-weight: 700; }
#fut-spypanel .fut-sp-sim:hover { color: var(--hi); border-color: var(--link); background: rgba(120, 150, 180, 0.12); }
#fut-spypanel .fut-sp-del { flex: none; width: 24px; min-width: 24px; height: 24px; padding: 0; display: inline-flex; align-items: center; justify-content: center;
  border: 0; border-radius: 50%; background: none; color: var(--dim); }
#fut-spypanel .fut-sp-del:hover { color: var(--neg); background: rgba(240, 122, 110, 0.12); }
.fut-sp-note { max-width: 80ch; margin: 8px 4px 0; color: var(--mute); font-size: 11px; line-height: 1.5; }
@media (max-width: 640px) {
  .fut-sp-cols { display: none; }
  .fut-sp-row { grid-template-columns: minmax(0, 1fr) auto auto; }
  .fut-sp-row > .fut-sp-acts { grid-column: 1 / -1; justify-content: flex-start; }
}
`;

export const JOURNAL_CSS = `
:host { --panel-w: 860px; }
.kpi .value { font-size: 18px; font-family: var(--mono); }
.kpi .detail { display: flex; flex-wrap: wrap; gap: 8px; }
.bar { display: flex; height: 12px; border-radius: 6px; overflow: hidden; background: var(--surface); gap: 2px; }
.bar span { display: block; height: 100%; min-width: 2px; }
.legend { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 4px 12px; margin-top: 8px; font-size: 12px; }
.legend div { display: flex; align-items: center; gap: 6px; }
.dot { width: 9px; height: 9px; border-radius: 50%; flex: none; }
.legend .n { margin-left: auto; font-family: "JetBrains Mono", Consolas, monospace; color: var(--text-2); }
.legend .pct { color: var(--muted); font-size: 11px; min-width: 38px; text-align: right; }
table { width: 100%; border-collapse: collapse; font-size: 12px; }
th { text-align: right; color: var(--muted); font-weight: 400; padding: 3px 6px; border-bottom: 1px solid var(--line); white-space: nowrap; }
th:first-child, td:first-child { text-align: left; }
td { text-align: right; padding: 3px 6px; border-bottom: 1px solid var(--line-soft); font-family: "JetBrains Mono", Consolas, monospace; white-space: nowrap; }
td:first-child { font-family: Arial, sans-serif; color: var(--text-2); }
.scroll { overflow-x: auto; }
.sizes { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
.rar { padding: 1px 8px; border-radius: 9px; font-size: 12px; font-weight: 700; color: var(--rar);
  border: 1px solid color-mix(in srgb, var(--rar) 60%, transparent); background: color-mix(in srgb, var(--rar) 14%, transparent); }
${RARITY.map((c, i) => `.rar-${i} { --rar: ${c}; }`).join(' ')}
/* Resources found: the big numbers of the journal. */
.res { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
.res-tile { display: flex; flex-direction: column; gap: 4px; min-width: 0; padding: 10px 12px; border-radius: 6px; background: var(--surface); }
.res-tile.m { --dot: var(--m); } .res-tile.c { --dot: var(--c); } .res-tile.d { --dot: var(--d); } .res-tile.dm { --dot: var(--dm); }
.res-name { display: flex; align-items: center; gap: 6px; color: var(--muted); font-size: 12px; }
.res-name::before { content: ''; width: 8px; height: 8px; border-radius: 50%; background: var(--dot); flex: none; }
.res-tile b { font-size: 22px; line-height: 1.15; color: var(--dot); font-variant-numeric: tabular-nums; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.res-tile.zero b { color: var(--faint); }
/* Ships found: compact, many per row; the count matters more than the picture. */
.ships { display: grid; grid-template-columns: repeat(auto-fill, minmax(118px, 1fr)); gap: 4px 10px; }
.ship { display: flex; align-items: center; gap: 6px; padding: 1px 0; min-width: 0; }
.ship-img { width: 24px; height: 24px; flex: none; border-radius: 50%; object-fit: cover; background: var(--line-soft); }
.ship-img-none { display: flex; align-items: center; justify-content: center; color: var(--muted); font-size: 9px; }
.ship-info { display: flex; flex-direction: column; min-width: 0; line-height: 1.2; }
.ship-info b { font-size: 12px; font-variant-numeric: tabular-nums; }
.ship-name { color: var(--muted); font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
@media (max-width: 560px) { .res { grid-template-columns: repeat(2, minmax(0, 1fr)); } .res-tile b { font-size: 18px; } }
h4.lost { margin: 10px 0 6px; color: var(--bad); }
.foot { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; justify-content: space-between; }
.opt input { width: 16px; height: 16px; margin: 0; }
.opt { min-height: 24px; display: flex; gap: 6px; align-items: center; color: var(--text-2); font-size: 12px; cursor: pointer; }
.acts { display: flex; gap: 6px; }
@media (max-width: 560px) { .kpi .value { font-size: 15px; } }
`;

