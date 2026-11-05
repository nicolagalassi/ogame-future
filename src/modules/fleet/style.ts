/** Styles for the action bars on the game's fleet page (scoped by fut- class names). */
export const FLEET_CSS = `
.fut-fmenu .fut-moon-ico { margin-right: 4px; vertical-align: -1px; color: #8A9BB0; }
.fut-fbar {
  display: flex; flex-direction: column; gap: 6px; margin: 6px 10px; padding: 8px;
  border: 1px solid #1F2C40; border-radius: 10px; background: #0D1522;
  font: 12px Arial, sans-serif; color: #C9D4E2;
}
.fut-frow { display: flex; align-items: flex-start; gap: 8px; }
.fut-ftiles { display: flex; flex-wrap: wrap; gap: 4px; flex: 1; }
.fut-ftilewrap { position: relative; display: inline-flex; }
.fut-ftile {
  position: relative; display: inline-flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px;
  min-width: 56px; height: 58px; padding: 6px 4px; border-radius: 8px; border: 1px solid #24344B; background: #0A111C;
  color: #4FD1E8; font: 11px Arial, sans-serif; cursor: pointer;
}
.fut-ftile:hover { border-color: #4FD1E8; background: #0F1C2C; }
.fut-ftile.dim { color: #5B6B80; }
.fut-ftile.dim .fut-flabel { color: #8A9BB0; }
.fut-fkey {
  position: absolute; left: 4px; top: 3px; padding: 0 3px; border-radius: 3px; background: #16243A;
  color: #8A9BB0; font: 10px/13px Consolas, monospace;
}
.fut-flabel { color: #E6EDF5; font-weight: 700; white-space: nowrap; }
.fut-fcaption { color: #8A9BB0; font-size: 10px; max-width: 76px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fut-ftilewrap .fut-ftile { padding-right: 16px; }
.fut-fcaret {
  position: absolute; right: 2px; top: 2px; width: 16px; height: 20px; padding: 0; border: 0; background: none;
  color: #8A9BB0; cursor: pointer;
}
.fut-fcaret:hover { color: #E6EDF5; }
.fut-fcaret svg { width: 14px; height: 14px; }
.fut-fside { display: grid; grid-template-columns: repeat(2, auto); gap: 4px; align-content: start; }
.fut-ficon {
  width: 30px; height: 26px; display: inline-flex; align-items: center; justify-content: center; padding: 0;
  border-radius: 7px; border: 1px solid #24344B; background: #0A111C; color: #8A9BB0; cursor: pointer;
}
.fut-ficon:hover { border-color: #4FD1E8; color: #E6EDF5; }
.fut-ficon.on { border-color: #38C56E; color: #38C56E; }
.fut-finfo { color: #8A9BB0; font-size: 11px; min-height: 14px; }
.fut-finfo.err { color: #FF7A7A; }
.fut-fmenu {
  position: fixed; z-index: 100001; min-width: 220px; max-height: 320px; overflow-y: auto;
  display: flex; flex-direction: column; padding: 4px; border: 1px solid #2C3E57; border-radius: 8px; background: #0A111C;
  box-shadow: 0 10px 30px rgba(0,0,0,0.6);
}
.fut-fmenu .fut-fbtn {
  height: 24px; padding: 0 8px; border: 0; border-radius: 5px; background: none; text-align: left;
  color: #C9D4E2; font: 12px Arial, sans-serif; cursor: pointer; white-space: nowrap;
}
.fut-fmenu .fut-fbtn:hover { background: #12283A; }
.fut-fmenu .fut-fbtn.on { color: #FFC94D; }
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
.fut-fgrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 8px 12px; }
.fut-ffield { display: flex; flex-direction: column; gap: 3px; color: #8A9BB0; font-size: 11px; }
.fut-ffield input, .fut-ffield select {
  height: 26px; padding: 0 6px; border-radius: 6px; border: 1px solid #2C3E57; background: #0D1522; color: #E6EDF5; font: 12px Arial, sans-serif;
}
.fut-ffield input:focus, .fut-ffield select:focus { outline: none; border-color: #4FD1E8; }
.fut-fcheck { display: flex; align-items: center; gap: 6px; color: #C9D4E2; font-size: 12px; align-self: end; min-height: 26px; }
.fut-freserve { margin-top: 12px; padding: 10px; border: 1px solid #1F2C40; border-radius: 8px; background: #0D1522; }
.fut-freserve h5 { margin-top: 0; }
.fut-feditor h6 { margin: 10px 0 4px; font-size: 11px; font-weight: 400; color: #8A9BB0; }
.fut-fkeys { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 6px 12px; }
.fut-fkeyrow { display: flex; align-items: center; gap: 8px; color: #C9D4E2; }
.fut-fkeyrow kbd { min-width: 20px; padding: 1px 5px; border: 1px solid #2C3E57; border-radius: 4px; background: #0D1522; color: #4FD1E8; font: 11px Consolas, monospace; text-align: center; }
.fut-fnote { margin: 6px 0 0; color: #8A9BB0; font-size: 11px; }
.fut-factions { display: flex; align-items: center; gap: 8px; margin-top: 14px; }
`;
