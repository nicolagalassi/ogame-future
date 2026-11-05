/** Styles for Future's bars on the game's fleet page (scoped by fut- class names). */
export const FLEET_CSS = `
.fut-fbar {
  display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin: 6px 10px; padding: 6px 8px;
  border: 1px solid #1F2C40; border-radius: 8px; background: linear-gradient(#16243A, #0D1522);
  font: 12px Arial, sans-serif; color: #C9D4E2;
}
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
  height: 24px; padding: 0 6px; border-radius: 5px; border: 1px solid #2C3E57; background: #0A111C;
  color: #E6EDF5; font: 12px Arial, sans-serif;
}
.fut-fnote { margin: 6px 0 0; color: #8A9BB0; font-size: 11px; }
.fut-factions { display: flex; align-items: center; gap: 8px; margin-top: 10px; }
.fut-fstatus { color: #38C56E; }
`;
