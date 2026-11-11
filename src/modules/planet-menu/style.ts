/**
 * Styles for the decorated planet list, written against the real game markup
 * (#planetbarcomponent > #rechts > #cutty > #myPlanets > #planetList > .smallplanet).
 * The game positions everything absolutely with its own rules, so ours use two ids
 * plus !important on layout properties to win reliably.
 */
import { RES_COLORS } from '../../core/sheet';
/** Width of the side-by-side menu (tolerated OGLight uses 208px; ours is a bit wider for larger text). */
export const MENU_WIDTH = 247;
/** Native width of the planet column (#rechts) in OGame 13. */
export const NATIVE_WIDTH = 137;

const L = '#planetbarcomponent #planetList.fut-menu';
const MOON_W = 68;

export const PLANET_MENU_CSS = `
#planetbarcomponent.fut-wide #rechts,
#planetbarcomponent.fut-wide #cutty,
#planetbarcomponent.fut-wide #myPlanets { width: ${MENU_WIDTH}px !important; }

/* GRAY AREA: requires ToolDev approval before publishing — see AGENTS.md §1.7 / §3.
   The wider menu would sit under the skyscraper banner, so the banner is shifted right
   by exactly the extra width, as tolerated OGLight does (margin-left on the banner
   component). The banner is never hidden, resized, faded or covered. */
body.fut-banner-shift #bannerskyscrapercomponent { margin-left: ${MENU_WIDTH - NATIVE_WIDTH + 8}px !important; }

/* The colony counter makes room for Future's toolbar, as OGLight does (#countColonies hidden);
   the count stays available in the toolbar tooltip and in the settings panel. */
body.fut-on #planetbarcomponent #countColonies { display: none !important; }

#planetbarcomponent:not(.fut-wide) #planetList.fut-menu,
#planetbarcomponent:not(.fut-wide) .fut-toolbar,
#planetbarcomponent:not(.fut-wide) .fut-totals { width: ${NATIVE_WIDTH}px !important; }
${L} { width: 100% !important; display: flex !important; flex-direction: column; gap: 2px; padding: 0 !important; background: none !important; }
${L} .smallplanet.fut-row {
  position: relative !important; display: flex !important; flex-direction: row; align-items: stretch;
  width: 100% !important; height: var(--fut-row-h, 40px) !important; min-height: 0 !important; margin: 0 !important; padding: 0 !important;
  border: 1px solid #1F2C40; border-radius: 7px; background: #111B2A !important; overflow: hidden; box-sizing: border-box;
}
${L} .smallplanet.fut-current { border-color: #2C5A73; }

/* Planet: small skin behind name and coords, resources in a column on the right. */
${L} a.planetlink {
  position: relative !important; display: flex !important; align-items: center; gap: 3px;
  left: auto !important; top: auto !important; flex: 1; min-width: 0; width: auto !important; height: 100% !important;
  padding: 0 4px 0 28px !important; margin: 0 !important; box-sizing: border-box; overflow: hidden !important;
  background: none !important; text-decoration: none !important;
}
${L} a.planetlink:hover { background: rgba(79,209,232,0.08) !important; }
${L} a.planetlink .planetBarSpaceObjectContainer {
  position: absolute !important; left: -6px !important; top: calc(50% - 20px) !important;
  width: 40px !important; height: 40px !important; margin: 0 !important; opacity: 0.85;
}
${L} .planetBarSpaceObjectHighlightContainer { display: none !important; }
${L} a.planetlink img.planetPic { position: static !important; width: 40px !important; height: 40px !important; margin: 0 !important; }
${L} .fut-name {
  position: relative; flex: 1; min-width: 0; display: flex; flex-direction: column;
  text-shadow: 0 1px 2px #000, 0 0 4px #000, 0 0 6px #000;
}
${L} .fut-name .planet-name,
${L} .fut-name .planet-koords {
  position: static !important; display: block !important; margin: 0 !important; padding: 0 !important;
  width: auto !important; max-width: none !important; height: auto !important; line-height: 1.15 !important;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-align: left !important; background: none !important;
}
${L} .fut-name .planet-name { font: 700 11px Arial, sans-serif !important; color: #E6EDF5 !important; }
${L} .fut-name .planet-koords { font: 10px monospace !important; color: #C9D4E2 !important; }

/* Resources: one per line (metal, crystal, deuterium). */
${L} .fut-res {
  position: relative; flex-shrink: 0; width: 50px; display: flex; flex-direction: column; justify-content: center;
  gap: 0; font: 11px/12px monospace; text-align: right;
}
${L} .fut-cell { display: block; padding: 0 2px; border-radius: 2px; white-space: nowrap; overflow: hidden; }
/* Storage fill painted behind the number (planets only): no extra space needed. */
${L} .fut-cell.fut-has-fill {
  background: linear-gradient(90deg, color-mix(in srgb, currentColor 15%, transparent) var(--fut-fill),
    rgba(255,255,255,0.04) var(--fut-fill)) !important;
}
${L} .fut-m, .fut-totals .fut-m .fut-tname { color: ${RES_COLORS.metal}; }
${L} .fut-c, .fut-totals .fut-c .fut-tname { color: ${RES_COLORS.crystal}; }
${L} .fut-d, .fut-totals .fut-d .fut-tname { color: ${RES_COLORS.deuterium}; }
${L} .fut-full { color: #F5B547 !important; font-weight: 700; }
${L} .fut-missing { color: #8A9BB0; }
/* Fleet: what the ships are worth (planet, then moon), a third line under name and coordinates. */
${L} .fut-fleet { display: flex; align-items: center; gap: 5px; min-width: 0; margin-top: 1px; font: 10px/11px monospace; color: #F2A3A3; white-space: nowrap; overflow: hidden; }
${L} .fut-fleet-m { display: inline-flex; align-items: center; gap: 2px; color: #D8A0A0; }
${L} .fut-fleet-m svg { flex: none; opacity: 0.8; }
${L}.fut-mode-compact .fut-fleet-m { display: none; }
.fut-totals .fut-fleetrow .fut-tname { color: #FFA0A0; }

/* Moon: its own tile on the right of the same row. */
${L} a.moonlink {
  position: relative !important; display: flex !important; align-items: center; justify-content: flex-end;
  left: auto !important; top: auto !important; right: auto !important; bottom: auto !important;
  flex-shrink: 0; width: ${MOON_W}px !important; height: 100% !important; margin: 0 !important; padding: 0 2px 0 0 !important;
  box-sizing: border-box; background: #16243A !important; border-left: 1px solid #22344F; text-decoration: none !important;
}
${L} a.moonlink:hover { background: #1D3350 !important; }
${L} a.moonlink .planetBarSpaceObjectContainer {
  position: absolute !important; left: 3px !important; top: 6px !important; width: 16px !important; height: 16px !important;
  display: flex !important; align-items: center; justify-content: center; margin: 0 !important;
}
${L} a.moonlink img.icon-moon { position: static !important; width: 16px !important; height: 16px !important; margin: 0 !important; }
${L} a.moonlink .fut-res { width: 46px; }
${L} .fut-nomoon { flex-shrink: 0; width: ${MOON_W}px; border-left: 1px solid #1A2638; background: #0D1522; }

/* Skin that failed to load (game CDN 502): a plain sphere keeps the row's shape. */
${L} img.fut-noskin { visibility: hidden; }
${L} .planetBarSpaceObjectContainer:has(img.fut-noskin) {
  border-radius: 50%; background: radial-gradient(circle at 35% 35%, #8A9BB0, #2A3A50 65%, #0A111C) !important;
}

/* Selection: the body you are on (planet OR moon) gets a cyan frame and a bar on the left. */
${L} a.planetlink.active, ${L} a.moonlink.active {
  background: rgba(79,209,232,0.18) !important; box-shadow: inset 0 0 0 1px #4FD1E8, inset 3px 0 0 #4FD1E8 !important;
}
${L} a.planetlink.active .planet-name { color: #8BE4F2 !important; }

/* Data age: minutes since this body's numbers were last read (green < 15, amber < 30, red after). */
${L} .fut-age {
  position: absolute; left: 1px; top: 1px; z-index: 2; min-width: 14px; padding: 0 2px; border-radius: 4px;
  font: 700 11px/13px Arial, sans-serif; text-align: center; background: rgba(5,10,18,0.85); pointer-events: none;
}
${L} a.moonlink .fut-age { left: 1px; top: auto; bottom: 1px; }
${L} .fut-age-fresh { color: #38C56E; }
${L} .fut-age-warm { color: #E3BB28; }
${L} .fut-age-old { color: #EF7676; }

/* What is being built: one dot per queue kind (OGLight colours) where the game's wrench was; details in the tooltip. */
${L} .smallplanet .constructionIcon { display: none !important; }
${L} .fut-queue { position: absolute; left: 2px; bottom: 2px; z-index: 2; display: flex; gap: 2px; padding: 2px; border-radius: 6px; background: rgba(5,10,18,0.85); }
/* The plan: a slim column at the outer end of each row, right of the moon; one tile per planned body
   (planet on top, moon below), coloured by where its resources stand. */
${L} .fut-plancol { flex-shrink: 0; display: flex; flex-direction: column; width: 20px; border-left: 1px solid #1A2638; background: #0D1522; }
${L} .fut-plancol > span { flex: 1; min-height: 0; }
${L} .fut-plancol > :last-child { border-top: 1px solid #1A2638; }
${L} .fut-plan { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1px;
  font: 700 12px/12px Arial, sans-serif; cursor: pointer; background: color-mix(in srgb, currentColor 18%, #0D1522); outline: none; }
${L} .fut-plan:hover, ${L} .fut-plan:focus-visible { background: color-mix(in srgb, currentColor 32%, #0D1522); }
${L} .fut-plan svg { display: block; }
${L}.fut-mode-compact .fut-plancol { display: none; }
${L} .fut-plan-missing { color: #EF7676; }
${L} .fut-plan-arriving { color: #4FD1E8; }
${L} .fut-plan-arrived { color: #E3BB28; }
${L} .fut-plan-ready { color: #38C56E; }
${L} .fut-plan-unknown { color: #8592A1; }
${L} .fut-q { display: block; width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
${L} a.moonlink .fut-queue { left: 2px; bottom: auto; top: 1px; padding: 1px 2px; }
${L} a.moonlink .fut-q { width: 5px; height: 5px; }
${L} .fut-q-building { color: #FF8200; }
${L} .fut-q-research { color: #32FB2F; }
${L} .fut-q-ship { color: #FFEB00; }
${L} .fut-q-lfbuilding { color: #FF79BD; }
${L} .fut-q-lfresearch { color: #42AFFF; }
${L} .fut-q-unknown { color: #4FD1E8; }
/* The game's attack alert keeps its place on the skin. */
${L} .smallplanet a.alert {
  position: absolute !important; left: 1px !important; top: auto !important; bottom: 1px !important; right: auto !important; z-index: 3;
  width: 12px !important; height: 12px !important; border-radius: 50%; box-shadow: 0 0 0 1px #0A111C;
}

/* Compact: the game's width. Coordinates over the planet's skin (no name), the numbers, the moon as a square button. */
${L}.fut-mode-compact a.planetlink { padding: 0 2px 0 3px !important; gap: 2px; }
${L}.fut-mode-compact a.planetlink .planetBarSpaceObjectContainer { left: -10px !important; opacity: 0.4; }
${L}.fut-mode-compact .fut-name .planet-name { display: none !important; }
${L}.fut-mode-compact .fut-name .planet-koords { font-size: 11px !important; letter-spacing: -0.4px; color: #E6EDF5 !important; text-overflow: clip; }
${L}.fut-mode-compact .fut-res { width: 38px; }
${L}.fut-mode-compact .fut-cell { padding: 0 1px; }
${L}.fut-mode-compact .fut-nomoon { width: 22px; }
${L}.fut-mode-compact a.moonlink { width: 22px !important; padding: 0 !important; justify-content: center; }
${L}.fut-mode-compact a.moonlink .fut-res, ${L}.fut-mode-compact a.moonlink .fut-age { display: none; }
${L}.fut-mode-compact a.moonlink .planetBarSpaceObjectContainer { position: static !important; width: 16px !important; height: 16px !important; }

/* Toolbar: replaces the colony counter. Two tiles side by side (production → Dashboard, plan → Piano),
   name on top and number below; sync and settings stacked on the right. */
#planetbarcomponent .fut-toolbar {
  box-sizing: border-box; display: grid !important; height: auto !important; padding: 0 !important; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) 26px; margin: 0 0 3px;
  border: 1px solid #1F2C40; border-radius: 7px; background: #111B2A; overflow: hidden;
}
#planetbarcomponent .fut-toolbar .fut-cell {
  box-sizing: border-box !important; height: 40px !important; width: auto !important; box-shadow: none !important; border-radius: 0 !important; font: inherit;
  display: flex; flex-direction: column; align-items: stretch; justify-content: center; gap: 3px; min-width: 0; padding: 0 6px 0 8px; margin: 0;
  border: 0 !important; border-right: 1px solid #1F2C40 !important; background: none !important; color: inherit; text-align: left; cursor: pointer;
}
#planetbarcomponent .fut-toolbar .fut-cell:hover:not(:disabled) { background: #16243A !important; }
#planetbarcomponent .fut-toolbar .fut-cell:hover:not(:disabled) .fut-cell-k { color: #E6EDF5; }
#planetbarcomponent .fut-toolbar .fut-cell:focus-visible, #planetbarcomponent .fut-tool:focus-visible { outline: 1px solid #4FD1E8; outline-offset: -2px; }
#planetbarcomponent .fut-toolbar .fut-cell:disabled { cursor: default; }
#planetbarcomponent .fut-cell-t { display: flex; align-items: center; gap: 5px; min-width: 0; }
#planetbarcomponent .fut-cell-i { flex: none; display: inline-flex; color: #8A9BB0; }
#planetbarcomponent .fut-cell-k { min-width: 0; font: 11px/12px Arial, sans-serif; color: #9AA9BC; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
#planetbarcomponent .fut-cell-v { min-width: 0; font: 700 12px/14px Consolas, "JetBrains Mono", monospace; color: #E6EDF5; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
#planetbarcomponent .fut-cell-v small { font: 10px/14px Arial, sans-serif; letter-spacing: -0.2px; color: #8A9BB0; font-weight: 400; }
#planetbarcomponent .fut-cell-v.fut-warn { color: #F5B547; } #planetbarcomponent .fut-cell-v.fut-ok { color: #4FE0B0; }
#planetbarcomponent .fut-side { display: flex; flex-direction: column; grid-column: 3; grid-row: 1; }
#planetbarcomponent .fut-tool {
  position: relative; flex: 1; display: flex; align-items: center; justify-content: center; width: 100%; padding: 0;
  border: 0 !important; border-radius: 0 !important; background: none !important; box-shadow: none !important; color: #8A9BB0; cursor: pointer; height: auto !important; min-height: 0 !important;
}
#planetbarcomponent .fut-tool + .fut-tool { border-top: 1px solid #1F2C40 !important; }
#planetbarcomponent .fut-tool svg { width: 13px; height: 13px; }
#planetbarcomponent .fut-tool:hover { background: #16243A !important; color: #E6EDF5; }
#planetbarcomponent .fut-tool:disabled { opacity: 0.35; cursor: default; background: none; }
#planetbarcomponent .fut-tool[aria-expanded="true"] { background: #12283A !important; color: #4FD1E8; }
#planetbarcomponent .fut-tool.fut-stale { color: #F5B547; }
#planetbarcomponent .fut-tool.fut-failed { color: #E5534B; }
#planetbarcomponent .fut-tool.fut-busy svg { animation: fut-spin 1s linear infinite; }
/* Game width: no room for the names, the icon and the tooltip say what the number is. */
#planetbarcomponent:not(.fut-wide) .fut-toolbar .fut-cell { padding: 0 5px; }
#planetbarcomponent:not(.fut-wide) .fut-cell-k, #planetbarcomponent:not(.fut-wide) .fut-cell-v small { display: none; }
#planetbarcomponent:not(.fut-wide) .fut-cell-v { font-size: 11px; }
@keyframes fut-spin { to { transform: rotate(360deg); } }


/* Totals: a table, resource by resource: in stock now, made in a day. Numbers in one bright colour, right-aligned. */
.fut-totals {
  box-sizing: border-box; margin-top: 4px; padding: 2px 8px 4px; border-radius: 7px; border: 1px solid #1F2C40; background: #111B2A;
  font: 12px/1.3 Arial, Helvetica, sans-serif; font-variant-numeric: tabular-nums;
}
.fut-totals .fut-trow { display: grid; grid-template-columns: minmax(0, 1fr) 58px 62px; align-items: center; gap: 6px; min-height: 20px; padding: 2px 0; }
.fut-totals .fut-trow + .fut-trow { border-top: 1px solid #16202F; }
.fut-totals .fut-thead { min-height: 0; color: #9AA9BC; font-size: 11px; }
.fut-totals .fut-thead + .fut-trow { border-top-color: #1F2C40; }
.fut-totals .fut-tname { display: flex; align-items: center; gap: 6px; min-width: 0; white-space: nowrap; overflow: hidden; }
.fut-totals .fut-tico { flex: none; display: inline-flex; }
.fut-totals .fut-tlabel { min-width: 0; overflow: hidden; text-overflow: ellipsis; color: #C9D4E2; }
.fut-totals .fut-msu .fut-tlabel { color: #4FD1E8; }
.fut-totals .fut-tnum { text-align: right; white-space: nowrap; color: #E6EDF5; font: 700 12px Consolas, "JetBrains Mono", monospace; }
.fut-totals .fut-tnum:last-child { color: #B4C2D3; font-weight: 400; }
.fut-totals .fut-thead .fut-tnum { color: inherit; font: inherit; }
.fut-totals .fut-msu { border-top-color: #2C3E57 !important; }
.fut-totals .fut-msu .fut-tname { color: #4FD1E8; font-weight: 700; }
.fut-totals .fut-msu .fut-tnum:last-child { color: #E6EDF5; }
#planetbarcomponent:not(.fut-wide) .fut-totals { padding: 2px 4px 4px; }
#planetbarcomponent:not(.fut-wide) .fut-totals .fut-trow { grid-template-columns: 13px minmax(0, 1fr) minmax(0, 1fr); gap: 3px; }
#planetbarcomponent:not(.fut-wide) .fut-totals .fut-tlabel { display: none; }
#planetbarcomponent:not(.fut-wide) .fut-totals .fut-tnum { font-size: 11px; }

/* The plan's hover card, in the game's tooltip style (dark blue gradient, thin frame, centred title). */
.fut-plan-tip { position: fixed; z-index: 100000; min-width: 170px; max-width: 260px; padding: 10px 12px; box-sizing: border-box;
  border: 1px solid #2C3E57; border-radius: 6px; background: linear-gradient(180deg, #1C2A3A 0%, #0F1923 100%);
  box-shadow: 0 6px 18px rgba(0,0,0,0.6); color: #C9D4E2; font: 11px/1.45 Verdana, Arial, sans-serif; pointer-events: none; }
.fut-plan-tip .fut-pt-head { display: flex; flex-direction: column; align-items: center; margin-bottom: 6px; }
.fut-plan-tip .fut-pt-head b { color: #fff; font-size: 13px; }
.fut-plan-tip .fut-pt-head span { color: #8592A1; font-size: 10px; }
.fut-plan-tip .fut-pt-title { display: flex; align-items: center; gap: 5px; padding: 4px 0 3px; border-top: 1px solid #2C3E57; color: #9AA9BC; font-weight: 700; }
.fut-plan-tip .fut-pt-items { margin: 0 0 6px; padding: 0; list-style: none; }
.fut-plan-tip .fut-pt-items li { padding: 1px 0 1px 8px; color: #6F9FC8; position: relative; }
.fut-plan-tip .fut-pt-items li::before { content: ""; position: absolute; left: 0; top: 7px; width: 3px; height: 3px; border-radius: 50%; background: #4A6683; }
.fut-plan-tip .fut-pt-status { padding-top: 5px; border-top: 1px solid #2C3E57; }
.fut-plan-tip .fut-pt-say { font-weight: 700; }
.fut-plan-tip.fut-plan-missing .fut-pt-say { color: #EF7676; }
.fut-plan-tip.fut-plan-arriving .fut-pt-say, .fut-plan-tip .fut-pt-sent { color: #4FD1E8 !important; }
.fut-plan-tip.fut-plan-arrived .fut-pt-say { color: #E3BB28; }
.fut-plan-tip.fut-plan-ready .fut-pt-say { color: #38C56E; }
.fut-plan-tip.fut-plan-unknown .fut-pt-say { color: #8592A1; }
.fut-plan-tip .fut-pt-sent { margin-top: 4px; }
.fut-plan-tip .fut-pt-res { display: flex; flex-wrap: wrap; gap: 4px 10px; margin-top: 2px; font: 700 11px Consolas, monospace; }
.fut-plan-tip .fut-pt-res span { display: inline-flex; align-items: center; gap: 3px; }
.fut-plan-tip .fut-pt-metal { color: #B8C2CC; } .fut-plan-tip .fut-pt-crystal { color: #7FB8FF; } .fut-plan-tip .fut-pt-deuterium { color: #4FE0B0; }
`;