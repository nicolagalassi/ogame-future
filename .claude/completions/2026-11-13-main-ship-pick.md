# 2026-11-13 — Nave principale scelta sulla nave

Tasto cargo su ogni nave da carico in fleet1 (`renderFleetTools`, `.fut-mainship`): imposta `mainShip`
e ripete l'azione automatica in corso (moon / collect / plan) via `state.rerun`. Test in `tests/fleet.test.ts`.
