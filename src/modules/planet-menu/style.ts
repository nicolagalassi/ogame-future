/**
 * Styles for the decorated planet list, written against the real game markup
 * (#planetbarcomponent > #rechts > #cutty > #myPlanets > #planetList > .smallplanet).
 * The game positions everything absolutely with its own rules, so ours use two ids
 * plus !important on layout properties to win reliably.
 */
/** Width of the side-by-side menu: the same as tolerated OGLight (#myPlanets 208px). */
export const MENU_WIDTH = 208;
/** Native width of the planet column (#rechts) in OGame 13. */
export const NATIVE_WIDTH = 137;

const L = '#planetbarcomponent #planetList.fut-menu';
const MOON_W = 58;

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
#planetbarcomponent:not(.fut-wide) .fut-settings,
#planetbarcomponent:not(.fut-wide) .fut-totals { width: ${NATIVE_WIDTH}px !important; }
${L} { width: 100% !important; display: flex !important; flex-direction: column; gap: 2px; padding: 0 !important; background: none !important; }
${L} .smallplanet.fut-row {
  position: relative !important; display: flex !important; flex-direction: row; align-items: stretch;
  width: 100% !important; height: 34px !important; min-height: 0 !important; margin: 0 !important; padding: 0 !important;
  border: 1px solid #1F2C40; border-radius: 7px; background: #111B2A !important; overflow: hidden; box-sizing: border-box;
}
${L} .smallplanet.fut-current { border-color: #2C5A73; }

/* Planet: small skin behind name and coords, resources in a column on the right. */
${L} a.planetlink {
  position: relative !important; display: flex !important; align-items: center; gap: 3px;
  left: auto !important; top: auto !important; flex: 1; min-width: 0; width: auto !important; height: 100% !important;
  padding: 0 4px 0 24px !important; margin: 0 !important; box-sizing: border-box; overflow: hidden !important;
  background: none !important; text-decoration: none !important;
}
${L} a.planetlink:hover { background: rgba(79,209,232,0.08) !important; }
${L} a.planetlink .planetBarSpaceObjectContainer {
  position: absolute !important; left: -6px !important; top: -1px !important;
  width: 34px !important; height: 34px !important; margin: 0 !important; opacity: 0.85;
}
${L} .planetBarSpaceObjectHighlightContainer { display: none !important; }
${L} a.planetlink img.planetPic { position: static !important; width: 34px !important; height: 34px !important; margin: 0 !important; }
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
${L} .fut-name .planet-koords { font: 9px monospace !important; color: #C9D4E2 !important; }

/* Resources: one per line (metal, crystal, deuterium). */
${L} .fut-res {
  position: relative; flex-shrink: 0; width: 42px; display: flex; flex-direction: column; justify-content: center;
  gap: 0; font: 9px/10px monospace; text-align: right;
}
${L} .fut-cell { display: block; padding: 0 2px; border-radius: 2px; white-space: nowrap; overflow: hidden; }
/* Storage fill painted behind the number (planets only): no extra space needed. */
${L} .fut-cell.fut-has-fill {
  background: linear-gradient(90deg, color-mix(in srgb, currentColor 26%, transparent) var(--fut-fill),
    rgba(255,255,255,0.04) var(--fut-fill)) !important;
}
${L} .fut-m, .fut-totals .fut-m { color: #B8C2CC; }
${L} .fut-c, .fut-totals .fut-c { color: #7FB8FF; }
${L} .fut-d, .fut-totals .fut-d { color: #4FE0B0; }
${L} .fut-full { color: #F5B547 !important; font-weight: 700; }
${L} .fut-missing { color: #8A9BB0; }

/* Moon: its own tile on the right of the same row. */
${L} a.moonlink {
  position: relative !important; display: flex !important; align-items: center; justify-content: flex-end;
  left: auto !important; top: auto !important; right: auto !important; bottom: auto !important;
  flex-shrink: 0; width: ${MOON_W}px !important; height: 100% !important; margin: 0 !important; padding: 0 2px 0 0 !important;
  box-sizing: border-box; background: #16243A !important; border-left: 1px solid #22344F; text-decoration: none !important;
}
${L} a.moonlink:hover { background: #1D3350 !important; }
${L} a.moonlink .planetBarSpaceObjectContainer {
  position: absolute !important; left: 3px !important; top: 9px !important; width: 14px !important; height: 14px !important;
  display: flex !important; align-items: center; justify-content: center; margin: 0 !important;
}
${L} a.moonlink img.icon-moon { position: static !important; width: 14px !important; height: 14px !important; margin: 0 !important; }
${L} a.moonlink .fut-res { width: 38px; }
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

/* Queue: the game's own construction icon (kept clickable) on the skin, or an amber dot when idle. */
${L} .smallplanet .constructionIcon,
${L} .smallplanet a.alert {
  position: absolute !important; left: 1px !important; top: auto !important; bottom: 1px !important; right: auto !important; z-index: 2;
  width: 12px !important; height: 12px !important; border-radius: 50%;
  background-color: rgba(79,209,232,0.35) !important; box-shadow: 0 0 4px rgba(79,209,232,0.8);
}
${L} .smallplanet a.constructionIcon.moon { left: auto !important; right: ${MOON_W - 16}px !important; }
${L} .fut-idle {
  position: absolute; left: 3px; bottom: 3px; width: 6px; height: 6px; border-radius: 50%;
  background: #F5B547; box-shadow: 0 0 4px rgba(245,181,71,0.8);
}

/* Compact: the game's width, 30px rows, no numbers, moon as a square button. */
${L}.fut-mode-compact .smallplanet.fut-row { height: 30px !important; }
${L}.fut-mode-compact a.planetlink { padding-left: 26px !important; }
${L}.fut-mode-compact .fut-res,
${L}.fut-mode-compact .fut-nomoon { display: none; }
${L}.fut-mode-compact a.moonlink { width: 30px !important; padding: 0 !important; }
${L}.fut-mode-compact a.moonlink .planetBarSpaceObjectContainer { left: 6px !important; top: 6px !important; width: 18px !important; height: 18px !important; }
${L}.fut-mode-compact a.moonlink img.icon-moon { width: 18px !important; height: 18px !important; }
${L}.fut-mode-compact .smallplanet a.constructionIcon.moon { right: 16px !important; }

/* Toolbar: replaces the colony counter. */
.fut-toolbar {
  box-sizing: border-box; display: flex; align-items: center; gap: 2px; height: 24px; margin: 0 0 3px; padding: 0 3px 0 8px;
  border: 1px solid #1F2C40; border-radius: 7px; background: linear-gradient(#16243A, #0D1522);
}
.fut-brand { flex: 1; font: 700 11px Arial, sans-serif; letter-spacing: 0.08em; color: #4FD1E8; text-transform: uppercase; cursor: default; }
.fut-tool {
  display: flex; align-items: center; justify-content: center; width: 24px; height: 18px; padding: 0;
  border: 0; border-radius: 5px; background: none; color: #B4C2D3; cursor: pointer;
}
.fut-tool:hover { background: rgba(79,209,232,0.15); color: #E6EDF5; }
.fut-tool:disabled { opacity: 0.35; cursor: default; background: none; }
.fut-tool[aria-expanded="true"] { background: rgba(79,209,232,0.2); color: #4FD1E8; }
.fut-tool.fut-busy svg { animation: fut-spin 1s linear infinite; }
@keyframes fut-spin { to { transform: rotate(360deg); } }

.fut-settings {
  box-sizing: border-box; margin: 0 0 3px; padding: 6px 8px; border: 1px solid #1F2C40; border-radius: 7px;
  background: #111B2A; font: 10px Arial, sans-serif; color: #C9D4E2; display: flex; flex-direction: column; gap: 5px;
}
.fut-settings[hidden] { display: none; }
.fut-set-row { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; }
.fut-set-label { flex: 1 0 100%; color: #8A9BB0; }
.fut-chip {
  flex: 1; height: 20px; border-radius: 5px; border: 1px solid #1F2C40; background: #0A111C;
  color: #B4C2D3; font: 10px Arial, sans-serif; cursor: pointer;
}
.fut-chip[aria-pressed="true"] { border-color: #4FD1E8; background: #12283A; color: #E6EDF5; font-weight: 700; }
.fut-chip:disabled { opacity: 0.4; cursor: default; }
.fut-set-note { color: #8A9BB0; }

.fut-totals {
  box-sizing: border-box; margin-top: 4px; padding: 6px 8px; border-radius: 7px;
  border: 1px solid #1F2C40; background: #111B2A; display: grid; grid-template-columns: 1fr auto;
  gap: 2px 6px; font: 10px monospace;
}
.fut-totals .fut-rate { color: #8A9BB0; text-align: right; }
.fut-totals .fut-msu { color: #4FD1E8; }
`;
