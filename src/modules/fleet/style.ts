/** Styles for Future's bars on the game's fleet page (scoped by fut- class names). */
export const FLEET_CSS = `
.fut-fbar {
  display: flex; flex-direction: column; gap: 6px; margin: 6px 10px; padding: 6px 8px;
  border: 1px solid #1F2C40; border-radius: 8px; background: linear-gradient(#16243A, #0D1522);
  font: 12px Arial, sans-serif; color: #C9D4E2;
}
.fut-frow { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
.fut-fgroup { display: inline-flex; align-items: center; gap: 0; }
.fut-fgroup > .fut-fbtn { border-top-right-radius: 0; border-bottom-right-radius: 0; }
.fut-fdest { display: inline-flex; align-items: center; }
.fut-fdest select {
  height: 26px; max-width: 150px; padding: 0 4px; border: 1px solid #2C3E57; border-left: 0; background: #0A111C !important;
  color: #C9D4E2 !important; font: 11px Arial, sans-serif;
}
.fut-fstar { border-left: 0; border-top-left-radius: 0; border-bottom-left-radius: 0; color: #5B6B80; padding: 0 7px; }
.fut-fstar.on { color: #FFC94D; }
.fut-fbtn.dim { opacity: 0.55; }
.fut-fchip { border-radius: 13px; }
.fut-fchip.on { border-color: #38C56E; color: #38C56E; }
.fut-finfo.err { color: #FF7A7A; }
.fut-fcheck { display: flex; align-items: center; gap: 6px; color: #C9D4E2; font-size: 12px; align-self: end; height: 24px; }
.fut-feditor h5 { margin: 10px 0 6px; font-size: 11px; color: #8A9BB0; text-transform: uppercase; letter-spacing: 0.06em; }
.fut-fbrand { font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #4FD1E8; margin-right: 4px; }
.fut-fbtn {
  height: 26px; padding: 0 10px; border-radius: 6px; border: 1px solid #2C3E57; background: #0A111C;
  color: #E6EDF5; font: 12px Arial, sans-serif; cursor: pointer;
}
.fut-fbtn:hover { border-color: #4FD1E8; }
.fut-fbtn.primary { border-color: #4FD1E8; background: #12283A; font-weight: 700; }
.fut-fbtn.pulse { animation: fut-pulse 1.2s ease-in-out infinite; }
@keyframes fut-pulse { 50% { box-shadow: 0 0 10px rgba(79,209,232,0.8); } }
.fut-finfo { color: #8A9BB0; margin-left: auto; }
.fut-feditor {
  margin: 0 10px 8px; padding: 10px; border: 1px solid #1F2C40; border-radius: 8px; background: #0D1522;
  font: 12px Arial, sans-serif; color: #C9D4E2;
}
.fut-feditor[hidden] { display: none; }
.fut-feditor h4 { margin: 8px 0 6px; font-size: 12px; color: #4FD1E8; }
.fut-feditor h4:first-child { margin-top: 0; }
.fut-fgrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 6px 10px; }
.fut-ffield { display: flex; flex-direction: column; gap: 2px; color: #8A9BB0; font-size: 11px; }
.fut-ffield input, .fut-ffield select {
  height: 24px; padding: 0 6px; border-radius: 5px; border: 1px solid #2C3E57; background: #0A111C !important;
  color: #E6EDF5 !important; font: 12px Arial, sans-serif; box-shadow: none !important;
}
/* Browser autofill painted the first reserve field white in game: keep our colours. */
.fut-ffield input:-webkit-autofill { -webkit-box-shadow: 0 0 0 30px #0A111C inset !important; -webkit-text-fill-color: #E6EDF5 !important; }
.fut-fnote { margin: 6px 0 0; color: #8A9BB0; font-size: 11px; }
.fut-factions { display: flex; align-items: center; gap: 8px; margin-top: 10px; }
.fut-fstatus { color: #38C56E; }
`;
