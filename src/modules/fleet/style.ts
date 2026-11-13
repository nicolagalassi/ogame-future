/** Styles for the action bars on the game's fleet page (scoped by fut- class names). */
export const FLEET_CSS = `
/* The fleet bar speaks the inbox's language: Verdana 11px, tabular numbers, one set of tokens. */
.fut-fbar, .fut-fmenu {
  --hi: #F1F4F7; --txt: #C9D2DC; --mute: #A3AFBD; --dim: #8592A1; --line: #24344B; --line-soft: #1A2738;
  --tile: #152234; --tile-hi: #1C2D44; --tile-line: #2A3B53; --ico: #C2CCD8; --ico-hi: #F1F4F7;
  --accent: #6FB6C8; --on-accent: #DCEAF0; --ok: #4FE0B0; --neg: #F07A6E; --warn: #E3B341;
  --track: #3A4A60; --knob-on: #0B1A22; --on-line: #35576A; --on-bg: #17293A; --field: #0D1522;
}
.fut-fbar {
  display: flex; flex-direction: column; gap: 8px; margin: 6px 10px; padding: 8px;
  border: 1px solid var(--line-soft); border-radius: 6px; background: #0A0F14;
  font: 11px/1.35 Verdana, Arial, sans-serif; color: var(--txt); font-variant-numeric: tabular-nums;
}
.fut-fbar button { font: inherit; cursor: pointer; }
.fut-fbar button:focus-visible, .fut-fmenu button:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }

/* Two rows: what to send (and the editors), then what to keep back (and the readout). */
.fut-frow { display: flex; align-items: center; gap: 8px; min-width: 0; }

/* Actions: a hotbar of filled icons on solid tiles, the key in the corner. Dashed = still to set up.
   Silver on slate, no neon: colour is left to what the game's own page says. */
.fut-facts { display: flex; flex-wrap: wrap; align-items: center; gap: 4px; }
.fut-fact {
  position: relative; flex: none; display: inline-flex; align-items: center; justify-content: center; width: 44px; height: 40px; padding: 0;
  border: 1px solid var(--tile-line); border-radius: 6px; background: var(--tile); color: var(--ico);
}
.fut-fact:hover { border-color: #47607D; background: var(--tile-hi); color: var(--ico-hi); }
.fut-fact:active { transform: translateY(1px); }
.fut-fact .ico { display: inline-flex; }
/* The key sits in the corner: the icon steps aside for it. */
.fut-fact:has(kbd) .ico { margin: 5px 6px 0 0; }
.fut-fact kbd { position: absolute; top: 2px; right: 3px; color: var(--dim); font: 11px/11px Verdana, Arial, sans-serif; }
.fut-fact:hover kbd { color: var(--mute); }
.fut-fact.dim { border-style: dashed; background: none; color: var(--dim); }
/* Secondary tools (moon, expedition collection): set apart and quieter. */
.fut-fsecond { display: inline-flex; gap: 4px; margin-left: 6px; padding-left: 10px; border-left: 1px solid var(--line); }
.fut-fsecond .fut-fact { background: none; border-color: var(--line); color: var(--mute); }
.fut-fsecond .fut-fact:hover { background: var(--tile); border-color: #47607D; color: var(--ico-hi); }
.fut-fskip[hidden] { display: none; }
/* Main cargo ship, picked on the ship itself (top right; the game keeps the top left). */
#fleet1 #technologies li[data-technology] { position: relative; }
.fut-mainship { position: absolute; top: 2px; right: 2px; z-index: 2; width: 20px; height: 20px; padding: 0; display: inline-flex; align-items: center; justify-content: center; border: 1px solid #1F2C40; border-radius: 5px; background: rgba(13, 21, 34, 0.85); color: #8A9BB4; cursor: pointer; opacity: 0.75; }
.fut-mainship:hover { opacity: 1; color: #F1F4F7; border-color: #6FB6C8; }
.fut-mainship.on { opacity: 1; color: #0D1522; background: #6FB6C8; border-color: #6FB6C8; cursor: default; }
/* "Opens a list" mark, in the corner where the others have their key. */
.fut-fact .more-mark { position: absolute; right: 3px; bottom: 3px; width: 0; height: 0; border-left: 5px solid transparent; border-bottom: 5px solid currentColor; opacity: 0.7; }

/* On the game's ship tiles: inverts that ship's selection. */
#fleet1 #technologies li[data-technology] { position: relative; }
.fut-finv { position: absolute; top: 2px; left: 2px; z-index: 3; display: inline-flex; align-items: center; justify-content: center; width: 20px; height: 20px; padding: 0;
  border: 1px solid #24344B; border-radius: 4px; background: rgba(8, 13, 20, 0.85); color: #C9D2DC; cursor: pointer; opacity: 0.75; }
.fut-finv:hover, .fut-finv:focus-visible { opacity: 1; border-color: #47607D; color: #F1F4F7; }
@media (pointer: coarse) { .fut-finv { width: 26px; height: 26px; opacity: 1; } }

/* Editors, pushed to the far end of the first row. */
.fut-fedit { display: inline-flex; gap: 2px; margin-left: auto; }
.fut-ftool { display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; padding: 0; border: 0; border-radius: 5px; background: none; color: var(--mute); }
.fut-ftool:hover { background: var(--tile-hi); color: var(--hi); }

/* Rules: the rule's icon beside a switch track, so on and off read without a word. */
.fut-frules { flex: none; display: inline-flex; gap: 4px; }
.fut-fsw { display: inline-flex; align-items: center; gap: 6px; height: 28px; padding: 0 7px 0 8px; border: 1px solid var(--line-soft); border-radius: 14px; background: none; color: var(--dim); }
.fut-fsw .ico { display: inline-flex; }
.fut-fsw .track { position: relative; flex: none; width: 20px; height: 12px; border-radius: 6px; background: var(--track); transition: background-color 120ms ease-out; }
.fut-fsw .track::after { content: ""; position: absolute; top: 2px; left: 2px; width: 8px; height: 8px; border-radius: 50%; background: var(--txt); transition: transform 120ms ease-out; }
.fut-fsw:hover { border-color: var(--line); color: var(--txt); }
.fut-fsw[aria-checked="true"] { border-color: var(--on-line); background: var(--on-bg); color: var(--on-accent); }
.fut-fsw[aria-checked="true"] .track { background: var(--accent); }
.fut-fsw[aria-checked="true"] .track::after { transform: translateX(8px); background: var(--knob-on); }

/* Readout: the last outcome, or what the control under the pointer does. Two lines at most, fixed height. */
.fut-fread { flex: 1; min-width: 0; height: 30px; display: flex; align-items: center; }
.fut-fread span { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; }
.fut-fread .tip { color: var(--mute); }
/* Speed changed during a round: "also for the next ones?", with its two answers. */
.fut-fask { flex: none; display: flex; align-items: center; gap: 6px; height: 30px; padding: 0 4px 0 10px; border: 1px solid #6B5A1E; border-radius: 8px; background: rgba(245,181,71,0.08); }
.fut-fask[hidden] { display: none; }
.fut-fask-q { color: #F5D9A0; white-space: nowrap; }
.fut-fask-b { height: 22px; padding: 0 10px; border: 1px solid #2A3B55; border-radius: 5px; background: #0D1522; color: #C9D4E2; font: 12px Arial, Helvetica, sans-serif; cursor: pointer; }
.fut-fask-b.yes { border-color: #F5B547; color: #F5B547; font-weight: 700; }
.fut-fask-b:hover { color: #fff; border-color: #4FD1E8; }
.fut-fask-b:focus-visible { outline: 1px solid #4FD1E8; outline-offset: 1px; }
.fut-fread .tip b { color: var(--hi); }
.fut-fread .tip:empty { display: none; }
.fut-fread .tip:not(:empty) + .fut-finfo { display: none; }
.fut-finfo { color: var(--mute); }
.fut-finfo.err { color: var(--neg); }

/* Trasporto / Schiera on: the tile stays lit until pressed again. */
.fut-fact[aria-pressed="true"] { border-color: var(--accent); background: #1B3142; color: var(--ico-hi); }
.fut-fact[aria-pressed="true"] kbd { color: var(--on-accent); }

/* Their panel: destination over resources, labels in one column; CL / CP on the right, as tall as both rows. */
.fut-fsend {
  display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 6px 10px;
  padding: 8px 8px 8px 10px; border: 1px solid var(--line); border-radius: 6px; background: #0E1724;
}
.fut-fsend .lbl { grid-column: 1; color: var(--mute); }
.fut-fdest { grid-column: 2; grid-row: 1; display: inline-flex; align-items: center; gap: 3px; }
.fut-fres { grid-column: 2; grid-row: 2; display: inline-flex; flex-wrap: wrap; align-items: center; gap: 4px 6px; }
.fut-fdest .colon { color: var(--dim); }
.fut-fdest .fut-fpick { margin: 0 4px 0 2px; }
.fut-fin { box-sizing: border-box; height: 26px; padding: 0 6px; border: 1px solid var(--line); border-radius: 5px; background: var(--field); color: var(--hi); font: 11px/1 Verdana, Arial, sans-serif; font-variant-numeric: tabular-nums; }
.fut-fin::placeholder { color: var(--dim); }
.fut-fin:focus { outline: none; border-color: var(--accent); }
.fut-fin.bad { border-color: var(--neg); }
.fut-fin.g, .fut-fin.p { width: 34px; text-align: center; }
.fut-fin.s { width: 46px; text-align: center; }
.fut-fin.amount { width: calc(13ch + 14px); text-align: right; }
.fut-fpick { width: 24px; height: 26px; padding: 0; display: inline-flex; align-items: center; justify-content: center; border: 1px solid var(--line); border-radius: 5px; background: var(--tile); color: var(--mute); }
.fut-fpick:hover { border-color: #47607D; color: var(--hi); }
.fut-fseg { display: inline-flex; border: 1px solid var(--line); border-radius: 5px; overflow: hidden; }
.fut-fseg button { display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-width: 30px; height: 24px; padding: 0 7px; border: 0; background: none; color: var(--dim); }
.fut-fseg button + button { border-left: 1px solid var(--line); }
.fut-fseg button:hover { color: var(--txt); }
.fut-fseg button[aria-pressed="true"] { background: var(--tile-hi); color: var(--hi); }
.fut-fresin { display: inline-flex; align-items: center; gap: 2px; }
.fut-fresin .sym { display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 26px; padding: 0; border: 1px solid transparent; border-radius: 5px; background: none; }
.fut-fresin .sym:hover { border-color: var(--line); background: var(--tile); }
.fut-fresin.metal .sym { color: #B8C2CC; }
.fut-fresin.crystal .sym { color: #7FB8FF; }
.fut-fresin.deuterium .sym { color: #4FE0B0; }
.fut-fclear { width: 26px; height: 26px; padding: 0; display: inline-flex; align-items: center; justify-content: center; border: 1px solid var(--line); border-radius: 5px; background: var(--tile); color: var(--mute); }
.fut-fclear:hover { border-color: #47607D; color: var(--hi); }
/* CL / CP: the game's ship pictures, short name in the corner, cargo needed along the bottom. */
.fut-fcargo { grid-column: 3; grid-row: 1 / span 2; display: flex; align-items: center; gap: 4px; padding-left: 10px; border-left: 1px solid var(--line-soft); }
.fut-fcl { position: relative; width: 48px; height: 48px; padding: 0; overflow: hidden; border: 1px solid var(--tile-line); border-radius: 6px; background: var(--tile); color: var(--hi); }
.fut-fcl .pic { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; opacity: 0.85; }
.fut-fcl b { position: absolute; top: 2px; left: 2px; padding: 0 3px; border-radius: 3px; background: rgba(8, 13, 20, 0.8); font-size: 10px; line-height: 14px; }
.fut-fcl .n { position: absolute; left: 0; right: 0; bottom: 0; padding: 1px 0; background: rgba(8, 13, 20, 0.82); color: var(--hi); font-size: 10px; line-height: 13px; text-align: center; }
.fut-fcl .n:empty { display: none; }
.fut-fcl:hover { border-color: var(--accent); }
.fut-fcl:hover .pic { opacity: 1; }
.fut-fcl.short .n { color: var(--warn); }
.fut-fcl.none { border-style: dashed; }
.fut-fcl.none .pic { opacity: 0.3; filter: grayscale(1); }

/* Fingers: bigger targets, no key letters. */
@media (pointer: coarse) {
  .fut-fact { width: 48px; height: 46px; }
  .fut-fcaret { width: 30px; height: 46px; }
  .fut-fact kbd { display: none; }
  .fut-fact:has(kbd) .ico { margin: 0; }
  .fut-ftool { width: 44px; height: 44px; }
  .fut-frow { flex-wrap: wrap; }
  .fut-frules { flex-wrap: wrap; gap: 6px; }
  .fut-fsw { height: 40px; padding: 0 10px 0 12px; border-radius: 20px; }
  .fut-fread { flex-basis: 100%; }
  .fut-fin, .fut-fclear, .fut-fpick { height: 40px; }
  .fut-fsend { grid-template-columns: minmax(0, 1fr); }
  .fut-fsend .lbl { display: none; }
  .fut-fdest, .fut-fres, .fut-fcargo { grid-column: 1; grid-row: auto; }
  .fut-fcargo { padding-left: 0; border-left: 0; }
  .fut-fcl { width: 52px; height: 52px; }
  .fut-fseg button { height: 38px; min-width: 44px; }
  .fut-fsecond { margin-left: 0; padding-left: 0; border-left: 0; }
}

/* Destination list of Trasporto / Schiera. */
.fut-fmenu {
  position: fixed; z-index: 1000002; min-width: 240px; max-height: 320px; overflow-y: auto; overscroll-behavior: contain;
  display: grid; grid-template-columns: minmax(0, 1fr) 40px; gap: 2px; padding: 4px; border: 1px solid var(--line); border-radius: 6px; background: #0A0F14;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.6); font: 11px/1.35 Verdana, Arial, sans-serif;
}
.fut-fmenu .fut-fbtn {
  display: flex; align-items: center; gap: 8px; min-height: 30px; padding: 0 8px; border: 1px solid transparent; border-radius: 4px; background: var(--tile);
  color: var(--txt); font: inherit; cursor: pointer; white-space: nowrap; text-align: left;
}
.fut-fmenu .fut-fbtn small { margin-left: auto; color: var(--dim); font-size: 11px; }
.fut-fmenu .fut-fbtn.moon { justify-content: center; padding: 0; color: var(--mute); }
.fut-fmenu .fut-fbtn:hover { border-color: var(--accent); background: var(--tile-hi); color: var(--hi); }
.fut-fmenu .fut-fbtn.on { border-color: var(--warn); color: var(--warn); }
.fut-fmenu .fut-fbtn:disabled { background: none; color: var(--dim); opacity: 0.5; cursor: default; border-color: transparent; }
.fut-fmenu .fut-fbtn.moon svg { color: var(--mute); }
/* Collection menu: the two sends to the favourite on top, then "once towards…". */
.fut-fcollect { min-width: 280px; }
.fut-fmhead, .fut-fmsub { grid-column: 1 / -1; margin: 4px 4px 2px; color: var(--mute); }
.fut-fmhead { color: var(--hi); font-weight: 700; }
.fut-fmsub { margin-top: 8px; }
.fut-fmenu .fut-fmain { grid-column: 1 / -1; min-height: 40px; gap: 10px; }
.fut-fmain .ico { display: inline-flex; color: var(--ico); }
.fut-fmain .txt { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
.fut-fmain .txt b { color: var(--hi); font-weight: 700; }
.fut-fmain .txt span { color: var(--mute); }
.fut-fmain kbd { margin-left: auto; color: var(--dim); font: 11px Verdana, Arial, sans-serif; }
.fut-fmain.dim { opacity: 0.7; }
.fut-fcollect .fut-fseg { grid-column: 1 / -1; margin: 0 4px 4px; }
.fut-fcollect .fut-fseg button { flex: 1; font: inherit; cursor: pointer; }
@media (pointer: coarse) { .fut-fmenu { grid-template-columns: minmax(0, 1fr) 48px; max-height: 60vh; } .fut-fmenu .fut-fbtn { min-height: 44px; } }
@media (prefers-reduced-motion: reduce) { .fut-fact:active { transform: none; } .fut-fsw .track, .fut-fsw .track::after { transition: none; } }
`;

/** Settings window: inside a Shadow DOM, so the game's CSS cannot reach these rules. */
export const MODAL_CSS = `
:host { --panel-w: 720px; }
.fut-moon-ico { margin-right: 4px; vertical-align: -1px; color: var(--muted); }
.status { color: var(--ok); min-height: 17px; }
.body { padding-top: 2px; color: var(--text-2); font-size: 12px; }
.fut-fbtn {
  height: 28px; padding: 0 12px; border-radius: 7px; border: 1px solid #2C3E57; background: var(--surface);
  color: var(--text); font: 12px Arial, sans-serif; cursor: pointer;
}
.fut-fbtn:hover { border-color: var(--accent); }
.fut-fbtn.primary { border-color: var(--accent); background: var(--accent-soft); font-weight: 700; }
.fut-feditor h4 { margin: 0 0 4px; font-size: 14px; color: #E6EDF5; }
.fut-feditor h5 { margin: 16px 0 6px; font-size: 12px; font-weight: 700; color: #C9D4E2; }
.fut-feditor > h5:first-child { margin-top: 0; }
.fut-fgrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 4px 14px; }
.fut-ffield { display: grid; grid-template-columns: minmax(0, 1fr) 96px; align-items: center; gap: 8px; min-height: 28px; color: var(--text-2); font-size: 11px; }
.fut-ffield span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fut-ffield select { width: 96px; }
.fut-fgrid.wide .fut-ffield { grid-template-columns: minmax(0, 1fr) 130px; }
.fut-fgrid.wide .fut-ffield select { width: 130px; }
.fut-ffield input { text-align: right; font-variant-numeric: tabular-nums; }
.fut-ffield input, .fut-ffield select {
  height: 26px; padding: 0 6px; border-radius: 6px; border: 1px solid #2C3E57; background: #0D1522; color: #E6EDF5; font: 12px Arial, sans-serif;
}
.fut-ffield input:focus, .fut-ffield select:focus { outline: none; border-color: #4FD1E8; }
.fut-fcheck { display: flex; align-items: center; gap: 6px; color: #C9D4E2; font-size: 12px; align-self: end; min-height: 26px; }
.fut-freserve { margin-top: 6px; border: 1px solid var(--line); border-radius: 7px; background: var(--raised); }
.fut-freserve[open] { padding-bottom: 10px; }
.fut-frulebody { padding: 0 12px; }
.fold { display: inline-flex; color: var(--muted); transform: rotate(-90deg); transition: transform 120ms ease-out; }
.fut-freserve[open] .fold { transform: none; }
@media (prefers-reduced-motion: reduce) { .fold { transition: none; } }
.fut-freserve h5 { margin: 0; }
.fut-frulehead { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; min-height: 40px; padding: 0 12px; cursor: pointer; list-style: none; }
.fut-frulehead::-webkit-details-marker { display: none; }
.fut-frulehead:focus-visible { outline: 1px solid var(--accent); outline-offset: -1px; border-radius: 7px; }
.fut-fruleico { display: inline-flex; color: var(--accent); }
.fut-fswitch { margin-left: auto; display: inline-flex; align-items: center; padding: 8px 0 8px 8px; cursor: pointer; }
.fut-fswitch input { position: absolute; opacity: 0; pointer-events: none; }
.fut-fswitch input:focus-visible + .sw-track { outline: 2px solid var(--accent); outline-offset: 2px; }
input[type="checkbox"] { accent-color: var(--accent); }
.fut-fbadge { padding: 1px 7px; border-radius: 9px; border: 1px solid #2C3E57; color: #8A9BB0; font-size: 11px; cursor: default; }
.fut-fbadge.on { border-color: #38C56E; color: #38C56E; }
.fut-fbadge.off { border-color: #C9853A; color: #FFB15C; }
.fut-fchecks { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 2px 12px; }
.fut-fchecks .fut-fcheck { align-self: auto; min-height: 22px; }
.fut-fcopy .fut-factions { margin-top: 6px; }
.fut-feditor h6 { margin: 10px 0 4px; font-size: 11px; font-weight: 400; color: #8A9BB0; }
.fut-fnote { margin: 6px 0 0; color: #8A9BB0; font-size: 11px; }
.fut-factions { display: flex; align-items: center; gap: 8px; margin-top: 14px; }
.fut-feditor > .fut-factions { position: sticky; bottom: 0; z-index: 1; margin: 10px -8px -8px; padding: 10px 8px; border-top: 1px solid var(--line); background: var(--bg); }
`;
