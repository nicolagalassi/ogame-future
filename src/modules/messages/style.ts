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
/** Expedition size as game rarity, by size index (0 huge, 1 big, 2 normal): epic purple, rare blue, common grey. */
export const RARITY = ['#B57BFF', '#4AA3FF', '#8A9BB0'];

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
.fut-msg, .fut-msg-top, .fut-msg-foot, .fut-fresh, #fut-spypanel {
  --hi: #F1F4F7; --txt: #C9D2DC; --mute: #A3AFBD; --dim: #8592A1; --faint: #4E5B6A; --line: #2E4356;
  --link: #6F9FC8; --accent: #4FD1E8; --neg: #F07A6E; --warn: #E3B341; --ok: #7BC47F; --ship: #4FE0B0; --on-tone: #0D1116;
  --loot: #F0A35A; --name: #E8D27A; --on-accent: #CFF5FC; --attack: #FF9B8A; --attack-line: #C0533F; --sim: #8FB6D8; --chip: #1A2733;
}
.fut-msg { display: grid; grid-template-columns: 124px minmax(0, 1fr) minmax(84px, auto) auto; align-items: center; column-gap: 10px;
  box-sizing: border-box; margin: 4px 0 6px; padding: 5px 16px; min-height: 30px;
  border-radius: 0; background: rgba(120, 150, 180, 0.06); cursor: pointer; text-align: left;
  font: 11px/16px Verdana, Arial, Helvetica, sans-serif; color: var(--txt); font-variant-numeric: tabular-nums; }
.fut-msg:hover { background: rgba(120, 150, 180, 0.11); }
.fut-msg:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
.fut-msg-pillcell { display: flex; min-width: 0; }
/* Card view, spread over the game's message: what was found in the middle and bigger; the value
   beside the title, smaller; the outcome pill in the game's footer, between its buttons. */
.fut-msg.fut-msg-spread { grid-template-columns: minmax(0, 1fr) auto; padding: 7px 16px; }
.fut-msg-spread .fut-msg-body { justify-content: center; gap: 4px 18px; font-size: 13px; line-height: 20px; }
.fut-msg-spread .fut-r .fut-res-ico { width: 18px; height: 18px; }
.fut-msg-spread .fut-msg-icon { width: 24px; height: 24px; }
.fut-msg-spread .fut-depl { margin-left: 0; }
.msg .msgHead:has(> .fut-msg-top), .msg message-footer:has(> .fut-msg-foot), .msg .msg_actions:has(> .fut-msg-foot) { position: relative !important; }
.fut-msg-top { position: absolute; top: 50%; left: 58%; transform: translate(-50%, -50%); display: flex; align-items: baseline; gap: 4px; white-space: nowrap;
  font: 11px/14px Verdana, Arial, Helvetica, sans-serif; color: var(--txt); font-variant-numeric: tabular-nums; }
.fut-msg-top b { font-size: 12px; color: var(--hi); }
.fut-msg-top b.fut-neg { color: var(--neg); }
.fut-msg-top small { font-size: 10px; color: var(--mute); }
.msg.fut-msgrar .fut-msg-top b { color: var(--rar); }
.msg.fut-msgrar-0 .fut-msg-top b { font-size: 13px; }
.fut-msg-foot { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); display: flex; font: 11px/16px Verdana, Arial, Helvetica, sans-serif; }
.fut-pill { --tone: #8A9BB0; display: inline-block; max-width: 100%; box-sizing: border-box; padding: 1px 8px; border-radius: 9px;
  border: 1px solid color-mix(in srgb, var(--tone) 55%, transparent); background: color-mix(in srgb, var(--tone) 9%, transparent);
  color: color-mix(in srgb, var(--tone) 78%, #fff); font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
/* Expedition size as game rarity. Normal finds keep the game's look; big (rare, blue) and huge (epic,
   purple) tint the WHOLE message, the game's own box included, with a visible edge all round. */
${RARITY.map((c, i) => `.fut-rar-${i}, .fut-msgrar-${i} { --rar: ${c}; }`).join(' ')}
.fut-msg[class*="fut-rar-"] .fut-msg-val b { color: var(--rar); }
.fut-msg.fut-rar-0 .fut-msg-val b { font-size: 14px; }
.msg.fut-msgrar { border-radius: 4px; background: color-mix(in srgb, var(--rar) 13%, #141C26) !important; box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--rar) 70%, transparent) !important; }
.msg.fut-msgrar-0 { background: color-mix(in srgb, var(--rar) 18%, #141C26) !important; box-shadow: inset 0 0 0 1px var(--rar), 0 0 0 1px color-mix(in srgb, var(--rar) 35%, transparent) !important; }
/* Inside, the game's own panels let the tint through; the summary has no band of its own. */
.msg.fut-msgrar .msgHead, .msg.fut-msgrar .msgContent, .msg.fut-msgrar .msgFilteredHeaderRow, .msg.fut-msgrar .messageContentWrapper,
.msg.fut-msgrar message-footer, .msg.fut-msgrar .msg_actions, .msg.fut-msgrar .fut-msg { background: transparent !important; box-shadow: none !important; }
.msg.fut-msgrar .fut-msg:hover { background: color-mix(in srgb, var(--rar) 8%, transparent) !important; }
${outcomeCss}
.fut-msg-body { display: flex; flex-wrap: wrap; align-items: center; gap: 2px 12px; min-width: 0; }
/* Resources: the shared symbol (core/res-icons) in the resource's colour; its shape is the cue, not only the colour. */
.fut-r { display: inline-flex; align-items: center; gap: 4px; white-space: nowrap; }
.fut-r .fut-res-ico { flex: none; color: var(--dot); }
.fut-r-m { --dot: ${RES_COLORS.metal}; } .fut-r-c { --dot: ${RES_COLORS.crystal}; } .fut-r-d { --dot: ${RES_COLORS.deuterium}; } .fut-r-f { --dot: ${RES_COLORS.food}; } .fut-r-dm { --dot: ${RES_COLORS.darkMatter}; }
.fut-u { display: inline-flex; align-items: center; gap: 4px; white-space: nowrap; }
.fut-msg-icon { width: 18px; height: 18px; border-radius: 50%; object-fit: cover; flex: none; }
.fut-msg-icon-none { display: inline-flex; align-items: center; justify-content: center; width: 18px; height: 18px; border-radius: 50%; background: var(--chip); font-size: 8px; color: var(--mute); }
.fut-note { white-space: nowrap; color: var(--txt); }
.fut-msg .fut-muted { color: var(--mute); } .fut-msg .fut-warn { color: var(--warn); } .fut-msg .fut-neg { color: var(--neg); }
.fut-msg .fut-item { color: #D08A5B; } .fut-msg .fut-lf { color: #E07BC8; } .fut-msg .fut-art { color: #D4A93A; }
/* The route takes the first line on its own: what was carried is all on the line under it. */
.fut-route { display: inline-flex; flex-wrap: wrap; align-items: center; gap: 0 6px; flex-basis: 100%; color: var(--txt); }
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
  color: var(--sim); text-decoration: none; font-size: 11px; font-weight: 700; white-space: nowrap; }
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
.fut-fresh-name { display: inline-flex; align-items: center; gap: 4px; }
.fut-fresh-name .fut-res-ico { color: var(--dot); }
.fut-fresh-tile { display: flex; flex-direction: column; gap: 2px; min-width: 0; padding: 7px 9px; border-radius: 4px; background: rgba(120, 150, 180, 0.07); }
.fut-fresh-name { display: flex; align-items: center; gap: 5px; color: var(--mute); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
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

/* Spy table, above the Espionage reports: one compact line per target, as OGLight lays it out. */
#fut-spypanel { margin: 0 0 8px; padding: 6px 8px 8px; border-radius: 4px; background: #0A0F14; font: 11px/1.35 Verdana, Arial, sans-serif; color: var(--txt);
  font-variant-numeric: tabular-nums; }
#fut-spypanel button { font: inherit; cursor: pointer; }
#fut-spypanel button:focus-visible, #fut-spypanel a:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
.fut-sp-head { display: flex; align-items: center; gap: 6px; }
#fut-spypanel .fut-sp-title { display: flex; align-items: baseline; gap: 8px; flex: 1 1 auto; min-width: 0; box-sizing: border-box; min-height: 26px; padding: 3px 6px;
  border: 0; border-radius: 4px; background: none; color: var(--hi); text-align: left; }
#fut-spypanel .fut-sp-title:hover { background: rgba(120, 150, 180, 0.08); }
.fut-sp-title b { font-size: 13px; white-space: nowrap; }
.fut-sp-title span { color: var(--mute); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.fut-sp-chev { align-self: center; flex: none; color: var(--mute); transition: transform 120ms ease-out; }
.fut-sp-title[aria-expanded="false"] .fut-sp-chev { transform: rotate(-90deg); }
@media (prefers-reduced-motion: reduce) { .fut-sp-chev { transition: none; } }
#fut-spypanel .fut-sp-chip { flex: none; height: 22px; padding: 0 9px; border: 1px solid var(--line); border-radius: 11px; background: none; color: var(--mute); white-space: nowrap; }
#fut-spypanel .fut-sp-chip:hover { color: var(--hi); border-color: var(--link); }
#fut-spypanel .fut-sp-chip[aria-pressed="true"] { background: rgba(79, 209, 232, 0.14); border-color: var(--accent); color: var(--on-accent); }
.fut-sp-table { margin-top: 6px; }
.fut-sp-row { display: grid; column-gap: 6px; align-items: center; min-height: 28px; padding: 0 6px; border-radius: 3px; }
.fut-sp-c { min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.fut-sp-c.fut-sp-r { text-align: right; justify-self: stretch; }
.fut-sp-c.fut-sp-n { color: var(--dim); text-align: right; }
.fut-sp-list { display: flex; flex-direction: column; gap: 1px; }
.fut-sp-list .fut-sp-row { background: rgba(120, 150, 180, 0.05); }
.fut-sp-list .fut-sp-row:hover { background: rgba(120, 150, 180, 0.11); }
.fut-sp-cols { min-height: 24px; }
.fut-sp-cols .fut-sp-c { display: flex; overflow: visible; }
.fut-sp-cols .fut-sp-c.fut-sp-r { justify-content: flex-end; }
.fut-sp-cols .fut-sp-c[draggable="true"] { cursor: grab; }
.fut-sp-cols .fut-sp-c.drag { opacity: .45; }
.fut-sp-cols .fut-sp-c.over { box-shadow: inset 2px 0 0 var(--accent); }
#fut-spypanel .fut-sp-h { display: inline-flex; align-items: center; gap: 3px; min-height: 22px; padding: 0 2px; border: 0; background: none; color: var(--mute);
  font-size: 11px; text-transform: uppercase; letter-spacing: .03em; white-space: nowrap; }
#fut-spypanel button.fut-sp-h { cursor: inherit; }
#fut-spypanel button.fut-sp-h:hover { color: var(--hi); }
#fut-spypanel .fut-sp-h.sortBy { color: var(--on-accent); }
[aria-sort="ascending"] > .fut-sp-h .fut-sp-sort { transform: rotate(180deg); }
.fut-sp-who { display: flex; align-items: center; gap: 4px; }
#fut-spypanel a.fut-sp-name { min-width: 0; color: var(--name); font-weight: 700; text-decoration: none; overflow: hidden; text-overflow: ellipsis; }
#fut-spypanel a.fut-sp-name:hover, #fut-spypanel a.fut-sp-name:focus-visible { color: var(--hi); text-decoration: underline; }
#fut-spypanel .fut-sp-who .fut-mk-flag { flex: none; min-width: 20px; min-height: 20px; margin-left: auto; }
.fut-sp-st { flex: none; padding: 0 5px; border-radius: 8px; background: var(--chip); font-size: 11px; line-height: 15px; color: var(--txt); }
.fut-sp-st.st-inactive, .fut-sp-st.st-longinactive { color: var(--ok); }
.fut-sp-st.st-vacation { color: #7FB8FF; }
.fut-sp-st.st-shared { color: #D2B8FF; background: rgba(181, 123, 255, 0.16); }
.fut-sp-st.st-noob, .fut-sp-st.st-strong, .fut-sp-st.st-honorableTarget { color: var(--warn); }
#fut-spypanel a.fut-sp-coords { display: inline-flex; align-items: center; gap: 5px; color: var(--link); text-decoration: none; }
#fut-spypanel a.fut-sp-coords:hover { color: var(--hi); }
.fut-sp-kind { flex: none; color: var(--mute); }
.fut-sp-c.fut-sp-loot { color: var(--loot); font-weight: 700; }
#fut-spypanel .fresh { color: var(--ok); } #fut-spypanel .warm { color: var(--warn); } #fut-spypanel .old, #fut-spypanel .bad { color: var(--neg); }
#fut-spypanel .zero { color: var(--dim); }
.fut-sp-acts { display: flex; align-items: center; justify-content: flex-end; gap: 2px; overflow: visible; }
#fut-spypanel .fut-sp-ib { flex: none; width: 24px; height: 24px; padding: 0; display: inline-flex; align-items: center; justify-content: center;
  border: 1px solid transparent; border-radius: 4px; background: rgba(120, 150, 180, 0.1); color: var(--mute); }
#fut-spypanel .fut-sp-ib:hover { color: var(--hi); border-color: var(--line); background: rgba(120, 150, 180, 0.2); }
#fut-spypanel .fut-sp-more[aria-expanded="true"] { color: var(--accent); border-color: var(--accent); }
#fut-spypanel .fut-sp-attack { color: var(--attack); }
#fut-spypanel .fut-sp-attack:hover { color: var(--hi); border-color: var(--attack-line); background: rgba(192, 83, 63, 0.3); }
#fut-spypanel .fut-sp-sim { color: var(--sim); }
#fut-spypanel .fut-sp-del:hover { color: var(--neg); border-color: rgba(240, 122, 110, 0.5); background: rgba(240, 122, 110, 0.14); }
.fut-sp-waves { padding: 6px 8px 8px 34px; background: rgba(79, 209, 232, 0.05); border-radius: 0 0 3px 3px; }
.fut-sp-wgrid { display: grid; grid-template-columns: 120px repeat(6, minmax(0, 1fr)); align-items: center; column-gap: 6px; row-gap: 0; max-width: 560px; }
.fut-sp-wgrid > * { min-height: 24px; line-height: 24px; text-align: right; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.fut-sp-wgrid .k { display: flex; align-items: center; gap: 5px; color: var(--mute); text-align: left; }
.fut-sp-wgrid .k .fut-msg-icon { flex: none; width: 16px; height: 16px; }
.fut-sp-wgrid .h { color: var(--dim); font-size: 11px; }
.fut-sp-wgrid b { color: var(--loot); }
.fut-sp-wgrid .cnt { color: var(--txt); }
#fut-spypanel .fut-sp-wgrid a.cnt { justify-self: end; box-sizing: border-box; min-width: 28px; padding: 0 5px; border-radius: 3px; color: var(--link); text-decoration: none; }
#fut-spypanel .fut-sp-wgrid a.cnt:hover, #fut-spypanel .fut-sp-wgrid a.cnt:focus-visible { color: var(--hi); background: rgba(111, 159, 200, 0.18); }
.fut-sp-wres { display: flex; flex-wrap: wrap; gap: 4px 14px; margin-top: 6px; padding-top: 5px; border-top: 1px solid rgba(120, 150, 180, 0.12); color: var(--txt); }
.fut-sp-wres .k { width: 120px; color: var(--mute); }
.fut-sp-wres .from { margin-left: auto; color: var(--mute); }
.fut-sp-foot { min-height: 24px; color: var(--mute); }
.fut-sp-foot .fut-sp-c.fut-sp-r { color: var(--loot); font-weight: 700; }
.fut-sp-note { max-width: 62ch; margin: 8px 4px 0; text-wrap: pretty; color: var(--mute); font-size: 11px; line-height: 1.5; }
@media (max-width: 640px) {
  .fut-sp-head { flex-wrap: wrap; }
  .fut-sp-table { overflow-x: auto; }
  .fut-sp-row { min-width: 560px; }
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

