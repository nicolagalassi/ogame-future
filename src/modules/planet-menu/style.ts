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
${L} { width: 100% !important; display: flex !important; flex-direction: column; gap: 3px; padding: 0 !important; background: none !important; }
${L} .smallplanet.fut-row {
  position: relative !important; display: flex !important; flex-direction: column;
  width: 100% !important; height: auto !important; min-height: 0 !important; margin: 0 !important; padding: 0 !important;
  border: 1px solid #1F2C40; border-radius: 8px; background: #111B2A !important; overflow: hidden; box-sizing: border-box;
}
${L} .smallplanet.fut-current { border-color: #2C5A73; }

/* Planet row: 30px, small skin behind the name (text overlaps it, as in the mock-up). */
${L} a.planetlink {
  position: relative !important; display: flex !important; align-items: center; gap: 3px;
  left: auto !important; top: auto !important; width: 100% !important; height: 30px !important;
  padding: 0 12px 0 22px !important; margin: 0 !important; box-sizing: border-box; overflow: hidden !important;
  background: none !important; text-decoration: none !important;
}
${L} a.planetlink:hover { background: rgba(79,209,232,0.08) !important; }
${L} a.planetlink .planetBarSpaceObjectContainer {
  position: absolute !important; left: -6px !important; top: -2px !important;
  width: 34px !important; height: 34px !important; margin: 0 !important; opacity: 0.85;
}
${L} a.planetlink .planetBarSpaceObjectHighlightContainer { display: none !important; }
${L} a.planetlink img.planetPic {
  position: static !important; width: 34px !important; height: 34px !important; margin: 0 !important;
}
${L} .fut-name {
  position: relative; width: 72px; flex-shrink: 0; display: flex; flex-direction: column;
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

${L} .fut-res {
  position: relative; flex: 1; min-width: 0; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 3px; font: 10px monospace; text-align: right; line-height: 1;
}
/* One cell = number + thin storage-fill bar under it. */
${L} .fut-cell { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
${L} .fut-num { white-space: nowrap; overflow: hidden; }
${L} .fut-bar { display: block; height: 2px; border-radius: 1px; background: rgba(255,255,255,0.12); overflow: hidden; }
${L} .fut-bar-fill { display: block; height: 100%; background: currentColor; opacity: 0.75; }
${L} .fut-m, .fut-totals .fut-m { color: #B8C2CC; }
${L} .fut-c, .fut-totals .fut-c { color: #7FB8FF; }
${L} .fut-d, .fut-totals .fut-d { color: #4FE0B0; }
${L} .fut-full { color: #F5B547 !important; font-weight: 700; }
${L} .fut-full .fut-bar-fill { opacity: 1; }
${L} .fut-missing { color: #8A9BB0; }

/* Moon row: 22px, 14px moon image. */
${L} a.moonlink {
  position: relative !important; display: flex !important; align-items: center; gap: 3px;
  left: auto !important; top: auto !important; right: auto !important; bottom: auto !important;
  width: 100% !important; height: 22px !important; margin: 0 !important; padding: 0 12px 0 22px !important;
  box-sizing: border-box; background: #16243A !important; border-top: 1px solid #22344F; text-decoration: none !important;
}
${L} a.moonlink:hover { background: #1D3350 !important; }
${L} a.moonlink .planetBarSpaceObjectContainer {
  position: absolute !important; left: 4px !important; top: 3px !important; width: 14px !important; height: 14px !important;
  display: flex !important; align-items: center; justify-content: center; margin: 0 !important;
}
${L} a.moonlink .planetBarSpaceObjectHighlightContainer { display: none !important; }
${L} a.moonlink img.icon-moon { position: static !important; width: 14px !important; height: 14px !important; margin: 0 !important; }
${L} .fut-moon-label { width: 72px; flex-shrink: 0; font: 700 10px Arial, sans-serif; color: #C9D4E2; text-align: left; line-height: 1; }
${L} a.moonlink .fut-res, ${L} a.planetlink .fut-res { align-self: center; }
${L} a.moonlink .fut-res { font-size: 9px; }

/* Selection: the body you are on (planet OR moon) gets a cyan frame and a bar on the left. */
${L} a.planetlink.active, ${L} a.moonlink.active {
  background: rgba(79,209,232,0.18) !important; box-shadow: inset 0 0 0 1px #4FD1E8, inset 3px 0 0 #4FD1E8 !important;
}
${L} a.planetlink.active .planet-name, ${L} a.moonlink.active .fut-moon-label { color: #8BE4F2 !important; }

/* Queue: the game's own construction icon (kept clickable), or an amber dot when idle. */
${L} .smallplanet .constructionIcon,
${L} .smallplanet a.alert {
  position: absolute !important; right: 1px !important; top: 1px !important; left: auto !important; z-index: 2;
  width: 12px !important; height: 12px !important; border-radius: 50%;
  background-color: rgba(79,209,232,0.35) !important; box-shadow: 0 0 4px rgba(79,209,232,0.8);
}
${L}:not(.fut-mode-compact) .smallplanet a.constructionIcon.moon { top: 36px !important; }
${L}.fut-mode-compact .smallplanet a.constructionIcon { right: 34px !important; top: 3px !important; }
${L}.fut-mode-compact .smallplanet a.constructionIcon.moon { right: 2px !important; }
${L} .fut-idle {
  position: absolute; right: 3px; top: 4px; width: 6px; height: 6px; border-radius: 50%;
  background: #F5B547; box-shadow: 0 0 4px rgba(245,181,71,0.8);
}

/* Compact mode: one 30px row, the moon as a square button on the right. */
${L}.fut-mode-compact .smallplanet.fut-row { flex-direction: row; }
${L}.fut-mode-compact a.planetlink { flex: 1; min-width: 0; width: auto !important; height: 30px !important; padding-left: 26px !important; }
${L}.fut-mode-compact a.planetlink .planetBarSpaceObjectContainer,
${L}.fut-mode-compact a.planetlink img.planetPic { width: 34px !important; height: 34px !important; }
${L}.fut-mode-compact .fut-res,
${L}.fut-mode-compact .fut-moon-label { display: none; }
${L}.fut-mode-compact .fut-name { width: auto; flex: 1; min-width: 0; }
#planetbarcomponent:not(.fut-wide) #planetList.fut-menu .fut-name .planet-koords { font-size: 9px !important; }
${L}.fut-mode-compact a.moonlink {
  width: 30px !important; height: 30px !important; flex-shrink: 0; padding: 0 !important; justify-content: center;
  border-top: 0; border-left: 1px solid #22344F;
}
${L}.fut-mode-compact a.moonlink .planetBarSpaceObjectContainer { left: 6px !important; top: 6px !important; width: 18px !important; height: 18px !important; }
${L}.fut-mode-compact a.moonlink img.icon-moon { width: 18px !important; height: 18px !important; }

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
