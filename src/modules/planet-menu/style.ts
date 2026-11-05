/**
 * Styles for the decorated planet list, written against the real game markup
 * (#planetbarcomponent > #rechts > #cutty > #myPlanets > #planetList > .smallplanet).
 * The game positions everything absolutely with its own rules, so ours use two ids
 * plus !important on layout properties to win reliably.
 */
export const MENU_WIDTH = 236;
/** Native width of the planet column (#rechts) in OGame 13. */
export const NATIVE_WIDTH = 137;

const L = '#planetbarcomponent #planetList.fut-menu';

export const PLANET_MENU_CSS = `
#planetbarcomponent.fut-wide #rechts,
#planetbarcomponent.fut-wide #cutty,
#planetbarcomponent.fut-wide #myPlanets { width: ${MENU_WIDTH}px !important; }

/* GRAY AREA: requires ToolDev approval before publishing — see AGENTS.md §1.7 / §3.
   The wider menu would sit under the skyscraper banner, so the banner is shifted right
   by exactly the extra width, as tolerated OGLight does (margin-left on the banner
   component). The banner is never hidden, resized, faded or covered. */
body.fut-banner-shift #bannerskyscrapercomponent { margin-left: ${MENU_WIDTH - NATIVE_WIDTH + 8}px !important; }

#planetbarcomponent:not(.fut-wide) #planetList.fut-menu,
#planetbarcomponent:not(.fut-wide) .fut-menu-bar,
#planetbarcomponent:not(.fut-wide) .fut-totals { width: ${NATIVE_WIDTH}px !important; }
${L} { width: 100% !important; display: flex !important; flex-direction: column; gap: 4px; padding: 0 !important; background: none !important; }
${L} .smallplanet.fut-row {
  position: relative !important; display: flex !important; flex-direction: column;
  width: 100% !important; height: auto !important; min-height: 0 !important; margin: 0 !important; padding: 0 !important;
  border: 1px solid #1F2C40; border-radius: 10px; background: #111B2A !important; overflow: hidden; box-sizing: border-box;
}
${L} .smallplanet.fut-current { border-color: #4FD1E8; background: #12283A !important; }

${L} a.planetlink {
  position: relative !important; display: flex !important; align-items: center; gap: 4px;
  left: auto !important; top: auto !important; width: 100% !important; height: 40px !important;
  padding: 0 6px 0 46px !important; margin: 0 !important; box-sizing: border-box; overflow: hidden !important;
  background: none !important; text-decoration: none !important;
}
${L} a.planetlink:hover { background: rgba(79,209,232,0.08) !important; }
${L} a.planetlink .planetBarSpaceObjectContainer {
  position: absolute !important; left: -8px !important; top: -6px !important;
  width: 52px !important; height: 52px !important; margin: 0 !important;
}
${L} a.planetlink .planetBarSpaceObjectHighlightContainer { display: none !important; }
${L} a.planetlink img.planetPic {
  position: static !important; width: 52px !important; height: 52px !important; margin: 0 !important;
}
${L} .fut-name {
  position: relative; width: 74px; flex-shrink: 0; display: flex; flex-direction: column; gap: 1px;
  text-shadow: 0 1px 2px #000, 0 0 5px #000;
}
${L} .fut-name .planet-name,
${L} .fut-name .planet-koords {
  position: static !important; display: block !important; margin: 0 !important; padding: 0 !important;
  width: auto !important; max-width: none !important; height: auto !important; line-height: 1.2 !important;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-align: left !important; background: none !important;
}
${L} .fut-name .planet-name { font: 700 11px Arial, sans-serif !important; color: #E6EDF5 !important; }
${L} .fut-name .planet-koords { font: 10px monospace !important; color: #C9D4E2 !important; }
${L} .fut-current .fut-name .planet-name { color: #8BE4F2 !important; }

${L} .fut-res {
  position: relative; flex: 1; min-width: 0; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 2px; font: 10px monospace; text-align: right; line-height: 1;
}
${L} .fut-m, .fut-totals .fut-m { color: #B8C2CC; }
${L} .fut-c, .fut-totals .fut-c { color: #7FB8FF; }
${L} .fut-d, .fut-totals .fut-d { color: #4FE0B0; }
${L} .fut-full { color: #F5B547 !important; font-weight: 700; }
${L} .fut-missing { color: #8A9BB0; }

${L} a.moonlink {
  position: relative !important; display: flex !important; align-items: center; gap: 4px;
  left: auto !important; top: auto !important; right: auto !important; bottom: auto !important;
  width: 100% !important; height: 24px !important; margin: 0 !important; padding: 0 6px 0 22px !important;
  box-sizing: border-box; background: #16243A !important; border-top: 1px solid #22344F; text-decoration: none !important;
}
${L} a.moonlink:hover { background: #1D3350 !important; }
${L} a.moonlink .planetBarSpaceObjectContainer {
  position: absolute !important; left: 4px !important; top: 3px !important; width: 16px !important; height: 16px !important;
  display: flex !important; align-items: center; justify-content: center; margin: 0 !important;
}
${L} a.moonlink .planetBarSpaceObjectHighlightContainer { display: none !important; }
${L} a.moonlink img.icon-moon { position: static !important; width: 16px !important; height: 16px !important; margin: 0 !important; }
${L} .fut-moon-label { width: 70px; flex-shrink: 0; padding-left: 2px; font: 700 10px Arial, sans-serif; color: #C9D4E2; }

${L} .smallplanet .constructionIcon,
${L} .smallplanet a.alert { position: absolute !important; right: 4px !important; top: 2px !important; left: auto !important; z-index: 2; }

/* Compact mode: one 36px row, the moon as a square button on the right. */
${L}.fut-mode-compact .smallplanet.fut-row { flex-direction: row; }
${L}.fut-mode-compact a.planetlink { flex: 1; min-width: 0; width: auto !important; height: 36px !important; padding-left: 40px !important; }
${L}.fut-mode-compact a.planetlink .planetBarSpaceObjectContainer,
${L}.fut-mode-compact a.planetlink img.planetPic { width: 44px !important; height: 44px !important; }
${L}.fut-mode-compact .fut-res,
${L}.fut-mode-compact .fut-moon-label { display: none; }
${L}.fut-mode-compact .fut-name { width: auto; flex: 1; min-width: 0; }
#planetbarcomponent:not(.fut-wide) #planetList.fut-menu .fut-name .planet-koords { font-size: 9px !important; }
${L}.fut-mode-compact a.moonlink {
  width: 36px !important; height: 36px !important; flex-shrink: 0; padding: 0 !important; justify-content: center;
  border-top: 0; border-left: 1px solid #22344F;
}
${L}.fut-mode-compact a.moonlink .planetBarSpaceObjectContainer { left: 8px !important; top: 8px !important; width: 20px !important; height: 20px !important; }
${L}.fut-mode-compact a.moonlink img.icon-moon { width: 20px !important; height: 20px !important; }

.fut-menu-bar { display: flex; gap: 4px; margin: 4px 0 6px; }
.fut-menu-bar button {
  flex: 1; height: 26px; border-radius: 8px; border: 1px solid #1F2C40; background: #0A111C;
  color: #B4C2D3; font: 11px Arial, sans-serif; cursor: pointer;
}
.fut-menu-bar button[aria-pressed="true"] { border-color: #4FD1E8; background: #12283A; color: #E6EDF5; font-weight: 700; }
.fut-totals {
  box-sizing: border-box; margin-top: 6px; padding: 8px; border-radius: 10px;
  border: 1px solid #1F2C40; background: #111B2A; display: grid; grid-template-columns: 1fr auto;
  gap: 3px 6px; font: 10px monospace;
}
.fut-totals .fut-rate { color: #8A9BB0; text-align: right; }
.fut-totals .fut-msu { color: #4FD1E8; }
`;
