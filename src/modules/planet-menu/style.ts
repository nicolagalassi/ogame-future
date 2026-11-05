/**
 * Styles for the decorated planet list. Every rule is scoped to #planetList.fut-menu
 * or to Future's own elements: nothing else on the page changes, and banners, shop,
 * merchant and footer are never touched (AGENTS.md §1.7).
 */
export const PLANET_MENU_CSS = `
#planetList.fut-menu { width: 232px; display: flex; flex-direction: column; gap: 4px; }
#planetList.fut-menu .smallplanet.fut-row {
  position: relative; display: flex; flex-direction: column; width: auto; height: auto !important;
  margin: 0; border: 1px solid #1F2C40; border-radius: 10px; background: #111B2A; overflow: hidden;
}
#planetList.fut-menu .smallplanet.fut-current { border-color: #4FD1E8; background: rgba(79,209,232,0.10); }
#planetList.fut-menu a.planetlink {
  position: relative !important; display: flex !important; align-items: center; gap: 6px;
  width: auto !important; height: 40px !important; padding: 0 8px 0 10px; overflow: hidden;
  left: auto !important; top: auto !important; text-decoration: none;
}
#planetList.fut-menu a.planetlink:hover { background: rgba(79,209,232,0.08); }
#planetList.fut-menu a.planetlink img.planetPic {
  position: absolute !important; left: -10px !important; top: -8px !important;
  width: 56px !important; height: 56px !important; margin: 0 !important;
}
#planetList.fut-menu .fut-name {
  position: relative; width: 78px; flex-shrink: 0; display: flex; flex-direction: column;
  text-shadow: 0 1px 3px #000, 0 0 6px rgba(0,0,0,0.9);
}
#planetList.fut-menu .fut-name .planet-name,
#planetList.fut-menu .fut-name .planet-koords {
  position: static !important; display: block !important; margin: 0 !important; width: auto !important;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-align: left !important;
}
#planetList.fut-menu .fut-name .planet-name { font: 700 12px Inter, Arial, sans-serif; color: #E6EDF5; }
#planetList.fut-menu .fut-name .planet-koords { font: 500 10px monospace; color: #D0DAE6; }
#planetList.fut-menu .fut-res {
  position: relative; flex: 1; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 3px; font: 500 10px monospace; text-align: right;
}
#planetList.fut-menu .fut-m { color: #B8C2CC; }
#planetList.fut-menu .fut-c { color: #7FB8FF; }
#planetList.fut-menu .fut-d { color: #4FE0B0; }
#planetList.fut-menu .fut-full { color: #F5B547; font-weight: 700; }
#planetList.fut-menu .fut-missing { color: #8A9BB0; }
#planetList.fut-menu a.moonlink {
  position: relative !important; display: flex !important; align-items: center; gap: 6px;
  left: auto !important; top: auto !important; width: auto !important; height: 26px !important;
  padding: 0 8px 0 10px; background: #16243A; border-top: 1px solid #22344F; text-decoration: none;
}
#planetList.fut-menu a.moonlink:hover { background: rgba(79,209,232,0.20); }
#planetList.fut-menu a.moonlink img.icon-moon {
  position: static !important; width: 16px !important; height: 16px !important; margin: 0 !important;
}
#planetList.fut-menu .fut-moon-label { width: 56px; flex-shrink: 0; font: 600 10px Inter, Arial, sans-serif; color: #C9D4E2; }
#planetList.fut-menu .constructionIcon { position: absolute !important; right: 4px !important; top: 2px !important; left: auto !important; }

/* Compact mode: one 40px row, the moon becomes a square button on the right. */
#planetList.fut-menu.fut-mode-compact .smallplanet.fut-row { flex-direction: row; height: 40px !important; }
#planetList.fut-menu.fut-mode-compact a.planetlink { flex: 1; min-width: 0; }
#planetList.fut-menu.fut-mode-compact .fut-res,
#planetList.fut-menu.fut-mode-compact .fut-moon-label { display: none; }
#planetList.fut-menu.fut-mode-compact .fut-name { width: auto; flex: 1; min-width: 0; padding-left: 34px; }
#planetList.fut-menu.fut-mode-compact a.planetlink img.planetPic { width: 40px !important; height: 40px !important; top: 0 !important; left: -6px !important; }
#planetList.fut-menu.fut-mode-compact a.moonlink {
  width: 40px !important; height: 40px !important; justify-content: center; padding: 0;
  border-top: 0; border-left: 1px solid #22344F;
}
#planetList.fut-menu.fut-mode-compact a.moonlink img.icon-moon { width: 22px !important; height: 22px !important; }

.fut-menu-bar { display: flex; gap: 4px; margin: 0 0 6px; width: 232px; }
.fut-menu-bar button {
  flex: 1; height: 28px; border-radius: 8px; border: 1px solid #1F2C40; background: #0A111C;
  color: #B4C2D3; font: 500 11px Inter, Arial, sans-serif; cursor: pointer;
}
.fut-menu-bar button[aria-pressed="true"] { border-color: #4FD1E8; background: rgba(79,209,232,0.12); color: #E6EDF5; font-weight: 600; }
.fut-totals {
  width: 232px; box-sizing: border-box; margin-top: 6px; padding: 8px; border-radius: 10px;
  border: 1px solid #1F2C40; background: #111B2A; display: grid; grid-template-columns: 1fr auto;
  gap: 2px 6px; font: 500 10px monospace;
}
.fut-totals .fut-rate { color: #8A9BB0; text-align: right; }
.fut-totals .fut-m { color: #B8C2CC; }
.fut-totals .fut-c { color: #7FB8FF; }
.fut-totals .fut-d { color: #4FE0B0; }
.fut-totals .fut-msu { color: #4FD1E8; }
`;
